/* Wisdom in Proverbs — shared audio speed (global from index + per-page overrides) */
(function (global) {
  'use strict';

  var GLOBAL_KEY = 'wip-audio-speed-global';
  var PAGE_KEY_PREFIX = 'wip-audio-speed-page-';
  var DEFAULT_RATE = 1;
  var VALID_RATES = [0.5, 1, 1.25, 1.5, 1.75, 2];

  function storageOK() {
    try {
      localStorage.setItem('_wip_test', '1');
      localStorage.removeItem('_wip_test');
      return true;
    } catch (e) {
      return false;
    }
  }

  function normalizeRate(rate) {
    var r = parseFloat(rate);
    if (!isFinite(r)) return DEFAULT_RATE;
    for (var i = 0; i < VALID_RATES.length; i++) {
      if (Math.abs(VALID_RATES[i] - r) < 0.01) return VALID_RATES[i];
    }
    return DEFAULT_RATE;
  }

  function pageIdFromLocation() {
    var path = (global.location && global.location.pathname || '').split('/').pop() || 'index.html';
    if (!path || path === 'index.html') return 'index';
    var m = path.match(/wisdom-proverbs-(s\d+)/i);
    if (m) return m[1].toLowerCase();
    return path.replace(/\.html$/i, '');
  }

  function getGlobal() {
    if (!storageOK()) return DEFAULT_RATE;
    var v = localStorage.getItem(GLOBAL_KEY);
    return v ? normalizeRate(v) : DEFAULT_RATE;
  }

  function setGlobal(rate) {
    rate = normalizeRate(rate);
    if (storageOK()) localStorage.setItem(GLOBAL_KEY, String(rate));
    return rate;
  }

  function getPageOverride(pageId) {
    if (!storageOK()) return null;
    var v = localStorage.getItem(PAGE_KEY_PREFIX + pageId);
    return v ? normalizeRate(v) : null;
  }

  function setPageOverride(pageId, rate) {
    rate = normalizeRate(rate);
    if (storageOK()) localStorage.setItem(PAGE_KEY_PREFIX + pageId, String(rate));
    return rate;
  }

  function getEffectiveRate(pageId, isIndex) {
    pageId = pageId || pageIdFromLocation();
    if (!isIndex) {
      var override = getPageOverride(pageId);
      if (override != null) return override;
    }
    return getGlobal();
  }

  function setRate(rate, opts) {
    opts = opts || {};
    rate = normalizeRate(rate);
    var pageId = opts.pageId || pageIdFromLocation();
    var isIndex = opts.isIndex != null ? opts.isIndex : pageId === 'index';
    if (isIndex) {
      setGlobal(rate);
    } else {
      setPageOverride(pageId, rate);
    }
    return rate;
  }

  function syncButtons(rate, selector) {
    var matched = false;
    document.querySelectorAll(selector || '.audio-speed-btn').forEach(function (btn) {
      var btnRate = parseFloat(btn.dataset.rate);
      var active = Math.abs(btnRate - rate) < 0.01;
      btn.classList.toggle('active', active);
      if (active) matched = true;
    });
    if (!matched) {
      document.querySelectorAll(selector || '.audio-speed-btn').forEach(function (btn) {
        btn.classList.remove('active');
      });
    }
  }

  function syncSelect(rate, selectId) {
    var sel = document.getElementById(selectId || 'read-aloud-speed');
    if (!sel) return;
    for (var i = 0; i < sel.options.length; i++) {
      if (Math.abs(parseFloat(sel.options[i].value) - rate) < 0.01) {
        sel.selectedIndex = i;
        return;
      }
    }
  }

  function wirePanel(opts) {
    opts = opts || {};
    var pageId = opts.pageId || pageIdFromLocation();
    var isIndex = opts.isIndex != null ? opts.isIndex : pageId === 'index';
    var syncReadAloud = opts.syncReadAloud !== false;
    var setRateLocal = opts.setRate || function () {};

    function apply(rate) {
      rate = normalizeRate(rate);
      setRateLocal(rate);
      syncButtons(rate);
      if (syncReadAloud) syncSelect(rate);
      return rate;
    }

    var initial = getEffectiveRate(pageId, isIndex);
    apply(initial);

    document.querySelectorAll('.audio-speed-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(setRate(parseFloat(btn.dataset.rate), { pageId: pageId, isIndex: isIndex }));
      });
    });

    var raSel = document.getElementById('read-aloud-speed');
    if (raSel && syncReadAloud) {
      raSel.addEventListener('change', function () {
        apply(setRate(parseFloat(raSel.value), { pageId: pageId, isIndex: isIndex }));
      });
    }

    return initial;
  }

  global.WipAudioSpeed = {
    DEFAULT_RATE: DEFAULT_RATE,
    getGlobal: getGlobal,
    setGlobal: setGlobal,
    getPageOverride: getPageOverride,
    getEffectiveRate: getEffectiveRate,
    setRate: setRate,
    syncButtons: syncButtons,
    syncSelect: syncSelect,
    wirePanel: wirePanel,
    pageIdFromLocation: pageIdFromLocation
  };
})(typeof window !== 'undefined' ? window : this);
