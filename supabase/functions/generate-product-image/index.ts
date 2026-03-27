import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate Product Image Edge Function
 * Uses Gemini 3 Pro Image Preview to generate pharmaceutical product images
 * with medication names displayed on the label
 */

interface GenerateImageRequest {
  productName: string;
  dosageForm: string;
  category?: string;
}

// Category-specific prompts for different medication types
function getPromptForCategory(productName: string, dosageForm: string, category?: string): string {
  const baseStyle = "Ultra high resolution. Professional pharmaceutical product photography. Clean white/gray gradient background. Premium medical aesthetic. The medication name must be clearly visible on the label.";
  
  const categoryPrompts: Record<string, string> = {
    glp1: `Professional pharmaceutical injection vial for "${productName}". Clear glass vial with white medical label showing the medication name "${productName}" prominently. Clinical setting with sterile appearance. ${baseStyle}`,
    
    hormone: `Pharmaceutical cream tube or capsule bottle for "${productName}". Clean white medical packaging with clear label displaying "${productName}". Professional hormone therapy product styling. ${baseStyle}`,
    
    thyroid: `Professional capsule bottle for "${productName}" thyroid medication. White pharmaceutical bottle with medical label showing "${productName}". Clean clinical appearance. ${baseStyle}`,
    
    sexual_health: `Discreet pharmaceutical packaging for "${productName}". Professional troche or capsule bottle with elegant medical branding. Label clearly shows "${productName}". ${baseStyle}`,
    
    peptide: `Professional injection vial for "${productName}" peptide therapy. Clear sterile vial with medical label displaying "${productName}". Clinical laboratory aesthetic. ${baseStyle}`,
    
    hair: `Pharmaceutical bottle for "${productName}" topical solution. Professional medical packaging with dropper applicator. Label shows "${productName}" clearly. ${baseStyle}`,
    
    antiaging: `Premium pharmaceutical jar or bottle for "${productName}" anti-aging compound. Luxurious medical aesthetic with clear label showing "${productName}". ${baseStyle}`,
    
    vitamin: `Professional supplement bottle for "${productName}". Clean pharmaceutical packaging with medical label displaying "${productName}". ${baseStyle}`,
  };

  // Determine category from product name if not provided
  const lowerName = productName.toLowerCase();
  let detectedCategory = category?.toLowerCase() || 'default';
  
  if (!category) {
    if (lowerName.includes('semaglutide') || lowerName.includes('tirzepatide') || lowerName.includes('glp')) {
      detectedCategory = 'glp1';
    } else if (lowerName.includes('testosterone') || lowerName.includes('estradiol') || lowerName.includes('progesterone') || lowerName.includes('bi-est') || lowerName.includes('dhea')) {
      detectedCategory = 'hormone';
    } else if (lowerName.includes('liothyronine') || lowerName.includes('levothyroxine') || lowerName.includes('thyroid')) {
      detectedCategory = 'thyroid';
    } else if (lowerName.includes('tadalafil') || lowerName.includes('sildenafil') || lowerName.includes('pt-141') || lowerName.includes('oxytocin')) {
      detectedCategory = 'sexual_health';
    } else if (lowerName.includes('sermorelin') || lowerName.includes('bpc') || lowerName.includes('ipamorelin') || lowerName.includes('glutathione') || lowerName.includes('peptide')) {
      detectedCategory = 'peptide';
    } else if (lowerName.includes('minoxidil') || lowerName.includes('finasteride') || lowerName.includes('hair')) {
      detectedCategory = 'hair';
    } else if (lowerName.includes('nad') || lowerName.includes('methylene') || lowerName.includes('anti-aging')) {
      detectedCategory = 'antiaging';
    } else if (lowerName.includes('vitamin') || lowerName.includes('b12') || lowerName.includes('methylcobalamin')) {
      detectedCategory = 'vitamin';
    }
  }

  // Get dosage form specific additions
  let dosageFormText = '';
  const lowerDosage = dosageForm.toLowerCase();
  if (lowerDosage.includes('injection') || lowerDosage.includes('vial')) {
    dosageFormText = 'Clear glass injection vial with rubber stopper.';
  } else if (lowerDosage.includes('cream') || lowerDosage.includes('topical')) {
    dosageFormText = 'Professional cream tube or jar with pump dispenser.';
  } else if (lowerDosage.includes('capsule')) {
    dosageFormText = 'White pharmaceutical capsule bottle with child-resistant cap.';
  } else if (lowerDosage.includes('troche') || lowerDosage.includes('sublingual')) {
    dosageFormText = 'Pharmaceutical troche container or blister pack.';
  } else if (lowerDosage.includes('rdt') || lowerDosage.includes('tablet')) {
    dosageFormText = 'Rapid dissolve tablet container with medical labeling.';
  }

  const prompt = categoryPrompts[detectedCategory] || 
    `Professional pharmaceutical product for "${productName}". ${dosageFormText} Clean medical packaging with visible medication name "${productName}" on the label. ${baseStyle}`;

  return prompt;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, dosageForm, category } = await req.json() as GenerateImageRequest;

    if (!productName) {
      return new Response(
        JSON.stringify({ error: 'productName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate the prompt
    const prompt = getPromptForCategory(productName, dosageForm || 'injection', category);
    console.log(`Generating image for: ${productName}`);
    console.log(`Prompt: ${prompt}`);

    // Call Lovable AI Gateway with Gemini 3 Pro Image Preview
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"]
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`AI Gateway error: ${aiResponse.status} - ${errorText}`);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI image service payment required. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI Response received');

    // Extract the image from the response
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageData) {
      console.error('No image in AI response:', JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ error: 'No image generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for storage upload
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Decode base64 image
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Create a unique filename
    const sanitizedName = productName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    const timestamp = Date.now();
    const filename = `vios/${sanitizedName}-${timestamp}.png`;

    // Upload to product-images bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filename, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload image', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filename);

    console.log(`Image uploaded successfully: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        imageUrl: urlData.publicUrl,
        filename: filename
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-product-image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
