import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Flag,
  Globe,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Send,
  Shield,
  ShieldCheck,
  Star,
  Users,
  Wrench,
  Hash,
  Briefcase,
  FileText,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme } from '@/styles/dashboardTheme';
import DashboardNav from '@/components/DashboardNav';
import { Company } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface POCData {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedin_verified?: boolean;
  is_primary?: boolean;
}

interface SupplierProfile extends Company {
  pocs?: POCData[];
  rating?: number;
  categories_served?: string[];
}

const TABS = ['Overview', 'Capabilities', 'Certifications', 'Performance', 'Reviews'];

const TAB_ICONS: Record<string, React.ElementType> = {
  'Overview': Building2,
  'Capabilities': Wrench,
  'Certifications': ShieldCheck,
  'Performance': BarChart3,
  'Reviews': Star,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseTags = (value?: string): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
};

const getYearsInBusiness = (foundedYear?: number) => {
  if (!foundedYear) return null;
  return new Date().getFullYear() - foundedYear;
};

// ── Performance Bar ──────────────────────────────────────────────────────────

const PerformanceBar: React.FC<{
  label: string;
  value: number | string;
  max: number;
  unit?: string;
  color: string;
}> = ({ label, value, max, unit, color }) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const percentage = max > 0 ? Math.min((numValue / max) * 100, 100) : 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-secondary-700">{label}</span>
        <span className="text-sm font-bold text-secondary-900">
          {typeof value === 'number' ? value.toLocaleString() : value}{unit || ''}
        </span>
      </div>
      <div className="w-full h-3 bg-secondary-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

