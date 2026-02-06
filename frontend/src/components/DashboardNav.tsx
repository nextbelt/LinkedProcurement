import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Home,
  BarChart3,
  FileText,
  Plus,
  GitCompare,
  Award,
  Search,
  Users,
  Mail,
  MessageSquare,
  Bell,
  Building2,
  User,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  LogOut,
  Settings,
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';

// ── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DashboardNavProps {
  breadcrumbs?: BreadcrumbItem[];
}

// ── Navigation structure ─────────────────────────────────────────────────────

const buyerNavSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home },
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Procurement',
    items: [
      { label: 'My RFPs', href: '/rfps', icon: FileText },
      { label: 'Create RFP', href: '/rfps/new', icon: Plus },
      { label: 'Compare Quotes', href: '/dashboard/rfqs/compare', icon: GitCompare },
      { label: 'Awards', href: '/dashboard/awards', icon: Award },
    ],
  },
  {
    title: 'Suppliers',
    items: [
      { label: 'Browse Suppliers', href: '/dashboard/suppliers', icon: Search },
      { label: 'My Suppliers', href: '/dashboard/suppliers/my', icon: Users },
      { label: 'Invitations', href: '/dashboard/invitations', icon: Mail },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Messages', href: '/messages', icon: MessageSquare },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Company Settings', href: '/dashboard/settings/company', icon: Building2 },
      { label: 'Account', href: '/dashboard/settings/account', icon: User },
      { label: 'Billing', href: '/dashboard/settings/billing', icon: CreditCard },
    ],
  },
];

const supplierNavSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'Opportunities', href: '/opportunities', icon: Search },
      { label: 'My Quotes', href: '/dashboard/rfqs', icon: FileText },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Messages', href: '/messages', icon: MessageSquare },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Company Profile', href: '/dashboard/settings/company', icon: Building2 },
      { label: 'Account', href: '/dashboard/settings/account', icon: User },
      { label: 'Billing', href: '/dashboard/settings/billing', icon: CreditCard },
    ],
  },
];

// Combined nav shown when role is unknown
const combinedNavSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home },
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Procurement',
    items: [
      { label: 'My RFPs', href: '/rfps', icon: FileText },
      { label: 'Create RFP', href: '/rfps/new', icon: Plus },
      { label: 'Compare Quotes', href: '/dashboard/rfqs/compare', icon: GitCompare },
      { label: 'Opportunities', href: '/opportunities', icon: Search },
      { label: 'Awards', href: '/dashboard/awards', icon: Award },
    ],
  },
  {
    title: 'Suppliers',
    items: [
      { label: 'Browse Suppliers', href: '/dashboard/suppliers', icon: Search },
      { label: 'My Suppliers', href: '/dashboard/suppliers/my', icon: Users },
      { label: 'Invitations', href: '/dashboard/invitations', icon: Mail },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Messages', href: '/messages', icon: MessageSquare },
      { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Company Settings', href: '/dashboard/settings/company', icon: Building2 },
      { label: 'Account', href: '/dashboard/settings/account', icon: User },
      { label: 'Billing', href: '/dashboard/settings/billing', icon: CreditCard },
    ],
  },
];

function getNavSections(role: string | null): NavSection[] {
  if (role === 'buyer') return buyerNavSections;
  if (role === 'supplier') return supplierNavSections;
  return combinedNavSections;
}

// ── Component ────────────────────────────────────────────────────────────────

const DashboardNav: React.FC<DashboardNavProps> = ({ breadcrumbs }) => {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Determine user role from localStorage
  const userRole: string | null =
    typeof window !== 'undefined'
      ? localStorage.getItem('user_type') ||
        localStorage.getItem('account_type') ||
        localStorage.getItem('role')
      : null;

  const navSections = getNavSections(userRole);

  // Persist collapsed state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) setCollapsed(saved === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  // Close mobile nav on route change
  useEffect(() => {
    const handleRouteChange = () => setMobileOpen(false);
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  // Click-outside for user dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_type');
    router.push('/auth/login');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      router.push(`/dashboard/suppliers?q=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch('');
    }
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return router.pathname === '/dashboard';
    return router.pathname.startsWith(href);
  };

  // User info (read from localStorage or defaults)
  const userName =
    typeof window !== 'undefined'
      ? localStorage.getItem('user_name') || 'User'
      : 'User';
  const userEmail =
    typeof window !== 'undefined'
      ? localStorage.getItem('user_email') || ''
      : '';

  // ── Sidebar content (shared desktop + mobile) ────────────────────────────

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-secondary-100">
        <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 flex-shrink-0">
          <span className="text-white font-bold text-xs">LP</span>
        </div>
        {!collapsed && (
          <span className="text-base font-bold text-secondary-900 tracking-tight whitespace-nowrap">
            LinkedProcurement
          </span>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-secondary-400">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        active
                          ? 'bg-primary-50 text-primary-700 border border-primary-100'
                          : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-primary-600' : ''}`} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:block border-t border-secondary-100 px-3 py-3">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-secondary-500 hover:text-secondary-700 hover:bg-secondary-50 rounded-xl transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* User info at bottom */}
      <div className="border-t border-secondary-100 px-3 py-3">
        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-secondary-900 truncate">{userName}</p>
              {userEmail && (
                <p className="text-xs text-secondary-400 truncate">{userEmail}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  // ── Return ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-white border-r border-secondary-200/60 z-40 transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-secondary-900/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute top-0 left-0 h-full w-72 bg-white shadow-2xl flex flex-col">
            {/* Close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-secondary-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-50"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 right-0 h-16 bg-white/80 backdrop-blur-lg border-b border-secondary-200/60 z-30 flex items-center gap-4 px-6 transition-all duration-300 ${
          collapsed ? 'lg:left-[72px]' : 'lg:left-64'
        } left-0`}
      >
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50 rounded-xl transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="hidden md:flex items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-secondary-300">/</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-secondary-500 hover:text-primary-600 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-secondary-900 font-medium">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Global search */}
        <form onSubmit={handleSearchSubmit} className="hidden sm:block relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search suppliers, RFQs..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-secondary-50 border border-secondary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 placeholder-secondary-400 transition-all"
          />
        </form>

        {/* Notifications */}
        <NotificationCenter />

        {/* User dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-secondary-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:block text-sm font-medium text-secondary-700 max-w-[100px] truncate">
              {userName}
            </span>
            <ChevronDown className="hidden md:block w-4 h-4 text-secondary-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-xl border border-secondary-200/60 rounded-2xl shadow-xl py-1.5 z-50">
              <Link
                href="/dashboard/settings/account"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary-700 hover:bg-secondary-50 hover:text-primary-600 transition-all"
                onClick={() => setUserMenuOpen(false)}
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
              <div className="my-1 border-t border-secondary-100" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default DashboardNav;
