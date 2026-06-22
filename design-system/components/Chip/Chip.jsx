import React from 'react';

/** Chip — compact filter / selection / removable token. Pill shape. */
export function Chip({
  children,
  color = 'neutral',
  variant = 'soft',
  size = 'medium',
  iconLeft,
  selected = false,
  onRemove,
  onClick,
  style,
  ...rest
}) {
  const palette = {
    neutral: { main: 'var(--gray-700)',      soft: 'var(--gray-100)',          border: 'var(--border-default)' },
    primary: { main: 'var(--color-primary)', soft: 'var(--color-primary-soft)', border: 'var(--red-200)' },
    accent:  { main: 'var(--color-accent)',  soft: 'var(--color-accent-soft)',  border: 'var(--blue-200)' },
    success: { main: 'var(--success-strong)', soft: 'var(--success-soft)',      border: '#a7d8ba' },
    warning: { main: 'var(--warning-strong)', soft: 'var(--warning-soft)',      border: '#f0d18a' },
  }[color] || {};
  const h = { small: 24, medium: 30, large: 36 }[size];
  const fs = { small: 12, medium: 13, large: 14 }[size];

  let bg, fg, border;
  if (selected) { bg = palette.main; fg = '#fff'; border = palette.main; }
  else if (variant === 'solid') { bg = palette.main; fg = '#fff'; border = palette.main; }
  else if (variant === 'outline') { bg = 'transparent'; fg = palette.main; border = palette.border; }
  else { bg = palette.soft; fg = palette.main; border = 'transparent'; }

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: h, padding: `0 ${onRemove ? 8 : 12}px 0 12px`,
        fontFamily: 'var(--font-ui)', fontWeight: 'var(--fw-semibold)', fontSize: fs, lineHeight: 1,
        color: fg, background: bg, border: `1px solid ${border}`,
        borderRadius: 'var(--radius-pill)',
        cursor: onClick ? 'pointer' : 'default', userSelect: 'none',
        transition: 'all var(--dur-fast) var(--ease-standard)',
        ...style,
      }}
      {...rest}
    >
      {iconLeft && <i className={`fa-solid fa-${iconLeft}`} style={{ fontSize: fs - 1 }} aria-hidden="true" />}
      {children}
      {onRemove && (
        <button
          type="button" aria-label="Quitar"
          onClick={(e) => { e.stopPropagation(); onRemove(e); }}
          style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 2, fontSize: fs - 2, opacity: 0.8 }}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
