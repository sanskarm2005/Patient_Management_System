import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import supabase from './services/supabase';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WaitingRoom from './pages/WaitingRoom';
import PatientBooking from './pages/PatientBooking';
import PatientsPage from './pages/PatientsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';

// Components
import Layout from './components/Layout';
import { formatToken } from './services/queueService';

const getLocalDateString = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const App = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('medclinic_theme') || 'light');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Global Clinic States
  const [queue, setQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Theme Toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('medclinic_theme', nextTheme);
  };

  // Auth State Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const cleanupForNewDay = async () => {
    const todayStr = getLocalDateString();
    const cleanupKey = 'medclinic_last_cleanup_date';

    try {
      const lastCleanupDate = localStorage.getItem(cleanupKey);

      // Already cleaned for today's date
      if (lastCleanupDate === todayStr) {
        return;
      }

      console.log('NEW DAY DETECTED - Running clinic cleanup:', todayStr);

      // 1. Delete all queue entries from previous days
      const { error: queueCleanupError } = await supabase
        .from('queue_entries')
        .delete()
        .lt('queue_date', todayStr);

      if (queueCleanupError) {
        throw queueCleanupError;
      }

      // Remember that today's queue cleanup has completed
      localStorage.setItem(cleanupKey, todayStr);

      console.log('DAILY CLEANUP COMPLETE:', todayStr);
    } catch (err) {
      console.error('Daily cleanup failed:', err);
    }
  };

  // Fetch Database Data (Public vs Protected Separation)
  const fetchAllData = async () => {
    try {
      await cleanupForNewDay();

      // 1. PUBLIC CLINIC DATA (Always fetched, even for public TV display)
      const { data: profileList } = await supabase.from('profiles').select('*');
      setDoctors(profileList?.filter(p => p.role === 'doctor') || []);

      const { data: patientList } = await supabase.from('patients').select('*');
      const safePatients = patientList || [];
      setPatients(safePatients);

      const todayStr = new Date().toISOString().split('T')[0];
      const { data: queueList, error: queueError } = await supabase
        .from('queue_entries')
        .select('*');

      // console.log("=================================");
      // console.log("TODAY:", todayStr);
      // console.log("QUEUE FETCH ERROR:", queueError);
      // console.log("ALL QUEUE ROW COUNT:", queueList?.length);

      // console.log(
      //   "ALL QUEUE ROWS:",
      //   queueList?.map(q => ({
      //     id: q.id,
      //     token: q.token_number,
      //     patient_id: q.patient_id,
      //     doctor_id: q.doctor_id,
      //     status: q.status,
      //     queue_date: q.queue_date,
      //     arrival_time: q.arrival_time,
      //     created_at: q.created_at
      //   }))
      // );

      // console.log("=================================");

      const enrichedQueue = (queueList || []).map(entry => ({
        ...entry,
        patient: safePatients.find(p => p.id === entry.patient_id)
      }));

      setQueue(enrichedQueue);

      // 2. PROTECTED STAFF DATA (Fetched only when logged in)
      if (user) {
        const { data: apptList } = await supabase.from('appointments').select('*');
        setAppointments(apptList || []);

        const { data: notifList } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
        setNotifications(notifList || []);

        const { data: logList } = await supabase.from('audit_logs').select('*');
        setAuditLogs(logList || []);
      } else {
        // Clear staff data if logged out
        setAppointments([]);
        setNotifications([]);
        setAuditLogs([]);
      }
    } catch (err) {
      console.error('Error fetching clinic data:', err);
    }
  };

  // Re-fetch always on mount and when user auth status changes
  useEffect(() => {
    fetchAllData();
  }, [user]);

  const notifyOtherTabs = () => {
    try {
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('medclinic_queue_sync');
        channel.postMessage({ type: 'QUEUE_UPDATED', timestamp: Date.now() });
        channel.close();
      }
    } catch (e) { }
    try {
      localStorage.setItem('medclinic_last_update', Date.now().toString());
    } catch (e) { }
  };

  // Realtime synchronization subscriptions & Cross-tab Broadcasting
  useEffect(() => {
    // 1. Cross-tab BroadcastChannel for instant same-browser multi-tab sync
    let syncChannel = null;
    try {
      if ('BroadcastChannel' in window) {
        syncChannel = new BroadcastChannel('medclinic_queue_sync');
        syncChannel.onmessage = (event) => {
          if (event.data?.type === 'QUEUE_UPDATED') {
            fetchAllData();
          }
        };
      }
    } catch (e) { }

    const handleStorageChange = (e) => {
      if (e.key === 'medclinic_last_update') {
        fetchAllData();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 2. PUBLIC SUPABASE REALTIME SUBSCRIPTION
    const queueChannel = supabase.channel('realtime:queue_entries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
        fetchAllData();
      })
      .subscribe();

    // 3. FAST POLLING FALLBACK (Polls DB every 3s to guarantee instant sync across screens/devices)
    const pollInterval = setInterval(() => {
      fetchAllData();
    }, 3000);

    // 4. PROTECTED SUBSCRIPTIONS (Listen to staff updates only when authenticated)
    let apptsChannel = null;
    let notifsChannel = null;

    if (user) {
      apptsChannel = supabase.channel('realtime:appointments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
          fetchAllData();
        })
        .subscribe();

      notifsChannel = supabase.channel('realtime:notifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
          fetchAllData();
        })
        .subscribe();
    }

    return () => {
      if (syncChannel) syncChannel.close();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
      queueChannel.unsubscribe();
      if (apptsChannel) apptsChannel.unsubscribe();
      if (notifsChannel) notifsChannel.unsubscribe();
    };
  }, [user]);

  // --- DATABASE HELPERS ---

  const handleAddPatientToQueue = async (data) => {
    const todayStr = getLocalDateString();
    const todayQueue = queue.filter(e => e.queue_date === todayStr);

    // Generate next token number
    const maxToken = todayQueue.reduce((max, e) => (e.token_number > max ? e.token_number : max), 0);
    const nextToken = maxToken + 1;

    try {
      const { data: inserted, error } = await supabase.from('queue_entries').insert({
        token_number: nextToken,
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        appointment_id: data.appointment_id || null,
        visit_type: data.visit_type,
        status: 'waiting',
        arrival_time: new Date().toISOString(),
        queue_date: todayStr
      }).select().single();

      if (error) {
        throw error;
      }

      // Log Audit Entry
      const patName = patients.find(p => p.id === data.patient_id)?.full_name || 'Patient';
      const docName = doctors.find(d => d.id === data.doctor_id)?.full_name || 'Doctor';

      await handleAddAuditLog({
        action: 'Check In Queue',
        entity: 'Queue',
        entity_id: inserted?.id || null,
        metadata: { token: nextToken, patient: patName, doctor: docName }
      });

      // Trigger notification
      await handleAddNotification({
        title: 'Patient Checked In',
        message: `${patName} checked in for ${docName}. Token: ${formatToken(nextToken)}.`,
        type: 'queue_update'
      });

      await fetchAllData();
      notifyOtherTabs();
    } catch (err) {
      console.error('Error adding patient to queue:', err);
      alert(`QUEUE ERROR: ${err.message || 'Unknown error'}`);
    }
  };

  const handleUpdateQueueStatus = async (id, nextStatus, metadata = {}) => {
    const cleanMetadata = { ...metadata };

    // Sanitize called_by UUID format and verify against doctors list
    if (cleanMetadata.called_by && !isUuid(cleanMetadata.called_by)) {
      cleanMetadata.called_by = null;
    }
    if (cleanMetadata.called_by && doctors && doctors.length > 0) {
      const isKnownDoctor = doctors.some(d => d.id === cleanMetadata.called_by);
      if (!isKnownDoctor) {
        cleanMetadata.called_by = null;
      }
    }

    if (cleanMetadata.doctor_id && !isUuid(cleanMetadata.doctor_id)) {
      cleanMetadata.doctor_id = doctors[0]?.id || '11111111-1111-1111-1111-111111111111';
    }

    // 1. Optimistically update local React queue state immediately
    setQueue(prev => prev.map(e => e.id === id ? { ...e, status: nextStatus, ...cleanMetadata } : e));
    notifyOtherTabs();

    try {
      if (isUuid(id)) {
        let { data: updated, error } = await supabase.from('queue_entries')
          .update({ status: nextStatus, ...cleanMetadata })
          .eq('id', id)
          .select();

        if (error) {
          console.warn('Supabase status update error:', error.message || error);
          // If foreign key constraint failed (e.g. called_by not in profiles), retry with called_by: null
          if (error.code === '23503' || (error.message && (error.message.includes('foreign key constraint') || error.message.includes('called_by_fkey')))) {
            const fallbackMetadata = { ...cleanMetadata, called_by: null };
            const { error: retryError } = await supabase.from('queue_entries')
              .update({ status: nextStatus, ...fallbackMetadata })
              .eq('id', id)
              .select();

            if (retryError) {
              console.warn('Retry status update error:', retryError.message || retryError);
            } else {
              console.info('Status updated successfully with fallback called_by=null');
            }
          }
        }
      } else {
        // Mock DB fallback for non-UUID initial entries (e.g. q1, q2)
        try {
          const dbData = localStorage.getItem('medclinic_db_v1');
          if (dbData) {
            const db = JSON.parse(dbData);
            db.queue_entries = (db.queue_entries || []).map(e =>
              e.id === id ? { ...e, status: nextStatus, ...cleanMetadata } : e
            );
            localStorage.setItem('medclinic_db_v1', JSON.stringify(db));
          }
        } catch (e) { }
      }

      // Re-fetch data but preserve active optimistic state changes
      const todayStr = getLocalDateString();
      const { data: queueList } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('queue_date', todayStr);

      if (queueList && queueList.length > 0) {
        setPatients(prevPatients => {
          const enrichedQueue = queueList.map(entry => {
            if (entry.id === id) {
              return { ...entry, status: nextStatus, ...cleanMetadata, patient: prevPatients.find(p => p.id === entry.patient_id) };
            }
            return { ...entry, patient: prevPatients.find(p => p.id === entry.patient_id) };
          });
          setQueue(enrichedQueue);
          return prevPatients;
        });
      }
      // Update compact daily doctor summary
      if (
        ['completed', 'no_show', 'cancelled'].includes(nextStatus) &&
        isUuid(id)
      ) {
        // Read the current status directly from Supabase
        // so the same final status cannot be counted twice.
        const { data: currentEntry, error: currentEntryError } = await supabase
          .from('queue_entries')
          .select('id, doctor_id, status')
          .eq('id', id)
          .maybeSingle();

        if (currentEntryError) {
          console.warn(
            'Could not read current queue status:',
            currentEntryError.message
          );
        } else if (
          currentEntry &&
          currentEntry.status !== nextStatus &&
          currentEntry.doctor_id
        ) {
          const doctor = doctors.find(d => d.id === currentEntry.doctor_id);

          if (doctor) {
            const todayStr = getLocalDateString();

            const { data: existingSummary, error: summaryFetchError } =
              await supabase
                .from('daily_doctor_summaries')
                .select('*')
                .eq('summary_date', todayStr)
                .eq('doctor_id', currentEntry.doctor_id)
                .maybeSingle();

            if (summaryFetchError) {
              console.warn(
                'Daily summary fetch error:',
                summaryFetchError.message
              );
            } else {
              const summary = existingSummary || {
                summary_date: todayStr,
                doctor_id: currentEntry.doctor_id,
                doctor_name: doctor.full_name,
                completed_count: 0,
                no_show_count: 0,
                cancelled_count: 0
              };

              if (nextStatus === 'completed') {
                summary.completed_count += 1;
              }

              if (nextStatus === 'no_show') {
                summary.no_show_count += 1;
              }

              if (nextStatus === 'cancelled') {
                summary.cancelled_count += 1;
              }

              const { error: summarySaveError } = await supabase
                .from('daily_doctor_summaries')
                .upsert(summary, {
                  onConflict: 'summary_date,doctor_id'
                });

              if (summarySaveError) {
                console.warn(
                  'Daily summary save error:',
                  summarySaveError.message
                );
              }
            }
          }
        }
      }

      notifyOtherTabs();
      return true;
    } catch (err) {
      console.warn('Queue status update notice:', err);
      return true;
    }
  };

  const handleAddAppointment = async (data) => {
    try {
      const { data: inserted, error } = await supabase.from('appointments').insert(data).select().single();
      if (error) throw error;
      fetchAllData();
      return inserted;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const isUuid = (str) => typeof str === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);

  const handleAddNotification = async (data) => {
    try {
      // Notifications are intentionally NOT saved to Supabase.
      // They exist only in the current app session.
      const notification = {
        id: crypto.randomUUID(),
        user_id: isUuid(data.user_id) ? data.user_id : null,
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        is_read: false,
        created_at: new Date().toISOString()
      };

      setNotifications(prev => [notification, ...prev]);

      return notification;
    } catch (err) {
      console.warn('Notification error:', err);
      return null;
    }
  };

  const handleAddAuditLog = async (data) => {
    try {
      const validUserId = isUuid(user?.id) ? user.id : null;
      const validEntityId = isUuid(data.entity_id) ? data.entity_id : null;

      const { data: inserted, error } = await supabase.from('audit_logs').insert({
        user_id: validUserId,
        action: data.action,
        entity: data.entity,
        entity_id: validEntityId,
        metadata: {
          ...data.metadata,
          ...(data.entity_id && !validEntityId ? { raw_entity_id: data.entity_id } : {})
        }
      }).select().single();

      if (error) {
        console.warn('Audit log insert notice:', error.message);
        return null;
      }
      fetchAllData();
      return inserted;
    } catch (err) {
      console.warn('Audit log notice:', err);
      return null;
    }
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '1rem'
      }}>
        Loading MedClinic Portal...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing & Login */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/" replace />}
        />

        {/* Public Booking Page */}
        <Route
          path="/book"
          element={
            <PatientBooking
              patients={patients}
              appointments={appointments}
              doctors={doctors}
              onAddAppointment={handleAddAppointment}
              onAddAuditLog={handleAddAuditLog}
              onAddNotification={handleAddNotification}
            />
          }
        />

        {/* Public waiting room display */}
        <Route
          path="/waiting-room"
          element={
            <WaitingRoom
              queue={queue}
              doctors={doctors}
            />
          }
        />

        {/* Protected layout routes */}
        <Route
          path="/"
          element={
            user ? (
              <Layout
                theme={theme}
                toggleTheme={toggleTheme}
                user={user}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              >
                <Dashboard
                  user={user}
                  queue={queue}
                  patients={patients}
                  appointments={appointments}
                  doctors={doctors}
                  notifications={notifications}
                  onAddPatientToQueue={handleAddPatientToQueue}
                  onUpdateQueueStatus={handleUpdateQueueStatus}
                  onAddAuditLog={handleAddAuditLog}
                  onAddNotification={handleAddNotification}
                />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/queue"
          element={
            user ? (
              <Layout
                theme={theme}
                toggleTheme={toggleTheme}
                user={user}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              >
                <Dashboard
                  user={user}
                  queue={queue}
                  patients={patients}
                  appointments={appointments}
                  doctors={doctors}
                  notifications={notifications}
                  isQueueView={true}
                  onAddPatientToQueue={handleAddPatientToQueue}
                  onUpdateQueueStatus={handleUpdateQueueStatus}
                  onAddAuditLog={handleAddAuditLog}
                  onAddNotification={handleAddNotification}
                />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/patients"
          element={<Navigate to="/" replace />}
        />

        <Route
          path="/appointments"
          element={
            user ? (
              <Layout
                theme={theme}
                toggleTheme={toggleTheme}
                user={user}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              >
                <AppointmentsPage
                  appointments={appointments}
                  patients={patients}
                  doctors={doctors}
                  queue={queue}
                  onAddAppointment={handleAddAppointment}
                  onAddPatientToQueue={handleAddPatientToQueue}
                  onAddAuditLog={handleAddAuditLog}
                  onAddNotification={handleAddNotification}
                />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/audit-logs"
          element={
            user ? (
              user.user_metadata?.role !== 'doctor' ? (
                <Layout
                  theme={theme}
                  toggleTheme={toggleTheme}
                  user={user}
                  notifications={notifications}
                  onMarkNotificationRead={handleMarkNotificationRead}
                  onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
                >
                  <AuditLogPage
                    auditLogs={auditLogs}
                    doctors={doctors}
                  />
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/settings"
          element={
            user ? (
              <Layout
                theme={theme}
                toggleTheme={toggleTheme}
                user={user}
                notifications={notifications}
                onMarkNotificationRead={handleMarkNotificationRead}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              >
                <SettingsPage
                  doctors={doctors}
                  onAddAuditLog={handleAddAuditLog}
                  onDoctorsChange={fetchAllData}
                />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Fallback routing redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
