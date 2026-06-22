import React from 'react';

/**
 * Sumatec Button — the brand's primary action control.
 * Montserrat, uppercase-optional bold label, 8px radius, 3 sizes,
 * 3 variants (contained / outlined / text) across semantic colors.
 */
export function Button({
  children,
  color = 'primary',
  variant = 'contained',
  size = 'medium',
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled = false,
  uppercase = false,
  type = 'button',
  onClick,
  style,
  ...rest
}) {
  const palette = {
    primary:   { main: 'var(--color-primary)', hover: 'var(--color-primary-hover)', active: 'var(--color-primary-active)', soft: 'var(--color-primary-soft)', on: '#fff' },
    secondary: { main: 'var(--gray-700)',      hover: 'var(--gray-800)',            active: 'var(--gray-900)',            soft: 'var(--gray-100)',            on: '#fff' },
    accent:    { main: 'var(--color-accent)',  hover: 'var(--color-accent-hover)',  active: 'var(--blue-700)',            soft: 'var(--color-accent-soft)',   on: '#fff' },
    success:   { main: 'var(--success)',       hover: 'var(--success-strong)',      active: 'var(--success-strong)',      soft: 'var(--success-soft)',        on: '#fff' },
    error:     { main: 'var(--error)',         hover: 'var(--error-strong)',        active: 'var(--error-strong)',        soft: 'var(--error-soft)',          on: '#fff' },
  }[color] || {};

  const sizes = {
    small:  { h: 32, px: 14, fs: 13, gap: 6 },
    medium: { h: 40, px: 18, fs: 14, gap: 8 },
    large:  { h: 48, px: 24, fs: 15, gap: 8 },
  }[size];

  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  let bg, fg, border;
  if (variant === 'contained') {
    bg = active ? palette.active : hover ? palette.hover : palette.main;
    fg = palette.on; border = 'transparent';
  } else if (variant === 'outlined') {
    bg = active ? palette.soft : hover ? palette.soft : 'transparent';
    fg = palette.main; border = palette.main;
  } else { // text
    bg = active ? palette.soft : hover ? palette.soft : 'transparent';
    fg = palette.main; border = 'transparent';
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: sizes.gap,
        height: sizes.h,
        padding: `0 ${sizes.px}px`,
        fontFamily: 'var(--font-ui)',
        fontWeight: 'var(--fw-bold)',
        fontSize: sizes.fs,
        lineHeight: 1,
        letterSpacing: uppercase ? 'var(--tracking-wide)' : '0.01em',
        textTransform: uppercase ? 'uppercase' : 'none',
        color: disabled ? 'var(--text-disabled)' : fg,
        background: disabled ? 'var(--gray-100)' : bg,
        border: `1.5px solid ${disabled ? 'transparent' : border}`,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: active && !disabled ? 'scale(0.98)' : 'none',
        transition: 'background var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {iconLeft && <i className={`fa-solid fa-${iconLeft}`} aria-hidden="true" />}
      {children}
      {iconRight && <i className={`fa-solid fa-${iconRight}`} aria-hidden="true" />}
    </button>
  );
}
