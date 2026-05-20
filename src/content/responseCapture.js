/**
 * 接口响应捕获 — content script 模块
 */
(function () {
  'use strict';

  const SOURCE_PAGE = 'autoformx-page';
  const SOURCE_CONTENT = 'autoformx-content';
  const HOOK_URL = 'src/injected/networkHook.js';

  let captureConfig = {
    responseCaptureEnabled: false,
    responseCaptureDomainWhitelist: '',
    responseCaptureRules: []
  };

  let hookInjected = false;
  let hookReady = false;
  let pickerEl = null;
  let pickerClickHandler = null;

  function getUtils() {
    return window.AutoFormXCaptureUtils;
  }

  function isCaptureActive() {
    if (!captureConfig.responseCaptureEnabled) return false;
    const utils = getUtils();
    if (!utils) return false;
    return utils.isDomainWhitelisted(location.hostname, captureConfig.responseCaptureDomainWhitelist);
  }

  function getEnabledRules() {
    return (captureConfig.responseCaptureRules || []).filter((r) => r.enabled !== false);
  }

  function injectNetworkHook() {
    if (document.documentElement?.dataset?.autoformxNetworkHook === '1') {
      hookInjected = true;
      sendInitToHook();
      return;
    }
    if (hookInjected) return;

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(HOOK_URL);
    script.onload = () => {
      document.documentElement.dataset.autoformxNetworkHook = '1';
      hookInjected = true;
      script.remove();
    };
    script.onerror = () => {
      console.error('[AutoFormX][capture] 无法注入 networkHook.js');
      hookInjected = false;
    };
    (document.head || document.documentElement).appendChild(script);
  }

  function sendInitToHook() {
    window.postMessage(
      {
        source: SOURCE_CONTENT,
        type: 'INIT_CAPTURE',
        rules: getEnabledRules()
      },
      '*'
    );
  }

  async function loadCaptureConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          responseCaptureEnabled: false,
          responseCaptureDomainWhitelist: '',
          responseCaptureRules: []
        },
        (items) => {
          captureConfig = items;
          resolve(items);
        }
      );
    });
  }

  async function refreshCapture() {
    await loadCaptureConfig();
    if (isCaptureActive()) {
      const rules = getEnabledRules();
      console.log(`[AutoFormX][capture] 接口提取已激活，${rules.length} 条规则`);
      injectNetworkHook();
      if (hookReady) sendInitToHook();
    }
  }

  function onPageMessage(event) {
    if (event.source !== window || !event.data || event.data.source !== SOURCE_PAGE) return;

    if (event.data.type === 'HOOK_READY') {
      hookReady = true;
      sendInitToHook();
      return;
    }

    if (event.data.type === 'RESPONSE_CAPTURED') {
      const payload = event.data.payload;
      if (!payload || !isCaptureActive()) return;

      console.log(`[AutoFormX][capture] 捕获到接口响应: ${payload.url}`);
      chrome.runtime.sendMessage(
        {
          action: 'processCapturedResponse',
          data: payload
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[AutoFormX][capture]', chrome.runtime.lastError.message);
            return;
          }
          if (response?.success && response.notify) {
            showCaptureToast(`已提取: ${response.notify.ruleName || '接口数据'}`);
          }
        }
      );
    }
  }

  function showCaptureToast(message, type) {
    if (typeof window.__autoformxShowToast === 'function') {
      window.__autoformxShowToast(message, type || 'success');
    }
  }

  function closePicker() {
    if (pickerClickHandler) {
      document.removeEventListener('click', pickerClickHandler, true);
      pickerClickHandler = null;
    }
    if (pickerEl) {
      pickerEl.remove();
      pickerEl = null;
    }
  }

  async function fetchExtractedItems() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getExtractedResults' }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          resolve([]);
          return;
        }
        resolve(response.data || []);
      });
    });
  }

  async function hasValidExtractedItems() {
    try {
      const items = await fetchExtractedItems();
      return items.length > 0;
    } catch {
      return false;
    }
  }

  function addCapturePickButton(field, positionFieldButton, observeFieldPosition) {
    if (!isCaptureActive()) return null;

    const captureBtn = document.createElement('div');
    captureBtn.className = 'autoformx-capture-button';
    captureBtn.title = '从接口提取结果中选择填入';
    captureBtn.style.display = 'none';

    captureBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M3 8h7M3 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="12.5" cy="11.5" r="2" stroke="currentColor" stroke-width="1.2"/>
        <path d="M14 13.5l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    `;

    captureBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await openExtractPicker(field, captureBtn);
    });

    const refreshVisibility = async () => {
      const hasData = await hasValidExtractedItems();
      captureBtn.style.display = hasData ? '' : 'none';
    };

    field.addEventListener('focus', async () => {
      await refreshVisibility();
      if (captureBtn.style.display !== 'none') {
        captureBtn.classList.add('visible');
      }
    });
    field.addEventListener('blur', () => {
      if (!captureBtn.matches(':hover')) captureBtn.classList.remove('visible');
    });

    captureBtn.dataset.offsetX = '-58';
    if (typeof positionFieldButton === 'function') {
      positionFieldButton(field, captureBtn, { offsetX: -58 });
    }
    document.body.appendChild(captureBtn);
    if (typeof observeFieldPosition === 'function') {
      observeFieldPosition(field, captureBtn);
    }

    return captureBtn;
  }

  function positionPickerNear(anchor, panel) {
    const rect = anchor.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - 328)}px`;
    panel.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 280)}px`;
    panel.style.zIndex = '10000000';
  }

  async function openExtractPicker(field, anchor) {
    closePicker();

    const flatItems = await fetchExtractedItems();
    if (!flatItems.length) {
      showCaptureToast('暂无提取结果，请先触发匹配的接口请求', 'warning');
      return;
    }

    pickerEl = document.createElement('div');
    pickerEl.className = 'autoformx-extract-picker';

    const header = document.createElement('div');
    header.className = 'autoformx-extract-picker-header';
    header.innerHTML = '<span>选择提取结果</span>';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'autoformx-extract-picker-close';
    closeBtn.setAttribute('aria-label', '关闭');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closePicker);
    header.appendChild(closeBtn);
    pickerEl.appendChild(header);

    const list = document.createElement('div');
    list.className = 'autoformx-extract-picker-list';

    flatItems.forEach((item) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'autoformx-extract-picker-item';
      const label = item.label || item.key;
      const preview =
        String(item.value).length > 80 ? String(item.value).slice(0, 80) + '…' : String(item.value);
      row.innerHTML = `<span class="autoformx-extract-item-label">${escapeHtml(label)}</span><span class="autoformx-extract-item-value">${escapeHtml(preview)}</span>`;
      if (item.meta) {
        row.title = `${item.meta.ruleName || ''} · ${item.meta.url || ''}`;
      }
      row.addEventListener('click', async () => {
        closePicker();
        if (typeof window.__autoformxFillField === 'function') {
          await window.__autoformxFillField(field, item.value);
        }
        showCaptureToast('已填入', 'success');
      });
      list.appendChild(row);
    });

    pickerEl.appendChild(list);
    document.body.appendChild(pickerEl);
    positionPickerNear(anchor, pickerEl);

    pickerClickHandler = (ev) => {
      if (!pickerEl || !anchor) {
        document.removeEventListener('click', pickerClickHandler, true);
        pickerClickHandler = null;
        return;
      }
      if (!pickerEl.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target)) {
        closePicker();
      }
    };
    setTimeout(() => document.addEventListener('click', pickerClickHandler, true), 0);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function init() {
    window.addEventListener('message', onPageMessage);
    await refreshCapture();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (
        changes.responseCaptureEnabled ||
        changes.responseCaptureDomainWhitelist ||
        changes.responseCaptureRules
      ) {
        refreshCapture();
      }
    });
  }

  window.AutoFormXResponseCapture = {
    init,
    refreshCapture,
    isCaptureActive,
    addCapturePickButton,
    showCaptureToast
  };
})();
