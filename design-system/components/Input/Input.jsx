import React from 'react';

/** Text field — label, helper/error text, optional FA icons & affixes. */
export function Input({
  label,
  value,
  placeholder,
  helperText,
  error = false,
  disabled = false,
  iconLeft,
  iconRight,
  prefix,
  suffix,
  size = 'medium',
  type = 'text',
  required = false,
  onChange,
  style,
  ...rest
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
        display: 'flex', alignItems: 'center', gap: 8, height: h, padding: '0 12px',
        background: disabled ? 'var(--gray-100)' : 'var(--surface-card)',
        border: `1.5px solid ${borderColor}`, borderRadius: 'var(--radius-md)',
        boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      }}>
        {iconLeft && <i className={`fa-solid fa-${iconLeft}`} style={{ color: 'var(--text-tertiary)', fontSize: 14 }} aria-hidden="true" />}
        {prefix && <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{prefix}</span>}
        <input
          type={type} value={value} placeholder={placeholder} disabled={disabled} required={required}
          onChange={onChange} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-primary)',
          }}
          {...rest}
        />
        {suffix && <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{suffix}</span>}
        {iconRight && <i className={`fa-solid fa-${iconRight}`} style={{ color: 'var(--text-tertiary)', fontSize: 14 }} aria-hidden="true" />}
      </div>
      {helperText && (
        <span style={{ fontSize: 12, color: error ? 'var(--error)' : 'var(--text-secondary)' }}>{helperText}</span>
      )}
    </label>
  );
}
