import { z } from 'zod';
import { CHEQUE_DIRECTIONS, CHEQUE_STATUSES } from '../constants';

export const createChequeSchema = z.object({
  direction: z.enum(CHEQUE_DIRECTIONS),
  partyId: z.string().min(1, 'Party is required'),
  chequeNo: z.string().min(1, 'Cheque number is required'),
  bankName: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  bankAccountId: z.string().optional().nullable(),
  amount: z.number().int().positive('Amount must be positive'), // in paise
  chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required (YYYY-MM-DD)'),
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().split('T')[0]),
  remarks: z.string().optional().nullable(),
  linkedDocumentIds: z.array(z.string()).optional(),
});
export type CreateChequeInput = z.infer<typeof createChequeSchema>;

export const updateChequeStatusSchema = z.object({
  status: z.enum(CHEQUE_STATUSES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bounceReason: z.string().optional().nullable(),
  bankCharges: z.number().int().nonnegative().optional().default(0), // in paise
  depositBankAccountId: z.string().uuid().optional().nullable(),
});
export type UpdateChequeStatusInput = z.infer<typeof updateChequeStatusSchema>;

export const snoozeChequeSchema = z.object({
  days: z.number().int().positive('Days must be greater than 0').max(30),
});
export type SnoozeChequeInput = z.infer<typeof snoozeChequeSchema>;
