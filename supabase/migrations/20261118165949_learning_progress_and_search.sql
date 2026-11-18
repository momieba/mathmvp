-- Learning progress (my topics, attempts), server-side answer checking, hints and topic search.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() is only STABLE; an IMMUTABLE wrapper with a fixed dictionary is the standard workaround.
create function private.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1);
$$;

revoke execute on function private.f_unaccent(text) from public, anon;
grant execute on function private.f_unaccent(text) to authenticated;

-- My topics -----------------------------------------------------------------------------
create table public.student_topics (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index student_topics_topic_idx on public.student_topics (topic_id);

alter table public.student_topics enable row level security;
revoke all on public.student_topics from anon;

create policy "student_topics: owner can read" on public.student_topics
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "student_topics: owner can add" on public.student_topics
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "student_topics: owner can remove" on public.student_topics
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Attempts: written only by submit_answer (SECURITY DEFINER), readable by their owner ------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  subtopic_id uuid not null references public.subtopics (id) on delete cascade,
  correct boolean not null,
  answer jsonb not null,
  -- e.g. AI feedback for handwritten answers (later)
  feedback jsonb,
  created_at timestamptz not null default now()
);

create index attempts_user_subtopic_idx on public.attempts (user_id, subtopic_id, created_at desc);
create index attempts_exercise_idx on public.attempts (exercise_id);

alter table public.attempts enable row level security;
revoke all on public.attempts from anon, authenticated;
grant select on public.attempts to authenticated;

create policy "attempts: owner can read" on public.attempts
  for select to authenticated using ((select auth.uid()) = user_id);

-- Last 15 attempts per subtopic of the current user (input for the score, computed in the app).
create view public.my_recent_attempts
with (security_invoker = true)
as
select subtopic_id, exercise_id, correct, created_at
from (
  select
    a.subtopic_id, a.exercise_id, a.correct, a.created_at,
    row_number() over (partition by a.subtopic_id order by a.created_at desc) as rn
  from public.attempts a
  where a.user_id = (select auth.uid())
) ranked
where rn <= 15;

grant select on public.my_recent_attempts to authenticated;
revoke all on public.my_recent_attempts from anon;

-- Answer checking ----------------------------------------------------------------------------
-- Solutions stay in exercise_solutions (not readable by students); this function grades the
-- answer, records the attempt and only then returns the solution.
create function public.submit_answer(p_exercise_id uuid, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ex public.exercises;
  v_sol public.exercise_solutions;
  v_correct boolean := false;
  v_value numeric;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_ex from public.exercises where id = p_exercise_id and status = 'published';
  if not found then
    raise exception 'exercise not found' using errcode = 'P0002';
  end if;
  select * into v_sol from public.exercise_solutions where exercise_id = p_exercise_id;

  if v_ex.type = 'numeric' then
    begin
      v_value := replace(p_answer ->> 'value', ',', '.')::numeric;
      v_correct := abs(v_value - (v_sol.answer ->> 'value')::numeric)
        <= coalesce((v_sol.answer ->> 'tolerance')::numeric, 0) + 0.000000001;
    exception when others then
      v_correct := false; -- unparsable input counts as wrong
    end;
  elsif v_ex.type = 'multiple_choice' then
    v_correct := coalesce(
      (select array_agg(x::int order by x::int) from jsonb_array_elements_text(p_answer -> 'selected') x)
      = (select array_agg(x::int order by x::int) from jsonb_array_elements_text(v_sol.answer -> 'correct') x),
      false
    );
  else
    raise exception 'exercise type % is not checked here', v_ex.type using errcode = '22023';
  end if;

  insert into public.attempts (user_id, exercise_id, subtopic_id, correct, answer)
  values (v_uid, v_ex.id, v_ex.subtopic_id, v_correct, coalesce(p_answer, '{}'::jsonb));

  return jsonb_build_object(
    'correct', v_correct,
    'answer', v_sol.answer,
    'solution', v_sol.solution
  );
end;
$$;

revoke execute on function public.submit_answer(uuid, jsonb) from public, anon;
grant execute on function public.submit_answer(uuid, jsonb) to authenticated;

-- Hints are revealed one by one (index starting at 0) without counting as an attempt.
create function public.get_hint(p_exercise_id uuid, p_index integer)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.hints ->> p_index
  from public.exercise_solutions s
  join public.exercises e on e.id = s.exercise_id
  where s.exercise_id = p_exercise_id and e.status = 'published' and (select auth.uid()) is not null;
$$;

revoke execute on function public.get_hint(uuid, integer) from public, anon;
grant execute on function public.get_hint(uuid, integer) to authenticated;

-- Topic search: accent-insensitive substring + trigram word similarity (tolerates typos) ----
create function public.search_topics(p_query text)
returns table (topic_id uuid, slug text, title text, description text, matched text, score real)
language sql
stable
set search_path = ''
as $$
  with q as (
    select lower(private.f_unaccent(trim(p_query))) as q
  ),
  candidates as (
    select t.id, t.slug, t.title, t.description, t.title as matched,
           lower(private.f_unaccent(t.title || ' ' || t.description)) as txt
    from public.topics t
    union all
    select t.id, t.slug, t.title, t.description, s.title,
           lower(private.f_unaccent(s.title || ' ' || s.description))
    from public.subtopics s
    join public.topics t on t.id = s.topic_id
  ),
  scored as (
    select c.*,
           greatest(
             extensions.word_similarity(q.q, c.txt),
             case when strpos(c.txt, q.q) > 0 then 1 else 0 end
           )::real as score
    from candidates c, q
    where char_length(q.q) >= 2
  )
  select id, slug, title, description,
         (array_agg(matched order by score desc))[1],
         max(score)
  from scored
  where score >= 0.4
  group by id, slug, title, description
  order by max(score) desc, title
  limit 20;
$$;

revoke execute on function public.search_topics(text) from public, anon;
grant execute on function public.search_topics(text) to authenticated;
