'use client';

import type React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { api } from '@/app/lib/api';
import {
  useEffect,
  useMemo,
  useState,
  type FormEventHandler,
  type ChangeEvent,
} from 'react';

/* =========================
   Types
   ========================= */

type FileAttachment = {
  id: string;
  name: string;
  type: 'contract' | 'invoice' | 'other';
  size: number;
  uploadDate: string;
  data: string;
  mimeType: string;
};

type Payment = {
  id?: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  invoiceId?: string;
  method?: string;
  reference?: string;
  invoiceNumber?: string;
  notes?: string;
};

type CostPoint = { period: string; amount: number };

type Subscription = {
  id: number;
  company: 'Kisamos' | 'Mizzen' | 'Fertmax' | 'Shantaram' | 'Relia Ship';
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
  attachments?: FileAttachment[];
  payments?: Payment[];
  lastPaymentStatus?: 'paid' | 'pending' | 'overdue';
  pricingType?: 'fixed' | 'variable';
  currentMonthCost?: number | null;
  lastMonthCost?: number | null;
  costHistory?: CostPoint[];
  attachment_count?: number;
  department?: string;
  costCenter?: string;
  vendor?: string;
  accountNumber?: string;
  autoRenew?: boolean;
  budget?: number;
};

type SubscriptionForm = Omit<
  Subscription,
  'id' | 'cost' | 'budget' | 'attachment_count' | 'currentMonthCost' | 'lastMonthCost' | 'costHistory'
> & { cost: string; budget: string };

type FinancialReport = {
  period: string;
  totalSpend: number;
  byCompany: { company: string; amount: number }[];
  byCategory: { category: string; amount: number }[];
  byDepartment: { department: string; amount: number }[];
  savings: number;
  projectedSpend: number;
  budgetUtilization: number;
};

/* =========================
   Constants
   ========================= */

const COMPANIES = ['Kisamos', 'Mizzen', 'Fertmax', 'Shantaram', 'Relia Ship'] as const;

const CATEGORIES = [
  'Software',
  'Infrastructure',
  'Marketing',
  'Sales',
  'Analytics',
  'Security',
  'Communication',
  'HR',
  'Legal',
  'Finance',
  'Operations',
  'Other',
] as const;

const DEPARTMENTS = [
  'Engineering',
  'Sales',
  'Marketing',
  'Finance',
  'HR',
  'Operations',
  'Legal',
  'Executive',
  'Customer Success',
  'Product',
] as const;

const PAYMENT_METHODS = [
  'Credit Card',
  'Bank Transfer',
  'Invoice',
  'PayPal',
  'ACH Transfer',
  'Wire Transfer',
  'Check',
  'Other',
] as const;

type Company = (typeof COMPANIES)[number];

/* =========================
   Page Component
   ========================= */

