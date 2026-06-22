import * as React from 'react';
export interface BreadcrumbItem { label: string; href?: string; }
export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: 'chevron' | 'slash';
}
export declare function Breadcrumb(props: BreadcrumbProps): JSX.Element;
