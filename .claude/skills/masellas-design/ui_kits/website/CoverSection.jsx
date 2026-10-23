function CoverSection(){
  const { Section, Heading, Paragraph, WipeLink } = window.MasellasDesignSystem_fbd1b5;
  return <Section tone="coral">
    <Heading>Roger Masellas</Heading>
    <Paragraph>My PDF resumé: <WipeLink href="#" target="_blank">EN</WipeLink> / <WipeLink href="#" strike>CA</WipeLink> / <WipeLink href="#" strike>ES</WipeLink> (most updated cv in english)</Paragraph>
    <Paragraph>My LinkedIn profile: <WipeLink href="https://www.linkedin.com/in/roger-masellas/" target="_blank">here</WipeLink></Paragraph>
  </Section>;
}
window.CoverSection = CoverSection;
