import * as React from 'react';
export interface IconButtonProps {
  /** FontAwesome solid glyph name (without `fa-`). */
  icon: string;
  color?: 'primary' | 'secondary' | 'accent' | 'error';
  variant?: 'contained' | 'outlined' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  shape?: 'rounded' | 'circle';
  disabled?: boolean;
  'aria-label'?: string;
  onClick?: (e: React.MouseEvent) => void;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
