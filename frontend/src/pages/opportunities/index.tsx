import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Search,
  Filter,
  MapPin,
  Calendar,
  DollarSign,
  ChevronDown,
  Loader2,
  Briefcase,
  ShieldCheck,
  Inbox,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme } from '@/styles/dashboardTheme';
import DashboardNav from '@/components/DashboardNav';
import { RFQ } from '@/types';

const OpportunitiesPage: React.FC = () => {
  const router = useRouter();

  const [opportunities, setOpportunities] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [certFilter, setCertFilter] = useState('');

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { status: 'active', visibility: 'public' };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (categoryFilter) params.material_category = categoryFilter;
      if (locationFilter) params.location = locationFilter;
      if (certFilter) params.certifications = certFilter;

      const res = await api.get('/api/v1/rfqs', { params });
      setOpportunities(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch {
      setError('Failed to load opportunities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOpportunities();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const parseCertifications = (certs?: string): string[] => {
    if (!certs) return [];
    try {
      const parsed = JSON.parse(certs);
      return Array.isArray(parsed) ? parsed : [certs];
    } catch {
      return certs.split(',').map((c) => c.trim()).filter(Boolean);
    }
  };

  const categories = [
    'Steel Alloys',
    'Aluminum',
    'Titanium',
    'Engineering Plastics',
    'Composites',
    'Semiconductors',
    'Rare Earth Elements',
    'Electronics',
  ];

  // ─── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Opportunities' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64">
              <div className="h-8 w-56 rounded-lg bg-secondary-200 animate-pulse mb-8" />
              <div className="flex gap-4 mb-8">
                <div className="h-10 flex-1 rounded-xl bg-secondary-200 animate-pulse" />
                <div className="h-10 w-36 rounded-xl bg-secondary-200 animate-pulse" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6">
                    <div className="h-5 w-3/4 rounded bg-secondary-200 animate-pulse mb-3" />
                    <div className="h-4 w-1/2 rounded bg-secondary-100 animate-pulse mb-2" />
                    <div className="h-4 w-2/3 rounded bg-secondary-100 animate-pulse mb-4" />
                    <div className="flex gap-2 mb-4">
                      <div className="h-6 w-16 rounded-full bg-secondary-100 animate-pulse" />
                      <div className="h-6 w-20 rounded-full bg-secondary-100 animate-pulse" />
                    </div>
                    <div className="h-10 w-full rounded-xl bg-secondary-200 animate-pulse" />
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
  if (error) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Opportunities' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64 flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                <Briefcase className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-secondary-900 font-display mb-2">Something went wrong</h2>
              <p className="text-secondary-500 mb-6">{error}</p>
              <button onClick={fetchOpportunities} className={dashboardTheme.buttons.primary}>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Main render ───────────────────────────────────────────────
  return (
    <>
      <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Opportunities' }]} />
      <div className="min-h-screen bg-secondary-50">
        <div className={dashboardTheme.decorativeBackground.container}>
          <div className={dashboardTheme.decorativeBackground.orb1} />
          <div className={dashboardTheme.decorativeBackground.orb2} />
        </div>

        <div className={dashboardTheme.mainContent.container}>
          <div className="lg:ml-64">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl lg:text-3xl font-bold text-secondary-900 font-display">
                Available Opportunities
              </h1>
              <p className="text-secondary-500 text-sm mt-1">
                Browse open RFPs and submit your proposals
              </p>
            </div>

            {/* Search & Filters */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-4 mb-6">
              <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="Search opportunities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary-50 border border-secondary-200 text-secondary-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 placeholder-secondary-400 text-sm transition-all"
                  />
                </div>

                {/* Category */}
                <div className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-secondary-50 border border-secondary-200 text-secondary-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm transition-all cursor-pointer"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                </div>

                {/* Location */}
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="Location"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="pl-10 pr-4 py-2.5 bg-secondary-50 border border-secondary-200 text-secondary-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm transition-all w-full md:w-40"
                  />
                </div>

                {/* Certifications */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Certification"
                    value={certFilter}
                    onChange={(e) => setCertFilter(e.target.value)}
                    className="pl-4 pr-4 py-2.5 bg-secondary-50 border border-secondary-200 text-secondary-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm transition-all w-full md:w-36"
                  />
                </div>

                <button type="submit" className={`${dashboardTheme.buttons.primary} flex items-center gap-2`}>
                  <Filter className="w-4 h-4" />
                  Search
                </button>
              </form>
            </div>

            {/* Empty state */}
            {opportunities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 bg-secondary-100 rounded-2xl flex items-center justify-center mb-6">
                  <Inbox className="w-10 h-10 text-secondary-400" />
                </div>
                <h2 className="text-2xl font-bold text-secondary-900 font-display mb-2">
                  No Opportunities Available
                </h2>
                <p className="text-secondary-500 max-w-md">
                  {searchQuery || categoryFilter || locationFilter || certFilter
                    ? 'No opportunities match your current filters. Try broadening your search.'
                    : 'There are no open opportunities at the moment. Check back soon for new RFPs.'}
                </p>
              </div>
            ) : (
              /* Card Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {opportunities.map((opp) => {
                  const certs = parseCertifications(opp.required_certifications);
                  return (
                    <div
                      key={opp.id}
                      className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6 hover:shadow-glass-lg hover:-translate-y-0.5 transition-all duration-300"
                    >
                      {/* Title & Company */}
                      <h3 className="text-base font-semibold text-secondary-900 mb-2 line-clamp-2">
                        {opp.title}
                      </h3>
                      {opp.buyer_company_name && (
                        <p className="text-sm text-secondary-500 mb-3 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" />
                          {opp.buyer_company_name}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="space-y-2 mb-4">
                        {opp.material_category && (
                          <p className="text-xs text-secondary-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                            {opp.material_category}
                          </p>
                        )}
                        <p className="text-xs text-secondary-500 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          Due: {formatDate(opp.delivery_deadline || opp.expires_at)}
                        </p>
                        {opp.delivery_location && (
                          <p className="text-xs text-secondary-500 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            {opp.delivery_location}
                          </p>
                        )}
                        {opp.target_price && (
                          <p className="text-xs text-secondary-500 flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5" />
                            Budget: {opp.target_price}
                          </p>
                        )}
                      </div>

                      {/* Certifications */}
                      {certs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {certs.map((cert) => (
                            <span
                              key={cert}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-100 rounded-full text-[10px] font-medium"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              {cert}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action */}
                      <Link
                        href={`/dashboard/rfq/${opp.id}`}
                        className={`${dashboardTheme.buttons.primary} w-full text-center block text-sm`}
                      >
                        View Details
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default OpportunitiesPage;
