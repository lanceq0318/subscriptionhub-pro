export type Payment = {
  id?: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
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
  async getSubscriptions(params?: { q?: string; tag?: string; status?: string; sort?: string; order?: 'asc'|'desc' }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.tag) qs.set('tag', params.tag);
    if (params?.status) qs.set('status', params.status);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.order) qs.set('order', params.order);
    const res = await fetch(`/api/subscriptions${qs.toString() ? `?${qs.toString()}` : ''}`, { cache: 'no-store' });
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

  downloadAttachmentUrl(subscriptionId: number, attachmentId: number, download = false) {
    const base = `/api/subscriptions/${subscriptionId}/attachments/${attachmentId}`;
    return download ? `${base}?download=1` : base;
  },

  /** Bulk actions */
  async bulk(action: { type: 'delete'|'status'|'addTag'|'removeTag'; ids: number[]; status?: 'active'|'pending'|'cancelled'; tag?: string; }) {
    const res = await fetch('/api/subscriptions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Bulk action failed');
    }
    return res.json();
  },

  /** Analytics */
  async analyticsSummary() {
    const res = await fetch('/api/analytics/summary', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load analytics');
    return res.json();
  },
};
