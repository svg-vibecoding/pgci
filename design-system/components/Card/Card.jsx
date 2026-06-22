import React from 'react';

/** Card — neutral surface container. `interactive` adds hover lift. */
export function Card({ children, padding = 'md', elevation = 'sm', interactive = false, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const pad = { none: 0, sm: 16, md: 24, lg: 32 }[padding];
  const shadows = { none: 'none', sm: 'var(--shadow-sm)', md: 'var(--shadow-md)' };
  return (
    <div
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: pad,
        boxShadow: interactive && hover ? 'var(--shadow-md)' : shadows[elevation],
        transform: interactive && hover ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow var(--dur-normal) var(--ease-standard), transform var(--dur-normal) var(--ease-standard)',
        cursor: interactive ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
