// content.js â TabScroller v5.1.0

(function () {
  'use strict';

  if (window.__tsCleanup) window.__tsCleanup();

  window.__tsRightDown = false;
  var rightDown = false;
  var didScroll = false;

  function send(delta) {
    try {
      chrome.runtime && chrome.runtime.sendMessage({ type: 'SCROLL_TABS', delta: delta });
    } catch(e) {}
  }

  function onMouseDown(e) {
    if (e.button === 2) {
      rightDown = true;
      window.__tsRightDown = true;
      didScroll = false;
    }
  }

  function onMouseUp(e) {
    if (e.button === 2) {
      rightDown = false;
      window.__tsRightDown = false;
      didScroll = false;
    }
  }

  function onContextMenu(e) {
    if (didScroll) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function onWheel(e) {
    if (e.buttons !== 2 && !rightDown) return;
    if (e.buttons !== 2) {
      rightDown = false;
      window.__tsRightDown = false;
      return;
    }
    didScroll = true;
    e.preventDefault();
    e.stopImmediatePropagation();
    send(e.deltaY);
  }

  var wopts = { passive: false, capture: true };
  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mouseup', onMouseUp, true);
  window.addEventListener('contextmenu', onContextMenu, true);
  window.addEventListener('wheel', onWheel, wopts);

  window.__tsCleanup = function() {
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    window.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('wheel', onWheel, wopts);
    window.__tsRightDown = false;
    window.__tsCleanup = null;
  };
})();
