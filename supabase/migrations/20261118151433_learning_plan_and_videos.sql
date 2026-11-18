-- Learning plan per subtopic (stage, goals, prerequisites, exercise plan) and a video backlog.
-- Mirrors subtopicSchema / videoPlanSchema in src/features/curriculum/schema.ts.

create type public.learning_stage as enum ('einstieg', 'grundlagen', 'vertiefung', 'anwendung');
create type public.video_format as enum ('explainer', 'short');
create type public.video_status as enum ('planned', 'produced', 'published');

-- Subtopics: learning order = sort_order within the topic --------------------------------
alter table public.subtopics
  add column stage public.learning_stage not null default 'grundlagen',
  add column learning_goals text[] not null default '{}',
  -- Brief for exercise-author: { targetCount (>= 20), types[], difficultyMix{}, variationIdeas[] }
  add column exercise_plan jsonb not null default '{}'::jsonb,
  add column video_skip_reason text,
  drop column video_url;

alter table public.subtopics alter column stage drop default;

create index subtopics_topic_order_idx on public.subtopics (topic_id, sort_order);

-- Prerequisites between subtopics (may cross topics) --------------------------------------
create table public.subtopic_prerequisites (
  subtopic_id uuid not null references public.subtopics (id) on delete cascade,
  prerequisite_id uuid not null references public.subtopics (id) on delete cascade,
  primary key (subtopic_id, prerequisite_id),
  check (subtopic_id <> prerequisite_id)
);

create index subtopic_prerequisites_prerequisite_idx
  on public.subtopic_prerequisites (prerequisite_id);

-- Video backlog: planned by curriculum-researcher, produced via the video skills ----------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  subtopic_id uuid not null references public.subtopics (id) on delete cascade,
  format public.video_format not null,
  title text not null check (char_length(title) > 0),
  key_points text[] not null default '{}',
  status public.video_status not null default 'planned',
  url text check (url is null or url ~ '^https://'),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or url is not null)
);

create index videos_subtopic_idx on public.videos (subtopic_id, status);

create trigger videos_set_updated_at before update on public.videos
  for each row execute function public.set_updated_at();

create function public.videos_set_published_at()
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

create trigger videos_set_published_at before insert or update of status on public.videos
  for each row execute function public.videos_set_published_at();

-- RLS ---------------------------------------------------------------------------------------
alter table public.subtopic_prerequisites enable row level security;
alter table public.videos enable row level security;

revoke insert, update, delete, truncate on public.subtopic_prerequisites, public.videos from anon;

create policy "subtopic_prerequisites: everyone can read" on public.subtopic_prerequisites
  for select to anon, authenticated using (true);
create policy "subtopic_prerequisites: admin can insert" on public.subtopic_prerequisites
  for insert to authenticated with check ((select private.is_admin()));
create policy "subtopic_prerequisites: admin can update" on public.subtopic_prerequisites
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "subtopic_prerequisites: admin can delete" on public.subtopic_prerequisites
  for delete to authenticated using ((select private.is_admin()));

-- Published videos are public (e.g. linked from the landing page); the backlog is admin-only.
create policy "videos: read published or admin" on public.videos
  for select to anon, authenticated
  using (status = 'published' or (select private.is_admin()));
create policy "videos: admin can insert" on public.videos
  for insert to authenticated with check ((select private.is_admin()));
create policy "videos: admin can update" on public.videos
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "videos: admin can delete" on public.videos
  for delete to authenticated using ((select private.is_admin()));
