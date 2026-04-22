// background.js â TabScroller v1.0.0
// Hold right-click + scroll wheel to cycle through all tabs including pinned.
// Keyboard shortcuts: Ctrl+Shift+Right (next), Ctrl+Shift+Left (previous).

const VERSION = 'v5.1.0';

chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => {});

const logLines = [];
function log(msg) {
  const t = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logLines.push('[' + t + '] ' + msg);
  if (logLines.length > 200) logLines.shift();
}
log('TabScroller ' + VERSION + ' starting');

function eligible(url) {
  if (!url) return false;
  return !/^(chrome|edge|about|chrome-extension):/.test(url);
}

const injectedTabs = new Set();
chrome.tabs.onRemoved.addListener(tabId => injectedTabs.delete(tabId));

function inject(tabId, url) {
  if (!eligible(url)) return;
  chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] }, () => {
    if (chrome.runtime.lastError) {
      log('SKIP tab ' + tabId + ': ' + chrome.runtime.lastError.message);
    } else {
      injectedTabs.add(tabId);
      log('Injected tab ' + tabId + ': ' + (url||'').substring(0, 60));
    }
  });
}

function injectAll() {
  chrome.tabs.query({}, (tabs) => { for (const tab of tabs) { if (eligible(tab.url)) inject(tab.id, tab.url); } });
}

let installedFired = false;
chrome.runtime.onInstalled.addListener(() => { installedFired = true; injectAll(); });
setTimeout(() => { if (!installedFired) injectAll(); }, 500);

chrome.tabs.onActivated.addListener((info) => {
  if (injectedTabs.has(info.tabId)) return;
  setTimeout(() => { chrome.tabs.get(info.tabId, (tab) => { if (!chrome.runtime.lastError && tab) inject(tab.id, tab.url); }); }, 300);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!eligible(tab.url)) return;
  if (changeInfo.url) injectedTabs.delete(tabId);
  if (!injectedTabs.has(tabId)) inject(tabId, tab.url);
});

let invertDirection = false;
chrome.storage.sync.get({ invertDirection: false }, (s) => { invertDirection = s.invertDirection; });
chrome.storage.onChanged.addListener((c) => { if (c.invertDirection) invertDirection = c.invertDirection.newValue; });
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'next-tab' && command !== 'prev-tab') return;
  const direction = command === 'next-tab' ? 'next' : 'prev';
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active) return;
  const tabs = await chrome.tabs.query({ windowId: active.windowId });
  tabs.sort((a, b) => a.index - b.index);
  const i = direction === 'next' ? (active.index + 1) % tabs.length : (active.index - 1 + tabs.length) % tabs.length;
  if (tabs[i]) chrome.tabs.update(tabs[i].id, { active: true });
});

let busy = false;
async function switchTab(fromTab, direction) {
  if (busy) return;
  busy = true;
  try {
    const tabs = await chrome.tabs.query({ windowId: fromTab.windowId });
    tabs.sort((a, b) => a.index - b.index);
    const i = direction === 'next' ? (fromTab.index + 1) % tabs.length : (fromTab.index - 1 + tabs.length) % tabs.length;
    const target = tabs[i];
    if (target) {
      log('idx=' + fromTab.index + ' â idx=' + i + ' "' + (target.title||'').substring(0,25) + '"');
      await chrome.tabs.update(target.id, { active: true });
      chrome.scripting.executeScript({ target: { tabId: target.id }, func: () => window.addEventListener('contextmenu', e => e.preventDefault(), { once: true }) }).catch(() => {});
    }
  } catch(e) { log('ERROR: ' + e.message); }
  finally { busy = false; }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_LOG') {
    const header = 'TabScroller Debug Log â ' + VERSION + '\nGenerated: ' + new Date().toISOString() + '\nEntries: ' + logLines.length + '\n' + '-'.repeat(50) + '\n';
    sendResponse({ log: header + logLines.join('\n'), lines: logLines.length });
    return false;
  }
  if (message.type !== 'SCROLL_TABS' || !sender.tab) return;
  const dir = !invertDirection ? (message.delta > 0 ? 'next' : 'prev') : (message.delta > 0 ? 'prev' : 'next');
  switchTab(sender.tab, dir);
});

if (typeof module !== 'undefined') { module.exports = { switchTab, VERSION }; }
