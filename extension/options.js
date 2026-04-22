// options.js v5.1.0
(function () {
  'use strict';

  var invertCheckbox = document.getElementById('invertDirection');
  var savedBadge = document.getElementById('savedBadge');
  var copyLogBtn = document.getElementById('copyLogBtn');
  var statusMsg = document.getElementById('statusMsg');

  chrome.storage.sync.get({ invertDirection: false }, function(items) {
    invertCheckbox.checked = items.invertDirection;
  });

  invertCheckbox.addEventListener('change', function() {
    chrome.storage.sync.set({ invertDirection: invertCheckbox.checked }, function() {
      savedBadge.classList.add('show');
      setTimeout(function() { savedBadge.classList.remove('show'); }, 2000);
    });
  });

  copyLogBtn.addEventListener('click', function() {
    statusMsg.textContent = 'Fetching...';
    chrome.runtime.sendMessage({ type: 'GET_LOG' }, function(response) {
      if (chrome.runtime.lastError || !response) {
        statusMsg.textContent = 'Error fetching log.';
        return;
      }
      navigator.clipboard.writeText(response.log).then(function() {
        copyLogBtn.textContent = 'â Copied!';
        copyLogBtn.classList.add('success');
        statusMsg.textContent = response.lines + ' entries copied.';
        setTimeout(function() {
          copyLogBtn.textContent = 'Copy Debug Log';
          copyLogBtn.classList.remove('success');
          statusMsg.textContent = '';
        }, 2500);
      }).catch(function() {
        statusMsg.textContent = 'Clipboard unavailable.';
      });
    });
  });
})();
