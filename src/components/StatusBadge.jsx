import React from 'react';

const statusConfigs = {
  waiting: { label: 'Waiting', className: 'badge-waiting', style: { backgroundColor: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)' } },
  called: { label: 'Called', className: 'badge-called', style: { backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' } },
  in_consultation: { label: 'In Consultation', className: 'badge-consultation', style: { backgroundColor: 'var(--info-light)', color: 'var(--info)', border: '1px solid rgba(6, 182, 212, 0.3)' } },
  completed: { label: 'Completed', className: 'badge-completed', style: { backgroundColor: 'var(--success-light)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)' } },
  no_show: { label: 'No Show', className: 'badge-noshow', style: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' } },
  cancelled: { label: 'Cancelled', className: 'badge-cancelled', style: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', textDecoration: 'line-through' } }
};

export const StatusBadge = ({ status }) => {
  const normStatus = (status || '').toLowerCase();
  const config = statusConfigs[normStatus] || {
    label: status,
    style: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
  };

  return (
    <span className="badge" style={config.style}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
