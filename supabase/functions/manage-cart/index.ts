import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[manage-cart] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[manage-cart] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    console.log('[manage-cart] Action:', action);

    switch (action) {
      case 'add': {
        const { 
          cartOwnerId, productId, quantity = 1, patientId, patientName,
          destinationState, providerId, patientEmail, patientPhone,
          patientAddress, patientAddressStreet, patientAddressCity,
          patientAddressState, patientAddressZip, patientAddressValidated,
          patientAddressValidationSource, priceSnapshot, assignedPharmacyId,
          prescriptionUrl, customSig, customDosage, orderNotes,
          prescriptionMethod, genderAtBirth
        } = body;

        if (!cartOwnerId || !productId || !patientName || !destinationState) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[manage-cart] Adding item:', { cartOwnerId, productId, quantity, patientName });

        // Validate product exists and is active
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("id, active")
          .eq("id", productId)
          .single();

        if (productError || !product || !product.active) {
          return new Response(
            JSON.stringify({ error: 'Product not found or inactive' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find or create cart
        let { data: cart } = await supabase
          .from("cart")
          .select("id")
          .eq("doctor_id", cartOwnerId)
          .maybeSingle();

        if (!cart) {
          const { data: newCart, error: cartError } = await supabase
            .from("cart")
            .insert({ doctor_id: cartOwnerId })
            .select("id")
            .single();

          if (cartError) throw cartError;
          cart = newCart;
        }

        // Insert cart line with 24h expiration
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const insertData: any = {
          cart_id: cart.id,
          product_id: productId,
          quantity,
          patient_id: patientId,
          patient_name: patientName,
          destination_state: destinationState,
          provider_id: providerId,
          expires_at: expiresAt.toISOString()
        };

        if (patientEmail !== undefined) insertData.patient_email = patientEmail;
        if (patientPhone !== undefined) insertData.patient_phone = patientPhone;
        if (patientAddress !== undefined) insertData.patient_address = patientAddress;
        if (patientAddressStreet !== undefined) insertData.patient_address_street = patientAddressStreet;
        if (patientAddressCity !== undefined) insertData.patient_address_city = patientAddressCity;
        if (patientAddressState !== undefined) insertData.patient_address_state = patientAddressState;
        if (patientAddressZip !== undefined) insertData.patient_address_zip = patientAddressZip;
        if (patientAddressValidated !== undefined) insertData.patient_address_validated = patientAddressValidated;
        if (patientAddressValidationSource !== undefined) insertData.patient_address_validation_source = patientAddressValidationSource;
        if (priceSnapshot !== undefined) insertData.price_snapshot = priceSnapshot;
        if (assignedPharmacyId !== undefined) insertData.assigned_pharmacy_id = assignedPharmacyId;
        if (prescriptionUrl !== undefined) insertData.prescription_url = prescriptionUrl;
        if (customSig !== undefined) insertData.custom_sig = customSig;
        if (customDosage !== undefined) insertData.custom_dosage = customDosage;
        if (orderNotes !== undefined) insertData.order_notes = orderNotes;
        if (prescriptionMethod !== undefined) insertData.prescription_method = prescriptionMethod;
        if (genderAtBirth !== undefined) insertData.gender_at_birth = genderAtBirth;

        const { data: newLine, error: insertError } = await supabase
          .from("cart_lines")
          .insert(insertData)
          .select("id")
          .single();

        if (insertError) throw insertError;

        console.log('[manage-cart] Success - added line:', newLine.id);

        return new Response(
          JSON.stringify({ success: true, lineId: newLine.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        const { lineId, quantity } = body;

        console.log('[manage-cart] Updating line:', lineId, 'to quantity:', quantity);

        if (!lineId || quantity === undefined) {
          return new Response(
            JSON.stringify({ error: 'lineId and quantity required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from("cart_lines")
          .update({ quantity })
          .eq("id", lineId);

        if (updateError) throw updateError;

        console.log('[manage-cart] Success - updated quantity');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'remove': {
        const { lineId } = body;

        console.log('[manage-cart] Removing line:', lineId);

        if (!lineId) {
          return new Response(
            JSON.stringify({ error: 'lineId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: deleteError } = await supabase
          .from("cart_lines")
          .delete()
          .eq("id", lineId);

        if (deleteError) throw deleteError;

        console.log('[manage-cart] Success - removed line');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'clear': {
        const { cartOwnerId } = body;

        console.log('[manage-cart] Clearing cart for owner:', cartOwnerId);

        if (!cartOwnerId) {
          return new Response(
            JSON.stringify({ error: 'cartOwnerId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: cart } = await supabase
          .from('cart')
          .select('id')
          .eq('doctor_id', cartOwnerId)
          .maybeSingle();

        if (cart) {
          const { error: deleteError } = await supabase
            .from('cart_lines')
            .delete()
            .eq('cart_id', cart.id);

          if (deleteError) throw deleteError;

          console.log('[manage-cart] Success - cleared cart', cart.id);
        } else {
          console.log('[manage-cart] No cart found for owner', cartOwnerId);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-address': {
        const { lineIds, address, assignedPharmacyId } = body;

        console.log('[manage-cart] Updating address for lines:', lineIds);

        if (!lineIds || !Array.isArray(lineIds) || lineIds.length === 0) {
          return new Response(
            JSON.stringify({ error: 'lineIds array required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!address) {
          return new Response(
            JSON.stringify({ error: 'address object required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: any = {};
        if (address.street !== undefined) updateData.patient_address_street = address.street;
        if (address.city !== undefined) updateData.patient_address_city = address.city;
        if (address.state !== undefined) {
          updateData.patient_address_state = address.state;
          updateData.destination_state = address.state;
        }
        if (address.zip !== undefined) updateData.patient_address_zip = address.zip;
        if (address.formatted !== undefined) {
          updateData.patient_address_formatted = address.formatted;
          updateData.patient_address = address.formatted;
        }
        if (address.validated !== undefined) updateData.patient_address_validated = address.validated;
        if (address.validationSource !== undefined) updateData.patient_address_validation_source = address.validationSource;
        if (assignedPharmacyId !== undefined) updateData.assigned_pharmacy_id = assignedPharmacyId;

        const { error: updateError } = await supabase
          .from("cart_lines")
          .update(updateData)
          .in("id", lineIds);

        if (updateError) throw updateError;

        console.log('[manage-cart] Success - updated address');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-prescription': {
        const { lineId, prescriptionUrl, prescriptionMethod, customSig, customDosage } = body;

        console.log('[manage-cart] Updating prescription for line:', lineId);

        if (!lineId) {
          return new Response(
            JSON.stringify({ error: 'lineId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: any = {};
        if (prescriptionUrl !== undefined) updateData.prescription_url = prescriptionUrl;
        if (prescriptionMethod !== undefined) updateData.prescription_method = prescriptionMethod;
        if (customSig !== undefined) updateData.custom_sig = customSig;
        if (customDosage !== undefined) updateData.custom_dosage = customDosage;

        const { error: updateError } = await supabase
          .from("cart_lines")
          .update(updateData)
          .eq("id", lineId);

        if (updateError) throw updateError;

        console.log('[manage-cart] Success - updated prescription');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('[manage-cart] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
