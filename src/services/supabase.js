import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Determine if we should use mock data
const isMock = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder');
console.log("SUPABASE DEBUG:", {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  isMock,
  url: supabaseUrl
});


// --- REAL SUPABASE CLIENT ---
let realClient = null;
if (!isMock) {
  try {
    realClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Failed to initialize real Supabase client, falling back to mock:', err);
  }
}

// --- HIGH-FIDELITY LOCAL STORAGE MOCK ENGINE ---
const MOCK_STORAGE_KEY = 'medclinic_db_v1';

// Initial Seed Data
const defaultDb = {
  profiles: [
    { id: 'd1', full_name: 'Dr. Sarah Johnson', role: 'doctor', specialty: 'General Physician', room_number: 'Room 1', status: 'active', created_at: new Date().toISOString() },
    { id: 'r1', full_name: 'Rhea Patel', role: 'receptionist', specialty: '', room_number: '', status: 'active', created_at: new Date().toISOString() }
  ],
  patients: [
    { id: 'p1', patient_id: 'P000101', full_name: 'Rahul Sen', phone_number: '9876543210', date_of_birth: '1990-05-15', gender: 'Male', address: '123 Park Street, Mumbai', emergency_contact_name: 'Amit Sen', emergency_contact_phone: '9876543211', allergies: 'Penicillin', medical_history: 'Hypertension', notes: 'Prefers morning slots', created_at: new Date().toISOString() },
    { id: 'p2', patient_id: 'P000102', full_name: 'Priya Kumar', phone_number: '9812345678', date_of_birth: '1985-11-22', gender: 'Female', address: '456 Ring Road, Delhi', emergency_contact_name: 'Rohan Kumar', emergency_contact_phone: '9812345679', allergies: 'None', medical_history: 'Diabetes', notes: 'Asthma history', created_at: new Date().toISOString() },
    { id: 'p3', patient_id: 'P000103', full_name: 'Amit Patel', phone_number: '9988776655', date_of_birth: '1978-02-09', gender: 'Male', address: '789 Main Rd, Ahmedabad', emergency_contact_name: 'Kiran Patel', emergency_contact_phone: '9988776654', allergies: 'Sulfa Drugs', medical_history: 'None', notes: '', created_at: new Date().toISOString() },
    { id: 'p4', patient_id: 'P000104', full_name: 'Meera Joshi', phone_number: '9123456789', date_of_birth: '1995-07-30', gender: 'Female', address: '101 Lake View, Bangalore', emergency_contact_name: 'Suhas Joshi', emergency_contact_phone: '9123456780', allergies: 'Peanuts', medical_history: 'None', notes: '', created_at: new Date().toISOString() },
    { id: 'p5', patient_id: 'P000105', full_name: 'John D\'souza', phone_number: '9555666777', date_of_birth: '1962-12-01', gender: 'Male', address: '12 Hill View, Goa', emergency_contact_name: 'Mary D\'souza', emergency_contact_phone: '9555666778', allergies: 'None', medical_history: 'Asthma', notes: 'Needs wheelchair access', created_at: new Date().toISOString() }
  ],
  appointments: [
    { id: 'a1', patient_id: 'p2', doctor_id: 'd1', appointment_date: new Date().toISOString().split('T')[0], appointment_time: '10:15', reason: 'Routine Checkup', status: 'scheduled', created_at: new Date().toISOString() },
    { id: 'a2', patient_id: 'p4', doctor_id: 'd1', appointment_date: new Date().toISOString().split('T')[0], appointment_time: '11:00', reason: 'Chest Tightness', status: 'scheduled', created_at: new Date().toISOString() }
  ],
  queue_entries: [
    { id: 'q1', token_number: 1, patient_id: 'p1', doctor_id: 'd1', appointment_id: null, visit_type: 'walk-in', status: 'waiting', arrival_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(), called_time: null, called_by: null, consultation_start_time: null, consultation_end_time: null, queue_date: new Date().toISOString().split('T')[0] },
    { id: 'q2', token_number: 2, patient_id: 'p3', doctor_id: 'd1', appointment_id: null, visit_type: 'walk-in', status: 'waiting', arrival_time: new Date(Date.now() - 15 * 60 * 1000).toISOString(), called_time: null, called_by: null, consultation_start_time: null, consultation_end_time: null, queue_date: new Date().toISOString().split('T')[0] }
  ],
  consultations: [],
  notifications: [
    { id: 'n1', user_id: null, title: 'Welcome to MedClinic', message: 'Queue management system initialized.', type: 'system', is_read: false, created_at: new Date().toISOString() }
  ],
  audit_logs: [
    { id: 'l1', user_id: 'r1', action: 'System Setup', entity: 'System', entity_id: 'r1', timestamp: new Date().toISOString(), metadata: { info: 'Mock database seeded successfully' } }
  ],
  clinic_settings: {
    clinic_name: 'MedClinic Queue System',
    avg_consultation_duration: 10
  }
};

