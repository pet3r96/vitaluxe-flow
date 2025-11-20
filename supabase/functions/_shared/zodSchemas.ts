import { z } from 'https://esm.sh/zod@3.22.4';

/**
 * Shared Zod schemas for edge function input validation
 * Provides type-safe input validation with automatic error messages
 */

// Message schemas
// ✅ PHASE 4: Fixed sender_type to match CHECK constraint ('patient' or 'practice')
export const sendMessageSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject must be less than 200 characters'),
  message: z.string().trim().min(1, 'Message is required').max(10000, 'Message must be less than 10000 characters'),
  sender_type: z.enum(['patient', 'practice'], { errorMap: () => ({ message: 'Sender type must be "patient" or "practice"' }) }),
  patient_id: z.string().uuid('Invalid patient ID format').optional(),
  practice_id: z.string().uuid('Invalid practice ID format').optional(),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  parent_message_id: z.string().uuid('Invalid parent message ID format').optional(),
});

// Appointment schemas
export const bookAppointmentSchema = z.object({
  providerId: z.string().uuid('Invalid provider ID format').optional().nullable(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be in HH:MM or HH:MM:SS format'),
  clientDateTimeIso: z.string().datetime('Invalid ISO datetime format').optional(),
  timezoneOffsetMinutes: z.number().int().min(-720).max(840).optional(),
  reasonForVisit: z.string().trim().min(1, 'Reason for visit is required').max(500, 'Reason must be less than 500 characters'),
  visitType: z.enum(['in_person', 'video'], { errorMap: () => ({ message: 'Visit type must be in_person or video' }) }).optional(),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional().nullable(),
});

export const createAppointmentSchema = z.object({
  patient_id: z.string().uuid('Invalid patient ID format'),
  practice_id: z.string().uuid('Invalid practice ID format'),
  provider_id: z.string().uuid('Invalid provider ID format').optional().nullable(),
  start_time: z.string().datetime('Invalid start time format'),
  end_time: z.string().datetime('Invalid end time format'),
  reason_for_visit: z.string().trim().max(500).optional().nullable(),
  visit_type: z.enum(['in_person', 'video']).optional(),
  status: z.enum(['scheduled', 'pending', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const bulkAppointmentsSchema = z.object({
  appointments: z.array(createAppointmentSchema).min(1, 'At least one appointment is required').max(100, 'Maximum 100 appointments per request'),
});

// Blocked time schemas
export const deleteBlockedTimeSchema = z.object({
  blockedTimeId: z.string().uuid('Invalid blocked time ID format'),
});

// Order/Cart schemas
export const cleanupCartSchema = z.object({
  // No input validation needed for cron job
});

export const placeOrderSchema = z.object({
  cart_id: z.string().uuid(),
  payment_method_id: z.string().uuid(),
  discount_code: z.string().max(50).optional().nullable(),
  discount_percentage: z.number().min(0).max(100).optional(),
  merchant_fee_percentage: z.number().min(0).max(10).optional(),
  csrf_token: z.string().min(1),
});

// Payment schemas
export const chargePaymentSchema = z.object({
  order_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method_id: z.string().uuid(),
});

export const refundSchema = z.object({
  transaction_id: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().max(500).optional(),
});

// Admin schemas
export const resetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(8),
});

export const assignRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin","doctor","provider","pharmacy","topline","downline","patient"]),
});

// Video/Agora schemas
export const generateAgoraTokenSchema = z.object({
  channel_name: z.string().min(1).max(64),
  uid: z.number().int().positive(),
  role: z.enum(["publisher","subscriber"]).optional(),
});

// Medical vault schemas
export const vaultRecordSchema = z.object({
  patient_account_id: z.string().uuid(),
  record_type: z.enum(["medication","allergy","condition","immunization","surgery","vital","document"]),
  record_data: z.record(z.unknown()),
});

// Security schemas
export const trackFailedLoginSchema = z.object({
  email: z.string().email(),
  user_agent: z.string().max(500),
});

export const detectBruteForceSchema = z.object({
  email: z.string().email(),
  attempt_count: z.number().int().positive(),
  ip_address: z.string().max(45).optional().nullable(),
});

// PHASE 3: Expanded schemas for additional edge functions
export const startVideoSessionSchema = z.object({
  practice_id: z.string().uuid('Invalid practice ID'),
  channel_name: z.string().trim().min(1).max(64),
  provider_id: z.string().uuid('Invalid provider ID').optional(),
  patient_id: z.string().uuid('Invalid patient ID').optional(),
  session_type: z.enum(['consultation', 'follow_up', 'emergency']).optional(),
});

export const joinVideoSessionSchema = z.object({
  session_id: z.string().uuid('Invalid session ID'),
  user_id: z.string().uuid('Invalid user ID'),
  role: z.enum(['host', 'participant']).optional(),
});

export const createPatientPortalAccountSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  patient_name: z.string().trim().min(1, 'Patient name is required').max(200),
  phone: z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  practice_id: z.string().uuid('Invalid practice ID'),
});

