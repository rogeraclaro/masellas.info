import * as React from 'react';
/** agltbook paragraph. 'lead' = centered hero line (1.5em); 'intro' = 50%-wide bio column (1.3em). */
export interface ParagraphProps { children?: React.ReactNode; variant?: 'lead'|'intro'; mobile?: boolean; style?: React.CSSProperties; }
export declare function Paragraph(props: ParagraphProps): JSX.Element;