export default function Dashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Data & UI state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [showFinancialReportModal, setShowFinancialReportModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState<'all' | Company>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'analytics' | 'reports'>('grid');

  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [formData, setFormData] = useState<SubscriptionForm>({
    company: 'Kisamos',
    service: '',
    cost: '',
    billing: 'monthly',
    nextBilling: '',
    contractEnd: '',
    category: 'Software',
    manager: '',
    renewalAlert: 30,
    status: 'active',
    paymentMethod: 'Credit Card',
    tags: [],
    notes: '',
    attachments: [],
    payments: [],
    lastPaymentStatus: 'pending',
    pricingType: 'fixed',
    department: 'Engineering',
    costCenter: '',
    vendor: '',
    accountNumber: '',
    autoRenew: false,
    budget: '',
  });

  // Helper function to parse subscription data from API
  const parseSubscriptionData = (data: any[]): Subscription[] => {
    return data.map((sub: any) => ({
      ...sub,
      cost: typeof sub.cost === 'string' ? parseFloat(sub.cost) : sub.cost,
      budget: sub.budget ? (typeof sub.budget === 'string' ? parseFloat(sub.budget) : sub.budget) : undefined,
      currentMonthCost: sub.currentMonthCost ? (typeof sub.currentMonthCost === 'string' ? parseFloat(sub.currentMonthCost) : sub.currentMonthCost) : null,
      lastMonthCost: sub.lastMonthCost ? (typeof sub.lastMonthCost === 'string' ? parseFloat(sub.lastMonthCost) : sub.lastMonthCost) : null,
    }));
  };

  // Helpers for cost logic
  const normalizeToMonthly = (cost: number, billing: Subscription['billing']) => {
    if (billing === 'yearly') return cost / 12;
    if (billing === 'quarterly') return cost / 3;
    return cost;
  };

  const effectiveMonthly = (sub: Subscription) => {
    if (sub.pricingType === 'variable' && typeof sub.currentMonthCost === 'number') {
      return sub.currentMonthCost;
    }
    return normalizeToMonthly(sub.cost, sub.billing);
  };

  const effectiveChargeForPayment = (sub: Subscription) => {
    if (sub.pricingType === 'variable' && typeof sub.currentMonthCost === 'number') {
      return sub.currentMonthCost;
    }
    return sub.cost;
  };

  // Enhanced stats with budget tracking
  const stats = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'active');
    const monthly = active.reduce((total, sub) => total + effectiveMonthly(sub), 0);
    
    const totalBudget = subscriptions.reduce((total, sub) => {
      const budget = typeof sub.budget === 'string' ? parseFloat(sub.budget) : (sub.budget || 0);
      return total + budget;
    }, 0);
    const budgetUtilization = totalBudget > 0 ? (monthly / (totalBudget / 12)) * 100 : 0;

    const vendors = new Set(subscriptions.map(s => s.vendor || s.service)).size;
    const paidCount = subscriptions.filter(s => s.lastPaymentStatus === 'paid').length;
    const pendingCount = subscriptions.filter(s => s.lastPaymentStatus === 'pending').length;
    const overdueCount = subscriptions.filter(s => s.lastPaymentStatus === 'overdue').length;

    // Calculate savings (cancelled subscriptions this year)
    const cancelledThisYear = subscriptions.filter(s => 
      s.status === 'cancelled'
    );
    const savings = cancelledThisYear.reduce((total, sub) => 
      total + normalizeToMonthly(sub.cost, sub.billing) * 12, 0
    );

    return {
      monthly: monthly.toFixed(2),
      yearly: (monthly * 12).toFixed(2),
      active: active.length,
      total: subscriptions.length,
      vendors,
      paidCount,
      pendingCount,
      overdueCount,
      totalBudget: (totalBudget).toFixed(2),
      budgetUtilization: budgetUtilization.toFixed(1),
      savings: savings.toFixed(2),
    };
  }, [subscriptions]);

  // Financial metrics by department
  const departmentMetrics = useMemo(() => {
    const metrics: Record<string, { spend: number; count: number; budget: number }> = {};
    
    subscriptions.filter(s => s.status === 'active').forEach(sub => {
      const dept = sub.department || 'Unassigned';
      if (!metrics[dept]) {
        metrics[dept] = { spend: 0, count: 0, budget: 0 };
      }
      metrics[dept].spend += effectiveMonthly(sub);
      metrics[dept].count += 1;
      metrics[dept].budget += (sub.budget || 0) / 12;
    });

    return Object.entries(metrics)
      .map(([dept, data]) => ({
        department: dept,
        ...data,
        utilization: data.budget > 0 ? (data.spend / data.budget) * 100 : 0,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [subscriptions]);

  const upcomingRenewals = useMemo(() => {
    const today = new Date();
    return subscriptions
      .filter((sub) => {
        if (!sub.nextBilling || sub.status !== 'active') return false;
        const renewalDate = new Date(sub.nextBilling);
        const daysUntil = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= sub.renewalAlert && daysUntil >= 0;
      })
      .sort((a, b) => (a.nextBilling || '').localeCompare(b.nextBilling || ''));
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions;

    if (companyFilter !== 'all') {
      filtered = filtered.filter(sub => sub.company === companyFilter);
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(sub => sub.category === categoryFilter);
    }
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(sub => sub.department === departmentFilter);
    }
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(sub => sub.lastPaymentStatus === paymentFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(sub =>
        sub.service.toLowerCase().includes(q) ||
        sub.company.toLowerCase().includes(q) ||
        (sub.vendor && sub.vendor.toLowerCase().includes(q)) ||
        (sub.manager && sub.manager.toLowerCase().includes(q)) ||
        (sub.accountNumber && sub.accountNumber.toLowerCase().includes(q)) ||
        (sub.tags && sub.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }
    return filtered;
  }, [subscriptions, companyFilter, categoryFilter, departmentFilter, paymentFilter, searchTerm]);

  // Generate financial report
  const generateFinancialReport = (): FinancialReport => {
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    
    const byCompany: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    
    let totalSpend = 0;
    
    activeSubscriptions.forEach(sub => {
      const monthlyAmount = effectiveMonthly(sub);
      totalSpend += monthlyAmount;
      
      byCompany[sub.company] = (byCompany[sub.company] || 0) + monthlyAmount;
      byCategory[sub.category || 'Other'] = (byCategory[sub.category || 'Other'] || 0) + monthlyAmount;
      byDepartment[sub.department || 'Unassigned'] = (byDepartment[sub.department || 'Unassigned'] || 0) + monthlyAmount;
    });

    return {
      period: new Date().toISOString().slice(0, 7),
      totalSpend,
      byCompany: Object.entries(byCompany).map(([company, amount]) => ({ company, amount })),
      byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
      byDepartment: Object.entries(byDepartment).map(([department, amount]) => ({ department, amount })),
      savings: parseFloat(stats.savings),
      projectedSpend: totalSpend * 12,
      budgetUtilization: parseFloat(stats.budgetUtilization),
    };
  };

  // Payment history for a subscription
  const getPaymentHistory = (subscriptionId: number): Payment[] => {
    const sub = subscriptions.find(s => s.id === subscriptionId);
    return sub?.payments || [];
  };

  // Effects
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    async function loadSubscriptions() {
      if (status !== 'authenticated') return;
      setIsLoading(true);
      try {
        const data = await api.getSubscriptions();
        setSubscriptions(parseSubscriptionData(data));
      } catch (error) {
        console.error('Error loading subscriptions:', error);
        setSubscriptions([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadSubscriptions();
  }, [status]);

  if (status === 'loading') {
    return (
      <div style={fullHeightCenter('#F9FAFB')}>
        <div style={{ textAlign: 'center' }}>
          <Spinner />
          <p style={{ color: '#6B7280' }}>Authenticating...</p>
        </div>
      </div>
    );
  }
  if (!session) return null;

  /* =========================
     Helpers
     ========================= */

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, subscriptionId?: number) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      alert('File size exceeds 10MB limit');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const fileName = file.name.toLowerCase();

      let fileType: FileAttachment['type'] = 'other';
      if (fileName.includes('contract') || fileName.includes('agreement')) fileType = 'contract';
      else if (fileName.includes('invoice') || fileName.includes('bill')) fileType = 'invoice';

      const attachment: FileAttachment = {
        id: Date.now().toString(),
        name: file.name,
        type: fileType,
        size: file.size,
        uploadDate: new Date().toISOString(),
        data: base64,
        mimeType: file.type,
      };

      if (subscriptionId) {
        setSubscriptions(subs =>
          subs.map(sub =>
            sub.id === subscriptionId
              ? { ...sub, attachments: [...(sub.attachments || []), attachment] }
              : sub
          )
        );
      } else {
        const currentAttachments = formData.attachments || [];
        setFormData({ ...formData, attachments: [...currentAttachments, attachment] });
      }
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const downloadFile = (attachment: FileAttachment) => {
    const link = document.createElement('a');
    link.href = attachment.data;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const markAsPaid = async (subscriptionId: number) => {
    try {
      const subscription = subscriptions.find(s => s.id === subscriptionId);
      if (!subscription) return;

      const paymentAmount = effectiveChargeForPayment(subscription);

      const payment: Payment = {
        date: new Date().toISOString(),
        amount: paymentAmount,
        status: 'paid',
        method: subscription.paymentMethod,
        reference: `PAY-${Date.now()}`,
        invoiceNumber: `INV-${Date.now()}`,
      };

      await api.markAsPaid(subscriptionId, payment);

      const data = await api.getSubscriptions();
      setSubscriptions(parseSubscriptionData(data));
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Failed to update payment status');
    }
  };

  const logActualCost = async (subscriptionId: number) => {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const period = `${y}-${m}-01`;

      const input = prompt(
        `Enter actual cost for ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}:`,
        ''
      );
      if (!input) return;
      const amount = parseFloat(input);
      if (!isFinite(amount)) {
        alert('Please enter a valid number.');
        return;
      }

      await (api as any).upsertSubscriptionCost(subscriptionId, { period, amount, source: 'manual' });

      const data = await api.getSubscriptions();
      setSubscriptions(parseSubscriptionData(data));
    } catch (err) {
      console.error('logActualCost error', err);
      alert('Failed to log cost');
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(subscriptions, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subscriptions_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const headers = ['Company', 'Service', 'Cost', 'Billing', 'Status', 'Department', 'Category', 'Next Billing', 'Manager'];
      const rows = subscriptions.map(sub => [
        sub.company,
        sub.service,
        sub.cost,
        sub.billing,
        sub.status,
        sub.department || '',
        sub.category || '',
        sub.nextBilling || '',
        sub.manager || '',
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subscriptions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const exportFinancialReport = () => {
    const report = generateFinancialReport();
    const reportContent = {
      generatedAt: new Date().toISOString(),
      period: report.period,
      summary: {
        totalMonthlySpend: report.totalSpend,
        projectedAnnualSpend: report.projectedSpend,
        yearToDateSavings: report.savings,
        budgetUtilization: `${report.budgetUtilization}%`,
      },
      breakdowns: {
        byCompany: report.byCompany,
        byCategory: report.byCategory,
        byDepartment: report.byDepartment,
      },
      subscriptions: filteredSubscriptions.map(sub => ({
        service: sub.service,
        company: sub.company,
        monthlyCost: effectiveMonthly(sub),
        annualCost: effectiveMonthly(sub) * 12,
        department: sub.department,
        category: sub.category,
        status: sub.status,
        paymentStatus: sub.lastPaymentStatus,
      })),
    };

    const blob = new Blob([JSON.stringify(reportContent, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${report.period}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    if (!formData.service || !formData.cost) {
      alert('Please fill in required fields');
      return;
    }

    const parsedCost = parseFloat(formData.cost);
    if (Number.isNaN(parsedCost)) {
      alert('Cost must be a number');
      return;
    }

    const parsedBudget = formData.budget ? parseFloat(formData.budget) : undefined;

    try {
      if (editingId !== null) {
        await api.updateSubscription(editingId, {
          ...formData,
          cost: parsedCost,
          budget: parsedBudget,
          tags: currentTags,
        });
      } else {
        await api.createSubscription({
          ...formData,
          cost: parsedCost,
          budget: parsedBudget,
          tags: currentTags,
        });
      }

      const data = await api.getSubscriptions();
      setSubscriptions(parseSubscriptionData(data));
      resetForm();
    } catch (error) {
      console.error('Error saving subscription:', error);
      alert('Failed to save subscription. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      company: 'Kisamos',
      service: '',
      cost: '',
      billing: 'monthly',
      nextBilling: '',
      contractEnd: '',
      category: 'Software',
      manager: '',
      renewalAlert: 30,
      status: 'active',
      paymentMethod: 'Credit Card',
      tags: [],
      notes: '',
      attachments: [],
      payments: [],
      lastPaymentStatus: 'pending',
      pricingType: 'fixed',
      department: 'Engineering',
      costCenter: '',
      vendor: '',
      accountNumber: '',
      autoRenew: false,
      budget: '',
    });
    setCurrentTags([]);
    setTagInput('');
    setShowModal(false);
    setEditingId(null);
  };

  const handleEdit = (sub: Subscription) => {
    const { id: _id, cost: _ignore, attachment_count: _ac, ...rest } = sub;
    setFormData({
      ...rest,
      cost: sub.cost.toString(),
      budget: sub.budget?.toString() || '',
      pricingType: sub.pricingType || 'fixed',
    });
    setCurrentTags(sub.tags || []);
    setEditingId(sub.id);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this subscription? This action cannot be undone.')) {
      try {
        await api.deleteSubscription(id);
        const data = await api.getSubscriptions();
        setSubscriptions(parseSubscriptionData(data));
      } catch (error) {
        console.error('Error deleting subscription:', error);
        alert('Failed to delete subscription');
      }
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !currentTags.includes(tag)) {
      setCurrentTags([...currentTags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setCurrentTags(currentTags.filter(t => t !== tag));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getCompanyColor = (company: string) => {
    switch (company) {
      case 'Kisamos': return '#4F46E5';
      case 'Mizzen': return '#059669';
      case 'Fertmax': return '#7C3AED';
      case 'Shantaram': return '#F59E0B';
      case 'Relia Ship': return '#0EA5E9';
      default: return '#6B7280';
    }
  };

  /* =========================
     Render
     ========================= */

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9FAFB',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Top Nav */}
      <nav style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <span style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                SubscriptionHub Pro
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {session.user?.email && (
              <span style={{ fontSize: '14px', color: '#6B7280' }}>
                {session.user.email}
              </span>
            )}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {}}
                style={ghostBtn}
                onMouseEnter={(e) => {
                  const menu = document.getElementById('export-menu');
                  if (menu) menu.style.display = 'block';
                }}
                onMouseLeave={(e) => {
                  setTimeout(() => {
                    const menu = document.getElementById('export-menu');
                    if (menu && !menu.matches(':hover')) menu.style.display = 'none';
                  }, 100);
                }}
              >
                Export
              </button>
              <div
                id="export-menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  padding: '8px 0',
                  minWidth: '120px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  display: 'none',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.display = 'block'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.display = 'none'; }}
              >
                <button
                  onClick={() => handleExport('json')}
                  style={menuItem}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                >
                  Export JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  style={menuItem}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                >
                  Export CSV
                </button>
                <button
                  onClick={exportFinancialReport}
                  style={menuItem}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                >
                  Financial Report
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowHelpModal(true)}
              style={ghostBtn}
              onMouseEnter={hoverFill}
              onMouseLeave={hoverReset}
            >
              Help
            </button>
            <button
              style={ghostBtn}
              onMouseEnter={hoverFill}
              onMouseLeave={hoverReset}
            >
              Settings
            </button>
            <div style={{ width: '1px', height: '24px', background: '#E5E7EB' }} />
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={outlineBtn}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F9FAFB';
                (e.currentTarget.style as any).borderColor = '#D1D5DB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                (e.currentTarget.style as any).borderColor = '#E5E7EB';
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Subscription Management Dashboard
          </h1>
          <p style={{ color: '#6B7280', fontSize: '14px' }}>
            Track, manage, and optimize your business subscriptions with financial insights
          </p>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div style={cardBox(48)}>
            <Spinner />
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading subscriptions...</p>
          </div>
        ) : (
          <>
            {/* Alerts */}
            {(upcomingRenewals.length > 0 || stats.overdueCount > 0) && (
              <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {upcomingRenewals.length > 0 && (
                  <Alert
                    tone="warning"
                    title={`${upcomingRenewals.length} Upcoming Renewal${upcomingRenewals.length > 1 ? 's' : ''}`}
                    iconColor="#F59E0B"
                    bg="#FEF3C7"
                    border="#FCD34D"
                    textColor="#78350F"
                  >
                    {upcomingRenewals.map((sub, idx) => (
                      <span key={sub.id}>
                        {sub.service} ({formatDate(sub.nextBilling)})
                        {idx < upcomingRenewals.length - 1 ? ' • ' : ''}
                      </span>
                    ))}
                  </Alert>
                )}

                {stats.overdueCount > 0 && (
                  <Alert
                    tone="danger"
                    title={`${stats.overdueCount} Overdue Payment${stats.overdueCount > 1 ? 's' : ''}`}
                    iconColor="#DC2626"
                    bg="#FEE2E2"
                    border="#FCA5A5"
                    textColor="#7F1D1D"
                  >
                    Review and process overdue payments to avoid service disruptions
                  </Alert>
                )}
              </div>
            )}

            {/* Enhanced Metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
              marginBottom: '32px'
            }}>
              <MetricCard
                label="Monthly Spend"
                value={formatCurrency(parseFloat(stats.monthly))}
                trend="+12.5%"
                trendUp
                icon={<IconMoney />}
              />
              <MetricCard
                label="Annual Projection"
                value={formatCurrency(parseFloat(stats.yearly))}
                sublabel={`Budget: ${formatCurrency(parseFloat(stats.totalBudget))}`}
                icon={<IconCalendarMoney />}
              />
              <MetricCard
                label="Budget Utilization"
                value={`${stats.budgetUtilization}%`}
                sublabel="of allocated budget"
                alert={parseFloat(stats.budgetUtilization) > 90}
                icon={<IconBudget />}
              />
              <MetricCard
                label="YTD Savings"
                value={formatCurrency(parseFloat(stats.savings))}
                sublabel="from cancelled services"
                icon={<IconSavings />}
              />
              <MetricCard
                label="Active Subscriptions"
                value={stats.active.toString()}
                sublabel={`of ${stats.total} total`}
                icon={<IconActive />}
              />
              <MetricCard
                label="Vendors"
                value={stats.vendors.toString()}
                sublabel="unique providers"
                icon={<IconVendors />}
              />
              <MetricCard
                label="Payment Status"
                value={`${stats.paidCount}/${stats.total}`}
                sublabel="paid this period"
                alert={stats.overdueCount > 0}
                icon={<IconPayment />}
              />
              <MetricCard
                label="Departments"
                value={departmentMetrics.length.toString()}
                sublabel="active departments"
                icon={<IconDepartment />}
              />
            </div>

            {/* Controls */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', gap: '12px', flex: '1', flexWrap: 'wrap', minWidth: '0' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
                  <IconSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search subscriptions..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#4F46E5'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
                  />
                </div>

                {/* Filters */}
                <select
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value as 'all' | Company)}
                  style={selectStyle}
                >
                  <option value="all">All Companies</option>
                  {COMPANIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  style={selectStyle}
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  style={selectStyle}
                >
                  <option value="all">All Departments</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <select
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value as any)}
                  style={selectStyle}
                >
                  <option value="all">All Payments</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* View Toggle */}
                <div style={{
                  display: 'flex',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  overflow: 'hidden'
                }}>
                  <ViewToggleButton
                    active={viewMode === 'grid'}
                    onClick={() => setViewMode('grid')}
                    first
                  >
                    <IconGrid />
                  </ViewToggleButton>
                  <ViewToggleButton
                    active={viewMode === 'table'}
                    onClick={() => setViewMode('table')}
                  >
                    <IconTable />
                  </ViewToggleButton>
                  <ViewToggleButton
                    active={viewMode === 'analytics'}
                    onClick={() => setViewMode('analytics')}
                  >
                    <IconBars />
                  </ViewToggleButton>
                  <ViewToggleButton
                    active={viewMode === 'reports'}
                    onClick={() => setViewMode('reports')}
                    last
                  >
                    <IconReport />
                  </ViewToggleButton>
                </div>

                {/* Actions */}
                <button
                  onClick={() => setShowFinancialReportModal(true)}
                  style={outlineBtn}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#F9FAFB';
                    (e.currentTarget.style as any).borderColor = '#D1D5DB';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    (e.currentTarget.style as any).borderColor = '#E5E7EB';
                  }}
                >
                  <IconReport />
                  Reports
                </button>

                {/* Add */}
                <button
                  onClick={() => setShowModal(true)}
                  style={primaryBtn}
                  onMouseEnter={e => e.currentTarget.style.background = '#4338CA'}
                  onMouseLeave={e => e.currentTarget.style.background = '#4F46E5'}
                >
                  <IconPlus />
                  Add Subscription
                </button>
              </div>
            </div>

            {/* Content */}
            {filteredSubscriptions.length === 0 ? (
              <EmptyState onAddClick={() => setShowModal(true)} />
            ) : viewMode === 'grid' ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '20px'
              }}>
                {filteredSubscriptions.map(sub => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    onEdit={() => handleEdit(sub)}
                    onDelete={() => handleDelete(sub.id)}
                    onViewDocuments={() => {
                      setSelectedSubscription(sub);
                      setShowDocumentsModal(true);
                    }}
                    onViewPaymentHistory={() => {
                      setSelectedSubscription(sub);
                      setShowPaymentHistoryModal(true);
                    }}
                    onMarkPaid={() => markAsPaid(sub.id)}
                    onLogCost={() => logActualCost(sub.id)}
                    onUpload={(e: ChangeEvent<HTMLInputElement>) => handleFileUpload(e, sub.id)}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getCompanyColor={getCompanyColor}
                    displayAmount={sub.pricingType === 'variable' && typeof sub.currentMonthCost === 'number'
                      ? sub.currentMonthCost
                      : sub.cost}
                  />
                ))}
              </div>
            ) : viewMode === 'table' ? (
              <TableView
                subscriptions={filteredSubscriptions}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMarkPaid={markAsPaid}
                onLogCost={logActualCost}
                onUpload={handleFileUpload}
                onViewDocuments={(sub: Subscription) => {
                  setSelectedSubscription(sub);
                  setShowDocumentsModal(true);
                }}
                onViewPaymentHistory={(sub: Subscription) => {
                  setSelectedSubscription(sub);
                  setShowPaymentHistoryModal(true);
                }}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                getCompanyColor={getCompanyColor}
              />
            ) : viewMode === 'analytics' ? (
              <AnalyticsView
                subscriptions={filteredSubscriptions}
                departmentMetrics={departmentMetrics}
                formatCurrency={formatCurrency}
              />
            ) : (
              <ReportsView
                subscriptions={filteredSubscriptions}
                generateReport={generateFinancialReport}
                formatCurrency={formatCurrency}
                onExportReport={exportFinancialReport}
              />
            )}
          </>
        )}

        {/* Modals */}
        {showModal && (
          <FormModal
            editingId={editingId}
            formData={formData}
            setFormData={setFormData}
            currentTags={currentTags}
            tagInput={tagInput}
            setTagInput={setTagInput}
            onSubmit={handleSubmit}
            onClose={resetForm}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onFileUpload={handleFileUpload}
            formatFileSize={formatFileSize}
            COMPANIES={COMPANIES}
            CATEGORIES={CATEGORIES}
            DEPARTMENTS={DEPARTMENTS}
            PAYMENT_METHODS={PAYMENT_METHODS}
          />
        )}

        {showDocumentsModal && selectedSubscription && (
          <DocumentsModal
            subscription={selectedSubscription}
            onClose={() => {
              setShowDocumentsModal(false);
              setSelectedSubscription(null);
            }}
            onUpload={(e: ChangeEvent<HTMLInputElement>) => {
              handleFileUpload(e, selectedSubscription.id);
              const updated = subscriptions.find(s => s.id === selectedSubscription.id);
              if (updated) setSelectedSubscription(updated);
            }}
            onDownload={downloadFile}
            formatDate={formatDate}
            formatFileSize={formatFileSize}
          />
        )}

        {showPaymentHistoryModal && selectedSubscription && (
          <PaymentHistoryModal
            subscription={selectedSubscription}
            payments={getPaymentHistory(selectedSubscription.id)}
            onClose={() => {
              setShowPaymentHistoryModal(false);
              setSelectedSubscription(null);
            }}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
          />
        )}

        {showFinancialReportModal && (
          <FinancialReportModal
            report={generateFinancialReport()}
            onClose={() => setShowFinancialReportModal(false)}
            onExport={exportFinancialReport}
            formatCurrency={formatCurrency}
          />
        )}

        {showHelpModal && (
          <div
            style={backdrop}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowHelpModal(false);
            }}
          >
            <div style={modalBox(800)}>
              <ModalHeader title="Enhanced Features Guide" onClose={() => setShowHelpModal(false)} />
              <div style={{ padding: '24px', maxHeight: '60vh', overflow: 'auto' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#5B21B6', marginBottom: '8px' }}>
                    🎯 Complete Financial Management
                  </h3>
                  <p style={{ fontSize: '14px', color: '#6D28D9', margin: 0 }}>
                    Track subscriptions with department allocation, budget management, and comprehensive financial reporting.
                  </p>
                </div>

                <div style={{ display: 'grid', gap: '16px' }}>
                  <FeatureCard
                    icon="📊"
                    title="Financial Reports"
                    description="Generate monthly, quarterly, and yearly financial reports with breakdowns by company, category, and department."
                  />
                  <FeatureCard
                    icon="💰"
                    title="Budget Tracking"
                    description="Set and monitor budgets for each subscription and department. Get alerts when approaching limits."
                  />
                  <FeatureCard
                    icon="📜"
                    title="Payment History"
                    description="View complete payment history for each subscription with invoice numbers and payment references."
                  />
                  <FeatureCard
                    icon="🏢"
                    title="Department Management"
                    description="Allocate subscriptions to departments and track spending by cost center."
                  />
                  <FeatureCard
                    icon="📈"
                    title="Analytics Dashboard"
                    description="Visualize spending trends, vendor analysis, and department utilization."
                  />
                  <FeatureCard
                    icon="📁"
                    title="Export Options"
                    description="Export data in JSON, CSV, or generate comprehensive financial reports."
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   Small UI Helpers
   ========================= */

const Spinner = () => (
  <div>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid #E5E7EB',
      borderTop: '3px solid #4F46E5',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto 16px'
    }} />
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

const Alert = ({
  tone,
  title,
  children,
  bg,
  border,
  iconColor,
  textColor,
}: {
  tone: 'warning' | 'danger';
  title: string;
  children: React.ReactNode;
  bg: string;
  border: string;
  iconColor: string;
  textColor: string;
}) => (
  <div style={{
    padding: '16px',
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: '8px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start'
  }}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill={iconColor}>
      {tone === 'warning' ? (
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      ) : (
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      )}
    </svg>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: '600', color: textColor, marginBottom: '4px' }}>
        {title}
      </div>
      <div style={{ fontSize: '14px', color: textColor }}>
        {children}
      </div>
    </div>
  </div>
);

/* =========================
   Icons
   ========================= */

const IconSearch = (props: any) => (
  <svg {...props} width="16" height="16" viewBox="0 0 20 20" fill="#9CA3AF">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);

const IconMoney = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
  </svg>
);

const IconCalendarMoney = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
  </svg>
);

const IconBudget = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

const IconSavings = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
  </svg>
);

const IconActive = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2a1 1 0 100 2 2 2 0 002 2v1a1 1 0 11-2 0v-1H6v1a1 1 0 11-2 0v-1a2 2 0 01-2-2V5z" clipRule="evenodd" />
  </svg>
);

const IconVendors = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
  </svg>
);

const IconPayment = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
  </svg>
);

const IconDepartment = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
  </svg>
);

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
  </svg>
);

const IconTable = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
  </svg>
);

const IconBars = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
  </svg>
);

const IconReport = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ marginRight: 6 }}>
    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" />
  </svg>
);

const IconBarsLarge = () => (
  <svg width="64" height="64" viewBox="0 0 20 20" fill="#E5E7EB" style={{ margin: '0 auto 16px' }}>
    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
  </svg>
);

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ marginRight: 6 }}>
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

/* =========================
   Buttons & Styles
   ========================= */

const menuItem: React.CSSProperties = {
  width: '100%',
  padding: '8px 16px',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  fontSize: '14px',
  color: '#374151',
  cursor: 'pointer',
  transition: 'background 0.2s',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: 'none',
  color: '#6B7280',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  borderRadius: '6px',
  transition: 'all 0.2s'
};

const outlineBtn: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid #E5E7EB',
  color: '#374151',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  borderRadius: '6px',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const primaryBtn: React.CSSProperties = {
  padding: '8px 16px',
  background: '#4F46E5',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'background 0.2s'
};

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  fontSize: '14px',
  background: '#FFFFFF',
  cursor: 'pointer',
  minWidth: '120px',
  outline: 'none',
};

