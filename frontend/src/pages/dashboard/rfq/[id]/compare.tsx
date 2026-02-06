import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  DollarSign,
  Clock,
  Users,
  Award,
  CheckCircle,
  XCircle,
  Loader2,
  Trophy,
  X,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme } from '@/styles/dashboardTheme';
import { QuoteComparison, RFQLineItem, QuoteLineItem } from '@/types/rfq-extended';
import RFQStatusBadge from '@/components/RFQStatusBadge';

const currencyFormatter = (currency: string = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

const CompareQuotesPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  const [comparison, setComparison] = useState<QuoteComparison | null>(null);
  const [rfqTitle, setRfqTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [awardNotes, setAwardNotes] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [normalizedData, setNormalizedData] = useState<any>(null);
  const [normalizeWarnings, setNormalizeWarnings] = useState<string[]>([]);

  const handleNormalizeQuotes = async () => {
    if (!comparison) return;
    setNormalizing(true);
    setNormalizeWarnings([]);
    try {
      // Build quotes array from the comparison data
      const quotes = supplierColumns.map((col) => {
        const firstQuote = comparison.line_items
          .flatMap((li) => li.quotes)
          .find((q) => q.response_id === col.response_id);
        const qi = firstQuote?.quote_item;
        return {
          supplier_id: col.response_id,
          supplier_name: col.name,
          unit_price: qi?.unit_price || 0,
          currency: 'USD',
          unit_of_measure: qi?.unit_of_measure || 'each',
          quantity_offered: qi?.quantity_offered ?? undefined,
          lead_time_days: qi?.lead_time_days ?? undefined,
          incoterm: 'FOB',
        };
      });

      const res = await api.post('/api/v1/ai/normalize-quotes', {
        buyer_currency: 'USD',
        buyer_uom: 'each',
        buyer_incoterm: 'FOB',
        quotes,
      });
      setNormalizedData(res.data);
      if (res.data.warnings?.length) setNormalizeWarnings(res.data.warnings);
    } catch {
      // handled by interceptor
    } finally {
      setNormalizing(false);
    }
  };

  useEffect(() => {
    if (id) fetchComparison();
  }, [id]);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const [compRes, rfqRes] = await Promise.all([
        api.get(`/api/v1/rfqs/${id}/compare`),
        api.get(`/api/v1/rfqs/${id}`),
      ]);
      setComparison(compRes.data);
      setRfqTitle(rfqRes.data.title || `RFQ #${id}`);
    } catch {
      // error toast handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  // Derive unique supplier columns
  const supplierColumns = comparison
    ? Array.from(
        new Map(
          comparison.line_items.flatMap((li) =>
            li.quotes.map((q) => [q.response_id, q.supplier_company_name]),
          ),
        ),
      ).map(([response_id, name]) => ({ response_id, name }))
    : [];

  // Summary metrics
  const allQuoteItems = comparison
    ? comparison.line_items.flatMap((li) => li.quotes.map((q) => q.quote_item))
    : [];

  const totalResponses = supplierColumns.length;

  const supplierTotals = supplierColumns.map((col) => {
    const total = comparison!
      ? comparison.line_items.reduce((sum, li) => {
          const quote = li.quotes.find((q) => q.response_id === col.response_id);
          return sum + (quote?.quote_item.total_price || quote?.quote_item.unit_price || 0);
        }, 0)
      : 0;
    return { ...col, total };
  });

  const lowestTotal = supplierTotals.length > 0 ? Math.min(...supplierTotals.map((s) => s.total)) : 0;
  const avgPrice =
    supplierTotals.length > 0
      ? supplierTotals.reduce((s, c) => s + c.total, 0) / supplierTotals.length
      : 0;
  const fastestLead =
    allQuoteItems.length > 0
      ? Math.min(...allQuoteItems.filter((q) => q.lead_time_days).map((q) => q.lead_time_days!))
      : 0;

  const bestValueIdx =
    supplierTotals.length > 0
      ? supplierTotals.findIndex((s) => s.total === lowestTotal)
      : -1;

  const getLowestPriceForItem = (lineItemId: string): number | null => {
    if (!comparison) return null;
    const liData = comparison.line_items.find((li) => li.line_item.id === lineItemId);
    if (!liData) return null;
    const prices = liData.quotes
      .map((q) => q.quote_item.unit_price)
      .filter((p): p is number => p != null && p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  const handleAward = async () => {
    if (!selectedResponseId) return;
    setAwarding(true);
    try {
      await api.post(`/api/v1/rfqs/${id}/award`, {
        response_id: selectedResponseId,
        po_number: poNumber || undefined,
        award_notes: awardNotes || undefined,
      });
      setShowAwardModal(false);
      fetchComparison();
    } catch {
      // handled by interceptor
    } finally {
      setAwarding(false);
    }
  };

  const fmt = currencyFormatter('USD');

  // ─── Skeleton loader ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-secondary-50">
        <div className={dashboardTheme.decorativeBackground.container}>
          <div className={dashboardTheme.decorativeBackground.orb1} />
          <div className={dashboardTheme.decorativeBackground.orb2} />
        </div>
        <div className={dashboardTheme.mainContent.container}>
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-10 w-10 rounded-xl bg-secondary-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-64 rounded-lg bg-secondary-200 animate-pulse" />
              <div className="h-4 w-40 rounded-lg bg-secondary-100 animate-pulse" />
            </div>
          </div>
          {/* Summary cards skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass p-6 border border-white/50"
              >
                <div className="h-4 w-24 rounded bg-secondary-200 animate-pulse mb-3" />
                <div className="h-8 w-20 rounded bg-secondary-100 animate-pulse" />
              </div>
            ))}
          </div>
          {/* Table skeleton */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-4 border-b border-secondary-100 last:border-0">
                <div className="h-5 w-48 rounded bg-secondary-200 animate-pulse" />
                <div className="h-5 w-24 rounded bg-secondary-100 animate-pulse" />
                <div className="h-5 w-24 rounded bg-secondary-100 animate-pulse" />
                <div className="h-5 w-24 rounded bg-secondary-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────
  if (!comparison || comparison.line_items.length === 0 || supplierColumns.length === 0) {
    return (
      <div className="min-h-screen bg-secondary-50">
        <div className={dashboardTheme.decorativeBackground.container}>
          <div className={dashboardTheme.decorativeBackground.orb1} />
          <div className={dashboardTheme.decorativeBackground.orb2} />
        </div>
        <div className={dashboardTheme.mainContent.container}>
          <Link
            href={`/dashboard/post-rfq`}
            className="inline-flex items-center gap-2 text-sm text-secondary-500 hover:text-primary-600 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to RFQs
          </Link>
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-secondary-100 rounded-2xl flex items-center justify-center mb-6">
              <BarChart3 className="w-10 h-10 text-secondary-400" />
            </div>
            <h2 className="text-2xl font-bold text-secondary-900 font-display mb-2">
              No Responses Yet
            </h2>
            <p className="text-secondary-500 max-w-md">
              Supplier quotes will appear here once they respond to your RFQ. You can invite more
              suppliers to increase participation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Background */}
      <div className={dashboardTheme.decorativeBackground.container}>
        <div className={dashboardTheme.decorativeBackground.orb1} />
        <div className={dashboardTheme.decorativeBackground.orb2} />
      </div>

      <div className={dashboardTheme.mainContent.container}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <Link
              href={`/dashboard/post-rfq`}
              className="inline-flex items-center gap-2 text-sm text-secondary-500 hover:text-primary-600 mb-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to RFQs
            </Link>
            <h1 className="text-2xl lg:text-3xl font-bold text-secondary-900 font-display">
              Quote Comparison
            </h1>
            <p className="text-secondary-500 text-sm mt-1">{rfqTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNormalizeQuotes}
              disabled={normalizing}
              className={`${normalizing ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.secondary} flex items-center gap-2`}
            >
              {normalizing ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Normalizing...</>
              ) : (
                <><Sparkles className="w-4 h-4" />Normalize Quotes</>
              )}
            </button>
            <button
              onClick={() => setShowAwardModal(true)}
              className={`${dashboardTheme.buttons.primary} flex items-center gap-2`}
            >
              <Award className="w-4 h-4" />
              Award RFQ
            </button>
          </div>
        </div>

        {/* Normalized data banner */}
        {normalizedData && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6 mb-4 space-y-3">
            <h3 className="text-sm font-semibold text-secondary-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-600" />
              Normalized Quote Ranking
            </h3>
            {normalizeWarnings.length > 0 && (
              <div className="space-y-1 mb-2">
                {normalizeWarnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={dashboardTheme.tables.header}>
                    <th className={dashboardTheme.tables.headerCell}>Rank</th>
                    <th className={dashboardTheme.tables.headerCell}>Supplier</th>
                    <th className={`${dashboardTheme.tables.headerCell} text-right`}>Normalized Price</th>
                    <th className={`${dashboardTheme.tables.headerCell} text-right`}>Savings vs Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {(normalizedData.ranking || []).map((r: any, idx: number) => (
                    <tr key={r.supplier_id || idx} className={dashboardTheme.tables.row}>
                      <td className={dashboardTheme.tables.cell}>#{idx + 1}</td>
                      <td className={`${dashboardTheme.tables.cell} font-medium`}>{r.supplier_name}</td>
                      <td className={`${dashboardTheme.tables.cell} text-right`}>
                        {fmt.format(r.normalized_unit_price ?? r.normalized_price ?? 0)}
                      </td>
                      <td className={`${dashboardTheme.tables.cell} text-right`}>
                        {r.savings_vs_avg != null ? `${r.savings_vs_avg > 0 ? '+' : ''}${r.savings_vs_avg.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total Responses',
              value: totalResponses.toString(),
              icon: Users,
              color: 'gold' as const,
            },
            {
              label: 'Lowest Total',
              value: fmt.format(lowestTotal),
              icon: DollarSign,
              color: 'success' as const,
            },
            {
              label: 'Average Price',
              value: fmt.format(avgPrice),
              icon: BarChart3,
              color: 'info' as const,
            },
            {
              label: 'Fastest Lead Time',
              value: fastestLead > 0 ? `${fastestLead} days` : '—',
              icon: Clock,
              color: 'warning' as const,
            },
          ].map((metric) => (
            <div key={metric.label} className={dashboardTheme.analytics.metricCard.blue}>
              <div className="flex items-center gap-3 mb-3">
                <div className={dashboardTheme.analytics.iconContainer[metric.color]}>
                  <metric.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider mb-1">
                {metric.label}
              </p>
              <p className="text-2xl font-bold text-secondary-900 font-display">{metric.value}</p>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              {/* Column Headers */}
              <thead>
                <tr className={dashboardTheme.tables.header}>
                  <th className={`${dashboardTheme.tables.headerCell} sticky left-0 z-10 bg-secondary-50 min-w-[220px]`}>
                    Line Item
                  </th>
                  <th className={`${dashboardTheme.tables.headerCell} w-20 text-center`}>Qty</th>
                  {supplierColumns.map((col, idx) => (
                    <th
                      key={col.response_id}
                      className={`${dashboardTheme.tables.headerCell} min-w-[180px] text-center`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="truncate max-w-[160px]">{col.name}</span>
                        {idx === bestValueIdx && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded-full text-[10px] font-semibold uppercase">
                            <Trophy className="w-3 h-3" />
                            Best Value
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Rows */}
              <tbody>
                {comparison.line_items.map((lineData) => {
                  const li = lineData.line_item;
                  const lowestPrice = getLowestPriceForItem(li.id);

                  return (
                    <tr key={li.id} className={dashboardTheme.tables.row}>
                      {/* Sticky line item cell */}
                      <td className={`${dashboardTheme.tables.cell} sticky left-0 z-10 bg-white font-medium`}>
                        <div>
                          <span className="text-secondary-400 text-xs mr-1.5">#{li.line_number}</span>
                          {li.description}
                        </div>
                        {li.part_number && (
                          <span className="text-xs text-secondary-400">PN: {li.part_number}</span>
                        )}
                      </td>
                      <td className={`${dashboardTheme.tables.cell} text-center`}>
                        {li.quantity ?? '—'}
                        {li.unit_of_measure && (
                          <span className="text-xs text-secondary-400 ml-1">
                            {li.unit_of_measure}
                          </span>
                        )}
                      </td>

                      {/* Supplier quote cells */}
                      {supplierColumns.map((col) => {
                        const quoteData = lineData.quotes.find(
                          (q) => q.response_id === col.response_id,
                        );
                        const qi = quoteData?.quote_item;

                        if (!qi) {
                          return (
                            <td
                              key={col.response_id}
                              className={`${dashboardTheme.tables.cell} text-center text-secondary-300`}
                            >
                              —
                            </td>
                          );
                        }

                        const isLowest =
                          qi.unit_price != null && lowestPrice != null && qi.unit_price === lowestPrice;

                        return (
                          <td key={col.response_id} className={`${dashboardTheme.tables.cell} text-center`}>
                            <div className="space-y-1">
                              {/* Price */}
                              <div
                                className={`text-sm font-semibold ${
                                  isLowest ? 'text-green-600' : 'text-secondary-900'
                                }`}
                              >
                                {qi.unit_price != null ? fmt.format(qi.unit_price) : '—'}
                                {isLowest && (
                                  <span className="ml-1 text-[10px] font-medium text-green-600">
                                    ★
                                  </span>
                                )}
                              </div>
                              {/* Lead time */}
                              {qi.lead_time_days != null && (
                                <div className="text-xs text-secondary-500">
                                  {qi.lead_time_days}d lead
                                </div>
                              )}
                              {/* Compliance */}
                              <div className="flex justify-center">
                                {qi.is_compliant ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-400" />
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals row */}
              <tfoot>
                <tr className="bg-secondary-50 border-t-2 border-secondary-200">
                  <td className="px-6 py-4 text-sm font-bold text-secondary-900 sticky left-0 z-10 bg-secondary-50">
                    Total
                  </td>
                  <td />
                  {supplierTotals.map((col, idx) => (
                    <td
                      key={col.response_id}
                      className={`px-6 py-4 text-center text-sm font-bold ${
                        idx === bestValueIdx ? 'text-green-700' : 'text-secondary-900'
                      }`}
                    >
                      {fmt.format(col.total)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Award Modal ──────────────────────────────────────────── */}
      {showAwardModal && (
        <div className={dashboardTheme.modals.overlay} onClick={() => setShowAwardModal(false)}>
          <div
            className={dashboardTheme.modals.container}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={dashboardTheme.modals.header}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-secondary-900 font-display">Award RFQ</h2>
                <button
                  onClick={() => setShowAwardModal(false)}
                  className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className={dashboardTheme.modals.body}>
              <div className="space-y-5">
                {/* Select Supplier */}
                <div>
                  <label className={dashboardTheme.forms.label}>Select Winning Supplier</label>
                  <select
                    value={selectedResponseId || ''}
                    onChange={(e) => setSelectedResponseId(e.target.value || null)}
                    className={dashboardTheme.forms.select}
                  >
                    <option value="">— Choose a supplier —</option>
                    {supplierTotals.map((s) => (
                      <option key={s.response_id} value={s.response_id}>
                        {s.name} — {fmt.format(s.total)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* PO Number */}
                <div>
                  <label className={dashboardTheme.forms.label}>
                    PO Number <span className="text-secondary-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PO-2026-0042"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className={dashboardTheme.forms.input}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className={dashboardTheme.forms.label}>
                    Award Notes <span className="text-secondary-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Any additional notes about this award..."
                    value={awardNotes}
                    onChange={(e) => setAwardNotes(e.target.value)}
                    className={dashboardTheme.forms.textarea}
                  />
                </div>
              </div>
            </div>

            <div className={dashboardTheme.modals.footer}>
              <button
                onClick={() => setShowAwardModal(false)}
                className={dashboardTheme.buttons.secondary}
              >
                Cancel
              </button>
              <button
                onClick={handleAward}
                disabled={!selectedResponseId || awarding}
                className={
                  !selectedResponseId || awarding
                    ? dashboardTheme.buttons.disabled
                    : dashboardTheme.buttons.primary
                }
              >
                {awarding ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Awarding...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Confirm Award
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompareQuotesPage;
