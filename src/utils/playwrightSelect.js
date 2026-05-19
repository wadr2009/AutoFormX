/**
 * Playwright 风格的下拉框处理（content script 内运行）
 */
const PlaywrightSelect = (() => {
  const CUSTOM_SELECT_SELECTOR =
    '.ant-select, .el-select, .n-select, .arco-select, .t-select, .semi-select, .ivu-select';

  const PLACEHOLDER_TEXTS = new Set([
    '请选择', '暂无数据', '全部', '-', '--', '请选择...', '请选择一项', '请选择所属行业'
  ]);

  const WAIT_TIMEOUT = 1500;
  const OPEN_TIMEOUT = 800;
  const SELECTION_TIMEOUT = 600;
  const POLL_INTERVAL = 40;
  const BETWEEN_SELECT_DELAY = 60;
  const MAX_RANDOM_OPTIONS = 5;
  const PAGE_SCRIPT_URL = 'src/injected/pageSelect.js';
  const PAGE_MSG_SOURCE = 'autoformx-extension';

  let pageScriptReady = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }
    if (el.classList.contains('ant-select-dropdown-hidden')) return false;
    return el.getClientRects().length > 0;
  }

  function isCustomSelect(element) {
    if (!element?.matches) return false;
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return false;
    return element.matches(CUSTOM_SELECT_SELECTOR);
  }

  function isInsideCustomSelect(element) {
    const parent = element?.parentElement;
    if (!parent) return false;
    if (parent.matches(CUSTOM_SELECT_SELECTOR)) return true;
    const grandParent = parent.parentElement;
    return !!(grandParent?.classList?.contains('ant-select-selector'));
  }

  function isSelectField(element) {
    if (!element) return false;
    if (element.tagName === 'SELECT') return true;
    return isCustomSelect(element);
  }

  function hasExistingValue(element) {
    if (element.tagName === 'SELECT') {
      return !!(element.value && element.value !== '');
    }

    const selectedItem = element.querySelector(
      '.ant-select-selection-item, .el-select__selected-item, .n-base-selection-input__content'
    );
    if (selectedItem?.textContent?.trim()) return true;

    const placeholder = element.querySelector(
      '.ant-select-selection-placeholder, .el-select__placeholder, .n-base-selection-placeholder'
    );
    if (placeholder && isVisible(placeholder)) return false;

    return false;
  }

  function pickRandomIndex(optionCount) {
    const poolSize = Math.min(optionCount, MAX_RANDOM_OPTIONS);
    return Math.floor(Math.random() * poolSize);
  }

  function isValidOption(option) {
    const text = option.textContent?.trim() || '';
    if (!text || PLACEHOLDER_TEXTS.has(text)) return false;
    if (
      option.disabled ||
      option.getAttribute('disabled') !== null ||
      option.getAttribute('aria-disabled') === 'true' ||
      option.classList.contains('disabled') ||
      option.classList.contains('ant-select-item-option-disabled') ||
      option.classList.contains('is-disabled')
    ) {
      return false;
    }
    return isVisible(option);
  }

  function getCombobox(root) {
    return root.querySelector('[role="combobox"]');
  }

  /** Ant Design 等组件应点击 selector，而不是 readonly 的 combobox input */
  function getClickTarget(root) {
    if (root.classList.contains('ant-select')) {
      return root.querySelector('.ant-select-selector') || root;
    }
    if (root.classList.contains('el-select')) {
      return (
        root.querySelector('.el-input__wrapper') ||
        root.querySelector('.el-input__inner') ||
        root.querySelector('.el-input') ||
        root
      );
    }
    if (root.classList.contains('n-select')) {
      return root.querySelector('.n-base-selection') || root;
    }
    if (root.classList.contains('arco-select')) {
      return root.querySelector('.arco-select-view') || root;
    }
    if (root.classList.contains('t-select')) {
      return root.querySelector('.t-input__wrap') || root;
    }
    if (root.classList.contains('semi-select')) {
      return root.querySelector('.semi-select-selection') || root;
    }
    if (root.classList.contains('ivu-select')) {
      return root.querySelector('.ivu-select-selection') || root;
    }
    return root.querySelector('[role="combobox"]') || root;
  }

  function ensureMarker(root) {
    let marker = root.getAttribute('data-autoformx-marker');
    if (!marker) {
      marker = `afs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      root.setAttribute('data-autoformx-marker', marker);
    }
    return marker;
  }

  function clearMarker(root) {
    root.removeAttribute('data-autoformx-marker');
  }

  function injectPageScript() {
    if (pageScriptReady) return pageScriptReady;
    if (document.documentElement?.dataset?.autoformxPageSelect === '1') {
      pageScriptReady = Promise.resolve();
      return pageScriptReady;
    }

    pageScriptReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(PAGE_SCRIPT_URL);
      script.onload = () => {
        document.documentElement.dataset.autoformxPageSelect = '1';
        script.remove();
        resolve();
      };
      script.onerror = () => {
        pageScriptReady = null;
        reject(new Error('无法注入页面脚本'));
      };
      (document.head || document.documentElement).appendChild(script);
    });

    return pageScriptReady;
  }

  async function ensurePageScript() {
    try {
      await injectPageScript();
      return true;
    } catch (error) {
      console.warn('[AutoFormX] [PlaywrightSelect] 页面脚本注入失败:', error.message);
      return false;
    }
  }

  function postToPage(message, resultAction, timeout = 1500) {
    return new Promise((resolve) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      let settled = false;

      const finish = (payload) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        resolve(payload);
      };

      const onMessage = (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== PAGE_MSG_SOURCE || data.requestId !== requestId) return;
        if (data.action !== resultAction) return;
        finish(data);
      };

      window.addEventListener('message', onMessage);
      window.postMessage({ source: PAGE_MSG_SOURCE, requestId, ...message }, '*');
      setTimeout(() => finish({ ok: false, error: 'timeout' }), timeout);
    });
  }

  async function selectOptionInPage(listboxId, optionIndex) {
    if (!(await ensurePageScript())) {
      return { ok: false, error: 'no-page-script' };
    }
    return postToPage(
      { action: 'select-option', listboxId, optionIndex },
      'select-option-result'
    );
  }

  async function selectByKeyboardInPage(root, optionIndex) {
    if (!(await ensurePageScript())) {
      return { ok: false, error: 'no-page-script' };
    }
    const marker = ensureMarker(root);
    return postToPage(
      { action: 'keyboard-select', marker, optionIndex },
      'keyboard-select-result'
    );
  }

  function simulateClick(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    if (typeof el.click === 'function') {
      el.click();
    }
  }

  function getOptionLabel(option) {
    return (
      option.getAttribute('title') ||
      option.getAttribute('aria-label') ||
      option.querySelector('.ant-select-item-option-content')?.textContent?.trim() ||
      option.textContent?.trim() ||
      ''
    );
  }

  function getOptionClickTarget(option) {
    return (
      option.querySelector('.ant-select-item-option-content') ||
      option.querySelector('.el-select-dropdown__item') ||
      option
    );
  }

  /** Ant Design 对 mousedown 更敏感，且选中后下拉会自动关闭，不应立刻 Escape */
  async function clickOption(option) {
    const target = getOptionClickTarget(option);
    target.scrollIntoView({ block: 'center', inline: 'nearest' });

    const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
    target.dispatchEvent(new MouseEvent('mouseenter', opts));
    target.dispatchEvent(new MouseEvent('mouseover', opts));
    target.dispatchEvent(new MouseEvent('mousedown', opts));
    target.dispatchEvent(new MouseEvent('mouseup', opts));
    target.dispatchEvent(new MouseEvent('click', opts));
    if (typeof target.click === 'function') {
      target.click();
    }
  }

  async function waitForSelection(root, timeout = SELECTION_TIMEOUT) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (hasExistingValue(root)) return true;
      await sleep(POLL_INTERVAL);
    }
    return false;
  }

  function isAnyDropdownOpen() {
    return !!document.querySelector(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden), [role="listbox"]:not([aria-hidden="true"])'
    );
  }

  async function ensureDropdownClosed(root) {
    if (!findListboxForSelect(root)) return;
    getCombobox(root)?.blur();
    if (findListboxForSelect(root)) {
      await closeDropdown();
    }
  }

  function getListboxId(root) {
    const combobox = getCombobox(root);
    return combobox?.getAttribute('aria-controls') || combobox?.getAttribute('aria-owns') || null;
  }

  /** 查找与当前 select 关联的已打开下拉面板 */
  function findListboxForSelect(root) {
    const listboxId = getListboxId(root);

    if (listboxId) {
      const byId = document.getElementById(listboxId);
      if (byId && isVisible(byId)) return byId;

      const dropdown = document.querySelector(
        `.ant-select-dropdown:not(.ant-select-dropdown-hidden) #${CSS.escape(listboxId)}`
      );
      if (dropdown && isVisible(dropdown)) return dropdown;
    }

    const antDropdowns = document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
    for (const dropdown of antDropdowns) {
      if (!isVisible(dropdown)) continue;
      if (listboxId) {
        const inner = dropdown.querySelector(`#${CSS.escape(listboxId)}`);
        if (inner) return inner;
      }
      return dropdown;
    }

    const listboxes = document.querySelectorAll('[role="listbox"]');
    for (const listbox of listboxes) {
      if (listbox.getAttribute('aria-hidden') === 'true') continue;
      if (!isVisible(listbox)) continue;
      if (listboxId && listbox.id !== listboxId) continue;
      return listbox;
    }

    const fallbackSelectors = [
      '.el-select-dropdown:not([style*="display: none"])',
      '.n-select-menu',
      '.arco-select-popup:not([style*="display: none"])',
      '.t-select-dropdown:not([style*="display: none"])',
      '.semi-select-option-list',
      '.ivu-select-dropdown:not([style*="display: none"])'
    ];

    for (const selector of fallbackSelectors) {
      const node = document.querySelector(selector);
      if (node && isVisible(node)) return node;
    }

    return null;
  }

  function collectOptions(listbox) {
    const antOptions = listbox.querySelectorAll(
      '.ant-select-item-option:not(.ant-select-item-option-disabled)'
    );
    if (antOptions.length > 0) {
      return Array.from(antOptions).filter(isValidOption);
    }

    const roleOptions = listbox.querySelectorAll('[role="option"]');
    if (roleOptions.length > 0) {
      return Array.from(roleOptions).filter(isValidOption);
    }

    const fallbackOptions = listbox.querySelectorAll(
      '.el-select-dropdown__item, .n-option, .arco-select-option, .t-select-option, .semi-select-option, .ivu-select-item'
    );
    return Array.from(fallbackOptions).filter(isValidOption);
  }

  async function closeDropdown() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true })
    );
    await sleep(30);
  }

  async function openDropdown(root) {
    root.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const combobox = getCombobox(root);

    simulateClick(getClickTarget(root));
    combobox?.focus();

    if (await waitFor(() => findListboxForSelect(root), OPEN_TIMEOUT)) return;

    if (combobox) {
      simulateClick(combobox);
      await waitFor(() => findListboxForSelect(root), 400);
    }
  }

  async function waitFor(getter, timeout = WAIT_TIMEOUT) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = getter();
      if (result) return result;
      await sleep(POLL_INTERVAL);
    }
    return null;
  }

  async function fillNativeSelectRandom(select) {
    if (hasExistingValue(select)) return false;

    const options = Array.from(select.options).filter(
      (opt) => !opt.disabled && opt.value !== '' && opt.value != null
    );
    if (options.length === 0) return false;

    const index = pickRandomIndex(options.length);
    const target = options[index];
    select.value = target.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  async function fillCustomSelectRandom(root) {
    if (hasExistingValue(root)) {
      console.log('[AutoFormX] [PlaywrightSelect] 已有值，跳过');
      return false;
    }

    ensureMarker(root);

    try {
      if (isAnyDropdownOpen()) {
        await closeDropdown();
      }

      await openDropdown(root);
      const listbox = await waitFor(() => findListboxForSelect(root), OPEN_TIMEOUT);

      if (!listbox) {
        console.warn('[AutoFormX] [PlaywrightSelect] 未能打开下拉框', root);
        return false;
      }

      const options = await waitFor(() => {
        const found = collectOptions(listbox);
        return found.length > 0 ? found : null;
      }, 800);

      if (!options || options.length === 0) {
        console.warn('[AutoFormX] [PlaywrightSelect] 下拉框无可用选项', listbox);
        await closeDropdown();
        return false;
      }

      const index = pickRandomIndex(options.length);
      const label = getOptionLabel(options[index]);
      const listboxId = getListboxId(root);
      console.log(
        `[AutoFormX] [PlaywrightSelect] 选择选项: "${label}" (${index + 1}/${options.length})`
      );

      let filled = false;
      const pageResult = await selectOptionInPage(listboxId, index);
      if (pageResult.ok) {
        filled = await waitForSelection(root);
      }

      if (!filled) {
        if (!findListboxForSelect(root)) {
          await openDropdown(root);
          await waitFor(() => findListboxForSelect(root), OPEN_TIMEOUT);
        }
        await selectByKeyboardInPage(root, index);
        filled = await waitForSelection(root, 800);
      }

      if (!filled) {
        await clickOption(options[index]);
        filled = await waitForSelection(root, 800);
      }

      if (findListboxForSelect(root)) {
        await ensureDropdownClosed(root);
      }
      return filled;
    } finally {
      clearMarker(root);
    }
  }

  async function fillSelectRandom(element) {
    if (!element || hasExistingValue(element)) return false;
    if (element.tagName === 'SELECT') return fillNativeSelectRandom(element);
    if (isCustomSelect(element)) return fillCustomSelectRandom(element);
    return false;
  }

  async function fillSelectsSequential(elements) {
    let successCount = 0;
    for (const element of elements) {
      if (!isSelectField(element)) continue;
      try {
        if (await fillSelectRandom(element)) successCount++;
      } catch (error) {
        console.error('[AutoFormX] [PlaywrightSelect] 下拉框处理失败:', error);
      }
      await sleep(BETWEEN_SELECT_DELAY);
    }
    return successCount;
  }

  return {
    CUSTOM_SELECT_SELECTOR,
    isCustomSelect,
    isInsideCustomSelect,
    isSelectField,
    hasExistingValue,
    fillSelectRandom,
    fillSelectsSequential,
    ensurePageScript
  };
})();

if (typeof window !== 'undefined') {
  window.PlaywrightSelect = PlaywrightSelect;
  PlaywrightSelect.ensurePageScript?.().catch(() => {});
}
