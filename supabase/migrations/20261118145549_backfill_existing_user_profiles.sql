-- Create profiles for users who signed up before the on_auth_user_created trigger existed.
-- (20261118145243_backfill_profiles.sql was applied empty by accident and is kept as-is.)
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
