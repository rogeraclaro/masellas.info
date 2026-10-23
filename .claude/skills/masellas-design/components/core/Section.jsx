import React from 'react';
export function Section({ children, tone = 'coral', align, height = '100vh', style }) {
  const dark = tone === 'dark';
  return <section style={{ boxSizing: 'border-box', position: 'relative', width: '100%', height, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: align || (dark ? 'left' : 'center'), background: dark ? 'var(--surface-dark)' : 'var(--surface-hero)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-base)', lineHeight: 'var(--lh-base)', ...style }}>{children}</section>;
}
