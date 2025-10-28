import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { chiefComplaint, symptoms, symptomOnset, symptomSeverity, additionalInfo } = await req.json();

    // Use Lovable AI for symptom analysis
    const aiPrompt = `Analyze these patient symptoms and provide urgency assessment and recommendations:
    
Chief Complaint: ${chiefComplaint}
Symptoms: ${symptoms}
Onset: ${symptomOnset}
Severity: ${symptomSeverity}
Additional Info: ${additionalInfo}

Provide: 1) Urgency level (routine/urgent/emergency), 2) Brief recommendation`;

    const aiResponse = await fetch('https://api.lovable.app/v1/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: aiPrompt }]
      })
    });

    const aiResult = await aiResponse.json();
    const aiRecommendation = aiResult.choices?.[0]?.message?.content || 'Please consult with your provider';
    
    const urgencyLevel = aiRecommendation.toLowerCase().includes('emergency') ? 'emergency' :
                        aiRecommendation.toLowerCase().includes('urgent') ? 'urgent' : 'routine';

    const { error } = await supabaseClient
      .from('patient_triage_submissions')
      .insert({
        patient_id: user.id,
        chief_complaint: chiefComplaint,
        symptoms_description: symptoms,
        symptom_onset: symptomOnset,
        symptom_severity: symptomSeverity,
        additional_information: additionalInfo,
        urgency_level: urgencyLevel,
        ai_recommendation: aiRecommendation,
        status: 'pending_review'
      });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, urgencyLevel, aiRecommendation }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