const hoverFill = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = '#F3F4F6';
};
const hoverReset = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'transparent';
};

const fullHeightCenter = (bg: string): React.CSSProperties => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: bg,
});

const cardBox = (pad: number): React.CSSProperties => ({
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: `${pad}px`,
  textAlign: 'center'
});

const backdrop: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1000
};

const modalBox = (maxWidth: number): React.CSSProperties => ({
  background: '#FFFFFF',
  borderRadius: '12px',
  width: '100%',
  maxWidth: `${maxWidth}px`,
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
});

/* =========================
   Reusable Pieces
   ========================= */

const ModalHeader = ({ title, onClose }: { title: string; onClose: () => void }) => (
  <div style={{
    padding: '24px',
    borderBottom: '1px solid #E5E7EB',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }}>
    <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: 0 }}>
      {title}
    </h2>
    <button onClick={onClose} style={{
      width: '32px',
      height: '32px',
      border: 'none',
      background: '#F3F4F6',
      borderRadius: '6px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6B7280'
    }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </button>
  </div>
);

/* =========================
   Metric Card
   ========================= */

const MetricCard = ({ label, value, sublabel, trend, trendUp, alert, icon }: any) => (
  <div style={{
    background: '#FFFFFF',
    border: alert ? '1px solid #FCA5A5' : '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '20px',
    position: 'relative',
    transition: 'all 0.2s'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
      <div style={{
        width: '40px',
        height: '40px',
        background: alert ? '#FEE2E2' : '#F3F4F6',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: alert ? '#DC2626' : '#6B7280'
      }}>
        {icon}
      </div>
      {trend && (
        <span style={{
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500',
          background: trendUp ? '#D1FAE5' : '#FEE2E2',
          color: trendUp ? '#065F46' : '#991B1B',
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}>
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      )}
    </div>
    <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
      {value}
    </div>
    <div style={{ fontSize: '14px', color: '#6B7280' }}>
      {label}
    </div>
    {sublabel && (
      <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
        {sublabel}
      </div>
    )}
  </div>
);

/* =========================
   View Toggle Button
   ========================= */

const ViewToggleButton = ({ active, onClick, children, first, last }: any) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 10px',
      background: active ? '#F3F4F6' : '#FFFFFF',
      color: active ? '#4F46E5' : '#6B7280',
      border: 'none',
      borderLeft: !first ? '1px solid #E5E7EB' : 'none',
      fontSize: '14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      transition: 'all 0.2s'
    }}>
    {children}
  </button>
);

