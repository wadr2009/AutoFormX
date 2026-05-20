/**
 * 页面主环境：hook fetch / XMLHttpRequest，将匹配的响应发给 content script
 */
(function () {
  'use strict';

  const SOURCE_PAGE = 'autoformx-page';
  const SOURCE_CONTENT = 'autoformx-content';
  const MAX_BODY = 50000;

  /** @type {{ id: string, urlPattern: string }[]} */
  let rules = [];
  const seen = new Map();
  const DEDUPE_MS = 3000;

  function safeRegExp(pattern) {
    try {
      return new RegExp(pattern);
    } catch {
      return null;
    }
  }

  function compileRules(list) {
    return (list || [])
      .filter((r) => r && r.enabled !== false && r.urlPattern)
      .map((r) => ({ id: r.id, regex: safeRegExp(r.urlPattern) }))
      .filter((r) => r.regex);
  }

  function matchRule(url) {
    for (const r of rules) {
      if (r.regex.test(url)) return r.id;
    }
    return null;
  }

  function truncate(str) {
    const s = typeof str === 'string' ? str : String(str ?? '');
    return s.length > MAX_BODY ? s.slice(0, MAX_BODY) + '\n...[truncated]' : s;
  }

  function shouldSkip(url, body) {
    const key = url + '::' + (body ? body.length : 0) + '::' + (body ? body.slice(0, 200) : '');
    const now = Date.now();
    const last = seen.get(key);
    if (last && now - last < DEDUPE_MS) return true;
    seen.set(key, now);
    if (seen.size > 200) {
      const oldest = seen.keys().next().value;
      seen.delete(oldest);
    }
    return false;
  }

  function emitCapture(url, method, status, bodyText) {
    const ruleId = matchRule(url);
    if (!ruleId) return;
    if (shouldSkip(url, bodyText)) return;

    window.postMessage(
      {
        source: SOURCE_PAGE,
        type: 'RESPONSE_CAPTURED',
        payload: {
          url,
          method: method || 'GET',
          status: status || 0,
          body: truncate(bodyText),
          ruleId,
          capturedAt: Date.now()
        }
      },
      '*'
    );
  }

  async function readResponseBody(response, clone) {
    const ct = (response.headers && response.headers.get('content-type')) || '';
    if (ct.includes('application/octet-stream') || ct.startsWith('image/') || ct.startsWith('video/')) {
      return '';
    }
    try {
      return await clone.text();
    } catch {
      return '';
    }
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = async function autoformxFetch(input, init) {
      const response = await originalFetch.apply(this, arguments);
      try {
        const url = typeof input === 'string' ? input : input?.url || response.url;
        const method = (init && init.method) || (input && input.method) || 'GET';
        const clone = response.clone();
        readResponseBody(response, clone).then((bodyText) => {
          if (bodyText) emitCapture(url, method, response.status, bodyText);
        });
      } catch (e) {
        console.debug('[AutoFormX][hook] fetch capture skip', e);
      }
      return response;
    };
  }

  const XHRProto = XMLHttpRequest.prototype;
  const originalOpen = XHRProto.open;
  const originalSend = XHRProto.send;

  XHRProto.open = function autoformxOpen(method, url) {
    this.__autoformxMethod = method;
    this.__autoformxUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XHRProto.send = function autoformxSend(body) {
    this.addEventListener('load', function onXhrLoad() {
      try {
        const url = this.responseURL || this.__autoformxUrl || '';
        if (!url || !matchRule(String(url))) return;
        let bodyText = '';
        if (this.responseType === '' || this.responseType === 'text') {
          bodyText = this.responseText || '';
        } else if (this.responseType === 'json' && this.response != null) {
          bodyText = typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
        }
        if (bodyText) {
          emitCapture(String(url), this.__autoformxMethod || 'GET', this.status, bodyText);
        }
      } catch (e) {
        console.debug('[AutoFormX][hook] xhr capture skip', e);
      }
    });
    return originalSend.apply(this, arguments);
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== SOURCE_CONTENT) return;
    if (event.data.type === 'INIT_CAPTURE') {
      rules = compileRules(event.data.rules);
      console.log(`[AutoFormX][hook] 已初始化，${rules.length} 条规则生效`);
    }
  });

  window.postMessage({ source: SOURCE_PAGE, type: 'HOOK_READY' }, '*');
})();