const SupplierProfilePage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    if (id) fetchSupplier();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSupplier = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/companies/${id}`);
      setSupplier(res.data);
    } catch {
      setError('Failed to load supplier profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteToRFQ = async () => {
    setInviting(true);
    try {
      await api.post(`/api/v1/invitations`, { company_id: id });
      setInvited(true);
    } catch {
      // handled by interceptor
    } finally {
      setInviting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Supplier Profile' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64">
              <div className="h-5 w-32 rounded bg-secondary-200 animate-pulse mb-6" />
              {/* Header skeleton */}
              <div className={`${dashboardTheme.cards.primary} p-8 mb-6`}>
                <div className="flex items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-secondary-200 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-7 w-48 rounded-lg bg-secondary-200 animate-pulse mb-3" />
                    <div className="h-4 w-64 rounded bg-secondary-100 animate-pulse mb-2" />
                    <div className="h-4 w-40 rounded bg-secondary-100 animate-pulse" />
                  </div>
                </div>
              </div>
              {/* Tabs skeleton */}
              <div className="flex gap-4 mb-6">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-10 w-28 rounded bg-secondary-200 animate-pulse" />
                ))}
              </div>
              {/* Content skeleton */}
              <div className="flex gap-6">
                <div className="flex-1">
                  <div className={`${dashboardTheme.cards.primary} p-8`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-4 w-full rounded bg-secondary-100 animate-pulse mb-3" />
                    ))}
                  </div>
                </div>
                <div className="hidden lg:block w-[30%]">
                  <div className={`${dashboardTheme.cards.primary} p-6`}>
                    <div className="h-20 w-full rounded bg-secondary-100 animate-pulse mb-4" />
                    <div className="h-10 w-full rounded bg-secondary-200 animate-pulse mb-3" />
                    <div className="h-10 w-full rounded bg-secondary-200 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !supplier) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Supplier Profile' }]} />
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
                {error || 'Supplier not found'}
              </h2>
              <p className="text-secondary-500 mb-6">Unable to load the supplier profile.</p>
              <div className="flex gap-3">
                <button onClick={() => router.back()} className={dashboardTheme.buttons.secondary}>Go Back</button>
                <button onClick={fetchSupplier} className={dashboardTheme.buttons.primary}>Try Again</button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const certifications = parseTags(supplier.certifications);
  const capabilities = parseTags(supplier.capabilities);
  const materials = parseTags(supplier.materials);
  const naicsCodes = parseTags(supplier.naics_codes);
  const yearsInBusiness = getYearsInBusiness(supplier.founded_year);
  const pocs = supplier.pocs ?? [];
  const primaryPoc = pocs.find(p => p.is_primary) || pocs[0];

  // ── Main Render ────────────────────────────────────────────────────────────
  return (
    <>
      <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Suppliers', href: '/dashboard/suppliers' }, { label: supplier.name }]} />
      <div className="min-h-screen bg-secondary-50">
        <div className={dashboardTheme.decorativeBackground.container}>
          <div className={dashboardTheme.decorativeBackground.orb1} />
          <div className={dashboardTheme.decorativeBackground.orb2} />
        </div>

        <div className={dashboardTheme.mainContent.container}>
          <div className="lg:ml-64">
            {/* Back button */}
            <Link
              href="/dashboard/suppliers"
              className="inline-flex items-center gap-2 text-sm text-secondary-500 hover:text-primary-600 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Suppliers
            </Link>

            {/* ── Company Header ─────────────────────────────────────── */}
            <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8 mb-6`}>
              <div className="flex flex-col sm:flex-row items-start gap-6">
                {/* Logo */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
                  {supplier.logo_url ? (
                    <img src={supplier.logo_url} alt={supplier.name} className="w-20 h-20 rounded-2xl object-cover" />
                  ) : (
                    <span className="text-white text-2xl font-bold">{supplier.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h1 className="text-2xl lg:text-3xl font-bold text-secondary-900 font-display truncate">{supplier.name}</h1>
                    {supplier.is_verified && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full text-xs font-medium flex-shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary-500 mb-3">
                    {supplier.industry && (
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5" />
                        {supplier.industry}
                      </span>
                    )}
                    {supplier.headquarters_location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {supplier.headquarters_location}
                      </span>
                    )}
                    {supplier.employee_count && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {supplier.employee_count} employees
                      </span>
                    )}
                    {yearsInBusiness !== null && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {yearsInBusiness} years in business
                      </span>
                    )}
                  </div>

                  {supplier.description && (
                    <p className="text-sm text-secondary-600 line-clamp-3">{supplier.description}</p>
                  )}

                  {supplier.website_url && (
                    <a
                      href={supplier.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 mt-2 transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {supplier.website_url.replace(/^https?:\/\//, '')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* ── Content: Left + Right ────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Content */}
              <div className="w-full lg:w-[70%]">
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
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* ── Tab: Overview ──────────────────────────────────────── */}
                {activeTab === 'Overview' && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    {supplier.description && (
                      <div className="mb-8">
                        <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">About</h3>
                        <p className="text-sm text-secondary-700 leading-relaxed whitespace-pre-wrap">{supplier.description}</p>
                      </div>
                    )}

                    <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-4">Key Facts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {[
                        { label: 'Industry', value: supplier.industry, icon: Briefcase },
                        { label: 'Location', value: supplier.headquarters_location, icon: MapPin },
                        { label: 'Employees', value: supplier.employee_count, icon: Users },
                        { label: 'Founded', value: supplier.founded_year ? String(supplier.founded_year) : undefined, icon: Calendar },
                        { label: 'Website', value: supplier.website_url, icon: Globe, isLink: true },
                        { label: 'DUNS Number', value: supplier.duns_number, icon: Hash },
                      ].filter(item => item.value).map(item => (
                        <div key={item.label} className="flex items-start gap-3 p-3 bg-secondary-50/50 rounded-xl border border-secondary-100">
                          <div className="p-2 bg-white rounded-lg">
                            <item.icon className="w-4 h-4 text-secondary-400" />
                          </div>
                          <div>
                            <p className="text-xs text-secondary-400 mb-0.5">{item.label}</p>
                            {item.isLink ? (
                              <a href={item.value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:text-primary-700 transition-colors">
                                {item.value!.replace(/^https?:\/\//, '')}
                              </a>
                            ) : (
                              <p className="text-sm font-medium text-secondary-900">{item.value}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {materials.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">Materials Served</h3>
                        <div className="flex flex-wrap gap-2">
                          {materials.map(mat => (
                            <span key={mat} className={dashboardTheme.badges.neutral}>{mat}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Capabilities ──────────────────────────────────── */}
                {activeTab === 'Capabilities' && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    {naicsCodes.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">NAICS Codes</h3>
                        <div className="flex flex-wrap gap-2">
                          {naicsCodes.map(code => (
                            <span key={code} className={dashboardTheme.badges.info}>
                              <Hash className="w-3 h-3 inline mr-1" />
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {capabilities.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">Service Categories</h3>
                        <div className="flex flex-wrap gap-2">
                          {capabilities.map((cap, idx) => {
                            const colors = [
                              'bg-blue-50 text-blue-700 border-blue-100',
                              'bg-purple-50 text-purple-700 border-purple-100',
                              'bg-cyan-50 text-cyan-700 border-cyan-100',
                              'bg-emerald-50 text-emerald-700 border-emerald-100',
                              'bg-amber-50 text-amber-700 border-amber-100',
                              'bg-rose-50 text-rose-700 border-rose-100',
                            ];
                            return (
                              <span
                                key={cap}
                                className={`px-3 py-1 border rounded-full text-xs font-medium ${colors[idx % colors.length]}`}
                              >
                                {cap}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {materials.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-3">Materials</h3>
                        <div className="flex flex-wrap gap-2">
                          {materials.map(mat => (
                            <span key={mat} className={dashboardTheme.badges.neutral}>{mat}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {naicsCodes.length === 0 && capabilities.length === 0 && materials.length === 0 && (
                      <div className="text-center py-12">
                        <Wrench className="w-12 h-12 text-secondary-300 mx-auto mb-3" />
                        <p className="text-sm text-secondary-400">No capabilities information available.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Certifications ─────────────────────────────────── */}
                {activeTab === 'Certifications' && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    {certifications.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {certifications.map(cert => {
                          // Infer issuing body
                          let issuingBody = 'International Standards';
                          if (cert.startsWith('ISO')) issuingBody = 'International Organization for Standardization';
                          else if (cert === 'AS9100') issuingBody = 'SAE International';
                          else if (cert === 'ITAR') issuingBody = 'U.S. Department of State';
                          else if (cert === 'RoHS' || cert === 'REACH') issuingBody = 'European Commission';
                          else if (cert === 'UL') issuingBody = 'Underwriters Laboratories';
                          else if (cert === 'CE') issuingBody = 'European Conformity';
                          else if (cert === 'FDA') issuingBody = 'U.S. Food and Drug Administration';
                          else if (cert === 'NADCAP') issuingBody = 'Performance Review Institute';

                          return (
                            <div
                              key={cert}
                              className="p-4 bg-white border border-secondary-200 rounded-xl hover:shadow-md transition-all"
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-primary-50 rounded-lg flex-shrink-0">
                                  <ShieldCheck className="w-5 h-5 text-primary-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-semibold text-secondary-900">{cert}</h4>
                                    {supplier.is_verified && (
                                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-secondary-500">{issuingBody}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <ShieldCheck className="w-12 h-12 text-secondary-300 mx-auto mb-3" />
                        <p className="text-sm text-secondary-400">No certifications listed.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Performance ────────────────────────────────────── */}
                {activeTab === 'Performance' && (
                  <div className="space-y-6">
                    {/* Performance Bars */}
                    <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                      <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-6">Performance Metrics</h3>
                      <PerformanceBar
                        label="Response Rate"
                        value={Math.round(supplier.response_rate || 0)}
                        max={100}
                        unit="%"
                        color="bg-green-500"
                      />
                      <PerformanceBar
                        label="Avg Response Time"
                        value={Math.round(supplier.avg_response_time_hours || 0)}
                        max={72}
                        unit=" hours"
                        color="bg-blue-500"
                      />
                      <PerformanceBar
                        label="Total RFQs Handled"
                        value={supplier.total_rfqs_received || 0}
                        max={Math.max(supplier.total_rfqs_received || 0, 100)}
                        color="bg-purple-500"
                      />
                      <PerformanceBar
                        label="Total RFQs Responded"
                        value={supplier.total_rfqs_responded || 0}
                        max={Math.max(supplier.total_rfqs_received || 0, 100)}
                        color="bg-amber-500"
                      />
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className={dashboardTheme.analytics.metricCard.blue}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={dashboardTheme.analytics.iconContainer.success}>
                            <Clock className="w-5 h-5" />
                          </div>
                        </div>
                        <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider mb-1">On-Time Delivery</p>
                        <p className="text-2xl font-bold text-secondary-900 font-display">—</p>
                        <p className="text-xs text-secondary-400 mt-1">Coming soon</p>
                      </div>

                      <div className={dashboardTheme.analytics.metricCard.blue}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={dashboardTheme.analytics.iconContainer.warning}>
                            <Star className="w-5 h-5" />
                          </div>
                        </div>
                        <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider mb-1">Quality Score</p>
                        <p className="text-2xl font-bold text-secondary-900 font-display">—</p>
                        <p className="text-xs text-secondary-400 mt-1">Coming soon</p>
                      </div>

                      <div className={dashboardTheme.analytics.metricCard.blue}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={dashboardTheme.analytics.iconContainer.info}>
                            <Award className="w-5 h-5" />
                          </div>
                        </div>
                        <p className="text-xs font-medium text-secondary-500 uppercase tracking-wider mb-1">Awards Won</p>
                        <p className="text-2xl font-bold text-secondary-900 font-display">—</p>
                        <p className="text-xs text-secondary-400 mt-1">Coming soon</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab: Reviews ────────────────────────────────────────── */}
                {activeTab === 'Reviews' && (
                  <div className={`${dashboardTheme.cards.primary} p-6 lg:p-8`}>
                    <div className="text-center py-12">
                      <Star className="w-12 h-12 text-secondary-300 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-secondary-900 mb-2">No reviews yet</h3>
                      <p className="text-sm text-secondary-400 max-w-sm mx-auto">
                        Reviews will appear after completed transactions with this supplier. Check back later.
                      </p>
                    </div>

                    {/* Placeholder review card for future implementation */}
                    <div className="mt-8 pt-6 border-t border-secondary-200">
                      <p className="text-xs text-secondary-400 uppercase tracking-wider mb-4">Review format (placeholder)</p>
                      <div className="p-4 bg-secondary-50 rounded-xl border border-secondary-100 opacity-50">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary-200" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-secondary-700">Reviewer Name</span>
                              <span className="text-xs text-secondary-400">Jan 15, 2026</span>
                            </div>
                            <div className="flex gap-0.5 mb-2">
                              {[1, 2, 3, 4, 5].map(i => (
                                <Star key={i} className={`w-4 h-4 ${i <= 4 ? 'text-amber-400 fill-amber-400' : 'text-secondary-300'}`} />
                              ))}
                            </div>
                            <p className="text-sm text-secondary-500">Review comment will appear here...</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right Sidebar ──────────────────────────────────────── */}
              <div className="w-full lg:w-[30%]">
                <div className="lg:sticky lg:top-24 space-y-4">
                  {/* Primary POC Card */}
                  {primaryPoc && (
                    <div className={`${dashboardTheme.cards.primary} p-6`}>
                      <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-4">Primary Contact</h3>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                          {primaryPoc.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-secondary-900 truncate">{primaryPoc.name}</p>
                            {primaryPoc.linkedin_verified && (
                              <Linkedin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            )}
                          </div>
                          {primaryPoc.role && (
                            <p className="text-xs text-secondary-500">{primaryPoc.role}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        {primaryPoc.email && (
                          <a
                            href={`mailto:${primaryPoc.email}`}
                            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                            {primaryPoc.email}
                          </a>
                        )}
                        {primaryPoc.phone && (
                          <a
                            href={`tel:${primaryPoc.phone}`}
                            className="flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-700 transition-colors"
                          >
                            <Phone className="w-4 h-4" />
                            {primaryPoc.phone}
                          </a>
                        )}
                      </div>
                      <button
                        className={`${dashboardTheme.buttons.secondary} w-full flex items-center justify-center gap-2`}
                      >
                        <Mail className="w-4 h-4" />
                        Contact
                      </button>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className={`${dashboardTheme.cards.primary} p-6`}>
                    <div className="space-y-3">
                      <button
                        onClick={handleInviteToRFQ}
                        disabled={inviting || invited}
                        className={`${
                          invited ? dashboardTheme.buttons.disabled : inviting ? dashboardTheme.buttons.disabled : dashboardTheme.buttons.primary
                        } w-full flex items-center justify-center gap-2`}
                      >
                        {inviting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Inviting...
                          </>
                        ) : invited ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Invited
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Invite to RFQ
                          </>
                        )}
                      </button>
                      <button className={`${dashboardTheme.buttons.secondary} w-full flex items-center justify-center gap-2`}>
                        <MessageSquare className="w-4 h-4" />
                        Send Message
                      </button>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className={`${dashboardTheme.cards.primary} p-6`}>
                    <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wider mb-4">Quick Stats</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-secondary-500">Total RFQs</span>
                        <span className="text-sm font-semibold text-secondary-900">{supplier.total_rfqs_received || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-secondary-500">Response Rate</span>
                        <span className="text-sm font-semibold text-secondary-900">{Math.round(supplier.response_rate || 0)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-secondary-500">Avg Response Time</span>
                        <span className="text-sm font-semibold text-secondary-900">
                          {supplier.avg_response_time_hours ? `${Math.round(supplier.avg_response_time_hours)}h` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Report */}
                  <div className="text-center">
                    <button className="text-xs text-secondary-400 hover:text-secondary-600 transition-colors flex items-center gap-1 mx-auto">
                      <Flag className="w-3 h-3" />
                      Report this supplier
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupplierProfilePage;
