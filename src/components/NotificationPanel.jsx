import React from 'react';
import { Bell, Check, Clock, UserCheck, Calendar, Info } from 'lucide-react';

const icons = {
  patient_called: { icon: UserCheck, color: 'var(--danger)', bg: 'var(--danger-light)' },
  new_appointment: { icon: Calendar, color: 'var(--primary)', bg: 'var(--primary-light)' },
  queue_update: { icon: Clock, color: 'var(--warning)', bg: 'var(--warning-light)' },
  system: { icon: Info, color: 'var(--info)', bg: 'var(--info-light)' }
};

export const NotificationPanel = ({ notifications = [], onMarkRead, onMarkAllRead, onClose }) => {
  return (
    <div className="notification-dropdown animate-fade-in">
      <div className="notification-header">
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} /> Notifications
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          {notifications.some(n => !n.is_read) && (
            <button 
              onClick={onMarkAllRead} 
              style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>
      <div className="notification-body">
        {notifications.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No new notifications
          </div>
        ) : (
          notifications.map((notif) => {
            const cfg = icons[notif.type] || icons.system;
            const Icon = cfg.icon;
            
            return (
              <div 
                key={notif.id} 
                className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                onClick={() => onMarkRead(notif.id)}
              >
                <div 
                  className="notification-item-icon" 
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  <Icon size={16} />
                </div>
                <div className="notification-content">
                  <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start' }}>
                    <span className="notification-title">{notif.title}</span>
                    {!notif.is_read && (
                      <span style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        backgroundColor: 'var(--primary)',
                        display: 'inline-block',
                        marginLeft: 'auto'
                      }} />
                    )}
                  </div>
                  <span className="notification-msg">{notif.message}</span>
                  <span className="notification-time">
                    {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="notification-footer" onClick={onClose}>
        Close Panel
      </div>
    </div>
  );
};

export default NotificationPanel;