// Initialize localStorage DB if empty
const loadDb = () => {
  try {
    const data = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!data) {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(defaultDb));
      return defaultDb;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading localStorage DB, returning default:', err);
    return defaultDb;
  }
};

const saveDb = (db) => {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Error saving localStorage DB:', err);
  }
};

// Listeners for simulating Supabase Realtime subscription
const realtimeListeners = [];

const notifyRealtime = (table, event, data) => {
  realtimeListeners.forEach(listener => {
    if (listener.table === '*' || listener.table === table) {
      if (listener.callback) {
        listener.callback({
          schema: 'public',
          table,
          commit_timestamp: new Date().toISOString(),
          eventType: event,
          new: data,
          old: event === 'UPDATE' || event === 'DELETE' ? { id: data.id } : null
        });
      }
    }
  });
};

// Sync across multiple browser tabs in mock mode using window storage event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === MOCK_STORAGE_KEY) {
      // Trigger update callbacks to sync states in other tabs
      realtimeListeners.forEach(listener => {
        if (listener.callback) {
          listener.callback({
            schema: 'public',
            table: listener.table,
            commit_timestamp: new Date().toISOString(),
            eventType: 'UPDATE',
            new: {},
            old: null
          });
        }
      });
    }
  });
}

const mockSupabase = {
  isMock: true,
  
  // Simulated Authentication
  auth: {
    user: null,
    
    signUp: async ({ email, password, options }) => {
      const db = loadDb();
      const profile = {
        id: Math.random().toString(36).substr(2, 9),
        full_name: options?.data?.full_name || email.split('@')[0],
        role: options?.data?.role || 'receptionist',
        specialty: options?.data?.specialty || '',
        room_number: options?.data?.room_number || '',
        status: 'active',
        created_at: new Date().toISOString()
      };
      db.profiles.push(profile);
      saveDb(db);
      
      const session = { user: { id: profile.id, email, user_metadata: options?.data } };
      return { data: { user: session.user, session }, error: null };
    },

    signInWithPassword: async ({ email, password }) => {
      const db = loadDb();
      // Simple mock login match by email
      const matchedProfile = db.profiles.find(
        p => p.full_name.toLowerCase().replace(/\s/g, '') === email.split('@')[0].toLowerCase() ||
             (p.role === 'doctor' && email.includes('doctor')) ||
             (p.role === 'receptionist' && email.includes('recept'))
      ) || db.profiles[0]; // fallback to first user
      
      const user = {
        id: matchedProfile.id,
        email,
        user_metadata: {
          full_name: matchedProfile.full_name,
          role: matchedProfile.role,
          specialty: matchedProfile.specialty,
          room_number: matchedProfile.room_number
        }
      };
      
      const session = { user, access_token: 'mock-jwt-token' };
      mockSupabase.auth.user = user;
      localStorage.setItem('medclinic_mock_session', JSON.stringify(session));
      
      // Notify auth listeners
      authListeners.forEach(listener => listener('SIGNED_IN', session));
      
      return { data: { user, session }, error: null };
    },

    signOut: async () => {
      mockSupabase.auth.user = null;
      localStorage.removeItem('medclinic_mock_session');
      authListeners.forEach(listener => listener('SIGNED_OUT', null));
      return { error: null };
    },

    getSession: async () => {
      try {
        const stored = localStorage.getItem('medclinic_mock_session');
        if (stored) {
          const session = JSON.parse(stored);
          mockSupabase.auth.user = session.user;
          return { data: { session }, error: null };
        }
      } catch (e) {}
      return { data: { session: null }, error: null };
    },

    onAuthStateChange: (callback) => {
      authListeners.push(callback);
      // Immediately call with current session
      const stored = localStorage.getItem('medclinic_mock_session');
      const session = stored ? JSON.parse(stored) : null;
      callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
      
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = authListeners.indexOf(callback);
              if (idx !== -1) authListeners.splice(idx, 1);
            }
          }
        }
      };
    }
  },

  // Query Builder Mock
  from: (table) => {
    return {
      select: function (columns = '*') {
        this._op = 'select';
        this._columns = columns;
        return this;
      },
      
      insert: function (data) {
        this._op = 'insert';
        this._data = data;
        return this;
      },
      
      update: function (data) {
        this._op = 'update';
        this._data = data;
        return this;
      },
      
      delete: function () {
        this._op = 'delete';
        return this;
      },

      eq: function (column, val) {
        this._eqColumn = column;
        this._eqVal = val;
        return this;
      },

      order: function (column, { ascending = true } = {}) {
        this._orderColumn = column;
        this._orderAsc = ascending;
        return this;
      },

      single: function () {
        this._single = true;
        return this;
      },

      // Execution method
      then: function (resolve, reject) {
        const db = loadDb();
        let result = db[table] || [];

        // If settings table and is object
        if (table === 'clinic_settings') {
          if (this._op === 'select') {
            return Promise.resolve({ data: db.clinic_settings, error: null }).then(resolve);
          }
          if (this._op === 'update') {
            db.clinic_settings = { ...db.clinic_settings, ...this._data };
            saveDb(db);
            notifyRealtime('clinic_settings', 'UPDATE', db.clinic_settings);
            return Promise.resolve({ data: db.clinic_settings, error: null }).then(resolve);
          }
        }

        // Apply filters (simple equality)
        if (this._eqColumn && this._eqVal !== undefined) {
          result = result.filter(item => item[this._eqColumn] === this._eqVal);
        }

        // Apply sort
        if (this._orderColumn) {
          result = [...result].sort((a, b) => {
            let valA = a[this._orderColumn];
            let valB = b[this._orderColumn];
            if (typeof valA === 'string') {
              return this._orderAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return this._orderAsc ? valA - valB : valB - valA;
          });
        }

        // Single object result
        if (this._single) {
          result = result.length > 0 ? result[0] : null;
        }

        if (this._op === 'select') {
          return Promise.resolve({ data: result, error: null }).then(resolve);
        }

        if (this._op === 'insert') {
          const toInsert = Array.isArray(this._data) ? this._data : [this._data];
          const newRows = toInsert.map(row => ({
            id: row.id || Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            ...row
          }));
          
          db[table] = [...(db[table] || []), ...newRows];
          saveDb(db);

          newRows.forEach(row => notifyRealtime(table, 'INSERT', row));
          
          return Promise.resolve({ data: Array.isArray(this._data) ? newRows : newRows[0], error: null }).then(resolve);
        }

        if (this._op === 'update') {
          let updatedRows = [];
          db[table] = db[table].map(item => {
            if (this._eqColumn && item[this._eqColumn] === this._eqVal) {
              const updated = { ...item, ...this._data };
              updatedRows.push(updated);
              return updated;
            }
            return item;
          });
          saveDb(db);

          updatedRows.forEach(row => notifyRealtime(table, 'UPDATE', row));

          return Promise.resolve({ data: updatedRows, error: null }).then(resolve);
        }

        if (this._op === 'delete') {
          let deletedRows = [];
          db[table] = db[table].filter(item => {
            if (this._eqColumn && item[this._eqColumn] === this._eqVal) {
              deletedRows.push(item);
              return false;
            }
            return true;
          });
          saveDb(db);

          deletedRows.forEach(row => notifyRealtime(table, 'DELETE', row));

          return Promise.resolve({ data: deletedRows, error: null }).then(resolve);
        }

        return Promise.resolve({ data: null, error: 'Operation not supported' }).then(resolve);
      }
    };
  },

  // Simulated Realtime Subscriptions
  channel: (channelName) => {
    return {
      on: function (event, filter, callback) {
        realtimeListeners.push({
          channel: channelName,
          event,
          table: filter.table || '*',
          callback
        });
        return this;
      },
      subscribe: function (statusCallback) {
        if (statusCallback) statusCallback('SUBSCRIBED');
        return {
          unsubscribe: () => {
            // Remove listeners associated with this channel
            const len = realtimeListeners.length;
            for (let i = len - 1; i >= 0; i--) {
              if (realtimeListeners[i].channel === channelName) {
                realtimeListeners.splice(i, 1);
              }
            }
          }
        };
      }
    };
  }
};

const authListeners = [];

// Export Client
export const supabase = isMock ? mockSupabase : realClient;
export default supabase;
