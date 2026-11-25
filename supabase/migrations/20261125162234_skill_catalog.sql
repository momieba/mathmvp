-- Basis-skill catalog (docs/specs/2026-11-25-skill-modell-und-wiederholung.md, stage 2).
-- Cross-cutting skills (fractions, signs, equation solving …) used across many subtopics.
-- Each skill names the subtopics where it is taught ("home"), the target of review suggestions.
-- Content table: written by the import script (service role) or admins; readable when signed in.

create type public.skill_category as enum (
  'arithmetik', 'algebra', 'geometrie', 'funktionen', 'stochastik', 'allgemein'
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) > 0),
  description text not null check (char_length(description) > 0),
  category public.skill_category not null,
  grade_from smallint not null check (grade_from between 5 and 13),
  parent_id uuid references public.skills (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create index skills_parent_idx on public.skills (parent_id);

create trigger skills_set_updated_at before update on public.skills
  for each row execute function public.set_updated_at();

create table public.skill_home_subtopics (
  skill_id uuid not null references public.skills (id) on delete cascade,
  subtopic_id uuid not null references public.subtopics (id) on delete cascade,
  primary key (skill_id, subtopic_id)
);

create index skill_home_subtopics_subtopic_idx on public.skill_home_subtopics (subtopic_id);

-- RLS ---------------------------------------------------------------------------------------
alter table public.skills enable row level security;
alter table public.skill_home_subtopics enable row level security;

revoke all on public.skills, public.skill_home_subtopics from anon;

create policy "skills: signed-in can read" on public.skills
  for select to authenticated using (true);
create policy "skills: admin can insert" on public.skills
  for insert to authenticated with check ((select private.is_admin()));
create policy "skills: admin can update" on public.skills
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "skills: admin can delete" on public.skills
  for delete to authenticated using ((select private.is_admin()));

create policy "skill_home_subtopics: signed-in can read" on public.skill_home_subtopics
  for select to authenticated using (true);
create policy "skill_home_subtopics: admin can insert" on public.skill_home_subtopics
  for insert to authenticated with check ((select private.is_admin()));
create policy "skill_home_subtopics: admin can update" on public.skill_home_subtopics
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "skill_home_subtopics: admin can delete" on public.skill_home_subtopics
  for delete to authenticated using ((select private.is_admin()));
