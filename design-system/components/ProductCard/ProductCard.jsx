import React from 'react';
import { Button } from '../Button/Button.jsx';
import { Badge } from '../Badge/Badge.jsx';

/**
 * ProductCard — the workhorse of Sumatec's MRO catalog (B2C & PGCI).
 * Brand + reference (SKU), image, name, price with optional strike-through,
 * stock state, and an add-to-cart action.
 */
export function ProductCard({
  brand, sku, name, image, price, oldPrice, currency = '$',
  badge, inStock = true, onAdd, onClick, style, ...rest
}) {
  const fmt = (n) => currency + Number(n).toLocaleString('es-CO');
  const discount = oldPrice && price ? Math.round((1 - price / oldPrice) * 100) : 0;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', width: 240,
        fontFamily: 'var(--font-ui)', transition: 'box-shadow var(--dur-normal) var(--ease-standard)',
        cursor: onClick ? 'pointer' : 'default', ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      {...rest}
    >
      <div style={{ position: 'relative', height: 168, background: 'var(--gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {(discount > 0 || badge) && (
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
            {discount > 0 && <Badge color="primary" variant="solid">-{discount}%</Badge>}
            {badge && <Badge color="accent">{badge}</Badge>}
          </div>
        )}
        {image
          ? <img src={image} alt={name} style={{ maxWidth: '82%', maxHeight: '82%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
          : <i className="fa-solid fa-gear" style={{ fontSize: 44, color: 'var(--gray-300)' }} aria-hidden="true" />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 'var(--fw-bold)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>{brand}</span>
          {sku && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sku}</span>}
        </div>
        <span style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 36 }}>{name}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 20, fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{fmt(price)}</span>
          {oldPrice && <span style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{fmt(oldPrice)}</span>}
        </div>
        <span style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: inStock ? 'var(--success-strong)' : 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <i className={`fa-solid ${inStock ? 'fa-circle-check' : 'fa-circle-xmark'}`} aria-hidden="true" />
          {inStock ? 'Disponible' : 'Agotado'}
        </span>
        <Button color="primary" size="medium" iconLeft="cart-plus" fullWidth disabled={!inStock}
          onClick={(e) => { e.stopPropagation(); onAdd && onAdd(e); }} style={{ marginTop: 6 }}>
          Agregar
        </Button>
      </div>
    </div>
  );
}
