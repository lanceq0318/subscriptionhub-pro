import { z } from 'zod';

export const BillingEnum = z.enum(['monthly','quarterly','yearly']);
export const StatusEnum = z.enum(['active','pending','cancelled']);
export const PaymentStatusEnum = z.enum(['paid','pending','overdue']);
export const AttachmentTypeEnum = z.enum(['contract','invoice','other']);

const stringOrNull = z.string().trim().min(1).optional().nullable();
const optionalISODate = z.string().datetime().optional().nullable();

const money = z.coerce.number()
  .refine(n => Number.isFinite(n) && n >= 0, 'Must be a non‑negative number')
  .transform(n => Math.round(n * 100) / 100); // 2‑decimals

export const SubscriptionCreateSchema = z.object({
  company: z.string().trim().min(1, 'Company is required'),
  service: z.string().trim().min(1, 'Service is required'),
  cost: money,
  billing: BillingEnum,
  nextBilling: optionalISODate,
  contractEnd: optionalISODate,
  category: stringOrNull,
  manager: stringOrNull,
  renewalAlert: z.coerce.number().int().min(0).max(365).default(30),
  status: StatusEnum.default('active'),
  paymentMethod: stringOrNull,
  tags: z.array(z.string().trim().min(1)).max(15).optional(),
  notes: z.string().optional().nullable(),
});

export const SubscriptionUpdateSchema = SubscriptionCreateSchema.partial().extend({
  // Allow the API to accept a manual override, but we’ll derive it automatically elsewhere.
  lastPaymentStatus: PaymentStatusEnum.optional(),
});

export const PaymentSchema = z.object({
  date: z.string().datetime(),
  amount: money,
  status: PaymentStatusEnum,
  method: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

export type SubscriptionCreate = z.infer<typeof SubscriptionCreateSchema>;
export type SubscriptionUpdate = z.infer<typeof SubscriptionUpdateSchema>;
export type PaymentInput = z.infer<typeof PaymentSchema>;
export type AttachmentType = z.infer<typeof AttachmentTypeEnum>;

export async function parseJson<T>(req: Request): Promise<T> {
  try {
    // @ts-ignore
    return await req.json();
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

export function errorPayload(message: string, details?: unknown) {
  return { error: message, details };
}
