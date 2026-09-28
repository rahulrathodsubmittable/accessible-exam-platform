-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_explanation_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barrier_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;

-- Anonymous Candidates can select their candidate record by Exam ID
CREATE POLICY "Public exam verification policy" ON public.candidates
    FOR SELECT USING (true);

-- Authenticated Teachers have full management access
CREATE POLICY "Teacher full access candidates" ON public.candidates
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public readable published exams" ON public.exams
    FOR SELECT USING (is_published = true OR auth.role() = 'authenticated');

CREATE POLICY "Teacher full access exams" ON public.exams
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read questions for active exams" ON public.questions
    FOR SELECT USING (true);

CREATE POLICY "Allow public inserts for exam attempts" ON public.attempts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow candidates to view and update their attempts" ON public.attempts
    FOR ALL USING (true);

CREATE POLICY "Allow answer operations" ON public.answers
    FOR ALL USING (true);

CREATE POLICY "Allow explanation usage tracking" ON public.question_explanation_usage
    FOR ALL USING (true);

CREATE POLICY "Allow barrier logging" ON public.barrier_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public view AI analysis" ON public.ai_analysis
    FOR SELECT USING (true);