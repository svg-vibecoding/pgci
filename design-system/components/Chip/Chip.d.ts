import * as React from 'react';
export interface ChipProps {
  children?: React.ReactNode;
  color?: 'neutral' | 'primary' | 'accent' | 'success' | 'warning';
  variant?: 'soft' | 'solid' | 'outline';
  size?: 'small' | 'medium' | 'large';
  iconLeft?: string;
  selected?: boolean;
  onRemove?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}
export declare function Chip(props: ChipProps): JSX.Element;
