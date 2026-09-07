import React, { useMemo } from 'react';
import { ClipboardList, User, Calendar, ShieldCheck } from 'lucide-react';

export const AuditLogPage = ({ auditLogs = [], doctors }) => {
  // Sort logs: newest first
  const sortedLogs = useMemo(() => {
    return [...auditLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [auditLogs]);

  return (
    <div className="card" style={{ padding: '24px 0' }}>
      <div style={{ padding: '0 24px 16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ClipboardList size={22} style={{ color: 'var(--primary)' }} />
        <div>
          <h3 style={{ margin: 0 }}>System Security Audit Trail</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Immutable administrative operations register.
          </p>
        </div>
      </div>

      {sortedLogs.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No operations logged.
        </div>
      ) : (
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator ID</th>
                <th>Action Code</th>
                <th>Entity Class</th>
                <th>Target Entity ID</th>
                <th>Operation Details</th>
              </tr>
            </thead>
            <tbody>
              {sortedLogs.map((log) => {
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} style={{ color: 'var(--text-muted)' }} />
                        {log.user_id || 'system'}
                      </span>
                    </td>
                    <td>
                      <span className="badge animate-fade-in" style={{
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                        fontSize: '0.75rem'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: '500' }}>{log.entity}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {log.entity_id || '-'}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.metadata ? JSON.stringify(log.metadata) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
