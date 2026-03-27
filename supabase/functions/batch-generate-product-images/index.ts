import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Batch Generate Product Images Edge Function
 * Generates images for products that are missing them
 */

interface BatchRequest {
  batchSize?: number;
  startFrom?: number;
}

interface ProductMissingImage {
  id: string;
  name: string;
  dosage_form: string | null;
}

// Category-specific prompts for different medication types
function getPromptForCategory(productName: string, dosageForm: string): string {
  const baseStyle = "Ultra high resolution. Professional pharmaceutical product photography. Clean white/gray gradient background. Premium medical aesthetic. The medication name must be clearly visible on the label.";
  
  const lowerName = productName.toLowerCase();
  let detectedCategory = 'default';
  
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

  // Get dosage form specific additions
  let dosageFormText = '';
  const lowerDosage = (dosageForm || '').toLowerCase();
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

  return categoryPrompts[detectedCategory] || 
    `Professional pharmaceutical product for "${productName}". ${dosageFormText} Clean medical packaging with visible medication name "${productName}" on the label. ${baseStyle}`;
}

async function generateImageForProduct(
  product: ProductMissingImage, 
  supabase: any,
  LOVABLE_API_KEY: string
): Promise<{ success: boolean; productId: string; error?: string }> {
  try {
    const prompt = getPromptForCategory(product.name, product.dosage_form || 'injection');
    console.log(`Generating image for: ${product.name}`);

    // Call AI Gateway with Gemini 3 Pro Image Preview
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
      console.error(`AI Gateway error for ${product.name}: ${aiResponse.status} - ${errorText}`);
      
      if (aiResponse.status === 429) {
        return { success: false, productId: product.id, error: 'Rate limit exceeded' };
      }
      return { success: false, productId: product.id, error: `AI error: ${aiResponse.status}` };
    }

    const aiData = await aiResponse.json();
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error(`No image in AI response for ${product.name}`);
      return { success: false, productId: product.id, error: 'No image generated' };
    }

    // Decode base64 image
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Create a unique filename
    const sanitizedName = product.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    const timestamp = Date.now();
    const filename = `vios/${sanitizedName}-${timestamp}.png`;

    // Upload to product-images bucket
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filename, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error(`Storage upload error for ${product.name}:`, uploadError);
      return { success: false, productId: product.id, error: `Upload failed: ${uploadError.message}` };
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filename);

    // Update the product with the new image URL
    const { error: updateError } = await supabase
      .from('products')
      .update({ image_url: urlData.publicUrl })
      .eq('id', product.id);

    if (updateError) {
      console.error(`Database update error for ${product.name}:`, updateError);
      return { success: false, productId: product.id, error: `DB update failed: ${updateError.message}` };
    }

    console.log(`✓ Image generated and saved for: ${product.name}`);
    return { success: true, productId: product.id };

  } catch (error) {
    console.error(`Error generating image for ${product.name}:`, error);
    return { success: false, productId: product.id, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 5, startFrom = 0 } = await req.json() as BatchRequest;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get products missing images
    const { data: productsMissingImages, error: fetchError } = await supabase
      .from('products')
      .select('id, name, dosage_form')
      .or('image_url.is.null,image_url.eq.')
      .order('name')
      .range(startFrom, startFrom + batchSize - 1);

    if (fetchError) {
      console.error('Error fetching products:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get total count of products missing images
    const { count: totalMissing } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .or('image_url.is.null,image_url.eq.');

    if (!productsMissingImages || productsMissingImages.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No products missing images',
          imagesGenerated: 0,
          totalMissing: 0,
          hasMore: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${productsMissingImages.length} products (batch from ${startFrom})`);

    const results: Array<{ success: boolean; productId: string; error?: string }> = [];
    
    // Process sequentially with 2-second delay between each to avoid rate limits
    for (const product of productsMissingImages) {
      const result = await generateImageForProduct(product, supabase, LOVABLE_API_KEY);
      results.push(result);
      
      // Wait 3 seconds between requests to avoid rate limiting
      if (productsMissingImages.indexOf(product) < productsMissingImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    const errors = results.filter(r => !r.success).map(r => `${r.productId}: ${r.error}`);

    const nextStartFrom = startFrom + batchSize;
    const hasMore = (totalMissing || 0) > nextStartFrom;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Generated ${successCount} images, ${failedCount} failed`,
        imagesGenerated: successCount,
        imagesFailed: failedCount,
        totalMissing: totalMissing || 0,
        processedInBatch: productsMissingImages.length,
        nextStartFrom: hasMore ? nextStartFrom : null,
        hasMore,
        errors: errors.slice(0, 5) // Only return first 5 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in batch-generate-product-images:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
