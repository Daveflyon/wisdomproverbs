(function (global) {
  'use strict';

  var preferredVoice = null;
  var primed = false;

  function pickVoice(synth) {
    if (preferredVoice) return preferredVoice;
    var voices = synth.getVoices();
    if (!voices.length) return null;
    var gb = voices.filter(function (v) { return /^en-GB/i.test(v.lang); });
    var en = voices.filter(function (v) { return /^en/i.test(v.lang); });
    var pool = gb.length ? gb : (en.length ? en : voices);
    preferredVoice = pool.find(function (v) {
      return /google|microsoft|samantha|daniel|karen|moira|fiona|serena|martha|susan|natasha|sonia/i.test(v.name);
    }) || pool[0];
    return preferredVoice;
  }

  function prime(synth) {
    if (primed || !synth) return;
    primed = true;
    synth.getVoices();
    if (typeof synth.onvoiceschanged !== 'undefined') {
      synth.onvoiceschanged = function () { pickVoice(synth); };
    }
    if (synth.paused) synth.resume();
  }

  function speak(synth, text, opts) {
    opts = opts || {};
    if (!synth || !text) {
      if (opts.onEnd) opts.onEnd();
      return null;
    }
    prime(synth);
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang || 'en-GB';
    u.rate = opts.rate != null ? opts.rate : 1;
    var voice = pickVoice(synth);
    if (voice) u.voice = voice;
    u.onend = function () { if (opts.onEnd) opts.onEnd(); };
    u.onerror = function (e) {
      if (e.error !== 'interrupted' && opts.onEnd) opts.onEnd();
    };
    synth.speak(u);
    if (synth.paused) synth.resume();
    return u;
  }

  global.WipTTS = { prime: prime, speak: speak, pickVoice: pickVoice };
})(typeof window !== 'undefined' ? window : this);
