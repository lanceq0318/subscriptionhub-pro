import { z } from 'zod';

export const BillingEnum = z.enum(['monthly','quarterly','yearly']);
export const StatusEnum = z.enum(['active','pending','cancelled']);
export const PaymentStatusEnum = z.enum(['paid','pending','overdue']);
export const AttachmentTypeEnum = z.enum(['contract','invoice','other']);

const stringOrNull = z.string().trim().min(1).optional().nullable();

export const SubscriptionCreateSchema = z.object({
  company: z.string().trim().min(1),
  service: z.string().trim().min(1),
  cost: z.number().finite().nonnegative(),
  billing: BillingEnum,
  nextBilling: z.string().datetime().optional().nullable(),
  contractEnd: z.string().datetime().optional().nullable(),
  category: stringOrNull,
  manager: stringOrNull,
  renewalAlert: z.number().int().min(0).default(30),
  status: StatusEnum.default('active'),
  paymentMethod: stringOrNull,
  tags: z.array(z.string().trim().min(1)).optional(),
  notes: z.string().optional().nullable(),
});

export const SubscriptionUpdateSchema = SubscriptionCreateSchema.partial().extend({
  // This field is present on the DB row and used by the PUT route,
  // so we expose it here as optional.
  lastPaymentStatus: PaymentStatusEnum.optional(),
});

export const PaymentSchema = z.object({
  date: z.string().datetime(),
  amount: z.number().finite().nonnegative(),
  status: PaymentStatusEnum,
  method: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

export type SubscriptionCreate = z.infer<typeof SubscriptionCreateSchema>;
export type SubscriptionUpdate = z.infer<typeof SubscriptionUpdateSchema>;
export type PaymentInput = z.infer<typeof PaymentSchema>;
export type AttachmentType = z.infer<typeof AttachmentTypeEnum>;

/** Utility to parse JSON safely with typed error */
export async function parseJson<T>(req: Request): Promise<T> {
  try {
    // @ts-ignore
    return await req.json();
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

/** Utility to build a typed error response payload */
export function errorPayload(message: string, details?: unknown) {
  return { error: message, details };
}
