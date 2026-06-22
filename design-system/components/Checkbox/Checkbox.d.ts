import * as React from 'react';
export interface CheckboxProps {
  label?: React.ReactNode;
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
