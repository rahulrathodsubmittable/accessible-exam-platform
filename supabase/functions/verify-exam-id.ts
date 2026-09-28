import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { examId } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: candidate, error: candErr } = await supabase
      .from("candidates")
      .select("*, exams(*)")
      .eq("exam_id", examId.trim().toUpperCase())
      .single();

    if (candErr || !candidate) {
      return new Response(JSON.stringify({ status: "INVALID", message: "Invalid Exam ID. Please check and try again." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (!candidate.is_active) {
      return new Response(JSON.stringify({ status: "EXPIRED", message: "This Candidate ID has been deactivated." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const exam = candidate.exams;
    if (!exam) {
      return new Response(JSON.stringify({ status: "UNASSIGNED", message: "No examination assigned to this Candidate ID." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const now = new Date();
    const start = new Date(exam.scheduled_start);
    const end = new Date(exam.scheduled_end);

    if (now < start) {
      return new Response(JSON.stringify({ 
        status: "NOT_STARTED", 
        message: `Your examination has not started yet. Scheduled Start: ${start.toLocaleString()}`,
        scheduledStart: exam.scheduled_start 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (now > end) {
      return new Response(JSON.stringify({ status: "EXPIRED", message: "This examination period has expired." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check existing submitted attempt
    const { data: attempt } = await supabase
      .from("attempts")
      .select("*")
      .eq("candidate_id", candidate.id)
      .eq("exam_id", exam.id)
      .eq("status", "submitted")
      .maybeSingle();

    if (attempt) {
      return new Response(JSON.stringify({ status: "ALREADY_USED", message: "This Exam ID has already been used and submitted." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      status: "VALID",
      candidate: { id: candidate.id, name: candidate.full_name, examId: candidate.exam_id },
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        durationMinutes: exam.duration_minutes,
        maxExplanations: exam.max_question_explanations,
        allowAiInExam: exam.allow_ai_explanations_in_exam
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});