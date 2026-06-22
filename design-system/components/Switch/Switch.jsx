import React from 'react';

/** Switch — on/off toggle. Brand-red track when on. */
export function Switch({ checked = false, disabled = false, onChange, label, size = 'medium', style, ...rest }) {
  const w = { small: 36, medium: 44 }[size];
  const h = { small: 20, medium: 24 }[size];
  const knob = h - 6;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-ui)', opacity: disabled ? 0.55 : 1, ...style }}>
      <span style={{
        position: 'relative', width: w, height: h, flexShrink: 0, borderRadius: '999px',
        background: checked ? 'var(--color-primary)' : 'var(--gray-300)',
        transition: 'background var(--dur-normal) var(--ease-standard)',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: checked ? w - knob - 3 : 3,
          width: knob, height: knob, borderRadius: '999px', background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          transition: 'left var(--dur-normal) var(--ease-emphasis)',
        }} />
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} {...rest} />
      {label && <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{label}</span>}
    </label>
  );
}
