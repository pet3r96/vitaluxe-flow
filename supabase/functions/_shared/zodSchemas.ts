import { z } from 'https://esm.sh/zod@3.22.4';

/**
 * Shared Zod schemas for edge function input validation
 * Provides type-safe input validation with automatic error messages
 */

// Message schemas
export const sendMessageSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject must be less than 200 characters'),
  message: z.string().trim().min(1, 'Message is required').max(10000, 'Message must be less than 10000 characters'),
  sender_type: z.enum(['patient', 'provider'], { errorMap: () => ({ message: 'Sender type must be patient or provider' }) }),
  patient_id: z.string().uuid('Invalid patient ID format').optional(),
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
