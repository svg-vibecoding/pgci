import * as React from 'react';
export interface SelectOption { value: string; label: string; }
export interface SelectProps {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: (string | SelectOption)[];
  placeholder?: string;
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  size?: 'small' | 'medium' | 'large';
}
export declare function Select(props: SelectProps): JSX.Element;