/* =========================
   Empty State
   ========================= */

const EmptyState = ({ onAddClick }: any) => (
  <div style={cardBox(48)}>
    <svg width="64" height="64" viewBox="0 0 20 20" fill="#E5E7EB" style={{ margin: '0 auto 16px' }}>
      <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
    </svg>
    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
      No subscriptions found
    </h3>
    <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
      Get started by adding your first subscription to begin tracking
    </p>
    <button
      onClick={onAddClick}
      style={primaryBtn}
      onMouseEnter={e => e.currentTarget.style.background = '#4338CA'}
      onMouseLeave={e => e.currentTarget.style.background = '#4F46E5'}
    >
      <IconPlus />
      Add Your First Subscription
    </button>
  </div>
);

/* =========================
   Feature Card (for Help Modal)
   ========================= */

const FeatureCard = ({ icon, title, description }: any) => (
  <div style={{
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#F9FAFB',
    borderRadius: '6px'
  }}>
    <div style={{ fontSize: '24px' }}>{icon}</div>
    <div>
      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
        {title}
      </h4>
      <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
        {description}
      </p>
    </div>
  </div>
);

/* =========================
   Analytics View Component
   ========================= */

const AnalyticsView = ({ subscriptions, departmentMetrics, formatCurrency }: any) => (
  <div style={cardBox(48)}>
    <IconBarsLarge />
    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
      Analytics Dashboard
    </h3>
    <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
      Comprehensive analytics showing department spending, vendor analysis, and trends
    </p>
    <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
      (Import the full AnalyticsView component from financial-components.tsx)
    </p>
  </div>
);

/* =========================
   Reports View Component
   ========================= */

const ReportsView = ({ subscriptions, generateReport, formatCurrency, onExportReport }: any) => (
  <div style={cardBox(48)}>
    <IconReport />
    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
      Financial Reports
    </h3>
    <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
      Generate and export comprehensive financial reports for accounting
    </p>
    <button
      onClick={onExportReport}
      style={primaryBtn}
      onMouseEnter={e => e.currentTarget.style.background = '#4338CA'}
      onMouseLeave={e => e.currentTarget.style.background = '#4F46E5'}
    >
      Export Financial Report
    </button>
  </div>
);

/* =========================
   Subscription Card - ENHANCED (Part 1)
   ========================= */

