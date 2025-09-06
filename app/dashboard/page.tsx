'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { api } from '@/app/lib/api';
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type FormEventHandler,
  type ChangeEvent,
} from 'react';

 import { api } from '@/app/lib/api';
import type { Subscription, Payment } from '@/types/subscription';
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
  healthScore?: number;
  usagePercentage?: number;
  lastUsed?: string;
  seats?: number;
  seatsUsed?: number;
};

type SubscriptionForm = Omit<
  Subscription,
  'id' | 'cost' | 'attachment_count' | 'currentMonthCost' | 'lastMonthCost' | 'costHistory' | 'healthScore'
> & { cost: string };

type Budget = {
  id: string;
  company: string;
  category: string;
  monthlyLimit: number;
  yearlyLimit: number;
  alertThreshold: number;
};

type SavedFilter = {
  id: string;
  name: string;
  filters: {
    company: string;
    category: string;
    status: string;
    payment: string;
    search: string;
  };
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
  'Other',
] as const;

const PAYMENT_METHODS = [
  'Credit Card',
  'Bank Transfer',
  'Invoice',
  'PayPal',
  'ACH Transfer',
  'Wire Transfer',
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState<'all' | Company>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'cancelled'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [healthFilter, setHealthFilter] = useState<'all' | 'good' | 'warning' | 'critical'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'analytics'>('grid');
  const [dateRange, setDateRange] = useState<'30d' | '90d' | '1y' | 'all'>('30d');

  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showBulkActions, setShowBulkActions] = useState(false);

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
    seats: 0,
    seatsUsed: 0,
  });

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

  // Calculate health score for each subscription
  const calculateHealthScore = (sub: Subscription): number => {
    let score = 100;
    
    // Payment status impact
    if (sub.lastPaymentStatus === 'overdue') score -= 30;
    else if (sub.lastPaymentStatus === 'pending') score -= 10;
    
    // Usage impact (if seats data available)
    if (sub.seats && sub.seatsUsed) {
      const usageRate = (sub.seatsUsed / sub.seats) * 100;
      if (usageRate < 30) score -= 25; // Underutilized
      else if (usageRate > 90) score -= 5; // Near capacity
    }
    
    // Contract expiry impact
    if (sub.contractEnd) {
      const daysToExpiry = Math.ceil((new Date(sub.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry < 30 && daysToExpiry > 0) score -= 15;
      else if (daysToExpiry <= 0) score -= 25;
    }
    
    // Variable cost volatility
    if (sub.pricingType === 'variable' && sub.costHistory && sub.costHistory.length > 2) {
      const recentCosts = sub.costHistory.slice(-3).map(c => c.amount);
      const avgCost = recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length;
      const variance = recentCosts.reduce((sum, cost) => sum + Math.pow(cost - avgCost, 2), 0) / recentCosts.length;
      const stdDev = Math.sqrt(variance);
      const cv = (stdDev / avgCost) * 100;
      if (cv > 30) score -= 20; // High volatility
    }
    
    return Math.max(0, Math.min(100, score));
  };

  // Enhanced subscription data with health scores
  const enhancedSubscriptions = useMemo(() => {
    return subscriptions.map(sub => ({
      ...sub,
      healthScore: calculateHealthScore(sub),
      usagePercentage: sub.seats ? (sub.seatsUsed || 0) / sub.seats * 100 : null,
    }));
  }, [subscriptions]);

  // Detect potential duplicates
  const detectDuplicates = useCallback(() => {
    const duplicates: Subscription[][] = [];
    const checked = new Set<number>();
    
    enhancedSubscriptions.forEach((sub1, i) => {
      if (checked.has(sub1.id)) return;
      
      const similar = enhancedSubscriptions.filter((sub2, j) => {
        if (i >= j || checked.has(sub2.id)) return false;
        
        // Check for similar names
        const nameSimilarity = sub1.service.toLowerCase().includes(sub2.service.toLowerCase()) ||
                               sub2.service.toLowerCase().includes(sub1.service.toLowerCase());
        
        // Check for same category and company
        const sameCategoryCompany = sub1.category === sub2.category && sub1.company === sub2.company;
        
        return nameSimilarity || sameCategoryCompany;
      });
      
      if (similar.length > 0) {
        const group = [sub1, ...similar];
        duplicates.push(group);
        group.forEach(s => checked.add(s.id));
      }
    });
    
    return duplicates;
  }, [enhancedSubscriptions]);

  // Forecast future costs
  const forecastCosts = useCallback((months: number = 6) => {
    const forecast = [];
    const now = new Date();
    
    for (let i = 0; i < months; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      let predictedCost = 0;
      enhancedSubscriptions.forEach(sub => {
        if (sub.status !== 'active') return;
        
        if (sub.pricingType === 'variable' && sub.costHistory && sub.costHistory.length > 0) {
          // Use average of last 3 months for variable costs
          const recentCosts = sub.costHistory.slice(-3).map(c => c.amount);
          predictedCost += recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length;
        } else {
          predictedCost += effectiveMonthly(sub);
        }
      });
      
      forecast.push({
        month: monthKey,
        predicted: predictedCost,
        confidence: i < 3 ? 'high' : i < 6 ? 'medium' : 'low'
      });
    }
    
    return forecast;
  }, [enhancedSubscriptions]);

  // Stats with enhancements
  const stats = useMemo(() => {
    const active = enhancedSubscriptions.filter(s => s.status === 'active');
    const monthly = active.reduce((total, sub) => total + effectiveMonthly(sub), 0);
    
    // Calculate trend
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthTotal = active.reduce((total, sub) => {
      if (sub.pricingType === 'variable' && sub.lastMonthCost !== null) {
        return total + sub.lastMonthCost;
      }
      return total + effectiveMonthly(sub);
    }, 0);
    const trend = lastMonthTotal > 0 ? ((monthly - lastMonthTotal) / lastMonthTotal * 100).toFixed(1) : '0';
    
    // Budget status
    const currentBudget = budgets.find(b => b.company === 'all' && b.category === 'all');
    const budgetUsage = currentBudget ? (monthly / currentBudget.monthlyLimit * 100) : 0;
    
    // Health metrics
    const avgHealthScore = active.length > 0 
      ? active.reduce((sum, sub) => sum + (sub.healthScore || 0), 0) / active.length 
      : 100;
    
    const underutilized = active.filter(sub => 
      sub.seats && sub.seatsUsed && (sub.seatsUsed / sub.seats) < 0.3
    ).length;
    
    const vendors = new Set(subscriptions.map(s => s.service)).size;
    const paidCount = subscriptions.filter(s => s.lastPaymentStatus === 'paid').length;
    const pendingCount = subscriptions.filter(s => s.lastPaymentStatus === 'pending').length;
    const overdueCount = subscriptions.filter(s => s.lastPaymentStatus === 'overdue').length;

    return {
      monthly: monthly.toFixed(2),
      yearly: (monthly * 12).toFixed(2),
      active: active.length,
      total: subscriptions.length,
      vendors,
      paidCount,
      pendingCount,
      overdueCount,
      trend,
      budgetUsage,
      avgHealthScore,
      underutilized,
    };
  }, [enhancedSubscriptions, budgets]);

  const upcomingRenewals = useMemo(() => {
    const today = new Date();
    return enhancedSubscriptions
      .filter((sub) => {
        if (!sub.nextBilling || sub.status !== 'active') return false;
        const renewalDate = new Date(sub.nextBilling);
        const daysUntil = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= sub.renewalAlert && daysUntil >= 0;
      })
      .sort((a, b) => (a.nextBilling || '').localeCompare(b.nextBilling || ''));
  }, [enhancedSubscriptions]);

  const filteredSubscriptions = useMemo(() => {
    let filtered = enhancedSubscriptions;

    if (companyFilter !== 'all') {
      filtered = filtered.filter(sub => sub.company === companyFilter);
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(sub => sub.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sub => sub.status === statusFilter);
    }
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(sub => sub.lastPaymentStatus === paymentFilter);
    }
    if (healthFilter !== 'all') {
      filtered = filtered.filter(sub => {
        const score = sub.healthScore || 100;
        if (healthFilter === 'good') return score >= 70;
        if (healthFilter === 'warning') return score >= 40 && score < 70;
        if (healthFilter === 'critical') return score < 40;
        return true;
      });
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(sub =>
        sub.service.toLowerCase().includes(q) ||
        sub.company.toLowerCase().includes(q) ||
        (sub.manager && sub.manager.toLowerCase().includes(q)) ||
        (sub.tags && sub.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }
    return filtered;
  }, [enhancedSubscriptions, companyFilter, categoryFilter, statusFilter, paymentFilter, healthFilter, searchTerm]);

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
        setSubscriptions(data);
        
        // Load saved filters from localStorage
        const saved = localStorage.getItem('savedFilters');
        if (saved) setSavedFilters(JSON.parse(saved));
        
        // Load budgets from localStorage
        const savedBudgets = localStorage.getItem('budgets');
        if (savedBudgets) setBudgets(JSON.parse(savedBudgets));
      } catch (error) {
        console.error('Error loading subscriptions:', error);
        setSubscriptions([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadSubscriptions();
  }, [status]);

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (confirm(`Delete ${selectedIds.size} subscriptions? This action cannot be undone.`)) {
      try {
        await Promise.all(Array.from(selectedIds).map(id => api.deleteSubscription(id)));
        const data = await api.getSubscriptions();
        setSubscriptions(data);
        setSelectedIds(new Set());
        setShowBulkActions(false);
      } catch (error) {
        console.error('Error deleting subscriptions:', error);
        alert('Failed to delete some subscriptions');
      }
    }
  };

  const handleBulkStatusChange = async (newStatus: 'active' | 'pending' | 'cancelled') => {
    if (selectedIds.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => {
          const sub = subscriptions.find(s => s.id === id);
          if (sub) {
            return api.updateSubscription(id, { ...sub, status: newStatus });
          }
        })
      );
      const data = await api.getSubscriptions();
      setSubscriptions(data);
      setSelectedIds(new Set());
      setShowBulkActions(false);
    } catch (error) {
      console.error('Error updating subscriptions:', error);
      alert('Failed to update some subscriptions');
    }
  };

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
    setShowBulkActions(newSelection.size > 0);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredSubscriptions.length) {
      setSelectedIds(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedIds(new Set(filteredSubscriptions.map(s => s.id)));
      setShowBulkActions(true);
    }
  };

  // Import functionality
  const handleImport = async (data: any[]) => {
    try {
      const imported = data.map(row => ({
        company: row.company || 'Kisamos',
        service: row.service || row.name || 'Unknown Service',
        cost: parseFloat(row.cost || row.amount || 0),
        billing: row.billing || 'monthly',
        nextBilling: row.nextBilling || row.next_billing || '',
        contractEnd: row.contractEnd || row.contract_end || '',
        category: row.category || 'Software',
        manager: row.manager || '',
        renewalAlert: parseInt(row.renewalAlert || 30),
        status: row.status || 'active',
        paymentMethod: row.paymentMethod || row.payment_method || 'Credit Card',
        tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
        notes: row.notes || '',
        pricingType: row.pricingType || row.pricing_type || 'fixed',
      }));
      
      for (const sub of imported) {
        await api.createSubscription(sub);
      }
      
      const data = await api.getSubscriptions();
      setSubscriptions(data);
      setShowImportModal(false);
      alert(`Successfully imported ${imported.length} subscriptions`);
    } catch (error) {
      console.error('Error importing subscriptions:', error);
      alert('Failed to import subscriptions. Please check the format.');
    }
  };

  // Save filter preset
  const saveFilterPreset = () => {
    const name = prompt('Enter a name for this filter preset:');
    if (!name) return;
    
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name,
      filters: {
        company: companyFilter,
        category: categoryFilter,
        status: statusFilter,
        payment: paymentFilter,
        search: searchTerm,
      },
    };
    
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('savedFilters', JSON.stringify(updated));
  };

  const loadFilterPreset = (filter: SavedFilter) => {
    setCompanyFilter(filter.filters.company as any);
    setCategoryFilter(filter.filters.category);
    setStatusFilter(filter.filters.status as any);
    setPaymentFilter(filter.filters.payment as any);
    setSearchTerm(filter.filters.search);
  };

  const deleteFilterPreset = (id: string) => {
    const updated = savedFilters.filter(f => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem('savedFilters', JSON.stringify(updated));
  };

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
     Helper Functions
     ========================= */

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, subscriptionId?: number) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSize = 10 * 1024 * 1024;

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
      };

      await api.markAsPaid(subscriptionId, payment);
      const data = await api.getSubscriptions();
      setSubscriptions(data);
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
      setSubscriptions(data);
    } catch (err) {
      console.error('logActualCost error', err);
      alert('Failed to log cost');
    }
  };

  const handleExport = () => {
    const exportData = {
      subscriptions: subscriptions,
      budgets: budgets,
      exportDate: new Date().toISOString(),
      stats: stats,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions_${new Date().toISOString().split('T')[0]}.json`;
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

    try {
      if (editingId !== null) {
        await api.updateSubscription(editingId, {
          ...formData,
          cost: parsedCost,
          tags: currentTags,
        });
      } else {
        await api.createSubscription({
          ...formData,
          cost: parsedCost,
          tags: currentTags,
        });
      }

      const data = await api.getSubscriptions();
      setSubscriptions(data);
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
      seats: 0,
      seatsUsed: 0,
    });
    setCurrentTags([]);
    setTagInput('');
    setShowModal(false);
    setEditingId(null);
  };

  const handleEdit = (sub: Subscription) => {
    const { id: _id, cost: _ignore, attachment_count: _ac, healthScore: _hs, ...rest } = sub;
    setFormData({
      ...rest,
      cost: sub.cost.toString(),
      pricingType: sub.pricingType || 'fixed',
      seats: sub.seats || 0,
      seatsUsed: sub.seatsUsed || 0,
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
        setSubscriptions(data);
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
            {/* Quick Actions */}
            <QuickActions
              onQuickAdd={() => setShowModal(true)}
              onDetectDuplicates={() => setShowDuplicatesModal(true)}
              onManageBudgets={() => setShowBudgetModal(true)}
            />
            
            {session.user?.email && (
              <span style={{ fontSize: '14px', color: '#6B7280' }}>
                {session.user.email}
              </span>
            )}
            
            <button
              onClick={() => setShowImportModal(true)}
              style={ghostBtn}
              onMouseEnter={hoverFill}
              onMouseLeave={hoverReset}
            >
              Import
            </button>
            
            <button
              onClick={handleExport}
              style={ghostBtn}
              onMouseEnter={hoverFill}
              onMouseLeave={hoverReset}
            >
              Export
            </button>
            
            <button
              onClick={() => setShowHelpModal(true)}
              style={ghostBtn}
              onMouseEnter={hoverFill}
              onMouseLeave={hoverReset}
            >
              Help
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
            Subscription Management
          </h1>
          <p style={{ color: '#6B7280', fontSize: '14px' }}>
            Track, manage, and optimize your business subscriptions
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
            <AlertsSection
              upcomingRenewals={upcomingRenewals}
              overdueCount={stats.overdueCount}
              underutilizedCount={stats.underutilized}
              budgetUsage={stats.budgetUsage}
              formatDate={formatDate}
            />

            {/* Enhanced Metrics */}
            <EnhancedMetrics stats={stats} formatCurrency={formatCurrency} />

            {/* Controls */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              {/* Bulk Actions Bar */}
              {showBulkActions && (
                <BulkActionsBar
                  selectedCount={selectedIds.size}
                  onDelete={handleBulkDelete}
                  onStatusChange={handleBulkStatusChange}
                  onCancel={() => {
                    setSelectedIds(new Set());
                    setShowBulkActions(false);
                  }}
                />
              )}

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
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
                      } as React.CSSProperties}
                      onFocus={e => e.currentTarget.style.borderColor = '#4F46E5'}
                      onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
                    />
                  </div>

                  {/* Enhanced Filters */}
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
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    style={selectStyle}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
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

                  <select
                    value={healthFilter}
                    onChange={e => setHealthFilter(e.target.value as any)}
                    style={selectStyle}
                  >
                    <option value="all">All Health</option>
                    <option value="good">Good (70+)</option>
                    <option value="warning">Warning (40-69)</option>
                    <option value="critical">Critical (&lt;40)</option>
                  </select>

                  {/* Saved Filters */}
                  {savedFilters.length > 0 && (
                    <SavedFiltersDropdown
                      filters={savedFilters}
                      onLoad={loadFilterPreset}
                      onDelete={deleteFilterPreset}
                    />
                  )}
                  
                  <button
                    onClick={saveFilterPreset}
                    style={{ ...ghostBtn, padding: '8px 12px' }}
                    title="Save current filter preset"
                  >
                    Save Filter
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {/* Select All Checkbox */}
                  {viewMode !== 'analytics' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredSubscriptions.length && filteredSubscriptions.length > 0}
                        onChange={selectAll}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', color: '#6B7280' }}>Select All</span>
                    </label>
                  )}

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
                      last
                    >
                      <IconBars />
                    </ViewToggleButton>
                  </div>

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
                  <EnhancedSubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    selected={selectedIds.has(sub.id)}
                    onToggleSelect={() => toggleSelection(sub.id)}
                    onEdit={() => handleEdit(sub)}
                    onDelete={() => handleDelete(sub.id)}
                    onViewDocuments={() => {
                      setSelectedSubscription(sub);
                      setShowDocumentsModal(true);
                    }}
                    onMarkPaid={() => markAsPaid(sub.id)}
                    onLogCost={() => logActualCost(sub.id)}
                    onUpload={(e: ChangeEvent<HTMLInputElement>) => handleFileUpload(e, sub.id)}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getCompanyColor={getCompanyColor}
                  />
                ))}
              </div>
            ) : viewMode === 'table' ? (
              <EnhancedTableView
                subscriptions={filteredSubscriptions}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMarkPaid={markAsPaid}
                onLogCost={logActualCost}
                onUpload={handleFileUpload}
                onViewDocuments={(sub: Subscription) => {
                  setSelectedSubscription(sub);
                  setShowDocumentsModal(true);
                }}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                getCompanyColor={getCompanyColor}
              />
            ) : (
              <AnalyticsView
                subscriptions={enhancedSubscriptions}
                formatCurrency={formatCurrency}
                forecastData={forecastCosts()}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            )}
          </>
        )}

        {/* Modals */}
        {showModal && (
          <EnhancedFormModal
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

        {showBudgetModal && (
          <BudgetModal
            budgets={budgets}
            onClose={() => setShowBudgetModal(false)}
            onSave={(newBudgets) => {
              setBudgets(newBudgets);
              localStorage.setItem('budgets', JSON.stringify(newBudgets));
              setShowBudgetModal(false);
            }}
            COMPANIES={COMPANIES}
            CATEGORIES={CATEGORIES}
          />
        )}

        {showImportModal && (
          <ImportModal
            onClose={() => setShowImportModal(false)}
            onImport={handleImport}
          />
        )}

        {showDuplicatesModal && (
          <DuplicatesModal
            duplicates={detectDuplicates()}
            onClose={() => setShowDuplicatesModal(false)}
            onMerge={async (keepId: number, deleteIds: number[]) => {
              try {
                for (const id of deleteIds) {
                  await api.deleteSubscription(id);
                }
                const data = await api.getSubscriptions();
                setSubscriptions(data);
                alert('Successfully merged subscriptions');
              } catch (error) {
                console.error('Error merging subscriptions:', error);
                alert('Failed to merge subscriptions');
              }
            }}
            formatCurrency={formatCurrency}
          />
        )}

        {showHelpModal && (
          <EnhancedHelpModal onClose={() => setShowHelpModal(false)} />
        )}
      </div>
    </div>
  );
}

/* =========================
   New Components
   ========================= */

const QuickActions = ({ onQuickAdd, onDetectDuplicates, onManageBudgets }: any) => (
  <div style={{ display: 'flex', gap: '8px' }}>
    <button
      onClick={onQuickAdd}
      style={{ ...ghostBtn, padding: '6px 10px', fontSize: '13px' }}
      title="Quick Add (Ctrl+N)"
    >
      ⚡ Quick Add
    </button>
    <button
      onClick={onDetectDuplicates}
      style={{ ...ghostBtn, padding: '6px 10px', fontSize: '13px' }}
      title="Find Duplicates"
    >
      🔍 Duplicates
    </button>
    <button
      onClick={onManageBudgets}
      style={{ ...ghostBtn, padding: '6px 10px', fontSize: '13px' }}
      title="Budget Settings"
    >
      💰 Budgets
    </button>
  </div>
);

const AlertsSection = ({ upcomingRenewals, overdueCount, underutilizedCount, budgetUsage, formatDate }: any) => {
  const alerts = [];
  
  if (upcomingRenewals.length > 0) {
    alerts.push({
      type: 'warning',
      title: `${upcomingRenewals.length} Upcoming Renewal${upcomingRenewals.length > 1 ? 's' : ''}`,
      content: upcomingRenewals.slice(0, 3).map((sub: any, idx: number) => (
        <span key={sub.id}>
          {sub.service} ({formatDate(sub.nextBilling)})
          {idx < Math.min(2, upcomingRenewals.length - 1) ? ' • ' : ''}
        </span>
      )),
      iconColor: '#F59E0B',
      bg: '#FEF3C7',
      border: '#FCD34D',
      textColor: '#78350F'
    });
  }
  
  if (overdueCount > 0) {
    alerts.push({
      type: 'danger',
      title: `${overdueCount} Overdue Payment${overdueCount > 1 ? 's' : ''}`,
      content: 'Review and process overdue payments to avoid service disruptions',
      iconColor: '#DC2626',
      bg: '#FEE2E2',
      border: '#FCA5A5',
      textColor: '#7F1D1D'
    });
  }
  
  if (underutilizedCount > 0) {
    alerts.push({
      type: 'info',
      title: `${underutilizedCount} Underutilized Subscription${underutilizedCount > 1 ? 's' : ''}`,
      content: 'Some subscriptions are using less than 30% of available seats',
      iconColor: '#2563EB',
      bg: '#DBEAFE',
      border: '#93C5FD',
      textColor: '#1E3A8A'
    });
  }
  
  if (budgetUsage > 80) {
    alerts.push({
      type: 'warning',
      title: `Budget Alert: ${budgetUsage.toFixed(0)}% Used`,
      content: 'Monthly spending is approaching budget limit',
      iconColor: '#F59E0B',
      bg: '#FEF3C7',
      border: '#FCD34D',
      textColor: '#78350F'
    });
  }
  
  if (alerts.length === 0) return null;
  
  return (
    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {alerts.map((alert, idx) => (
        <Alert key={idx} {...alert} />
      ))}
    </div>
  );
};

const EnhancedMetrics = ({ stats, formatCurrency }: any) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  }}>
    <MetricCard
      label="Monthly Spend"
      value={formatCurrency(parseFloat(stats.monthly))}
      trend={stats.trend + '%'}
      trendUp={parseFloat(stats.trend) > 0}
      icon={<IconMoney />}
    />
    <MetricCard
      label="Annual Projection"
      value={formatCurrency(parseFloat(stats.yearly))}
      sublabel={stats.budgetUsage > 0 ? `${stats.budgetUsage.toFixed(0)}% of budget` : null}
      icon={<IconCalendarMoney />}
    />
    <MetricCard
      label="Active Subscriptions"
      value={stats.active.toString()}
      sublabel={`of ${stats.total} total`}
      icon={<IconActive />}
    />
    <MetricCard
      label="Health Score"
      value={`${stats.avgHealthScore.toFixed(0)}/100`}
      sublabel={stats.underutilized > 0 ? `${stats.underutilized} underutilized` : 'All optimized'}
      alert={stats.avgHealthScore < 70}
      icon={<IconHealth />}
    />
    <MetricCard
      label="Payment Status"
      value={`${stats.paidCount}/${stats.total}`}
      sublabel="paid this period"
      alert={stats.overdueCount > 0}
      icon={<IconPayment />}
    />
    <MetricCard
      label="Vendors"
      value={stats.vendors.toString()}
      sublabel="unique providers"
      icon={<IconVendors />}
    />
  </div>
);

const BulkActionsBar = ({ selectedCount, onDelete, onStatusChange, onCancel }: any) => (
  <div style={{
    padding: '12px',
    background: '#F3F4F6',
    borderRadius: '6px',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }}>
    <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
      {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
    </span>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={() => onStatusChange('active')}
        style={{ ...ghostBtn, background: '#FFFFFF', border: '1px solid #E5E7EB' }}
      >
        Mark Active
      </button>
      <button
        onClick={() => onStatusChange('cancelled')}
        style={{ ...ghostBtn, background: '#FFFFFF', border: '1px solid #E5E7EB' }}
      >
        Cancel
      </button>
      <button
        onClick={onDelete}
        style={{ ...ghostBtn, background: '#FEE2E2', color: '#DC2626' }}
      >
        Delete Selected
      </button>
      <button onClick={onCancel} style={ghostBtn}>
        Cancel
      </button>
    </div>
  </div>
);

const SavedFiltersDropdown = ({ filters, onLoad, onDelete }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={selectStyle}
      >
        Saved Filters ({filters.length})
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 10,
          minWidth: '200px'
        }}>
          {filters.map((filter: any) => (
            <div
              key={filter.id}
              style={{
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #F3F4F6',
                cursor: 'pointer'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
            >
              <span
                onClick={() => {
                  onLoad(filter);
                  setIsOpen(false);
                }}
                style={{ fontSize: '14px', color: '#374151', flex: 1 }}
              >
                {filter.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(filter.id);
                }}
                style={{
                  padding: '2px',
                  background: 'none',
                  border: 'none',
                  color: '#DC2626',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EnhancedSubscriptionCard = ({
  subscription: sub,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onViewDocuments,
  onMarkPaid,
  onLogCost,
  onUpload,
  formatCurrency,
  formatDate,
  getCompanyColor
}: any) => {
  const getHealthColor = (score: number) => {
    if (score >= 70) return '#10B981';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const displayAmount = sub.pricingType === 'variable' && typeof sub.currentMonthCost === 'number'
    ? sub.currentMonthCost
    : sub.cost;

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #4F46E5' : sub.lastPaymentStatus === 'overdue' ? '1px solid #FCA5A5' : '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '20px',
        transition: 'all 0.2s',
        position: 'relative'
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Selection Checkbox */}
      <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* Health Indicator */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        border: `2px solid ${getHealthColor(sub.healthScore || 100)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 'bold',
        color: getHealthColor(sub.healthScore || 100)
      }}>
        {sub.healthScore || 100}
      </div>

      {/* Header */}
      <div style={{ marginBottom: '16px', paddingLeft: '24px' }}>
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
                {sub.company}
              </span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
              {sub.service}
            </h3>
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
        </div>
      </div>

      {/* Cost */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
          {formatCurrency(displayAmount)}
          <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: '400' }}>
            /{sub.billing === 'monthly' ? 'mo' : sub.billing === 'yearly' ? 'yr' : 'qtr'}
          </span>
        </div>
        {sub.pricingType === 'variable' && sub.lastMonthCost !== null && (
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
            Last month: {formatCurrency(sub.lastMonthCost)}
          </div>
        )}
      </div>

      {/* Usage Bar (if seats data available) */}
      {sub.seats && sub.seatsUsed !== undefined && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
            Seat Usage: {sub.seatsUsed}/{sub.seats} ({((sub.seatsUsed / sub.seats) * 100).toFixed(0)}%)
          </div>
          <div style={{
            height: '4px',
            background: '#E5E7EB',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.min(100, (sub.seatsUsed / sub.seats) * 100)}%`,
              height: '100%',
              background: sub.seatsUsed / sub.seats > 0.9 ? '#F59E0B' : '#10B981',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}

      {/* Details */}
      <div style={{ marginBottom: '16px', display: 'grid', gap: '8px' }}>
        <DetailRow label="Next Billing" value={formatDate(sub.nextBilling)} />
        <DetailRow label="Category" value={sub.category} />
        {sub.manager && <DetailRow label="Manager" value={sub.manager} />}
        <DetailRow label="Documents" value={`${sub.attachments?.length ?? sub.attachment_count ?? 0} files`} />
        <DetailRow 
          label="Status" 
          value={
            <div style={{ display: 'flex', gap: '4px' }}>
              <StatusBadge status={sub.status} />
              <PaymentStatusBadge status={sub.lastPaymentStatus} />
            </div>
          } 
        />
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
          Docs
        </ActionButton>

        {sub.lastPaymentStatus !== 'paid' && (
          <ActionButton onClick={onMarkPaid} success>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Pay
          </ActionButton>
        )}

        {sub.pricingType === 'variable' && (
          <ActionButton onClick={onLogCost}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 3a1 1 0 000 2h12a1 1 0 100-2H4zM3 8a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 4a1 1 0 000 2h12a1 1 0 100-2H4zm-1 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
            </svg>
            Log
          </ActionButton>
        )}
      </div>
    </div>
  );
};

const EnhancedTableView = ({
  subscriptions,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  onMarkPaid,
  onLogCost,
  onUpload,
  onViewDocuments,
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
            <th style={{ ...th, width: '40px' }}>
              <input
                type="checkbox"
                checked={selectedIds.size === subscriptions.length && subscriptions.length > 0}
                onChange={() => {
                  if (selectedIds.size === subscriptions.length) {
                    onToggleSelect(new Set());
                  } else {
                    subscriptions.forEach((sub: any) => onToggleSelect(sub.id));
                  }
                }}
              />
            </th>
            <th style={th}>Health</th>
            <th style={th}>Company</th>
            <th style={th}>Service</th>
            <th style={th}>Cost</th>
            <th style={th}>Usage</th>
            <th style={th}>Status</th>
            <th style={th}>Payment</th>
            <th style={th}>Next Billing</th>
            <th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub: any, idx: number) => {
            const displayAmount =
              sub.pricingType === 'variable' && typeof sub.currentMonthCost === 'number'
                ? sub.currentMonthCost
                : sub.cost;

            return (
              <tr
                key={sub.id}
                style={{
                  borderBottom: idx !== subscriptions.length - 1 ? '1px solid #E5E7EB' : 'none',
                  transition: 'background 0.2s',
                  background: selectedIds.has(sub.id) ? '#F3F4F6' : '#FFFFFF'
                }}
                onMouseEnter={e => { if (!selectedIds.has(sub.id)) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!selectedIds.has(sub.id)) e.currentTarget.style.background = '#FFFFFF'; }}
              >
                <td style={td}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sub.id)}
                    onChange={() => onToggleSelect(sub.id)}
                  />
                </td>
                <td style={td}>
                  <HealthIndicator score={sub.healthScore || 100} />
                </td>
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
                <td style={td}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {formatCurrency(displayAmount)}
                    <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '400' }}>
                      /{sub.billing === 'monthly' ? 'mo' : sub.billing === 'yearly' ? 'yr' : 'qtr'}
                    </span>
                  </div>
                  {sub.pricingType === 'variable' && sub.lastMonthCost !== null && (
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>
                      Last: {formatCurrency(sub.lastMonthCost)}
                    </div>
                  )}
                </td>
                <td style={td}>
                  {sub.seats ? (
                    <UsageIndicator used={sub.seatsUsed || 0} total={sub.seats} />
                  ) : (
                    <span style={{ fontSize: '14px', color: '#9CA3AF' }}>-</span>
                  )}
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

const AnalyticsView = ({ subscriptions, formatCurrency, forecastData, dateRange, onDateRangeChange }: any) => {
  const categorySpend = useMemo(() => {
    const spend: { [key: string]: number } = {};
    subscriptions.forEach((sub: any) => {
      if (sub.status !== 'active') return;
      const monthly = sub.pricingType === 'variable' && sub.currentMonthCost 
        ? sub.currentMonthCost 
        : sub.cost / (sub.billing === 'yearly' ? 12 : sub.billing === 'quarterly' ? 3 : 1);
      spend[sub.category || 'Other'] = (spend[sub.category || 'Other'] || 0) + monthly;
    });
    return Object.entries(spend).map(([category, amount]) => ({ category, amount }));
  }, [subscriptions]);

  const companySpend = useMemo(() => {
    const spend: { [key: string]: number } = {};
    subscriptions.forEach((sub: any) => {
      if (sub.status !== 'active') return;
      const monthly = sub.pricingType === 'variable' && sub.currentMonthCost 
        ? sub.currentMonthCost 
        : sub.cost / (sub.billing === 'yearly' ? 12 : sub.billing === 'quarterly' ? 3 : 1);
      spend[sub.company] = (spend[sub.company] || 0) + monthly;
    });
    return Object.entries(spend).map(([company, amount]) => ({ company, amount }));
  }, [subscriptions]);

  const topExpenses = useMemo(() => {
    return [...subscriptions]
      .filter(sub => sub.status === 'active')
      .sort((a, b) => {
        const aMonthly = a.pricingType === 'variable' && a.currentMonthCost 
          ? a.currentMonthCost 
          : a.cost / (a.billing === 'yearly' ? 12 : a.billing === 'quarterly' ? 3 : 1);
        const bMonthly = b.pricingType === 'variable' && b.currentMonthCost 
          ? b.currentMonthCost 
          : b.cost / (b.billing === 'yearly' ? 12 : b.billing === 'quarterly' ? 3 : 1);
        return bMonthly - aMonthly;
      })
      .slice(0, 10);
  }, [subscriptions]);

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Date Range Selector */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Time Period:</span>
        {['30d', '90d', '1y', 'all'].map(range => (
          <button
            key={range}
            onClick={() => onDateRangeChange(range)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: dateRange === range ? 'none' : '1px solid #E5E7EB',
              background: dateRange === range ? '#4F46E5' : '#FFFFFF',
              color: dateRange === range ? '#FFFFFF' : '#6B7280',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : range === '1y' ? '1 Year' : 'All Time'}
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Category Distribution */}
        <ChartCard title="Spending by Category">
          {categorySpend.map(({ category, amount }) => (
            <div key={category} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', color: '#374151' }}>{category}</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                  {formatCurrency(amount)}/mo
                </span>
              </div>
              <div style={{
                height: '8px',
                background: '#E5E7EB',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(amount / Math.max(...categorySpend.map(c => c.amount))) * 100}%`,
                  height: '100%',
                  background: '#4F46E5',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          ))}
        </ChartCard>

        {/* Company Distribution */}
        <ChartCard title="Spending by Company">
          {companySpend.map(({ company, amount }) => (
            <div key={company} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', color: '#374151' }}>{company}</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                  {formatCurrency(amount)}/mo
                </span>
              </div>
              <div style={{
                height: '8px',
                background: '#E5E7EB',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(amount / Math.max(...companySpend.map(c => c.amount))) * 100}%`,
                  height: '100%',
                  background: '#059669',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          ))}
        </ChartCard>

        {/* Cost Forecast */}
        <ChartCard title="6-Month Cost Forecast">
          {forecastData.map((point: any) => (
            <div key={point.month} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', color: '#374151' }}>
                  {new Date(point.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                  {formatCurrency(point.predicted)}
                </span>
              </div>
              <div style={{
                height: '8px',
                background: '#E5E7EB',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(point.predicted / Math.max(...forecastData.map((p: any) => p.predicted))) * 100}%`,
                  height: '100%',
                  background: point.confidence === 'high' ? '#10B981' : point.confidence === 'medium' ? '#F59E0B' : '#EF4444',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          ))}
        </ChartCard>

        {/* Top Expenses */}
        <ChartCard title="Top 10 Expenses">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topExpenses.map((sub: any, idx: number) => {
              const monthly = sub.pricingType === 'variable' && sub.currentMonthCost 
                ? sub.currentMonthCost 
                : sub.cost / (sub.billing === 'yearly' ? 12 : sub.billing === 'quarterly' ? 3 : 1);
              
              return (
                <div key={sub.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px',
                  background: idx % 2 === 0 ? '#F9FAFB' : '#FFFFFF',
                  borderRadius: '4px'
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#E5E7EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280'
                    }}>
                      {idx + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {sub.service}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        {sub.company} • {sub.category}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                      {formatCurrency(monthly)}/mo
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>
                      {sub.billing}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

const ChartCard = ({ title, children }: any) => (
  <div style={{
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '20px'
  }}>
    <h3 style={{
      fontSize: '16px',
      fontWeight: '600',
      color: '#111827',
      marginBottom: '16px'
    }}>
      {title}
    </h3>
    {children}
  </div>
);

const BudgetModal = ({ budgets, onClose, onSave, COMPANIES, CATEGORIES }: any) => {
  const [localBudgets, setLocalBudgets] = useState(budgets);
  const [newBudget, setNewBudget] = useState({
    company: 'all',
    category: 'all',
    monthlyLimit: '',
    yearlyLimit: '',
    alertThreshold: '80'
  });

  const addBudget = () => {
    if (!newBudget.monthlyLimit) return;
    
    const budget = {
      id: Date.now().toString(),
      company: newBudget.company,
      category: newBudget.category,
      monthlyLimit: parseFloat(newBudget.monthlyLimit),
      yearlyLimit: parseFloat(newBudget.yearlyLimit || (parseFloat(newBudget.monthlyLimit) * 12).toString()),
      alertThreshold: parseFloat(newBudget.alertThreshold)
    };
    
    setLocalBudgets([...localBudgets, budget]);
    setNewBudget({
      company: 'all',
      category: 'all',
      monthlyLimit: '',
      yearlyLimit: '',
      alertThreshold: '80'
    });
  };

  const removeBudget = (id: string) => {
    setLocalBudgets(localBudgets.filter((b: any) => b.id !== id));
  };

  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalBox(600)}>
        <ModalHeader title="Budget Management" onClose={onClose} />
        
        <div style={{ padding: '24px' }}>
          <div style={{
            background: '#F3F4F6',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              Add New Budget
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <select
                value={newBudget.company}
                onChange={e => setNewBudget({ ...newBudget, company: e.target.value })}
                style={inputStyle}
              >
                <option value="all">All Companies</option>
                {COMPANIES.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={newBudget.category}
                onChange={e => setNewBudget({ ...newBudget, category: e.target.value })}
                style={inputStyle}
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Monthly Limit ($)"
                value={newBudget.monthlyLimit}
                onChange={e => setNewBudget({ ...newBudget, monthlyLimit: e.target.value })}
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="Alert at (%))"
                value={newBudget.alertThreshold}
                onChange={e => setNewBudget({ ...newBudget, alertThreshold: e.target.value })}
                style={inputStyle}
              />
            </div>
            <button
              onClick={addBudget}
              style={{ ...primaryBtn, width: '100%' }}
            >
              Add Budget
            </button>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
              Current Budgets
            </h4>
            {localBudgets.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', padding: '24px' }}>
                No budgets configured
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {localBudgets.map((budget: any) => (
                  <div
                    key={budget.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      background: '#FFFFFF'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {budget.company === 'all' ? 'All Companies' : budget.company} • 
                        {budget.category === 'all' ? ' All Categories' : ` ${budget.category}`}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        ${budget.monthlyLimit}/mo • Alert at {budget.alertThreshold}%
                      </div>
                    </div>
                    <button
                      onClick={() => removeBudget(budget.id)}
                      style={{
                        padding: '4px 8px',
                        background: '#FEE2E2',
                        color: '#DC2626',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '1px solid #E5E7EB'
          }}>
            <button onClick={onClose} style={{ ...outlineBtn, flex: 1 }}>
              Cancel
            </button>
            <button
              onClick={() => onSave(localBudgets)}
              style={{ ...primaryBtn, flex: 1 }}
            >
              Save Budgets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ImportModal = ({ onClose, onImport }: any) => {
  const [importData, setImportData] = useState('');
  const [importType, setImportType] = useState<'json' | 'csv'>('csv');

  const handleImport = () => {
    try {
      let data;
      if (importType === 'json') {
        data = JSON.parse(importData);
      } else {
        // Simple CSV parsing
        const lines = importData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, idx) => {
            obj[header] = values[idx];
          });
          return obj;
        });
      }
      onImport(Array.isArray(data) ? data : [data]);
    } catch (error) {
      alert('Invalid format. Please check your data.');
    }
  };

  return (
    <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalBox(600)}>
        <ModalHeader title="Import Subscriptions" onClose={onClose} />
        
        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Import Format:
            </label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="csv"
                  checked={importType === 'csv'}
                  onChange={() => setImportType('csv')}
                />
                CSV
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="json"
                  checked={importType === 'json'}
                  onChange={() => setImportType('json')}
                />
                JSON
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Paste your data:
            </label>
            <textarea
              value={importData}
              onChange={e => setImportData(e.target.value)}
              placeholder={importType === 'csv' 
                ? 'company,service,cost,billing,category,status\nKisamos,Microsoft 365,299,monthly,Software,active'
                : '[{"company":"Kisamos","service":"Microsoft 365","cost":299,"billing":"monthly"}]'}
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '12px',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'monospace',
                resize: 'vertical',
                marginTop: '8px'
              }}
            />
          </div>

          <div style={{
            background: '#F3F4F6',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
              <strong>Expected fields:</strong> company, service, cost, billing, category, status, manager, tags, notes
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ ...outlineBtn, flex: 1 }}>
              Cancel
            </button>
            <button
              onClick={handleImport}
              style={{ ...primaryBtn, flex: 1 }}
              disabled={!importData}
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DuplicatesModal = ({ duplicates, onClose, onMerge, formatCurrency }: any) => (
  <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={modalBox(700)}>
      <ModalHeader title="Potential Duplicate Subscriptions" onClose={onClose} />
      
      <div style={{ padding: '24px' }}>
        {duplicates.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', padding: '48px' }}>
            No potential duplicates found. Your subscriptions look well organized!
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {duplicates.map((group: any[], idx: number) => (
              <div
                key={idx}
                style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '16px',
                  background: '#FEFCE8'
                }}
              >
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#78350F', marginBottom: '12px' }}>
                  Potential Duplicate Group {idx + 1}
                </h4>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {group.map((sub: any) => (
                    <div
                      key={sub.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px',
                        background: '#FFFFFF',
                        borderRadius: '4px',
                        border: '1px solid #FCD34D'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                          {sub.service}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>
                          {sub.company} • {sub.category} • {formatCurrency(sub.cost)}/{sub.billing}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const deleteIds = group.filter(s => s.id !== sub.id).map(s => s.id);
                          if (confirm(`Keep "${sub.service}" and remove ${deleteIds.length} duplicate(s)?`)) {
                            onMerge(sub.id, deleteIds);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          background: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Keep This
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

const EnhancedFormModal = ({
  editingId, formData, setFormData,
  currentTags, tagInput, setTagInput,
  onSubmit, onClose, onAddTag, onRemoveTag,
  onFileUpload, formatFileSize, COMPANIES, CATEGORIES, PAYMENT_METHODS
}: any) => (
  <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={modalBox(600)}>
      <ModalHeader 
        title={editingId !== null ? 'Edit Subscription' : 'Add New Subscription'} 
        onClose={onClose} 
      />

      <form onSubmit={onSubmit} style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gap: '16px' }}>
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
          </div>

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

          {/* Seats Management */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField label="Total Seats">
              <input
                type="number"
                value={formData.seats || ''}
                onChange={e => setFormData({ ...formData, seats: parseInt(e.target.value) || 0 })}
                style={inputStyle}
                placeholder="0"
                min="0"
              />
            </FormField>

            <FormField label="Seats Used">
              <input
                type="number"
                value={formData.seatsUsed || ''}
                onChange={e => setFormData({ ...formData, seatsUsed: parseInt(e.target.value) || 0 })}
                style={inputStyle}
                placeholder="0"
                min="0"
              />
            </FormField>
          </div>

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

          <FormField label="Manager">
            <input
              type="text"
              value={formData.manager}
              onChange={e => setFormData({ ...formData, manager: e.target.value })}
              style={inputStyle}
              placeholder="e.g., John Smith"
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                      ×
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
            style={{ ...outlineBtn, flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ ...primaryBtn, flex: 1 }}
          >
            {editingId !== null ? 'Update Subscription' : 'Add Subscription'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

const EnhancedHelpModal = ({ onClose }: any) => (
  <div style={backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={modalBox(800)}>
      <ModalHeader title="Help & Documentation" onClose={onClose} />
      <div style={{ padding: '24px', maxHeight: '60vh', overflow: 'auto' }}>
        <div style={{ display: 'grid', gap: '24px' }}>
          <HelpSection
            title="🎯 Key Features"
            content={[
              "Track subscriptions across multiple companies and categories",
              "Monitor variable/consumption-based costs (Azure, AWS, etc.)",
              "Set budgets and receive alerts when approaching limits",
              "Detect potential duplicate subscriptions automatically",
              "Track seat utilization and identify underused subscriptions",
              "Forecast future costs based on historical data",
              "Bulk operations for efficient management",
              "Import/export data in JSON or CSV format"
            ]}
          />
          
          <HelpSection
            title="💡 Health Score Explained"
            content={[
              "100-70: Good - Subscription is well-managed",
              "69-40: Warning - Needs attention",
              "Below 40: Critical - Immediate action required",
              "Factors: Payment status, seat utilization, contract expiry, cost volatility"
            ]}
          />
          
          <HelpSection
            title="⚡ Keyboard Shortcuts"
            content={[
              "Ctrl+N: Quick add subscription",
              "Ctrl+S: Save current form",
              "Ctrl+F: Focus search field",
              "Esc: Close modals"
            ]}
          />
          
          <HelpSection
            title="📊 Analytics View"
            content={[
              "View spending breakdown by category and company",
              "Track cost trends over time",
              "Identify top expenses",
              "Forecast future spending",
              "Export reports for stakeholders"
            ]}
          />
        </div>
      </div>
    </div>
  </div>
);

const HelpSection = ({ title, content }: any) => (
  <div>
    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
      {title}
    </h3>
    <ul style={{ margin: 0, paddingLeft: '24px' }}>
      {content.map((item: string, idx: number) => (
        <li key={idx} style={{ fontSize: '14px', color: '#6B7280', marginBottom: '6px' }}>
          {item}
        </li>
      ))}
    </ul>
  </div>
);

/* =========================
   Small UI Components
   ========================= */

const Spinner = () => (
  <>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid #E5E7EB',
      borderTop: '3px solid #4F46E5',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto 16px'
    }} />
    <style jsx>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </>
);

const Alert = ({ title, children, bg, border, iconColor, textColor }: any) => (
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
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
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

const HealthIndicator = ({ score }: any) => {
  const getColor = () => {
    if (score >= 70) return '#10B981';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }}>
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: `2px solid ${getColor()}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 'bold',
        color: getColor()
      }}>
        {score}
      </div>
      <span style={{ fontSize: '12px', color: '#6B7280' }}>
        {score >= 70 ? 'Good' : score >= 40 ? 'Warning' : 'Critical'}
      </span>
    </div>
  );
};

const UsageIndicator = ({ used, total }: any) => {
  const percentage = (used / total) * 100;
  const color = percentage > 90 ? '#F59E0B' : percentage < 30 ? '#EF4444' : '#10B981';
  
  return (
    <div>
      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>
        {used}/{total} ({percentage.toFixed(0)}%)
      </div>
      <div style={{
        height: '4px',
        background: '#E5E7EB',
        borderRadius: '2px',
        overflow: 'hidden',
        width: '80px'
      }}>
        <div style={{
          width: `${Math.min(100, percentage)}%`,
          height: '100%',
          background: color,
          transition: 'width 0.3s'
        }} />
      </div>
    </div>
  );
};

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
    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.