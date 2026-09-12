import React from 'react';
import { ClipboardList, CheckCircle, UserX, Ban } from 'lucide-react';

export const AuditLogPage = ({ dailySummaries = [] }) => {
  return (
    <div className="card" style={{ padding: '24px 0' }}>
      {/* Header */}
      <div
        style={{
          padding: '0 24px 16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <ClipboardList
          size={22}
          style={{ color: 'var(--primary)', flexShrink: 0 }}
        />

        <div>
          <h3 style={{ margin: 0 }}>
            Daily Doctor Summary
          </h3>

          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginTop: '2px'
            }}
          >
            Daily count of completed, no-show and cancelled consultations.
          </p>
        </div>
      </div>

      {/* Empty State */}
      {dailySummaries.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}
        >
          No daily summary available.
        </div>
      ) : (
        <>
          {/* Desktop / Tablet Table */}
          <div
            className="table-container"
            style={{
              border: 'none',
              borderRadius: 0,
              overflowX: 'auto'
            }}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle size={14} />
                      Completed
                    </span>
                  </th>

                  <th>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <UserX size={14} />
                      No Show
                    </span>
                  </th>

                  <th>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Ban size={14} />
                      Cancelled
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {dailySummaries.map((summary) => (
                  <tr key={summary.id || `${summary.summary_date}-${summary.doctor_id}`}>
                    {/* Doctor */}
                    <td
                      style={{
                        fontWeight: '600'
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--primary-light)',
                            color: 'var(--primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <ClipboardList size={15} />
                        </span>

                        {summary.doctor_name || 'Unknown Doctor'}
                      </span>
                    </td>

                    {/* Completed */}
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '36px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          backgroundColor: 'var(--success-light, #e8f5e9)',
                          color: 'var(--success, #2e7d32)'
                        }}
                      >
                        {summary.completed_count || 0}
                      </span>
                    </td>

                    {/* No Show */}
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '36px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          backgroundColor: 'var(--warning-light, #fff8e1)',
                          color: 'var(--warning, #f57c00)'
                        }}
                      >
                        {summary.no_show_count || 0}
                      </span>
                    </td>

                    {/* Cancelled */}
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '36px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          backgroundColor: 'var(--danger-light, #ffebee)',
                          color: 'var(--danger, #c62828)'
                        }}
                      >
                        {summary.cancelled_count || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Date */}
          {dailySummaries[0]?.summary_date && (
            <div
              style={{
                padding: '14px 24px 0',
                fontSize: '0.78rem',
                color: 'var(--text-muted)'
              }}
            >
              Date:{' '}
              <strong>
                {new Date(
                  `${dailySummaries[0].summary_date}T00:00:00`
                ).toLocaleDateString()}
              </strong>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditLogPage;