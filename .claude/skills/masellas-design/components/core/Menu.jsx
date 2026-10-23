import React from 'react';
export function Menu({ items = [], active = 0, onSelect, mobile = false, fixed = true }) {
  const [hov, setHov] = React.useState(-1);
  return <ul style={{ position: fixed ? 'fixed' : 'relative', top: 0, left: 0, height: mobile ? 'auto' : 'var(--menu-height)', zIndex: 'var(--z-menu)', width: '100%', padding: 0, margin: 0, listStyle: 'none', fontFamily: 'var(--font-body)', fontSize: mobile ? 'var(--fs-menu-mobile)' : 'var(--fs-menu)', lineHeight: '26px' }}>
    {items.map((it, i) => { const on = i === active; return <li key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(-1)} style={{ display: mobile ? 'block' : 'inline-block', margin: mobile ? 'var(--menu-item-gap)' : '10px 0 0 10px', background: hov === i ? 'var(--menu-hover)' : on ? 'var(--menu-active)' : 'var(--menu-idle)' }}>
      <a href={'#' + i} onClick={e => { e.preventDefault(); onSelect && onSelect(i); }} style={{ display: 'block', padding: mobile ? 'var(--menu-item-pad-mobile)' : 'var(--menu-item-pad)', textDecoration: 'none', color: on && hov !== i ? 'var(--white)' : 'var(--black)' }}>{it}</a></li>; })}
  </ul>;
}
