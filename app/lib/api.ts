// app/lib/api.ts

import { Subscription, Payment, CostPoint } from '@/types/subscription';

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.NEXT_PUBLIC_API_URL;

// Types for API requests/responses
interface CreateSubscriptionRequest {
  company: string;
  service: string;
  cost: number;
  billing: 'monthly' | 'yearly' | 'quarterly';
  nextBilling?: string;
  contractEnd?: string;
  category?: string;
  manager?: string;
  renewalAlert: number;
  status: 'active' | 'pending' | 'cancelled';
  paymentMethod: string;
  tags?: string[];
  notes?: string;
  pricingType?: 'fixed' | 'variable';
  seats?: number;
  seatsUsed?: number;
}

interface UpdateSubscriptionRequest extends Partial<CreateSubscriptionRequest> {}

interface MarkAsPaidRequest {
  payment: Payment;
}

interface UpsertCostRequest {
  period: string;
  amount: number;
  source: 'manual' | 'automatic';
}

interface BulkUpdateRequest {
  ids: number[];
  updates: Partial<CreateSubscriptionRequest>;
}

// Mock data store (for development)
let mockSubscriptions: Subscription[] = [
  {
    id: 1,
    company: 'Kisamos',
    service: 'Microsoft 365',
    cost: 299,
    billing: 'monthly',
    nextBilling: '2025-02-01',
    contractEnd: '2025-12-31',
    category: 'Software',
    manager: 'John Smith',
    renewalAlert: 30,
    status: 'active',
    paymentMethod: 'Credit Card',
    tags: ['productivity', 'essential'],
    notes: 'Business Premium plan for 10 users',
    lastPaymentStatus: 'paid',
    pricingType: 'fixed',
    seats: 10,
    seatsUsed: 8,
    attachments: [],
    payments: [
      {
        date: '2025-01-01',
        amount: 299,
        status: 'paid',
        method: 'Credit Card',
        reference: 'PAY-001'
      }
    ]
  },
  {
    id: 2,
    company: 'Mizzen',
    service: 'Azure Cloud',
    cost: 1500,
    billing: 'monthly',
    nextBilling: '2025-02-01',
    category: 'Infrastructure',
    manager: 'Sarah Johnson',
    renewalAlert: 15,
    status: 'active',
    paymentMethod: 'Invoice',
    tags: ['cloud', 'variable'],
    notes: 'Pay-as-you-go consumption model',
    lastPaymentStatus: 'pending',
    pricingType: 'variable',
    currentMonthCost: 1823,
    lastMonthCost: 1456,
    costHistory: [
      { period: '2024-11', amount: 1234 },
      { period: '2024-12', amount: 1456 },
      { period: '2025-01', amount: 1823 }
    ],
    attachments: [],
    payments: []
  },
  {
    id: 3,
    company: 'Fertmax',
    service: 'Salesforce CRM',
    cost: 150,
    billing: 'monthly',
    nextBilling: '2025-02-15',
    contractEnd: '2025-06-30',
    category: 'Sales',
    manager: 'Mike Davis',
    renewalAlert: 45,
    status: 'active',
    paymentMethod: 'Credit Card',
    tags: ['crm', 'sales'],
    lastPaymentStatus: 'overdue',
    pricingType: 'fixed',
    seats: 25,
    seatsUsed: 20,
    attachments: [],
    payments: []
  }
];

// Helper function to delay responses (simulates network latency)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  if (USE_MOCK_DATA) {
    await delay(300); // Simulate network delay
    return getMockResponse(endpoint, options) as T;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  return response.json();
}

// Mock response handler
function getMockResponse(endpoint: string, options?: RequestInit): any {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.parse(options.body as string) : null;

  // Parse endpoint
  const urlParts = endpoint.split('/').filter(Boolean);
  const resource = urlParts[0];
  const id = urlParts[1] ? parseInt(urlParts[1]) : null;
  const action = urlParts[2];

  if (resource === 'subscriptions') {
    switch (method) {
      case 'GET':
        if (id) {
          return mockSubscriptions.find(s => s.id === id) || null;
        }
        return [...mockSubscriptions];

      case 'POST':
        if (action === 'bulk-update') {
          const { ids, updates } = body as BulkUpdateRequest;
          mockSubscriptions = mockSubscriptions.map(sub =>
            ids.includes(sub.id) ? { ...sub, ...updates } : sub
          );
          return { success: true, updated: ids.length };
        }
        
        const newSub: Subscription = {
          ...body,
          id: Math.max(...mockSubscriptions.map(s => s.id), 0) + 1,
          attachments: [],
          payments: [],
          lastPaymentStatus: 'pending'
        };
        mockSubscriptions.push(newSub);
        return newSub;

      case 'PUT':
        if (id) {
          if (action === 'mark-paid') {
            const { payment } = body as MarkAsPaidRequest;
            mockSubscriptions = mockSubscriptions.map(sub =>
              sub.id === id
                ? {
                    ...sub,
                    lastPaymentStatus: 'paid',
                    payments: [...(sub.payments || []), payment]
                  }
                : sub
            );
            return { success: true };
          }
          
          if (action === 'cost') {
            const { period, amount } = body as UpsertCostRequest;
            mockSubscriptions = mockSubscriptions.map(sub =>
              sub.id === id
                ? {
                    ...sub,
                    currentMonthCost: amount,
                    costHistory: [
                      ...(sub.costHistory || []).filter(c => c.period !== period),
                      { period, amount }
                    ].sort((a, b) => a.period.localeCompare(b.period))
                  }
                : sub
            );
            return { success: true };
          }

          // Regular update
          mockSubscriptions = mockSubscriptions.map(sub =>
            sub.id === id ? { ...sub, ...body } : sub
          );
          return mockSubscriptions.find(s => s.id === id);
        }
        break;

      case 'DELETE':
        if (id) {
          mockSubscriptions = mockSubscriptions.filter(s => s.id !== id);
          return { success: true };
        }
        break;
    }
  }

  throw new Error(`Unhandled mock endpoint: ${method} ${endpoint}`);
}

