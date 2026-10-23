import * as React from 'react';
/** Full-viewport flat-color slide (fullPage.js section), content vertically centered.
 * @startingPoint section="Website" subtitle="Full-viewport coral or charcoal slide" viewport="1280x720"
 */
export interface SectionProps { children?: React.ReactNode; tone?: 'coral'|'dark'; align?: 'left'|'center'; height?: string|number; style?: React.CSSProperties; }
export declare function Section(props: SectionProps): JSX.Element;
