function WordsSection(){
  const { Section, Paragraph, WipeLink } = window.MasellasDesignSystem_fbd1b5;
  const I = p => <Paragraph variant="intro" {...p}/>;
  return <Section tone="dark"><div>
    <I>Founding member of multimedia design studio <WipeLink tone="dark" href="https://www.lamosca.com" target="_blank">Lamosca sccl</WipeLink>.</I>
    <I>During my years at Lamosca I First directed our multimedia section and then internet section. I worked mainly in web development and multimedia applications in various formats, and in organizational and team coordination tasks.</I>
    <I>In recent years, I have combined this main line of work with teaching at several universities.</I>
    <I>I also built and participated in projects (and debates) for many clients, of all sizes and in almost all possible formats.</I>
    <I>The above has allowed me to maintain a permanent state of training and learning around IT, particularly in Frontend development.</I>
    <I><WipeLink tone="dark" flush href="mailto:roger@lamosca.com">roger at lamosca.com</WipeLink></I>
  </div></Section>;
}
window.WordsSection = WordsSection;
