/* WP shared navigation + audio (wisdomproverbs) */
(function () {
  'use strict';

  var I_PLAY = '\u25B6';
  var I_PAUSE = '\u23F8';
  var SPEED_KEY = 'wp-audio-rate';
  var VALID_RATES = [1, 1.25, 1.5, 1.75, 2];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function storageOK() {
    try {
      localStorage.setItem('_wp_t', '1');
      localStorage.removeItem('_wp_t');
      return true;
    } catch (e) {
      return false;
    }
  }

  function getStoredRate() {
    if (!storageOK()) return 1.5;
    var r = parseFloat(localStorage.getItem(SPEED_KEY));
    return VALID_RATES.indexOf(r) >= 0 ? r : 1.5;
  }

  function setStoredRate(rate) {
    if (storageOK()) localStorage.setItem(SPEED_KEY, String(rate));
  }

  function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function extractSectionText(root) {
    if (!root) return '';
    var clone = root.cloneNode(true);
    clone.querySelectorAll(
      'button, select, input, textarea, .answers-toolbar, .answers-note, .flashcard-hint, .flashcard-back, .wp-minimise-btn, .wp-play-bar, .wp-play-section-btn, .toc-container, script, style'
    ).forEach(function (el) { el.remove(); });
    return cleanText(clone.textContent || '');
  }

  var SPEAK_SKIP_SEL = 'button, select, input, textarea, .answers-toolbar, .answers-note, .flashcard-hint, .flashcard-back, .wp-minimise-btn, .wp-play-bar, .wp-play-section-btn, .read-aloud-controls, .scripture-entry, .acc-body-footer, #toc-container, script, style';

  function isSpeakSkipped(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    while (el) {
      if (el.nodeType === 1 && el.matches && el.matches(SPEAK_SKIP_SEL)) return true;
      el = el.parentElement;
    }
    return false;
  }

  function splitSentences(text) {
    var sentences = [];
    if (!text) return sentences;
    var re = /[^.!?]+(?:[.!?]+|$)/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var start = m.index;
      var end = m.index + m[0].length;
      sentences.push({
        start: start,
        end: end,
        text: text.substring(start, end).replace(/\s+/g, ' ').trim()
      });
    }
    if (!sentences.length) {
      sentences.push({ start: 0, end: text.length, text: cleanText(text) });
    }
    return sentences;
  }

  function isInSectionHeading(node, root) {
    var el = node.parentElement;
    while (el && el !== root) {
      if (el.matches && (
        el.matches('h2') ||
        el.matches('.section-toggle') ||
        el.matches('.acc-btn') ||
        el.matches('.accordion-btn') ||
        el.matches('.part-btn') ||
        el.matches('.how-to-btn')
      )) return true;
      el = el.parentElement;
    }
    return false;
  }

  function extractSectionBodyText(section) {
    var body = $('.acc-body', section) || $('.section-body', section);
    if (body) return extractSectionText(body);
    var clone = section.cloneNode(true);
    var heading = $('h2', clone) || $('.section-toggle', clone) || $('.acc-btn', clone);
    if (heading) heading.remove();
    return extractSectionText(clone);
  }

  function collectSpeakTextNodes(root, skipHeading) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (isSpeakSkipped(node)) return NodeFilter.FILTER_REJECT;
        if (skipHeading && isInSectionHeading(node, root)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }

  function buildFlatSpeakText(root, skipHeading) {
    var textNodes = collectSpeakTextNodes(root, !!skipHeading);
    var raw = '';
    var nodeStarts = [];
    textNodes.forEach(function (n) {
      nodeStarts.push({ n: n, rawStart: raw.length });
      raw += n.textContent;
    });
    var text = cleanText(raw);

    var normToRaw = [];
    var ni = 0;
    var ri = 0;
    while (ni < text.length) {
      normToRaw[ni] = Math.min(ri, Math.max(0, raw.length - 1));
      if (ri >= raw.length) {
        ni++;
        continue;
      }
      var nc = text.charAt(ni);
      var rc = raw.charAt(ri);
      if (nc === rc) {
        ni++;
        ri++;
      } else if (/\s/.test(rc)) {
        ri++;
      } else {
        ni++;
        ri++;
      }
    }

    function indexToNode(normIdx) {
      if (normIdx < 0) return null;
      if (normIdx >= normToRaw.length) normIdx = normToRaw.length - 1;
      if (normIdx < 0) return null;
      var rawIdx = normToRaw[normIdx];
      for (var i = nodeStarts.length - 1; i >= 0; i--) {
        if (rawIdx >= nodeStarts[i].rawStart) {
          var node = nodeStarts[i].n;
          var offset = rawIdx - nodeStarts[i].rawStart;
          return { n: node, offset: Math.min(offset, node.textContent.length) };
        }
      }
      return null;
    }

    return { text: text, indexToNode: indexToNode };
  }

  function buildFlatSpeakTextForSection(section) {
    var body = $('.acc-body', section) || $('.section-body', section);
    if (body) return { flat: buildFlatSpeakText(body, false), root: body };
    return { flat: buildFlatSpeakText(section, true), root: section };
  }

  function blocksForNormRange(flat, contentRoot, start, end) {
    var blocks = [];
    var points = [start];
    if (end > start + 1) {
      points.push(end - 1);
      points.push(Math.floor((start + end) / 2));
    }
    points.forEach(function (pos) {
      var b = blockAtNormIndex(flat, contentRoot, pos);
      if (b && blocks.indexOf(b) < 0) blocks.push(b);
    });
    return blocks;
  }

  function blockAtNormIndex(flat, contentRoot, normIdx) {
    var info = flat.indexToNode(normIdx);
    if (!info) return null;
    var el = info.n.parentElement;
    while (el && el !== contentRoot) {
      if (el.matches && el.matches(
        'h3, h4, p, li, .scripture-text, .scripture-ref, .core-truth-statement, .core-truth-label, .question-text, .oq-text, .ks-text, .kdq-text, .wisdom-summary, td, .callout, blockquote, th'
      )) return el;
      el = el.parentElement;
    }
    el = info.n.parentElement;
    while (el && el !== contentRoot) {
      if (el.matches && el.matches('.opening-box, .opening-question, .key-scripture, .scripture-block, .core-truth-box, .crib-inner')) return el;
      el = el.parentElement;
    }
    return info.n.parentElement;
  }

  function wrapNormSpan(flat, start, end) {
    if (start < 0 || end <= start || end > flat.text.length) return null;
    var startInfo = flat.indexToNode(start);
    var endInfo = flat.indexToNode(end - 1);
    if (!startInfo || !endInfo) return null;
    try {
      var range = document.createRange();
      range.setStart(startInfo.n, startInfo.offset);
      var endOffset = endInfo.offset + 1;
      if (endInfo.n.textContent && endOffset > endInfo.n.textContent.length) {
        endOffset = endInfo.n.textContent.length;
      }
      range.setEnd(endInfo.n, endOffset);
      var mark = document.createElement('mark');
      mark.className = 'wp-read-sentence';
      range.surroundContents(mark);
      return mark;
    } catch (e) {
      return null;
    }
  }

  function snapToSentenceStart(text, charIndex) {
    if (!text || charIndex <= 0) return 0;
    var sentences = splitSentences(text);
    for (var i = sentences.length - 1; i >= 0; i--) {
      if (charIndex >= sentences[i].start) return sentences[i].start;
    }
    return 0;
  }

  function unwrapReadMark(mark) {
    if (!mark || !mark.parentNode) return;
    var parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }

  function clearSectionHighlights(sec) {
    if (!sec || !sec.el) return;
    if (sec._wpActiveMark) {
      unwrapReadMark(sec._wpActiveMark);
      sec._wpActiveMark = null;
    }
    sec.el.querySelectorAll('.wp-read-sentence').forEach(function (mark) {
      unwrapReadMark(mark);
    });
    sec.el.querySelectorAll('.wp-reading-active').forEach(function (el) {
      el.classList.remove('wp-reading-active');
    });
    sec._wpLastHighlightEl = null;
    sec._wpActiveSentenceIdx = -1;
    sec._wpSentences = null;
    sec._wpHighlightTargets = null;
  }

  function deactivateReadHighlight(sec) {
    if (!sec) return;
    if (sec._wpActiveMark) {
      sec._wpActiveMark.classList.remove('wp-read-active');
      sec._wpActiveMark = null;
    }
    if (sec._wpActiveBlocks) {
      sec._wpActiveBlocks.forEach(function (b) {
        b.classList.remove('wp-reading-active');
      });
      sec._wpActiveBlocks = null;
    }
    if (sec._wpLastHighlightEl) {
      sec._wpLastHighlightEl.classList.remove('wp-reading-active');
      sec._wpLastHighlightEl = null;
    }
    sec._wpActiveSentenceIdx = -1;
  }

  function prepareSectionHighlights(sec, fullText) {
    clearSectionHighlights(sec);
    if (!sec || !sec.el || !fullText) return;

    var sentences = splitSentences(fullText);
    sec._wpSentences = sentences;

    var headingEl = $('h2', sec.el) || $('.section-toggle', sec.el) || $('.acc-btn', sec.el);
    var bodyWrap = buildFlatSpeakTextForSection(sec.el);
    var bodyFlat = bodyWrap.flat;
    var contentRoot = bodyWrap.root;
    var titleLen = sec.title ? cleanText(sec.title + '. ').length : 0;
    var targets = [];

    sentences.forEach(function (sent, i) {
      var target = { mark: null, block: null, blocks: [] };
      if (sent.start < titleLen && headingEl) {
        target.block = headingEl;
        target.blocks = [headingEl];
      } else {
        var bodyStart = sent.start - titleLen;
        var bodyEnd = sent.end - titleLen;
        if (bodyStart >= 0 && bodyEnd <= bodyFlat.text.length) {
          target.blocks = blocksForNormRange(bodyFlat, contentRoot, bodyStart, bodyEnd);
          target.block = target.blocks[0] || null;
        }
      }
      targets[i] = target;
    });

    for (var j = sentences.length - 1; j >= 0; j--) {
      var sentJ = sentences[j];
      if (sentJ.start < titleLen) continue;
      var bStart = sentJ.start - titleLen;
      var bEnd = sentJ.end - titleLen;
      if (bStart < 0 || bEnd > bodyFlat.text.length) continue;
      var mark = wrapNormSpan(bodyFlat, bStart, bEnd);
      if (mark) targets[j].mark = mark;
    }

    sec._wpHighlightTargets = targets;
  }

  function updateReadHighlight(sec, fullText, charIndex) {
    if (!sec || !sec.el) return;
    var sentences = sec._wpSentences;
    if (!sentences || !sec._wpHighlightTargets) return;

    var activeIdx = -1;
    for (var i = 0; i < sentences.length; i++) {
      if (charIndex >= sentences[i].start && charIndex < sentences[i].end) {
        activeIdx = i;
        break;
      }
    }
    if (activeIdx < 0) {
      if (charIndex >= fullText.length && sentences.length) activeIdx = sentences.length - 1;
      else return;
    }
    if (sec._wpActiveSentenceIdx === activeIdx) return;

    deactivateReadHighlight(sec);
    sec._wpActiveSentenceIdx = activeIdx;

    var target = sec._wpHighlightTargets[activeIdx];
    if (!target) return;

    var scrollEl = null;
    if (target.mark) {
      target.mark.classList.add('wp-read-active');
      sec._wpActiveMark = target.mark;
      scrollEl = target.mark;
    } else if (target.blocks && target.blocks.length) {
      sec._wpActiveBlocks = [];
      target.blocks.forEach(function (b) {
        b.classList.add('wp-reading-active');
        sec._wpActiveBlocks.push(b);
      });
      scrollEl = target.blocks[0];
    } else if (target.block) {
      target.block.classList.add('wp-reading-active');
      sec._wpLastHighlightEl = target.block;
      scrollEl = target.block;
    } else {
      for (var k = activeIdx; k >= 0; k--) {
        var prev = sec._wpHighlightTargets[k];
        if (prev && prev.blocks && prev.blocks.length) {
          sec._wpActiveBlocks = [];
          prev.blocks.forEach(function (b) {
            b.classList.add('wp-reading-active');
            sec._wpActiveBlocks.push(b);
          });
          scrollEl = prev.blocks[0];
          break;
        }
        if (prev && prev.block) {
          prev.block.classList.add('wp-reading-active');
          sec._wpLastHighlightEl = prev.block;
          scrollEl = prev.block;
          break;
        }
      }
    }
    if (scrollEl) scrollToView(scrollEl);
  }

  function bindInteractive(btn, handler) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      handler(e);
    });
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function scrollToView(el) {
    if (!el || !el.scrollIntoView) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }

  function formatSpeedLabel(rate) {
    if (rate === 1) return '1.0x';
    if (rate === 2) return '2.0x';
    return String(rate) + 'x';
  }

  function initSpeedDropdown(setRate) {
    var dropdown = $('.wp-speed-dropdown');
    var toggle = $('#wp-speed-toggle');
    var menu = $('#wp-speed-menu');
    var valueEl = $('.wp-speed-value');
    var options = $$('.wp-speed-option');
    if (!dropdown || !toggle || !menu) return;

    var rate = getStoredRate();

    function applyRate(chosen) {
      setStoredRate(chosen);
      setRate(chosen);
      if (valueEl) valueEl.textContent = formatSpeedLabel(chosen);
      options.forEach(function (opt) {
        var selected = parseFloat(opt.dataset.rate) === chosen;
        opt.classList.toggle('active', selected);
        opt.setAttribute('aria-selected', String(selected));
      });
    }

    function closeMenu() {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }

    applyRate(rate);

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.hidden) openMenu();
      else closeMenu();
    });

    options.forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        applyRate(parseFloat(opt.dataset.rate));
        closeMenu();
      });
    });

    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) {
        closeMenu();
        toggle.focus();
      }
    });
  }

  function createPlayButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wp-play-section-btn wp-on-light';
    btn.innerHTML = I_PLAY + ' Play Section';
    return btn;
  }

  function addPlayBar(container, collapsible) {
    var playBtn = createPlayButton();
    var bar = document.createElement('div');
    bar.className = collapsible ? 'wp-play-bar' : 'wp-play-bar wp-play-always';
    bar.appendChild(playBtn);
    container.insertBefore(bar, container.firstChild);
    return playBtn;
  }

  function removePlaySectionUI(root) {
    var scope = root || document;
    scope.querySelectorAll('.wp-play-bar').forEach(function (el) { el.remove(); });
    scope.querySelectorAll('.wp-play-section-btn').forEach(function (el) { el.remove(); });
  }

  function getLessonIntro() {
    var meta = document.getElementById('wp-lesson-meta');
    if (!meta) return '';
    try {
      return JSON.parse(meta.textContent).intro || '';
    } catch (e) {
      return '';
    }
  }

  function getIndexIntro() {
    var meta = document.getElementById('wp-index-meta');
    if (!meta) return '';
    try {
      return JSON.parse(meta.textContent).intro || '';
    } catch (e) {
      return '';
    }
  }

  function initLessonNav() {
    $$('.acc-unit').forEach(function (unit) {
      if (unit.id === 'unit-scripture') return;
      var body = $('.acc-body', unit);
      if (!body || body.querySelector('.wp-play-bar')) return;
      unit._wpPlayBtn = addPlayBar(body, true);
    });
  }

  function initLessonPage() {
    initLessonNav();

    var sections = [];
    var intro = getLessonIntro();
    var titleBlock = document.getElementById('title-block');

    if (intro) {
      sections.push({
        el: titleBlock || document.body,
        scrollEl: titleBlock,
        title: 'Introduction',
        playBtn: null,
        open: function () {
          if (titleBlock) scrollToView(titleBlock);
        },
        close: function () {},
        isOpen: function () { return true; },
        getText: function () { return intro; }
      });
    }

    var opening = document.getElementById('opening-q');
    if (opening) {
      sections.push({
        el: opening,
        scrollEl: opening,
        title: 'Opening Question',
        playBtn: null,
        open: function () { scrollToView(opening); },
        close: function () {},
        isOpen: function () { return true; },
        getText: function () { return extractSectionText(opening); }
      });
    }

    var ks = document.querySelector('.key-scripture');
    if (ks) {
      sections.push({
        el: ks,
        scrollEl: ks,
        title: 'Key Scripture',
        playBtn: null,
        open: function () { scrollToView(ks); },
        close: function () {},
        isOpen: function () { return true; },
        getText: function () { return extractSectionText(ks); }
      });
    }

    var ct = document.querySelector('.core-truth-box');
    if (ct) {
      sections.push({
        el: ct,
        scrollEl: ct,
        title: 'Core Truth',
        playBtn: null,
        open: function () { scrollToView(ct); },
        close: function () {},
        isOpen: function () { return true; },
        getText: function () { return extractSectionText(ct); }
      });
    }

    $$('.acc-unit').forEach(function (unit) {
      if (unit.id === 'unit-scripture') return;
      var btn = $('.acc-btn', unit);
      var body = $('.acc-body', unit);
      if (!btn || !body) return;
      var titleEl = $('.acc-title', unit);
      var title = titleEl ? cleanText(titleEl.textContent) : unit.id;
      sections.push({
        el: unit,
        scrollEl: unit,
        title: title,
        playBtn: unit._wpPlayBtn || null,
        open: function () {
          body.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        },
        close: function () {
          body.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        },
        isOpen: function () {
          return body.classList.contains('open');
        },
        getText: function () {
          return extractSectionText(body);
        }
      });
    });

    sections.forEach(function (sec) {
      if (sec.playBtn) {
        sec.playBtn.innerHTML = I_PLAY + ' Play Section';
        sec.playBtn.setAttribute('aria-label', 'Play ' + sec.title + ' section');
      }
    });

    createAudioEngine({ sections: sections, mainLabel: 'Play Lesson', wholeLesson: true });
  }

  function initIndexPage() {
    removePlaySectionUI(document.body);

    var sections = [];
    var intro = getIndexIntro();
    var titleBlock = document.querySelector('.title-block');

    if (intro) {
      sections.push({
        el: titleBlock || document.body,
        scrollEl: titleBlock,
        title: 'Series Introduction',
        playBtn: null,
        open: function () {
          if (titleBlock) scrollToView(titleBlock);
        },
        close: function () {},
        isOpen: function () { return true; },
        getText: function () { return intro; }
      });
    }

    var kv = document.querySelector('.key-verse');
    if (kv) {
      sections.push({
        el: kv,
        scrollEl: kv,
        title: 'Key Verse',
        playBtn: null,
        open: function () { scrollToView(kv); },
        close: function () {},
        isOpen: function () { return true; },
        getText: function () { return extractSectionText(kv); }
      });
    }

    var bridge = document.querySelector('.bridge-note');
    if (bridge) {
      sections.push({
        el: bridge,
        scrollEl: bridge,
        title: 'Series Overview',
        playBtn: null,
        open: function () { scrollToView(bridge); },
        close: function () {},
        isOpen: function () { return true; },
        getText: function () { return extractSectionText(bridge); }
      });
    }

    var aboutBody = document.getElementById('about-body');
    var aboutBtn = document.getElementById('about-btn');
    if (aboutBody && aboutBtn) {
      sections.push({
        el: aboutBody,
        scrollEl: aboutBtn,
        title: 'How to Use this Series',
        playBtn: null,
        open: function () {
          aboutBody.classList.add('open');
          aboutBtn.setAttribute('aria-expanded', 'true');
        },
        close: function () {
          aboutBody.classList.remove('open');
          aboutBtn.setAttribute('aria-expanded', 'false');
        },
        isOpen: function () {
          return aboutBody.classList.contains('open');
        },
        getText: function () { return extractSectionText(aboutBody); }
      });
    }

    $$('.section-item').forEach(function (item) {
      var link = $('.section-link', item);
      var desc = $('.section-desc', item);
      var title = link ? cleanText(link.textContent) : 'Section';
      var bodyText = title;
      if (desc) bodyText += '. ' + cleanText(desc.textContent);
      sections.push({
        el: item,
        scrollEl: item,
        title: title,
        playBtn: null,
        open: function () { scrollToView(item); },
        close: function () {},
        isOpen: function () { return true; },
        getText: function () { return bodyText; }
      });
    });

    createAudioEngine({
      sections: sections,
      mainLabel: 'Play Overview',
      wholeLesson: true,
      progressLabel: 'Overview'
    });
  }

  function sectionScrollEl(sec) {
    return (sec && sec.scrollEl) ? sec.scrollEl : sec.el;
  }

  function createAudioEngine(opts) {
    var synth = window.speechSynthesis;
    var sections = opts.sections;
    var mainLabel = opts.mainLabel;
    var progressLabel = opts.progressLabel || (opts.wholeLesson ? 'Lesson' : null);
    var wholeLessonMode = !!opts.wholeLesson;
    var currentRate = 1;
    var currentSec = null;
    var playAllActive = false;
    var playAllIndex = 0;
    var isPaused = false;
    var gen = 0;
    var spotlightSaved = null;
    var spotlightCurrent = null;
    var wholeLessonCurrentSec = null;
    var wholeLessonFullText = '';
    var wholeLessonSpeakOffset = 0;
    var wholeLessonPauseChar = 0;
    var wholeLessonSentenceIdx = 0;
    var wholeLessonPrevSec = null;
    var activeSpeakSec = null;
    var sectionSpeakDone = null;

    var mainBtn = $('#wp-btn-play-main');
    var stopBtn = $('#wp-btn-stop');
    var progressEl = $('#wp-audio-progress');

    function sectionText(sec) {
      var body = sec.getText ? sec.getText() : extractSectionText(sec.el);
      return cleanText((sec.title ? sec.title + '. ' : '') + body);
    }

    function updateUI() {
      var active = !!currentSec;
      if (stopBtn) stopBtn.disabled = !active;

      if (mainBtn) {
        if (!active) {
          mainBtn.innerHTML = I_PLAY + ' ' + mainLabel;
          mainBtn.setAttribute('aria-label', mainLabel);
        } else if (playAllActive && !isPaused) {
          mainBtn.innerHTML = I_PAUSE + ' Pause';
          mainBtn.setAttribute('aria-label', 'Pause');
        } else if (playAllActive && isPaused) {
          mainBtn.innerHTML = I_PLAY + ' Resume';
          mainBtn.setAttribute('aria-label', 'Resume');
        } else {
          mainBtn.innerHTML = I_PLAY + ' ' + mainLabel;
          mainBtn.setAttribute('aria-label', mainLabel);
        }
      }

      if (progressEl) {
        if (!active) {
          progressEl.textContent = '';
        } else if (wholeLessonMode && playAllActive) {
          progressEl.textContent = (isPaused ? 'Paused: ' : 'Playing: ') + (progressLabel || 'Lesson');
        } else {
          var idx = sections.indexOf(currentSec);
          var loc = playAllActive && idx >= 0
            ? 'Section ' + (idx + 1) + ' of ' + sections.length
            : currentSec.title;
          progressEl.textContent = (isPaused ? 'Paused: ' : 'Playing: ') + loc;
        }
      }

      sections.forEach(function (sec) {
        if (!sec.playBtn) return;
        if (wholeLessonMode && playAllActive) {
          sec.playBtn.innerHTML = I_PLAY + ' Play Section';
          sec.playBtn.classList.remove('wp-btn-active');
          if (sec.el) sec.el.classList.remove('wp-section-playing');
          return;
        }
        if (currentSec === sec) {
          sec.playBtn.innerHTML = (isPaused ? I_PLAY + ' Resume' : I_PAUSE + ' Pause');
          sec.playBtn.classList.add('wp-btn-active');
          if (sec.el) sec.el.classList.add('wp-section-playing');
        } else {
          sec.playBtn.innerHTML = I_PLAY + ' Play Section';
          sec.playBtn.classList.remove('wp-btn-active');
          if (sec.el) sec.el.classList.remove('wp-section-playing');
        }
      });
    }

    function saveSpotlightStates() {
      if (!wholeLessonMode) return;
      spotlightSaved = sections.map(function (sec) {
        return sec.isOpen ? sec.isOpen() : true;
      });
    }

    function restoreSpotlightStates() {
      if (!wholeLessonMode || !spotlightSaved) return;
      sections.forEach(function (sec, i) {
        if (spotlightSaved[i]) {
          if (sec.open) sec.open();
        } else if (sec.close) {
          sec.close();
        }
      });
      spotlightSaved = null;
      spotlightCurrent = null;
    }

    function spotlightSection(sec) {
      if (!wholeLessonMode || !playAllActive) return;
      if (spotlightCurrent && spotlightCurrent !== sec && spotlightCurrent.close) {
        spotlightCurrent.close();
      }
      if (sec.open) sec.open();
      scrollToView(sectionScrollEl(sec));
      spotlightCurrent = sec;
    }

    function finishSectionSpeech(sec) {
      deactivateReadHighlight(sec);
      clearSectionHighlights(sec);
      var done = sectionSpeakDone;
      sectionSpeakDone = null;
      activeSpeakSec = null;
      if (!playAllActive) {
        currentSec = null;
        updateUI();
      }
      if (done) done();
    }

    function startSectionSpeech(sec, fromChar, reuseMap) {
      if (!sec || isPaused) return false;
      activeSpeakSec = sec;
      wholeLessonCurrentSec = sec;
      wholeLessonFullText = sectionText(sec);
      if (!reuseMap || !sec._wpHighlightTargets) {
        prepareSectionHighlights(sec, wholeLessonFullText);
      }
      wholeLessonSpeakOffset = fromChar > 0 ? fromChar : 0;
      wholeLessonSentenceIdx = 0;
      if (wholeLessonSpeakOffset > 0) {
        var snap = snapToSentenceStart(wholeLessonFullText, wholeLessonSpeakOffset);
        var sents = sec._wpSentences || [];
        for (var i = 0; i < sents.length; i++) {
          if (snap >= sents[i].start) wholeLessonSentenceIdx = i;
        }
      }
      speakSentenceAtIndex(sec, wholeLessonSentenceIdx);
      return true;
    }

    function speakSentenceAtIndex(sec, sentenceIdx) {
      if (!sec || isPaused || !synth) return;
      var sentences = sec._wpSentences;
      if (!sentences) return;
      if (sentenceIdx >= sentences.length) {
        if (playAllActive && !isPaused) playNext();
        else finishSectionSpeech(sec);
        return;
      }

      wholeLessonSentenceIdx = sentenceIdx;
      var sent = sentences[sentenceIdx];
      wholeLessonPauseChar = sent.start;
      updateReadHighlight(sec, wholeLessonFullText, sent.start);

      gen++;
      var myGen = gen;
      isPaused = false;
      if (synth) {
        try {
          if (synth.paused) synth.resume();
        } catch (e) {}
        synth.cancel();
      }

      var u = new SpeechSynthesisUtterance(sent.text);
      u.lang = 'en-GB';
      u.rate = currentRate;
      u.onend = function () {
        if (myGen !== gen) return;
        deactivateReadHighlight(sec);
        if (!isPaused) speakSentenceAtIndex(sec, sentenceIdx + 1);
      };
      u.onerror = function (e) {
        if (myGen !== gen || e.error === 'interrupted') return;
        deactivateReadHighlight(sec);
        if (!isPaused) speakSentenceAtIndex(sec, sentenceIdx + 1);
      };
      synth.speak(u);
    }

    function speakWholeLessonSection(sec, fromChar, reuseMap) {
      if (!sec || !playAllActive || isPaused) return;
      startSectionSpeech(sec, fromChar, reuseMap);
    }

    function restartWholeLessonCurrentSection() {
      if (!wholeLessonCurrentSec || isPaused) return;
      if (playAllActive) {
        startSectionSpeech(wholeLessonCurrentSec, wholeLessonPauseChar, true);
      } else if (activeSpeakSec) {
        startSectionSpeech(activeSpeakSec, wholeLessonPauseChar, true);
      }
    }

    function pauseSpeaking() {
      if (isPaused || (!currentSec && !activeSpeakSec)) return;
      isPaused = true;
      gen++;
      if (synth) {
        try {
          if (synth.paused) synth.resume();
        } catch (e) {}
        synth.cancel();
      }
      updateUI();
    }

    function resumeSpeaking() {
      if (!isPaused || !activeSpeakSec) return;
      isPaused = false;
      updateUI();
      restartWholeLessonCurrentSection();
    }

    function pauseWholeLesson() {
      if (!playAllActive || isPaused) return;
      pauseSpeaking();
    }

    function resumeWholeLesson() {
      if (!playAllActive || !isPaused || !wholeLessonCurrentSec) return;
      resumeSpeaking();
    }

    function stopAll() {
      restoreSpotlightStates();
      if (wholeLessonPrevSec) clearSectionHighlights(wholeLessonPrevSec);
      if (wholeLessonCurrentSec && wholeLessonCurrentSec !== wholeLessonPrevSec) {
        clearSectionHighlights(wholeLessonCurrentSec);
      }
      if (activeSpeakSec) clearSectionHighlights(activeSpeakSec);
      wholeLessonCurrentSec = null;
      wholeLessonPrevSec = null;
      activeSpeakSec = null;
      sectionSpeakDone = null;
      wholeLessonFullText = '';
      wholeLessonSpeakOffset = 0;
      wholeLessonPauseChar = 0;
      wholeLessonSentenceIdx = 0;
      playAllActive = false;
      isPaused = false;
      currentSec = null;
      playAllIndex = 0;
      gen++;
      if (synth) {
        try {
          if (synth.paused) synth.resume();
        } catch (e) {}
        synth.cancel();
      }
      updateUI();
    }

    function pauseResume() {
      if (!currentSec) return;
      if (isPaused) resumeSpeaking();
      else pauseSpeaking();
    }

    function beforePlay(sec) {
      if (sec.open) sec.open();
      scrollToView(sectionScrollEl(sec));
    }

    function playSection(sec, onDone) {
      currentSec = sec;
      sectionSpeakDone = onDone;
      beforePlay(sec);
      updateUI();
      startSectionSpeech(sec, 0, false);
    }

    function playNext() {
      if (!playAllActive || playAllIndex >= sections.length) {
        stopAll();
        return;
      }
      var sec = sections[playAllIndex++];
      if (wholeLessonMode) {
        if (wholeLessonPrevSec && wholeLessonPrevSec !== sec) {
          clearSectionHighlights(wholeLessonPrevSec);
        }
        wholeLessonPrevSec = sec;
        wholeLessonCurrentSec = sec;
        wholeLessonPauseChar = 0;
        wholeLessonSpeakOffset = 0;
        currentSec = { title: 'Lesson', playBtn: null, el: null };
        spotlightSection(sec);
        updateUI();
        speakWholeLessonSection(sec, 0);
        return;
      }
      playSection(sec, function () {
        if (playAllActive && !isPaused) playNext();
      });
    }

    sections.forEach(function (sec) {
      if (!sec.playBtn) return;
      bindInteractive(sec.playBtn, function () {
        if (currentSec === sec) {
          pauseResume();
          return;
        }
        stopAll();
        setTimeout(function () {
          playAllActive = false;
          playSection(sec, function () {
            updateUI();
          });
        }, 60);
      });
    });

    if (mainBtn) {
      mainBtn.addEventListener('click', function () {
        if (playAllActive && !isPaused) {
          if (wholeLessonMode) pauseWholeLesson();
          else pauseResume();
        } else if (playAllActive && isPaused) {
          if (wholeLessonMode) resumeWholeLesson();
          else resumeSpeaking();
        } else {
          stopAll();
          setTimeout(function () {
            saveSpotlightStates();
            playAllActive = true;
            playAllIndex = 0;
            playNext();
          }, 60);
        }
      });
    }

    if (stopBtn) stopBtn.addEventListener('click', stopAll);

    initSpeedDropdown(function (rate) {
      var wasPlaying = activeSpeakSec && !isPaused && synth && synth.speaking;
      var sec = activeSpeakSec;
      var idx = wholeLessonSentenceIdx;
      currentRate = rate;
      if (wasPlaying && sec && synth) {
        gen++;
        synth.cancel();
        speakSentenceAtIndex(sec, idx);
      }
    });

    if (!synth) {
      disableAudioControls(mainBtn, stopBtn, sections);
      return { stopAll: function () {} };
    }

    updateUI();
    return { stopAll: stopAll };
  }

  function disableAudioControls(mainBtn, stopBtn, sections) {
    if (mainBtn) {
      mainBtn.disabled = true;
      mainBtn.setAttribute('aria-disabled', 'true');
    }
    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.setAttribute('aria-disabled', 'true');
    }
    sections.forEach(function (sec) {
      if (sec.playBtn) {
        sec.playBtn.disabled = true;
        sec.playBtn.setAttribute('aria-disabled', 'true');
      }
    });
    var inner = $('.wp-audio-inner');
    if (inner && !inner.querySelector('.wp-audio-unsupported')) {
      var note = document.createElement('p');
      note.className = 'wp-audio-unsupported';
      note.style.cssText = 'font-size:12px;color:#8b0000;margin:0 0 0 auto;';
      note.textContent = 'Audio not supported in this browser. Try Chrome or Edge.';
      inner.appendChild(note);
    }
  }

  function openCollapsible(toggle, body) {
    if (!toggle || !body) return;
    body.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
  }

  function closeCollapsible(toggle, body) {
    if (!toggle || !body) return;
    body.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function addMinimiseButton(body, onMinimise) {
    if (!body || body.querySelector('.wp-minimise-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wp-minimise-btn';
    btn.setAttribute('aria-label', 'Minimise this section');
    btn.innerHTML = '&#9650; Minimise';
    btn.addEventListener('click', onMinimise);
    body.appendChild(btn);
  }

  function initResponsiveTables() {
    $$('.table-wrap table').forEach(function (table) {
      var headers = [];
      table.querySelectorAll('thead th').forEach(function (th) {
        headers.push(cleanText(th.textContent));
      });
      if (!headers.length) return;
      table.querySelectorAll('tbody tr').forEach(function (row) {
        row.querySelectorAll('td').forEach(function (td, i) {
          if (!td.getAttribute('data-label') && headers[i]) {
            td.setAttribute('data-label', headers[i]);
          }
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-wp-page');
    if (page === 'lesson') initLessonPage();
    else if (page === 'index') initIndexPage();
    initResponsiveTables();
  });
})();
