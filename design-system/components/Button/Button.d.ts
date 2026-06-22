import * as React from 'react';

/**
 * Sumatec primary action button. Montserrat bold label, 8px radius.
 *
 * @startingPoint section="Core" subtitle="Brand action button — contained / outlined / text" viewport="700x180"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Semantic color. @default "primary" */
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'error';
  /** Fill style. @default "contained" */
  variant?: 'contained' | 'outlined' | 'text';
  /** @default "medium" */
  size?: 'small' | 'medium' | 'large';
  /** FontAwesome solid glyph name (without the `fa-` prefix), shown left. */
  iconLeft?: string;
  /** FontAwesome solid glyph name (without the `fa-` prefix), shown right. */
  iconRight?: string;
  /** Stretch to container width. @default false */
  fullWidth?: boolean;
  /** Uppercase label with wide tracking (brand moment). @default false */
  uppercase?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): JSX.Element;
