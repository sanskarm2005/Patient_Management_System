import React, { useState, useMemo } from 'react';
import { Search, User, Phone, Plus, History, ClipboardList } from 'lucide-react';
import { formatPrivacyName } from '../services/queueService';
import Modal from '../components/Modal';
import { InputField, SelectField, TextareaField } from '../components/FormElements';
import supabase from '../services/supabase';

export const PatientsPage = ({ user, patients, onAddAuditLog }) => {
  const role = user?.user_metadata?.role || 'receptionist';
  const isDoctor = role === 'doctor';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  // Registration form
  const [regForm, setRegForm] = useState({
    fullName: '', phone: '', dob: '', gender: '', address: '',
    emergencyName: '', emergencyPhone: '', allergies: '', history: '', notes: ''
  });
  const [errors, setErrors] = useState({});

  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter(p => 
      p.full_name.toLowerCase().includes(q) ||
      p.phone_number.includes(q) ||
      p.patient_id.toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

  // Retrieve patient history (consultations)
  const patientHistory = useMemo(() => {
    if (!selectedPatient) return [];
    try {
      const data = localStorage.getItem('medclinic_db_v1');
      if (data) {
        const db = JSON.parse(data);
        return db.consultations.filter(c => c.patient_id === selectedPatient.id)
          .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
      }
    } catch (e) {}
    return [];
  }, [selectedPatient]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!regForm.fullName) errs.fullName = 'Name is required';
    if (!regForm.phone) errs.phone = 'Phone number is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      const nextIdNum = patients.length + 101;
      const patientIdStr = `P000${nextIdNum}`;
      
      const insert = await supabase.from('patients').insert({
        patient_id: patientIdStr,
        full_name: regForm.fullName,
        phone_number: regForm.phone,
        date_of_birth: regForm.dob || null,
        gender: regForm.gender || null,
        address: regForm.address || '',
        emergency_contact_name: regForm.emergencyName || '',
        emergency_contact_phone: regForm.emergencyPhone || '',
        allergies: regForm.allergies || '',
        medical_history: regForm.history || '',
        notes: regForm.notes || ''
      });

      if (insert.data) {
        onAddAuditLog({
          action: 'Register Patient',
          entity: 'Patient',
          entity_id: insert.data.id,
          metadata: { name: regForm.fullName, patient_id: patientIdStr }
        });

        setIsRegisterModalOpen(false);
        setRegForm({
          fullName: '', phone: '', dob: '', gender: '', address: '',
          emergencyName: '', emergencyPhone: '', allergies: '', history: '', notes: ''
        });
        setErrors({});
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      {/* Top search controls bar */}
      <div className="controls-panel card">
        <div className="search-wrapper" style={{ maxWidth: '400px' }}>
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Search patients by name, phone or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field search-input"
          />
        </div>
        
        {role !== 'doctor' && (
          <button 
            className="btn btn-primary"
            onClick={() => setIsRegisterModalOpen(true)}
          >
            <Plus size={16} /> Register New Patient
          </button>
        )}
      </div>

      {/* Patient List Card Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {filteredPatients.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No registered patients found.
          </div>
        ) : (
          filteredPatients.map(patient => (
            <div 
              key={patient.id} 
              className="card animate-fade-in" 
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <div>
                  <h4 style={{ margin: 0 }}>
                    {isDoctor ? patient.full_name : formatPrivacyName(patient.full_name)}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {patient.patient_id}</span>
                </div>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--bg-tertiary)', 
                  display: 'flex',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  <User size={16} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div><strong>Phone:</strong> {patient.phone_number}</div>
                <div><strong>Gender:</strong> {patient.gender || '-'}</div>
                <div><strong>Age:</strong> {patient.date_of_birth ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} yrs` : '-'}</div>
              </div>

              <button 
                className="btn btn-outline" 
                style={{ width: '100%', padding: '8px', fontSize: '0.8rem', marginTop: '4px' }}
                onClick={() => setSelectedPatient(patient)}
              >
                {isDoctor ? 'View Medical File' : 'View Profile'}
              </button>
            </div>
          ))
        )}
      </div>

      {/* --- PATIENT FILE / PROFILE MODAL --- */}
      <Modal
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient ? `Patient File - ${selectedPatient.patient_id}` : ''}
        footer={<button className="btn btn-secondary" onClick={() => setSelectedPatient(null)}>Close</button>}
      >
        {selectedPatient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h3 style={{ margin: 0 }}>{selectedPatient.full_name}</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Registered Since: {new Date(selectedPatient.created_at).toLocaleDateString()}</span>
            </div>

            {/* Profile Fields Group */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '12px', 
              backgroundColor: 'var(--bg-tertiary)', 
              padding: '16px', 
              borderRadius: '8px',
              fontSize: '0.9rem' 
            }}>
              <div><strong>Phone Number:</strong> {selectedPatient.phone_number}</div>
              <div><strong>Date of Birth:</strong> {selectedPatient.date_of_birth || '-'}</div>
              <div><strong>Gender:</strong> {selectedPatient.gender || '-'}</div>
              <div><strong>Address:</strong> {selectedPatient.address || '-'}</div>
              <div><strong>Emergency Contact:</strong> {selectedPatient.emergency_contact_name || '-'}</div>
              <div><strong>Emergency Phone:</strong> {selectedPatient.emergency_contact_phone || '-'}</div>
            </div>

            {/* Allergies Highlight */}
            {selectedPatient.allergies && (
              <div style={{ padding: '12px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.85rem' }}>
                <strong>Allergy Information:</strong>
                <div>{selectedPatient.allergies}</div>
              </div>
            )}

            {/* Receptionist View Note info */}
            {!isDoctor && selectedPatient.notes && (
              <div>
                <strong>Administrative Notes:</strong>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{selectedPatient.notes}</p>
              </div>
            )}

            {/* Doctor View Medical History / Consultation record */}
            {isDoctor ? (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <History size={16} /> Clinical History ({patientHistory.length})
                </h4>
                
                {patientHistory.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}>
                    No consultation visits recorded.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '240px', overflowY: 'auto' }}>
                    {patientHistory.map(rec => (
                      <div key={rec.id} style={{ border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '600' }}>Visit: {new Date(rec.completed_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div><strong>Complaint:</strong> {rec.chief_complaint}</div>
                          {rec.diagnosis && <div><strong>Diagnosis:</strong> {rec.diagnosis}</div>}
                          {rec.prescription && <div><strong>Prescription:</strong> {rec.prescription}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Privacy disclaimer for receptionist
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                * Detailed consultation notes and prescriptions are restricted to medical doctors and clinical practitioners.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* --- REGISTER PATIENT MODAL --- */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register New Clinic Patient"
        footer={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setIsRegisterModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleRegisterSubmit}>Register Patient</button>
          </div>
        }
      >
        <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-grid-2">
            <InputField
              label="Full Name *"
              name="fullName"
              value={regForm.fullName}
              onChange={(e) => setRegForm(prev => ({ ...prev, fullName: e.target.value }))}
              placeholder="Rahul Sen"
              error={errors.fullName}
            />
            <InputField
              label="Phone Number *"
              name="phone"
              value={regForm.phone}
              onChange={(e) => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="9876543210"
              error={errors.phone}
            />
          </div>

          <div className="form-grid-2">
            <InputField
              label="Date of Birth"
              name="dob"
              type="date"
              value={regForm.dob}
              onChange={(e) => setRegForm(prev => ({ ...prev, dob: e.target.value }))}
            />
            <SelectField
              label="Gender"
              name="gender"
              value={regForm.gender}
              onChange={(e) => setRegForm(prev => ({ ...prev, gender: e.target.value }))}
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
                { value: 'Other', label: 'Other' }
              ]}
              placeholder="Select gender"
            />
          </div>

          <InputField
            label="Address"
            name="address"
            value={regForm.address}
            onChange={(e) => setRegForm(prev => ({ ...prev, address: e.target.value }))}
            placeholder="123 Park Street, Mumbai"
          />

          <div className="form-grid-2">
            <InputField
              label="Emergency Contact Name"
              name="emergencyName"
              value={regForm.emergencyName}
              onChange={(e) => setRegForm(prev => ({ ...prev, emergencyName: e.target.value }))}
              placeholder="Emergency Contact"
            />
            <InputField
              label="Emergency Phone"
              name="emergencyPhone"
              value={regForm.emergencyPhone}
              onChange={(e) => setRegForm(prev => ({ ...prev, emergencyPhone: e.target.value }))}
              placeholder="Phone number"
            />
          </div>

          <InputField
            label="Allergies Information"
            name="allergies"
            value={regForm.allergies}
            onChange={(e) => setRegForm(prev => ({ ...prev, allergies: e.target.value }))}
            placeholder="Allergies (if any)"
          />

          <TextareaField
            label="Medical History / Notes"
            name="history"
            value={regForm.history}
            onChange={(e) => setRegForm(prev => ({ ...prev, history: e.target.value }))}
            placeholder="Important history logs..."
          />
        </form>
      </Modal>
    </>
  );
};

export default PatientsPage;
