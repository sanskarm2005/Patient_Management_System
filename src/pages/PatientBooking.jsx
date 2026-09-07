import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Activity, 
  CheckCircle2, 
  Phone, 
  Info,
  ChevronRight
} from 'lucide-react';
import supabase from '../services/supabase';
import { InputField, SelectField } from '../components/FormElements';

// Supported slot times (9:00 AM - 4:30 PM)
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30'
];

export const PatientBooking = ({ 
  patients, 
  appointments, 
  doctors, 
  onAddAppointment, 
  onAddAuditLog,
  onAddNotification
}) => {
  const [step, setStep] = useState(1); // 1: Setup visit, 2: Patient info, 3: Success

  // Form State
  const [booking, setBooking] = useState({
    doctorId: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    fullName: '',
    phone: '',
    reason: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [successBooking, setSuccessBooking] = useState(null);

  // Generate date options (next 7 days, excluding Sunday)
  const dateOptions = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      if (d.getDay() !== 0) { // Exclude Sunday
        dates.push({
          value: d.toISOString().split('T')[0],
          label: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
        });
      }
    }
    return dates;
  }, []);

  // Filter booked slots for the selected doctor and date
  const bookedSlots = useMemo(() => {
    if (!booking.doctorId || !booking.date) return [];
    return appointments
      .filter(a => a.doctor_id === booking.doctorId && a.appointment_date === booking.date && a.status !== 'cancelled')
      .map(a => {
        // Normalise time to 'HH:MM'
        return (a.appointment_time || '').substring(0, 5);
      });
  }, [booking.doctorId, booking.date, appointments]);

  const handleNextStep = (e) => {
    e.preventDefault();
    const errors = {};
    if (!booking.doctorId) errors.doctorId = 'Please select a doctor';
    if (!booking.date) errors.date = 'Please select an appointment date';
    if (!booking.time) errors.time = 'Please select an appointment time slot';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setStep(2);
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!booking.fullName) errors.fullName = 'Full Name is required';
    if (!booking.phone) errors.phone = 'Phone number is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      // 1. Check if patient already exists by phone
      let patientId = null;
      let existingPatient = patients.find(p => p.phone_number.replace(/\D/g, '') === booking.phone.replace(/\D/g, ''));
      
      if (existingPatient) {
        patientId = existingPatient.id;
      } else {
        // Create new patient record
        const nextIdNum = patients.length + 101;
        const patientIdStr = `P000${nextIdNum}`;
        const patientInsert = await supabase.from('patients').insert({
          patient_id: patientIdStr,
          full_name: booking.fullName,
          phone_number: booking.phone,
          notes: 'Self-booked online'
        });
        patientId = patientInsert.data.id;

        onAddAuditLog({
          action: 'Create Patient',
          entity: 'Patient',
          entity_id: patientId,
          metadata: { name: booking.fullName, source: 'Self-booking' }
        });
      }

      // 2. Insert appointment record
      const appData = {
        patient_id: patientId,
        doctor_id: booking.doctorId,
        appointment_date: booking.date,
        appointment_time: booking.time,
        reason: booking.reason || '',
        status: 'scheduled'
      };

      const newApp = await onAddAppointment(appData);

      if (newApp) {
        const assignedDoc = doctors.find(d => d.id === booking.doctorId);
        
        onAddNotification({
          title: 'New Booking Request',
          message: `Appointment booked with ${assignedDoc?.full_name} for ${booking.fullName} at ${booking.time} on ${booking.date}.`,
          type: 'new_appointment',
          metadata: { appointment_id: newApp.id, patient_id: patientId }
        });

        onAddAuditLog({
          action: 'Book Appointment',
          entity: 'Appointment',
          entity_id: newApp.id,
          metadata: { doctor_id: booking.doctorId, date: booking.date, time: booking.time }
        });

        setSuccessBooking({
          ...newApp,
          patientName: booking.fullName,
          doctorName: assignedDoc?.full_name,
          room: assignedDoc?.room_number || 'Room 1'
        });

        setStep(3);
      }
    } catch (err) {
      console.error('Error completing self-booking:', err);
      alert('Failed to book appointment. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      backgroundColor: 'var(--bg-primary)'
    }}>
      <div className="card animate-fade-in" style={{
        width: '100%',
        maxWidth: '520px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Clinic Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'center' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Activity size={20} />
          </div>
          <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>
            MedClinic Booking Portal
          </span>
        </div>

        {/* STEP 1: SELECT DOCTOR, DATE, SLOT */}
        {step === 1 && (
          <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Schedule an Appointment</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Select your physician and preferred visit slot.
              </p>
            </div>

            <SelectField
              label="Select Doctor"
              name="doctorId"
              value={booking.doctorId}
              onChange={(e) => setBooking(prev => ({ ...prev, doctorId: e.target.value, time: '' }))}
              options={doctors.map(d => ({ value: d.id, label: `${d.full_name} (${d.specialty})` }))}
              placeholder="Choose doctor"
              error={formErrors.doctorId}
            />

            <SelectField
              label="Select Appointment Date"
              name="date"
              value={booking.date}
              onChange={(e) => setBooking(prev => ({ ...prev, date: e.target.value, time: '' }))}
              options={dateOptions}
              error={formErrors.date}
            />

            {/* Time Slots Grid Selection */}
            {booking.doctorId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
                  Available Time Slots:
                </label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', 
                  gap: '8px' 
                }}>
                  {TIME_SLOTS.map(t => {
                    const isBooked = bookedSlots.includes(t);
                    const isSelected = booking.time === t;
                    
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={isBooked}
                        onClick={() => setBooking(prev => ({ ...prev, time: t }))}
                        style={{
                          padding: '10px 4px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          textAlign: 'center',
                          borderRadius: '8px',
                          border: isSelected 
                            ? '1.5px solid var(--primary)' 
                            : '1px solid var(--border-color)',
                          backgroundColor: isSelected 
                            ? 'var(--primary-light)' 
                            : isBooked 
                              ? 'var(--bg-tertiary)' 
                              : 'var(--bg-secondary)',
                          color: isSelected 
                            ? 'var(--primary)' 
                            : isBooked 
                              ? 'var(--text-muted)' 
                              : 'var(--text-primary)',
                          cursor: isBooked ? 'not-allowed' : 'pointer',
                          transition: 'var(--transition)'
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                {formErrors.time && <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{formErrors.time}</span>}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px' }}
            >
              Continue to Details <ChevronRight size={16} />
            </button>
          </form>
        )}

        {/* STEP 2: ENTER PATIENT DETAILS */}
        {step === 2 && (
          <form onSubmit={handleBookAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Confirm Your Information</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                We will match this with existing records or create a new profile.
              </p>
            </div>

            {/* Selected Booking Info Summary */}
            <div style={{ 
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: '8px', 
              padding: '12px',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div><strong>Doctor:</strong> {doctors.find(d => d.id === booking.doctorId)?.full_name}</div>
              <div><strong>Date & Time:</strong> {new Date(booking.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {booking.time}</div>
            </div>

            <InputField
              label="Full Name *"
              name="fullName"
              value={booking.fullName}
              onChange={(e) => setBooking(prev => ({ ...prev, fullName: e.target.value }))}
              placeholder="Enter your full name"
              error={formErrors.fullName}
            />

            <InputField
              label="Contact Phone Number *"
              name="phone"
              type="tel"
              value={booking.phone}
              onChange={(e) => setBooking(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="e.g. 9876543210"
              error={formErrors.phone}
            />

            <InputField
              label="Reason for Visit (Optional)"
              name="reason"
              value={booking.reason}
              onChange={(e) => setBooking(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Cough and cold, consult"
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setStep(1)} 
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 2 }}
              >
                Confirm Appointment
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: BOOKING CONFIRMATION SUCCESS */}
        {step === 3 && successBooking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', alignItems: 'center' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--success-light)', 
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.4rem' }}>Appointment Confirmed!</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Your schedule request has been successfully registered.
              </p>
            </div>

            <div style={{ 
              width: '100%',
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: '12px', 
              padding: '20px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: '0.9rem'
            }}>
              <div><strong>Patient Name:</strong> {successBooking.patientName}</div>
              <div><strong>Physician:</strong> {successBooking.doctorName}</div>
              <div><strong>Scheduled Slot:</strong> {new Date(successBooking.appointment_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {successBooking.appointment_time.substring(0,5)}</div>
              <div><strong>Consulting Room:</strong> {successBooking.room}</div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'start', 
              textAlign: 'left', 
              padding: '12px', 
              backgroundColor: 'var(--info-light)', 
              color: 'var(--info)',
              borderRadius: '8px',
              fontSize: '0.8rem'
            }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Important:</strong> On your arrival day, please present yourself to the Reception counter. The staff will immediately check you into the active queue.
              </span>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={() => {
                setBooking({
                  doctorId: '',
                  date: new Date().toISOString().split('T')[0],
                  time: '',
                  fullName: '',
                  phone: '',
                  reason: ''
                });
                setStep(1);
              }}
              style={{ width: '100%', marginTop: '8px' }}
            >
              Book Another Appointment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientBooking;
