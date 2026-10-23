/* @ds-bundle: {"format":4,"namespace":"MasellasDesignSystem_fbd1b5","components":[{"name":"Heading","sourcePath":"components/core/Heading.jsx"},{"name":"Menu","sourcePath":"components/core/Menu.jsx"},{"name":"Paragraph","sourcePath":"components/core/Paragraph.jsx"},{"name":"Section","sourcePath":"components/core/Section.jsx"},{"name":"WipeLink","sourcePath":"components/core/WipeLink.jsx"}],"sourceHashes":{"components/core/Heading.jsx":"460e7a30b082","components/core/Menu.jsx":"59c926be138e","components/core/Paragraph.jsx":"e8ef257f6de9","components/core/Section.jsx":"933bba7e31bc","components/core/WipeLink.jsx":"ed58a4dd0bd5","ui_kits/website/CoverSection.jsx":"27adb5bd62a7","ui_kits/website/FullPage.jsx":"3db75b06b530","ui_kits/website/QrScreen.jsx":"82c84f411e7d","ui_kits/website/WordsSection.jsx":"e49fb24f6b5e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MasellasDesignSystem_fbd1b5 = window.MasellasDesignSystem_fbd1b5 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Heading.jsx
try { (() => {
function Heading({
  children,
  mobile = false,
  color,
  style,
  as: Tag = 'h1'
}) {
  return /*#__PURE__*/React.createElement(Tag, {
    style: {
      fontFamily: 'var(--font-heading)',
      fontWeight: 'normal',
      fontSize: mobile ? 'var(--fs-h1-mobile)' : 'var(--fs-h1)',
      lineHeight: 'var(--lh-h1)',
      letterSpacing: mobile ? 'var(--ls-h1-mobile)' : 'var(--ls-h1)',
      color: color || 'var(--text-heading)',
      textDecoration: 'underline',
      margin: 0,
      padding: 0,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Heading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Heading.jsx", error: String((e && e.message) || e) }); }

// components/core/Menu.jsx
try { (() => {
function Menu({
  items = [],
  active = 0,
  onSelect,
  mobile = false,
  fixed = true
}) {
  const [hov, setHov] = React.useState(-1);
  return /*#__PURE__*/React.createElement("ul", {
    style: {
      position: fixed ? 'fixed' : 'relative',
      top: 0,
      left: 0,
      height: mobile ? 'auto' : 'var(--menu-height)',
      zIndex: 'var(--z-menu)',
      width: '100%',
      padding: 0,
      margin: 0,
      listStyle: 'none',
      fontFamily: 'var(--font-body)',
      fontSize: mobile ? 'var(--fs-menu-mobile)' : 'var(--fs-menu)',
      lineHeight: '26px'
    }
  }, items.map((it, i) => {
    const on = i === active;
    return /*#__PURE__*/React.createElement("li", {
      key: i,
      onMouseEnter: () => setHov(i),
      onMouseLeave: () => setHov(-1),
      style: {
        display: mobile ? 'block' : 'inline-block',
        margin: mobile ? 'var(--menu-item-gap)' : '10px 0 0 10px',
        background: hov === i ? 'var(--menu-hover)' : on ? 'var(--menu-active)' : 'var(--menu-idle)'
      }
    }, /*#__PURE__*/React.createElement("a", {
      href: '#' + i,
      onClick: e => {
        e.preventDefault();
        onSelect && onSelect(i);
      },
      style: {
        display: 'block',
        padding: mobile ? 'var(--menu-item-pad-mobile)' : 'var(--menu-item-pad)',
        textDecoration: 'none',
        color: on && hov !== i ? 'var(--white)' : 'var(--black)'
      }
    }, it));
  }));
}
Object.assign(__ds_scope, { Menu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Menu.jsx", error: String((e && e.message) || e) }); }

// components/core/Paragraph.jsx
try { (() => {
function Paragraph({
  children,
  variant = 'lead',
  mobile = false,
  style
}) {
  const intro = variant === 'intro';
  const fs = intro ? mobile ? 'var(--fs-intro-mobile)' : 'var(--fs-intro)' : mobile ? 'var(--fs-p-mobile)' : 'var(--fs-p)';
  return /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-paragraph)',
      fontSize: fs,
      lineHeight: intro ? mobile ? '1.1em' : 'var(--lh-intro)' : 'var(--lh-p)',
      letterSpacing: 'var(--ls-p)',
      color: 'inherit',
      margin: intro ? '0 auto' : 0,
      width: intro ? mobile ? 'var(--intro-width-mobile)' : 'var(--intro-width)' : undefined,
      paddingTop: intro ? mobile ? 25 : 20 : 0,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Paragraph });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Paragraph.jsx", error: String((e && e.message) || e) }); }

// components/core/Section.jsx
try { (() => {
function Section({
  children,
  tone = 'coral',
  align,
  height = '100vh',
  style
}) {
  const dark = tone === 'dark';
  return /*#__PURE__*/React.createElement("section", {
    style: {
      boxSizing: 'border-box',
      position: 'relative',
      width: '100%',
      height,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: align || (dark ? 'left' : 'center'),
      background: dark ? 'var(--surface-dark)' : 'var(--surface-hero)',
      color: 'var(--text-body)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--fs-base)',
      lineHeight: 'var(--lh-base)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Section });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Section.jsx", error: String((e && e.message) || e) }); }

// components/core/WipeLink.jsx
try { (() => {
function WipeLink({
  children,
  href = '#',
  tone = 'coral',
  strike = false,
  flush = false,
  target
}) {
  const [h, setH] = React.useState(false);
  const dark = tone === 'dark';
  const fg = dark ? h ? 'var(--link-on-dark-hover-fg)' : 'var(--link-on-dark)' : h ? 'var(--link-on-coral-hover-fg)' : 'var(--link-on-coral)';
  const bg = dark ? 'var(--link-on-dark-hover-bg)' : 'var(--link-on-coral-hover-bg)';
  const pad = dark || flush ? 0 : h ? 'var(--link-pad-hover)' : 'var(--link-pad)';
  return /*#__PURE__*/React.createElement("a", {
    href: href,
    target: target,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      color: fg,
      textDecoration: strike ? 'line-through' : 'none',
      padding: pad,
      overflow: 'hidden',
      boxShadow: h ? 'inset var(--wipe-distance) 0 0 0 ' + bg : 'inset 0 0 0 0 var(--coral-hot)',
      transition: 'var(--dur-link) var(--ease)'
    }
  }, children);
}
Object.assign(__ds_scope, { WipeLink });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/WipeLink.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/CoverSection.jsx
try { (() => {
function CoverSection() {
  const {
    Section,
    Heading,
    Paragraph,
    WipeLink
  } = window.MasellasDesignSystem_fbd1b5;
  return /*#__PURE__*/React.createElement(Section, {
    tone: "coral"
  }, /*#__PURE__*/React.createElement(Heading, null, "Roger Masellas"), /*#__PURE__*/React.createElement(Paragraph, null, "My PDF resum\xE9: ", /*#__PURE__*/React.createElement(WipeLink, {
    href: "#",
    target: "_blank"
  }, "EN"), " / ", /*#__PURE__*/React.createElement(WipeLink, {
    href: "#",
    strike: true
  }, "CA"), " / ", /*#__PURE__*/React.createElement(WipeLink, {
    href: "#",
    strike: true
  }, "ES"), " (most updated cv in english)"), /*#__PURE__*/React.createElement(Paragraph, null, "My LinkedIn profile: ", /*#__PURE__*/React.createElement(WipeLink, {
    href: "https://www.linkedin.com/in/roger-masellas/",
    target: "_blank"
  }, "here")));
}
window.CoverSection = CoverSection;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/CoverSection.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/FullPage.jsx
try { (() => {
function FullPage({
  sections,
  labels
}) {
  const {
    Menu
  } = window.MasellasDesignSystem_fbd1b5;
  const n = sections.length;
  const [i, setI] = React.useState(() => Math.max(0, labels.indexOf((location.hash || '').slice(1))));
  const [off, setOff] = React.useState(0);
  const lock = React.useRef(false);
  const go = React.useCallback(dir => {
    if (lock.current) return;
    lock.current = true;
    setI(c => (c + dir + n) % n);
    setOff(o => o + dir);
    setTimeout(() => lock.current = false, 900);
  }, [n]);
  const jump = t => {
    if (t === i) return;
    setOff(o => o + (t - i));
    setI(t);
  };
  React.useEffect(() => {
    const w = e => {
      if (Math.abs(e.deltaY) > 8) go(e.deltaY > 0 ? 1 : -1);
    };
    const k = e => {
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) go(1);
      if (['ArrowUp', 'PageUp'].includes(e.key)) go(-1);
    };
    addEventListener('wheel', w);
    addEventListener('keydown', k);
    return () => {
      removeEventListener('wheel', w);
      removeEventListener('keydown', k);
    };
  }, [go]);
  // continuousVertical: render a strip around the virtual offset
  const strip = [-1, 0, 1].map(d => ({
    key: off + d,
    idx: ((i + d) % n + n) % n
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Menu, {
    items: labels,
    active: i,
    onSelect: jump
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      transform: 'translate3d(0,' + -off * 100 + 'vh,0)',
      transition: 'transform var(--dur-section) var(--ease-section)'
    }
  }, strip.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.key,
    style: {
      position: 'absolute',
      left: 0,
      width: '100%',
      height: '100vh',
      top: s.key * 100 + 'vh'
    }
  }, sections[s.idx]))));
}
window.FullPage = FullPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/FullPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/QrScreen.jsx
try { (() => {
function QrScreen({
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'var(--coral)',
      zIndex: 100,
      overflow: 'auto',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("figure", {
    style: {
      margin: '16px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '40%'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/img/qr.svg",
    style: {
      width: '100%',
      display: 'block'
    }
  }))));
}
window.QrScreen = QrScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/QrScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WordsSection.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function WordsSection() {
  const {
    Section,
    Paragraph,
    WipeLink
  } = window.MasellasDesignSystem_fbd1b5;
  const I = p => /*#__PURE__*/React.createElement(Paragraph, _extends({
    variant: "intro"
  }, p));
  return /*#__PURE__*/React.createElement(Section, {
    tone: "dark"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(I, null, "Founding member of multimedia design studio ", /*#__PURE__*/React.createElement(WipeLink, {
    tone: "dark",
    href: "https://www.lamosca.com",
    target: "_blank"
  }, "Lamosca sccl"), "."), /*#__PURE__*/React.createElement(I, null, "During my years at Lamosca I First directed our multimedia section and then internet section. I worked mainly in web development and multimedia applications in various formats, and in organizational and team coordination tasks."), /*#__PURE__*/React.createElement(I, null, "In recent years, I have combined this main line of work with teaching at several universities."), /*#__PURE__*/React.createElement(I, null, "I also built and participated in projects (and debates) for many clients, of all sizes and in almost all possible formats."), /*#__PURE__*/React.createElement(I, null, "The above has allowed me to maintain a permanent state of training and learning around IT, particularly in Frontend development."), /*#__PURE__*/React.createElement(I, null, /*#__PURE__*/React.createElement(WipeLink, {
    tone: "dark",
    flush: true,
    href: "mailto:roger@lamosca.com"
  }, "roger at lamosca.com"))));
}
window.WordsSection = WordsSection;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WordsSection.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Heading = __ds_scope.Heading;

__ds_ns.Menu = __ds_scope.Menu;

__ds_ns.Paragraph = __ds_scope.Paragraph;

__ds_ns.Section = __ds_scope.Section;

__ds_ns.WipeLink = __ds_scope.WipeLink;

})();
