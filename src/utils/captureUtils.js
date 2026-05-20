/**
 * 接口响应捕获 — 域名 / URL 匹配工具（无 Chrome API 依赖）
 */
(function (global) {
  'use strict';

  const MAX_BODY_LENGTH = 50000;

  /**
   * 解析多行正则配置（每行一条，空行与 # 注释忽略）
   */
  function parsePatternLines(text) {
    if (!text || typeof text !== 'string') return [];
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  }

  /**
   * 安全编译正则
   */
  function compilePattern(pattern) {
    if (!pattern) return null;
    try {
      return new RegExp(pattern);
    } catch (error) {
      console.warn('[AutoFormX][capture] 无效正则:', pattern, error.message);
      return null;
    }
  }

  /**
   * 域名是否命中白名单（对 hostname 逐条正则匹配）
   * @param {string} hostname - 如 www.example.com
   * @param {string} whitelistText - 多行正则
   */
  function isDomainWhitelisted(hostname, whitelistText) {
    const patterns = parsePatternLines(whitelistText);
    if (patterns.length === 0) return false;
    const host = String(hostname || '').toLowerCase();
    return patterns.some((pattern) => {
      const regex = compilePattern(pattern);
      return regex ? regex.test(host) : false;
    });
  }

  /**
   * 请求 URL 是否命中某条捕获规则
   */
  function matchUrlAgainstRules(url, rules) {
    if (!url || !Array.isArray(rules)) return null;
    for (const rule of rules) {
      if (rule.enabled === false) continue;
      const regex = compilePattern(rule.urlPattern);
      if (regex && regex.test(url)) {
        return rule;
      }
    }
    return null;
  }

  function truncateBody(body, maxLen = MAX_BODY_LENGTH) {
    const str = typeof body === 'string' ? body : String(body ?? '');
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + '\n...[truncated]';
  }

  /**
   * 将提取的 JSON 展平为可选项列表
   */
  function flattenExtractedData(data, prefix = '') {
    const items = [];
    if (data === null || data === undefined) return items;

    if (typeof data !== 'object' || Array.isArray(data)) {
      const label = prefix || 'value';
      items.push({
        key: label,
        label,
        value: Array.isArray(data) ? JSON.stringify(data) : String(data)
      });
      return items;
    }

    Object.keys(data).forEach((key) => {
      const val = data[key];
      const path = prefix ? `${prefix}.${key}` : key;
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        items.push(...flattenExtractedData(val, path));
      } else if (Array.isArray(val)) {
        items.push({ key: path, label: path, value: JSON.stringify(val) });
      } else {
        items.push({ key: path, label: path, value: val === undefined || val === null ? '' : String(val) });
      }
    });
    return items;
  }

  global.AutoFormXCaptureUtils = {
    MAX_BODY_LENGTH,
    parsePatternLines,
    compilePattern,
    isDomainWhitelisted,
    matchUrlAgainstRules,
    truncateBody,
    flattenExtractedData
  };
})(typeof window !== 'undefined' ? window : self);
