-- Exam mode per topic: up to 8 tasks from all its subtopics, 30 minutes, no hints, grade at the end.
-- Sessions and answers are written only by SECURITY DEFINER functions (and the grade-handwriting
-- Edge Function with the service role). Correctness/solutions become visible only after submission.
-- Exam answers do not count towards the practice score (separate from `attempts`).

-- Answer checking shared by submit_answer and the exam -----------------------------------------
create function private.check_answer(p_type public.exercise_type, p_answer jsonb, p_solution jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value numeric;
begin
  if p_type = 'numeric' then
    begin
      v_value := replace(p_answer ->> 'value', ',', '.')::numeric;
      return coalesce(
        abs(v_value - (p_solution ->> 'value')::numeric)
          <= coalesce((p_solution ->> 'tolerance')::numeric, 0) + 0.000000001,
        false
      );
    exception when others then
      return false; -- unparsable input counts as wrong
    end;
  elsif p_type = 'multiple_choice' then
    return coalesce(
      (select array_agg(x::int order by x::int) from jsonb_array_elements_text(p_answer -> 'selected') x)
      = (select array_agg(x::int order by x::int) from jsonb_array_elements_text(p_solution -> 'correct') x),
      false
    );
  end if;
  raise exception 'exercise type % is not checked here', p_type using errcode = '22023';
end;
$$;

revoke execute on function private.check_answer(public.exercise_type, jsonb, jsonb) from public, anon;
grant execute on function private.check_answer(public.exercise_type, jsonb, jsonb) to authenticated;

create or replace function public.submit_answer(p_exercise_id uuid, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ex public.exercises;
  v_sol public.exercise_solutions;
  v_correct boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_ex from public.exercises where id = p_exercise_id and status = 'published';
  if not found then
    raise exception 'exercise not found' using errcode = 'P0002';
  end if;
  select * into v_sol from public.exercise_solutions where exercise_id = p_exercise_id;

  v_correct := private.check_answer(v_ex.type, p_answer, v_sol.answer);

  insert into public.attempts (user_id, exercise_id, subtopic_id, correct, answer)
  values (v_uid, v_ex.id, v_ex.subtopic_id, v_correct, coalesce(p_answer, '{}'::jsonb));

  return jsonb_build_object(
    'correct', v_correct,
    'answer', v_sol.answer,
    'solution', v_sol.solution
  );
end;
$$;

-- Tables ---------------------------------------------------------------------------------------
create table public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  -- task order as shown to the student
  exercise_ids uuid[] not null check (cardinality(exercise_ids) between 1 and 8),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  -- sum of exam_answers.points, set on submission
  points numeric(4, 1),
  max_points smallint not null
);

create index exam_sessions_user_topic_idx on public.exam_sessions (user_id, topic_id, started_at desc);
create index exam_sessions_topic_idx on public.exam_sessions (topic_id);

alter table public.exam_sessions enable row level security;
revoke all on public.exam_sessions from anon, authenticated;
grant select on public.exam_sessions to authenticated;

create policy "exam_sessions: owner can read" on public.exam_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.exam_answers (
  session_id uuid not null references public.exam_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answer jsonb not null,
  correct boolean not null,
  -- 1 = correct, 0.5 = handwritten with correct result but a wrong step, 0 = wrong
  points numeric(2, 1) not null check (points in (0, 0.5, 1)),
  feedback jsonb,
  answered_at timestamptz not null default now(),
  primary key (session_id, exercise_id)
);

create index exam_answers_exercise_idx on public.exam_answers (exercise_id);
create index exam_answers_user_idx on public.exam_answers (user_id);

alter table public.exam_answers enable row level security;
revoke all on public.exam_answers from anon, authenticated;
grant select on public.exam_answers to authenticated;

-- Readable only after submission, so correctness does not leak during the exam.
create policy "exam_answers: owner can read after submission" on public.exam_answers
  for select to authenticated using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.exam_sessions s
      where s.id = session_id and s.submitted_at is not null
    )
  );

-- Helpers --------------------------------------------------------------------------------------
-- Late requests (network) are accepted up to this long after the deadline.
create function private.exam_grace()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '1 minute' $$;

revoke execute on function private.exam_grace() from public, anon;
grant execute on function private.exam_grace() to authenticated;

