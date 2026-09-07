import React from 'react';

export const InputField = ({ label, error, name, ...props }) => {
  return (
    <div className="input-group">
      {label && <label htmlFor={name}>{label}</label>}
      <input
        id={name}
        name={name}
        className="input-field"
        style={error ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 3px var(--danger-light)' } : {}}
        {...props}
      />
      {error && <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
};

export const SelectField = ({ label, error, name, options = [], placeholder, ...props }) => {
  return (
    <div className="input-group">
      {label && <label htmlFor={name}>{label}</label>}
      <select
        id={name}
        name={name}
        className="input-field"
        style={error ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 3px var(--danger-light)' } : {}}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
};

export const TextareaField = ({ label, error, name, ...props }) => {
  return (
    <div className="input-group">
      {label && <label htmlFor={name}>{label}</label>}
      <textarea
        id={name}
        name={name}
        className="input-field"
        style={{ 
          minHeight: '80px', 
          resize: 'vertical',
          ...(error ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 3px var(--danger-light)' } : {})
        }}
        {...props}
      />
      {error && <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
};
