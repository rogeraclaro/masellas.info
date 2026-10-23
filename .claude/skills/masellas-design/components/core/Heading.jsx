import React from 'react';
export function Heading({ children, mobile = false, color, style, as: Tag = 'h1' }) {
  return <Tag style={{ fontFamily: 'var(--font-heading)', fontWeight: 'normal', fontSize: mobile ? 'var(--fs-h1-mobile)' : 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', letterSpacing: mobile ? 'var(--ls-h1-mobile)' : 'var(--ls-h1)', color: color || 'var(--text-heading)', textDecoration: 'underline', margin: 0, padding: 0, ...style }}>{children}</Tag>;
}
