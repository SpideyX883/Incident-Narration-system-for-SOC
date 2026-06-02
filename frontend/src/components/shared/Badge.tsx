import React from 'react';

interface BadgeProps {
  status: 'CONFIRMED' | 'UNVERIFIED' | 'PHANTOM' | 'NOT_CITED' | 'free' | 'paid' | 'consensus' | 'partial' | 'divergent';
  children?: React.ReactNode;
}

const statusClasses: Record<string, string> = {
  CONFIRMED: 'badge-confirmed',
  UNVERIFIED: 'badge-unverified',
  PHANTOM: 'badge-phantom',
  NOT_CITED: 'badge bg-sybil-surface3 text-sybil-text3 border border-sybil-border',
  free: 'badge-free',
  paid: 'badge-paid',
  consensus: 'badge-confirmed',
  partial: 'badge-unverified',
  divergent: 'badge-phantom',
};

const statusLabels: Record<string, string> = {
  CONFIRMED: '✓ CONFIRMED',
  UNVERIFIED: '? UNVERIFIED',
  PHANTOM: '✗ PHANTOM',
  NOT_CITED: '– NOT CITED',
  free: 'FREE',
  paid: 'PAID',
  consensus: 'CONSENSUS',
  partial: 'PARTIAL',
  divergent: 'DIVERGENT',
};

export function Badge({ status, children }: BadgeProps) {
  return (
    <span className={statusClasses[status] || 'badge'}>
      {children || statusLabels[status] || status}
    </span>
  );
}
