import React from 'react';

/** Alert — inline feedback banner. info / success / warning / error. */
export function Alert({ children, title, severity = 'info', onClose, style, ...rest }) {
  const cfg = {
    info:    { soft: 'var(--info-soft)',    main: 'var(--info-strong)',    icon: 'circle-info' },
    success: { soft: 'var(--success-soft)', main: 'var(--success-strong)', icon: 'circle-check' },
    warning: { soft: 'var(--warning-soft)', main: 'var(--warning-strong)', icon: 'triangle-exclamation' },
    error:   { soft: 'var(--error-soft)',   main: 'var(--error-strong)',   icon: 'circle-exclamation' },
  }[severity];
  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
      background: cfg.soft, borderRadius: 'var(--radius-md)',
      borderLeft: `3px solid ${cfg.main}`, fontFamily: 'var(--font-ui)', ...style,
    }} {...rest}>
      <i className={`fa-solid fa-${cfg.icon}`} style={{ color: cfg.main, fontSize: 16, marginTop: 1 }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: 14, fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginBottom: children ? 2 : 0 }}>{title}</div>}
        {children && <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)' }}>{children}</div>}
      </div>
      {onClose && (
        <button type="button" aria-label="Cerrar" onClick={onClose}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, padding: 2 }}>
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
