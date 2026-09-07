import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Activity, 
  Home, 
  Users, 
  Calendar, 
  ListOrdered, 
  Settings, 
  ClipboardList, 
  Bell, 
  Sun, 
  Moon, 
  LogOut, 
  Tv,
  BookOpen
} from 'lucide-react';
import supabase from '../services/supabase';
import NotificationPanel from './NotificationPanel';

export const Layout = ({ children, theme, toggleTheme, user, notifications, onMarkNotificationRead, onMarkAllNotificationsRead }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  // Close notifications panel on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (!user) return <>{children}</>;

  const role = user.user_metadata?.role || 'receptionist';
  const fullName = user.user_metadata?.full_name || 'Clinic Staff';
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Define navigation links based on user roles
  const getNavLinks = () => {
    if (role === 'doctor') {
      return [
        { path: '/', label: 'Dashboard', icon: Home },
        { path: '/queue', label: 'My Queue', icon: ListOrdered },
        { path: '/settings', label: 'Settings', icon: Settings }
      ];
    }

    // Receptionist / Admin links
    return [
      { path: '/', label: 'Dashboard', icon: Home },
      { path: '/queue', label: 'Queue Management', icon: ListOrdered },
      { path: '/appointments', label: 'Appointments', icon: Calendar },
      { path: '/audit-logs', label: 'Audit Log', icon: ClipboardList },
      { path: '/settings', label: 'Settings', icon: Settings }
    ];
  };

  const navLinks = getNavLinks();

  // Get Page Title from Route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/queue')) return 'Queue Management';
    if (path.startsWith('/appointments')) return 'Appointments';
    if (path.startsWith('/patients')) return 'Patient Records';
    if (path.startsWith('/audit-logs')) return 'Audit Logs';
    if (path.startsWith('/settings')) return 'Settings';
    return 'Clinic Portal';
  };

  return (
    <div className="app-container" data-theme={theme}>
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Activity size={20} />
          </div>
          <span className="logo-text">MedClinic</span>
        </div>
        
        <nav className="sidebar-nav">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink 
                key={link.path} 
                to={link.path} 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
          
          <div style={{ margin: '16px 0', borderBottom: '1px solid var(--border-color)' }} />
          
          {/* Quick links to TV board and Patient Booking */}
          <NavLink to="/waiting-room" target="_blank" className="nav-item">
            <Tv size={18} />
            <span>Waiting Room TV</span>
          </NavLink>
          <NavLink to="/book" target="_blank" className="nav-item">
            <BookOpen size={18} />
            <span>Booking Page</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-summary">
            <div className="avatar">
              {fullName.charAt(0)}
            </div>
            <div className="profile-info">
              <span className="profile-name">{fullName}</span>
              <span className="profile-role">{role}</span>
            </div>
          </div>
          <button 
            className="btn btn-outline" 
            style={{ width: '100%', marginTop: '12px', padding: '8px 12px', fontSize: '0.85rem' }}
            onClick={handleLogout}
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      {/* --- MAIN PAGE CONTENT --- */}
      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <h2 className="page-title">{getPageTitle()}</h2>
          </div>
          
          <div className="header-right">
            {/* Theme Toggle Button */}
            <button 
              className="btn-icon" 
              onClick={toggleTheme} 
              aria-label="Toggle theme mode"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Notifications Trigger */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button 
                className="btn-icon" 
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="Show notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span style={{ 
                    position: 'absolute', 
                    top: '6px', 
                    right: '6px', 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--danger)' 
                  }} />
                )}
              </button>
              
              {showNotifications && (
                <NotificationPanel 
                  notifications={notifications}
                  onMarkRead={(id) => {
                    onMarkNotificationRead(id);
                  }}
                  onMarkAllRead={() => {
                    onMarkAllNotificationsRead();
                  }}
                  onClose={() => setShowNotifications(false)}
                />
              )}
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

            {/* User details (Visible on tablet/desktop) */}
            <span style={{ fontSize: '0.9rem', fontWeight: '500', display: 'none', md: 'inline' }}>
              Hi, {fullName.split(' ')[0]}
            </span>
          </div>
        </header>

        <main className="page-container">
          {children}
        </main>
      </div>

      {/* --- MOBILE BOTTOM NAVIGATION BAR --- */}
      <nav className="mobile-nav-bar">
        {navLinks.slice(0, 4).map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <NavLink 
              key={link.path} 
              to={link.path} 
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
        {/* Simple signout icon on bottom right */}
        <button className="mobile-nav-item" onClick={handleLogout} style={{ border: 'none' }}>
          <LogOut size={20} />
          <span>Log Out</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;
