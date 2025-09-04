export const api = {
  async getSubscriptions() {
    const res = await fetch('/api/subscriptions');
    if (!res.ok) throw new Error('Failed to fetch subscriptions');
    return res.json();
  },

  async createSubscription(data: any) {
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create subscription');
    return res.json();
  },

  async updateSubscription(id: number, data: any) {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update subscription');
    return res.json();
  },

  async deleteSubscription(id: number) {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete subscription');
    return res.json();
  },

  async markAsPaid(id: number, payment: any) {
    const res = await fetch(`/api/subscriptions/${id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    });
    if (!res.ok) throw new Error('Failed to mark as paid');
    return res.json();
  },
};