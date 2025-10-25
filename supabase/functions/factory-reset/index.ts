import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DryRunResponse {
  mode: 'dryRun';
  admin_verified: boolean;
  admin_email: string;
  admin_user_id: string;
  current_counts: Record<string, number>;
  preserved_tables: Record<string, number>;
  total_records_to_delete: number;
  estimated_time_seconds: number;
}

interface ExecuteResponse {
  success: boolean;
  mode: 'execute';
  deleted_counts: Record<string, number>;
  final_counts: Record<string, number>;
  total_deleted: number;
  execution_time_seconds: number;
  admin_preserved: {
    user_id: string;
    email: string;
    role: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleCheck) {
      return new Response(
        JSON.stringify({ error: 'Access denied: admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserId = user.id;

    // Parse request
    const { mode, confirm } = await req.json();

    if (!mode || !['dryRun', 'execute'].includes(mode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mode. Must be "dryRun" or "execute"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'execute' && confirm !== 'ERASE ALL') {
      return new Response(
        JSON.stringify({ error: 'Confirmation required. Must send confirm: "ERASE ALL"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper function to get count
    const getCount = async (table: string, whereClause?: string): Promise<number> => {
      try {
        let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
        
        if (whereClause === 'non_admin') {
          query = query.neq('user_id', adminUserId);
        } else if (whereClause === 'non_admin_target_or_impersonator') {
          query = query.or(`target_user_id.neq.${adminUserId},impersonator_id.neq.${adminUserId}`);
        }
        
        const { count } = await query;
        return count || 0;
      } catch (error) {
        console.error(`Error counting ${table}:`, error);
        return 0;
      }
    };

    // DRY RUN MODE - Role-based authorization
    if (mode === 'dryRun') {
      console.log('Factory reset dry run initiated by', user.email);

      const current_counts: Record<string, number> = {
        // Transaction/Order Data
        order_profits: await getCount('order_profits'),
        commissions: await getCount('commissions'),
        order_refunds: await getCount('order_refunds'),
        order_status_history: await getCount('order_status_history'),
        shipping_audit_logs: await getCount('shipping_audit_logs'),
        amazon_tracking_api_calls: await getCount('amazon_tracking_api_calls'),
        
        // Orders
        order_lines: await getCount('order_lines'),
        orders: await getCount('orders'),
        
        // Cart
        cart_access_log: await getCount('cart_access_log'),
        cart_lines: await getCount('cart_lines'),
        cart: await getCount('cart'),
        
        // Discounts
        discount_code_usage: await getCount('discount_code_usage'),
        discount_codes: await getCount('discount_codes'),
        
        // Communication
        messages: await getCount('messages'),
        thread_participants: await getCount('thread_participants'),
        message_threads: await getCount('message_threads'),
        notifications: await getCount('notifications', 'non_admin'),
        
        // Files/Docs
        file_upload_logs: await getCount('file_upload_logs', 'non_admin'),
        documents: await getCount('documents', 'non_admin'),
        
        // Products & Pharmacies
        product_rep_assignments: await getCount('product_rep_assignments'),
        rep_product_price_overrides: await getCount('rep_product_price_overrides'),
        rep_product_visibility: await getCount('rep_product_visibility'),
        product_pricing_tiers: await getCount('product_pricing_tiers'),
        product_pharmacies: await getCount('product_pharmacies'),
        products: await getCount('products'),
        pharmacy_shipping_rates: await getCount('pharmacy_shipping_rates'),
        pharmacy_rep_assignments: await getCount('pharmacy_rep_assignments'),
        pharmacies: await getCount('pharmacies'),
        
        // Patients
        prescription_refills: await getCount('prescription_refills'),
        patients: await getCount('patients'),
        
        // Reps & Relationships
        rep_practice_links: await getCount('rep_practice_links'),
        rep_payments: await getCount('rep_payments'),
        rep_payment_batches: await getCount('rep_payment_batches'),
        pending_reps: await getCount('pending_reps'),
        pending_practices: await getCount('pending_practices'),
        reps: await getCount('reps'),
        
        // Providers
        providers: await getCount('providers'),
        
        // Payment Methods
        practice_payment_methods: await getCount('practice_payment_methods'),
        
        // Security/Logs
        impersonation_logs: await getCount('impersonation_logs', 'non_admin_target_or_impersonator'),
        alerts: await getCount('alerts'),
        failed_login_attempts: await getCount('failed_login_attempts'),
        account_lockouts: await getCount('account_lockouts', 'non_admin'),
        audit_logs: await getCount('audit_logs', 'non_admin'),
        audit_logs_archive: await getCount('audit_logs_archive', 'non_admin'),
        active_sessions: await getCount('active_sessions', 'non_admin'),
        security_events: await getCount('security_events', 'non_admin'),
        two_fa_reset_logs: await getCount('two_fa_reset_logs'),
        user_2fa_settings: await getCount('user_2fa_settings', 'non_admin'),
        sync_logs: await getCount('sync_logs'),
        user_sessions: await getCount('user_sessions', 'non_admin'),
        
        // User Data
        user_password_status: await getCount('user_password_status', 'non_admin'),
        user_terms_acceptances: await getCount('user_terms_acceptances', 'non_admin'),
        notification_preferences: await getCount('notification_preferences', 'non_admin'),
        user_roles: await getCount('user_roles', 'non_admin'),
        profiles: await getCount('profiles') - 1, // Exclude admin
      };

      // Get auth users count
      const { data: allProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .neq('id', adminUserId);
      current_counts.auth_users = allProfiles?.length || 0;

      const preserved_tables: Record<string, number> = {
        terms_and_conditions: await getCount('terms_and_conditions'),
        order_status_configs: await getCount('order_status_configs'),
        product_types: await getCount('product_types'),
        system_settings: await getCount('system_settings'),
        encryption_keys: await getCount('encryption_keys'),
        alert_rules: await getCount('alert_rules'),
        admin_ip_banlist: await getCount('admin_ip_banlist'),
        impersonation_permissions: await getCount('impersonation_permissions'),
      };

      const total_records_to_delete = Object.values(current_counts).reduce((sum, count) => sum + count, 0);

      const response: DryRunResponse = {
        mode: 'dryRun',
        admin_verified: true,
        admin_email: user.email ?? 'unknown',
        admin_user_id: adminUserId,
        current_counts,
        preserved_tables,
        total_records_to_delete,
        estimated_time_seconds: 30,
      };

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // EXECUTE MODE
    console.log('Factory reset EXECUTE initiated by', user.email);
    const startTime = Date.now();
    const deleted_counts: Record<string, number> = {};

    // Helper function to delete records
    const deleteRecords = async (table: string, whereClause?: string): Promise<number> => {
      try {
        // First, count the records
        let countQuery = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
        
        if (whereClause === 'non_admin') {
          countQuery = countQuery.neq('user_id', adminUserId);
        } else if (whereClause === 'non_admin_target_or_impersonator') {
          countQuery = countQuery.or(`target_user_id.neq.${adminUserId},impersonator_id.neq.${adminUserId}`);
        }
        
        const { count: recordCount } = await countQuery;
        
        // Then delete
        let deleteQuery = supabaseAdmin.from(table).delete();
        
        if (whereClause === 'non_admin') {
          deleteQuery = deleteQuery.neq('user_id', adminUserId);
        } else if (whereClause === 'non_admin_target_or_impersonator') {
          deleteQuery = deleteQuery.or(`target_user_id.neq.${adminUserId},impersonator_id.neq.${adminUserId}`);
        }
        
        const { error } = await deleteQuery;
        
        if (error) {
          console.error(`Error deleting from ${table}:`, error);
          return 0;
        }
        
        return recordCount || 0;
      } catch (error) {
        console.error(`Exception deleting from ${table}:`, error);
        return 0;
      }
    };

    // Phase 1: Transaction/Order Data
    deleted_counts.order_profits = await deleteRecords('order_profits', 'all');
    deleted_counts.commissions = await deleteRecords('commissions', 'all');
    deleted_counts.order_refunds = await deleteRecords('order_refunds', 'all');
    deleted_counts.order_status_history = await deleteRecords('order_status_history', 'all');
    deleted_counts.shipping_audit_logs = await deleteRecords('shipping_audit_logs', 'all');
    deleted_counts.amazon_tracking_api_calls = await deleteRecords('amazon_tracking_api_calls', 'all');

    // Phase 2: Orders
    deleted_counts.order_lines = await deleteRecords('order_lines', 'all');
    deleted_counts.orders = await deleteRecords('orders', 'all');

    // Phase 3: Cart
    deleted_counts.cart_access_log = await deleteRecords('cart_access_log', 'all');
    deleted_counts.cart_lines = await deleteRecords('cart_lines', 'all');
    deleted_counts.cart = await deleteRecords('cart', 'all');

    // Phase 4: Discounts
    deleted_counts.discount_code_usage = await deleteRecords('discount_code_usage', 'all');
    deleted_counts.discount_codes = await deleteRecords('discount_codes', 'all');

    // Phase 5: Communication
    deleted_counts.messages = await deleteRecords('messages', 'all');
    deleted_counts.thread_participants = await deleteRecords('thread_participants', 'all');
    deleted_counts.message_threads = await deleteRecords('message_threads', 'all');
    deleted_counts.notifications = await deleteRecords('notifications', 'non_admin');

    // Phase 6: Files/Docs
    deleted_counts.file_upload_logs = await deleteRecords('file_upload_logs', 'non_admin');
    deleted_counts.documents = await deleteRecords('documents', 'non_admin');

    // Phase 7: Products & Pharmacies
    deleted_counts.product_rep_assignments = await deleteRecords('product_rep_assignments', 'all');
    deleted_counts.rep_product_price_overrides = await deleteRecords('rep_product_price_overrides', 'all');
    deleted_counts.rep_product_visibility = await deleteRecords('rep_product_visibility', 'all');
    deleted_counts.product_pricing_tiers = await deleteRecords('product_pricing_tiers', 'all');
    deleted_counts.product_pharmacies = await deleteRecords('product_pharmacies', 'all');
    deleted_counts.products = await deleteRecords('products', 'all');
    deleted_counts.pharmacy_shipping_rates = await deleteRecords('pharmacy_shipping_rates', 'all');
    deleted_counts.pharmacy_rep_assignments = await deleteRecords('pharmacy_rep_assignments', 'all');
    deleted_counts.pharmacies = await deleteRecords('pharmacies', 'all');

    // Phase 8: Patient Data
    deleted_counts.prescription_refills = await deleteRecords('prescription_refills', 'all');
    deleted_counts.patients = await deleteRecords('patients', 'all');

    // Phase 9: Reps & Relationships
    deleted_counts.rep_practice_links = await deleteRecords('rep_practice_links', 'all');
    deleted_counts.rep_payments = await deleteRecords('rep_payments', 'all');
    deleted_counts.rep_payment_batches = await deleteRecords('rep_payment_batches', 'all');
    deleted_counts.pending_reps = await deleteRecords('pending_reps', 'all');
    deleted_counts.pending_practices = await deleteRecords('pending_practices', 'all');
    deleted_counts.reps = await deleteRecords('reps', 'all');

    // Phase 10: Providers
    deleted_counts.providers = await deleteRecords('providers', 'all');

    // Phase 11: Payment Methods
    deleted_counts.practice_payment_methods = await deleteRecords('practice_payment_methods', 'all');

    // Phase 12: Security/Logs
    deleted_counts.impersonation_logs = await deleteRecords('impersonation_logs', 'non_admin_target_or_impersonator');
    deleted_counts.alerts = await deleteRecords('alerts', 'all');
    deleted_counts.failed_login_attempts = await deleteRecords('failed_login_attempts', 'all');
    deleted_counts.account_lockouts = await deleteRecords('account_lockouts', 'non_admin');
    deleted_counts.audit_logs = await deleteRecords('audit_logs', 'non_admin');
    deleted_counts.audit_logs_archive = await deleteRecords('audit_logs_archive', 'non_admin');
    deleted_counts.active_sessions = await deleteRecords('active_sessions', 'non_admin');
    deleted_counts.security_events = await deleteRecords('security_events', 'non_admin');
    deleted_counts.two_fa_reset_logs = await deleteRecords('two_fa_reset_logs', 'all');
    deleted_counts.user_2fa_settings = await deleteRecords('user_2fa_settings', 'non_admin');
    deleted_counts.sync_logs = await deleteRecords('sync_logs', 'all');
    deleted_counts.user_sessions = await deleteRecords('user_sessions', 'non_admin');

    // Phase 13: User Data
    deleted_counts.user_password_status = await deleteRecords('user_password_status', 'non_admin');
    deleted_counts.user_terms_acceptances = await deleteRecords('user_terms_acceptances', 'non_admin');
    deleted_counts.notification_preferences = await deleteRecords('notification_preferences', 'non_admin');
    deleted_counts.user_roles = await deleteRecords('user_roles', 'non_admin');
    deleted_counts.profiles = await deleteRecords('profiles', 'non_admin');

    // Delete auth users
    const { data: nonAdminProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .neq('id', adminUserId);

    let deletedAuthUsers = 0;
    if (nonAdminProfiles && nonAdminProfiles.length > 0) {
      for (const profile of nonAdminProfiles) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(profile.id);
          deletedAuthUsers++;
        } catch (error) {
          console.error(`Error deleting auth user ${profile.id}:`, error);
        }
      }
    }
    deleted_counts.auth_users = deletedAuthUsers;

    // Create audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: adminUserId,
        user_email: user.email,
        user_role: 'admin',
        action_type: 'factory_reset',
        entity_type: 'system',
        entity_id: null,
        details: {
          mode: 'execute',
          total_deleted: Object.values(deleted_counts).reduce((sum, count) => sum + count, 0),
          tables_affected: Object.keys(deleted_counts),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.error('Error creating audit log:', logError);
    }

    // Get final counts
    const final_counts: Record<string, number> = {};
    final_counts.profiles = await getCount('profiles');
    final_counts.user_roles = await getCount('user_roles');
    final_counts.orders = await getCount('orders');
    final_counts.order_lines = await getCount('order_lines');
    final_counts.products = await getCount('products');
    final_counts.patients = await getCount('patients');
    final_counts.pharmacies = await getCount('pharmacies');

    const endTime = Date.now();
    const total_deleted = Object.values(deleted_counts).reduce((sum, count) => sum + count, 0);

    const response: ExecuteResponse = {
      success: true,
      mode: 'execute',
      deleted_counts,
      final_counts,
      total_deleted,
      execution_time_seconds: Number(((endTime - startTime) / 1000).toFixed(1)),
      admin_preserved: {
        user_id: adminUserId,
        email: user.email ?? 'unknown',
        role: 'admin',
      },
    };

    console.log(`Factory reset complete: ${total_deleted} records deleted in ${response.execution_time_seconds}s`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in factory-reset function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
