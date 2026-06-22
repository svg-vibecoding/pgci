import * as React from 'react';
export interface RadioProps {
  label?: React.ReactNode;
  checked?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  size?: 'small' | 'medium' | 'large';
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export declare function Radio(props: RadioProps): JSX.Element;
