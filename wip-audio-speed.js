/* Wisdom in Proverbs — shared audio speed (index sets global; sections may override until index changes) */
(function (global) {
  'use strict';

  var GLOBAL_KEY = 'wip-audio-speed-global';
  var GLOBAL_EPOCH_KEY = 'wip-audio-speed-global-epoch';
  var PAGES_KEY = 'wip-audio-speed-pages';
  var PAGE_KEY_PREFIX = 'wip-audio-speed-page-';
  var DEFAULT_RATE = 1;
  var VALID_RATES = [0.5, 1, 1.25, 1.5, 1.75, 2];
  var PANEL_RATES = [1, 1.25, 1.5, 1.75, 2];

  function formatRateLabel(rate) {
    var r = normalizeRate(rate);
    if (Math.abs(r - Math.round(r)) < 0.001) return r.toFixed(1) + 'x';
    return r + 'x';
  }

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

  function getGlobalEpoch() {
    if (!storageOK()) return 0;
    var n = parseInt(localStorage.getItem(GLOBAL_EPOCH_KEY) || '0', 10);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  function bumpGlobalEpoch() {
    if (!storageOK()) return 0;
    var next = getGlobalEpoch() + 1;
    localStorage.setItem(GLOBAL_EPOCH_KEY, String(next));
    return next;
  }

  function getGlobal() {
    if (!storageOK()) return DEFAULT_RATE;
    var v = localStorage.getItem(GLOBAL_KEY);
    return v ? normalizeRate(v) : DEFAULT_RATE;
  }

  function readPagesMap() {
    if (!storageOK()) return {};
    try {
      var raw = localStorage.getItem(PAGES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writePagesMap(map) {
    if (!storageOK()) return;
    if (!map || !Object.keys(map).length) {
      localStorage.removeItem(PAGES_KEY);
    } else {
      localStorage.setItem(PAGES_KEY, JSON.stringify(map));
    }
  }

  function removeLegacyPageKeys() {
    if (!storageOK()) return;
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(PAGE_KEY_PREFIX) === 0) keys.push(key);
    }
    keys.forEach(function (key) { localStorage.removeItem(key); });
  }

  function migrateLegacyOverrides(map) {
    if (!storageOK()) return map;
    var changed = false;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key.indexOf(PAGE_KEY_PREFIX) !== 0) continue;
      var pageId = key.slice(PAGE_KEY_PREFIX.length);
      if (!pageId || map[pageId]) continue;
      var v = localStorage.getItem(key);
      if (v == null) continue;
      map[pageId] = { rate: normalizeRate(v), epoch: getGlobalEpoch() };
      changed = true;
    }
    if (changed) writePagesMap(map);
    removeLegacyPageKeys();
    return map;
  }

  function clearAllPageOverrides() {
    if (!storageOK()) return;
    localStorage.removeItem(PAGES_KEY);
    removeLegacyPageKeys();
  }

  function setGlobal(rate, bumpEpoch) {
    rate = normalizeRate(rate);
    if (storageOK()) {
      localStorage.setItem(GLOBAL_KEY, String(rate));
      if (bumpEpoch !== false) bumpGlobalEpoch();
    }
    return rate;
  }

  function getPageOverride(pageId) {
    if (!storageOK()) return null;
    var map = migrateLegacyOverrides(readPagesMap());
    var entry = map[pageId];
    if (!entry) return null;
    var rate = normalizeRate(entry.rate != null ? entry.rate : entry);
    var epoch = entry.epoch != null ? entry.epoch : 0;
    if (epoch < getGlobalEpoch()) return null;
    return rate;
  }

  function setPageOverride(pageId, rate) {
    rate = normalizeRate(rate);
    if (!storageOK()) return rate;
    var map = migrateLegacyOverrides(readPagesMap());
    map[pageId] = { rate: rate, epoch: getGlobalEpoch() };
    writePagesMap(map);
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
      setGlobal(rate, false);
      clearAllPageOverrides();
      bumpGlobalEpoch();
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

  function closeSpeedMenu(menu, btn) {
    if (!menu) return;
    menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function syncDropdown(rate) {
    var face = document.getElementById('audio-speed-face');
    var menu = document.getElementById('audio-speed-menu');
    if (face) face.textContent = formatRateLabel(rate);
    if (!menu) return;
    var matched = false;
    menu.querySelectorAll('[data-rate]').forEach(function (item) {
      var itemRate = parseFloat(item.dataset.rate);
      var active = Math.abs(itemRate - rate) < 0.01;
      item.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) matched = true;
    });
    if (!matched) {
      menu.querySelectorAll('[data-rate]').forEach(function (item) {
        item.setAttribute('aria-selected', 'false');
      });
    }
  }

  function wireSpeedDropdown(opts, apply) {
    var dropBtn = document.getElementById('audio-speed-drop-btn');
    var menu = document.getElementById('audio-speed-menu');
    if (!dropBtn || !menu) return false;

    function toggleMenu(open) {
      var isOpen = open != null ? open : menu.hidden;
      menu.hidden = !isOpen;
      dropBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    dropBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu(menu.hidden);
    });

    menu.querySelectorAll('[data-rate]').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        var chosen = parseFloat(item.dataset.rate);
        apply(chosen, false);
        closeSpeedMenu(menu, dropBtn);
      });
    });

    document.addEventListener('click', function () {
      closeSpeedMenu(menu, dropBtn);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSpeedMenu(menu, dropBtn);
    });

    return true;
  }

  function wirePanel(opts) {
    opts = opts || {};
    var pageId = opts.pageId || pageIdFromLocation();
    var isIndex = opts.isIndex != null ? opts.isIndex : pageId === 'index';
    var syncReadAloud = opts.syncReadAloud !== false;
    var setRateLocal = opts.setRate || function () {};

    function apply(rate, fromStorage) {
      if (fromStorage) {
        rate = getEffectiveRate(pageId, isIndex);
      } else {
        rate = normalizeRate(rate);
      }
      setRateLocal(rate);
      syncDropdown(rate);
      syncButtons(rate);
      if (syncReadAloud) syncSelect(rate);
      return rate;
    }

    apply(null, true);

    var hasDropdown = wireSpeedDropdown(opts, function (chosen) {
      if (isIndex) {
        apply(setRate(chosen, { pageId: pageId, isIndex: true }));
      } else {
        apply(setRate(chosen, { pageId: pageId, isIndex: false }));
      }
    });

    if (!hasDropdown) {
      document.querySelectorAll('.audio-speed-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var chosen = parseFloat(btn.dataset.rate);
          if (isIndex) {
            apply(setRate(chosen, { pageId: pageId, isIndex: true }));
          } else {
            apply(setRate(chosen, { pageId: pageId, isIndex: false }));
          }
        });
      });
    }

    var raSel = document.getElementById('read-aloud-speed');
    if (raSel && syncReadAloud) {
      raSel.addEventListener('change', function () {
        var chosen = parseFloat(raSel.value);
        if (isIndex) {
          apply(setRate(chosen, { pageId: pageId, isIndex: true }));
        } else {
          apply(setRate(chosen, { pageId: pageId, isIndex: false }));
        }
      });
    }

    global.addEventListener('pageshow', function (e) {
      if (e.persisted) apply(null, true);
    });

    global.addEventListener('storage', function (e) {
      if (!e.key) return;
      if (e.key === GLOBAL_KEY || e.key === PAGES_KEY || e.key === GLOBAL_EPOCH_KEY || e.key.indexOf(PAGE_KEY_PREFIX) === 0) {
        apply(null, true);
      }
    });

    return getEffectiveRate(pageId, isIndex);
  }

  global.WipAudioSpeed = {
    DEFAULT_RATE: DEFAULT_RATE,
    getGlobal: getGlobal,
    getGlobalEpoch: getGlobalEpoch,
    setGlobal: setGlobal,
    getPageOverride: getPageOverride,
    clearAllPageOverrides: clearAllPageOverrides,
    getEffectiveRate: getEffectiveRate,
    setRate: setRate,
    syncButtons: syncButtons,
    syncDropdown: syncDropdown,
    syncSelect: syncSelect,
    formatRateLabel: formatRateLabel,
    PANEL_RATES: PANEL_RATES,
    wirePanel: wirePanel,
    pageIdFromLocation: pageIdFromLocation
  };
})(typeof window !== 'undefined' ? window : this);
