import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  Check,
  ChevronDown,
  Download,
  FileText,
  GitCompare,
  Loader2,
  MoreVertical,
  Send,
  ToggleLeft,
  ToggleRight,
  Trophy,
  X,
  AlertCircle,
  BarChart3,
  DollarSign,
  Clock,
  Package,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme, getStatusBadgeClass } from '@/styles/dashboardTheme';
import DashboardNav from '@/components/DashboardNav';
import { RFQResponse } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  item_number: number;
  description: string;
  part_number?: string;
  quantity: number;
  uom: string;
  target_unit_price?: number;
}

interface SupplierQuote {
  id: string;
  supplier_id: string;
  supplier_company_name: string;
  supplier_company_id: string;
  total_price: number;
  overall_lead_time_days: number;
  status: string;
  submitted_at: string;
  line_item_prices: {
    line_item_number: number;
    unit_price: number;
    total_price: number;
    lead_time_days?: number;
    moq?: number;
  }[];
}

interface RFPComparison {
  rfp_id: string;
  rfp_title: string;
  line_items: LineItem[];
  quotes: SupplierQuote[];
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'];
const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const UOM_OPTIONS = ['each', 'pcs', 'kg', 'lbs', 'meters', 'feet', 'liters', 'gallons', 'tons'];

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);

const getHighlightClass = (price: number, allPrices: number[]): string => {
  const validPrices = allPrices.filter(p => p > 0);
  if (validPrices.length === 0 || price <= 0) return '';
  const best = Math.min(...validPrices);
  const worst = Math.max(...validPrices);
  if (price === best) return 'bg-green-50 text-green-700';
  if (price === worst && validPrices.length > 1) return 'bg-red-50 text-red-700';
  if (price <= best * 1.05) return 'bg-amber-50 text-amber-700';
  return '';
};

const getResponseStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    submitted: dashboardTheme.badges.info,
    under_review: dashboardTheme.badges.warning,
    accepted: dashboardTheme.badges.success,
    rejected: dashboardTheme.badges.error,
  };
  return styles[status?.toLowerCase()] || dashboardTheme.badges.neutral;
};

// ── Component ────────────────────────────────────────────────────────────────

const QuoteComparisonPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState<RFPComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [normalizeEnabled, setNormalizeEnabled] = useState(false);
  const [normCurrency, setNormCurrency] = useState('USD');
  const [normIncoterm, setNormIncoterm] = useState('FOB');
  const [normUOM, setNormUOM] = useState('each');
  const [normalizing, setNormalizing] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [showBAFOModal, setShowBAFOModal] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardSupplierId, setAwardSupplierId] = useState('');
  const [awardPONumber, setAwardPONumber] = useState('');
  const [awardNotes, setAwardNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bafoMessage, setBafoMessage] = useState('');

  useEffect(() => {
    if (id) fetchComparison();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/rfqs/${id}/compare`);
      const compData = res.data as RFPComparison;
      setData(compData);
      // Select all suppliers by default
      if (compData.quotes?.length) {
        setSelectedSuppliers(new Set(compData.quotes.map(q => q.supplier_id)));
      }
    } catch {
      setError('Failed to load comparison data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNormalize = async () => {
    if (!data) return;
    setNormalizing(true);
    try {
      const res = await api.post('/api/v1/ai/normalize-quotes', {
        rfp_id: id,
        target_currency: normCurrency,
        target_incoterm: normIncoterm,
        target_uom: normUOM,
      });
      if (res.data) {
        setData(prev => prev ? { ...prev, quotes: res.data.quotes || prev.quotes } : prev);
      }
    } catch {
      // handled
    } finally {
      setNormalizing(false);
    }
  };

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  };

  const toggleAllSuppliers = () => {
    if (!data) return;
    if (selectedSuppliers.size === data.quotes.length) {
      setSelectedSuppliers(new Set());
    } else {
      setSelectedSuppliers(new Set(data.quotes.map(q => q.supplier_id)));
    }
  };

  const handleRequestBAFO = async () => {
    setSubmitting(true);
    try {
      await api.post(`/api/v1/rfqs/${id}/bafo`, {
        supplier_ids: Array.from(selectedSuppliers),
        message: bafoMessage,
      });
      setShowBAFOModal(false);
      setBafoMessage('');
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleAward = async () => {
    setSubmitting(true);
    try {
      await api.post(`/api/v1/rfqs/${id}/award`, {
        supplier_id: awardSupplierId,
        po_number: awardPONumber,
        notes: awardNotes,
      });
      setShowAwardModal(false);
      router.push(`/rfps/${id}`);
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Line Item', 'Description', 'Qty', 'UOM', ...data.quotes.map(q => q.supplier_company_name)];
    const rows = data.line_items.map(li => {
      const prices = data.quotes.map(q => {
        const lip = q.line_item_prices.find(p => p.line_item_number === li.item_number);
        return lip ? `$${lip.unit_price.toFixed(2)} (total: $${lip.total_price.toFixed(2)})` : '—';
      });
      return [String(li.item_number), li.description, String(li.quantity), li.uom, ...prices];
    });

    const totalRow = ['', 'TOTAL', '', '', ...data.quotes.map(q => formatCurrency(q.total_price))];
    const csvContent = [headers, ...rows, totalRow].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfp-${id}-comparison.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'RFPs', href: '/rfps' }, { label: 'Compare Quotes' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64">
              <div className="h-5 w-40 rounded bg-secondary-200 animate-pulse mb-6" />
              <div className={`${dashboardTheme.cards.primary} p-8 mb-6`}>
                <div className="h-8 w-72 rounded bg-secondary-200 animate-pulse mb-4" />
                <div className="h-4 w-48 rounded bg-secondary-100 animate-pulse" />
              </div>
              {/* Skeleton grid */}
              <div className={`${dashboardTheme.cards.primary} p-6`}>
                <div className="grid grid-cols-4 gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-10 rounded bg-secondary-100 animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'RFPs', href: '/rfps' }, { label: 'Compare Quotes' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64 flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-secondary-900 font-display mb-2">{error || 'Data not found'}</h2>
              <p className="text-secondary-500 mb-6">Unable to load comparison data.</p>
              <div className="flex gap-3">
                <button onClick={() => router.back()} className={dashboardTheme.buttons.secondary}>Go Back</button>
                <button onClick={fetchComparison} className={dashboardTheme.buttons.primary}>Try Again</button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Single Quote State ─────────────────────────────────────────────────────
  if (data.quotes.length < 2) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'RFPs', href: '/rfps' }, { label: data.rfp_title, href: `/rfps/${id}` }, { label: 'Compare' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64">
              <Link href={`/rfps/${id}`} className="inline-flex items-center gap-2 text-sm text-secondary-500 hover:text-primary-600 mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to RFP
              </Link>
              <div className={`${dashboardTheme.cards.primary} p-12 text-center`}>
                <GitCompare className="w-16 h-16 text-secondary-300 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-secondary-900 font-display mb-2">
                  {data.quotes.length === 0 ? 'No Quotes Yet' : 'Need More Quotes'}
                </h2>
                <p className="text-sm text-secondary-500 mb-6">
                  {data.quotes.length === 0
                    ? 'You haven\'t received any quotes for this RFP yet.'
                    : 'Add more quotes for a side-by-side comparison.'}
                </p>
                <Link href={`/rfps/${id}`} className={dashboardTheme.buttons.primary}>
                  Back to RFP
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────────
  const lineItems = data.line_items;
  const quotes = data.quotes;

  return (
    <>
      <DashboardNav breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'RFPs', href: '/rfps' }, { label: data.rfp_title, href: `/rfps/${id}` }, { label: 'Compare' }]} />
      <div className="min-h-screen bg-secondary-50 pb-24">
        <div className={dashboardTheme.decorativeBackground.container}>
          <div className={dashboardTheme.decorativeBackground.orb1} />
          <div className={dashboardTheme.decorativeBackground.orb2} />
        </div>

        <div className={dashboardTheme.mainContent.container}>
          <div className="lg:ml-64">
            <Link href={`/rfps/${id}`} className="inline-flex items-center gap-2 text-sm text-secondary-500 hover:text-primary-600 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to RFP
            </Link>

            {/* ── Header ───────────────────────────────────────────────── */}
            <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8 mb-6`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-secondary-900 font-display mb-1">{data.rfp_title}</h1>
                  <p className="text-sm text-secondary-500">{quotes.length} quotes received</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-secondary-600">Normalize</span>
                  <button
                    onClick={() => setNormalizeEnabled(!normalizeEnabled)}
                    className="text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    {normalizeEnabled ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-secondary-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Normalization Bar */}
              {normalizeEnabled && (
                <div className="mt-4 p-4 bg-primary-50/50 border border-primary-100 rounded-xl">
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <label className="text-xs font-medium text-secondary-600 block mb-1">Currency</label>
                      <select
                        value={normCurrency}
                        onChange={e => setNormCurrency(e.target.value)}
                        className={`${dashboardTheme.forms.select} w-28`}
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-secondary-600 block mb-1">Incoterm</label>
                      <select
                        value={normIncoterm}
                        onChange={e => setNormIncoterm(e.target.value)}
                        className={`${dashboardTheme.forms.select} w-28`}
                      >
                        {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-secondary-600 block mb-1">UOM</label>
                      <select
                        value={normUOM}
                        onChange={e => setNormUOM(e.target.value)}
                        className={`${dashboardTheme.forms.select} w-28`}
                      >
                        {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={handleNormalize}
                      disabled={normalizing}
                      className={`${normalizing ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.primary} flex items-center gap-2`}
                    >
                      {normalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                      Apply Normalization
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Comparison Grid ──────────────────────────────────────── */}
            <div className={`${dashboardTheme.cards.primary} overflow-hidden mb-6`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  {/* Header: supplier columns */}
                  <thead>
                    <tr className="bg-secondary-50 border-b border-secondary-200">
                      <th className="sticky left-0 z-10 bg-secondary-50 px-6 py-4 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wider min-w-[220px] border-r border-secondary-200">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedSuppliers.size === quotes.length}
                            onChange={toggleAllSuppliers}
                            className={dashboardTheme.forms.checkbox}
                          />
                          Line Item
                        </div>
                      </th>
                      {quotes.map(q => (
                        <th key={q.supplier_id} className="px-6 py-4 text-center min-w-[200px]">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedSuppliers.has(q.supplier_id)}
                              onChange={() => toggleSupplier(q.supplier_id)}
                              className={dashboardTheme.forms.checkbox}
                            />
                            <span className="text-sm font-semibold text-secondary-900">{q.supplier_company_name}</span>
                          </div>
                          <div className="text-xs text-secondary-500 space-y-1">
                            <p className="font-semibold text-lg text-secondary-900">{formatCurrency(q.total_price)}</p>
                            <p>{q.overall_lead_time_days} days lead time</p>
                            <span className={getResponseStatusBadge(q.status)}>{q.status}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map(li => {
                      const allPricesForItem = quotes.map(q => {
                        const lip = q.line_item_prices.find(p => p.line_item_number === li.item_number);
                        return lip?.unit_price || 0;
                      });

                      return (
                        <tr key={li.item_number} className="border-b border-secondary-100 last:border-0">
                          <td className="sticky left-0 z-10 bg-white px-6 py-4 border-r border-secondary-200">
                            <div className="text-sm font-medium text-secondary-900">{li.description}</div>
                            <div className="text-xs text-secondary-400 mt-1">
                              {li.part_number && <span className="mr-3">Part: {li.part_number}</span>}
                              Qty: {li.quantity} {li.uom}
                            </div>
                          </td>
                          {quotes.map(q => {
                            const lip = q.line_item_prices.find(p => p.line_item_number === li.item_number);
                            const highlight = lip ? getHighlightClass(lip.unit_price, allPricesForItem) : '';
                            return (
                              <td key={q.supplier_id} className={`px-6 py-4 text-center ${highlight}`}>
                                {lip ? (
                                  <div>
                                    <p className="text-sm font-semibold">{formatCurrency(lip.unit_price)}</p>
                                    <p className="text-xs text-secondary-500 mt-0.5">Total: {formatCurrency(lip.total_price)}</p>
                                    {lip.lead_time_days && (
                                      <p className="text-xs text-secondary-400 mt-0.5 flex items-center justify-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {lip.lead_time_days}d
                                      </p>
                                    )}
                                    {lip.moq && (
                                      <p className="text-xs text-secondary-400">MOQ: {lip.moq}</p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-secondary-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Total Row */}
                    <tr className="bg-secondary-50 font-semibold">
                      <td className="sticky left-0 z-10 bg-secondary-50 px-6 py-4 border-r border-secondary-200 text-sm text-secondary-900">
                        TOTAL
                      </td>
                      {quotes.map(q => {
                        const allTotals = quotes.map(qu => qu.total_price);
                        const highlight = getHighlightClass(q.total_price, allTotals);
                        return (
                          <td key={q.supplier_id} className={`px-6 py-4 text-center ${highlight}`}>
                            <p className="text-lg font-bold">{formatCurrency(q.total_price)}</p>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-6 text-xs text-secondary-500">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-50 border border-green-200" />
                Best price
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200" />
                Within 5% of best
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-50 border border-red-200" />
                Highest price
              </div>
            </div>
          </div>
        </div>

        {/* ── Sticky Action Bar ──────────────────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-secondary-200 shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="lg:ml-64 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-secondary-500">
                {selectedSuppliers.size} of {quotes.length} suppliers selected
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleExportCSV}
                  className={`${dashboardTheme.buttons.outlined} flex items-center gap-2`}
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={() => setShowBAFOModal(true)}
                  disabled={selectedSuppliers.size === 0}
                  className={`${selectedSuppliers.size === 0 ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.secondary} flex items-center gap-2`}
                >
                  <Send className="w-4 h-4" />
                  Request BAFO
                </button>
                <button
                  onClick={() => setShowAwardModal(true)}
                  disabled={selectedSuppliers.size === 0}
                  className={`${selectedSuppliers.size === 0 ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.primary} flex items-center gap-2`}
                >
                  <Trophy className="w-4 h-4" />
                  Award to Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BAFO Modal ───────────────────────────────────────────────── */}
      {showBAFOModal && (
        <div className={dashboardTheme.modals.overlay} onClick={() => setShowBAFOModal(false)}>
          <div className={dashboardTheme.modals.container} onClick={e => e.stopPropagation()}>
            <div className={dashboardTheme.modals.header}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-secondary-900 font-display">Request Best and Final Offer</h2>
                <button onClick={() => setShowBAFOModal(false)} className="p-2 text-secondary-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-secondary-500 mt-1">
                Send a BAFO request to {selectedSuppliers.size} selected supplier{selectedSuppliers.size > 1 ? 's' : ''}
              </p>
            </div>
            <div className={dashboardTheme.modals.body}>
              <div className="mb-4">
                <p className="text-sm text-secondary-600 mb-2">Selected suppliers:</p>
                <div className="flex flex-wrap gap-2">
                  {quotes.filter(q => selectedSuppliers.has(q.supplier_id)).map(q => (
                    <span key={q.supplier_id} className={dashboardTheme.badges.info}>{q.supplier_company_name}</span>
                  ))}
                </div>
              </div>
              <label className={dashboardTheme.forms.label}>Message (optional)</label>
              <textarea
                value={bafoMessage}
                onChange={e => setBafoMessage(e.target.value)}
                rows={4}
                placeholder="Include any specific instructions or areas where you'd like improved pricing..."
                className={dashboardTheme.forms.textarea}
              />
            </div>
            <div className={dashboardTheme.modals.footer}>
              <button onClick={() => setShowBAFOModal(false)} className={dashboardTheme.buttons.secondary}>Cancel</button>
              <button
                onClick={handleRequestBAFO}
                disabled={submitting}
                className={`${submitting ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.primary} flex items-center gap-2`}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Sending...' : 'Send BAFO Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Award Modal ──────────────────────────────────────────────── */}
      {showAwardModal && (
        <div className={dashboardTheme.modals.overlay} onClick={() => setShowAwardModal(false)}>
          <div className={dashboardTheme.modals.container} onClick={e => e.stopPropagation()}>
            <div className={dashboardTheme.modals.header}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-secondary-900 font-display flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Award RFP
                </h2>
                <button onClick={() => setShowAwardModal(false)} className="p-2 text-secondary-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className={dashboardTheme.modals.body}>
              <div className="space-y-4">
                <div>
                  <label className={dashboardTheme.forms.label}>Award to Supplier</label>
                  <select
                    value={awardSupplierId}
                    onChange={e => setAwardSupplierId(e.target.value)}
                    className={dashboardTheme.forms.select}
                  >
                    <option value="">Select supplier...</option>
                    {quotes.filter(q => selectedSuppliers.has(q.supplier_id)).map(q => (
                      <option key={q.supplier_id} value={q.supplier_id}>
                        {q.supplier_company_name} — {formatCurrency(q.total_price)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={dashboardTheme.forms.label}>PO Number</label>
                  <input
                    type="text"
                    value={awardPONumber}
                    onChange={e => setAwardPONumber(e.target.value)}
                    placeholder="e.g., PO-2026-001"
                    className={dashboardTheme.forms.input}
                  />
                </div>
                <div>
                  <label className={dashboardTheme.forms.label}>Notes</label>
                  <textarea
                    value={awardNotes}
                    onChange={e => setAwardNotes(e.target.value)}
                    rows={3}
                    placeholder="Additional notes for the supplier..."
                    className={dashboardTheme.forms.textarea}
                  />
                </div>
              </div>
            </div>
            <div className={dashboardTheme.modals.footer}>
              <button onClick={() => setShowAwardModal(false)} className={dashboardTheme.buttons.secondary}>Cancel</button>
              <button
                onClick={handleAward}
                disabled={submitting || !awardSupplierId}
                className={`${submitting || !awardSupplierId ? dashboardTheme.buttons.disabled : 'px-6 py-2.5 bg-green-600 text-white font-semibold text-sm rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-[0.98]'} flex items-center gap-2`}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                {submitting ? 'Awarding...' : 'Confirm Award'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QuoteComparisonPage;
