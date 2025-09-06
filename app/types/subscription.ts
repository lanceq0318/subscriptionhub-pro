// types/subscription.ts

export type FileAttachment = {
  id: string;
  name: string;
  type: 'contract' | 'invoice' | 'other';
  size: number;
  uploadDate: string;
  data: string;
  mimeType: string;
};

export type Payment = {
  id?: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  invoiceId?: string;
  method?: string;
  reference?: string;
};

export type CostPoint = {
  period: string;
  amount: number;
};

// ... (rest of the types as shown in the artifact above)