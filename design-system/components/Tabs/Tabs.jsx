import React from 'react';

/** Tabs — underline tab bar. Controlled via `value` + `onChange`, or uncontrolled. */
export function Tabs({ tabs = [], value, defaultValue, onChange, style, ...rest }) {
  const [internal, setInternal] = React.useState(defaultValue ?? (tabs[0] && tabs[0].value));
  const active = value !== undefined ? value : internal;
  const select = (v) => { if (value === undefined) setInternal(v); onChange && onChange(v); };
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-ui)', ...style }} {...rest}>
      {tabs.map((t) => {
        const on = t.value === active;
        return (
          <button
            key={t.value} role="tab" aria-selected={on} onClick={() => select(t.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: on ? 'var(--fw-bold)' : 'var(--fw-medium)',
              color: on ? 'var(--color-primary)' : 'var(--text-secondary)',
              boxShadow: on ? 'inset 0 -2px 0 var(--color-primary)' : 'none',
              transition: 'color var(--dur-fast), box-shadow var(--dur-fast)',
            }}
          >
            {t.icon && <i className={`fa-solid fa-${t.icon}`} aria-hidden="true" />}
            {t.label}
            {t.count != null && (
              <span style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', padding: '1px 6px', borderRadius: '999px', background: on ? 'var(--color-primary-soft)' : 'var(--gray-100)', color: on ? 'var(--color-primary)' : 'var(--text-secondary)' }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
