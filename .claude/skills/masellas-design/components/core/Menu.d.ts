/** Fixed top-left row of translucent rectangular tabs (fullPage.js anchor menu). */
export interface MenuProps { items?: string[]; active?: number; onSelect?: (i: number) => void; mobile?: boolean; fixed?: boolean; }
export declare function Menu(props: MenuProps): JSX.Element;
