(function (root) {
  'use strict';

  var ca = {
    'nav.story': 'Història',
    'nav.product': 'El producte',
    'nav.contact': 'Contacte',

    'hero.title': 'Torre de la Fullola',
    'hero.subtitle': 'Oli d’oliva verge extra ecològic, de la Serra de Cardó',

    'story.heading': 'La nostra història',
    'story.paragraph1': 'Som una petita explotació familiar d’oliveres centenàries, ubicades en un terreny calcari i rocós de gran pendent i orientació sud, a la falda de la Serra de Cardó (El Boix).',
    'story.paragraph2': 'Aquest petit bocí de terra es cultiva de manera tradicional i ecològica.',
    'story.paragraph3': 'Les olives es recol·lecten directament de l’arbre mitjançant tècniques manuals i es premsen per procediments mecànics en fred.',

    'product.heading': 'El producte',
    'product.description': 'El resultat és un oli d’aroma suau i equilibrat, de gust afruitat i molt baixa acidesa.',
    'product.varietiesLabel': 'Varietats',
    'product.varieties': 'Morrut, Sevillenca i Farga',
    'product.badgeVergeExtra': 'Verge Extra',
    'product.badgeBio': 'BIO',
    'product.badgeCcpae': 'CCPAE',
    'product.badgeUe': 'Agricultura UE',
    'product.categoryLabel': 'Categoria',
    'product.harvestLabel': 'Collita',
    'product.harvestValue': 'A mà, premsat en fred',

    'contact.heading': 'Contacte',
    'contact.intro': 'Vols saber-ne més o fer una comanda? Escriu-nos.',
    'contact.formName': 'Nom',
    'contact.formEmail': 'Correu electrònic',
    'contact.formMessage': 'Missatge',
    'contact.formSubmit': 'Enviar',
    'contact.phoneLabel': 'Telèfon',
    'contact.domainLabel': 'Web',

    'footer.rights': 'Torre de la Fullola S.C.P. (Tortosa). Tots els drets reservats.',
  };

  var de = {
    'nav.story': 'Geschichte',
    'nav.product': 'Produkt',
    'nav.contact': 'Kontakt',

    'hero.title': 'Torre de la Fullola',
    'hero.subtitle': 'Natives Olivenöl extra, biologisch, aus der Serra de Cardó',

    'story.heading': 'Unsere Geschichte',
    'story.paragraph1': 'Kleiner Familienbetrieb mit einem Bestand sehr alten Olivenbäumen auf karstigem Boden in südorientierten Terrassen am Fusse der Serra de Cardó (el Boix).',
    'story.paragraph2': 'Dieses kleine Stück Erde bewirtschaften wir in Handarbeit unter ökologischen Kriterien.',
    'story.paragraph3': 'Die Oliven werden direkt vom Baum geerntet und nur mit mechanischen Mitteln kalt gepresst.',

    'product.heading': 'Das Produkt',
    'product.description': 'Das Ergebnis ist ein natives Olivenöl mit mildem, fruchtig-ausgeglichenem Aroma.',
    'product.varietiesLabel': 'Sorten',
    'product.varieties': 'Morrut, Sevillenca und Farga',
    'product.badgeVergeExtra': 'Nativ Extra',
    'product.badgeBio': 'BIO',
    'product.badgeCcpae': 'CCPAE',
    'product.badgeUe': 'EU-Landwirtschaft',
    'product.categoryLabel': 'Kategorie',
    'product.harvestLabel': 'Ernte',
    'product.harvestValue': 'Handernte, kalt gepresst',

    'contact.heading': 'Kontakt',
    'contact.intro': 'Möchten Sie mehr erfahren oder bestellen? Schreiben Sie uns.',
    'contact.formName': 'Name',
    'contact.formEmail': 'E-Mail',
    'contact.formMessage': 'Nachricht',
    'contact.formSubmit': 'Senden',
    'contact.phoneLabel': 'Telefon',
    'contact.domainLabel': 'Web',

    'footer.rights': 'Torre de la Fullola S.C.P. (Tortosa). Alle Rechte vorbehalten.',
  };

  var api = { STRINGS: { ca: ca, de: de } };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.i18nStrings = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
