import * as React from 'react';
export interface BadgeProps {
  children?: React.ReactNode;
  color?: 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'error';
  variant?: 'soft' | 'solid';
  /** Render as a tiny status dot instead of a label. */
  dot?: boolean;
}
export declare function Badge(props: BadgeProps): JSX.Element;
