import React from 'react';
import ReceptionistDashboard from './ReceptionistDashboard';
import DoctorDashboard from './DoctorDashboard';

export const Dashboard = ({ 
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
  const role = user?.user_metadata?.role || 'receptionist';

  if (role === 'doctor') {
    return (
      <DoctorDashboard 
        user={user}
        queue={queue}
        patients={patients}
        appointments={appointments}
        doctors={doctors}
        notifications={notifications}
        isQueueView={isQueueView}
        onUpdateQueueStatus={onUpdateQueueStatus}
        onAddAuditLog={onAddAuditLog}
        onAddNotification={onAddNotification}
      />
    );
  }

  return (
    <ReceptionistDashboard 
      user={user}
      queue={queue}
      patients={patients}
      appointments={appointments}
      doctors={doctors}
      notifications={notifications}
      isQueueView={isQueueView}
      onAddPatientToQueue={onAddPatientToQueue}
      onUpdateQueueStatus={onUpdateQueueStatus}
      onAddAuditLog={onAddAuditLog}
      onAddNotification={onAddNotification}
    />
  );
};

export default Dashboard;