create function private.finalize_exam(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.exam_sessions s
  set submitted_at = least(now(), s.deadline_at),
      points = coalesce(
        (select sum(a.points) from public.exam_answers a where a.session_id = s.id), 0
      )
  where s.id = p_session_id and s.submitted_at is null;
$$;

revoke execute on function private.finalize_exam(uuid) from public, anon, authenticated;

-- start_exam: resumes the open session of this topic or starts a new one ------------------------
create function public.start_exam(p_topic_id uuid, p_types public.exercise_type[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_session public.exam_sessions;
  v_ids uuid[];
  v_expired uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- sessions that ran out without being submitted are graded now
  for v_expired in
    select id from public.exam_sessions
    where user_id = v_uid and submitted_at is null and deadline_at + private.exam_grace() < now()
  loop
    perform private.finalize_exam(v_expired);
  end loop;

  select * into v_session from public.exam_sessions
  where user_id = v_uid and topic_id = p_topic_id and submitted_at is null
  order by started_at desc
  limit 1;

  if not found then
    select * into v_profile from public.profiles where id = v_uid;

    -- Up to 8 tasks spread over the subtopics (round robin in random order), without "sehr schwer";
    -- shown from easy to hard. Difficulty: the placement of the student's class if there is one.
    with candidates as (
      select e.id, s.sort_order,
             coalesce(
               (select p.difficulty from public.exercise_placements p
                where p.exercise_id = e.id
                order by (p.state = v_profile.state and p.school_type = v_profile.school_type
                          and p.grade = v_profile.grade) desc, p.difficulty
                limit 1),
               'mittel'
             ) as difficulty
      from public.exercises e
      join public.subtopics s on s.id = e.subtopic_id
      where s.topic_id = p_topic_id
        and e.status = 'published'
        and e.type = any (p_types)
        and e.type in ('numeric', 'multiple_choice', 'handwritten')
    ),
    spread as (
      select c.*, row_number() over (partition by c.sort_order order by random()) as rn
      from candidates c
      where c.difficulty <> 'sehr_schwer'
    ),
    picked as (
      select * from spread order by rn, random() limit 8
    )
    select array_agg(id order by difficulty, sort_order) into v_ids from picked;

    if v_ids is null then
      raise exception 'no exercises for this topic' using errcode = 'P0002';
    end if;

    insert into public.exam_sessions (user_id, topic_id, exercise_ids, deadline_at, max_points)
    values (v_uid, p_topic_id, v_ids, now() + interval '30 minutes', cardinality(v_ids))
    returning * into v_session;
  end if;

  return jsonb_build_object(
    'id', v_session.id,
    'exerciseIds', to_jsonb(v_session.exercise_ids),
    'deadlineAt', v_session.deadline_at,
    'serverNow', now(),
    'answeredIds', coalesce(
      (select jsonb_agg(a.exercise_id) from public.exam_answers a where a.session_id = v_session.id),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.start_exam(uuid, public.exercise_type[]) from public, anon;
grant execute on function public.start_exam(uuid, public.exercise_type[]) to authenticated;

-- submit_exam_answer: typed answers (multiple choice, number); can be changed until submission ---
create function public.submit_exam_answer(p_session_id uuid, p_exercise_id uuid, p_answer jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.exam_sessions;
  v_ex public.exercises;
  v_sol public.exercise_solutions;
  v_correct boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_session from public.exam_sessions where id = p_session_id and user_id = v_uid;
  if not found then
    raise exception 'exam not found' using errcode = 'P0002';
  end if;
  if v_session.submitted_at is not null or now() > v_session.deadline_at + private.exam_grace() then
    raise exception 'exam is over' using errcode = '22023';
  end if;
  if not (p_exercise_id = any (v_session.exercise_ids)) then
    raise exception 'exercise is not part of this exam' using errcode = '22023';
  end if;

  select * into v_ex from public.exercises where id = p_exercise_id;
  select * into v_sol from public.exercise_solutions where exercise_id = p_exercise_id;
  v_correct := private.check_answer(v_ex.type, p_answer, v_sol.answer);

  insert into public.exam_answers (session_id, exercise_id, user_id, answer, correct, points)
  values (p_session_id, p_exercise_id, v_uid, coalesce(p_answer, '{}'::jsonb), v_correct,
          case when v_correct then 1 else 0 end)
  on conflict (session_id, exercise_id) do update
    set answer = excluded.answer, correct = excluded.correct, points = excluded.points,
        feedback = null, answered_at = now();
end;
$$;

revoke execute on function public.submit_exam_answer(uuid, uuid, jsonb) from public, anon;
grant execute on function public.submit_exam_answer(uuid, uuid, jsonb) to authenticated;

-- finish_exam: submits (idempotent) and returns the result with the solutions -------------------
create function public.finish_exam(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.exam_sessions;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.exam_sessions where id = p_session_id and user_id = v_uid) then
    raise exception 'exam not found' using errcode = 'P0002';
  end if;

  perform private.finalize_exam(p_session_id);
  select * into v_session from public.exam_sessions where id = p_session_id;

  return jsonb_build_object(
    'id', v_session.id,
    'topicId', v_session.topic_id,
    'startedAt', v_session.started_at,
    'submittedAt', v_session.submitted_at,
    'points', v_session.points,
    'maxPoints', v_session.max_points,
    'tasks', (
      select jsonb_agg(
        jsonb_build_object(
          'exerciseId', t.id,
          'answered', a.exercise_id is not null,
          'correct', coalesce(a.correct, false),
          'points', coalesce(a.points, 0),
          'answer', a.answer,
          'feedback', a.feedback,
          'reference', sol.answer,
          'solution', sol.solution
        )
        order by t.ord
      )
      from unnest(v_session.exercise_ids) with ordinality as t(id, ord)
      join public.exercise_solutions sol on sol.exercise_id = t.id
      left join public.exam_answers a on a.session_id = v_session.id and a.exercise_id = t.id
    )
  );
end;
$$;

revoke execute on function public.finish_exam(uuid) from public, anon;
grant execute on function public.finish_exam(uuid) to authenticated;
