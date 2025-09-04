'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEventHandler,
  type ChangeEvent,
} from 'react';
import { useRouter } from 'next/navigation';

type SubscriptionForm = Omit<Subscription, 'id' | 'cost'> & { cost: string };

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
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  invoiceId?: string;
  method?: string;
  reference?: string;
};

type Subscription = {
  id: number;
  company: 'Kisamos' | 'Mizzen' | 'Fertmax';
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
  usage?: number;
  tags?: string[];
  notes?: string;
  attachments?: FileAttachment[];
  payments?: Payment[];
  lastPaymentStatus?: 'paid' | 'pending' | 'overdue';
};

const COMPANIES = ['Kisamos', 'Mizzen', 'Fertmax'] as const;
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

export default function Dashboard() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false); // NEW
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState<'all' | Company>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'analytics'>('grid');
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // ✅ Use SubscriptionForm (cost as string) to avoid the "never" type issue
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
    usage: undefined,
    tags: [],
    notes: '',
    attachments: [],
    payments: [],
    lastPaymentStatus: 'pending',
  });

  // Load subscriptions
  useEffect(() => {
    try {
      const saved = localStorage.getItem('subscriptions_professional');
      if (saved) {
        setSubscriptions(JSON.parse(saved));
      } else {
        const demoData: Subscription[] = [
          {
            id: 1,
            company: 'Kisamos',
            service: 'Microsoft 365 Business',
            cost: 299,
            billing: 'monthly',
            nextBilling: '2025-02-01',
            contractEnd: '2025-12-31',
            category: 'Software',
            manager: 'Sarah Johnson',
            renewalAlert: 30,
            status: 'active',
            paymentMethod: 'Credit Card',
            usage: 85,
            tags: ['productivity', 'essential', 'cloud'],
            notes: 'Business Premium plan with 50 licenses. Includes Office apps, Exchange, SharePoint.',
            attachments: [],
            payments: [
              { id: '1-1', date: '2025-01-01', amount: 299, status: 'paid', method: 'Credit Card', reference: 'INV-2025-001' }
            ],
            lastPaymentStatus: 'paid'
          },
          {
            id: 2,
            company: 'Mizzen',
            service: 'Amazon Web Services',
            cost: 2400,
            billing: 'monthly',
            nextBilling: '2025-02-01',
            contractEnd: '2025-12-31',
            category: 'Infrastructure',
            manager: 'Michael Chen',
            renewalAlert: 60,
            status: 'active',
            paymentMethod: 'Invoice',
            usage: 92,
            tags: ['cloud', 'critical', 'infrastructure'],
            notes: 'Production and staging environments. Includes EC2, RDS, S3, CloudFront.',
            attachments: [],
            payments: [
              { id: '2-1', date: '2025-01-01', amount: 2400, status: 'pending', method: 'Invoice' }
            ],
            lastPaymentStatus: 'pending'
          },
          {
            id: 3,
            company: 'Fertmax',
            service: 'Salesforce CRM',
            cost: 150,
            billing: 'monthly',
            nextBilling: '2025-02-05',
            contractEnd: '2026-02-05',
            category: 'Sales',
            manager: '',
            renewalAlert: 45,
            status: 'active',
            paymentMethod: 'Bank Transfer',
            usage: 67,
            tags: ['crm', 'sales', 'customer-data'],
            notes: 'Sales Cloud Enterprise Edition with 25 user licenses.',
            attachments: [],
            payments: [
              { id: '3-1', date: '2024-12-05', amount: 150, status: 'overdue', method: 'Bank Transfer' }
            ],
            lastPaymentStatus: 'overdue'
          }
        ];
        setSubscriptions(demoData);
        localStorage.setItem('subscriptions_professional', JSON.stringify(demoData));
      }
    } catch {
      setSubscriptions([]);
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (subscriptions.length > 0) {
      localStorage.setItem('subscriptions_professional', JSON.stringify(subscriptions));
    }
  }, [subscriptions]);

  // Stats
  const stats = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'active');
    const monthly = active.reduce((total, sub) => {
      let cost = sub.cost;
      if (sub.billing === 'yearly') cost = sub.cost / 12;
      if (sub.billing === 'quarterly') cost = sub.cost / 3;
      return total + cost;
    }, 0);

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
      overdueCount
    };
  }, [subscriptions]);

  // Upcoming renewals
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

  // Filters
  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions;

    if (companyFilter !== 'all') {
      filtered = filtered.filter(sub => sub.company === companyFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(sub => sub.category === categoryFilter);
    }

    if (paymentFilter !== 'all') {
      filtered = filtered.filter(sub => sub.lastPaymentStatus === paymentFilter);
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
  }, [subscriptions, companyFilter, categoryFilter, paymentFilter, searchTerm]);

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
        mimeType: file.type
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

  const markAsPaid = (subscriptionId: number) => {
    setSubscriptions(subs =>
      subs.map(sub => {
        if (sub.id === subscriptionId) {
          const payment: Payment = {
            id: `${subscriptionId}-${Date.now()}`,
            date: new Date().toISOString(),
            amount: sub.cost,
            status: 'paid',
            method: sub.paymentMethod,
            reference: `PAY-${Date.now()}`
          };
          return {
            ...sub,
            payments: [...(sub.payments || []), payment],
            lastPaymentStatus: 'paid'
          };
        }
        return sub;
      })
    );
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(subscriptions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscriptions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
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

    if (editingId !== null) {
      setSubscriptions(subs =>
        subs.map(sub =>
          sub.id === editingId
            ? {
                ...sub,
                ...formData,
                cost: parsedCost,
                tags: currentTags,
                attachments: formData.attachments
              }
            : sub
        )
      );
    } else {
      const newSub: Subscription = {
        ...formData,
        id: Date.now(),
        cost: parsedCost,
        tags: currentTags,
        usage: formData.usage ? parseInt(formData.usage.toString()) : undefined,
        attachments: formData.attachments || [],
        payments: [],
        lastPaymentStatus: formData.lastPaymentStatus || 'pending'
      };
      setSubscriptions(subs => [...subs, newSub]);
    }

    resetForm();
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
      usage: undefined,
      tags: [],
      notes: '',
      attachments: [],
      payments: [],
      lastPaymentStatus: 'pending',
    });
    setCurrentTags([]);
    setTagInput('');
    setShowModal(false);
    setEditingId(null);
  };

  // ✅ Strip numeric cost from spread to satisfy SubscriptionForm
  const handleEdit = (sub: Subscription) => {
    const { id: _id, cost: _ignore, ...rest } = sub;
    setFormData({ ...rest, cost: sub.cost.toString() });
    setCurrentTags(sub.tags || []);
    setEditingId(sub.id);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this subscription? This action cannot be undone.')) {
      setSubscriptions(subs => subs.filter(s => s.id !== id));
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
      default: return '#6B7280';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9FAFB',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Navigation Header */}
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
            <button
              onClick={handleExport}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                color: '#6B7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Export Data
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                color: '#6B7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Help
            </button>
            <button style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              color: '#6B7280',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Settings
            </button>
            <div style={{ width: '1px', height: '24px', background: '#E5E7EB' }} />
            <button
              onClick={() => router.replace('/login')}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid #E5E7EB',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#F9FAFB';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }}>
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>

        {/* Page Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Subscription Management
          </h1>
          <p style={{ color: '#6B7280', fontSize: '14px' }}>
            Track, manage, and optimize your business subscriptions
          </p>
        </div>

        {/* Alerts Section */}
        {(upcomingRenewals.length > 0 || stats.overdueCount > 0) && (
          <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {upcomingRenewals.length > 0 && (
              <div style={{
                padding: '16px',
                background: '#FEF3C7',
                border: '1px solid #FCD34D',
                borderRadius: '8px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#F59E0B">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#92400E', marginBottom: '4px' }}>
                    {upcomingRenewals.length} Upcoming Renewal{upcomingRenewals.length > 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '14px', color: '#78350F' }}>
                    {upcomingRenewals.map((sub, idx) => (
                      <span key={sub.id}>
                        {sub.service} ({formatDate(sub.nextBilling)})
                        {idx < upcomingRenewals.length - 1 ? ' • ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {stats.overdueCount > 0 && (
              <div style={{
                padding: '16px',
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#DC2626">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#991B1B', marginBottom: '4px' }}>
                    {stats.overdueCount} Overdue Payment{stats.overdueCount > 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '14px', color: '#7F1D1D' }}>
                    Review and process overdue payments to avoid service disruptions
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metrics Cards */}
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
            trendUp={true}
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            }
          />
          <MetricCard
            label="Annual Projection"
            value={formatCurrency(parseFloat(stats.yearly))}
            trend="-3.2%"
            trendUp={false}
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            }
          />
          <MetricCard
            label="Active Subscriptions"
            value={stats.active.toString()}
            sublabel={`of ${stats.total} total`}
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2a1 1 0 100 2 2 2 0 002 2v1a1 1 0 11-2 0v-1H6v1a1 1 0 11-2 0v-1a2 2 0 01-2-2V5z" clipRule="evenodd" />
              </svg>
            }
          />
          <MetricCard
            label="Vendors"
            value={stats.vendors.toString()}
            sublabel="unique providers"
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            }
          />
          <MetricCard
            label="Payment Status"
            value={`${stats.paidCount}/${stats.total}`}
            sublabel="paid this period"
            alert={stats.overdueCount > 0}
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            }
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
              <svg
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                width="16" height="16" viewBox="0 0 20 20" fill="#9CA3AF">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
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
              style={{
                padding: '8px 12px',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                fontSize: '14px',
                background: '#FFFFFF',
                cursor: 'pointer',
                minWidth: '120px',
                outline: 'none'
              }}>
              <option value="all">All Companies</option>
              {COMPANIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                fontSize: '14px',
                background: '#FFFFFF',
                cursor: 'pointer',
                minWidth: '120px',
                outline: 'none'
              }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                fontSize: '14px',
                background: '#FFFFFF',
                cursor: 'pointer',
                minWidth: '120px',
                outline: 'none'
              }}>
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
                first>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
                </svg>
              </ViewToggleButton>
              <ViewToggleButton
                active={viewMode === 'table'}
                onClick={() => setViewMode('table')}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
                </svg>
              </ViewToggleButton>
              <ViewToggleButton
                active={viewMode === 'analytics'}
                onClick={() => setViewMode('analytics')}
                last>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </ViewToggleButton>
            </div>

            {/* Add Button */}
            <button
              onClick={() => setShowModal(true)}
              style={{
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
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#4338CA'}
              onMouseLeave={e => e.currentTarget.style.background = '#4F46E5'}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Subscription
            </button>
          </div>
        </div>

        {/* Content Area */}
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
                onMarkPaid={() => markAsPaid(sub.id)}
                onUpload={(e: ChangeEvent<HTMLInputElement>) => handleFileUpload(e, sub.id)}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                getCompanyColor={getCompanyColor}
              />
            ))}
          </div>
        ) : viewMode === 'table' ? (
          <TableView
            subscriptions={filteredSubscriptions}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onMarkPaid={markAsPaid}
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
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '48px',
            textAlign: 'center'
          }}>
            <svg width="64" height="64" viewBox="0 0 20 20" fill="#E5E7EB" style={{ margin: '0 auto 16px' }}>
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
              Analytics Coming Soon
            </h3>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>
              Advanced analytics and reporting features are under development
            </p>
          </div>
        )}

        {/* Modals */}
        {showModal && <FormModal
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
        />}

        {showDocumentsModal && selectedSubscription && <DocumentsModal
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
        />}

        {/* Help Modal */}
        {showHelpModal && (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              zIndex: 1000
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowHelpModal(false);
            }}
          >
            <div style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{
                padding: '24px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: 0 }}>
                  How to Manage Variable Cost Subscriptions
                </h2>
                <button onClick={() => setShowHelpModal(false)} style={{
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
                {/* Overview Section */}
                <div style={{
                  background: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#5B21B6', marginBottom: '8px' }}>
                    🎯 Perfect for Microsoft 365, Azure, AWS & Usage-Based Services
                  </h3>
                  <p style={{ fontSize: '14px', color: '#6D28D9', margin: 0 }}>
                    Track subscriptions that change monthly based on usage, user count, or consumption.
                    The system automatically calculates averages, detects cost spikes, and maintains history.
                  </p>
                </div>

                {/* Step by Step Guide */}
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
                  Setting Up Variable Cost Subscriptions
                </h3>

                <div style={{ display: 'grid', gap: '16px' }}>
                  {/* Step 1 */}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '16px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      background: '#4F46E5',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '600',
                      flexShrink: 0
                    }}>1</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                        Add Your Subscription
                      </h4>
                      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>
                        Click "Add Subscription" and fill in the basic details:
                      </p>
                      <div style={{
                        background: 'white',
                        padding: '12px',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#374151'
                      }}>
                        <div>Service: "Microsoft 365 Business"</div>
                        <div>Cost: 299 <span style={{ color: '#6B7280' }}>(enter base or average)</span></div>
                        <div>Billing: Monthly</div>
                        <div>Category: Software</div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '16px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      background: '#4F46E5',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '600',
                      flexShrink: 0
                    }}>2</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                        Add Variable Cost Tags
                      </h4>
                      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>
                        Add tags to identify this as a variable cost subscription:
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '4px 12px',
                          background: '#EDE9FE',
                          color: '#5B21B6',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>variable-cost</span>
                        <span style={{
                          padding: '4px 12px',
                          background: '#DBEAFE',
                          color: '#1E40AF',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>azure</span>
                        <span style={{
                          padding: '4px 12px',
                          background: '#FEF3C7',
                          color: '#92400E',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>usage-based</span>
                        <span style={{
                          padding: '4px 12px',
                          background: '#D1FAE5',
                          color: '#065F46',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>seat-based</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px' }}>
                        Any subscription with these tags will show a purple "VARIABLE" badge and enable quick updates
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '16px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      background: '#4F46E5',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '600',
                      flexShrink: 0
                    }}>3</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                        Add Tracking Notes (Optional)
                      </h4>
                      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '8px' }}>
                        Use the Notes field to track important details:
                      </p>
                      <div style={{
                        background: 'white',
                        padding: '12px',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#374151',
                        whiteSpace: 'pre-wrap'
                      }}>
{`Base: 10 licenses @ $22/each = $220
Typical range: $220-$440
Current: 15 licenses
Review: Monthly on the 5th
Contact: licenses@microsoft.com`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Update Process */}
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
                  Monthly Update Process
                </h3>

                <div style={{
                  background: '#F0F9FF',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#0369A1', marginBottom: '12px' }}>
                    📅 Recommended Monthly Workflow
                  </h4>
                  <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#0C4A6E' }}>
                    <li style={{ marginBottom: '8px' }}>Set a monthly review day (e.g., 5th of each month)</li>
                    <li style={{ marginBottom: '8px' }}>Look for subscriptions with the purple <span style={{
                      padding: '2px 6px',
                      background: '#F3E8FF',
                      borderRadius: '8px',
                      fontWeight: '600',
                      color: '#6B21A8',
                      fontSize: '11px'
                    }}>VARIABLE</span> badge</li>
                    <li style={{ marginBottom: '8px' }}>Click the purple "Update" button on each card</li>
                    <li style={{ marginBottom: '8px' }}>Enter the actual cost from your invoice</li>
                    <li>Add notes about what changed (optional)</li>
                  </ol>
                </div>

                {/* Features Grid */}
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>
                  What Gets Tracked Automatically
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                  <div style={{
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>📊</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>Cost History</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                      Complete history of all monthly costs with timestamps
                    </p>
                  </div>

                  <div style={{
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>📈</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>6-Month Average</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                      Rolling average to identify your typical spending
                    </p>
                  </div>

                  <div style={{
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>⚡</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>Variance Alerts</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                      Visual indicators when costs spike above normal
                    </p>
                  </div>

                  <div style={{
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>👥</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>License Tracking</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                      Track user counts or unit consumption over time
                    </p>
                  </div>

                  <div style={{
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>💰</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>Min/Max Range</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                      See your lowest and highest costs at a glance
                    </p>
                  </div>

                  <div style={{
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>📝</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>Change Notes</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
                      Document why costs changed each month
                    </p>
                  </div>
                </div>

                {/* Examples Section */}
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
                  Real-World Examples
                </h3>

                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{
                    padding: '16px',
                    background: '#F5F3FF',
                    borderRadius: '8px',
                    border: '1px solid #DDD6FE'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#5B21B6', marginBottom: '8px' }}>
                      Microsoft 365 (Seat-Based)
                    </h4>
                    <div style={{ fontSize: '12px', color: '#6D28D9' }}>
                      <div>Base: 10 licenses × $22 = $220/mo</div>
                      <div>Current: 15 licenses × $22 = $330/mo</div>
                      <div>Variance: +15% from 6-month average</div>
                      <div style={{ marginTop: '4px' }}>
                        Tags: <code style={{ background: '#EDE9FE', padding: '2px 6px', borderRadius: '4px' }}>variable-cost</code> <code style={{ background: '#EDE9FE', padding: '2px 6px', borderRadius: '4px' }}>microsoft</code> <code style={{ background: '#EDE9FE', padding: '2px 6px', borderRadius: '4px' }}>seat-based</code>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: '16px',
                    background: '#EFF6FF',
                    borderRadius: '8px',
                    border: '1px solid #DBEAFE' /* FIXED */
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1E40AF', marginBottom: '8px' }}>
                      Azure Cloud (Consumption-Based)
                    </h4>
                    <div style={{ fontSize: '12px', color: '#1E3A8A' }}>
                      <div>Base commitment: $1,000/mo</div>
                      <div>Current usage: $2,456/mo</div>
                      <div>6-month average: $1,823/mo</div>
                      <div style={{ marginTop: '4px' }}>
                        Tags: <code style={{ background: '#DBEAFE', padding: '2px 6px', borderRadius: '4px' }}>variable-cost</code> <code style={{ background: '#DBEAFE', padding: '2px 6px', borderRadius: '4px' }}>azure</code> <code style={{ background: '#DBEAFE', padding: '2px 6px', borderRadius: '4px' }}>usage-based</code>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: '16px',
                    background: '#FEF3C7',
                    borderRadius: '8px',
                    border: '1px solid #FDE68A'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#92400E', marginBottom: '8px' }}>
                      AWS (Variable Usage)
                    </h4>
                    <div style={{ fontSize: '12px', color: '#78350F' }}>
                      <div>Monthly range: $1,800 - $3,200</div>
                      <div>Current month: $2,856</div>
                      <div>Alert: Spike detected (+42% from average)</div>
                      <div style={{ marginTop: '4px' }}>
                        Tags: <code style={{ background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>variable-cost</code> <code style={{ background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>aws</code> <code style={{ background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>cloud</code>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tips Section */}
                <div style={{
                  background: '#F0FDF4',
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '24px'
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#166534', marginBottom: '12px' }}>
                    💡 Pro Tips
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#166534' }}>
                    <li style={{ marginBottom: '6px' }}>Set calendar reminders for your monthly review day</li>
                    <li style={{ marginBottom: '6px' }}>Upload invoices as attachments for audit trail</li>
                    <li style={{ marginBottom: '6px' }}>Use consistent tags across similar services</li>
                    <li style={{ marginBottom: '6px' }}>Track license counts to identify optimization opportunities</li>
                    <li>Review 6-month trends quarterly to negotiate better rates</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Component: Metric Card
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

// Component: View Toggle Button
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

// Component: Empty State
const EmptyState = ({ onAddClick }: any) => (
  <div style={{
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '48px',
    textAlign: 'center'
  }}>
    <svg width="64" height="64" viewBox="0 0 20 20" fill="#E5E7EB" style={{ margin: '0 auto 16px' }}>
      <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
    </svg>
    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
      No subscriptions found
    </h3>
    <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '24px' }}>
      Get started by adding your first subscription to begin tracking
    </p>
    <button onClick={onAddClick} style={{
      padding: '10px 20px',
      background: '#4F46E5',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'background 0.2s'
    }}
    onMouseEnter={e => e.currentTarget.style.background = '#4338CA'}
    onMouseLeave={e => e.currentTarget.style.background = '#4F46E5'}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
      </svg>
      Add Your First Subscription
    </button>
  </div>
);

// Component: Subscription Card
const SubscriptionCard = ({ subscription: sub, onEdit, onDelete, onViewDocuments, onMarkPaid, onUpload, formatCurrency, formatDate, getCompanyColor }: any) => {
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
    <div style={{
      background: '#FFFFFF',
      border: sub.lastPaymentStatus === 'overdue' ? '1px solid #FCA5A5' : '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '20px',
      transition: 'all 0.2s',
      position: 'relative'
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = 'none';
    }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
            <span style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '500',
              background: statusColors.bg,
              color: statusColors.text
            }}>
              {sub.status.toUpperCase()}
            </span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '500',
              background: paymentColors.bg,
              color: paymentColors.text
            }}>
              {(sub.lastPaymentStatus || 'pending').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Cost */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
          {formatCurrency(sub.cost)}
          <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: '400' }}>
            /{sub.billing === 'monthly' ? 'mo' : sub.billing === 'yearly' ? 'yr' : 'qtr'}
          </span>
        </div>
      </div>

      {/* Usage Bar */}
      {sub.usage !== undefined && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>Usage</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#111827' }}>{sub.usage}%</span>
          </div>
          <div style={{ height: '6px', background: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${sub.usage}%`,
              height: '100%',
              background: sub.usage > 80 ? '#DC2626' : sub.usage > 60 ? '#F59E0B' : '#10B981',
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
        <DetailRow label="Documents" value={`${sub.attachments?.length || 0} files`} />
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

        {sub.lastPaymentStatus !== 'paid' && (
          <ActionButton onClick={onMarkPaid} success>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Mark Paid
          </ActionButton>
        )}

        <label style={{
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
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#F9FAFB';
          e.currentTarget.style.borderColor = '#D1D5DB';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = '#FFFFFF';
          e.currentTarget.style.borderColor = '#E5E7EB';
        }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a3 3 0 003 3h4a3 3 0 003-3V7a3 3 0 00-3-3H8zm0 2h4a1 1 0 011 1v4a1 1 0 01-1 1H8a1 1 0 01-1-1V7a1 1 0 011-1z" clipRule="evenodd" />
            <path d="M8 9a1 1 0 000 2h4a1 1 0 100-2H8z" />
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

// Component: Detail Row
const DetailRow = ({ label, value }: any) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: '12px', color: '#6B7280' }}>{label}</span>
    <span style={{ fontSize: '12px', fontWeight: '500', color: '#111827' }}>{value}</span>
  </div>
);

// Component: Action Button
const ActionButton = ({ onClick, children, primary, success, danger }: any) => {
  let baseColor = '#6B7280';
  let hoverColor = '#4B5563';
  let bgColor = '#FFFFFF';
  let hoverBg = '#F9FAFB';

  if (primary) {
    baseColor = '#4F46E5';
    hoverColor = '#4338CA';
  } else if (success) {
    baseColor = '#059669';
    hoverColor = '#047857';
  } else if (danger) {
    baseColor = '#DC2626';
    hoverColor = '#B91C1C';
  }

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
        e.currentTarget.style.borderColor = '#D1D5DB';
        e.currentTarget.style.color = hoverColor;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = bgColor;
        e.currentTarget.style.borderColor = '#E5E7EB';
        e.currentTarget.style.color = baseColor;
      }}>
      {children}
    </button>
  );
};

// Component: Table View
const TableView = ({ subscriptions, onEdit, onDelete, onMarkPaid, onUpload, onViewDocuments, formatCurrency, formatDate, getCompanyColor }: any) => (
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
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>
              Company / Service
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>
              Cost
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>
              Payment Status
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>
              Next Billing
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>
              Category
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>
              Documents
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub: any, idx: number) => (
            <tr key={sub.id} style={{ borderBottom: idx < subscriptions.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <td style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: getCompanyColor(sub.company),
                    flexShrink: 0
                  }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{sub.service}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>{sub.company}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                  {formatCurrency(sub.cost)}
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>
                  {sub.billing}
                </div>
              </td>
              <td style={{ padding: '16px' }}>
                <PaymentStatusBadge status={sub.lastPaymentStatus} />
              </td>
              <td style={{ padding: '16px', fontSize: '14px', color: '#374151' }}>
                {formatDate(sub.nextBilling)}
              </td>
              <td style={{ padding: '16px' }}>
                <span style={{
                  padding: '4px 8px',
                  background: '#F3F4F6',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#374151'
                }}>
                  {sub.category}
                </span>
              </td>
              <td style={{ padding: '16px' }}>
                <button
                  onClick={() => onViewDocuments(sub)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#6B7280',
                    cursor: 'pointer'
                  }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clipRule="evenodd" />
                  </svg>
                  {sub.attachments?.length || 0} files
                </button>
              </td>
              <td style={{ padding: '16px' }}>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                  <TableActionButton onClick={() => onEdit(sub)} title="Edit">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </TableActionButton>
                  {sub.lastPaymentStatus !== 'paid' && (
                    <TableActionButton onClick={() => onMarkPaid(sub.id)} title="Mark as Paid">
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </TableActionButton>
                  )}
                  <TableActionButton onClick={() => onDelete(sub.id)} title="Delete" danger>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </TableActionButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Component: Table Action Button
const TableActionButton = ({ onClick, title, children, danger }: any) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      padding: '6px',
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '4px',
      color: danger ? '#DC2626' : '#6B7280',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      transition: 'all 0.2s'
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = danger ? '#FEE2E2' : '#F9FAFB';
      e.currentTarget.style.color = danger ? '#B91C1C' : '#374151';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = '#FFFFFF';
      e.currentTarget.style.color = danger ? '#DC2626' : '#6B7280';
    }}>
    {children}
  </button>
);

// Component: Payment Status Badge
const PaymentStatusBadge = ({ status }: any) => {
  const colors = {
    paid: { bg: '#D1FAE5', text: '#065F46' },
    pending: { bg: '#FEF3C7', text: '#78350F' },
    overdue: { bg: '#FEE2E2', text: '#991B1B' }
  };

  const style = colors[status as keyof typeof colors] || colors.pending;

  return (
    <span style={{
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '500',
      background: style.bg,
      color: style.text
    }}>
      {(status || 'pending').toUpperCase()}
    </span>
  );
};

// Component: Form Modal
const FormModal = ({ editingId, formData, setFormData, currentTags, tagInput, setTagInput, onSubmit, onClose, onAddTag, onRemoveTag, onFileUpload, formatFileSize, COMPANIES, CATEGORIES, PAYMENT_METHODS }: any) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000
  }}
  onClick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}>
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      width: '100%',
      maxWidth: '720px',
      maxHeight: '90vh',
      overflow: 'auto',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
    }}>
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: 0 }}>
          {editingId ? 'Edit Subscription' : 'Add New Subscription'}
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

      <form onSubmit={onSubmit} style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          <FormField label="Company" required>
            <select
              value={formData.company}
              onChange={e => setFormData({ ...formData, company: e.target.value as Company })}
              required
              style={inputStyle}>
              {COMPANIES.map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Service Name" required>
            <input
              type="text"
              value={formData.service}
              onChange={e => setFormData({ ...formData, service: e.target.value })}
              placeholder="e.g., Microsoft 365"
              required
              style={inputStyle}
            />
          </FormField>

          <FormField label="Cost" required>
            <input
              type="number"
              step="0.01"
              value={formData.cost}
              onChange={e => setFormData({ ...formData, cost: e.target.value })}
              placeholder="99.99"
              required
              style={inputStyle}
            />
          </FormField>

          <FormField label="Billing Cycle">
            <select
              value={formData.billing}
              onChange={e => setFormData({ ...formData, billing: e.target.value as Subscription['billing'] })}
              style={inputStyle}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </FormField>

          <FormField label="Category">
            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              style={inputStyle}>
              {CATEGORIES.map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Payment Status">
            <select
              value={formData.lastPaymentStatus}
              onChange={e => setFormData({ ...formData, lastPaymentStatus: e.target.value as Subscription['lastPaymentStatus'] })}
              style={inputStyle}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </FormField>

          <FormField label="Next Billing Date">
            <input
              type="date"
              value={formData.nextBilling || ''}
              onChange={e => setFormData({ ...formData, nextBilling: e.target.value })}
              style={inputStyle}
            />
          </FormField>

          <FormField label="Contract End Date">
            <input
              type="date"
              value={formData.contractEnd || ''}
              onChange={e => setFormData({ ...formData, contractEnd: e.target.value })}
              style={inputStyle}
            />
          </FormField>

          <FormField label="Payment Method">
            <select
              value={formData.paymentMethod}
              onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
              style={inputStyle}>
              {PAYMENT_METHODS.map((m: string) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Account Manager" optional>
            <input
              type="text"
              value={formData.manager || ''}
              onChange={e => setFormData({ ...formData, manager: e.target.value })}
              placeholder="Optional"
              style={inputStyle}
            />
          </FormField>

          <FormField label="Renewal Alert (days)">
            <input
              type="number"
              value={formData.renewalAlert}
              onChange={e => setFormData({ ...formData, renewalAlert: parseInt(e.target.value) || 30 })}
              min="0"
              style={inputStyle}
            />
          </FormField>

          <FormField label="Usage (%)">
            <input
              type="number"
              value={formData.usage || ''}
              onChange={e => setFormData({ ...formData, usage: parseInt(e.target.value) || undefined })}
              placeholder="0-100"
              min="0"
              max="100"
              style={inputStyle}
            />
          </FormField>
        </div>

        <div style={{ marginTop: '20px' }}>
          <FormField label="Tags" optional>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {currentTags.map((tag: string) => (
                <span key={tag} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  background: '#F3F4F6',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#374151'
                }}>
                  {tag}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9CA3AF',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex'
                    }}>
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), onAddTag())}
                placeholder="Add a tag..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={onAddTag}
                style={{
                  padding: '8px 16px',
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}>
                Add
              </button>
            </div>
          </FormField>
        </div>

        <div style={{ marginTop: '20px' }}>
          <FormField label="Documents" optional>
            <div style={{
              border: '2px dashed #E5E7EB',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              background: '#F9FAFB'
            }}>
              <label style={{ cursor: 'pointer' }}>
                <svg width="40" height="40" viewBox="0 0 20 20" fill="#9CA3AF" style={{ margin: '0 auto 8px' }}>
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                  Click to upload or drag and drop
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                  PDF, DOC, DOCX, JPG, PNG (max 10MB)
                </div>
                <input
                  type="file"
                  style={{ display: 'none' }}
                  onChange={onFileUpload}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </label>
            </div>

            {formData.attachments && formData.attachments.length > 0 && (
              <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
                {formData.attachments.map((att: any) => (
                  <div key={att.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: '#F9FAFB',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="#6B7280">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clipRule="evenodd" />
                    </svg>
                    <span style={{ flex: 1, fontSize: '14px', color: '#374151' }}>{att.name}</span>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>{formatFileSize(att.size)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const filtered = (formData.attachments || []).filter((a: any) => a.id !== att.id);
                        setFormData({ ...formData, attachments: filtered });
                      }}
                      style={{
                        padding: '4px 8px',
                        background: '#FEE2E2',
                        color: '#DC2626',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FormField>
        </div>

        <div style={{ marginTop: '20px' }}>
          <FormField label="Notes" optional>
            <textarea
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional information about this subscription..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </FormField>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #E5E7EB'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#FFFFFF',
              color: '#374151',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
            {editingId ? 'Save Changes' : 'Add Subscription'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

// Component: Documents Modal
const DocumentsModal = ({ subscription, onClose, onUpload, onDownload, formatDate, formatFileSize }: any) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000
  }}
  onClick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}>
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      width: '100%',
      maxWidth: '600px',
      maxHeight: '80vh',
      overflow: 'auto',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
    }}>
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
            Documents
          </h2>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>{subscription.service}</p>
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
        {(!subscription.attachments || subscription.attachments.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <svg width="48" height="48" viewBox="0 0 20 20" fill="#E5E7EB" style={{ margin: '0 auto 12px' }}>
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clipRule="evenodd" />
            </svg>
            <p style={{ color: '#6B7280', marginBottom: '4px' }}>No documents uploaded yet</p>
            <p style={{ color: '#9CA3AF', fontSize: '14px' }}>Upload contracts, invoices, and other files</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {subscription.attachments.map((att: any) => (
              <div key={att.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                background: '#F9FAFB',
                borderRadius: '8px',
                border: '1px solid #E5E7EB'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: att.type === 'contract' ? '#DBEAFE' : att.type === 'invoice' ? '#FEF3C7' : '#F3F4F6',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 20 20" fill={att.type === 'contract' ? '#2563EB' : att.type === 'invoice' ? '#F59E0B' : '#6B7280'}>
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-5L9 2H4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginBottom: '4px' }}>
                    {att.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {formatFileSize(att.size)} • Uploaded {formatDate(att.uploadDate)}
                  </div>
                </div>
                <button
                  onClick={() => onDownload(att)}
                  style={{
                    padding: '8px 16px',
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}>
                  Download
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '24px' }}>
          <label style={{
            display: 'block',
            padding: '12px',
            background: '#F9FAFB',
            border: '2px dashed #E5E7EB',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer'
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="#9CA3AF" style={{ margin: '0 auto 4px' }}>
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span style={{ fontSize: '14px', color: '#374151' }}>Upload New Document</span>
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={onUpload}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
          </label>
        </div>
      </div>
    </div>
  </div>
);

// Component: Form Field
const FormField = ({ label, required, optional, children }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <label style={{
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      {label}
      {required && <span style={{ color: '#DC2626' }}>*</span>}
      {optional && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>(Optional)</span>}
    </label>
    {children}
  </div>
);

// Input styles
const inputStyle = {
  padding: '8px 12px',
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s',
  background: '#FFFFFF'
} as const;
