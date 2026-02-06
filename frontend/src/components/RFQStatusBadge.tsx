import React from 'react';
import { RFQStatus } from '@/types/rfq-extended';

interface RFQStatusBadgeProps {
  status: RFQStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<RFQStatus, { label: string; classes: string }> = {
  draft: {
    label: 'Draft',
    classes: 'bg-secondary-100 text-secondary-600 border-secondary-200',
  },
  published: {
    label: 'Published',
    classes: 'bg-primary-50 text-primary-700 border-primary-100',
  },
  evaluation: {
    label: 'In Evaluation',
    classes: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  closed: {
    label: 'Closed',
    classes: 'bg-red-50 text-red-700 border-red-100',
  },
  awarded: {
    label: 'Awarded',
    classes: 'bg-green-50 text-green-700 border-green-100',
  },
};

const sizeClasses: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-xs',
  lg: 'px-4 py-1.5 text-sm',
};

const RFQStatusBadge: React.FC<RFQStatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.classes} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
};

export default RFQStatusBadge;
