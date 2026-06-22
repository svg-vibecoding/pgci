import React from 'react';

/**
 * IconButton — square/circular action holding a single FontAwesome glyph.
 */
export function IconButton({
  icon,
  color = 'secondary',
  variant = 'ghost',
  size = 'medium',
  shape = 'rounded',
  disabled = false,
  'aria-label': ariaLabel,
  onClick,
  style,
  ...rest
}) {
  const palette = {
    primary:   { main: 'var(--color-primary)', soft: 'var(--color-primary-soft)', on: '#fff' },
    secondary: { main: 'var(--gray-600)',      soft: 'var(--gray-100)',           on: '#fff' },
    accent:    { main: 'var(--color-accent)',  soft: 'var(--color-accent-soft)',  on: '#fff' },
    error:     { main: 'var(--error)',         soft: 'var(--error-soft)',         on: '#fff' },
  }[color] || {};
  const sizes = { small: 28, medium: 36, large: 44 }[size];
  const fs = { small: 13, medium: 15, large: 18 }[size];
  const [hover, setHover] = React.useState(false);

  let bg, fg, border = 'transparent';
  if (variant === 'contained') { bg = palette.main; fg = palette.on; }
  else if (variant === 'outlined') { bg = hover ? palette.soft : 'transparent'; fg = palette.main; border = 'var(--border-default)'; }
  else { bg = hover ? palette.soft : 'transparent'; fg = palette.main; }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: sizes, height: sizes, fontSize: fs,
        color: disabled ? 'var(--text-disabled)' : fg,
        background: disabled ? 'var(--gray-100)' : bg,
        border: `1.5px solid ${disabled ? 'transparent' : border}`,
        borderRadius: shape === 'circle' ? '999px' : 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur-fast) var(--ease-standard)',
        ...style,
      }}
      {...rest}
    >
      <i className={`fa-solid fa-${icon}`} aria-hidden="true" />
    </button>
  );
}
