// app/lib/api.ts
export type Payment = {
  id?: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  invoiceId?: string;
  method?: string;
  reference?: string;
};

export const api = {
  async getSubscriptions() {
    const res = await fetch('/api/subscriptions', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch subscriptions');
    return res.json();
  },

  async createSubscription(payload: any) {
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create subscription');
    return res.json();
  },

  async updateSubscription(id: number, payload: any) {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update subscription');
    return res.json();
  },

  async deleteSubscription(id: number) {
    const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete subscription');
    return res.json();
  },

  async markAsPaid(id: number, payment: Payment) {
    const res = await fetch(`/api/subscriptions/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });
    if (!res.ok) throw new Error('Failed to mark as paid');
    return res.json();
  },

  // ===== Variable costs =====
  async getSubscriptionCosts(id: number) {
    const res = await fetch(`/api/subscriptions/${id}/costs`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch costs');
    return res.json();
  },

  async upsertSubscriptionCost(id: number, payload: { period: string; amount: number; currency?: string; source?: string; notes?: string; }) {
    const res = await fetch(`/api/subscriptions/${id}/costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to upsert cost');
    return res.json();
  },

  async deleteSubscriptionCost(id: number, period: string) {
    const res = await fetch(`/api/subscriptions/${id}/costs?period=${encodeURIComponent(period)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete cost');
    return res.json();
  },
};
