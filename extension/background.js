// background.js â TabScroller v1.0.0
// Hold right-click + scroll wheel to cycle through all tabs including pinned.
// Keyboard shortcuts: Ctrl+Shift+Right (next), Ctrl+Shift+Left (previous).

const VERSION = 'v1.0.0';

// ââ Keep service worker alive âââââââââââââââââââââââââââââââââââââââââââââââââ
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => {});

// ââ Log (for debug via Settings page) ââââââââââââââââââââââââââââââââââââââââ
const logLines = [];
function log(msg) {
  const t = new Date().toLocaleTimeString('en', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  logLines.push('[' + t + '] ' + msg);
  if (logLines.length > 200) logLines.shift();
}
log('TabScroller ' + VERSION + ' starting');

// ââ URL eligibility âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function eligible(url) {
  if (!url) return false;
  return !/^(chrome|edge|about|chrome-extension)://test(url);
}

// ââ Track which tabs have been injected âââââââââââââââââââââââââââââââââââââââ
const injectedTabs = new Set();

chrome.tabs.onRemoved.addListener(tabId => injectedTabs.delete(tabId));

// ââ Inject content script into a tab âââââââââââââââââââââââââââââââââââââââââ
function inject(tabId, url) {
  if (!eligible(url)) return;
  chrome.scripting.executeScript(
    { target: { tabId: tabId }, files: ['content.js'] },
    () => {
      if (chrome.runtime.lastError) {
        log('SKIP tab ' + tabId + ': ' + chrome.runtime.lastError.message);
      } else {
        injectedTabs.add(tabId);
        log('Injected tab ' + tabId + ': ' + (url||'').substring(0, 60));
      }
    }
  );
}

// ââ Inject all existing tabs ââââââââââââââââââââââââââââââââââââââââââââââââââ
function injectAll() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (eligible(tab.url)) inject(tab.id, tab.url);
    }
  });
}

// ââ On install: inject all open tabs âââââââââââââââââââââââââââââââââââââââââ
let installedFired = false;
chrome.runtime.onInstalled.addListener(() => {
  installedFired = true;
  injectAll();
});

// On worker startup (Edge restart, idle revival): inject if not fresh install
setTimeout(() => { if (!installedFired) injectAll(); }, 500);

// ââ On tab activated: inject if not already done ââââââââââââââââââââââââââââââ
// Catches pinned tabs that weren't ready when extension loaded
chrome.tabs.onActivated.addListener((info) => {
  if (injectedTabs.has(info.tabId)) return;
  setTimeout(() => {
    chrome.tabs.get(info.tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return;
      inject(tab.id, tab.url);
    });
  }, 300);
});

// ââ On navigation: re-inject after real page load âââââââââââââââââââââââââââââ
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!eligible(tab.url)) return;
  // Only re-inject if URL changed (real navigation) or not yet injected
  if (changeInfo.url) injectedTabs.delete(tabId);
  if (!injectedTabs.has(tabId)) inject(tabId, tab.url);
});

// ââ Settings ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
let invertDirection = false;
chrome.storage.sync.get({ invertDirection: false }, (s) => {
  invertDirection = s.invertDirection;
});
chrome.storage.onChanged.addListener((c) => {
  if (c.invertDirection) invertDirection = c.invertDirection.newValue;
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// ââ Keyboard shortcuts ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'next-tab' && command !== 'prev-tab') return;
  const direction = command === 'next-tab' ? 'next' : 'prev';
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return;
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  tabs.sort((a, b) => a.index - b.index);
  const i = direction === 'next'
    ? (active.index + 1) % tabs.length
    : (active.index - 1 + tabs.length) % tabs.length;
  if (tabs[i]) chrome.tabs.update(tabs[i].id, { active: true });
});

// ââ Tab switching âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
let busy = false;

async function switchTab(fromTab, direction) {
  if (busy) return;
  busy = true;
  try {
    const tabs = await chrome.tabs.query({ windowId: fromTab.windowId });
    tabs.sort((a, b) => a.index - b.index);
    const i = direction === 'next'
      ? (fromTab.index + 1) % tabs.length
      : (fromTab.index - 1 + tabs.length) % tabs.length;
    const target = tabs[i];
    if (target) {
      log('idx=' + fromTab.index + ' â idx=' + i + ' "' + (target.title||'').substring(0,25) + '"');
      await chrome.tabs.update(target.id, { active: true });
      chrome.scripting.executeScript({
        target: { tabId: target.id },
        func: () => window.addEventListener('contextmenu',
          e => e.preventDefault(), { once: true })
      }).catch(() => {});
    }
  } catch(e) {
    log('ERROR: ' + e.message);
  } finally {
    busy = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LOG') {
    const header = 'TabScroller Debug Log â 
      + VERSION + '\n'
      + 'Generated: ' + new Date().toISOString() + '\n'
      + 'Entries: ' + logLines.length + '\n'
      + '-'.repeat(50) + '\n';
    sendResponse({ log: header + logLines.join('\n'), lines: logLines.length });
    return false;
  }
  if (message.type !== 'SCROLL_TABS' || !sender.tab) return;
  const dir = !invertDirection
    ? (message.delta > 0 ? 'next' : 'prev')
    : (message.delta > 0 ? 'prev' : 'next');
  switchTab(sender.tab, dir);
});

if (typeof module !== 'undefined') {
  module.exports = { switchTab, VERSION };
}
