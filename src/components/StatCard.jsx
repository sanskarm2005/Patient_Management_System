import React from 'react';

export const StatCard = ({ label, value, icon: Icon, color = 'var(--primary)' }) => {
  return (
    <div className="card stat-card">
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
      </div>
      {Icon && (
        <div 
          className="stat-icon" 
          style={{ 
            backgroundColor: `${color}15`, // adds transparent opacity
            color: color 
          }}
        >
          <Icon size={24} />
        </div>
      )}
    </div>
  );
};

export default StatCard;
