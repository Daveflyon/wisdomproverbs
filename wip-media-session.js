/* Wisdom in Proverbs — Media Session helper for TTS playback (Android lock screen) */
(function (window) {
  'use strict';

  var SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  function getAnchor() {
    var el = document.getElementById('wip-media-anchor');
    if (!el) {
      el = document.createElement('audio');
      el.id = 'wip-media-anchor';
      el.setAttribute('playsinline', '');
      el.setAttribute('preload', 'none');
      el.hidden = true;
      el.loop = true;
      el.src = SILENT_WAV;
      document.body.appendChild(el);
    }
    return el;
  }

  function playAnchor() {
    var el = getAnchor();
    if (!el.paused) return;
    var p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {});
    }
  }

  function pauseAnchor() {
    var el = document.getElementById('wip-media-anchor');
    if (el) el.pause();
  }

  window.WipMediaSession = {
    bind: function (opts) {
      if (!navigator.mediaSession) {
        return { sync: function () {}, release: function () {} };
      }

      var ms = navigator.mediaSession;

      ms.setActionHandler('play', function () {
        if (opts.onPlay) opts.onPlay();
        sync();
      });

      ms.setActionHandler('pause', function () {
        if (opts.onPause) opts.onPause();
        sync();
      });

      ms.setActionHandler('stop', function () {
        if (opts.onStop) opts.onStop();
        sync();
      });

      function sync() {
        var active = opts.isActive && opts.isActive();
        if (!active) {
          ms.playbackState = 'none';
          pauseAnchor();
          return;
        }

        var paused = opts.isPaused && opts.isPaused();
        ms.playbackState = paused ? 'paused' : 'playing';

        if (opts.getMetadata) {
          var meta = opts.getMetadata();
          if (meta) {
            ms.metadata = new MediaMetadata({
              title: meta.title || 'Wisdom in Proverbs',
              artist: meta.artist || 'Hiturn Media Group',
              album: meta.album || 'Wisdom in Proverbs'
            });
          }
        }

        if (!paused) {
          playAnchor();
        } else {
          pauseAnchor();
        }
      }

      return {
        sync: sync,
        release: function () {
          ms.playbackState = 'none';
          pauseAnchor();
        }
      };
    }
  };
})(window);
