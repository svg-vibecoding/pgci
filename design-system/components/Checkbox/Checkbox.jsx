import React from 'react';

/** Checkbox — square control, brand-red when checked. Supports indeterminate. */
export function Checkbox({ label, checked = false, indeterminate = false, disabled = false, onChange, size = 'medium', style, ...rest }) {
  const box = { small: 16, medium: 20, large: 24 }[size];
  const on = checked || indeterminate;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-ui)', opacity: disabled ? 0.55 : 1, ...style }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: box, height: box, flexShrink: 0,
        background: on ? 'var(--color-primary)' : 'var(--surface-card)',
        border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--radius-xs)', color: '#fff', fontSize: box * 0.55,
        transition: 'background var(--dur-fast), border-color var(--dur-fast)',
      }}>
        {indeterminate ? <i className="fa-solid fa-minus" /> : checked ? <i className="fa-solid fa-check" /> : null}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} {...rest} />
      {label && <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{label}</span>}
    </label>
  );
}
