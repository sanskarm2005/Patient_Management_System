import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  Volume2, 
  Activity, 
  ArrowRight, 
  Clipboard, 
  AlertTriangle,
  History,
  FileText,
  User
} from 'lucide-react';
import { 
  sortQueue, 
  formatToken, 
  formatPrivacyName 
} from '../services/queueService';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { InputField, TextareaField } from '../components/FormElements';
import supabase from '../services/supabase';

export const DoctorDashboard = ({ 
  user, 
  queue, 
  patients, 
  appointments, 
  doctors, 
  notifications,
  onUpdateQueueStatus,
  onAddAuditLog,
  onAddNotification
}) => {
  const doctorId = user.id;
  const doctorProfile = doctors.find(d => d.id === doctorId) || user;

  // Consultation notes state
  const [activeConsultationId, setActiveConsultationId] = useState(null); // queueEntryId
  const [activePatientId, setActivePatientId] = useState(null);
  const [consultationForm, setConsultationForm] = useState({
    chiefComplaint: '',
    notes: '',
    diagnosis: '',
    prescription: '',
    followUp: ''
  });

  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'history'

  // Filter queue for this doctor's today entries (First-Come-First-Served order)
  const doctorTodayQueue = useMemo(() => {
    const docEntries = queue.filter(e => e.doctor_id === doctorId);
    return sortQueue(docEntries, 'asc');
  }, [queue, doctorId]);

  // Active consultation patient details
  const activePatientEntry = useMemo(() => {
    return doctorTodayQueue.find(e => e.id === activeConsultationId);
  }, [doctorTodayQueue, activeConsultationId]);

  // Statistics calculation for this doctor
  const stats = useMemo(() => {
    const total = doctorTodayQueue.length;
    const waiting = doctorTodayQueue.filter(e => e.status === 'waiting').length;
    const completed = doctorTodayQueue.filter(e => e.status === 'completed').length;
    const active = doctorTodayQueue.filter(e => e.status === 'in_consultation' || e.status === 'called').length;

    return { total, waiting, completed, active };
  }, [doctorTodayQueue]);

  // Patient previous medical records (consultations)
  const patientHistory = useMemo(() => {
    if (!activePatientId) return [];
    
    // In our mock engine, consultations are saved in localStorage.
    // Let's pull the full database directly via localStorage or supabase.from('consultations')
    // Since our query engine is mockable, let's select from consultations:
    // In a real app we'd do a query. Let's retrieve from localStorage database to be sure.
    try {
      const data = localStorage.getItem('medclinic_db_v1');
      if (data) {
        const db = JSON.parse(data);
        return db.consultations.filter(c => c.patient_id === activePatientId)
          .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
      }
    } catch (e) {}
    return [];
  }, [activePatientId, activeConsultationId]);

  // Call Patient
  const handleCallPatient = async (entry) => {
    try {
      // 1. Auto-transition any previous active patient (called or in_consultation) for this doctor
      const previousActive = queue.find(e => 
        e.doctor_id === doctorId && 
        (e.status === 'called' || e.status === 'in_consultation') &&
        e.id !== entry.id
      );

      if (previousActive) {
        const targetStatus = 'completed';
        await onUpdateQueueStatus(previousActive.id, targetStatus, {
          consultation_end_time: new Date().toISOString()
        });

        // Audit Log transition
        onAddAuditLog({
          action: `Auto Transition (${targetStatus.toUpperCase()})`,
          entity: 'Queue',
          entity_id: previousActive.id,
          metadata: { reason: 'Doctor called next patient', doctor_id: doctorId }
        });
      }

      // 2. Call the current patient
      const roomNum = doctorProfile.room_number || 'Room 1';
      const updated = await onUpdateQueueStatus(entry.id, 'called', {
        called_time: new Date().toISOString(),
        called_by: user?.id || null
      });

      if (updated) {
        onAddNotification({
          title: 'Patient Called',
          message: `${formatPrivacyName(entry.patient?.full_name)} (${formatToken(entry.token_number)}) called to ${roomNum} by ${doctorProfile.full_name}.`,
          type: 'patient_called',
          metadata: { token: entry.token_number, room: roomNum, patient_name: entry.patient?.full_name }
        });

        onAddAuditLog({
          action: 'Call Patient',
          entity: 'Queue',
          entity_id: entry.id,
          metadata: { token: entry.token_number, doctor_id: user.id }
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Call Next Patient
  const handleCallNext = async () => {
    const nextWaiting = doctorTodayQueue.find(e => e.status === 'waiting');
    if (!nextWaiting) {
      alert('No patients waiting in your queue!');
      return;
    }
    await handleCallPatient(nextWaiting);
  };

  // Start Consultation
  const handleStartConsultation = async (entry) => {
    try {
      const updated = await onUpdateQueueStatus(entry.id, 'in_consultation', {
        consultation_start_time: new Date().toISOString()
      });

      if (updated) {
        setActiveConsultationId(entry.id);
        setActivePatientId(entry.patient_id);
        setConsultationForm({
          chiefComplaint: entry.reason || '',
          notes: '',
          diagnosis: '',
          prescription: '',
          followUp: ''
        });
        setActiveTab('notes');

        onAddAuditLog({
          action: 'Start Consultation',
          entity: 'Queue',
          entity_id: entry.id,
          metadata: { token: entry.token_number, patient_id: entry.patient_id }
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Complete Consultation
  const handleCompleteConsultation = async (e) => {
    e.preventDefault();
    if (!activeConsultationId) return;

    try {
      // 1. Mark queue status as completed
      const updated = await onUpdateQueueStatus(activeConsultationId, 'completed', {
        consultation_end_time: new Date().toISOString()
      });

      if (updated) {
        // 2. Insert consultation record
        await supabase.from('consultations').insert({
          queue_entry_id: activeConsultationId,
          patient_id: activePatientId,
          doctor_id: doctorId,
          chief_complaint: consultationForm.chiefComplaint,
          notes: consultationForm.notes,
          diagnosis: consultationForm.diagnosis,
          prescription: consultationForm.prescription,
          follow_up_notes: consultationForm.followUp,
          started_at: activePatientEntry.consultation_start_time || new Date().toISOString(),
          completed_at: new Date().toISOString()
        });

        // 3. Trigger Notification
        onAddNotification({
          title: 'Consultation Completed',
          message: `Consultation finished for ${formatPrivacyName(activePatientEntry.patient?.full_name)} (${formatToken(activePatientEntry.token_number)}).`,
          type: 'queue_update',
          metadata: { token: activePatientEntry.token_number, patient_name: activePatientEntry.patient?.full_name }
        });

        // 4. Log audit log
        onAddAuditLog({
          action: 'Complete Consultation',
          entity: 'Consultation',
          entity_id: activeConsultationId,
          metadata: { token: activePatientEntry.token_number, patient_id: activePatientId }
        });

        // Reset workspace
        setActiveConsultationId(null);
        setActivePatientId(null);
        setConsultationForm({
          chiefComplaint: '', notes: '', diagnosis: '', prescription: '', followUp: ''
        });
      }
    } catch (err) {
      console.error('Error completing consultation:', err);
    }
  };

  return (
    <>
      {/* Clinic Welcome Banner */}
      <div className="card animate-fade-in" style={{ 
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', 
        color: '#ffffff',
        border: 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 32px'
      }}>
        <div>
          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85 }}>
            Welcome back
          </span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', marginTop: '4px' }}>
            {doctorProfile.full_name}
          </h2>
          <span style={{ fontSize: '0.95rem', opacity: 0.9 }}>
            {doctorProfile.specialty} • Room: {doctorProfile.room_number || 'Not Assigned'}
          </span>
        </div>
        <div style={{ display: 'none', sm: 'block' }}>
          <Activity size={64} style={{ opacity: 0.2 }} />
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="stat-grid">
        <StatCard label="Today's Queue" value={stats.total} icon={Users} color="var(--primary)" />
        <StatCard label="Waiting Patients" value={stats.waiting} icon={Clock} color="var(--warning)" />
        <StatCard label="In Consultation" value={doctorTodayQueue.filter(e => e.status === 'in_consultation').length} icon={Activity} color="var(--info)" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle} color="var(--success)" />
      </div>

      {/* Call Next Button Row */}
      {stats.waiting > 0 && (
        <button 
          className="btn btn-danger" 
          onClick={handleCallNext}
          style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
        >
          <Volume2 size={22} /> Call Next Patient ({formatToken(doctorTodayQueue.find(e => e.status === 'waiting')?.token_number)})
        </button>
      )}

      {/* --- CONSULTATION WORKSPACE --- */}
      {activeConsultationId && activePatientEntry && (
        <div className="consultation-workspace animate-fade-in">
          {/* Patient Brief Details Card */}
          <div className="patient-brief-panel">
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--primary-light)', 
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600'
                }}>
                  {activePatientEntry.patient?.full_name.charAt(0)}
                </div>
                <div>
                  <h4 style={{ margin: 0 }}>{activePatientEntry.patient?.full_name}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ID: {activePatientEntry.patient?.patient_id} • {activePatientEntry.patient?.gender}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                <div><strong>Phone:</strong> {activePatientEntry.patient?.phone_number}</div>
                <div><strong>DOB:</strong> {activePatientEntry.patient?.date_of_birth || 'Not recorded'}</div>
                <div><strong>Emergency Contact:</strong> {activePatientEntry.patient?.emergency_contact_name || 'None'} ({activePatientEntry.patient?.emergency_contact_phone || '-'})</div>
              </div>

              {/* Allergies Highlight */}
              {activePatientEntry.patient?.allergies && (
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  padding: '12px', 
                  backgroundColor: 'var(--danger-light)', 
                  color: 'var(--danger)', 
                  borderRadius: '8px',
                  fontSize: '0.85rem'
                }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Allergies:</strong>
                    <div>{activePatientEntry.patient.allergies}</div>
                  </div>
                </div>
              )}

              {/* Patient Notes */}
              {activePatientEntry.patient?.notes && (
                <div style={{ fontSize: '0.85rem', backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
                  <strong>Notes:</strong> {activePatientEntry.patient.notes}
                </div>
              )}
            </div>

            {/* Navigation Tabs (Notes/History) */}
            <div className="card" style={{ padding: '12px' }}>
              <div className="tabs-header" style={{ border: 'none' }}>
                <button 
                  className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notes')}
                  style={{ flex: 1, textAlign: 'center' }}
                >
                  <Clipboard size={16} /> Consultation
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                  style={{ flex: 1, textAlign: 'center' }}
                >
                  <History size={16} /> History ({patientHistory.length})
                </button>
              </div>
            </div>
          </div>

          {/* Consultation Form or History Panel */}
          <div className="consultation-form-panel">
            {activeTab === 'notes' ? (
              <form onSubmit={handleCompleteConsultation} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3>Consultation Notes - {formatToken(activePatientEntry.token_number)}</h3>
                </div>

                <InputField
                  label="Chief Complaint / Reason for Visit"
                  name="chiefComplaint"
                  value={consultationForm.chiefComplaint}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                  required
                />

                <TextareaField
                  label="Consultation Clinical Notes"
                  name="notes"
                  value={consultationForm.notes}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Clinical observations, physical exam notes..."
                />

                <InputField
                  label="Diagnosis"
                  name="diagnosis"
                  value={consultationForm.diagnosis}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, diagnosis: e.target.value }))}
                  placeholder="e.g. Acute bronchitis"
                />

                <TextareaField
                  label="Prescription / Treatment Plan"
                  name="prescription"
                  value={consultationForm.prescription}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, prescription: e.target.value }))}
                  placeholder="Prescription medicines, dosage, and guidelines..."
                />

                <InputField
                  label="Follow-Up Instructions"
                  name="followUp"
                  value={consultationForm.followUp}
                  onChange={(e) => setConsultationForm(prev => ({ ...prev, followUp: e.target.value }))}
                  placeholder="e.g. Return in 5 days if fever persists"
                />

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      if (confirm('Revert status to CALLED and close workspace?')) {
                        onUpdateQueueStatus(activeConsultationId, 'called');
                        setActiveConsultationId(null);
                        setActivePatientId(null);
                      }
                    }}
                  >
                    Cancel / Suspend
                  </button>
                  <button type="submit" className="btn btn-success">
                    Complete Consultation & Next <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            ) : (
              // HISTORY TAB
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3>Patient Visit Records</h3>
                </div>

                {patientHistory.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No previous medical records found for this patient.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto' }}>
                    {patientHistory.map((record) => (
                      <div 
                        key={record.id} 
                        style={{ 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px', 
                          padding: '16px',
                          backgroundColor: 'var(--bg-primary)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: '600' }}>
                            Visit Date: {new Date(record.completed_at).toLocaleDateString()}
                          </span>
                          <span>
                            {new Date(record.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem' }}>
                          <div><strong>Chief Complaint:</strong> {record.chief_complaint}</div>
                          {record.notes && <div><strong>Notes:</strong> {record.notes}</div>}
                          {record.diagnosis && <div><strong>Diagnosis:</strong> <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{record.diagnosis}</span></div>}
                          {record.prescription && (
                            <div style={{ marginTop: '6px', padding: '8px', backgroundColor: 'var(--bg-secondary)', borderLeft: '3px solid var(--success)', borderRadius: '4px' }}>
                              <strong>Prescription:</strong>
                              <div style={{ whiteSpace: 'pre-line', fontSize: '0.85rem', marginTop: '4px' }}>{record.prescription}</div>
                            </div>
                          )}
                          {record.follow_up_notes && <div><strong>Follow-up:</strong> {record.follow_up_notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DOCTOR QUEUE LIST TABLE/CARDS --- */}
      <div className="card" style={{ padding: '24px 0' }}>
        <div style={{ padding: '0 24px 16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Today's Assigned Patient Queue</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Remaining Patients: {doctorTodayQueue.filter(e => e.status !== 'completed' && e.status !== 'cancelled' && e.status !== 'no_show').length}
          </span>
        </div>

        {doctorTodayQueue.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No patients assigned to you today.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Token</th>
                    <th style={{ width: '160px' }}>Patient Name</th>
                    <th style={{ width: '110px' }}>Visit Type</th>
                    <th>Reason</th>
                    <th style={{ width: '110px' }}>Arrival Time</th>
                    <th style={{ width: '120px' }}>Status</th>
                    <th style={{ width: '230px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorTodayQueue.map((entry) => {
                    const isWaiting = entry.status === 'waiting';
                    const isCalled = entry.status === 'called';
                    const isInConsultation = entry.status === 'in_consultation';

                    return (
                      <tr 
                        key={entry.id}
                        style={isInConsultation ? { backgroundColor: 'var(--info-light)' } : {}}
                      >
                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>
                          {formatToken(entry.token_number)}
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {formatPrivacyName(entry.patient?.full_name)}
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{entry.visit_type}</td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.reason || '-'}
                        </td>
                        <td>
                          {new Date(entry.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <StatusBadge status={entry.status} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {isWaiting && (
                              <button 
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                                onClick={() => handleCallPatient(entry)}
                              >
                                Call
                              </button>
                            )}
                            {isCalled && (
                              <button 
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                                onClick={() => handleStartConsultation(entry)}
                              >
                                Start Consultation
                              </button>
                            )}
                            {isInConsultation && (
                              <button 
                                className="btn btn-success"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                                onClick={() => {
                                  setActiveConsultationId(entry.id);
                                  setActivePatientId(entry.patient_id);
                                  setConsultationForm({
                                    chiefComplaint: entry.reason || '',
                                    notes: '', diagnosis: '', prescription: '', followUp: ''
                                  });
                                  setActiveTab('notes');
                                }}
                              >
                                Resume Notes
                              </button>
                            )}
                            {entry.status !== 'completed' && entry.status !== 'cancelled' && (
                              <button 
                                className="btn btn-outline"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px', color: 'var(--danger)', marginLeft: '4px' }}
                                onClick={() => onUpdateQueueStatus(entry.id, 'no_show')}
                              >
                                No Show
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="mobile-cards-list" style={{ padding: '16px' }}>
              {doctorTodayQueue.map((entry) => {
                const isWaiting = entry.status === 'waiting';
                const isCalled = entry.status === 'called';
                const isInConsultation = entry.status === 'in_consultation';

                return (
                  <div className="mobile-queue-card" key={entry.id} style={isInConsultation ? { borderLeft: '4px solid var(--info)' } : {}}>
                    <div className="mobile-card-header">
                      <div>
                        <span className="mobile-card-token">{formatToken(entry.token_number)}</span>
                        <span style={{ fontSize: '0.8rem', marginLeft: '8px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                          • {entry.visit_type}
                        </span>
                      </div>
                      <StatusBadge status={entry.status} />
                    </div>

                    <div className="mobile-card-body">
                      <div className="mobile-card-name">{formatPrivacyName(entry.patient?.full_name)}</div>
                      {entry.reason && <div className="mobile-card-meta">Reason: {entry.reason}</div>}
                      <div className="mobile-card-meta">
                        Arrival: {new Date(entry.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="mobile-card-actions">
                      {isWaiting && (
                        <button 
                          className="btn btn-secondary"
                          onClick={() => handleCallPatient(entry)}
                        >
                          Call Patient
                        </button>
                      )}
                      {isCalled && (
                        <button 
                          className="btn btn-primary"
                          onClick={() => handleStartConsultation(entry)}
                        >
                          Start Consultation
                        </button>
                      )}
                      {isInConsultation && (
                        <button 
                          className="btn btn-success"
                          onClick={() => {
                            setActiveConsultationId(entry.id);
                            setActivePatientId(entry.patient_id);
                            setConsultationForm({
                              chiefComplaint: entry.reason || '',
                              notes: '', diagnosis: '', prescription: '', followUp: ''
                            });
                            setActiveTab('notes');
                          }}
                        >
                          Open Consultation Notes
                        </button>
                      )}
                      {entry.status !== 'completed' && entry.status !== 'cancelled' && (
                        <button 
                          className="btn btn-outline"
                          onClick={() => onUpdateQueueStatus(entry.id, 'no_show')}
                        >
                          No Show
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default DoctorDashboard;
