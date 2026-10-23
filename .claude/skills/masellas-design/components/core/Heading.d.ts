import * as React from 'react';
/** Underlined agltbold display name — the single h1 of a section. */
export interface HeadingProps { children?: React.ReactNode; mobile?: boolean; color?: string; as?: 'h1'|'h2'|'div'; style?: React.CSSProperties; }
export declare function Heading(props: HeadingProps): JSX.Element;