const SubscriptionCard = ({
  subscription: sub,
  onEdit,
  onDelete,
  onViewDocuments,
  onViewPaymentHistory,
  onMarkPaid,
  onLogCost,
  onUpload,
  formatCurrency,
  formatDate,
  getCompanyColor,
  displayAmount
}: any) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#D1FAE5', text: '#065F46' };
      case 'pending': return { bg: '#FEF3C7', text: '#78350F' };
      case 'cancelled': return { bg: '#FEE2E2', text: '#991B1B' };
      default: return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };
  const getPaymentStatusColor = (status?: string) => {
    switch (status) {
      case 'paid': return { bg: '#D1FAE5', text: '#065F46' };
      case 'pending': return { bg: '#FEF3C7', text: '#78350F' };
      case 'overdue': return { bg: '#FEE2E2', text: '#991B1B' };
      default: return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  const statusColors = getStatusColor(sub.status);
  const paymentColors = getPaymentStatusColor(sub.lastPaymentStatus);

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: sub.lastPaymentStatus === 'overdue' ? '1px solid #FCA5A5' : '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '20px',
        transition: 'all 0.2s',
        position: 'relative'
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getCompanyColor(sub.company)
              }} />
              <span style={{ fontSize: '12px', fontWeight: '500', color: '#6B7280' }}>
                {sub.company} {sub.department && `• ${sub.department}`}
              </span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
              {sub.service}
            </h3>
            {sub.vendor && (
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                Vendor: {sub.vendor}
              </div>
            )}
            {sub.tags && sub.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {sub.tags.map((tag: string) => (
                  <span key={tag} style={{
                    padding: '2px 8px',
                    background: '#F3F4F6',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#6B7280'
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
            <span style={badge(statusColors)}>{sub.status.toUpperCase()}</span>
            <span style={badge(paymentColors)}>{(sub.lastPaymentStatus || 'pending').toUpperCase()}</span>
            {sub.autoRenew && (
              <span style={badge({ bg: '#E0E7FF', text: '#3730A3' })}>AUTO-RENEW</span>
            )}
          </div>
        </div>
      </div>

      {/* Cost with Budget */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
          {formatCurrency(displayAmount)}
          <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: '400' }}>
            /{sub.billing === 'monthly' ? 'mo' : sub.billing === 'yearly' ? 'yr' : 'qtr'}
          </span>
        </div>
        {sub.budget && (
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
            Budget: {formatCurrency(sub.budget)}/yr
          </div>
        )}
      </div>

      {/* Details */}
      <div style={{ marginBottom: '16px', display: 'grid', gap: '8px' }}>
        <DetailRow label="Next Billing" value={formatDate(sub.nextBilling)} />
        <DetailRow label="Category" value={sub.category} />
        {sub.manager && <DetailRow label="Manager" value={sub.manager} />}
        {sub.accountNumber && <DetailRow label="Account #" value={sub.accountNumber} />}
        <DetailRow label="Documents" value={`${sub.attachments?.length ?? sub.attachment_count ?? 0} files`} />
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        <ActionButton onClick={onEdit} primary>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
          Edit
        </ActionButton>

        <ActionButton onClick={onViewDocuments}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clipRule="evenodd" />
          </svg>
          Documents
        </ActionButton>

        <ActionButton onClick={onViewPaymentHistory}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
          History
        </ActionButton>

        {sub.lastPaymentStatus !== 'paid' && (
          <ActionButton onClick={onMarkPaid} success>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Mark Paid
          </ActionButton>
        )}

        <ActionButton onClick={onLogCost}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 3a1 1 0 000 2h12a1 1 0 100-2H4zM3 8a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 4a1 1 0 000 2h12a1 1 0 100-2H4zm-1 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
          </svg>
          Log Cost
        </ActionButton>

        <label style={uploadBtn}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#F9FAFB';
            (e.currentTarget.style as any).borderColor = '#D1D5DB';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#FFFFFF';
            (e.currentTarget.style as any).borderColor = '#E5E7EB';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Upload
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={onUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
        </label>
      </div>
    </div>
  );
};

const badge = (c: { bg: string; text: string }): React.CSSProperties => ({
  padding: '2px 8px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: '500',
  background: c.bg,
  color: c.text
});

const uploadBtn: React.CSSProperties = {
  padding: '6px',
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: '500',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  color: '#6B7280',
  background: '#FFFFFF',
  transition: 'all 0.2s'
};

/* =========================
   Detail Row
   ========================= */

const DetailRow = ({ label, value }: any) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: '12px', color: '#6B7280' }}>{label}</span>
    <span style={{ fontSize: '12px', fontWeight: '500', color: '#111827' }}>{value}</span>
  </div>
);

/* =========================
   Action Button
   ========================= */

const ActionButton = ({ onClick, children, primary, success, danger }: any) => {
  let baseColor = '#6B7280';
  let hoverColor = '#4B5563';
  let bgColor = '#FFFFFF';
  let hoverBg = '#F9FAFB';

  if (primary) { baseColor = '#4F46E5'; hoverColor = '#4338CA'; }
  else if (success) { baseColor = '#059669'; hoverColor = '#047857'; }
  else if (danger) { baseColor = '#DC2626'; hoverColor = '#B91C1C'; }

  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px',
        border: '1px solid #E5E7EB',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        color: baseColor,
        background: bgColor,
        transition: 'all 0.2s'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = hoverBg;
        (e.currentTarget.style as any).borderColor = '#D1D5DB';
        e.currentTarget.style.color = hoverColor;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = bgColor;
        (e.currentTarget.style as any).borderColor = '#E5E7EB';
        e.currentTarget.style.color = baseColor;
      }}
    >
      {children}
    </button>
  );
};

/* =========================
   Table View - ENHANCED (Part 2)
   ========================= */

const TableView = ({
  subscriptions,
  onEdit,
  onDelete,
  onMarkPaid,
  onLogCost,
  onUpload,
  onViewDocuments,
  onViewPaymentHistory,
  formatCurrency,
  formatDate,
  getCompanyColor
}: any) => (
  <div style={{
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    overflow: 'hidden'
  }}>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            <th style={th}>Company</th>
            <th style={th}>Service</th>
            <th style={th}>Department</th>
            <th style={th}>Cost</th>
            <th style={th}>Budget</th>
            <th style={th}>Status</th>
            <th style={th}>Payment</th>
            <th style={th}>Next Billing</th>
            <th style={th}>Manager</th>
            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub: Subscription, idx: number) => {
            const displayAmount =
              sub.pricingType === 'variable' && typeof sub.currentMonthCost === 'number'
                ? sub.currentMonthCost
                : sub.cost;

            return (
              <tr
                key={sub.id}
                style={{
                  borderBottom: idx !== subscriptions.length - 1 ? '1px solid #E5E7EB' : 'none',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
              >
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: getCompanyColor(sub.company)
                    }} />
                    <span style={{ fontSize: '14px', color: '#111827' }}>{sub.company}</span>
                  </div>
                </td>
                <td style={td}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#111827', marginBottom: '4px' }}>{sub.service}</div>
                    {sub.tags && sub.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {sub.tags.map((tag: string) => (
                          <span key={tag} style={tagPill}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ ...td, fontSize: '14px', color: '#6B7280' }}>
                  {sub.department || '-'}
                </td>
                <td style={td}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {formatCurrency(displayAmount)}
                    <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '400' }}>
                      /{sub.billing === 'monthly' ? 'mo' : sub.billing === 'yearly' ? 'yr' : 'qtr'}
                    </span>
                  </div>
                </td>
                <td style={{ ...td, fontSize: '14px', color: '#6B7280' }}>
                  {sub.budget ? formatCurrency(sub.budget) : '-'}
                </td>
                <td style={td}>
                  <StatusBadge status={sub.status} />
                </td>
                <td style={td}>
                  <PaymentStatusBadge status={sub.lastPaymentStatus} />
                </td>
                <td style={{ ...td, fontSize: '14px', color: '#6B7280' }}>
                  {formatDate(sub.nextBilling)}
                </td>
                <td style={{ ...td, fontSize: '14px', color: '#6B7280' }}>
                  {sub.manager || '-'}
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    <TableActionButton onClick={() => onEdit(sub)} title="Edit">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </TableActionButton>
                    <TableActionButton onClick={() => onViewDocuments(sub)} title="Documents">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clipRule="evenodd" />
                      </svg>
                    </TableActionButton>
                    <TableActionButton onClick={() => onViewPaymentHistory(sub)} title="Payment History">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                      </svg>
                    </TableActionButton>
                    <TableActionButton onClick={() => onLogCost(sub.id)} title="Log Cost">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4 3a1 1 0 000 2h12a1 1 0 100-2H4zM3 8a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 4a1 1 0 000 2h12a1 1 0 100-2H4zm-1 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                      </svg>
                    </TableActionButton>
                    {sub.lastPaymentStatus !== 'paid' && (
                      <TableActionButton onClick={() => onMarkPaid(sub.id)} title="Mark as Paid">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </TableActionButton>
                    )}
                    <TableActionButton onClick={() => onDelete(sub.id)} title="Delete" danger>
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-1 1v1H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-2V3a1 1 0 00-1-1H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </TableActionButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const th: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  color: '#374151'
};
const td: React.CSSProperties = { padding: '12px 16px' };
const tagPill: React.CSSProperties = {
  padding: '1px 6px',
  background: '#F3F4F6',
  borderRadius: '10px',
  fontSize: '10px',
  color: '#6B7280'
};

const TableActionButton = ({ onClick, title, children, danger }: any) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      padding: '4px',
      border: 'none',
      background: 'transparent',
      borderRadius: '4px',
      cursor: 'pointer',
      color: danger ? '#DC2626' : '#6B7280',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = danger ? '#FEE2E2' : '#F3F4F6';
      e.currentTarget.style.color = danger ? '#B91C1C' : '#4B5563';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = danger ? '#DC2626' : '#6B7280';
    }}>
    {children}
  </button>
);

