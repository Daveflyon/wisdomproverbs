/* Wisdom in Proverbs — page-level Play Overview / Play Section + per-block Play Block */
(function (global) {
  'use strict';

  var I_PLAY = '<svg width="10" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><polygon points="2,1 11,6 2,11"/></svg>';

  var synth = null;
  var currentRate = 1;
  var playing = false;
  var speakGen = 0;
  var playBtn = null;
  var stopBtn = null;
  var playLabel = 'Play';
  var mediaSessionUI = { sync: function () {} };

  function formatRate(rate) {
    var r = parseFloat(rate);
    if (!isFinite(r)) return '1.0x';
    if (Math.abs(r - Math.round(r)) < 0.001) return r.toFixed(1) + 'x';
    return r + 'x';
  }

  function cleanText(el) {
    if (!el) return '';
    var clone = el.cloneNode(true);
    clone.querySelectorAll(
      'button, select, input, .acc-body-footer, .answers-toolbar, .answers-note, ' +
      '.read-aloud-controls, .flashcard-back, .flashcard-hint, .block-play-btn, ' +
      '.sec-listen-btn, .acc-listen-btn, .body-play-btn'
    ).forEach(function (node) { node.remove(); });
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function chunkText(text, maxLen) {
    maxLen = maxLen || 4000;
    if (!text || text.length <= maxLen) return text ? [text] : [];
    var parts = [];
    var rest = text;
    while (rest.length > maxLen) {
      var cut = rest.lastIndexOf('. ', maxLen);
      if (cut < maxLen * 0.5) cut = maxLen;
      parts.push(rest.slice(0, cut + (rest[cut] === '.' ? 1 : 0)).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    return parts;
  }

  function flattenChunks(chunks) {
    var out = [];
    chunks.forEach(function (c) {
      chunkText(c).forEach(function (p) { if (p) out.push(p); });
    });
    return out;
  }

  function updateUI() {
    if (stopBtn) stopBtn.disabled = !playing;
    if (playBtn) {
      playBtn.classList.toggle('playing', playing);
      playBtn.innerHTML = I_PLAY + ' ' + playLabel;
      playBtn.setAttribute('aria-label', playLabel);
    }
    mediaSessionUI.sync();
  }

  function stop() {
    speakGen++;
    playing = false;
    if (synth) {
      try { if (synth.paused) synth.resume(); } catch (e) {}
      synth.cancel();
    }
    document.querySelectorAll('.block-play-btn.playing').forEach(function (b) {
      b.classList.remove('playing');
    });
    updateUI();
  }

  function speakSequence(texts, onDone) {
    if (!synth || !texts.length) {
      playing = false;
      updateUI();
      if (onDone) onDone();
      return;
    }
    var gen = ++speakGen;
    playing = true;
    updateUI();
    var idx = 0;

    function next() {
      if (gen !== speakGen) return;
      while (idx < texts.length && !(texts[idx] || '').trim()) idx++;
      if (idx >= texts.length) {
        playing = false;
        updateUI();
        if (onDone) onDone();
        return;
      }
      var text = texts[idx++];
      if (global.WipTTS && global.WipTTS.pickVoice) global.WipTTS.prime(synth);
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.rate = currentRate;
      if (global.WipTTS && global.WipTTS.pickVoice) {
        var voice = global.WipTTS.pickVoice(synth);
        if (voice) u.voice = voice;
      }
      u.onend = function () { if (gen === speakGen) next(); };
      u.onerror = function (e) {
        if (gen !== speakGen || e.error === 'interrupted') return;
        next();
      };
      synth.speak(u);
      if (synth.paused) synth.resume();
    }

    try { if (synth.paused) synth.resume(); } catch (e) {}
    synth.cancel();
    next();
  }

  function playChunks(chunks, activeBlockBtn) {
    document.querySelectorAll('.block-play-btn.playing').forEach(function (b) {
      b.classList.remove('playing');
    });
    if (activeBlockBtn) activeBlockBtn.classList.add('playing');
    speakSequence(flattenChunks(chunks), function () {
      if (activeBlockBtn) activeBlockBtn.classList.remove('playing');
    });
  }

  function buildSectionChunks() {
    var chunks = [];
    ['#opening-q', '.key-scripture', '.core-truth-box'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      var t = cleanText(el);
      if (t) chunks.push(t);
    });
    document.querySelectorAll('.acc-unit').forEach(function (unit) {
      if (unit.id === 'unit-scripture') return;
      var titleEl = unit.querySelector('.acc-title');
      var body = unit.querySelector('.acc-body');
      var title = titleEl ? titleEl.textContent.trim() : '';
      var bodyText = cleanText(body);
      var combined = (title ? title + '. ' : '') + bodyText;
      if (combined.trim()) chunks.push(combined.trim());
    });
    return chunks;
  }

  function buildIndexChunks() {
    var chunks = [];
    document.querySelectorAll(
      '.title-block, .key-verse, .proverb-feature, .bridge-note, #about-body, h2, .group-card'
    ).forEach(function (el) {
      var t = cleanText(el);
      if (t) chunks.push(t);
    });
    return chunks;
  }

  function injectBlockPlayButtons() {
    document.querySelectorAll('.acc-unit').forEach(function (unit) {
      if (unit.id === 'unit-scripture') return;
      var body = unit.querySelector('.acc-body');
      if (!body || body.querySelector('.block-play-btn')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'block-play-btn';
      btn.setAttribute('aria-label', 'Play this block');
      btn.innerHTML = I_PLAY + ' Play Block';
      body.insertBefore(btn, body.firstChild);
      btn.addEventListener('click', function () {
        var titleEl = unit.querySelector('.acc-title');
        var title = titleEl ? titleEl.textContent.trim() : '';
        var bodyText = cleanText(body);
        var combined = (title ? title + '. ' : '') + bodyText;
        stop();
        playChunks([combined], btn);
      });
    });
  }

  function wireControls(isIndex) {
    playBtn = document.getElementById('btn-play-main');
    stopBtn = document.getElementById('btn-stop-main');
    playLabel = isIndex ? 'Play Overview' : 'Play Section';
    if (!playBtn || !stopBtn) return false;

    playBtn.addEventListener('click', function () {
      stop();
      var chunks = isIndex ? buildIndexChunks() : buildSectionChunks();
      playChunks(chunks, null);
    });

    stopBtn.addEventListener('click', function () { stop(); });

    if (global.WipAudioSpeed) {
      currentRate = global.WipAudioSpeed.wirePanel({
        isIndex: isIndex,
        syncReadAloud: false,
        setRate: function (r) { currentRate = r; }
      });
    }

    if (global.WipMediaSession) {
      mediaSessionUI = global.WipMediaSession.bind({
        isActive: function () { return playing; },
        isPaused: function () { return false; },
        getMetadata: function () {
          if (!playing) return null;
          return {
            title: isIndex ? 'Series Overview' : (document.querySelector('h1') || {}).textContent || 'Section',
            artist: 'Hiturn Media Group',
            album: 'Wisdom in Proverbs'
          };
        },
        onPlay: function () {
          if (!playing && playBtn) playBtn.click();
        },
        onPause: function () { stop(); },
        onStop: function () { stop(); }
      });
    }

    updateUI();
    return true;
  }

  function initCommon(isIndex) {
    synth = global.speechSynthesis;
    if (!synth) {
      var inner = document.querySelector('.audio-inner');
      if (inner) {
        var note = document.createElement('p');
        note.style.cssText = 'font-size:12px;color:#8b0000;margin:0;white-space:nowrap;';
        note.textContent = 'Audio not supported. Try Chrome or Edge.';
        inner.appendChild(note);
      }
      return;
    }
    if (global.WipTTS) global.WipTTS.prime(synth);
    if (!wireControls(isIndex)) return;
    if (!isIndex) injectBlockPlayButtons();
  }

  function initIndex() { initCommon(true); }
  function initSection() { initCommon(false); }

  function autoInit() {
    if (document.querySelector('.acc-unit')) initSection();
    else if (document.getElementById('btn-play-main')) initIndex();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  global.WipPageAudio = {
    initIndex: initIndex,
    initSection: initSection,
    stop: stop,
    formatRate: formatRate
  };
})(typeof window !== 'undefined' ? window : this);
