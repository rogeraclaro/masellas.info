import React from 'react';
export function Paragraph({ children, variant = 'lead', mobile = false, style }) {
  const intro = variant === 'intro';
  const fs = intro ? (mobile ? 'var(--fs-intro-mobile)' : 'var(--fs-intro)') : (mobile ? 'var(--fs-p-mobile)' : 'var(--fs-p)');
  return <p style={{ fontFamily: 'var(--font-paragraph)', fontSize: fs, lineHeight: intro ? (mobile ? '1.1em' : 'var(--lh-intro)') : 'var(--lh-p)', letterSpacing: 'var(--ls-p)', color: 'inherit', margin: intro ? '0 auto' : 0, width: intro ? (mobile ? 'var(--intro-width-mobile)' : 'var(--intro-width)') : undefined, paddingTop: intro ? (mobile ? 25 : 20) : 0, ...style }}>{children}</p>;
}
