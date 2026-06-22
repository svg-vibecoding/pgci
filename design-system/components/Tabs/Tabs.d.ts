import * as React from 'react';
export interface TabItem { value: string; label: string; icon?: string; count?: number; }
export interface TabsProps {
  tabs: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}
export declare function Tabs(props: TabsProps): JSX.Element;
