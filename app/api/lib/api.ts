// app/lib/api.ts
export const api = {
  async getSubscriptions() {
    const res = await fetch('/api/subscriptions', { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
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

  async getPayments(subscriptionId: number) {
    const res = await fetch(`/api/subscriptions/${subscriptionId}/payments`, { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async markAsPaid(subscriptionId: number, payment: any) {
    const res = await fetch(`/api/subscriptions/${subscriptionId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // (if you added the finance endpoint previously)
  async getFinanceReport(params: {
    from?: string; to?: string; company?: string; category?: string; groupBy?: 'month'|'company'|'category'|'service';
  }) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    const res = await fetch(`/api/reports/finance?${qs}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  downloadFinanceReportCSV(params: {
    from?: string; to?: string; company?: string; category?: string; groupBy?: 'month'|'company'|'category'|'service';
  }) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries({ ...params, format: 'csv' }).filter(([, v]) => v != null))
    ).toString();
    window.location.href = `/api/reports/finance?${qs}`;
  },

  // If your code calls this for variable-cost logging
  async upsertSubscriptionCost(subscriptionId: number, payload: { period: string; amount: number; source?: string }) {
    const res = await fetch(`/api/subscriptions/${subscriptionId}/costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
