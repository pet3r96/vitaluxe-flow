import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
}

interface ChargeRequest {
  order_id?: string; // Optional - may not exist yet if called before order creation
  doctor_id?: string; // Required if order_id not provided (for authorization check)
  payment_method_id: string;
  amount: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ipAddress = getClientIP(req);

  try {
    // PHASE 3: Request size validation
    const sizeValidation = validateRequestSize(req, 'authorizenet-charge-payment', corsHeaders);
    if (sizeValidation) return sizeValidation;

    const { order_id, doctor_id, payment_method_id, amount }: ChargeRequest = await req.json();
    
    const supabase = createAuthClient(req.headers.get('Authorization'));
    const supabaseAdmin = createAdminClient();

    // PHASE 3: Rate limiting (5 charges per hour per user)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      user.id,
      'authorizenet-charge-payment',
      { maxRequests: 5, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { userId: user.id, function: 'authorizenet-charge-payment' });
      return new Response(
        JSON.stringify({ error: 'Too many payment attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token with detailed diagnostics
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    edgeLogger.info('[AUTHNET_CHARGE] CSRF validation starting', { 
      userId: user.id, 
      hasCsrfToken: !!csrfToken,
      csrfTokenLength: csrfToken?.length || 0
    });
    
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    
    if (!valid) {
      edgeLogger.error('[AUTHNET_CHARGE] CSRF validation failed', undefined, { 
        userId: user.id,
        error: csrfError,
        hasCsrfToken: !!csrfToken,
        tokenProvided: csrfToken ? 'yes (redacted)' : 'no'
      });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: csrfError || 'Invalid CSRF token' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    edgeLogger.info('[AUTHNET_CHARGE] CSRF validation passed', { userId: user.id });

    edgeLogger.info("[AUTHNET_CHARGE] Starting payment charge", { 
      order_id: order_id || 'none (pre-order)', 
      doctor_id: doctor_id || 'none',
      amount, 
      payment_method_id,
      timestamp: new Date().toISOString()
    });

  // Get doctor_id for auth (from order or parameter)
  let doctorIdForAuth = doctor_id;

  // ✅ DIAGNOSTIC: Log before doctor_id lookup
  edgeLogger.info('[AUTHNET_CHARGE] Doctor ID resolution starting', {
    provided_doctor_id: doctor_id,
    order_id: order_id,
    will_lookup_from_order: !!order_id && !doctor_id
  });
    if (order_id && !doctorIdForAuth) {
      edgeLogger.info('[AUTHNET_CHARGE] Fetching doctor_id from order', { order_id });
      
      const { data: order, error: orderFetchError } = await supabase.from('orders').select('doctor_id').eq('id', order_id).single();
      
      edgeLogger.info('[AUTHNET_CHARGE] Order lookup result', {
        found: !!order,
        doctor_id: order?.doctor_id,
        error: orderFetchError?.message
      });
      
      if (order) doctorIdForAuth = order.doctor_id;
    }

    // ✅ DIAGNOSTIC: Log resolved doctor_id
    edgeLogger.info('[AUTHNET_CHARGE] Doctor ID resolved', {
      doctorIdForAuth,
      will_proceed_with_payment: !!doctorIdForAuth
    });

    // RETRY LOGIC - Attempt payment up to 2 times
    let paymentAttempt = 0;
    const maxAttempts = 2;
    let finalSuccess = false;
    let finalTransactionId: string | null = null;
    let finalError: any = null;

    // ✅ DIAGNOSTIC: Log before retry loop
    edgeLogger.info('[AUTHNET_CHARGE] Entering retry loop', {
      maxAttempts,
      payment_method_id,
      amount,
      doctorIdForAuth
    });

    while (paymentAttempt < maxAttempts && !finalSuccess) {
      paymentAttempt++;
      
      edgeLogger.info('[AUTHNET_CHARGE] Payment attempt starting', {
        attempt: paymentAttempt,
        maxAttempts,
        order_id,
        payment_method_id,
        amount,
        timestamp: new Date().toISOString()
      });

      try {
        // Handle pre-order mode (order_id may not exist yet)
        let order = null;
        
        if (order_id) {
          // Fetch the order to get the doctor_id (practice owner)
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('id, doctor_id')
            .eq('id', order_id)
            .single();

          if (orderError || !orderData) {
            edgeLogger.error('[AUTHNET_CHARGE] Order not found', orderError, { 
              attempt: paymentAttempt,
              order_id 
            });
            finalError = { 
              success: false,
              error: 'Order not found. Please try again or contact support.' 
            };
            
            if (paymentAttempt < maxAttempts) {
              edgeLogger.info('[AUTHNET_CHARGE] Retrying after order lookup failure', { 
                attempt: paymentAttempt,
                willRetry: true 
              });
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            
            break; // Exit loop, fall through to final response
          }
          
          order = orderData;
        } else {
          // Pre-order mode: use doctor_id parameter
          edgeLogger.info('[AUTHNET_CHARGE] Pre-order mode (no order_id yet)', {
            doctor_id: doctorIdForAuth,
            attempt: paymentAttempt
          });
          
          if (!doctorIdForAuth) {
            edgeLogger.error('[AUTHNET_CHARGE] No order_id or doctor_id provided', undefined, {
              attempt: paymentAttempt
            });
            finalError = { 
              success: false,
              error: 'Invalid request: missing order_id or doctor_id' 
            };
            break;
          }
        }

        if (order) {
          edgeLogger.info("[AUTHNET_CHARGE] Order verified", { 
            order_id, 
            practice_id: order.doctor_id,
            attempt: paymentAttempt
          });
        }
        edgeLogger.info("[AUTHNET_CHARGE] Verifying payment method", { 
          payment_method_id,
          attempt: paymentAttempt
        });

        // Fetch payment method (no practice_id filter initially)
        const { data: paymentMethod, error: pmError } = await supabase
          .from('practice_payment_methods')
          .select('*')
          .eq('id', payment_method_id)
          .single();

        if (pmError || !paymentMethod) {
          edgeLogger.error('[AUTHNET_CHARGE] Payment method not found', pmError, { 
            attempt: paymentAttempt,
            payment_method_id
          });
          finalError = { 
            success: false,
            error: 'Payment method not found. Please select a valid payment method or add a new one.' 
          };
          
          if (paymentAttempt < maxAttempts) {
            edgeLogger.info('[AUTHNET_CHARGE] Retrying after payment method lookup failure', { 
              attempt: paymentAttempt 
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          
          break; // Exit loop
        }

    // Get the current user placing the order
    const currentUserId = user.id;
    edgeLogger.info('Payment method retrieved', { 
      payment_method_id,
      card_last_five: paymentMethod.card_last_five,
      card_type: paymentMethod.card_type,
      status: paymentMethod.status,
      practice_id: paymentMethod.practice_id
    });
    edgeLogger.info('Authorization check starting', { 
      currentUserId, 
      order_doctor_id: order?.doctor_id || doctorIdForAuth, 
      payment_method_practice_id: paymentMethod.practice_id 
    });

    // Verify ownership: payment method must belong to the practice or the user must be authorized
    let isAuthorized = false;

    // Case 1: Payment method belongs to the practice that owns the order
    if (paymentMethod.practice_id === doctorIdForAuth) {
      edgeLogger.info('Payment authorized: practice card');
      isAuthorized = true;
    } else if (currentUserId === doctorIdForAuth) {
      // Case 2: Current user is the practice owner
      edgeLogger.info('Payment authorized: practice owner');
      isAuthorized = true;
    } else {
      edgeLogger.info('Checking staff/provider membership for user on practice');
      // Check if user is a provider for this practice
      const { data: providerLink } = await supabaseAdmin
        .from('providers')
        .select('practice_id, user_id, active')
        .eq('user_id', currentUserId)
            .eq('practice_id', doctorIdForAuth)
        .eq('active', true)
        .maybeSingle();

      // Check if user is a staff member for this practice
      const { data: staffMembership } = await supabaseAdmin
        .from('practice_staff')
        .select('practice_id, user_id, active')
        .eq('user_id', currentUserId)
        .eq('practice_id', doctorIdForAuth)
        .eq('active', true)
        .maybeSingle();

      edgeLogger.info('Membership checks', { hasProviderLink: !!providerLink, hasStaffMembership: !!staffMembership });

      if (providerLink || staffMembership) {
        // User is linked to this practice: allow practice card or personal card
        if (paymentMethod.practice_id === doctorIdForAuth || paymentMethod.practice_id === currentUserId) {
          edgeLogger.info('Payment authorized: linked user using practice or personal card');
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      edgeLogger.error('Payment authorization failed', undefined, {
        payment_method_practice_id: paymentMethod.practice_id,
        order_doctor_id: order?.doctor_id || doctorIdForAuth,
        current_user_id: currentUserId
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'You can only use payment methods associated with your practice. Please select a different payment method.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Replace with actual Authorize.Net API call when keys are available
    // Test card support for reliable testing:
    // - Cards ending in 0000 = always succeed
    // - Cards ending in 1111 = always fail (declined)
    // - Other cards = 90% success for realistic testing
    const lastFour = paymentMethod.card_last_five?.slice(-4) || '';
    edgeLogger.info('Card number analysis', {
      card_last_five_raw: paymentMethod.card_last_five,
      lastFour_extracted: lastFour,
      willMatch0000: lastFour === '0000',
      willMatch1111: lastFour === '1111'
    });
    
    let isSuccess;

    if (lastFour === '0000') {
      // Test card - guaranteed success
      isSuccess = true;
      edgeLogger.info('Test card detected (0000) - forcing success');
    } else if (lastFour === '1111') {
      // Test card - guaranteed failure
      isSuccess = false;
      edgeLogger.info('Test card detected (1111) - forcing failure');
    } else {
      // Real cards - simulate 90% success rate
      const randomValue = Math.random();
      isSuccess = randomValue > 0.1;
      edgeLogger.info('Random payment simulation', {
        randomValue,
        threshold: 0.1,
        willSucceed: isSuccess
      });
    }
    
    if (isSuccess) {
          const mockTransactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          edgeLogger.info('[AUTHNET_CHARGE] Authorize.Net response received (simulated)', {
            order_id,
            success: true,
            transaction_id: mockTransactionId,
            attempt: paymentAttempt,
            timestamp: new Date().toISOString()
          });
          
          // Update order with transaction details
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              authorizenet_transaction_id: mockTransactionId,
              authorizenet_profile_id: paymentMethod.authorizenet_profile_id,
              payment_method_used: paymentMethod.payment_type,
              payment_method_id: payment_method_id,
              payment_status: 'paid',
            })
            .eq('id', order_id);

          if (updateError) {
            edgeLogger.error('[AUTHNET_CHARGE] Error updating order', updateError, { attempt: paymentAttempt });
            finalError = { error: 'Unable to process payment. Please try again or contact support.' };
            
            if (paymentAttempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: finalError.error
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          edgeLogger.info("[AUTHNET_CHARGE] Payment successful", { 
            transaction_id: mockTransactionId,
            order_id,
            attempt: paymentAttempt,
            timestamp: new Date().toISOString()
          });

          finalSuccess = true;
          finalTransactionId = mockTransactionId;
          break; // Exit retry loop on success
        } else {
          // Simulate payment failure
          edgeLogger.info("[AUTHNET_CHARGE] Payment failed for order", { 
            order_id,
            attempt: paymentAttempt,
            willRetry: paymentAttempt < maxAttempts
          });
          
          finalError = {
            success: false,
            error: 'Your card was declined. Please try a different payment method or contact your bank.',
            message: 'Payment declined',
            authorizenet_response: {
              messages: {
                resultCode: 'Error',
                message: [{ code: 'E00027', text: 'The transaction was declined.' }]
              }
            }
          };
          
          if (paymentAttempt < maxAttempts) {
            edgeLogger.info('[AUTHNET_CHARGE] Retrying after payment failure', { 
              attempt: paymentAttempt,
              maxAttempts,
              willRetry: true 
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          
          // Only mark as declined after all retries exhausted
          const { error: updateError } = await supabaseAdmin
            .from('practice_payment_methods')
            .update({ status: 'declined' })
            .eq('id', payment_method_id);
            
          if (updateError) {
            edgeLogger.error('[AUTHNET_CHARGE] Failed to mark payment method as declined', updateError);
          }
        }
      } catch (attemptError) {
        edgeLogger.error('[AUTHNET_CHARGE] Payment attempt error', attemptError, {
          attempt: paymentAttempt,
          maxAttempts,
          order_id,
          willRetry: paymentAttempt < maxAttempts
        });
        
        finalError = attemptError;
        
        if (paymentAttempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }

    // After retry loop - return final result
    if (finalSuccess && finalTransactionId) {
      return new Response(
        JSON.stringify({
          success: true,
          transaction_id: finalTransactionId,
          message: 'Payment processed successfully',
          authorizenet_response: {
            messages: {
              resultCode: 'Ok',
              message: [{ code: 'I00001', text: 'Successful.' }]
            }
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      edgeLogger.error('[AUTHNET_CHARGE] All payment attempts exhausted', finalError, {
        order_id,
        totalAttempts: maxAttempts,
        timestamp: new Date().toISOString()
      });
      
      // Ensure error response always has success: false
      const errorResponse = {
        success: false,
        error: finalError?.error || 'Payment failed after multiple attempts. Please try again or contact support.',
        message: finalError?.message || 'Payment failed'
      };
      
      return new Response(
        JSON.stringify(errorResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    edgeLogger.error('Unexpected error in authorizenet-charge-payment', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Payment processing error. Please try again or use a different payment method.',
        details: error instanceof Error ? error.message : String(error) 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
