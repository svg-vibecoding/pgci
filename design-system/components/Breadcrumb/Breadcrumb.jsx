import React from 'react';

/** Breadcrumb — navigation trail. Pass items [{label, href}]; last is current. */
export function Breadcrumb({ items = [], separator = 'chevron', style, ...rest }) {
  const sep = separator === 'slash'
    ? <span style={{ color: 'var(--border-strong)' }}>/</span>
    : <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: 'var(--border-strong)' }} aria-hidden="true" />;
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: 'var(--font-ui)', fontSize: 13, ...style }} {...rest}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            <a href={it.href || '#'} aria-current={last ? 'page' : undefined}
              onClick={(e) => { if (!it.href) e.preventDefault(); }}
              style={{
                color: last ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: last ? 'var(--fw-semibold)' : 'var(--fw-regular)',
                textDecoration: 'none', cursor: last ? 'default' : 'pointer',
              }}
            >
              {it.label}
            </a>
            {!last && sep}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