export const createPrescriptionSchema = z.object({
  patient_id: z.string().uuid('Invalid patient ID'),
  provider_id: z.string().uuid('Invalid provider ID'),
  practice_id: z.string().uuid('Invalid practice ID'),
  medication_name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(100),
  quantity: z.number().int().positive(),
  refills: z.number().int().min(0).max(12),
  instructions: z.string().trim().max(1000).optional(),
});

export const generatePrescriptionPdfSchema = z.object({
  prescription_id: z.string().uuid('Invalid prescription ID'),
  include_patient_info: z.boolean().optional(),
  include_provider_signature: z.boolean().optional(),
});

export const pharmacyOrderActionSchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
  action: z.enum(['hold', 'decline'], {  // ✅ Match actual function
    errorMap: () => ({ message: 'Invalid action. Must be "hold" or "decline"' })
  }),
  reason: z.string().trim().min(1, 'Reason is required').max(200),  // ✅ Add required field
  notes: z.string().trim().max(500).optional(),
  target_user_id: z.string().uuid().optional(),  // ✅ For admin impersonation
});

export const routeOrderToPharmacySchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
  pharmacy_id: z.string().uuid('Invalid pharmacy ID'),
  priority: z.number().int().min(1).max(10).optional(),
  urgent: z.boolean().optional(),
});

export const resetPasswordWithTokenSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  new_password: z.string().min(12, 'Password must be at least 12 characters').max(128),
  confirm_password: z.string().min(12).max(128),
}).refine(data => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export const verify2FASchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID'),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  phoneNumber: z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
});

export const send2FASchema = z.object({
  phone: z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  userId: z.string().uuid('Invalid user ID').optional(),
});

export const updateOrderStatusSchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'], {
    errorMap: () => ({ message: 'Invalid order status' })
  }),
  notes: z.string().trim().max(500).optional(),
  tracking_number: z.string().trim().max(100).optional(),
});

export const manageEntityStatusSchema = z.object({
  entity_type: z.enum(['practice', 'provider', 'pharmacy', 'patient'], {
    errorMap: () => ({ message: 'Invalid entity type' })
  }),
  entity_id: z.string().uuid('Invalid entity ID'),
  status: z.enum(['active', 'inactive', 'suspended', 'deleted'], {
    errorMap: () => ({ message: 'Invalid status' })
  }),
  reason: z.string().trim().max(500).optional(),
});

// PHASE 3: Additional validation schemas for critical functions

export const cancelOrderSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  reason: z.string().max(500).optional(),
  csrf_token: z.string().min(1, 'CSRF token required')
});

export const updateShippingSchema = z.object({
  orderLineId: z.string().uuid('Invalid order line ID format'),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.enum(['USPS', 'UPS', 'FedEx', 'DHL', 'Other', 'usps', 'ups', 'fedex', 'dhl', 'other']).optional(),  // ✅ Accept both cases
  status: z.enum(['pending', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned']).optional(),
  estimatedDelivery: z.string().optional(),
  csrf_token: z.string().min(1, 'CSRF token required')
});

export const cancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid('Invalid appointment ID format'),
  reason: z.string().max(500).optional(),
  csrf_token: z.string().min(1)
});

export const bulkInviteSchema = z.object({
  patientIds: z.array(z.string().uuid('Invalid patient ID format')).min(1, 'At least one patient ID is required').max(50, 'Maximum 50 patients per batch')
});

export const manageCartSchema = z.object({
  action: z.enum(['add', 'remove', 'update', 'clear']),
  productId: z.string().uuid().optional(),
  quantity: z.number().int().positive().optional(),
  cartId: z.string().uuid().optional()
});

// Helper function to safely parse and validate
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Extract user-friendly error messages
  const errors = result.error.errors.map(err => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
  
  return { success: false, errors };
}
