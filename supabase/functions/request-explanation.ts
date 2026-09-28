import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { candidateId, questionId, attemptId, mode } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // In Exam Mode, verify if AI explanations are enabled
    if (mode === "EXAM") {
      const { data: attempt } = await supabase.from("attempts").select("exams(allow_ai_explanations_in_exam)").eq("id", attemptId).single();
      if (!attempt?.exams?.allow_ai_explanations_in_exam) {
        return new Response(JSON.stringify({ allowed: false, reason: "Explanations are disabled for this formal examination." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Check usage limits
    const { data: usage } = await supabase
      .from("question_explanation_usage")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("question_id", questionId)
      .eq("attempt_id", attemptId)
      .maybeSingle();

    const currentCount = usage ? usage.usage_count : 0;
    const maxAllowed = usage ? usage.max_allowed : 3;

    if (currentCount >= maxAllowed) {
      return new Response(JSON.stringify({ 
        allowed: false, 
        remaining: 0,
        message: "You have reached the maximum allowed explanation limit (3/3) for this question." 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upsert explanation usage
    const newCount = currentCount + 1;
    await supabase.from("question_explanation_usage").upsert({
      candidate_id: candidateId,
      question_id: questionId,
      attempt_id: attemptId,
      usage_count: newCount,
      max_allowed: maxAllowed,
      last_requested_at: new Date().toISOString()
    });

    // Fetch Question details
    const { data: q } = await supabase.from("questions").select("*").eq("id", questionId).single();

    // Call Server-Side AI Service
    const aiPrompt = `Explain this educational question simply for a visually impaired student:
Question: ${q.question_text}
Options: ${JSON.stringify(q.options)}
Correct Answer Index: ${q.correct_option_index}
Provide output formatted clearly with:
1. Core Concept
2. Step-by-Step Explanation
3. Why the Correct Option is right
4. Common Pitfalls to Avoid`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "You are an accessible learning assistant." }, { role: "user", content: aiPrompt }]
      })
    });
    const aiData = await openAiRes.json();
    const explanationText = aiData.choices[0]?.message?.content || q.explanation || "No explanation available.";

    return new Response(JSON.stringify({
      allowed: true,
      remaining: maxAllowed - newCount,
      usedCount: newCount,
      maxAllowed,
      explanation: explanationText
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});