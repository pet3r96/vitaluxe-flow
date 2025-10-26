import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { validateApprovePendingProductRequest } from '../_shared/requestValidators.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token || '');

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify admin role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Admin access required');
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token');
    const csrfValidation = await validateCSRFToken(supabaseAdmin, user.id, csrfToken);
    if (!csrfValidation.valid) {
      throw new Error('Invalid CSRF token');
    }

    const body = await req.json();
    
    // Validate request
    const validation = validateApprovePendingProductRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId, action, adminData, rejectionReason, adminNotes } = body;

    // Fetch the pending request
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('pending_product_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      throw new Error('Product request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Request has already been processed');
    }

    if (action === 'reject') {
      // Reject the request
      const { error: updateError } = await supabaseAdmin
        .from('pending_product_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          rejection_reason: rejectionReason,
          admin_notes: adminNotes
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Send rejection notification
      await supabaseAdmin.functions.invoke('send-notification', {
        body: {
          user_id: request.created_by_user_id,
          notification_type: 'product_request_rejected',
          title: 'Product Request Rejected',
          message: `Your product request for "${request.name}" was rejected. Reason: ${rejectionReason}`,
          severity: 'info',
          action_url: '/products'
        }
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Product request rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'approve') {
      // Handle product type - create new if requested, or use existing
      let productTypeId = adminData.product_type_id;

      if (adminData.create_new_type && request.product_type_name) {
        const { data: newType, error: typeError } = await supabaseAdmin
          .from('product_types')
          .insert([{ name: request.product_type_name }])
          .select()
          .single();

        if (typeError) throw typeError;
        productTypeId = newType.id;
      }

      // Create the product
      const productData = {
        name: adminData.name || request.name,
        dosage: adminData.dosage || request.dosage,
        sig: adminData.sig || request.sig,
        base_price: adminData.base_price,
        topline_price: request.requires_prescription ? null : adminData.topline_price,
        downline_price: request.requires_prescription ? null : adminData.downline_price,
        retail_price: adminData.retail_price,
        product_type_id: productTypeId,
        requires_prescription: adminData.requires_prescription ?? request.requires_prescription,
        image_url: adminData.image_url || request.image_url,
        active: true
      };

      const { data: newProduct, error: productError } = await supabaseAdmin
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (productError) throw productError;

      // Assign to pharmacies
      if (adminData.assigned_pharmacies && adminData.assigned_pharmacies.length > 0) {
        const pharmacyAssignments = adminData.assigned_pharmacies.map((pharmacyId: string) => ({
          product_id: newProduct.id,
          pharmacy_id: pharmacyId
        }));

        const { error: assignError } = await supabaseAdmin
          .from('product_pharmacies')
          .insert(pharmacyAssignments);

        if (assignError) throw assignError;
      }

      // Handle rep assignments if scoped
      if (adminData.scope_type === 'scoped' && adminData.assigned_topline_reps && adminData.assigned_topline_reps.length > 0) {
        const repAssignments = adminData.assigned_topline_reps.map((repId: string) => ({
          product_id: newProduct.id,
          rep_id: repId
        }));

        const { error: repError } = await supabaseAdmin
          .from('product_rep_assignments')
          .insert(repAssignments);

        if (repError) throw repError;
      }

      // Update the request status
      const { error: updateError } = await supabaseAdmin
        .from('pending_product_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          base_price: adminData.base_price,
          topline_price: adminData.topline_price,
          downline_price: adminData.downline_price,
          retail_price: adminData.retail_price,
          assigned_pharmacies: adminData.assigned_pharmacies,
          assigned_topline_reps: adminData.assigned_topline_reps,
          scope_type: adminData.scope_type,
          admin_notes: adminNotes
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Send approval notification
      await supabaseAdmin.functions.invoke('send-notification', {
        body: {
          user_id: request.created_by_user_id,
          notification_type: 'product_request_approved',
          title: 'Product Request Approved',
          message: `Your product request for "${request.name}" has been approved and is now available.`,
          severity: 'info',
          action_url: '/products'
        }
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Product request approved and product created',
          productId: newProduct.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Error in approve-pending-product:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
