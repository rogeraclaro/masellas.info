import React from 'react';
export function WipeLink({ children, href = '#', tone = 'coral', strike = false, flush = false, target }) {
  const [h, setH] = React.useState(false);
  const dark = tone === 'dark';
  const fg = dark ? (h ? 'var(--link-on-dark-hover-fg)' : 'var(--link-on-dark)') : (h ? 'var(--link-on-coral-hover-fg)' : 'var(--link-on-coral)');
  const bg = dark ? 'var(--link-on-dark-hover-bg)' : 'var(--link-on-coral-hover-bg)';
  const pad = dark || flush ? 0 : (h ? 'var(--link-pad-hover)' : 'var(--link-pad)');
  return <a href={href} target={target} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ color: fg, textDecoration: strike ? 'line-through' : 'none', padding: pad, overflow: 'hidden', boxShadow: h ? 'inset var(--wipe-distance) 0 0 0 ' + bg : 'inset 0 0 0 0 var(--coral-hot)', transition: 'var(--dur-link) var(--ease)' }}>{children}</a>;
}
