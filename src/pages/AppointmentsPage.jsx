import React, { useState, useMemo } from 'react';
import { Calendar, Plus, Clock, Search, CheckCircle, RefreshCcw, User } from 'lucide-react';
import { formatToken, formatPrivacyName } from '../services/queueService';
import Modal from '../components/Modal';
import { InputField, SelectField } from '../components/FormElements';
import supabase from '../services/supabase';

export const AppointmentsPage = ({ 
  appointments, 
  patients, 
  doctors, 
  queue,
  onAddAppointment, 
  onAddPatientToQueue,
  onAddAuditLog,
  onAddNotification
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchPatientQuery, setSearchPatientQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  
  const [booking, setBooking] = useState({
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    reason: ''
  });

  const [errors, setErrors] = useState({});

  // Search filter for patient selection
  const filteredPatients = useMemo(() => {
    if (!searchPatientQuery) return [];
    const q = searchPatientQuery.toLowerCase();
    return patients.filter(p => 
      p.full_name.toLowerCase().includes(q) || 
      p.phone_number.includes(q) || 
      p.patient_id.toLowerCase().includes(q)
    );
  }, [patients, searchPatientQuery]);

  // Sort appointments: scheduled today first, then future, ascending by date & time
  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const dateCompare = a.appointment_date.localeCompare(b.appointment_date);
      if (dateCompare !== 0) return dateCompare;
      return a.appointment_time.localeCompare(b.appointment_time);
    });
  }, [appointments]);

  // Handle checking in an appointment patient on arrival
  const handleCheckIn = async (app) => {
    try {
      // 1. Update appointment status to checked_in
      const updateRes = await supabase.from('appointments')
        .update({ status: 'checked_in' })
        .eq('id', app.id);

      if (updateRes.error) throw new Error(updateRes.error);

      // 2. Add patient to active queue
      await onAddPatientToQueue({
        patient_id: app.patient_id,
        doctor_id: app.doctor_id,
        visit_type: 'appointment',
        reason: app.reason || 'Scheduled Visit',
        appointment_id: app.id
      });

      // 3. Log audit log
      const patName = patients.find(p => p.id === app.patient_id)?.full_name || 'Patient';
      onAddAuditLog({
        action: 'Check In Appointment',
        entity: 'Appointment',
        entity_id: app.id,
        metadata: { patient_id: app.patient_id, name: patName }
      });

      // 4. Notification
      onAddNotification({
        title: 'Appointment Check-in',
        message: `${formatPrivacyName(patName)} checked in for appointment.`,
        type: 'queue_update'
      });

    } catch (err) {
      console.error(err);
      alert('Error checking in appointment: ' + err.message);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!selectedPatientId) errs.patient = 'Please select a patient';
    if (!booking.doctorId) errs.doctorId = 'Please select a doctor';
    if (!booking.date) errs.date = 'Please select a date';
    if (!booking.time) errs.time = 'Please select a time slot';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      const app = await onAddAppointment({
        patient_id: selectedPatientId,
        doctor_id: booking.doctorId,
        appointment_date: booking.date,
        appointment_time: booking.time,
        reason: booking.reason || '',
        status: 'scheduled'
      });

      if (app) {
        const patName = patients.find(p => p.id === selectedPatientId)?.full_name;
        onAddNotification({
          title: 'Appointment Scheduled',
          message: `Appointment scheduled for ${formatPrivacyName(patName)} on ${booking.date} at ${booking.time}.`,
          type: 'new_appointment'
        });

        onAddAuditLog({
          action: 'Book Appointment',
          entity: 'Appointment',
          entity_id: app.id,
          metadata: { doctor_id: booking.doctorId }
        });

        setIsModalOpen(false);
        setSelectedPatientId('');
        setSearchPatientQuery('');
        setBooking({
          doctorId: '',
          date: new Date().toISOString().split('T')[0],
          time: '',
          reason: ''
        });
        setErrors({});
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      {/* Search and book actions header */}
      <div className="controls-panel card">
        <h3>Appointments Book</h3>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Schedule Appointment
        </button>
      </div>

      {/* Appointment list card */}
      <div className="card" style={{ padding: '24px 0' }}>
        <div style={{ padding: '0 24px 16px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h3>Scheduled Visits</h3>
        </div>

        {sortedAppointments.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No scheduled appointments. Click "Schedule Appointment" to book.
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Patient Name</th>
                  <th>Doctor</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedAppointments.map((app) => {
                  const pat = patients.find(p => p.id === app.patient_id);
                  const doc = doctors.find(d => d.id === app.doctor_id);
                  const isToday = app.appointment_date === new Date().toISOString().split('T')[0];
                  
                  return (
                    <tr key={app.id}>
                      <td style={{ fontWeight: '600' }}>{app.appointment_date}</td>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                        {app.appointment_time.substring(0, 5)}
                      </td>
                      <td style={{ fontWeight: '600' }}>{pat ? formatPrivacyName(pat.full_name) : 'Unknown'}</td>
                      <td>{doc?.full_name || 'Unassigned'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{app.reason || '-'}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        <span className="badge" style={{
                          backgroundColor: app.status === 'checked_in' ? 'var(--success-light)' : app.status === 'completed' ? 'var(--info-light)' : 'var(--bg-tertiary)',
                          color: app.status === 'checked_in' ? 'var(--success)' : app.status === 'completed' ? 'var(--info)' : 'var(--text-secondary)'
                        }}>
                          {app.status}
                        </span>
                      </td>
                      <td>
                        {app.status === 'scheduled' && isToday && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => handleCheckIn(app)}
                          >
                            Check In
                          </button>
                        )}
                        {app.status === 'scheduled' && !isToday && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Future Slot
                          </span>
                        )}
                        {app.status === 'checked_in' && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: '600' }}>
                            In Queue
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- SCHEDULE APPOINTMENT MODAL --- */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Appointment"
        footer={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleBookingSubmit}>Book Slot</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Patient Search Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="search-wrapper" style={{ maxWidth: '100%' }}>
              <Search className="search-icon" size={18} />
              <input 
                type="text"
                placeholder="Search patient by name or phone..."
                value={searchPatientQuery}
                onChange={(e) => setSearchPatientQuery(e.target.value)}
                className="input-field search-input"
              />
            </div>

            {/* Results Dropdown */}
            {searchPatientQuery && (
              <div className="card" style={{ padding: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                {filteredPatients.length === 0 ? (
                  <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    No matching patients found.
                  </div>
                ) : (
                  filteredPatients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatientId(p.id);
                        setSearchPatientQuery('');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: selectedPatientId === p.id ? 'var(--primary-light)' : 'transparent',
                        color: selectedPatientId === p.id ? 'var(--primary)' : 'var(--text-primary)',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{p.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Phone: {p.phone_number} • ID: {p.patient_id}</div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Selected Patient Card */}
            {selectedPatientId && (
              <div className="card" style={{ 
                backgroundColor: 'var(--bg-tertiary)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SELECTED PATIENT</span>
                  <h4 style={{ margin: '2px 0' }}>
                    {patients.find(p => p.id === selectedPatientId)?.full_name}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ID: {patients.find(p => p.id === selectedPatientId)?.patient_id}
                  </span>
                </div>
                <button className="btn-icon" onClick={() => setSelectedPatientId('')} style={{ height: '32px', width: '32px' }}>
                  <X size={16} />
                </button>
              </div>
            )}
            {errors.patient && <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{errors.patient}</span>}
          </div>

          <div style={{ margin: '8px 0', borderBottom: '1px solid var(--border-color)' }} />

          {/* Appointment Slot Selectors */}
          <SelectField
            label="Assign Doctor"
            name="doctorId"
            value={booking.doctorId}
            onChange={(e) => setBooking(prev => ({ ...prev, doctorId: e.target.value }))}
            options={doctors.map(d => ({ value: d.id, label: `${d.full_name} (${d.specialty})` }))}
            placeholder="Select doctor"
            error={errors.doctorId}
          />

          <div className="form-grid-2">
            <InputField
              label="Select Date"
              name="date"
              type="date"
              value={booking.date}
              onChange={(e) => setBooking(prev => ({ ...prev, date: e.target.value }))}
              error={errors.date}
            />

            <SelectField
              label="Time Slot"
              name="time"
              value={booking.time}
              onChange={(e) => setBooking(prev => ({ ...prev, time: e.target.value }))}
              options={[
                { value: '09:00', label: '09:00 AM' },
                { value: '09:30', label: '09:30 AM' },
                { value: '10:00', label: '10:00 AM' },
                { value: '10:30', label: '10:30 AM' },
                { value: '11:00', label: '11:00 AM' },
                { value: '11:30', label: '11:30 AM' },
                { value: '12:00', label: '12:00 PM' },
                { value: '12:30', label: '12:30 PM' },
                { value: '14:00', label: '02:00 PM' },
                { value: '14:30', label: '02:30 PM' },
                { value: '15:00', label: '03:00 PM' },
                { value: '15:30', label: '03:30 PM' },
                { value: '16:00', label: '04:00 PM' },
                { value: '16:30', label: '04:30 PM' }
              ]}
              placeholder="Select slot"
              error={errors.time}
            />
          </div>

          <InputField
            label="Reason for Visit"
            name="reason"
            value={booking.reason}
            onChange={(e) => setBooking(prev => ({ ...prev, reason: e.target.value }))}
            placeholder="e.g. Health check, cardiology consult"
          />
        </div>
      </Modal>
    </>
  );
};

export default AppointmentsPage;