// API Methods
export const api = {
  // Get all subscriptions
  async getSubscriptions(): Promise<Subscription[]> {
    return apiCall<Subscription[]>('/subscriptions');
  },

  // Get single subscription
  async getSubscription(id: number): Promise<Subscription | null> {
    return apiCall<Subscription | null>(`/subscriptions/${id}`);
  },

  // Create new subscription
  async createSubscription(data: CreateSubscriptionRequest): Promise<Subscription> {
    return apiCall<Subscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update subscription
  async updateSubscription(id: number, data: UpdateSubscriptionRequest): Promise<Subscription> {
    return apiCall<Subscription>(`/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Delete subscription
  async deleteSubscription(id: number): Promise<{ success: boolean }> {
    return apiCall<{ success: boolean }>(`/subscriptions/${id}`, {
      method: 'DELETE',
    });
  },

  // Mark subscription as paid
  async markAsPaid(id: number, payment: Payment): Promise<{ success: boolean }> {
    return apiCall<{ success: boolean }>(`/subscriptions/${id}/mark-paid`, {
      method: 'PUT',
      body: JSON.stringify({ payment }),
    });
  },

  // Update or insert cost for a specific period (for variable pricing)
  async upsertSubscriptionCost(
    id: number,
    data: UpsertCostRequest
  ): Promise<{ success: boolean }> {
    return apiCall<{ success: boolean }>(`/subscriptions/${id}/cost`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Bulk update subscriptions
  async bulkUpdateSubscriptions(
    ids: number[],
    updates: Partial<CreateSubscriptionRequest>
  ): Promise<{ success: boolean; updated: number }> {
    return apiCall<{ success: boolean; updated: number }>('/subscriptions/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ ids, updates }),
    });
  },

  // Get subscription statistics
  async getStatistics(): Promise<{
    totalMonthly: number;
    totalYearly: number;
    activeCount: number;
    totalCount: number;
    byCompany: { company: string; count: number; monthly: number }[];
    byCategory: { category: string; count: number; monthly: number }[];
    upcomingRenewals: number;
    overduePayments: number;
  }> {
    // In production, this would be a dedicated endpoint
    // For now, calculate from subscriptions
    const subscriptions = await api.getSubscriptions();
    
    const active = subscriptions.filter(s => s.status === 'active');
    const normalizeToMonthly = (cost: number, billing: string) => {
      if (billing === 'yearly') return cost / 12;
      if (billing === 'quarterly') return cost / 3;
      return cost;
    };

    const totalMonthly = active.reduce((sum, sub) => {
      const monthly = sub.pricingType === 'variable' && sub.currentMonthCost
        ? sub.currentMonthCost
        : normalizeToMonthly(sub.cost, sub.billing);
      return sum + monthly;
    }, 0);

    // Group by company
    const byCompany = new Map<string, { count: number; monthly: number }>();
    active.forEach(sub => {
      const existing = byCompany.get(sub.company) || { count: 0, monthly: 0 };
      const monthly = sub.pricingType === 'variable' && sub.currentMonthCost
        ? sub.currentMonthCost
        : normalizeToMonthly(sub.cost, sub.billing);
      byCompany.set(sub.company, {
        count: existing.count + 1,
        monthly: existing.monthly + monthly
      });
    });

    // Group by category
    const byCategory = new Map<string, { count: number; monthly: number }>();
    active.forEach(sub => {
      const cat = sub.category || 'Other';
      const existing = byCategory.get(cat) || { count: 0, monthly: 0 };
      const monthly = sub.pricingType === 'variable' && sub.currentMonthCost
        ? sub.currentMonthCost
        : normalizeToMonthly(sub.cost, sub.billing);
      byCategory.set(cat, {
        count: existing.count + 1,
        monthly: existing.monthly + monthly
      });
    });

    // Count upcoming renewals (within 30 days)
    const today = new Date();
    const upcomingRenewals = subscriptions.filter(sub => {
      if (!sub.nextBilling || sub.status !== 'active') return false;
      const renewalDate = new Date(sub.nextBilling);
      const daysUntil = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 30 && daysUntil >= 0;
    }).length;

    const overduePayments = subscriptions.filter(s => s.lastPaymentStatus === 'overdue').length;

    return {
      totalMonthly,
      totalYearly: totalMonthly * 12,
      activeCount: active.length,
      totalCount: subscriptions.length,
      byCompany: Array.from(byCompany.entries()).map(([company, data]) => ({
        company,
        ...data
      })),
      byCategory: Array.from(byCategory.entries()).map(([category, data]) => ({
        category,
        ...data
      })),
      upcomingRenewals,
      overduePayments
    };
  },

  // Get cost history for analytics
  async getCostHistory(
    startDate?: string,
    endDate?: string
  ): Promise<{ period: string; total: number; byCategory: { [key: string]: number } }[]> {
    const subscriptions = await api.getSubscriptions();
    
    // Generate monthly periods
    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 12));
    const end = endDate ? new Date(endDate) : new Date();
    
    const periods: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      periods.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }

    return periods.map(period => {
      const byCategory: { [key: string]: number } = {};
      let total = 0;

      subscriptions.forEach(sub => {
        if (sub.status !== 'active') return;
        
        let monthlyAmount = 0;
        
        if (sub.pricingType === 'variable' && sub.costHistory) {
          const historicalCost = sub.costHistory.find(c => c.period === period);
          if (historicalCost) {
            monthlyAmount = historicalCost.amount;
          }
        } else {
          // Fixed cost
          monthlyAmount = sub.cost / (sub.billing === 'yearly' ? 12 : sub.billing === 'quarterly' ? 3 : 1);
        }

        if (monthlyAmount > 0) {
          const category = sub.category || 'Other';
          byCategory[category] = (byCategory[category] || 0) + monthlyAmount;
          total += monthlyAmount;
        }
      });

      return { period, total, byCategory };
    });
  },

  // Export data
  async exportData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const subscriptions = await api.getSubscriptions();
    
    if (format === 'json') {
      const data = {
        subscriptions,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    } else {
      // CSV format
      const headers = [
        'ID', 'Company', 'Service', 'Cost', 'Billing', 'Status',
        'Category', 'Manager', 'Next Billing', 'Contract End',
        'Payment Method', 'Payment Status', 'Pricing Type', 'Tags'
      ];
      
      const rows = subscriptions.map(sub => [
        sub.id,
        sub.company,
        sub.service,
        sub.cost,
        sub.billing,
        sub.status,
        sub.category || '',
        sub.manager || '',
        sub.nextBilling || '',
        sub.contractEnd || '',
        sub.paymentMethod,
        sub.lastPaymentStatus || '',
        sub.pricingType || 'fixed',
        (sub.tags || []).join(';')
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return new Blob([csv], { type: 'text/csv' });
    }
  },

  // Import data
  async importData(data: any[], replace: boolean = false): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;

    if (replace) {
      // Clear existing subscriptions
      const existing = await api.getSubscriptions();
      for (const sub of existing) {
        await api.deleteSubscription(sub.id);
      }
    }

    for (const item of data) {
      try {
        await api.createSubscription({
          company: item.company || 'Kisamos',
          service: item.service || 'Unknown Service',
          cost: parseFloat(item.cost || 0),
          billing: item.billing || 'monthly',
          nextBilling: item.nextBilling || item.next_billing,
          contractEnd: item.contractEnd || item.contract_end,
          category: item.category || 'Other',
          manager: item.manager || '',
          renewalAlert: parseInt(item.renewalAlert || 30),
          status: item.status || 'active',
          paymentMethod: item.paymentMethod || item.payment_method || 'Credit Card',
          tags: item.tags ? (typeof item.tags === 'string' ? item.tags.split(',').map((t: string) => t.trim()) : item.tags) : [],
          notes: item.notes || '',
          pricingType: item.pricingType || item.pricing_type || 'fixed',
          seats: item.seats ? parseInt(item.seats) : undefined,
          seatsUsed: item.seatsUsed ? parseInt(item.seatsUsed) : undefined
        });
        imported++;
      } catch (error) {
        errors.push(`Failed to import ${item.service || 'unknown'}: ${error}`);
      }
    }

    return { success: errors.length === 0, imported, errors };
  }
};

// Export types for use in components
export type {
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  MarkAsPaidRequest,
  UpsertCostRequest,
  BulkUpdateRequest
};