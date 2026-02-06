import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  GitCompare,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Plus,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  Star,
  Trophy,
  Upload,
  Users,
  X,
  AlertCircle,
  MapPin,
  DollarSign,
  BarChart3,
  Activity,
  HelpCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme, getStatusBadgeClass } from '@/styles/dashboardTheme';
import DashboardNav from '@/components/DashboardNav';
import { RFQ, RFQResponse, Company } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  item_number: number;
  description: string;
  part_number?: string;
  quantity: number;
  uom: string;
  target_unit_price?: number;
  specifications?: string;
}

interface QAThread {
  id: string;
  question: string;
  answer?: string;
  asked_by: string;
  asked_by_company?: string;
  answered_by?: string;
  asked_at: string;
  answered_at?: string;
}

interface ActivityEvent {
  id: string;
  type: 'created' | 'published' | 'invited' | 'quote_received' | 'awarded' | 'closed' | 'updated';
  description: string;
  timestamp: string;
  actor?: string;
}

interface Attachment {
  id: string;
  name: string;
  size: number;
  uploaded_at: string;
  url?: string;
}

interface InvitedSupplier {
  id: string;
  company_name: string;
  logo_url?: string;
  response_status: 'pending' | 'viewed' | 'responded' | 'declined';
}

interface RFPDetail extends RFQ {
  line_items?: LineItem[];
  qa_threads?: QAThread[];
  responses?: RFQResponse[];
  attachments_list?: Attachment[];
  activity?: ActivityEvent[];
  invited_suppliers?: InvitedSupplier[];
  budget_min?: number;
  budget_max?: number;
  currency?: string;
  sealed_bid?: boolean;
  nda_required?: boolean;
  required_certifications_list?: string[];
  buyer_company_logo?: string;
}

const TABS = ['Overview', 'Line Items', 'Q&A', 'Quotes', 'Attachments', 'Activity'];

const TAB_ICONS: Record<string, React.ElementType> = {
  'Overview': FileText,
  'Line Items': BarChart3,
  'Q&A': HelpCircle,
  'Quotes': DollarSign,
  'Attachments': Paperclip,
  'Activity': Activity,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatDateTime = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getCountdown = (deadline?: string): string => {
  if (!deadline) return '';
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return `Closed on ${formatDate(deadline)}`;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `Closes in ${days}d ${hours}h`;
};

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    draft: dashboardTheme.badges.neutral,
    active: dashboardTheme.badges.success,
    published: dashboardTheme.badges.success,
    closed: dashboardTheme.badges.error,
    awarded: dashboardTheme.badges.primary || dashboardTheme.badges.info,
    expired: dashboardTheme.badges.warning,
  };
  return styles[status?.toLowerCase()] || dashboardTheme.badges.neutral;
};

const getResponseStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    submitted: dashboardTheme.badges.info,
    under_review: dashboardTheme.badges.warning,
    accepted: dashboardTheme.badges.success,
    rejected: dashboardTheme.badges.error,
    pending: dashboardTheme.badges.neutral,
    viewed: dashboardTheme.badges.info,
    responded: dashboardTheme.badges.success,
    declined: dashboardTheme.badges.error,
  };
  return styles[status?.toLowerCase()] || dashboardTheme.badges.neutral;
};

const activityIcons: Record<string, { icon: React.ElementType; color: string }> = {
  created: { icon: Plus, color: 'bg-blue-500' },
  published: { icon: Eye, color: 'bg-green-500' },
  invited: { icon: Mail, color: 'bg-purple-500' },
  quote_received: { icon: DollarSign, color: 'bg-amber-500' },
  awarded: { icon: Trophy, color: 'bg-primary-500' },
  closed: { icon: Lock, color: 'bg-red-500' },
  updated: { icon: FileText, color: 'bg-secondary-400' },
};

// ── Component ────────────────────────────────────────────────────────────────

const RFPDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  const [rfp, setRfp] = useState<RFPDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [newQuestion, setNewQuestion] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [submittingAnswer, setSubmittingAnswer] = useState<string | null>(null);
  const [sortQuotes, setSortQuotes] = useState<'price' | 'lead_time' | 'date'>('date');
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (id) fetchRFP();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRFP = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/rfqs/${id}`);
      setRfp(res.data);
    } catch {
      setError('Failed to load RFP details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!newQuestion.trim()) return;
    setSubmittingQuestion(true);
    try {
      await api.post(`/api/v1/rfqs/${id}/qa`, { question: newQuestion });
      setNewQuestion('');
      fetchRFP();
    } catch {
      // handled by interceptor
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handlePostAnswer = async (threadId: string) => {
    const answer = answerInputs[threadId];
    if (!answer?.trim()) return;
    setSubmittingAnswer(threadId);
    try {
      await api.post(`/api/v1/rfqs/${id}/qa/${threadId}/answer`, { answer });
      setAnswerInputs(prev => ({ ...prev, [threadId]: '' }));
      fetchRFP();
    } catch {
      // handled
    } finally {
      setSubmittingAnswer(null);
    }
  };

  const handleShareLink = () => {
    const url = `${window.location.origin}/rfps/${id}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const sortedResponses = () => {
    const responses = rfp?.responses || [];
    return [...responses].sort((a, b) => {
      if (sortQuotes === 'price') {
        return Number(a.price_quote || 0) - Number(b.price_quote || 0);
      }
      if (sortQuotes === 'lead_time') {
        return (a.lead_time_days || 999) - (b.lead_time_days || 999);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const parseTags = (value?: string): string[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'RFPs', href: '/rfps' }, { label: 'Loading...' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64">
              <div className="h-5 w-32 rounded bg-secondary-200 animate-pulse mb-6" />
              <div className={`${dashboardTheme.cards.primary} p-8 mb-6`}>
                <div className="h-8 w-96 rounded bg-secondary-200 animate-pulse mb-4" />
                <div className="h-4 w-64 rounded bg-secondary-100 animate-pulse mb-2" />
                <div className="h-4 w-48 rounded bg-secondary-100 animate-pulse" />
              </div>
              <div className="flex gap-4 mb-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-10 w-24 rounded bg-secondary-200 animate-pulse" />
                ))}
              </div>
              <div className={`${dashboardTheme.cards.primary} p-8`}>
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-4 w-full rounded bg-secondary-100 animate-pulse" />
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
  if (error || !rfp) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'RFPs', href: '/rfps' }, { label: 'Error' }]} />
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
              <h2 className="text-xl font-bold text-secondary-900 font-display mb-2">
                {error || 'RFP not found'}
              </h2>
              <p className="text-secondary-500 mb-6">Unable to load the RFP details.</p>
              <div className="flex gap-3">
                <button onClick={() => router.back()} className={dashboardTheme.buttons.secondary}>Go Back</button>
                <button onClick={fetchRFP} className={dashboardTheme.buttons.primary}>Try Again</button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const certs = rfp.required_certifications_list || parseTags(rfp.required_certifications);
  const lineItems = rfp.line_items || [];
  const qaThreads = rfp.qa_threads || [];
  const responses = sortedResponses();
  const attachmentsList = rfp.attachments_list || [];
  const activityEvents = rfp.activity || [];
  const invitedSuppliers = rfp.invited_suppliers || [];
  const countdownText = getCountdown(rfp.delivery_deadline || rfp.expires_at);

  // ── Main Render ────────────────────────────────────────────────────────────
  return (
    <>
      <DashboardNav breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'RFPs', href: '/rfps' }, { label: rfp.title }]} />
      <div className="min-h-screen bg-secondary-50">
        <div className={dashboardTheme.decorativeBackground.container}>
          <div className={dashboardTheme.decorativeBackground.orb1} />
          <div className={dashboardTheme.decorativeBackground.orb2} />
        </div>

        <div className={dashboardTheme.mainContent.container}>
          <div className="lg:ml-64">
            {/* Back */}
            <Link href="/rfps" className="inline-flex items-center gap-2 text-sm text-secondary-500 hover:text-primary-600 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to RFPs
            </Link>

            {/* ── RFP Header ──────────────────────────────────────────── */}
            <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8 mb-6`}>
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h1 className="text-2xl lg:text-3xl font-bold text-secondary-900 font-display">{rfp.title}</h1>
                    <span className={getStatusBadge(rfp.status)}>{rfp.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary-500">
                    {rfp.buyer_company_name && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {rfp.buyer_company_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Created {formatDate(rfp.created_at)}
                    </span>
                    {countdownText && (
                      <span className={`flex items-center gap-1.5 font-medium ${countdownText.startsWith('Closed') ? 'text-red-500' : 'text-green-600'}`}>
                        <Clock className="w-3.5 h-3.5" />
                        {countdownText}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Content: Left + Right ────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Content */}
              <div className="w-full lg:w-[65%]">
                {/* Tab Bar */}
                <div className={dashboardTheme.tabs.container}>
                  <nav className={`${dashboardTheme.tabs.nav} overflow-x-auto`}>
                    {TABS.map(tab => {
                      const Icon = TAB_ICONS[tab];
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={activeTab === tab ? dashboardTheme.tabs.tabActive : dashboardTheme.tabs.tab}
                        >
                          {Icon && <Icon className="w-4 h-4" />}
                          {tab}
                          {tab === 'Quotes' && responses.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs">
                              {responses.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* ── Tab: Overview ──────────────────────────────────────── */}
                {activeTab === 'Overview' && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    {rfp.specifications && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">Specifications</h3>
                        <p className="text-sm text-secondary-700 whitespace-pre-wrap leading-relaxed">{rfp.specifications}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">Delivery</h3>
                        <div className="space-y-2">
                          {rfp.delivery_location && (
                            <div className="flex items-center gap-2 text-sm text-secondary-700">
                              <MapPin className="w-4 h-4 text-secondary-400" />
                              {rfp.delivery_location}
                            </div>
                          )}
                          {(rfp.delivery_deadline || rfp.expires_at) && (
                            <div className="flex items-center gap-2 text-sm text-secondary-700">
                              <Calendar className="w-4 h-4 text-secondary-400" />
                              {formatDate(rfp.delivery_deadline || rfp.expires_at!)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">Budget</h3>
                        <p className="text-sm text-secondary-700">
                          {rfp.budget_min || rfp.budget_max
                            ? `${rfp.currency || 'USD'} ${rfp.budget_min || '0'} – ${rfp.budget_max || '∞'}`
                            : rfp.target_price || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-6">
                      <span className={dashboardTheme.badges.info}>
                        <Eye className="w-3 h-3 inline mr-1" />
                        {rfp.visibility || 'Public'}
                      </span>
                      {rfp.sealed_bid && (
                        <span className={dashboardTheme.badges.warning}>
                          <Lock className="w-3 h-3 inline mr-1" />Sealed Bid
                        </span>
                      )}
                      {rfp.nda_required && (
                        <span className={dashboardTheme.badges.warning}>
                          <Shield className="w-3 h-3 inline mr-1" />NDA Required
                        </span>
                      )}
                    </div>

                    {certs.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">Required Certifications</h3>
                        <div className="flex flex-wrap gap-2">
                          {certs.map(cert => (
                            <span key={cert} className={dashboardTheme.badges.primary}>
                              <ShieldCheck className="w-3 h-3 inline mr-1" />
                              {cert}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Line Items ────────────────────────────────────── */}
                {activeTab === 'Line Items' && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    {lineItems.length > 0 ? (
                      <>
                        <div className={dashboardTheme.tables.container}>
                          <table className={dashboardTheme.tables.table}>
                            <thead className={dashboardTheme.tables.header}>
                              <tr>
                                <th className={dashboardTheme.tables.headerCell}>#</th>
                                <th className={dashboardTheme.tables.headerCell}>Description</th>
                                <th className={dashboardTheme.tables.headerCell}>Part No.</th>
                                <th className={dashboardTheme.tables.headerCell}>Qty</th>
                                <th className={dashboardTheme.tables.headerCell}>UOM</th>
                                <th className={dashboardTheme.tables.headerCell}>Target Price</th>
                                <th className={dashboardTheme.tables.headerCell}>Specs</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineItems.map((item, idx) => (
                                <tr key={idx} className={dashboardTheme.tables.row}>
                                  <td className={dashboardTheme.tables.cell}>{item.item_number || idx + 1}</td>
                                  <td className={dashboardTheme.tables.cell}>{item.description}</td>
                                  <td className={dashboardTheme.tables.cell}>{item.part_number || '—'}</td>
                                  <td className={dashboardTheme.tables.cell}>{item.quantity}</td>
                                  <td className={dashboardTheme.tables.cell}>{item.uom}</td>
                                  <td className={dashboardTheme.tables.cell}>
                                    {item.target_unit_price ? `$${Number(item.target_unit_price).toFixed(2)}` : '—'}
                                  </td>
                                  <td className={dashboardTheme.tables.cell}>{item.specifications || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="text-right mt-4">
                          <p className="text-sm text-secondary-500">
                            Total:{' '}
                            <span className="font-bold text-secondary-900">
                              ${lineItems.reduce((sum, li) => sum + li.quantity * (li.target_unit_price || 0), 0).toFixed(2)}
                            </span>
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <Package className="w-12 h-12 text-secondary-300 mx-auto mb-3" />
                        <p className="text-sm text-secondary-400">No line items have been added yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Q&A ───────────────────────────────────────────── */}
                {activeTab === 'Q&A' && (
                  <div className="space-y-4">
                    {/* Ask Question */}
                    <div className={`${dashboardTheme.cards.primary} p-6`}>
                      <h3 className="text-sm font-semibold text-secondary-700 mb-3">Ask a Question</h3>
                      <div className="flex gap-3">
                        <textarea
                          value={newQuestion}
                          onChange={e => setNewQuestion(e.target.value)}
                          rows={2}
                          placeholder="Type your question about this RFP..."
                          className={`${dashboardTheme.forms.textarea} flex-1`}
                        />
                        <button
                          onClick={handleAskQuestion}
                          disabled={submittingQuestion || !newQuestion.trim()}
                          className={`${submittingQuestion || !newQuestion.trim() ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.primary} self-end flex items-center gap-2`}
                        >
                          {submittingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Send
                        </button>
                      </div>
                    </div>

                    {/* Threads */}
                    {qaThreads.length > 0 ? (
                      qaThreads.map(thread => (
                        <div key={thread.id} className={`${dashboardTheme.cards.primary} p-6`}>
                          {/* Question */}
                          <div className="flex items-start gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <HelpCircle className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-secondary-900">{thread.asked_by}</span>
                                {thread.asked_by_company && (
                                  <span className="text-xs text-secondary-400">• {thread.asked_by_company}</span>
                                )}
                                <span className="text-xs text-secondary-400">{formatDateTime(thread.asked_at)}</span>
                              </div>
                              <p className="text-sm text-secondary-700">{thread.question}</p>
                            </div>
                          </div>

                          {/* Answer */}
                          {thread.answer ? (
                            <div className="flex items-start gap-3 ml-8 pl-3 border-l-2 border-green-200">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-secondary-900">{thread.answered_by || 'Buyer'}</span>
                                  <span className={dashboardTheme.badges.success}>Answer</span>
                                  {thread.answered_at && (
                                    <span className="text-xs text-secondary-400">{formatDateTime(thread.answered_at)}</span>
                                  )}
                                </div>
                                <p className="text-sm text-secondary-700">{thread.answer}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="ml-8 pl-3 border-l-2 border-secondary-200">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={answerInputs[thread.id] || ''}
                                  onChange={e => setAnswerInputs(prev => ({ ...prev, [thread.id]: e.target.value }))}
                                  placeholder="Post an answer..."
                                  className={`${dashboardTheme.forms.input} flex-1`}
                                />
                                <button
                                  onClick={() => handlePostAnswer(thread.id)}
                                  disabled={submittingAnswer === thread.id || !answerInputs[thread.id]?.trim()}
                                  className={submittingAnswer === thread.id || !answerInputs[thread.id]?.trim() ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.primary}
                                >
                                  {submittingAnswer === thread.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className={`${dashboardTheme.cards.primary} p-8 text-center`}>
                        <MessageSquare className="w-12 h-12 text-secondary-300 mx-auto mb-3" />
                        <p className="text-sm text-secondary-400">No questions yet. Be the first to ask!</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Quotes ────────────────────────────────────────── */}
                {activeTab === 'Quotes' && (
                  <div>
                    {/* Sort bar */}
                    {responses.length > 0 && (
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-sm text-secondary-500">Sort by:</span>
                        {(['price', 'lead_time', 'date'] as const).map(opt => (
                          <button
                            key={opt}
                            onClick={() => setSortQuotes(opt)}
                            className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                              sortQuotes === opt
                                ? 'bg-primary-50 text-primary-700 font-medium'
                                : 'text-secondary-500 hover:text-secondary-700'
                            }`}
                          >
                            {opt === 'price' ? 'Price' : opt === 'lead_time' ? 'Lead Time' : 'Date'}
                          </button>
                        ))}
                      </div>
                    )}

                    {responses.length > 0 ? (
                      <div className="space-y-4">
                        {responses.map(resp => (
                          <div key={resp.id} className={`${dashboardTheme.cards.primary} ${dashboardTheme.cards.hover} p-6`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-secondary-900">{resp.supplier_company_name || 'Supplier'}</span>
                                  <span className={getResponseStatusBadge(resp.status)}>{resp.status}</span>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary-500 mt-1">
                                  {resp.price_quote && (
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="w-3.5 h-3.5" />
                                      ${Number(resp.price_quote).toLocaleString()}
                                    </span>
                                  )}
                                  {resp.lead_time_days && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" />
                                      {resp.lead_time_days} days
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatDate(resp.created_at)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Link
                                  href={`/quotes/${resp.id}`}
                                  className={`${dashboardTheme.buttons.secondary} text-xs`}
                                >
                                  View Full Quote
                                </Link>
                                <Link
                                  href={`/rfps/${id}/compare`}
                                  className={`${dashboardTheme.buttons.outlined} text-xs flex items-center gap-1`}
                                >
                                  <GitCompare className="w-3.5 h-3.5" />
                                  Compare
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`${dashboardTheme.cards.primary} p-8 text-center`}>
                        <DollarSign className="w-12 h-12 text-secondary-300 mx-auto mb-3" />
                        <p className="text-sm text-secondary-400">No quotes received yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Attachments ───────────────────────────────────── */}
                {activeTab === 'Attachments' && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    {attachmentsList.length > 0 ? (
                      <div className="space-y-3">
                        {attachmentsList.map(att => (
                          <div key={att.id} className="flex items-center justify-between p-4 bg-secondary-50 rounded-xl border border-secondary-100">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-5 h-5 text-secondary-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-secondary-700 truncate">{att.name}</p>
                                <p className="text-xs text-secondary-400">{formatFileSize(att.size)} • {formatDate(att.uploaded_at)}</p>
                              </div>
                            </div>
                            <a
                              href={att.url || '#'}
                              download
                              className={`${dashboardTheme.buttons.secondary} flex items-center gap-1 text-xs`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Paperclip className="w-12 h-12 text-secondary-300 mx-auto mb-3" />
                        <p className="text-sm text-secondary-400">No attachments uploaded.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Activity ──────────────────────────────────────── */}
                {activeTab === 'Activity' && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    {activityEvents.length > 0 ? (
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-secondary-200" />
                        <div className="space-y-6">
                          {activityEvents.map(event => {
                            const iconData = activityIcons[event.type] || activityIcons.updated;
                            const Icon = iconData.icon;
                            return (
                              <div key={event.id} className="flex items-start gap-4 relative">
                                <div className={`w-8 h-8 rounded-full ${iconData.color} flex items-center justify-center z-10 flex-shrink-0`}>
                                  <Icon className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 pt-1">
                                  <p className="text-sm text-secondary-700">{event.description}</p>
                                  <p className="text-xs text-secondary-400 mt-1">{formatDateTime(event.timestamp)}</p>
                                  {event.actor && <p className="text-xs text-secondary-400">by {event.actor}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Activity className="w-12 h-12 text-secondary-300 mx-auto mb-3" />
                        <p className="text-sm text-secondary-400">No activity recorded yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Right Sidebar ──────────────────────────────────────── */}
              <div className="w-full lg:w-[35%]">
                <div className="lg:sticky lg:top-24 space-y-4">
                  {/* Stats */}
                  <div className={`${dashboardTheme.cards.primary} p-6`}>
                    <h3 className="text-sm font-semibold text-secondary-700 uppercase tracking-wider mb-4">Stats</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-secondary-900 font-display">{rfp.view_count}</p>
                        <p className="text-xs text-secondary-400">Views</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-secondary-900 font-display">{rfp.response_count}</p>
                        <p className="text-xs text-secondary-400">Responses</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-secondary-900 font-display">
                          {rfp.delivery_deadline
                            ? Math.max(0, Math.ceil((new Date(rfp.delivery_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                            : '—'}
                        </p>
                        <p className="text-xs text-secondary-400">Days Left</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={`${dashboardTheme.cards.primary} p-6`}>
                    <div className="space-y-3">
                      <Link href={`/dashboard/invitations?rfq=${id}`} className={`${dashboardTheme.buttons.primary} w-full flex items-center justify-center gap-2`}>
                        <Users className="w-4 h-4" />
                        Invite Suppliers
                      </Link>
                      {responses.length > 0 && (
                        <Link
                          href={`/rfps/${id}/compare`}
                          className={`${dashboardTheme.buttons.secondary} w-full flex items-center justify-center gap-2`}
                        >
                          <GitCompare className="w-4 h-4" />
                          Compare Quotes
                        </Link>
                      )}
                      {responses.length > 0 && (
                        <button className="px-6 py-2.5 bg-green-600 text-white font-semibold text-sm rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-[0.98] w-full flex items-center justify-center gap-2">
                          <Trophy className="w-4 h-4" />
                          Award
                        </button>
                      )}
                      <button
                        onClick={handleShareLink}
                        className={`${dashboardTheme.buttons.secondary} w-full flex items-center justify-center gap-2`}
                      >
                        <Share2 className="w-4 h-4" />
                        {shareCopied ? 'Link Copied!' : 'Share RFP'}
                      </button>
                    </div>
                  </div>

                  {/* Invited Suppliers */}
                  {invitedSuppliers.length > 0 && (
                    <div className={`${dashboardTheme.cards.primary} p-6`}>
                      <h3 className="text-sm font-semibold text-secondary-700 uppercase tracking-wider mb-4">
                        Invited Suppliers ({invitedSuppliers.length})
                      </h3>
                      <div className="space-y-3">
                        {invitedSuppliers.map(supplier => (
                          <div key={supplier.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {supplier.company_name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-secondary-900 truncate">{supplier.company_name}</p>
                            </div>
                            <span className={getResponseStatusBadge(supplier.response_status)}>
                              {supplier.response_status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RFPDetailPage;
