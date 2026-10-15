// js/main.js
(function () {
  'use strict';

  var STORAGE_KEY = 'tdlf-lang';

  function applyLanguage(lang) {
    if (!window.i18nStrings.STRINGS[lang]) {
      lang = 'ca';
    }
    document.documentElement.setAttribute('lang', lang);
    var strings = window.i18nStrings.STRINGS[lang];

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (strings[key]) {
        el.textContent = strings[key];
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (strings[key]) {
        el.setAttribute('placeholder', strings[key]);
      }
    });

    document.querySelectorAll('.lang-switch button').forEach(function (btn) {
      var isActive = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  function readStoredPreference() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function initialLanguage() {
    if (window.TDLF_FORCE_LANG === 'ca' || window.TDLF_FORCE_LANG === 'de') {
      return window.TDLF_FORCE_LANG;
    }
    return window.i18nCore.detectLanguage(navigator.language, readStoredPreference());
  }

  function setLanguage(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (err) {
      /* localStorage unavailable — language just won't persist across visits */
    }
    applyLanguage(lang);
  }

  function syncNavHeight() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyLanguage(initialLanguage());

    document.querySelectorAll('.lang-switch button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLanguage(btn.getAttribute('data-lang'));
      });
    });

    syncNavHeight();
    window.addEventListener('resize', syncNavHeight);
  });
})();
