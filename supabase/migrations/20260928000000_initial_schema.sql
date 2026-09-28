-- ============================================================================
-- AI Accessible Exam Platform — initial schema
--
-- Security model
--   * Candidates never talk to the database directly. Every candidate action
--     (verify ID, start, save answer, submit, explanations) goes through the
--     Vercel /api functions, which use the service-role key. Correct answers
--     therefore never reach the browser.
--   * Teachers sign in with Supabase Auth and must also have a row in
--     public.teachers. Row Level Security only grants access to teachers.
--   * The anon role has no policies at all, so the public key can read nothing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Teachers (allow-list of Supabase Auth users who can manage exams)
-- ---------------------------------------------------------------------------
create table public.teachers (
    user_id    uuid primary key references auth.users (id) on delete cascade,
    full_name  text,
    created_at timestamptz not null default now()
);

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.teachers where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Exams
-- ---------------------------------------------------------------------------
create table public.exams (
    id                            uuid primary key default gen_random_uuid(),
    title                         text not null,
    subject                       text not null,
    description                   text,
    duration_minutes              int  not null default 60 check (duration_minutes between 1 and 600),
    scheduled_start               timestamptz not null,
    scheduled_end                 timestamptz not null,
    is_published                  boolean not null default false,
    max_question_explanations     int  not null default 3 check (max_question_explanations between 0 and 20),
    allow_ai_explanations_in_exam boolean not null default false,
    created_by                    uuid references auth.users (id) on delete set null default auth.uid(),
    created_at                    timestamptz not null default now(),
    constraint exams_schedule_valid check (scheduled_end > scheduled_start)
);

-- ---------------------------------------------------------------------------
-- Candidates (no username/password — the Candidate ID is the credential)
-- ---------------------------------------------------------------------------
create table public.candidates (
    id               uuid primary key default gen_random_uuid(),
    candidate_code   text not null unique check (candidate_code ~ '^EXM-[0-9]{4}-[A-Z0-9]{5}$'),
    full_name        text not null,
    email            text,
    assigned_exam_id uuid references public.exams (id) on delete set null,
    is_active        boolean not null default true,
    created_at       timestamptz not null default now()
);
create index candidates_assigned_exam_idx on public.candidates (assigned_exam_id);

-- ---------------------------------------------------------------------------
-- Questions (options stored as a JSON array of strings)
-- ---------------------------------------------------------------------------
create table public.questions (
    id                   uuid primary key default gen_random_uuid(),
    exam_id              uuid not null references public.exams (id) on delete cascade,
    question_text        text not null,
    options              jsonb not null,
    correct_option_index int  not null,
    explanation          text,
    visual_description   text,
    has_visual_content   boolean not null default false,
    difficulty           text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
    topic                text,
    marks                int  not null default 1 check (marks > 0),
    order_index          int  not null,
    created_at           timestamptz not null default now(),
    constraint questions_options_valid check (
        jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6
    ),
    constraint questions_correct_option_valid check (
        correct_option_index >= 0 and correct_option_index < jsonb_array_length(options)
    )
);
create index questions_exam_order_idx on public.questions (exam_id, order_index);

-- ---------------------------------------------------------------------------
-- Attempts (single attempt per candidate per exam)
-- ---------------------------------------------------------------------------
create table public.attempts (
    id              uuid primary key default gen_random_uuid(),
    candidate_id    uuid not null references public.candidates (id) on delete cascade,
    exam_id         uuid not null references public.exams (id) on delete cascade,
    started_at      timestamptz not null default now(),
    submitted_at    timestamptz,
    status          text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
    score           numeric(7, 2),
    total_marks     int,
    total_questions int not null,
    correct_count   int not null default 0,
    answered_count  int not null default 0,
    skipped_count   int not null default 0,
    marked_count    int not null default 0,
    unique (candidate_id, exam_id)
);
create index attempts_exam_idx on public.attempts (exam_id);

