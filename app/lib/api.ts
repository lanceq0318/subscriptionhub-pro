export type Payment = {
  id?: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  invoiceId?: string;
  method?: string | null;
  reference?: string | null;
};

export type AttachmentMeta = {
  id: number;
  name: string;
  type: 'contract' | 'invoice' | 'other';
  size: number | null;
  uploadDate: string;
  mimeType: string | null;
};

export const api = {
  async getSubscriptions() {
    const res = await fetch('/api/subscriptions', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch subscriptions');
    return res.json();
  },

  async createSubscription(data: any) {
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to create subscription');
    }
    return res.json();
  },

  async updateSubscription(id: number, data: any) {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to update subscription');
    }
    return res.json();
  },

  async deleteSubscription(id: number) {
    const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to delete subscription');
    }
    return res.json();
  },

  async markAsPaid(id: number, payment: Payment) {
    const res = await fetch(`/api/subscriptions/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to mark as paid');
    }
    return res.json();
  },

  /** Attachments */
  async listAttachments(subscriptionId: number): Promise<{ attachments: AttachmentMeta[] }> {
    const res = await fetch(`/api/subscriptions/${subscriptionId}/attachments`, { cache: 'no-store' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to list attachments');
    }
    return res.json();
  },

  async uploadAttachment(subscriptionId: number, file: File, type: 'contract' | 'invoice' | 'other' = 'other', name?: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (name) form.append('name', name);
    const res = await fetch(`/api/subscriptions/${subscriptionId}/attachments`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to upload attachment');
    }
    return res.json();
  },

  async deleteAttachment(subscriptionId: number, attachmentId: number) {
    const res = await fetch(`/api/subscriptions/${subscriptionId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to delete attachment');
    }
    return res.json();
  },

  /** Returns a URL that you can set as href for download or preview (inline by default) */
  downloadAttachmentUrl(subscriptionId: number, attachmentId: number, download = false) {
    const base = `/api/subscriptions/${subscriptionId}/attachments/${attachmentId}`;
    return download ? `${base}?download=1` : base;
  },
};
