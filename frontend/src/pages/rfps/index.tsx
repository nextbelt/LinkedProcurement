import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Eye,
  Edit3,
  Loader2,
  Calendar,
  ChevronDown,
  Inbox,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardTheme, getStatusBadgeClass } from '@/styles/dashboardTheme';
import DashboardNav from '@/components/DashboardNav';
import { RFQ } from '@/types';

type RFPStatus = 'all' | 'draft' | 'active' | 'closed' | 'expired';

const RFPsPage: React.FC = () => {
  const router = useRouter();

  const [rfps, setRfps] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<RFPStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchRFPs();
  }, [statusFilter]);

  const fetchRFPs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (dateFrom) params.delivery_deadline_from = dateFrom;
      if (dateTo) params.delivery_deadline_to = dateTo;

      const res = await api.get('/api/v1/rfqs', { params });
      setRfps(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch {
      setError('Failed to load RFPs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRFPs();
  };

  const filteredRfps = rfps.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        (r.material_category ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: 'Draft',
      active: 'Published',
      closed: 'Closed',
      expired: 'Expired',
      cancelled: 'Cancelled',
      awarded: 'Awarded',
    };
    return map[status] ?? status;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ─── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <>
        <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'My RFPs' }]} />
        <div className="min-h-screen bg-secondary-50">
          <div className={dashboardTheme.decorativeBackground.container}>
            <div className={dashboardTheme.decorativeBackground.orb1} />
            <div className={dashboardTheme.decorativeBackground.orb2} />
          </div>
          <div className={dashboardTheme.mainContent.container}>
            <div className="lg:ml-64">
              {/* Header skeleton */}
              <div className="flex items-center justify-between mb-8">
                <div className="h-8 w-48 rounded-lg bg-secondary-200 animate-pulse" />
                <div className="h-10 w-36 rounded-xl bg-secondary-200 animate-pulse" />
              </div>
              {/* Filter bar skeleton */}
              <div className="flex gap-4 mb-8">
                <div className="h-10 flex-1 rounded-xl bg-secondary-200 animate-pulse" />
                <div className="h-10 w-32 rounded-xl bg-secondary-200 animate-pulse" />
              </div>
              {/* Table skeleton */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4 py-4 border-b border-secondary-100 last:border-0">
                    <div className="h-5 w-48 rounded bg-secondary-200 animate-pulse" />
                    <div className="h-5 w-24 rounded bg-secondary-100 animate-pulse" />
                    <div className="h-5 w-20 rounded bg-secondary-100 animate-pulse" />
                    <div className="h-5 w-16 rounded bg-secondary-100 animate-pulse" />
                    <div className="h-5 w-24 rounded bg-secondary-100 animate-pulse" />
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
        <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'My RFPs' }]} />
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
              <h2 className="text-xl font-bold text-secondary-900 font-display mb-2">Something went wrong</h2>
              <p className="text-secondary-500 mb-6">{error}</p>
              <button onClick={fetchRFPs} className={dashboardTheme.buttons.primary}>
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
      <DashboardNav breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'My RFPs' }]} />
      <div className="min-h-screen bg-secondary-50">
        <div className={dashboardTheme.decorativeBackground.container}>
          <div className={dashboardTheme.decorativeBackground.orb1} />
          <div className={dashboardTheme.decorativeBackground.orb2} />
        </div>

        <div className={dashboardTheme.mainContent.container}>
          <div className="lg:ml-64">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-secondary-900 font-display">My RFPs</h1>
                <p className="text-secondary-500 text-sm mt-1">Manage your requests for proposals</p>
              </div>
              <Link
                href="/dashboard/rfq/post"
                className={`${dashboardTheme.buttons.primary} inline-flex items-center gap-2`}
              >
                <Plus className="w-4 h-4" />
                Create New RFP
              </Link>
            </div>

            {/* Filter Bar */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-4 mb-6">
              <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="Search RFPs by title or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-secondary-50 border border-secondary-200 text-secondary-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 placeholder-secondary-400 text-sm transition-all"
                  />
                </div>

                {/* Status filter */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as RFPStatus)}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-secondary-50 border border-secondary-200 text-secondary-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm transition-all cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="active">Published</option>
                    <option value="closed">Closed</option>
                    <option value="expired">Expired</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                </div>

                {/* Date from */}
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-4 py-2.5 bg-secondary-50 border border-secondary-200 text-secondary-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm transition-all"
                  title="From date"
                />

                {/* Date to */}
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-4 py-2.5 bg-secondary-50 border border-secondary-200 text-secondary-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm transition-all"
                  title="To date"
                />

                <button type="submit" className={`${dashboardTheme.buttons.primary} flex items-center gap-2`}>
                  <Filter className="w-4 h-4" />
                  Apply
                </button>
              </form>
            </div>

            {/* Empty state */}
            {filteredRfps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 bg-secondary-100 rounded-2xl flex items-center justify-center mb-6">
                  <Inbox className="w-10 h-10 text-secondary-400" />
                </div>
                <h2 className="text-2xl font-bold text-secondary-900 font-display mb-2">No RFPs Found</h2>
                <p className="text-secondary-500 max-w-md mb-6">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No RFPs match your current filters. Try adjusting your search criteria.'
                    : "You haven't created any RFPs yet. Get started by creating your first request for proposal."}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Link href="/dashboard/rfq/post" className={`${dashboardTheme.buttons.primary} inline-flex items-center gap-2`}>
                    <Plus className="w-4 h-4" />
                    Create Your First RFP
                  </Link>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={dashboardTheme.tables.header}>
                          <th className={dashboardTheme.tables.headerCell}>Title</th>
                          <th className={dashboardTheme.tables.headerCell}>Category</th>
                          <th className={dashboardTheme.tables.headerCell}>Status</th>
                          <th className={`${dashboardTheme.tables.headerCell} text-center`}># Responses</th>
                          <th className={dashboardTheme.tables.headerCell}>Due Date</th>
                          <th className={`${dashboardTheme.tables.headerCell} text-right`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRfps.map((rfp) => (
                          <tr key={rfp.id} className={dashboardTheme.tables.row}>
                            <td className={`${dashboardTheme.tables.cell} font-medium text-secondary-900`}>
                              {rfp.title}
                            </td>
                            <td className={dashboardTheme.tables.cell}>
                              {rfp.material_category || '—'}
                            </td>
                            <td className={dashboardTheme.tables.cell}>
                              <span className={getStatusBadgeClass(rfp.status)}>
                                {getStatusLabel(rfp.status)}
                              </span>
                            </td>
                            <td className={`${dashboardTheme.tables.cell} text-center`}>
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold">
                                {rfp.response_count}
                              </span>
                            </td>
                            <td className={dashboardTheme.tables.cell}>
                              <div className="flex items-center gap-1.5 text-secondary-600">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(rfp.delivery_deadline || rfp.expires_at)}
                              </div>
                            </td>
                            <td className={`${dashboardTheme.tables.cell} text-right`}>
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/dashboard/rfq/${rfp.id}`}
                                  className="p-2 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                  title="View"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                                <Link
                                  href={`/dashboard/rfq/${rfp.id}/edit`}
                                  className="p-2 text-secondary-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {filteredRfps.map((rfp) => (
                    <div
                      key={rfp.id}
                      className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="text-sm font-semibold text-secondary-900 line-clamp-2">{rfp.title}</h3>
                        <span className={getStatusBadgeClass(rfp.status)}>
                          {getStatusLabel(rfp.status)}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-secondary-500 mb-4">
                        {rfp.material_category && (
                          <p>
                            <span className="font-medium text-secondary-700">Category:</span> {rfp.material_category}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            Due: {formatDate(rfp.delivery_deadline || rfp.expires_at)}
                          </span>
                          <span className="font-medium text-primary-700">{rfp.response_count} responses</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/dashboard/rfq/${rfp.id}`}
                          className={`${dashboardTheme.buttons.secondary} flex-1 text-center text-xs flex items-center justify-center gap-1.5`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>
                        <Link
                          href={`/dashboard/rfq/${rfp.id}/edit`}
                          className={`${dashboardTheme.buttons.outlined} flex-1 text-center text-xs flex items-center justify-center gap-1.5`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RFPsPage;
