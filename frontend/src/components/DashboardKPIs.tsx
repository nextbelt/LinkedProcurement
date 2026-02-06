import React from 'react';
import {
  FileText,
  Clock,
  Award,
  DollarSign,
  Mail,
  Send,
  Trophy,
  TrendingUp,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface KPICard {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'blue' | 'amber' | 'green' | 'purple';
  trend: { direction: 'up' | 'down' | 'neutral'; value: string };
}

interface DashboardKPIsProps {
  role: 'buyer' | 'supplier';
}

// ── Color mappings ───────────────────────────────────────────────────────────

const colorMap = {
  blue: {
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
    trendUp: 'text-green-600',
    trendDown: 'text-red-600',
  },
  amber: {
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    trendUp: 'text-green-600',
    trendDown: 'text-red-600',
  },
  green: {
    iconBg: 'bg-green-50',
    iconText: 'text-green-600',
    trendUp: 'text-green-600',
    trendDown: 'text-red-600',
  },
  purple: {
    iconBg: 'bg-purple-50',
    iconText: 'text-purple-600',
    trendUp: 'text-green-600',
    trendDown: 'text-red-600',
  },
} as const;

// ── Mock data by role ────────────────────────────────────────────────────────

const buyerKPIs: KPICard[] = [
  {
    label: 'Active RFQs',
    value: '12',
    icon: FileText,
    color: 'blue',
    trend: { direction: 'up', value: '12% vs last month' },
  },
  {
    label: 'Pending Responses',
    value: '8',
    icon: Clock,
    color: 'amber',
    trend: { direction: 'down', value: '4% vs last month' },
  },
  {
    label: 'Awards This Month',
    value: '3',
    icon: Award,
    color: 'green',
    trend: { direction: 'up', value: '50% vs last month' },
  },
  {
    label: 'Total Spend',
    value: '$284K',
    icon: DollarSign,
    color: 'purple',
    trend: { direction: 'up', value: '8% vs last month' },
  },
];

const supplierKPIs: KPICard[] = [
  {
    label: 'Open Invitations',
    value: '5',
    icon: Mail,
    color: 'blue',
    trend: { direction: 'up', value: '20% vs last month' },
  },
  {
    label: 'Submitted Quotes',
    value: '14',
    icon: Send,
    color: 'amber',
    trend: { direction: 'up', value: '7% vs last month' },
  },
  {
    label: 'Won Awards',
    value: '4',
    icon: Trophy,
    color: 'green',
    trend: { direction: 'up', value: '33% vs last month' },
  },
  {
    label: 'Revenue This Month',
    value: '$192K',
    icon: TrendingUp,
    color: 'purple',
    trend: { direction: 'up', value: '15% vs last month' },
  },
];

// ── Component ────────────────────────────────────────────────────────────────

const DashboardKPIs: React.FC<DashboardKPIsProps> = ({ role }) => {
  const cards = role === 'buyer' ? buyerKPIs : supplierKPIs;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const colors = colorMap[card.color];

        return (
          <div
            key={card.label}
            className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-glass border border-white/50 p-6 hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${colors.iconBg}`}>
                <Icon className={`w-5 h-5 ${colors.iconText}`} />
              </div>
            </div>

            <p className="text-sm text-secondary-500 mb-1">{card.label}</p>
            <p className="text-3xl font-bold text-secondary-900 font-display tracking-tight">
              {card.value}
            </p>

            {/* Trend */}
            <div className="mt-3 flex items-center gap-1.5">
              {card.trend.direction === 'up' && (
                <span className={`text-xs font-medium ${colors.trendUp}`}>↑</span>
              )}
              {card.trend.direction === 'down' && (
                <span className={`text-xs font-medium ${colors.trendDown}`}>↓</span>
              )}
              <span
                className={`text-xs ${
                  card.trend.direction === 'up'
                    ? colors.trendUp
                    : card.trend.direction === 'down'
                    ? colors.trendDown
                    : 'text-secondary-400'
                }`}
              >
                {card.trend.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardKPIs;