create table public.answers (
    id                    uuid primary key default gen_random_uuid(),
    attempt_id            uuid not null references public.attempts (id) on delete cascade,
    question_id           uuid not null references public.questions (id) on delete cascade,
    selected_option_index int,
    is_skipped            boolean not null default false,
    is_marked_for_review  boolean not null default false,
    updated_at            timestamptz not null default now(),
    unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Server-enforced explanation limit (per candidate, per question, per attempt)
-- ---------------------------------------------------------------------------
create table public.question_explanation_usage (
    id                uuid primary key default gen_random_uuid(),
    candidate_id      uuid not null references public.candidates (id) on delete cascade,
    question_id       uuid not null references public.questions (id) on delete cascade,
    attempt_id        uuid not null references public.attempts (id) on delete cascade,
    usage_count       int  not null default 0,
    max_allowed       int  not null default 3,
    last_requested_at timestamptz not null default now(),
    unique (candidate_id, question_id, attempt_id)
);

-- Atomically consumes one explanation. Safe under concurrent requests: the
-- conditional upsert only increments while usage_count < max_allowed.
create or replace function public.consume_explanation(
    p_candidate_id uuid,
    p_question_id  uuid,
    p_attempt_id   uuid,
    p_max_allowed  int
)
returns table (allowed boolean, used_count int, remaining int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_count int;
begin
    if p_max_allowed <= 0 then
        return query select false, 0, 0;
        return;
    end if;

    insert into question_explanation_usage as u
        (candidate_id, question_id, attempt_id, usage_count, max_allowed, last_requested_at)
    values
        (p_candidate_id, p_question_id, p_attempt_id, 1, p_max_allowed, now())
    on conflict (candidate_id, question_id, attempt_id) do update
        set usage_count = u.usage_count + 1,
            last_requested_at = now()
        where u.usage_count < u.max_allowed
    returning u.usage_count into v_count;

    if v_count is null then
        select u.usage_count into v_count
        from question_explanation_usage u
        where u.candidate_id = p_candidate_id
          and u.question_id = p_question_id
          and u.attempt_id = p_attempt_id;
        return query select false, coalesce(v_count, 0), 0;
    else
        return query select true, v_count, greatest(p_max_allowed - v_count, 0);
    end if;
end;
$$;

revoke all on function public.consume_explanation(uuid, uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.consume_explanation(uuid, uuid, uuid, int) to service_role;

-- ---------------------------------------------------------------------------
-- Accessibility barrier events (aggregated for teachers, no personal data)
-- ---------------------------------------------------------------------------
create table public.barrier_events (
    id          uuid primary key default gen_random_uuid(),
    attempt_id  uuid references public.attempts (id) on delete cascade,
    exam_id     uuid references public.exams (id) on delete cascade,
    question_id uuid references public.questions (id) on delete set null,
    event_type  text not null check (event_type in ('repeated_read', 'nav_delay', 'voice_error', 'skip_spike')),
    details     jsonb,
    created_at  timestamptz not null default now()
);
create index barrier_events_exam_idx on public.barrier_events (exam_id);
create index barrier_events_attempt_idx on public.barrier_events (attempt_id);

-- ---------------------------------------------------------------------------
-- AI performance analysis (one per submitted attempt)
-- ---------------------------------------------------------------------------
create table public.ai_analysis (
    id                   uuid primary key default gen_random_uuid(),
    attempt_id           uuid not null unique references public.attempts (id) on delete cascade,
    weak_topics          jsonb not null default '[]',
    strong_topics        jsonb not null default '[]',
    learning_barriers    jsonb not null default '[]',
    recommended_practice jsonb not null default '[]',
    overall_summary      text  not null,
    ai_generated         boolean not null default false,
    generated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Documents processed by the Vision/OCR accessibility tool
-- ---------------------------------------------------------------------------
create table public.documents (
    id                     uuid primary key default gen_random_uuid(),
    title                  text not null,
    uploaded_by            uuid references auth.users (id) on delete set null default auth.uid(),
    raw_ocr_text           text,
    accessible_description text,
    structured_questions   jsonb,
    created_at             timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.teachers                   enable row level security;
alter table public.exams                      enable row level security;
alter table public.candidates                 enable row level security;
alter table public.questions                  enable row level security;
alter table public.attempts                   enable row level security;
alter table public.answers                    enable row level security;
alter table public.question_explanation_usage enable row level security;
alter table public.barrier_events             enable row level security;
alter table public.ai_analysis                enable row level security;
alter table public.documents                  enable row level security;

create policy "Teachers can read their own teacher record" on public.teachers
    for select to authenticated using (user_id = auth.uid());

create policy "Teachers manage exams" on public.exams
    for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy "Teachers manage candidates" on public.candidates
    for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy "Teachers manage questions" on public.questions
    for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

create policy "Teachers read attempts" on public.attempts
    for select to authenticated using (public.is_teacher());

-- Lets a teacher reset a candidate's attempt so the ID can be used again.
create policy "Teachers reset attempts" on public.attempts
    for delete to authenticated using (public.is_teacher());

create policy "Teachers read answers" on public.answers
    for select to authenticated using (public.is_teacher());

create policy "Teachers read explanation usage" on public.question_explanation_usage
    for select to authenticated using (public.is_teacher());

create policy "Teachers read barrier events" on public.barrier_events
    for select to authenticated using (public.is_teacher());

create policy "Teachers read AI analysis" on public.ai_analysis
    for select to authenticated using (public.is_teacher());

create policy "Teachers manage documents" on public.documents
    for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
