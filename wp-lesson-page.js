/* Shared lesson/index interactions (accordion, answers, flashcards, scripture reader, TOC) */
(function () {
  'use strict';

  function storageOK() {
    try {
      localStorage.setItem('_wp_t', '1');
      localStorage.removeItem('_wp_t');
      return true;
    } catch (e) {
      return false;
    }
  }

  function scrollBehavior() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    } catch (e) {
      return 'smooth';
    }
  }

  function lessonDownloadSlug() {
    var meta = document.getElementById('wp-lesson-meta');
    if (meta) {
      try {
        var d = JSON.parse(meta.textContent);
        if (d.downloadSlug) return d.downloadSlug;
      } catch (e) {}
    }
    var path = window.location.pathname.split('/').pop() || '';
    return path.replace(/\.html$/, '');
  }

  function getAllBodyIds() {
    return Array.prototype.slice.call(document.querySelectorAll('.acc-body'))
      .map(function (b) { return b.id; })
      .filter(Boolean);
  }

  function openAcc(id) {
    var body = document.getElementById(id);
    var btn = document.querySelector('[aria-controls="' + id + '"]');
    if (body && btn) {
      body.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  }

  function closeAcc(id) {
    var body = document.getElementById(id);
    var btn = document.querySelector('[aria-controls="' + id + '"]');
    if (body && btn) {
      body.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  function initLessonPage() {
    var allBodies = getAllBodyIds();
    var scriptureMode = false;
    var btnSO = document.getElementById('btn-scripture-only');

    document.querySelectorAll('.acc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('aria-controls');
        var body = document.getElementById(id);
        if (!body) return;
        if (body.classList.contains('open')) closeAcc(id);
        else openAcc(id);
        if (scriptureMode) setScriptureMode(false);
      });
    });

    var expandAll = document.getElementById('btn-expand-all');
    if (expandAll) {
      expandAll.addEventListener('click', function () {
        allBodies.forEach(openAcc);
        setScriptureMode(false);
      });
    }

    var collapseAll = document.getElementById('btn-collapse-all');
    if (collapseAll) {
      collapseAll.addEventListener('click', function () {
        allBodies.forEach(closeAcc);
        setScriptureMode(false);
      });
    }

    document.querySelectorAll('.acc-collapse-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetId = btn.getAttribute('data-target');
        closeAcc(targetId);
        var accBtn = document.querySelector('[aria-controls="' + targetId + '"]');
        if (accBtn) {
          setTimeout(function () {
            accBtn.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
          }, 50);
        }
      });
    });

    var bottomCollapse = document.getElementById('btn-bottom-collapse');
    if (bottomCollapse) {
      bottomCollapse.addEventListener('click', function () {
        allBodies.forEach(closeAcc);
        setScriptureMode(false);
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
      });
    }

    function setScriptureMode(on) {
      scriptureMode = on;
      if (!btnSO) return;
      if (on) {
        allBodies.forEach(closeAcc);
        openAcc('body-scripture');
        setTimeout(function () {
          var unit = document.getElementById('unit-scripture');
          if (unit) unit.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        }, 80);
        btnSO.innerHTML = '\u2715 Exit Scripture Mode';
        btnSO.classList.add('scripture-active');
      } else {
        btnSO.innerHTML = '&#128214; Read Scriptures and Summary';
        btnSO.classList.remove('scripture-active');
      }
    }

    if (btnSO) {
      btnSO.addEventListener('click', function () {
        setScriptureMode(!scriptureMode);
      });
    }

    var titleBlock = document.getElementById('title-block');
    var stickyBar = document.getElementById('sticky-bar');
    if (titleBlock && stickyBar) {
      window.addEventListener('scroll', function () {
        if (titleBlock.getBoundingClientRect().bottom < 0) {
          stickyBar.classList.add('visible');
          stickyBar.setAttribute('aria-hidden', 'false');
        } else {
          stickyBar.classList.remove('visible');
          stickyBar.setAttribute('aria-hidden', 'true');
        }
      }, { passive: true });
    }

    var canStore = storageOK();
    var fillables = document.querySelectorAll('.fillable[data-key]');
    fillables.forEach(function (el) {
      if (canStore) {
        var saved = localStorage.getItem(el.getAttribute('data-key'));
        if (saved) el.textContent = saved;
      }
      el.addEventListener('input', function () {
        if (!canStore) return;
        try {
          localStorage.setItem(el.getAttribute('data-key'), el.textContent);
        } catch (e) {}
      });
    });

    var downloadBtn = document.getElementById('btn-download-answers');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        var questions = document.querySelectorAll('.kdq-question');
        var lines = [
          document.title || 'Wisdom in Proverbs',
          'Key Discovery Questions',
          'Hiturn Media Group',
          ''
        ];
        questions.forEach(function (q, i) {
          var qTextEl = q.querySelector('.kdq-text');
          var qText = qTextEl ? qTextEl.innerText.trim() : '';
          var fillable = q.querySelector('.fillable');
          var aText = fillable ? fillable.innerText.trim() : '';
          lines.push('Q' + (i + 1) + ': ' + qText);
          lines.push('My Answer: ' + (aText || '(no answer entered)'));
          lines.push('');
        });
        try {
          var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = lessonDownloadSlug() + '-answers.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
    }

    var clearBtn = document.getElementById('btn-clear-answers');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!confirm('Clear all your answers for this section? This cannot be undone.')) return;
        fillables.forEach(function (el) {
          el.textContent = '';
          if (canStore) {
            try {
              localStorage.removeItem(el.getAttribute('data-key'));
            } catch (e) {}
          }
        });
      });
    }

    document.querySelectorAll('.flashcard').forEach(function (card) {
      function setFlipState() {
        card.setAttribute('aria-pressed', card.classList.contains('flipped') ? 'true' : 'false');
      }
      function flip() {
        card.classList.toggle('flipped');
        setFlipState();
      }
      setFlipState();
      card.addEventListener('click', flip);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flip();
        }
      });
    });

    initScriptureReadAloud();
    initLessonToc();
  }

  function initScriptureReadAloud() {
    var raSpeedSel = document.getElementById('read-aloud-speed');
    var readBtn = document.getElementById('btn-read-aloud');
    var counter = document.getElementById('reading-counter');
    if (!readBtn) return;

    var entries = Array.prototype.slice.call(document.querySelectorAll('.scripture-entry'));
    var reading = false;
    var raIsPaused = false;
    var I_RA_PLAY = '<svg width="10" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><polygon points="2,1 11,6 2,11"/></svg>';
    var I_RA_PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="4" height="10" rx="0.5"/><rect x="7" y="1" width="4" height="10" rx="0.5"/></svg>';

    function clearHL() {
      entries.forEach(function (e) { e.classList.remove('reading-active'); });
    }

    function stopReading() {
      window.speechSynthesis.cancel();
      reading = false;
      raIsPaused = false;
      clearHL();
      readBtn.innerHTML = I_RA_PLAY + ' Play Scriptures';
      readBtn.classList.remove('stop', 'paused');
      if (counter) counter.classList.remove('visible');
    }

    function readEntry(idx) {
      if (!reading) {
        stopReading();
        return;
      }
      if (idx >= entries.length) {
        var sum = document.getElementById('scripture-summary-block');
        if (sum && !sum._wasRead) {
          sum._wasRead = true;
          sum.classList.add('reading-active');
          sum.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
          var heading = (sum.querySelector('.wisdom-summary-heading') || {}).textContent || '';
          var items = Array.prototype.slice.call(sum.querySelectorAll('li'))
            .map(function (li, i) { return (i + 1) + '. ' + li.textContent; })
            .join('. ');
          var u = new SpeechSynthesisUtterance(heading + '. ' + items);
          u.lang = 'en-GB';
          u.rate = raSpeedSel ? parseFloat(raSpeedSel.value) : 1.0;
          u.onend = function () {
            sum.classList.remove('reading-active');
            sum._wasRead = false;
            stopReading();
          };
          window.speechSynthesis.speak(u);
        } else {
          stopReading();
        }
        return;
      }
      clearHL();
      entries[idx].classList.add('reading-active');
      entries[idx].scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
      if (counter) counter.textContent = (idx + 1) + ' / ' + entries.length;
      var ref = (entries[idx].querySelector('.scripture-ref') || {}).textContent || '';
      var txt = (entries[idx].querySelector('[data-scripture]') || {}).textContent || '';
      var utt = new SpeechSynthesisUtterance(ref + '. ' + txt);
      utt.lang = 'en-GB';
      utt.rate = raSpeedSel ? parseFloat(raSpeedSel.value) : 1.0;
      utt.onend = function () {
        if (reading) setTimeout(function () { readEntry(idx + 1); }, 900);
      };
      window.speechSynthesis.speak(utt);
    }

    readBtn.addEventListener('click', function () {
      if (!('speechSynthesis' in window)) {
        alert('Audio is not supported in this browser. Try Chrome or Edge.');
        return;
      }
      if (!reading && !raIsPaused) {
        reading = true;
        raIsPaused = false;
        readBtn.innerHTML = I_RA_PAUSE + ' Pause';
        readBtn.classList.add('stop');
        readBtn.classList.remove('paused');
        if (counter) counter.classList.add('visible');
        readEntry(0);
      } else if (reading && !raIsPaused) {
        window.speechSynthesis.pause();
        raIsPaused = true;
        reading = false;
        readBtn.innerHTML = I_RA_PLAY + ' Resume';
        readBtn.classList.remove('stop');
        readBtn.classList.add('paused');
      } else if (raIsPaused) {
        window.speechSynthesis.resume();
        raIsPaused = false;
        reading = true;
        readBtn.innerHTML = I_RA_PAUSE + ' Pause';
        readBtn.classList.add('stop');
        readBtn.classList.remove('paused');
      }
    });
  }

  function initLessonToc() {
    var tocToggle = document.getElementById('toc-toggle');
    var tocMenu = document.getElementById('toc-menu');
    if (!tocToggle || !tocMenu) return;

    tocToggle.addEventListener('click', function () {
      var open = tocMenu.style.display === 'block';
      tocMenu.style.display = open ? 'none' : 'block';
      tocToggle.setAttribute('aria-expanded', String(!open));
      tocToggle.innerHTML = open ? 'Contents &#9650;' : 'Contents &#9660;';
    });

    tocMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var bodyId = link.getAttribute('data-open');
        if (bodyId) openAcc(bodyId);
        var target = document.querySelector(link.getAttribute('href'));
        if (target) {
          setTimeout(function () {
            target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
          }, 60);
        }
        tocMenu.style.display = 'none';
        tocToggle.setAttribute('aria-expanded', 'false');
        tocToggle.innerHTML = 'Contents &#9650;';
      });
    });
  }

  function initIndexPage() {
    var aboutBtn = document.getElementById('about-btn');
    var aboutBody = document.getElementById('about-body');
    var aboutCollapse = document.getElementById('about-collapse-btn');

    if (aboutBtn && aboutBody) {
      aboutBtn.addEventListener('click', function () {
        var expanded = aboutBtn.getAttribute('aria-expanded') === 'true';
        aboutBtn.setAttribute('aria-expanded', String(!expanded));
        aboutBody.classList.toggle('open', !expanded);
      });
    }

    if (aboutCollapse && aboutBody && aboutBtn) {
      aboutCollapse.addEventListener('click', function () {
        aboutBody.classList.remove('open');
        aboutBtn.setAttribute('aria-expanded', 'false');
        setTimeout(function () {
          aboutBtn.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        }, 50);
      });
    }

    var pfToggle = document.getElementById('pf-toggle');
    var pfBody = document.getElementById('pf-body');
    if (pfToggle && pfBody) {
      pfToggle.addEventListener('click', function () {
        var open = pfBody.style.display !== 'none';
        pfBody.style.display = open ? 'none' : 'block';
        pfToggle.setAttribute('aria-expanded', String(!open));
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-wp-page');
    if (page === 'lesson') initLessonPage();
    else if (page === 'index') initIndexPage();
  });
})();
