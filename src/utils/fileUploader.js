/**
 * 文件/图片上传：逐个串行处理，缓存测试文件，Ant Upload 走页面主世界
 */
const FileUploader = (() => {
  const UPLOAD_ROOT_SELECTOR = '.ant-upload, .el-upload, .n-upload, .arco-upload';
  const PAGE_SCRIPT_URL = 'src/injected/pageSelect.js';
  const PAGE_MSG_SOURCE = 'autoformx-extension';
  const BETWEEN_UPLOAD_DELAY = 80;

  const AVAILABLE_FILES = [
    { name: '1111111.png', type: 'image/png' },
    { name: '1kb.jpeg', type: 'image/jpeg' },
    { name: '1kb.jpg', type: 'image/jpeg' },
    { name: 'file.pdf', type: 'application/pdf' },
    { name: '1111111.zip', type: 'application/zip' }
  ];

  const fileCache = new Map();
  let pageScriptReady = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isFileField(element) {
    if (!element) return false;
    return element.type === 'file' || element.getAttribute('data-autoformx-type') === 'file';
  }

  function isInsideUploadComponent(element) {
    return !!element?.closest?.(UPLOAD_ROOT_SELECTOR);
  }

  function hasExistingFile(fileInput) {
    return !!(fileInput.files && fileInput.files.length > 0);
  }

  function filterFilesByAccept(files, accept) {
    if (!accept || accept === '*') return files;

    const acceptTypes = accept.split(',').map((t) => t.trim().toLowerCase());
    const matched = [];

    for (const file of files) {
      const fileType = file.type.toLowerCase();
      for (const acceptType of acceptTypes) {
        if (
          acceptType === fileType ||
          (acceptType.endsWith('/*') && fileType.startsWith(acceptType.replace('/*', '/'))) ||
          acceptType === '*'
        ) {
          matched.push(file);
          break;
        }
      }
    }

    return matched;
  }

  function pickRandomFile(accept) {
    const matched = filterFilesByAccept(AVAILABLE_FILES, accept);
    const pool = matched.length > 0 ? matched : filterFilesByAccept(AVAILABLE_FILES, 'image/*');
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function loadFile(fileInfo) {
    if (fileCache.has(fileInfo.name)) {
      return fileCache.get(fileInfo.name);
    }

    const url = chrome.runtime.getURL(`src/defult-file/${fileInfo.name}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`无法加载文件: ${fileInfo.name}`);
    }

    const blob = await response.blob();
    const file = new File([blob], fileInfo.name, { type: fileInfo.type });
    fileCache.set(fileInfo.name, file);
    return file;
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

  function postToPage(message, resultAction, timeout = 2000) {
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

  async function assignFileInPage(fileInput, fileInfo, file) {
    try {
      await injectPageScript();
    } catch {
      return false;
    }

    const marker = `aff_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    fileInput.setAttribute('data-autoformx-file-marker', marker);

    const result = await postToPage(
      {
        action: 'fill-file',
        marker,
        fileUrl: chrome.runtime.getURL(`src/defult-file/${fileInfo.name}`),
        fileName: fileInfo.name,
        mimeType: fileInfo.type
      },
      'fill-file-result'
    );

    fileInput.removeAttribute('data-autoformx-file-marker');
    return !!result.ok;
  }

  function assignFileInContentScript(fileInput, file) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  async function fillFile(fileInput) {
    if (!fileInput || hasExistingFile(fileInput)) {
      return false;
    }

    const accept = fileInput.accept || '';
    const fileInfo = pickRandomFile(accept);
    if (!fileInfo) {
      console.warn('[AutoFormX] [FileUploader] 无匹配文件, accept:', accept);
      return false;
    }

    try {
      const file = await loadFile(fileInfo);
      let ok = false;

      if (isInsideUploadComponent(fileInput)) {
        ok = await assignFileInPage(fileInput, fileInfo, file);
      }
      if (!ok) {
        assignFileInContentScript(fileInput, file);
        ok = hasExistingFile(fileInput);
      }
      if (!ok && isInsideUploadComponent(fileInput)) {
        ok = await assignFileInPage(fileInput, fileInfo, file);
      }

      if (ok) {
        console.log(`[AutoFormX] [FileUploader] 已上传: ${fileInfo.name}`);
      }
      return ok;
    } catch (error) {
      console.error('[AutoFormX] [FileUploader] 上传失败:', error);
      return false;
    }
  }

  async function fillFilesSequential(fileInputs) {
    let successCount = 0;
    for (const input of fileInputs) {
      if (!isFileField(input)) continue;
      try {
        if (await fillFile(input)) successCount++;
      } catch (error) {
        console.error('[AutoFormX] [FileUploader] 处理失败:', error);
      }
      await sleep(BETWEEN_UPLOAD_DELAY);
    }
    return successCount;
  }

  return {
    UPLOAD_ROOT_SELECTOR,
    isFileField,
    isInsideUploadComponent,
    fillFile,
    fillFilesSequential
  };
})();

if (typeof window !== 'undefined') {
  window.FileUploader = FileUploader;
}
