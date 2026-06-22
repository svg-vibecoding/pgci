import React from 'react';

/** Select — native dropdown styled to match Input. */
export function Select({
  label, value, onChange, options = [], placeholder = 'Selecciona…',
  helperText, error = false, disabled = false, size = 'medium', required = false, style, ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const h = { small: 36, medium: 44, large: 52 }[size];
  const borderColor = error ? 'var(--error)' : focus ? 'var(--border-focus)' : 'var(--border-default)';
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-ui)', ...style }}>
      {label && (
        <span style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)' }}>
          {label}{required && <span style={{ color: 'var(--error)' }}> *</span>}
        </span>
      )}
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', height: h,
        background: disabled ? 'var(--gray-100)' : 'var(--surface-card)',
        border: `1.5px solid ${borderColor}`, borderRadius: 'var(--radius-md)',
        boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      }}>
        <select
          value={value} disabled={disabled} required={required} onChange={onChange}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            appearance: 'none', WebkitAppearance: 'none', flex: 1, height: '100%',
            border: 'none', outline: 'none', background: 'transparent',
            padding: '0 36px 0 12px', fontFamily: 'var(--font-ui)', fontSize: 14,
            color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          {...rest}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return <option key={opt.value} value={opt.value}>{opt.label}</option>;
          })}
        </select>
        <i className="fa-solid fa-chevron-down" style={{ position: 'absolute', right: 12, color: 'var(--text-tertiary)', fontSize: 12, pointerEvents: 'none' }} aria-hidden="true" />
      </div>
      {helperText && <span style={{ fontSize: 12, color: error ? 'var(--error)' : 'var(--text-secondary)' }}>{helperText}</span>}
    </label>
  );
}
