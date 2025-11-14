import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { templateType, messageTemplate, practiceId } = await req.json();

    if (!templateType || !messageTemplate || !practiceId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is practice owner
    if (user.id !== practiceId) {
      return new Response(JSON.stringify({ error: 'Only practice owners can update SMS templates' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate template has required tokens based on type
    const requiredTokens: Record<string, string[]> = {
      session_ready: ['{{provider_name}}', '{{portal_link}}'],
      session_reminder: ['{{provider_name}}'],
      session_cancelled: ['{{provider_name}}']
    };

    const required = requiredTokens[templateType] || [];
    const missing = required.filter(token => !messageTemplate.includes(token));
    
    if (missing.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Template missing required tokens',
        missingTokens: missing 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Upsert template
    const { data, error } = await supabase
      .from('practice_sms_templates')
      .upsert({
        practice_id: practiceId,
        template_type: templateType,
        message_template: messageTemplate,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'practice_id,template_type'
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ SMS template updated:', { practiceId, templateType });

    return new Response(JSON.stringify({
      success: true,
      template: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating SMS template:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});