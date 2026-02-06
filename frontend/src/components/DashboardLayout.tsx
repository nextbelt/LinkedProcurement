import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import DashboardNav from './DashboardNav';

// ── Types ────────────────────────────────────────────────────────────────────

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
}

// ── Component ────────────────────────────────────────────────────────────────

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  breadcrumbs,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync with the sidebar collapsed state from localStorage so
  // the content area offset tracks the sidebar width.
  useEffect(() => {
    const checkCollapsed = () => {
      const val = localStorage.getItem('sidebar_collapsed');
      setSidebarCollapsed(val === 'true');
    };

    checkCollapsed();

    // Re-check when storage changes (same tab or other tabs)
    window.addEventListener('storage', checkCollapsed);

    // Also poll briefly in case the sidebar toggle fires inside the same tab
    const interval = setInterval(checkCollapsed, 300);
    return () => {
      window.removeEventListener('storage', checkCollapsed);
      clearInterval(interval);
    };
  }, []);

  const pageTitle = title
    ? `${title} | LinkedProcurement`
    : 'LinkedProcurement';

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>

      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden bg-secondary-50">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #0ea5e9 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-200/20 rounded-full blur-3xl opacity-60 translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent-200/10 rounded-full blur-3xl opacity-60 -translate-x-1/3 translate-y-1/3" />
      </div>

      {/* Navigation */}
      <DashboardNav breadcrumbs={breadcrumbs} />

      {/* Main content area — shifts based on sidebar width */}
      <main
        className={`relative z-10 min-h-screen pt-24 pb-12 px-6 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        }`}
      >
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </>
  );
};

export default DashboardLayout;
