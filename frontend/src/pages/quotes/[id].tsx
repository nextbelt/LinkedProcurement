import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Loader2,
  Package,
  Calendar,
  DollarSign,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme, getStatusBadgeClass } from '@/styles/dashboardTheme';
import DashboardNav from '@/components/DashboardNav';
import { RFQResponse } from '@/types';

interface QuoteLineItem {
  id: string;
  description: string;
  part_number?: string;
  quantity?: number;
  unit_of_measure?: string;
  unit_price?: number;
  total_price?: number;
}

interface TimelineEvent {
  id: string;
  status: string;
  timestamp: string;
  note?: string;
}

interface QuoteDetail extends RFQResponse {
  rfq_title?: string;
  line_items?: QuoteLineItem[];
  timeline?: TimelineEvent[];
}

const QuoteDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchQuote();
  }, [id]);

  const fetchQuote = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/rfq-responses/${id}`);
      setQuote(res.data);
    } catch {
      setError('Failed to load quote details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount?: number) => {
    if (amount == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Send className="w-5 h-5 text-blue-500" />;
      case 'under_review':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-secondary-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      submitted: 'Submitted',
      under_review: 'Under Review',
      accepted: 'Awarded',
      rejected: 'Rejected',
    };
    return map[status] ?? status;
  };

  const statusSteps = ['submitted', 'under_review', 'accepted'];

  const getCurrentStepIndex = (status: string) => {
    if (status === 'rejected') return -1;
    return statusSteps.indexOf(status);
  };

  // ─── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Quote Details' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64">
              <div className="h-5 w-32 rounded bg-secondary-200 animate-pulse mb-6" />
              <div className="h-8 w-64 rounded-lg bg-secondary-200 animate-pulse mb-8" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6">
                    <div className="h-4 w-24 rounded bg-secondary-200 animate-pulse mb-3" />
                    <div className="h-8 w-20 rounded bg-secondary-100 animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-4 py-4 border-b border-secondary-100 last:border-0">
                    <div className="h-5 w-48 rounded bg-secondary-200 animate-pulse" />
                    <div className="h-5 w-16 rounded bg-secondary-100 animate-pulse" />
                    <div className="h-5 w-20 rounded bg-secondary-100 animate-pulse" />
                    <div className="h-5 w-20 rounded bg-secondary-100 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Error state ───────────────────────────────────────────────
  if (error || !quote) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Quote Details' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64 flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-secondary-900 font-display mb-2">
                {error || 'Quote not found'}
              </h2>
              <p className="text-secondary-500 mb-6">Unable to load the requested quote.</p>
              <div className="flex gap-3">
                <button onClick={() => router.back()} className={dashboardTheme.buttons.secondary}>
                  Go Back
                </button>
                <button onClick={fetchQuote} className={dashboardTheme.buttons.primary}>
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const currentStep = getCurrentStepIndex(quote.status);
  const lineItems = quote.line_items ?? [];
  const timeline = quote.timeline ?? [];

  // Build a default timeline from quote data if API doesn't return one
  const displayTimeline: TimelineEvent[] =
    timeline.length > 0
      ? timeline
      : [
          {
            id: '1',
            status: 'submitted',
            timestamp: quote.created_at,
            note: 'Quote submitted',
          },
          ...(quote.responded_at
            ? [
                {
                  id: '2',
                  status: quote.status,
                  timestamp: quote.responded_at,
                  note: `Status changed to ${getStatusLabel(quote.status)}`,
                },
              ]
            : []),
        ];

  // ─── Main render ───────────────────────────────────────────────
  return (
    <>
      <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Opportunities', href: '/opportunities' }, { label: 'Quote Details' }]} />
      <div className="min-h-screen bg-secondary-50">
        <div className={dashboardTheme.decorativeBackground.container}>
          <div className={dashboardTheme.decorativeBackground.orb1} />
          <div className={dashboardTheme.decorativeBackground.orb2} />
        </div>

        <div className={dashboardTheme.mainContent.container}>
          <div className="lg:ml-64">
            {/* Back button */}
            <Link
              href="/opportunities"
              className="inline-flex items-center gap-2 text-sm text-secondary-500 hover:text-primary-600 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Opportunities
            </Link>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-secondary-900 font-display">
                  Quote Details
                </h1>
                {quote.rfq_title && (
                  <p className="text-secondary-500 text-sm mt-1">For: {quote.rfq_title}</p>
                )}
              </div>
              <span className={getStatusBadgeClass(quote.status)}>
                {getStatusLabel(quote.status)}
              </span>
            </div>

            {/* Status Progress */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6 mb-6">
              <h2 className="text-sm font-semibold text-secondary-700 uppercase tracking-wider mb-4">
                Quote Status
              </h2>
              {quote.status === 'rejected' ? (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-700">Quote Rejected</p>
                    <p className="text-sm text-red-600">This quote was not selected for this RFQ.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-0">
                  {statusSteps.map((step, idx) => {
                    const isCompleted = idx <= currentStep;
                    const isCurrent = idx === currentStep;
                    return (
                      <React.Fragment key={step}>
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                              isCompleted
                                ? 'bg-primary-600 border-primary-600 text-white'
                                : 'bg-white border-secondary-200 text-secondary-400'
                            } ${isCurrent ? 'ring-4 ring-primary-100' : ''}`}
                          >
                            {getStatusIcon(step)}
                          </div>
                          <span
                            className={`mt-2 text-xs font-medium ${
                              isCompleted ? 'text-primary-700' : 'text-secondary-400'
                            }`}
                          >
                            {getStatusLabel(step)}
                          </span>
                        </div>
                        {idx < statusSteps.length - 1 && (
                          <div
                            className={`flex-1 h-0.5 mx-2 mt-[-1.25rem] ${
                              idx < currentStep ? 'bg-primary-500' : 'bg-secondary-200'
                            }`}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className={dashboardTheme.analytics.metricCard.blue}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={dashboardTheme.analytics.iconContainer.gold}>
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider mb-1">Price Quote</p>
                <p className="text-2xl font-bold text-secondary-900 font-display">
                  {quote.price_quote ? `$${quote.price_quote}` : '—'}
                </p>
              </div>
              <div className={dashboardTheme.analytics.metricCard.blue}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={dashboardTheme.analytics.iconContainer.info}>
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider mb-1">Lead Time</p>
                <p className="text-2xl font-bold text-secondary-900 font-display">
                  {quote.lead_time_days ? `${quote.lead_time_days} days` : '—'}
                </p>
              </div>
              <div className={dashboardTheme.analytics.metricCard.blue}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={dashboardTheme.analytics.iconContainer.success}>
                    <Package className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider mb-1">Min. Order Qty</p>
                <p className="text-2xl font-bold text-secondary-900 font-display">
                  {quote.minimum_order_quantity || '—'}
                </p>
              </div>
            </div>

            {/* Message */}
            {quote.message && (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6 mb-6">
                <h2 className="text-sm font-semibold text-secondary-700 uppercase tracking-wider mb-3">
                  Message
                </h2>
                <p className="text-secondary-700 text-sm whitespace-pre-wrap">{quote.message}</p>
              </div>
            )}

            {/* Line Items Table */}
            {lineItems.length > 0 && (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-secondary-100">
                  <h2 className="text-sm font-semibold text-secondary-700 uppercase tracking-wider">
                    Line Items
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={dashboardTheme.tables.header}>
                        <th className={dashboardTheme.tables.headerCell}>Item</th>
                        <th className={`${dashboardTheme.tables.headerCell} text-center`}>Qty</th>
                        <th className={`${dashboardTheme.tables.headerCell} text-right`}>Unit Price</th>
                        <th className={`${dashboardTheme.tables.headerCell} text-right`}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item) => (
                        <tr key={item.id} className={dashboardTheme.tables.row}>
                          <td className={`${dashboardTheme.tables.cell} font-medium text-secondary-900`}>
                            <div>
                              {item.description}
                              {item.part_number && (
                                <span className="block text-xs text-secondary-400">PN: {item.part_number}</span>
                              )}
                            </div>
                          </td>
                          <td className={`${dashboardTheme.tables.cell} text-center`}>
                            {item.quantity ?? '—'}
                            {item.unit_of_measure && (
                              <span className="text-xs text-secondary-400 ml-1">{item.unit_of_measure}</span>
                            )}
                          </td>
                          <td className={`${dashboardTheme.tables.cell} text-right`}>
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className={`${dashboardTheme.tables.cell} text-right font-semibold`}>
                            {formatCurrency(item.total_price ?? (item.unit_price && item.quantity ? item.unit_price * item.quantity : undefined))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Timeline / Activity */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6">
              <h2 className="text-sm font-semibold text-secondary-700 uppercase tracking-wider mb-4">
                Activity Timeline
              </h2>
              <div className="space-y-0">
                {displayTimeline.map((event, idx) => (
                  <div key={event.id} className="flex gap-4">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                          idx === 0
                            ? 'bg-primary-600 border-primary-600'
                            : 'bg-white border-secondary-300'
                        }`}
                      />
                      {idx < displayTimeline.length - 1 && (
                        <div className="w-0.5 flex-1 bg-secondary-200 min-h-[2rem]" />
                      )}
                    </div>

                    {/* Event content */}
                    <div className="pb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={getStatusBadgeClass(event.status)}>
                          {getStatusLabel(event.status)}
                        </span>
                      </div>
                      <p className="text-xs text-secondary-400 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {formatDate(event.timestamp)}
                      </p>
                      {event.note && (
                        <p className="text-sm text-secondary-600 mt-1">{event.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuoteDetailPage;
