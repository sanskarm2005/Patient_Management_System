import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Users, 
  Clock, 
  CheckCircle, 
  Volume2 
} from 'lucide-react';
import { 
  sortQueue, 
  formatToken, 
  formatPrivacyName 
} from '../services/queueService';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { InputField, SelectField } from '../components/FormElements';
import supabase from '../services/supabase';

export const ReceptionistDashboard = ({ 
  user, 
  queue, 
  patients, 
  appointments, 
  doctors, 
  notifications,
  isQueueView = false,
  onAddPatientToQueue, 
  onUpdateQueueStatus,
  onAddAuditLog,
  onAddNotification
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // New Patient Form state
  const [newPatientData, setNewPatientData] = useState({
    fullName: '',
    phone: '',
    gender: 'Male'
  });

  const [formErrors, setFormErrors] = useState({});

  // Average consultation duration
  const avgDuration = 10;

  // Filter queue for today's active list (First-Come-First-Served for next patient calling)
  const activeQueue = useMemo(() => {
    return sortQueue(queue.filter(e => e.status !== 'completed' && e.status !== 'cancelled' && e.status !== 'no_show'), 'asc');
  }, [queue]);

  // All today queue sorted newest at top for receptionist dashboard overview table
  const allTodayQueue = useMemo(() => {
    return sortQueue(queue, 'desc');
  }, [queue]);

  // Statistics calculations
  const stats = useMemo(() => {
    const total = queue.length;
    const waiting = queue.filter(e => e.status === 'waiting').length;
    const completed = queue.filter(e => e.status === 'completed').length;
    const active = queue.filter(e => e.status === 'in_consultation' || e.status === 'called').length;
    
    // Total estimated wait time for the clinic
    const totalEstMins = waiting * avgDuration;
    const estWaitTimeText = totalEstMins === 0 ? 'Clear' : `~${totalEstMins} min`;

    return { total, waiting, completed, active, estWaitTimeText };
  }, [queue]);

  // Handle calling a specific patient manually or finding next
  const handleCallPatient = async (queueEntry) => {
    if (!queueEntry) return;
    
    try {
      // 1. Auto-transition any previous active patient (called or in_consultation) for this SAME doctor
      const previousActive = queue.find(e => 
        e.doctor_id === queueEntry.doctor_id && 
        (e.status === 'called' || e.status === 'in_consultation') &&
        e.id !== queueEntry.id
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
          metadata: { reason: 'New patient called to same doctor room', doctor_id: queueEntry.doctor_id }
        });
      }

      // 2. Call the current patient
      const roomNum = doctors.find(d => d.id === queueEntry.doctor_id)?.room_number || 'Room 1';
      await onUpdateQueueStatus(queueEntry.id, 'called', {
        called_time: new Date().toISOString(),
        called_by: user?.id || null
      });

      // Trigger notification
      onAddNotification({
        title: 'Patient Called',
        message: `${formatPrivacyName(queueEntry.patient?.full_name)} (${formatToken(queueEntry.token_number)}) called to ${roomNum}.`,
        type: 'patient_called',
        metadata: { token: queueEntry.token_number, room: roomNum, patient_name: queueEntry.patient?.full_name }
      });

      // Add audit log
      onAddAuditLog({
        action: 'Call Patient',
        entity: 'Queue',
        entity_id: queueEntry.id,
        metadata: { token: queueEntry.token_number, doctor_id: queueEntry.doctor_id }
      });
    } catch (err) {
      console.error('Error calling patient:', err);
    }
  };

  const handleCallNext = async () => {
    // Find next waiting patient based on sorted queue
    const nextWaiting = activeQueue.find(e => e.status === 'waiting') || allTodayQueue.find(e => e.status === 'waiting');
    if (!nextWaiting) {
      alert('No patients currently waiting in the queue!');
      return;
    }
    await handleCallPatient(nextWaiting);
  };

  // Add Patient form submit handler
  const handleAddPatientSubmit = async () => {
    alert("Add Patient function is running");
    const errors = {};

    if (!newPatientData.fullName.trim()) errors.fullName = 'Full Name is required';
    if (!newPatientData.phone.trim()) errors.phone = 'Phone number is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    alert("Validation passed. Starting database insert...");
    
    try {
      const assignedDoctorId = doctors[0]?.id || '11111111-1111-1111-1111-111111111111';
      const nextIdNum = patients.length + 101;
      const patientIdStr = `P000${nextIdNum}`;
      
      const { data: patientData, error: patientErr } = await supabase.from('patients').insert({
        patient_id: patientIdStr,
        full_name: newPatientData.fullName,
        phone_number: newPatientData.phone,
        gender: newPatientData.gender || 'Male'
      }).select().single();

      alert(
        patientErr
          ? `SUPABASE ERROR: ${patientErr.message}`
          : `PATIENT INSERTED: ${patientData?.full_name || 'Success'}`
      );

      if (patientErr) {
        console.error('Error inserting patient:', patientErr);
        alert(`Failed to register patient: ${patientErr.message || 'Check database permissions'}`);
        return;
      }

      if (patientData?.id) {
        onAddAuditLog({
          action: 'Create Patient',
          entity: 'Patient',
          entity_id: patientData.id,
          metadata: { name: newPatientData.fullName, patient_id: patientIdStr }
        });

        await onAddPatientToQueue({
          patient_id: patientData.id,
          doctor_id: assignedDoctorId,
          visit_type: 'walk-in',
          reason: 'General Consultation',
          appointment_id: null
        });
      }

      setIsAddModalOpen(false);
      setNewPatientData({
        fullName: '',
        phone: '',
        gender: 'Male'
      });
    } catch (err) {
      console.error('Error adding patient to queue:', err);
    }
  };

  return (
    <>
      {/* Statistics Cards - hidden in Queue Management view */}
      {!isQueueView && (
        <div className="stat-grid">
          <StatCard label="Total Patients Today" value={stats.total} icon={Users} color="var(--primary)" />
          <StatCard label="Waiting Queue" value={stats.waiting} icon={Clock} color="var(--warning)" />
          <StatCard label="Completed Consultation" value={stats.completed} icon={CheckCircle} color="var(--success)" />
          <StatCard label="Estimated Waiting Time" value={stats.estWaitTimeText} icon={Clock} color="var(--info)" />
        </div>
      )}

      {/* Main Actions Panel */}
      <div className="controls-panel">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
          <button 
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            style={{ padding: '12px 24px', fontSize: '1rem' }}
          >
            <Plus size={20} /> Add Patient to Queue
          </button>
          
          <button 
            className="btn btn-danger"
            onClick={handleCallNext}
            disabled={stats.waiting === 0}
            style={{ padding: '12px 24px', fontSize: '1rem' }}
          >
            <Volume2 size={20} /> Call Next Patient
          </button>
        </div>
      </div>

      {/* Queue List Table/Cards */}
      <div className="card" style={{ padding: '24px 0' }}>
        <div style={{ padding: '0 24px 16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Today's Clinic Queue</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Active Patients: {activeQueue.length}
          </span>
        </div>
        
        {allTodayQueue.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No patients checked in today. Click "+ Add Patient to Queue" to begin.
          </div>
        ) : (
          <>
            {/* Standard Desktop Table (hidden on mobile via CSS) */}
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Token</th>
                    <th style={{ width: '160px' }}>Patient Name</th>
                    <th style={{ width: '110px' }}>Visit Type</th>
                    <th style={{ width: '180px' }}>Doctor</th>
                    <th>Reason</th>
                    <th style={{ width: '110px' }}>Arrival</th>
                    <th style={{ width: '120px' }}>Status</th>
                    <th style={{ width: '230px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allTodayQueue.map((entry) => {
                    const doc = doctors.find(d => d.id === entry.doctor_id);
                    const isWaiting = entry.status === 'waiting';
                    const isCalled = entry.status === 'called';
                    
                    return (
                      <tr key={entry.id}>
                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>
                          {formatToken(entry.token_number)}
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {formatPrivacyName(entry.patient?.full_name)}
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{entry.visit_type}</td>
                        <td>{doc?.full_name || 'Unassigned'}</td>
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
                                Call Patient
                              </button>
                            )}
                            {isCalled && (
                              <>
                                <button 
                                  className="btn btn-success"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px', marginRight: '4px' }}
                                  onClick={() => onUpdateQueueStatus(entry.id, 'completed', {
                                    consultation_end_time: new Date().toISOString()
                                  })}
                                >
                                  Complete
                                </button>
                                <button 
                                  className="btn btn-danger"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                                  onClick={() => onUpdateQueueStatus(entry.id, 'no_show')}
                                >
                                  No Show
                                </button>
                              </>
                            )}
                            {entry.status !== 'completed' && entry.status !== 'cancelled' && (
                              <button 
                                className="btn btn-outline"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px', color: 'var(--danger)', marginLeft: '4px' }}
                                onClick={() => {
                                  if (confirm('Cancel queue entry for today?')) {
                                    onUpdateQueueStatus(entry.id, 'cancelled');
                                  }
                                }}
                              >
                                Cancel
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

            {/* Mobile Cards (hidden on desktop via CSS) */}
            <div className="mobile-cards-list" style={{ padding: '16px' }}>
              {allTodayQueue.map((entry) => {
                const doc = doctors.find(d => d.id === entry.doctor_id);
                const isWaiting = entry.status === 'waiting';
                const isCalled = entry.status === 'called';

                return (
                  <div className="mobile-queue-card" key={entry.id}>
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
                      <div className="mobile-card-meta">Assigned: {doc?.full_name || 'Unassigned'}</div>
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
                        <>
                          <button 
                            className="btn btn-success"
                            onClick={() => onUpdateQueueStatus(entry.id, 'completed', {
                              consultation_end_time: new Date().toISOString()
                            })}
                          >
                            Complete
                          </button>
                          <button 
                            className="btn btn-danger"
                            onClick={() => onUpdateQueueStatus(entry.id, 'no_show')}
                          >
                            No Show
                          </button>
                        </>
                      )}
                      {entry.status !== 'completed' && entry.status !== 'cancelled' && (
                        <button 
                          className="btn btn-outline"
                          style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                          onClick={() => {
                            if (confirm('Cancel queue entry?')) {
                              onUpdateQueueStatus(entry.id, 'cancelled');
                            }
                          }}
                        >
                          Cancel
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

        {/* --- ADD PATIENT MODAL --- */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Patient to Queue"
          footer={
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddPatientSubmit}>Add to Queue</button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <InputField
              label="Full Name *"
              name="fullName"
              value={newPatientData.fullName}
              onChange={(e) => setNewPatientData(prev => ({ ...prev, fullName: e.target.value }))}
              placeholder="Rahul Sen"
              error={formErrors.fullName}
            />
            
            <InputField
              label="Phone Number *"
              name="phone"
              value={newPatientData.phone}
              onChange={(e) => setNewPatientData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="9876543210"
              error={formErrors.phone}
            />

            <SelectField
              label="Gender"
              name="gender"
              value={newPatientData.gender}
              onChange={(e) => setNewPatientData(prev => ({ ...prev, gender: e.target.value }))}
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' }
              ]}
            />
          </div>
        </Modal>
    </>
  );
};

export default ReceptionistDashboard;
