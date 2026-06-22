import * as React from 'react';
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string;
  helperText?: string;
  error?: boolean;
  iconLeft?: string;
  iconRight?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}
export declare function Input(props: InputProps): JSX.Element;
