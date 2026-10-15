(function (root) {
  'use strict';

  function detectLanguage(navigatorLanguage, storedPreference) {
    if (storedPreference === 'ca' || storedPreference === 'de') {
      return storedPreference;
    }
    var lang = (navigatorLanguage || '').toLowerCase();
    if (lang.indexOf('de') === 0) {
      return 'de';
    }
    return 'ca';
  }

  var api = { detectLanguage: detectLanguage };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.i18nCore = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
