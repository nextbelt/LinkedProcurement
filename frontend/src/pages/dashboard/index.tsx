import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  FileText,
  Clock,
  TrendingUp,
  Award,
  AlertTriangle,
  Plus,
  Search,
  ArrowRight,
  Bell,
  Sparkles,
  ExternalLink,
  Users,
  Building2,
  Tag,
  Calendar,
  MessageSquare,
  CheckCircle,
  User,
  RefreshCw,
} from 'lucide-react';
import DashboardNav from '@/components/DashboardNav';
import { dashboardTheme, getStatusBadgeClass } from '@/styles/dashboardTheme';
import api from '@/lib/api';
import { RFQ, Notification } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(expiresAt: string): { text: string; urgent: boolean } {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { text: 'Expired', urgent: true };
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return {
    text: hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`,
    urgent: hours < 12,
  };
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function activityIcon(type: string) {
  switch (type) {
    case 'rfq_response':
      return <FileText className="w-4 h-4" />;
    case 'message':
      return <MessageSquare className="w-4 h-4" />;
    case 'rfq_update':
      return <RefreshCw className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}

function activityColor(type: string) {
  switch (type) {
    case 'rfq_response':
      return 'bg-green-100 text-green-600';
    case 'message':
      return 'bg-primary-100 text-primary-600';
    case 'rfq_update':
      return 'bg-amber-100 text-amber-600';
    default:
      return 'bg-secondary-100 text-secondary-600';
  }
}

// ── KPI Bar ──────────────────────────────────────────────────────────────────

interface KPIData {
  activeRfps: number;
  pendingQuotes: number;
  avgResponseTime: number;
  awardedThisMonth: number;
  trends: { active: number; pending: number; response: number; awarded: number };
}

function KPIBar({ data, loading }: { data: KPIData; loading: boolean }) {
  const cards = [
    {
      label: 'Active RFPs',
      value: data.activeRfps,
      icon: FileText,
      cardClass: dashboardTheme.analytics.metricCard.blue,
      iconClass: dashboardTheme.analytics.iconContainer.gold,
      valueClass: dashboardTheme.analytics.statValue.gold,
      trend: data.trends.active,
    },
    {
      label: 'Pending Quotes',
      value: data.pendingQuotes,
      icon: Clock,
      cardClass: dashboardTheme.analytics.metricCard.warning,
      iconClass: dashboardTheme.analytics.iconContainer.warning,
      valueClass: dashboardTheme.analytics.statValue.warning,
      trend: data.trends.pending,
    },
    {
      label: 'Avg Response Time',
      value: `${data.avgResponseTime}h`,
      icon: TrendingUp,
      cardClass: dashboardTheme.analytics.metricCard.success,
      iconClass: dashboardTheme.analytics.iconContainer.success,
      valueClass: dashboardTheme.analytics.statValue.success,
      trend: data.trends.response,
    },
    {
      label: 'Awarded This Month',
      value: data.awardedThisMonth,
      icon: Award,
      cardClass: dashboardTheme.analytics.metricCard.info,
      iconClass: dashboardTheme.analytics.iconContainer.info,
      valueClass: dashboardTheme.analytics.statValue.info,
      trend: data.trends.awarded,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={dashboardTheme.analytics.metricCard.blue}>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${dashboardTheme.loading.skeleton}`} />
              <div className={`w-16 h-4 ${dashboardTheme.loading.skeleton}`} />
            </div>
            <div className={`w-20 h-8 mb-1 ${dashboardTheme.loading.skeleton}`} />
            <div className={`w-24 h-4 ${dashboardTheme.loading.skeleton}`} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const trendPositive = card.trend >= 0;
        return (
          <div key={card.label} className={card.cardClass}>
            <div className="flex items-center justify-between mb-4">
              <div className={card.iconClass}>
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={
                  trendPositive
                    ? dashboardTheme.analytics.trendUp
                    : dashboardTheme.analytics.trendDown
                }
              >
                {trendPositive ? '↑' : '↓'}
                {Math.abs(card.trend)}% vs last month
              </span>
            </div>
            <p className={card.valueClass}>{card.value}</p>
            <p className={dashboardTheme.typography.bodySmall}>{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── RFPs at Risk ─────────────────────────────────────────────────────────────

function RFPsAtRisk({ rfqs, loading }: { rfqs: RFQ[]; loading: boolean }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const atRisk = rfqs.filter((r) => {
    if (!r.expires_at || r.status !== 'active') return false;
    const diff = new Date(r.expires_at).getTime() - now;
    return diff > 0 && diff <= 48 * 3_600_000;
  });

  if (loading) {
    return (
      <div className={`${dashboardTheme.cards.primary} ${dashboardTheme.cards.padding.medium}`}>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div className={`w-32 h-6 ${dashboardTheme.loading.skeleton}`} />
        </div>
        <div className={dashboardTheme.tables.container}>
          <table className={dashboardTheme.tables.table}>
            <thead className={dashboardTheme.tables.header}>
              <tr>
                {['Title', 'Category', 'Status', 'Responses', 'Time Left'].map((h) => (
                  <th key={h} className={dashboardTheme.tables.headerCell}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className={dashboardTheme.tables.row}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className={dashboardTheme.tables.cell}>
                      <div className={`w-full h-4 ${dashboardTheme.loading.skeleton}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={`${dashboardTheme.cards.primary} ${dashboardTheme.cards.padding.medium}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className={dashboardTheme.typography.heading4}>RFPs Expiring Soon</h3>
        </div>
        {atRisk.length > 0 && (
          <span className={dashboardTheme.badges.warning}>{atRisk.length} at risk</span>
        )}
      </div>

      {atRisk.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className={dashboardTheme.typography.body}>No RFPs at risk</p>
          <p className={dashboardTheme.typography.bodySmall}>
            All your active RFPs have more than 48 hours remaining.
          </p>
        </div>
      ) : (
        <div className={dashboardTheme.tables.container}>
          <table className={dashboardTheme.tables.table}>
            <thead className={dashboardTheme.tables.header}>
              <tr>
                <th className={dashboardTheme.tables.headerCell}>Title</th>
                <th className={dashboardTheme.tables.headerCell}>Category</th>
                <th className={dashboardTheme.tables.headerCell}>Status</th>
                <th className={dashboardTheme.tables.headerCell}>Responses</th>
                <th className={dashboardTheme.tables.headerCell}>Time Left</th>
              </tr>
            </thead>
            <tbody>
              {atRisk.map((rfq) => {
                const countdown = formatCountdown(rfq.expires_at!);
                return (
                  <tr key={rfq.id} className={dashboardTheme.tables.row}>
                    <td className={dashboardTheme.tables.cell}>
                      <Link
                        href={`/rfps/${rfq.id}`}
                        className="text-primary-600 hover:text-primary-700 font-medium hover:underline"
                      >
                        {rfq.title}
                      </Link>
                    </td>
                    <td className={dashboardTheme.tables.cell}>
                      <span className={dashboardTheme.badges.neutral}>
                        {rfq.material_category || 'General'}
                      </span>
                    </td>
                    <td className={dashboardTheme.tables.cell}>
                      <span className={getStatusBadgeClass(rfq.status)}>{rfq.status}</span>
                    </td>
                    <td className={dashboardTheme.tables.cell}>{rfq.response_count}</td>
                    <td className={dashboardTheme.tables.cell}>
                      <span
                        className={
                          countdown.urgent
                            ? dashboardTheme.badges.error
                            : dashboardTheme.badges.warning
                        }
                      >
                        {countdown.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Recent Activity ──────────────────────────────────────────────────────────

function RecentActivity({
  notifications,
  loading,
}: {
  notifications: Notification[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className={`${dashboardTheme.cards.primary} ${dashboardTheme.cards.padding.medium}`}>
        <h3 className={`${dashboardTheme.typography.heading4} mb-6`}>Recent Activity</h3>
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className={`w-8 h-8 rounded-full flex-shrink-0 ${dashboardTheme.loading.skeleton}`} />
              <div className="flex-1 space-y-2">
                <div className={`w-3/4 h-4 ${dashboardTheme.loading.skeleton}`} />
                <div className={`w-1/3 h-3 ${dashboardTheme.loading.skeleton}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const items = notifications.slice(0, 10);

  return (
    <div className={`${dashboardTheme.cards.primary} ${dashboardTheme.cards.padding.medium}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={dashboardTheme.typography.heading4}>Recent Activity</h3>
        <Link
          href="/dashboard/notifications"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center">
          <Bell className="w-8 h-8 text-secondary-300 mx-auto mb-2" />
          <p className={dashboardTheme.typography.bodySmall}>No recent activity yet.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-secondary-200" />

          <div className="space-y-5">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4 relative">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${activityColor(
                    item.type
                  )}`}
                >
                  {activityIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-secondary-900 font-medium leading-snug">
                    {item.title}
                  </p>
                  <p className="text-sm text-secondary-500 mt-0.5 line-clamp-2">{item.message}</p>
                  <p className={`${dashboardTheme.typography.caption} mt-1`}>
                    {relativeTime(item.created_at)}
                  </p>
                </div>
                {!item.is_read && (
                  <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions() {
  const router = useRouter();
  return (
    <div className={`${dashboardTheme.cards.primary} ${dashboardTheme.cards.padding.medium}`}>
      <h3 className={`${dashboardTheme.typography.heading4} mb-4`}>Quick Actions</h3>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => router.push('/dashboard/rfq/post')}
          className={dashboardTheme.buttons.primary + ' flex items-center gap-2'}
        >
          <Plus className="w-4 h-4" />
          Create RFP
        </button>
        <button
          onClick={() => router.push('/dashboard/suppliers')}
          className={dashboardTheme.buttons.secondary + ' flex items-center gap-2'}
        >
          <Search className="w-4 h-4" />
          Browse Suppliers
        </button>
        <Link
          href="/rfps"
          className={
            dashboardTheme.buttons.outlined +
            ' flex items-center gap-2 no-underline'
          }
        >
          <FileText className="w-4 h-4" />
          View All RFPs
        </Link>
      </div>
    </div>
  );
}

// ── Onboarding (Empty State) ─────────────────────────────────────────────────

function OnboardingWelcome() {
  const router = useRouter();
  const steps = [
    {
      num: 1,
      title: 'Complete your company profile',
      description: 'Add your business details, certifications and contact info.',
      href: '/dashboard/settings/company',
      icon: Building2,
      done: false,
    },
    {
      num: 2,
      title: 'Create your first RFP',
      description: 'Post a Request for Proposal to start sourcing materials.',
      href: '/dashboard/rfq/post',
      icon: FileText,
      done: false,
    },
    {
      num: 3,
      title: 'Invite suppliers',
      description: 'Search and invite trusted suppliers to respond to your RFPs.',
      href: '/dashboard/suppliers',
      icon: Users,
      done: false,
    },
  ];

  return (
    <div className={dashboardTheme.hero.container}>
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          <span className={dashboardTheme.badges.primary}>Getting Started</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-secondary-900 tracking-tight mb-2">
          Welcome to LinkedProcurement
        </h2>
        <p className="text-secondary-500 text-lg mb-8 max-w-xl">
          Complete these steps to set up your procurement workspace and start sourcing smarter.
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          {steps.map((step) => {
            const StepIcon = step.icon;
            return (
              <button
                key={step.num}
                onClick={() => router.push(step.href)}
                className={`${dashboardTheme.cards.primary} ${dashboardTheme.cards.padding.medium} ${dashboardTheme.cards.hover} text-left group`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={dashboardTheme.analytics.numberedBadge.blue}>
                    <span className={dashboardTheme.analytics.numberText.blue}>{step.num}</span>
                  </div>
                  <div className={dashboardTheme.analytics.iconContainer.gold}>
                    <StepIcon className="w-4 h-4" />
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-secondary-900 mb-1">{step.title}</h4>
                <p className={dashboardTheme.typography.caption}>{step.description}</p>
                <div className="mt-3 flex items-center gap-1 text-primary-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Get started <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────────────────────

const BuyerDashboard = () => {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpi, setKpi] = useState<KPIData>({
    activeRfps: 0,
    pendingQuotes: 0,
    avgResponseTime: 0,
    awardedThisMonth: 0,
    trends: { active: 12, pending: -5, response: 8, awarded: 15 },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rfqRes, notifRes] = await Promise.allSettled([
        api.get('/api/v1/rfqs'),
        api.get('/api/v1/notifications'),
      ]);

      // Process RFQs
      let rfqList: RFQ[] = [];
      if (rfqRes.status === 'fulfilled') {
        const d = rfqRes.value.data;
        rfqList = Array.isArray(d) ? d : d?.data ?? d?.rfqs ?? [];
      }
      setRfqs(rfqList);

      // Derive KPIs from RFQ list
      const activeCount = rfqList.filter((r) => r.status === 'active').length;
      const pendingCount = rfqList.reduce((sum, r) => sum + (r.response_count || 0), 0);
      const avgTime =
        rfqList.length > 0
          ? Math.round(
              rfqList.reduce((sum, r) => {
                const created = new Date(r.created_at).getTime();
                const updated = new Date(r.updated_at).getTime();
                return sum + (updated - created) / 3_600_000;
              }, 0) / rfqList.length
            )
          : 0;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const awardedCount = rfqList.filter(
        (r) => r.status === 'closed' && new Date(r.updated_at) >= startOfMonth
      ).length;

      setKpi((prev) => ({
        ...prev,
        activeRfps: activeCount,
        pendingQuotes: pendingCount,
        avgResponseTime: avgTime,
        awardedThisMonth: awardedCount,
      }));

      // Process notifications
      if (notifRes.status === 'fulfilled') {
        const nd = notifRes.value.data;
        setNotifications(Array.isArray(nd) ? nd : nd?.data ?? nd?.notifications ?? []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isEmpty = !loading && rfqs.length === 0 && notifications.length === 0;

  return (
    <DashboardNav breadcrumbs={[{ label: 'Dashboard' }]}>
      <div className="space-y-6 lg:space-y-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className={dashboardTheme.typography.heading3}>Dashboard</h1>
            <p className={dashboardTheme.typography.bodySmall}>
              Your procurement overview at a glance.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className={`${dashboardTheme.buttons.secondary} flex items-center gap-2`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className={dashboardTheme.analytics.insightCard.error}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Empty / Onboarding state */}
        {isEmpty && <OnboardingWelcome />}

        {/* Populated state */}
        {!isEmpty && (
          <>
            {/* KPI cards */}
            <KPIBar data={kpi} loading={loading} />

            {/* Two-column layout on large screens */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column — spans 2 */}
              <div className="lg:col-span-2 space-y-6">
                <RFPsAtRisk rfqs={rfqs} loading={loading} />
                <QuickActions />
              </div>

              {/* Right column */}
              <div className="space-y-6">
                <RecentActivity notifications={notifications} loading={loading} />
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardNav>
  );
};

export default BuyerDashboard;