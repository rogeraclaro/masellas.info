function FullPage({ sections, labels }){
  const { Menu } = window.MasellasDesignSystem_fbd1b5;
  const n = sections.length;
  const [i, setI] = React.useState(() => Math.max(0, labels.indexOf((location.hash||'').slice(1))));
  const [off, setOff] = React.useState(0);
  const lock = React.useRef(false);
  const go = React.useCallback(dir => {
    if (lock.current) return; lock.current = true;
    setI(c => (c + dir + n) % n); setOff(o => o + dir);
    setTimeout(() => lock.current = false, 900);
  }, [n]);
  const jump = t => { if (t === i) return; setOff(o => o + (t - i)); setI(t); };
  React.useEffect(() => {
    const w = e => { if (Math.abs(e.deltaY) > 8) go(e.deltaY > 0 ? 1 : -1); };
    const k = e => { if (['ArrowDown','PageDown',' '].includes(e.key)) go(1); if (['ArrowUp','PageUp'].includes(e.key)) go(-1); };
    addEventListener('wheel', w); addEventListener('keydown', k);
    return () => { removeEventListener('wheel', w); removeEventListener('keydown', k); };
  }, [go]);
  // continuousVertical: render a strip around the virtual offset
  const strip = [-1,0,1].map(d => ({ key: off + d, idx: ((i + d) % n + n) % n }));
  return <div style={{position:'fixed',inset:0,overflow:'hidden'}}>
    <Menu items={labels} active={i} onSelect={jump}/>
    <div style={{position:'absolute',inset:0,transform:'translate3d(0,'+(-off*100)+'vh,0)',transition:'transform var(--dur-section) var(--ease-section)'}}>
      {strip.map(s => <div key={s.key} style={{position:'absolute',left:0,width:'100%',height:'100vh',top:(s.key*100)+'vh'}}>{sections[s.idx]}</div>)}
    </div>
  </div>;
}
window.FullPage = FullPage;