/* =========================
   Badges
   ========================= */

const StatusBadge = ({ status }: any) => {
  const getColors = () => {
    switch (status) {
      case 'active': return { bg: '#D1FAE5', text: '#065F46' };
      case 'pending': return { bg: '#FEF3C7', text: '#78350F' };
      case 'cancelled': return { bg: '#FEE2E2', text: '#991B1B' };
      default: return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };
  const colors = getColors();
  return <span style={badge(colors)}>{status.toUpperCase()}</span>;
};

const PaymentStatusBadge = ({ status }: any) => {
  const getColors = () => {
    switch (status) {
      case 'paid': return { bg: '#D1FAE5', text: '#065F46' };
      case 'pending': return { bg: '#FEF3C7', text: '#78350F' };
      case 'overdue': return { bg: '#FEE2E2', text: '#991B1B' };
      default: return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };
  const colors = getColors();
  return <span style={badge(colors)}>{(status || 'pending').toUpperCase()}</span>;
};

/* =========================
   Form Modal - ENHANCED (Part 3)
   ========================= */

const FormModal = ({
  editingId, formData, setFormData,
  currentTags, tagInput, setTagInput,
  onSubmit, onClose, onAddTag, onRemoveTag,
  onFileUpload, formatFileSize, COMPANIES, CATEGORIES, DEPARTMENTS, PAYMENT_METHODS
}: any) => (
  <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={modalBox(700)}>
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: 0 }}>
          {editingId !== null ? 'Edit Subscription' : 'Add New Subscription'}
        </h2>
        <button onClick={onClose} style={{
          width: '32px',
          height: '32px',
          border: 'none',
          background: '#F3F4F6',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6B7280'
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ padding: '24px', maxHeight: '60vh', overflow: 'auto' }}>
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Basic Information */}
          <div style={{
            background: '#F9FAFB',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '8px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: '0 0 12px 0' }}>
              Basic Information
            </h3>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Company *">
                  <select
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value as any })}
                    style={inputStyle}
                    required
                  >
                    {COMPANIES.map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Department">
                  <select
                    value={formData.department || ''}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map((d: string) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Service Name *">
                <input
                  type="text"
                  value={formData.service}
                  onChange={e => setFormData({ ...formData, service: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g., Microsoft 365, Azure, Salesforce"
                  required
                />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Vendor">
                  <input
                    type="text"
                    value={formData.vendor || ''}
                    onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g., Microsoft, Amazon"
                  />
                </FormField>

                <FormField label="Account Number">
                  <input
                    type="text"
                    value={formData.accountNumber || ''}
                    onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g., ACC-12345"
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div style={{
            background: '#F9FAFB',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '8px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: '0 0 12px 0' }}>
              Financial Information
            </h3>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <FormField label="Cost *">
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                    style={inputStyle}
                    placeholder="0.00"
                    step="0.01"
                    required
                  />
                </FormField>

                <FormField label="Billing Cycle">
                  <select
                    value={formData.billing}
                    onChange={e => setFormData({ ...formData, billing: e.target.value as any })}
                    style={inputStyle}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </FormField>

                <FormField label="Annual Budget">
                  <input
                    type="number"
                    value={formData.budget || ''}
                    onChange={e => setFormData({ ...formData, budget: e.target.value })}
                    style={inputStyle}
                    placeholder="0.00"
                    step="0.01"
                  />
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Pricing Type">
                  <select
                    value={formData.pricingType || 'fixed'}
                    onChange={e => setFormData({ ...formData, pricingType: e.target.value as 'fixed' | 'variable' })}
                    style={inputStyle}
                  >
                    <option value="fixed">Fixed</option>
                    <option value="variable">Variable (usage/consumption)</option>
                  </select>
                </FormField>

                <FormField label="Payment Method">
                  <select
                    value={formData.paymentMethod}
                    onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                    style={inputStyle}
                  >
                    {PAYMENT_METHODS.map((m: string) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Cost Center">
                <input
                  type="text"
                  value={formData.costCenter || ''}
                  onChange={e => setFormData({ ...formData, costCenter: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g., CC-001"
                />
              </FormField>
            </div>
          </div>

          {/* Contract Information */}
          <div style={{
            background: '#F9FAFB',
            padding: '12px',
            borderRadius: '6px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', margin: '0 0 12px 0' }}>
              Contract Information
            </h3>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Category">
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    style={inputStyle}
                  >
                    {CATEGORIES.map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Status">
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    style={inputStyle}
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Next Billing Date">
                  <input
                    type="date"
                    value={formData.nextBilling}
                    onChange={e => setFormData({ ...formData, nextBilling: e.target.value })}
                    style={inputStyle}
                  />
                </FormField>

                <FormField label="Contract End Date">
                  <input
                    type="date"
                    value={formData.contractEnd}
                    onChange={e => setFormData({ ...formData, contractEnd: e.target.value })}
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Manager">
                  <input
                    type="text"
                    value={formData.manager}
                    onChange={e => setFormData({ ...formData, manager: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g., John Smith"
                  />
                </FormField>

                <FormField label="Renewal Alert (days)">
                  <input
                    type="number"
                    value={formData.renewalAlert}
                    onChange={e => setFormData({ ...formData, renewalAlert: parseInt(e.target.value) || 30 })}
                    style={inputStyle}
                    min={1}
                    max={90}
                  />
                </FormField>
              </div>

              <FormField label="Auto-Renew">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.autoRenew || false}
                    onChange={e => setFormData({ ...formData, autoRenew: e.target.checked })}
                  />
                  <span style={{ fontSize: '14px', color: '#374151' }}>
                    This subscription auto-renews
                  </span>
                </label>
              </FormField>
            </div>
          </div>

          {/* Additional Information */}
          <FormField label="Tags">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), onAddTag())}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Add a tag..."
              />
              <button
                type="button"
                onClick={onAddTag}
                style={primaryBtn}
                onMouseEnter={e => e.currentTarget.style.background = '#4338CA'}
                onMouseLeave={e => e.currentTarget.style.background = '#4F46E5'}
              >
                Add
              </button>
            </div>
            {currentTags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {currentTags.map((tag: string) => (
                  <span key={tag} style={{
                    padding: '4px 8px',
                    background: '#F3F4F6',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#374151',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => onRemoveTag(tag)}
                      style={{
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: '#6B7280',
                        display: 'flex'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </FormField>
          <FormField label="Notes">
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              placeholder="Additional information..."
            />
          </FormField>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #E5E7EB'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #E5E7EB',
              background: '#FFFFFF',
              color: '#374151',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ ...primaryBtn, flex: 1, padding: '10px' }}
            onMouseEnter={e => e.currentTarget.style.background = '#4338CA'}
            onMouseLeave={e => e.currentTarget.style.background = '#4F46E5'}
          >
            {editingId !== null ? 'Update Subscription' : 'Add Subscription'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

/* =========================
   Documents Modal
   ========================= */

const DocumentsModal = ({ subscription, onClose, onUpload, onDownload, formatDate, formatFileSize }: any) => (
  <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={modalBox(600)}>
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
            Documents & Files
          </h2>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
            {subscription.service}
          </p>
        </div>
        <button onClick={onClose} style={{
          width: '32px',
          height: '32px',
          border: 'none',
          background: '#F3F4F6',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6B7280'
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '24px' }}>
        <label
          style={{
            display: 'block',
            padding: '32px',
            border: '2px dashed #E5E7EB',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: '24px',
            transition: 'all 0.2s',
            background: '#F9FAFB'
          } as React.CSSProperties}
          onMouseEnter={e => {
            (e.currentTarget.style as any).borderColor = '#4F46E5';
            e.currentTarget.style.background = '#F5F3FF';
          }}
          onMouseLeave={e => {
            (e.currentTarget.style as any).borderColor = '#E5E7EB';
            e.currentTarget.style.background = '#F9FAFB';
          }}
        >
          <svg width="48" height="48" viewBox="0 0 20 20" fill="#9CA3AF" style={{ margin: '0 auto 12px' }}>
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
            Click to upload or drag and drop
          </div>
          <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
            PDF, DOC, DOCX, JPG, PNG up to 10MB
          </div>
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={onUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
        </label>

        {subscription.attachments && subscription.attachments.length > 0 ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {subscription.attachments.map((file: any) => (
              <div key={file.id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                gap: '12px',
                background: '#FFFFFF'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: file.type === 'contract' ? '#EDE9FE' : file.type === 'invoice' ? '#DBEAFE' : '#F3F4F6',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill={file.type === 'contract' ? '#7C3AED' : file.type === 'invoice' ? '#2563EB' : '#6B7280'}>
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginBottom: '2px' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {formatFileSize(file.size)} • {formatDate(file.uploadDate)}
                  </div>
                </div>
                <button
                  onClick={() => onDownload(file)}
                  style={{
                    padding: '6px',
                    border: 'none',
                    background: '#F3F4F6',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: '#6B7280',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#E5E7EB';
                    e.currentTarget.style.color = '#4B5563';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#F3F4F6';
                    e.currentTarget.style.color = '#6B7280';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '24px',
            color: '#9CA3AF',
            fontSize: '14px'
          }}>
            No documents uploaded yet
          </div>
        )}
      </div>
    </div>
  </div>
);

/* =========================
   Payment History Modal
   ========================= */

const PaymentHistoryModal = ({ 
  subscription, 
  payments, 
  onClose, 
  formatDate, 
  formatCurrency 
}: any) => (
  <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={modalBox(700)}>
      <ModalHeader title={`Payment History - ${subscription.service}`} onClose={onClose} />
      
      <div style={{ padding: '24px' }}>
        {/* Summary */}
        <div style={{
          background: '#F9FAFB',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Total Payments</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
              {payments.length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Total Paid</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
              {formatCurrency(payments.reduce((sum: number, p: any) => sum + p.amount, 0))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Last Payment</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
              {payments.length > 0 ? formatDate(payments[0].date) : 'No payments'}
            </div>
          </div>
        </div>

        {/* Payment List */}
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {payments.length > 0 ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              {payments.map((payment: any, idx: number) => {
                const statusColors = {
                  paid: { bg: '#D1FAE5', text: '#065F46' },
                  pending: { bg: '#FEF3C7', text: '#78350F' },
                  overdue: { bg: '#FEE2E2', text: '#991B1B' }
                };
                const colors = statusColors[payment.status as keyof typeof statusColors] || statusColors.pending;

                return (
                  <div key={payment.id || idx} style={{
                    padding: '16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    background: '#FFFFFF'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                          {formatCurrency(payment.amount)}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6B7280' }}>
                          {formatDate(payment.date)}
                        </div>
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        background: colors.bg,
                        color: colors.text
                      }}>
                        {payment.status.toUpperCase()}
                      </span>
                    </div>
                    {payment.invoiceNumber && (
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        Invoice: {payment.invoiceNumber}
                      </div>
                    )}
                    {payment.reference && (
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        Reference: {payment.reference}
                      </div>
                    )}
                    {payment.method && (
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        Method: {payment.method}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '48px',
              color: '#9CA3AF',
              fontSize: '14px'
            }}>
              No payment history available
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

/* =========================
   Financial Report Modal
   ========================= */

const FinancialReportModal = ({ 
  report, 
  onClose, 
  onExport, 
  formatCurrency 
}: any) => (
  <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={modalBox(900)}>
      <ModalHeader title="Financial Report Summary" onClose={onClose} />
      
      <div style={{ padding: '24px' }}>
        {/* Report Period */}
        <div style={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          borderRadius: '8px',
          padding: '20px',
          color: '#FFFFFF',
          marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
            Financial Report - {new Date(report.period).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <p style={{ opacity: 0.9, fontSize: '14px' }}>
            Generated on {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Key Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <MetricBox
            label="Total Monthly Spend"
            value={formatCurrency(report.totalSpend)}
            icon="💰"
          />
          <MetricBox
            label="Projected Annual"
            value={formatCurrency(report.projectedSpend)}
            icon="📈"
          />
          <MetricBox
            label="YTD Savings"
            value={formatCurrency(report.savings)}
            icon="💵"
          />
          <MetricBox
            label="Budget Utilization"
            value={`${report.budgetUtilization}%`}
            icon="📊"
          />
        </div>

        {/* Breakdown Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <ChartCard
            title="By Company"
            data={report.byCompany}
            labelKey="company"
            valueKey="amount"
            formatCurrency={formatCurrency}
          />
          <ChartCard
            title="By Category"
            data={report.byCategory}
            labelKey="category"
            valueKey="amount"
            formatCurrency={formatCurrency}
          />
          <ChartCard
            title="By Department"
            data={report.byDepartment}
            labelKey="department"
            valueKey="amount"
            formatCurrency={formatCurrency}
          />
        </div>

        {/* Export Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onExport}
            style={{
              padding: '10px 24px',
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Export Full Report
          </button>
        </div>
      </div>
    </div>
  </div>
);

/* =========================
   Helper Components for Reports
   ========================= */

const MetricBox = ({ label, value, icon }: any) => (
  <div style={{
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
    <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
      {value}
    </div>
    <div style={{ fontSize: '14px', color: '#6B7280' }}>
      {label}
    </div>
  </div>
);

const ChartCard = ({ title, data, labelKey, valueKey, formatCurrency }: any) => (
  <div style={{
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '16px'
  }}>
    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
      {title}
    </h4>
    <div style={{ display: 'grid', gap: '8px' }}>
      {data.slice(0, 5).map((item: any) => (
        <div key={item[labelKey]} style={{ fontSize: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#6B7280' }}>{item[labelKey]}</span>
            <span style={{ fontWeight: '500', color: '#111827' }}>
              {formatCurrency(item[valueKey])}
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '4px',
            background: '#E5E7EB',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(item[valueKey] / data[0][valueKey]) * 100}%`,
              height: '100%',
              background: '#4F46E5'
            }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* =========================
   Form Field & Input Style
   ========================= */

const FormField = ({ label, children }: any) => (
  <div>
    <label style={{
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '6px'
    }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s',
  background: '#FFFFFF'
};
