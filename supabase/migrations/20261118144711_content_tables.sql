-- Learning content: topics → subtopics → exercises.
-- Formats mirror src/features/curriculum/schema.ts and src/features/exercises/schema.ts.
-- Answers, solutions and hints live in exercise_solutions, which students cannot read directly
-- (otherwise anyone with the public key could download all solutions); grading and revealing
-- happen later through SECURITY DEFINER functions.

create type public.difficulty as enum ('leicht', 'mittel', 'schwer', 'sehr_schwer');

create type public.exercise_type as enum (
  'multiple_choice', 'numeric', 'term', 'matching', 'cloze', 'true_false', 'ordering', 'handwritten'
);

create type public.content_status as enum ('review', 'published', 'archived');

-- Topics ---------------------------------------------------------------------

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) > 0),
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) > 0),
  description text not null default '',
  sort_order integer not null default 0,
  video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subtopics_topic_id_idx on public.subtopics (topic_id);

-- Where a subtopic is taught: (state, school type, grade).
create table public.subtopic_placements (
  subtopic_id uuid not null references public.subtopics (id) on delete cascade,
  state public.state_code not null,
  school_type public.school_type not null,
  grade smallint not null check (grade between 5 and 13),
  source text not null,
  primary key (subtopic_id, state, school_type, grade)
);

create index subtopic_placements_lookup_idx
  on public.subtopic_placements (state, school_type, grade);

-- Exercises ------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  subtopic_id uuid not null references public.subtopics (id) on delete restrict,
  type public.exercise_type not null,
  status public.content_status not null default 'review',
  prompt text not null check (char_length(prompt) > 0),
  diagram jsonb,
  -- What the client needs to render the answer UI, without revealing the solution
  -- (e.g. multiple-choice options without the correct flags, shuffled ordering items).
  presentation jsonb not null default '{}'::jsonb,
  inspiration text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercises_subtopic_status_idx on public.exercises (subtopic_id, status);

-- Difficulty is relative to the placement.
create table public.exercise_placements (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  state public.state_code not null,
  school_type public.school_type not null,
  grade smallint not null check (grade between 5 and 13),
  difficulty public.difficulty not null,
  primary key (exercise_id, state, school_type, grade)
);

create index exercise_placements_lookup_idx
  on public.exercise_placements (state, school_type, grade, difficulty);

create table public.exercise_solutions (
  exercise_id uuid primary key references public.exercises (id) on delete cascade,
  answer jsonb not null,
  solution jsonb not null,
  hints jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Triggers -------------------------------------------------------------------

create trigger topics_set_updated_at before update on public.topics
  for each row execute function public.set_updated_at();
create trigger subtopics_set_updated_at before update on public.subtopics
  for each row execute function public.set_updated_at();
create trigger exercises_set_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();
create trigger exercise_solutions_set_updated_at before update on public.exercise_solutions
  for each row execute function public.set_updated_at();

create function public.exercises_set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger exercises_set_published_at before insert or update of status on public.exercises
  for each row execute function public.exercises_set_published_at();

-- RLS ------------------------------------------------------------------------
-- Curriculum (topics, subtopics, placements) is public, non-personal data → readable by everyone.
-- Exercises: signed-in users see published ones. Solutions: admins only (service_role bypasses RLS
-- for the import script). All writes: admins only.

alter table public.topics enable row level security;
alter table public.subtopics enable row level security;
alter table public.subtopic_placements enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_placements enable row level security;
alter table public.exercise_solutions enable row level security;

revoke insert, update, delete, truncate on
  public.topics, public.subtopics, public.subtopic_placements,
  public.exercises, public.exercise_placements, public.exercise_solutions
from anon;
revoke all on public.exercises, public.exercise_placements, public.exercise_solutions from anon;

create policy "topics: everyone can read" on public.topics
  for select to anon, authenticated using (true);
create policy "topics: admin can write" on public.topics
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "subtopics: everyone can read" on public.subtopics
  for select to anon, authenticated using (true);
create policy "subtopics: admin can write" on public.subtopics
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "subtopic_placements: everyone can read" on public.subtopic_placements
  for select to anon, authenticated using (true);
create policy "subtopic_placements: admin can write" on public.subtopic_placements
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "exercises: users read published" on public.exercises
  for select to authenticated
  using (status = 'published' or (select public.is_admin()));
create policy "exercises: admin can write" on public.exercises
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "exercise_placements: users read published" on public.exercise_placements
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.exercises e
      where e.id = exercise_id and e.status = 'published'
    )
  );
create policy "exercise_placements: admin can write" on public.exercise_placements
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "exercise_solutions: admin only" on public.exercise_solutions
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
