import React from 'react';

/** Avatar — user/initials/image. Pill (circle) by default. */
export function Avatar({ src, name = '', size = 'medium', color = 'accent', style, ...rest }) {
  const dim = { xs: 24, small: 32, medium: 40, large: 48 }[size];
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const bg = { accent: 'var(--blue-100)', primary: 'var(--red-100)', neutral: 'var(--gray-200)' }[color];
  const fg = { accent: 'var(--blue-700)', primary: 'var(--red-700)', neutral: 'var(--gray-700)' }[color];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: dim, height: dim, borderRadius: '999px', overflow: 'hidden', flexShrink: 0,
      background: bg, color: fg, fontFamily: 'var(--font-ui)', fontWeight: 'var(--fw-bold)',
      fontSize: dim * 0.4, ...style,
    }} {...rest}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials || <i className="fa-solid fa-user" style={{ fontSize: dim * 0.45 }} aria-hidden="true" />}
    </span>
  );
}
