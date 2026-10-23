import * as React from 'react';
/** Inline link whose hover floods a solid inset-shadow block left→right. */
export interface WipeLinkProps { children?: React.ReactNode; href?: string; target?: string; tone?: 'coral'|'dark'; strike?: boolean; flush?: boolean; }
export declare function WipeLink(props: WipeLinkProps): JSX.Element;
