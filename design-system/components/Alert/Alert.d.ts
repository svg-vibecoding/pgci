import * as React from 'react';
export interface AlertProps {
  children?: React.ReactNode;
  title?: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  onClose?: (e: React.MouseEvent) => void;
}
export declare function Alert(props: AlertProps): JSX.Element;
