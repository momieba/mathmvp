-- 1) Move is_admin() out of the API-exposed public schema (advisor 0029).
-- 2) Avoid multiple permissive SELECT policies (advisor 0006): admin write policies no longer use
--    FOR ALL; admin read access is folded into the single read policy per table.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- profiles --------------------------------------------------------------------
drop policy "profiles: owner can read" on public.profiles;
drop policy "profiles: admin can read all" on public.profiles;
create policy "profiles: owner or admin can read" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));

-- Helper: replace a FOR ALL admin policy with insert/update/delete policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'topics', 'subtopics', 'subtopic_placements', 'exercises', 'exercise_placements'
  ] loop
    execute format('drop policy %I on public.%I', t || ': admin can write', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))',
      t || ': admin can insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      t || ': admin can update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))',
      t || ': admin can delete', t);
  end loop;
end $$;

-- Read policies that referenced public.is_admin() --------------------------------
drop policy "exercises: users read published" on public.exercises;
create policy "exercises: users read published" on public.exercises
  for select to authenticated
  using (status = 'published' or (select private.is_admin()));

drop policy "exercise_placements: users read published" on public.exercise_placements;
create policy "exercise_placements: users read published" on public.exercise_placements
  for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1 from public.exercises e
      where e.id = exercise_id and e.status = 'published'
    )
  );

-- exercise_solutions stays admin-only (single FOR ALL policy, no other policy → no overlap).
drop policy "exercise_solutions: admin only" on public.exercise_solutions;
create policy "exercise_solutions: admin only" on public.exercise_solutions
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

drop function public.is_admin();
