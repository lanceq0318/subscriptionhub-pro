// app/lib/api.ts
export const api = {
  async getSubscriptions() {
    const res = await fetch('/api/subscriptions', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load subscriptions');
    return res.json();
  },

  async createSubscription(payload: any) {
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateSubscription(id: number, payload: any) {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteSubscription(id: number) {
    const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async markAsPaid(subscriptionId: number, payment: any) {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId, payment }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async upsertSubscriptionCost(subscriptionId: number, payload: { period: string; amount: number; source?: string }) {
    const res = await fetch('/api/costs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId, ...payload }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getFinancialReport(period?: string) {
    const qs = period ? `?period=${encodeURIComponent(period)}` : '';
    const res = await fetch(`/api/reports${qs}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
