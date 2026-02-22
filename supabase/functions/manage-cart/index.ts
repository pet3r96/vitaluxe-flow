import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';
import { validateInput, manageCartSchema } from '../_shared/zodSchemas.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const ipAddress = getClientIP(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      edgeLogger.error('manage-cart missing auth header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAuthClient(authHeader);
    const supabaseAdmin = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      edgeLogger.error('manage-cart auth error', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3: Rate limiting (100 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      user.id,
      'manage-cart',
      { maxRequests: 100, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { userId: user.id, function: 'manage-cart' });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    edgeLogger.info('manage-cart action received', { action });

    switch (action) {
      case 'add': {
        const { 
          cartOwnerId, productId, quantity = 1, patientId, patientName,
          destinationState, providerId, patientEmail, patientPhone,
          patientAddress, patientAddressStreet, patientAddressCity,
          patientAddressState, patientAddressZip, patientAddressValidated,
          patientAddressValidationSource, priceSnapshot, assignedPharmacyId,
          prescriptionUrl, customSig, customDosage, orderNotes,
          prescriptionMethod, genderAtBirth, variantId, daysSupply
        } = body;

        if (!cartOwnerId || !productId || !patientName || !destinationState) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        edgeLogger.info('manage-cart adding item', { productId, quantity, variantId });

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
        
        // Validate variant if provided
        if (variantId) {
          const { data: variant, error: variantError } = await supabase
            .from("product_variants")
            .select("id, product_id, active")
            .eq("id", variantId)
            .single();
          
          if (variantError || !variant || !variant.active || variant.product_id !== productId) {
            return new Response(
              JSON.stringify({ error: 'Invalid or inactive variant' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
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

        // Auto-select default shipping speed (fastest first: overnight → 2day → ground)
        if (assignedPharmacyId) {
          const { data: rates } = await supabase
            .from('pharmacy_shipping_rates')
            .select('shipping_speed')
            .eq('pharmacy_id', assignedPharmacyId)
            .eq('enabled', true);
          
          if (rates && rates.length > 0) {
            const speeds = rates.map(r => r.shipping_speed);
            const defaultSpeed = speeds.includes('overnight') ? 'overnight' :
                                 speeds.includes('2day') ? '2day' : 
                                 speeds[0];
            insertData.shipping_speed = defaultSpeed;
            edgeLogger.info('Auto-selected shipping speed', { defaultSpeed, pharmacyId: assignedPharmacyId });
          }
        }

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
        if (variantId !== undefined) insertData.variant_id = variantId;
        if (daysSupply !== undefined) insertData.days_supply = daysSupply;
        if (body.shipTo !== undefined) insertData.ship_to = body.shipTo;

        const { data: newLine, error: insertError } = await supabase
          .from("cart_lines")
          .insert(insertData)
          .select("id")
          .single();

        if (insertError) throw insertError;

        edgeLogger.info('manage-cart item added successfully', { lineId: newLine.id });

        return new Response(
          JSON.stringify({ success: true, lineId: newLine.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        const { lineId, quantity } = body;

        edgeLogger.info('manage-cart updating line quantity', { lineId, quantity });

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

        edgeLogger.info('manage-cart quantity updated successfully');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'remove': {
        const { lineId } = body;

        edgeLogger.info('manage-cart removing line', { lineId });

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

        edgeLogger.info('manage-cart line removed successfully');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'clear': {
        const { cartOwnerId } = body;

        edgeLogger.info('manage-cart clearing cart');

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

          edgeLogger.info('manage-cart cart cleared successfully', { cartId: cart.id });
        } else {
          edgeLogger.info('manage-cart no cart found to clear');
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-address': {
        const { lineIds, address, assignedPharmacyId } = body;

        edgeLogger.info('manage-cart updating address for lines', { lineCount: lineIds.length });

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

        edgeLogger.info('manage-cart address updated successfully');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-prescription': {
        const { lineId, prescriptionUrl, prescriptionMethod, customSig, customDosage } = body;

        edgeLogger.info('manage-cart updating prescription for line', { lineId });

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

        edgeLogger.info('manage-cart prescription updated successfully');

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
    edgeLogger.error('manage-cart error', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
