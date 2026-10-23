function QrScreen({ onClose }){
  return <div onClick={onClose} style={{position:'fixed',inset:0,background:'var(--coral)',zIndex:100,overflow:'auto',cursor:'pointer'}}>
    <figure style={{margin:'16px 40px'}}><div style={{marginTop:'40%'}}><img src="../../assets/img/qr.svg" style={{width:'100%',display:'block'}}/></div></figure>
  </div>;
}
window.QrScreen = QrScreen;
