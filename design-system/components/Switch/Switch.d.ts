import * as React from 'react';
export interface SwitchProps {
  checked?: boolean;
  disabled?: boolean;
  label?: React.ReactNode;
  size?: 'small' | 'medium';
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export declare function Switch(props: SwitchProps): JSX.Element;
