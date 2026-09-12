import React, { useState } from 'react';
import { Settings, Save, AlertCircle, Shield, Stethoscope, BedDouble, Pencil, Plus, X } from 'lucide-react';
import supabase from '../services/supabase';
import { InputField, SelectField } from '../components/FormElements';

export const SettingsPage = ({ doctors, onAddAuditLog, onDoctorsChange }) => {
  const [clinicName, setClinicName] = useState('MedClinic Queue System');
  const [avgDuration, setAvgDuration] = useState('10');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState({ full_name: '', specialty: '', room_number: '' });

  // Read current settings on mount from localStorage
  React.useEffect(() => {
    try {
      const data = localStorage.getItem('medclinic_db_v1');
      if (data) {
        const db = JSON.parse(data);
        if (db.clinic_settings) {
          setClinicName(db.clinic_settings.clinic_name || 'MedClinic Queue System');
          setAvgDuration(String(db.clinic_settings.avg_consultation_duration || '10'));
        }
      }
    } catch (e) { }
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      // Save settings to database
      await supabase.from('clinic_settings').update({
        clinic_name: clinicName,
        avg_consultation_duration: Number(avgDuration)
      });

      onAddAuditLog({
        action: 'Update Settings',
        entity: 'Settings',
        entity_id: 'settings',
        metadata: { clinic_name: clinicName, avg_duration: avgDuration }
      });

      setSuccessMsg('Settings updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Error saving settings: ' + err.message);
    }
  };

  const handleSaveDoctor = async () => {
    if (!editingDoctor) return;

    if (!doctorForm.full_name.trim()) {
      alert('Doctor name is required.');
      return;
    }

    try {
      let error = null;

      if (editingDoctor.id) {
        // Edit existing doctor
        const result = await supabase
          .from('profiles')
          .update({
            full_name: doctorForm.full_name.trim(),
            specialty: doctorForm.specialty.trim(),
            room_number: doctorForm.room_number.trim()
          })
          .eq('id', editingDoctor.id);

        error = result.error;
      } else {
        // Add new doctor
        const result = await supabase
          .from('profiles')
          .insert({
            full_name: doctorForm.full_name.trim(),
            role: 'doctor',
            specialty: doctorForm.specialty.trim(),
            room_number: doctorForm.room_number.trim(),
            status: 'active'
          });

        error = result.error;
      }

      if (error) throw error;

      setSuccessMsg(
        editingDoctor.id
          ? 'Doctor details updated successfully!'
          : 'Doctor added successfully!'
      );

      setEditingDoctor(null);

      if (onDoctorsChange) {
        await onDoctorsChange();
      }

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error saving doctor:', err);
      alert('Error saving doctor: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Clinic settings form */}
      <form onSubmit={handleSaveSettings} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={22} style={{ color: 'var(--primary)' }} />
          <h3>Clinic Parameters Configuration</h3>
        </div>

        {successMsg && (
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            {successMsg}
          </div>
        )}

        <div className="form-grid-2">
          <InputField
            label="Clinic Name"
            name="clinicName"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="e.g. MedClinic Specialists"
            required
          />

          <SelectField
            label="Average Consultation Length (Minutes)"
            name="avgDuration"
            value={avgDuration}
            onChange={(e) => setAvgDuration(e.target.value)}
            options={[
              { value: '5', label: '5 minutes' },
              { value: '10', label: '10 minutes' },
              { value: '15', label: '15 minutes' },
              { value: '20', label: '20 minutes' },
              { value: '30', label: '30 minutes' }
            ]}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button type="submit" className="btn btn-primary">
            <Save size={16} /> Save Clinic Parameters
          </button>
        </div>
      </form>

      {/* Staff and Doctors directory */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Stethoscope size={22} style={{ color: 'var(--primary)' }} />

            <div>
              <h3 style={{ margin: 0 }}>Registered Physicians Directory</h3>
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginTop: '2px'
                }}
              >
                Active clinic doctors and consultation room assignments.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingDoctor({ id: null });
              setDoctorForm({
                full_name: '',
                specialty: '',
                room_number: ''
              });
            }}
          >
            <Plus size={16} />
            Add Doctor
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {doctors.map((doc) => (
            <div key={doc.id} style={{
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'var(--bg-primary)'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Stethoscope size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>
                  {doc.full_name}
                </h4>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {doc.specialty}
                </span>

                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <BedDouble size={12} />
                  {doc.room_number || 'Room unassigned'}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                title="Edit doctor"
                onClick={() => {
                  setEditingDoctor(doc);
                  setDoctorForm({
                    full_name: doc.full_name || '',
                    specialty: doc.specialty || '',
                    room_number: doc.room_number || ''
                  });
                }}
                style={{
                  padding: '8px',
                  minWidth: 'auto'
                }}
              >
                <Pencil size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Doctor Add/Edit Modal */}
      {editingDoctor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000
          }}
          onClick={() => setEditingDoctor(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              padding: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px'
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>
                  {editingDoctor.id ? 'Edit Doctor' : 'Add Doctor'}
                </h3>

                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  {editingDoctor.id
                    ? 'Update doctor information and room assignment.'
                    : 'Add a new doctor to the clinic directory.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingDoctor(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--text-secondary)'
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Fields */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <InputField
                label="Doctor Name"
                name="doctorName"
                value={doctorForm.full_name}
                onChange={(e) =>
                  setDoctorForm({
                    ...doctorForm,
                    full_name: e.target.value
                  })
                }
                placeholder="e.g. Dr. John Smith"
                required
              />

              <InputField
                label="Specialty"
                name="specialty"
                value={doctorForm.specialty}
                onChange={(e) =>
                  setDoctorForm({
                    ...doctorForm,
                    specialty: e.target.value
                  })
                }
                placeholder="e.g. General Physician"
              />

              <InputField
                label="Room Number"
                name="roomNumber"
                value={doctorForm.room_number}
                onChange={(e) =>
                  setDoctorForm({
                    ...doctorForm,
                    room_number: e.target.value
                  })
                }
                placeholder="e.g. Room 1"
              />
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingDoctor(null)}
                style={{ flex: '1 1 120px' }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveDoctor}
                style={{ flex: '1 1 120px' }}
              >
                <Save size={16} />
                {editingDoctor.id ? 'Save Changes' : 'Add Doctor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
