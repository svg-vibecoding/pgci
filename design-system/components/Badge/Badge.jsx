import React from 'react';

/** Badge — status label or numeric count. Use `dot` for tiny status. */
export function Badge({ children, color = 'neutral', variant = 'soft', dot = false, style, ...rest }) {
  const palette = {
    neutral: { main: 'var(--gray-700)',       soft: 'var(--gray-100)' },
    primary: { main: 'var(--color-primary)',  soft: 'var(--color-primary-soft)' },
    accent:  { main: 'var(--color-accent)',   soft: 'var(--color-accent-soft)' },
    success: { main: 'var(--success-strong)', soft: 'var(--success-soft)' },
    warning: { main: 'var(--warning-strong)', soft: 'var(--warning-soft)' },
    error:   { main: 'var(--error)',          soft: 'var(--error-soft)' },
  }[color] || {};

  if (dot) {
    return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '999px', background: palette.main, ...style }} {...rest} />;
  }
  const solid = variant === 'solid';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        minWidth: 20, height: 20, padding: '0 7px',
        fontFamily: 'var(--font-ui)', fontWeight: 'var(--fw-bold)', fontSize: 11, lineHeight: 1,
        letterSpacing: '0.02em',
        color: solid ? '#fff' : palette.main,
        background: solid ? palette.main : palette.soft,
        borderRadius: 'var(--radius-pill)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
