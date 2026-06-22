import * as React from 'react';

/**
 * MRO catalog product card.
 * @startingPoint section="Commerce" subtitle="Catalog product tile with brand, SKU, price & cart" viewport="280x420"
 */
export interface ProductCardProps {
  brand: string;
  sku?: string;
  name: string;
  image?: string;
  price: number;
  oldPrice?: number;
  currency?: string;
  badge?: string;
  inStock?: boolean;
  onAdd?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}
export declare function ProductCard(props: ProductCardProps): JSX.Element;
