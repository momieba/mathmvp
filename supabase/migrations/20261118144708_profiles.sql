-- User profiles: one row per auth user, created automatically on sign-up.
-- Enum values must stay in sync with src/features/curriculum/schema.ts.

create type public.state_code as enum (
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'
);

create type public.school_type as enum (
  'gymnasium', 'realschule', 'gesamtschule', 'hauptschule',
  'mittelschule', 'oberschule', 'sekundarschule', 'stadtteilschule'
);

create type public.user_role as enum ('student', 'parent', 'teacher', 'admin');

-- Generic updated_at trigger function (reused by later tables).
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  state public.state_code,
  school_type public.school_type,
  grade smallint check (grade between 5 and 13),
  role public.user_role not null default 'student',
  privacy_version text,
  terms_accepted_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'App profile per auth user. Email lives in auth.users only.';
comment on column public.profiles.display_name is 'Nickname, no real name (data minimisation, minors).';
comment on column public.profiles.privacy_version is 'Version of the privacy policy the user accepted; changing it stamps terms_accepted_at.';

-- Server-controlled timestamps: clients cannot fake consent or onboarding times.
create function public.profiles_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.privacy_version is distinct from old.privacy_version then
    new.terms_accepted_at := case when new.privacy_version is null then null else now() end;
  end if;
  if new.onboarding_completed_at is null
     and new.state is not null and new.school_type is not null and new.grade is not null
     and new.terms_accepted_at is not null then
    new.onboarding_completed_at := now();
  end if;
  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row execute function public.profiles_before_update();

-- Create the profile row when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role check used by RLS policies. SECURITY DEFINER avoids recursive RLS on profiles.
create function public.is_admin()
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

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- RLS + column privileges: users read their own row and may only change the onboarding fields.
-- role, timestamps and id are not updatable by clients (no self-promotion to admin).
alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, state, school_type, grade, privacy_version) on public.profiles to authenticated;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: admin can read all" on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

create policy "profiles: owner can update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
