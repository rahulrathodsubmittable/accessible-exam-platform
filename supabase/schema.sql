-- ENABLE REQUIRED EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ACCESSIBILITY PREFERENCES
CREATE TABLE public.accessibility_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id VARCHAR(64) UNIQUE,
    font_size VARCHAR(16) DEFAULT 'medium', -- small, medium, large, x-large
    font_family VARCHAR(32) DEFAULT 'sans',
    line_spacing VARCHAR(16) DEFAULT 'normal',
    high_contrast BOOLEAN DEFAULT false,
    dark_mode BOOLEAN DEFAULT false,
    reduced_motion BOOLEAN DEFAULT false,
    speech_rate REAL DEFAULT 1.0,
    speech_pitch REAL DEFAULT 1.0,
    language VARCHAR(8) DEFAULT 'en',
    voice_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CANDIDATES TABLE (NO USERNAME/PASSWORD)
CREATE TABLE public.candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id VARCHAR(32) UNIQUE NOT NULL, -- e.g. EXM-2026-A7K92
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    assigned_exam_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXAMS TABLE
CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 60,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    is_published BOOLEAN DEFAULT false,
    max_question_explanations INT DEFAULT 3,
    max_reset_explanations INT DEFAULT 2,
    allow_ai_explanations_in_exam BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Foreign Key constraint to candidates
ALTER TABLE public.candidates
ADD CONSTRAINT fk_candidate_exam
FOREIGN KEY (assigned_exam_id) REFERENCES public.exams(id) ON DELETE SET NULL;

-- 4. QUESTIONS TABLE
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings e.g. ["Option A", "Option B", ...]
    correct_option_index INT NOT NULL,
    explanation TEXT,
    visual_description TEXT, -- For screen readers describing diagrams/charts
    has_visual_content BOOLEAN DEFAULT false,
    difficulty VARCHAR(32) DEFAULT 'medium',
    subject_topic VARCHAR(128),
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. EXAM ATTEMPTS
CREATE TABLE public.attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    status VARCHAR(32) DEFAULT 'in_progress', -- in_progress, submitted, expired
    score NUMERIC(5,2),
    total_questions INT NOT NULL,
    answered_count INT DEFAULT 0,
    skipped_count INT DEFAULT 0,
    marked_count INT DEFAULT 0,
    is_offline_synced BOOLEAN DEFAULT false
);

-- 6. QUESTION ANSWERS
CREATE TABLE public.answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID REFERENCES public.attempts(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option_index INT,
    is_skipped BOOLEAN DEFAULT false,
    is_marked_for_review BOOLEAN DEFAULT false,
    time_spent_seconds INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(attempt_id, question_id)
);

-- 7. QUESTION EXPLANATION USAGE (Enforcing Limit Server-Side)
CREATE TABLE public.question_explanation_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES public.attempts(id) ON DELETE CASCADE,
    usage_count INT DEFAULT 0,
    max_allowed INT DEFAULT 3,
    last_requested_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, question_id, attempt_id)
);

-- 8. RESET EXPLANATION USAGE
CREATE TABLE public.reset_explanation_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES public.attempts(id) ON DELETE CASCADE,
    reset_usage_count INT DEFAULT 0,
    max_allowed INT DEFAULT 2,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, attempt_id)
);

-- 9. ACCESSIBILITY BARRIER EVENTS (Analytics & Replay)
CREATE TABLE public.barrier_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
    attempt_id UUID REFERENCES public.attempts(id) ON DELETE SET NULL,
    question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL, -- repeated_read, nav_delay, voice_error, skip_spike
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AI PERFORMANCE ANALYSIS
CREATE TABLE public.ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID REFERENCES public.attempts(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    weak_topics JSONB NOT NULL,
    learning_barriers JSONB NOT NULL,
    recommended_practice JSONB NOT NULL,
    overall_summary TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. DOCUMENTS & OCR RESULTS
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id),
    raw_ocr_text TEXT,
    structured_questions JSONB,
    processed_status VARCHAR(32) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. SCHEDULES & NOTIFICATIONS
CREATE TABLE public.exam_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    notification_sent BOOLEAN DEFAULT false,
    scheduled_for TIMESTAMPTZ NOT NULL
);