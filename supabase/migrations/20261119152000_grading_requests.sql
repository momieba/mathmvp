-- Rate limiting for the grade-handwriting Edge Function.
-- Every grading request (also unreadable ones and failures, which create no attempt) is one row.
-- Only the Edge Function writes/reads it with the service role: RLS on, no policies, no grants.

create table public.grading_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- starts as 'error' and is set to graded/unreadable once the model answered
  outcome text not null default 'error' check (outcome in ('graded', 'unreadable', 'error'))
);

create index grading_requests_user_created_idx on public.grading_requests (user_id, created_at desc);
create index grading_requests_created_idx on public.grading_requests (created_at desc);

alter table public.grading_requests enable row level security;
revoke all on public.grading_requests from anon, authenticated;
