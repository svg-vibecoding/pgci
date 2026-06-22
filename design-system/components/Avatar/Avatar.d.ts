import * as React from 'react';
export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'small' | 'medium' | 'large';
  color?: 'accent' | 'primary' | 'neutral';
}
export declare function Avatar(props: AvatarProps): JSX.Element;
