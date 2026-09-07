import React, { useState } from 'react';
import { Settings, Save, AlertCircle, Shield, Stethoscope, BedDouble } from 'lucide-react';
import supabase from '../services/supabase';
import { InputField, SelectField } from '../components/FormElements';

export const SettingsPage = ({ doctors, onAddAuditLog }) => {
  const [clinicName, setClinicName] = useState('MedClinic Queue System');
  const [avgDuration, setAvgDuration] = useState('10');
  const [successMsg, setSuccessMsg] = useState('');

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
    } catch (e) {}
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
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Stethoscope size={22} style={{ color: 'var(--primary)' }} />
          <div>
            <h3 style={{ margin: 0 }}>Registered Physicians Directory</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Active clinic doctors and consultation room assignments.
            </p>
          </div>
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
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{doc.full_name}</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {doc.specialty}
                </span>
                <div style={{ 
                  marginTop: '4px', 
                  fontSize: '0.75rem', 
                  fontWeight: '600', 
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <BedDouble size={12} />
                  {doc.room_number || 'Room unassigned'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
