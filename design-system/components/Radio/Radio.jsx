import React from 'react';

/** Radio — round control, brand-red dot when selected. */
export function Radio({ label, checked = false, disabled = false, onChange, name, value, size = 'medium', style, ...rest }) {
  const box = { small: 16, medium: 20, large: 24 }[size];
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-ui)', opacity: disabled ? 0.55 : 1, ...style }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: box, height: box, flexShrink: 0, borderRadius: '999px',
        background: 'var(--surface-card)',
        border: `1.5px solid ${checked ? 'var(--color-primary)' : 'var(--border-strong)'}`,
        transition: 'border-color var(--dur-fast)',
      }}>
        <span style={{
          width: box * 0.5, height: box * 0.5, borderRadius: '999px',
          background: 'var(--color-primary)',
          transform: checked ? 'scale(1)' : 'scale(0)',
          transition: 'transform var(--dur-fast) var(--ease-emphasis)',
        }} />
      </span>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} {...rest} />
      {label && <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{label}</span>}
    </label>
  );
}
