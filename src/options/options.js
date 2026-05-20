/**
 * 设置页面脚本 - AutoFormX
 */

// DOM元素
const elements = {
  provider: document.getElementById('provider'),
  apiBaseUrl: document.getElementById('apiBaseUrl'),
  apiKey: document.getElementById('apiKey'),
  toggleApiKey: document.getElementById('toggleApiKey'),
  model: document.getElementById('model'),
  customModel: document.getElementById('customModel'),
  customModelGroup: document.getElementById('customModelGroup'),
  refreshModelBtn: document.getElementById('refreshModelBtn'),
  temperature: document.getElementById('temperature'),
  temperatureValue: document.getElementById('temperatureValue'),
  showFieldButtons: document.getElementById('showFieldButtons'),
  showGlobalButton: document.getElementById('showGlobalButton'),
  responseCaptureEnabled: document.getElementById('responseCaptureEnabled'),
  responseCaptureDomainWhitelist: document.getElementById('responseCaptureDomainWhitelist'),
  captureRulesList: document.getElementById('captureRulesList'),
  addCaptureRuleBtn: document.getElementById('addCaptureRuleBtn'),
  clearExtractedBtn: document.getElementById('clearExtractedBtn'),
  domainWhitelistTestInput: document.getElementById('domainWhitelistTestInput'),
  domainWhitelistTestResult: document.getElementById('domainWhitelistTestResult'),
  saveBtn: document.getElementById('saveBtn'),
  testBtn: document.getElementById('testBtn'),
  toast: document.getElementById('toast')
};

/** @type {Array<{id:string,name:string,urlPattern:string,extractPrompt:string,enabled:boolean}>} */
let captureRulesDraft = [];

// 本地模型列表缓存（带时间戳）
let modelListCache = {
  deepbricks: { models: [], timestamp: 0 },
  deepseek: { models: [], timestamp: 0 },
  openai: { models: [], timestamp: 0 },
  moonshot: { models: [], timestamp: 0 },
  zhipu: { models: [], timestamp: 0 },
  bailian: { models: [], timestamp: 0 },
  stepfun: { models: [], timestamp: 0 },
  minimax: { models: [], timestamp: 0 },
  groq: { models: [], timestamp: 0 },
  together: { models: [], timestamp: 0 },
  fireworks: { models: [], timestamp: 0 },
  perplexity: { models: [], timestamp: 0 },
  qwen: { models: [], timestamp: 0 },
  siliconcloud: { models: [], timestamp: 0 },
  nebius: { models: [], timestamp: 0 },
  openrouter: { models: [], timestamp: 0 },
  xai: { models: [], timestamp: 0 },
  mistral: { models: [], timestamp: 0 },
  custom: { models: [], timestamp: 0 }
};

// 缓存有效期（1小时）
const CACHE_DURATION = 60 * 60 * 1000;

// 默认模型列表
// 只保留自定义模型选项；其它厂商的模型列表一律依赖真实 API 返回结果，
// 在没有 API Key 或无法获取列表时不再使用硬编码的默认模型，避免“编造”模型。
const defaultProviderModels = {
  custom: [
    { value: 'custom', label: '自定义模型...' }
  ]
};

/**
 * 初始化
 */
function init() {
  loadSettings();
  bindEvents();
  initNavigation();
}

/**
 * 初始化导航
 */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // 更新导航状态
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // 切换内容区域
      const targetSection = item.getAttribute('data-section');
      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetSection) {
          section.classList.add('active');
        }
      });
    });
  });
}

/**
 * 加载设置
 */
function loadSettings() {
  chrome.storage.sync.get({
    provider: 'deepbricks',
    apiBaseUrl: 'https://api.deepbricks.ai/v1',
    apiKeys: {
      deepbricks: '',
      deepseek: '',
      openai: '',
      moonshot: '',
      zhipu: '',
      bailian: '',
      stepfun: '',
      minimax: '',
      groq: '',
      together: '',
      fireworks: '',
      perplexity: '',
      qwen: '',
      siliconcloud: '',
      nebius: '',
      openrouter: '',
      xai: '',
      mistral: '',
      custom: ''
    },
    selectedModels: {
      deepbricks: 'gpt-4-turbo',
      deepseek: 'deepseek-chat',
      openai: 'gpt-4-turbo-preview',
      moonshot: 'moonshot-v1-8k',
      zhipu: 'glm-4-flash',
      bailian: 'qwen-plus',
      stepfun: 'step-1-8k',
      minimax: 'abab6.5-chat',
      groq: 'llama-3.3-70b-versatile',
      together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      fireworks: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
      perplexity: 'sonar',
      qwen: 'qwen-max',
      siliconcloud: 'Qwen/QwQ-32B',
      nebius: 'meta-llama/Meta-Llama-3.1-405B-Instruct',
      openrouter: 'openai/gpt-4-turbo',
      xai: 'grok-beta',
      mistral: 'mistral-large-latest',
      custom: 'custom'
    },
    customModels: {
      deepbricks: '',
      deepseek: '',
      openai: '',
      moonshot: '',
      zhipu: '',
      bailian: '',
      stepfun: '',
      minimax: '',
      groq: '',
      together: '',
      fireworks: '',
      perplexity: '',
      qwen: '',
      siliconcloud: '',
      nebius: '',
      openrouter: '',
      xai: '',
      mistral: '',
      custom: ''
    },
    model: 'gpt-4-turbo',
    customModel: '',
    temperature: 0.7,
    showFieldButtons: false,
    showGlobalButton: false,
    responseCaptureEnabled: false,
    responseCaptureDomainWhitelist: '',
    responseCaptureRules: []
  }, (items) => {
    elements.provider.value = items.provider;
    elements.apiBaseUrl.value = items.apiBaseUrl;
    
    // 加载当前厂商的API Key
    const currentApiKey = items.apiKeys[items.provider] || '';
    elements.apiKey.value = currentApiKey;
    
    elements.temperature.value = items.temperature;
    elements.temperatureValue.textContent = items.temperature;
    elements.showFieldButtons.checked = items.showFieldButtons;
    elements.showGlobalButton.checked = items.showGlobalButton;
    elements.responseCaptureEnabled.checked = items.responseCaptureEnabled;
    elements.responseCaptureDomainWhitelist.value = items.responseCaptureDomainWhitelist || '';
    captureRulesDraft = Array.isArray(items.responseCaptureRules) ? items.responseCaptureRules : [];
    renderCaptureRules();
    updateDomainWhitelistTest();

    // 存储全局配置供后续使用
    window.currentSettings = items;

    // 更新模型列表和API Base URL
    updateProviderSettings(items.provider, true);
  });
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 保存按钮
  elements.saveBtn.addEventListener('click', saveSettings);

  // 测试连接按钮
  elements.testBtn.addEventListener('click', testConnection);

  // Temperature滑块
  elements.temperature.addEventListener('input', (e) => {
    elements.temperatureValue.textContent = e.target.value;
    updateRangeBackground(e.target);
  });

  // 初始化滑块背景
  updateRangeBackground(elements.temperature);

  // Provider变化
  elements.provider.addEventListener('change', (e) => {
    updateProviderSettings(e.target.value);
  });
  
  // 模型选择变化
  elements.model.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      elements.customModelGroup.style.display = 'block';
      elements.customModel.focus();
    } else {
      elements.customModelGroup.style.display = 'none';
    }
  });

  // API Key 显示/隐藏
  if (elements.toggleApiKey) {
    elements.toggleApiKey.addEventListener('click', () => {
      const input = elements.apiKey;
      if (input.type === 'password') {
        input.type = 'text';
        elements.toggleApiKey.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/>
            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>
          </svg>
        `;
      } else {
        input.type = 'password';
        elements.toggleApiKey.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
          </svg>
        `;
      }
    });
  }

  // 刷新模型列表按钮
  if (elements.addCaptureRuleBtn) {
    elements.addCaptureRuleBtn.addEventListener('click', () => {
      captureRulesDraft.push({
        id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: `规则 ${captureRulesDraft.length + 1}`,
        urlPattern: '',
        extractPrompt: '',
        enabled: true
      });
      renderCaptureRules();
    });
  }

  if (elements.clearExtractedBtn) {
    elements.clearExtractedBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'clearExtractedResults' }, (response) => {
        if (response?.success) {
          showToast('已清空提取结果', 'success');
        }
      });
    });
  }

  if (elements.responseCaptureDomainWhitelist) {
    elements.responseCaptureDomainWhitelist.addEventListener('input', updateDomainWhitelistTest);
  }

  if (elements.domainWhitelistTestInput) {
    elements.domainWhitelistTestInput.addEventListener('input', updateDomainWhitelistTest);
  }

  if (elements.refreshModelBtn) {
    elements.refreshModelBtn.addEventListener('click', async () => {
      const provider = elements.provider.value;

      // 显示加载状态
      elements.refreshModelBtn.classList.add('loading');
      elements.refreshModelBtn.disabled = true;

      try {
        // 清除缓存，强制重新获取
        modelListCache[provider].timestamp = 0;
        
        // 更新模型列表
        await updateModelList(provider);
        
        showToast('模型列表已刷新', 'success');
      } catch (error) {
        console.error('[AutoFormX] 刷新模型列表失败:', error);
        showToast('刷新失败，请检查 API 配置', 'error');
      } finally {
        // 恢复按钮状态
        elements.refreshModelBtn.classList.remove('loading');
        elements.refreshModelBtn.disabled = false;
      }
    });
  }
}

/**
 * 更新滑块背景
 */
function updateRangeBackground(range) {
  const value = (range.value - range.min) / (range.max - range.min) * 100;
  range.style.background = `linear-gradient(to right, #f97316 0%, #f97316 ${value}%, #475569 ${value}%, #475569 100%)`;
}

/**
 * 更新厂商相关设置
 */
function updateProviderSettings(provider, isInitialLoad = false) {
  const defaultUrls = {
    deepbricks: 'https://api.deepbricks.ai/v1',
    deepseek: 'https://api.deepseek.com',
    openai: 'https://api.openai.com/v1',
    moonshot: 'https://api.moonshot.cn/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    stepfun: 'https://api.stepfun.com/v1',
    minimax: 'https://api.minimax.chat/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.xyz/v1',
    fireworks: 'https://api.fireworks.ai/inference/v1',
    perplexity: 'https://api.perplexity.ai',
    qwen: 'https://dashscope.aliyuncs.com/api/v1',
    siliconcloud: 'https://api.siliconflow.cn/v1',
    nebius: 'https://api.nebius.ai/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    xai: 'https://api.x.ai/v1',
    mistral: 'https://api.mistral.ai/v1',
    custom: ''
  };

  if (provider !== 'custom') {
    elements.apiBaseUrl.value = defaultUrls[provider] || '';
    elements.apiBaseUrl.disabled = true;
  } else {
    elements.apiBaseUrl.disabled = false;
  }
  
  // 先加载当前厂商的API Key，再更新模型列表
  chrome.storage.sync.get({
    apiKeys: {
      deepbricks: '',
      deepseek: '',
      openai: '',
      moonshot: '',
      zhipu: '',
      bailian: '',
      stepfun: '',
      minimax: '',
      groq: '',
      together: '',
      fireworks: '',
      perplexity: '',
      qwen: '',
      siliconcloud: '',
      nebius: '',
      openrouter: '',
      xai: '',
      mistral: '',
      custom: ''
    }
  }, (items) => {
    const currentApiKey = items.apiKeys[provider] || '';
    elements.apiKey.value = currentApiKey;
    
    // API Key 已更新后，再更新模型列表
    updateModelList(provider, isInitialLoad);
  });
}

/**
 * 获取模型列表
 */
async function fetchModelList(provider, apiBaseUrl, apiKey) {
  const now = Date.now();
  if (modelListCache[provider].timestamp && (now - modelListCache[provider].timestamp) < CACHE_DURATION) {
    return modelListCache[provider].models;
  }

  try {
    // 如果没有 API Key，则认为当前不知道可用模型列表：
    // 非 custom 厂商返回空数组；custom 厂商仅提供“自定义模型”占位。
    if (!apiKey) {
      if (provider === 'custom') {
        const customOnly = ensureCustomModelOption(defaultProviderModels.custom || []);
        modelListCache[provider] = { models: customOnly, timestamp: now };
        return customOnly;
      }
      modelListCache[provider] = { models: [], timestamp: now };
      return [];
    }

    if (provider === 'custom') {
      const customOnly = ensureCustomModelOption(defaultProviderModels.custom || []);
      modelListCache[provider] = { models: customOnly, timestamp: now };
      return customOnly;
    }

    // 通过 background service worker 获取模型列表，避免 CORS 问题
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'fetchModelList',
        data: {
          apiBaseUrl: apiBaseUrl,
          apiKey: apiKey,
          provider: provider
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (response.success && response.data && response.data.length > 0) {
      const models = ensureCustomModelOption(response.data);
      modelListCache[provider] = { models: models, timestamp: now };
      return models;
    }

    // 没有成功获取到任何模型：不再回退到硬编码列表，
    // 仅保留“自定义模型”占位，或者完全为空。
    const fallbackModels = ensureCustomModelOption([]);
    modelListCache[provider] = { models: fallbackModels, timestamp: now };
    return fallbackModels;
    
  } catch (error) {
    console.warn('[AutoFormX] 获取模型列表失败，不再使用硬编码默认列表:', error);
    const fallbackModels = ensureCustomModelOption([]);
    modelListCache[provider] = { models: fallbackModels, timestamp: Date.now() };
    return fallbackModels;
  }
}

/**
 * 确保模型列表中包含自定义模型选项
 */
function ensureCustomModelOption(models) {
  if (!Array.isArray(models)) {
    models = [];
  }
  
  if (!models.some(m => m.value === 'custom')) {
    models = [...models, { value: 'custom', label: '自定义模型...' }];
  }
  
  return models;
}

/**
 * 更新模型列表
 */
async function updateModelList(provider, isInitialLoad = false) {
  elements.model.innerHTML = '<option value="">加载中...</option>';
  elements.model.disabled = true;

  try {
    const apiKey = elements.apiKey.value;
    const apiBaseUrl = elements.apiBaseUrl.value;

    const models = await fetchModelList(provider, apiBaseUrl, apiKey);

    elements.model.innerHTML = '';
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.label;
      elements.model.appendChild(option);
    });

    // 恢复之前选择的模型
    chrome.storage.sync.get({
      selectedModels: {},
      customModels: {}
    }, (items) => {
      const savedModel = items.selectedModels[provider];
      const savedCustomModel = items.customModels[provider] || '';
      
      if (savedModel) {
        // 检查保存的模型是否在列表中
        const modelExists = models.some(m => m.value === savedModel);
        if (modelExists) {
          elements.model.value = savedModel;
        } else if (models.length > 0) {
          elements.model.value = models[0].value;
        }
      } else if (models.length > 0) {
        elements.model.value = models[0].value;
      }
      
      // 处理自定义模型
      if (elements.model.value === 'custom') {
        elements.customModelGroup.style.display = 'block';
        elements.customModel.value = savedCustomModel;
      } else {
        elements.customModelGroup.style.display = 'none';
        elements.customModel.value = '';
      }
    });

    elements.model.disabled = false;
  } catch (error) {
    console.error('[AutoFormX] 更新模型列表出错:', error);
    elements.model.innerHTML = '<option value="">加载失败</option>';
    elements.model.disabled = true;
  }
}

/**
 * 保存设置
 */
function saveSettings() {
  const provider = elements.provider.value;
  const apiKey = elements.apiKey.value;
  const model = elements.model.value;
  const customModel = elements.customModel.value;
  
  if (!apiKey) {
    showToast('请输入 API Key', 'error');
    return;
  }

  if (!elements.apiBaseUrl.value) {
    showToast('请输入 API 地址', 'error');
    return;
  }
  
  if (model === 'custom' && !customModel) {
    showToast('请输入自定义模型名称', 'error');
    return;
  }
  
  chrome.storage.sync.get({
    apiKeys: {
      deepbricks: '',
      deepseek: '',
      openai: '',
      moonshot: '',
      zhipu: '',
      bailian: '',
      stepfun: '',
      minimax: '',
      groq: '',
      together: '',
      fireworks: '',
      perplexity: '',
      qwen: '',
      siliconcloud: '',
      nebius: '',
      openrouter: '',
      xai: '',
      mistral: '',
      custom: ''
    },
    selectedModels: {},
    customModels: {}
  }, (items) => {
    const apiKeys = items.apiKeys;
    apiKeys[provider] = apiKey;
    
    // 保存当前服务商的模型选择
    const selectedModels = items.selectedModels;
    selectedModels[provider] = model;
    
    // 保存当前服务商的自定义模型
    const customModels = items.customModels;
    customModels[provider] = customModel;
    
    const settings = {
      provider: provider,
      apiBaseUrl: elements.apiBaseUrl.value,
      apiKeys: apiKeys,
      apiKey: apiKey,
      model: model,
      customModel: customModel,
      selectedModels: selectedModels,
      customModels: customModels,
      temperature: parseFloat(elements.temperature.value),
      showFieldButtons: elements.showFieldButtons.checked,
      showGlobalButton: elements.showGlobalButton.checked,
      responseCaptureEnabled: elements.responseCaptureEnabled.checked,
      responseCaptureDomainWhitelist: elements.responseCaptureDomainWhitelist.value.trim(),
      responseCaptureRules: captureRulesDraft
    };

    chrome.storage.sync.set(settings, () => {
      showToast('设置保存成功', 'success');
      modelListCache[provider].timestamp = 0;
    });
  });
}

/**
 * 测试API连接
 */
async function testConnection() {
  const apiKey = elements.apiKey.value;
  const apiBaseUrl = elements.apiBaseUrl.value;
  const model = elements.model.value;
  const customModel = elements.customModel.value;
  const provider = elements.provider.value;

  if (!apiKey) {
    showToast('请先输入 API Key', 'error');
    return;
  }

  if (!apiBaseUrl) {
    showToast('请先输入 API 地址', 'error');
    return;
  }
  
  const actualModel = model === 'custom' ? customModel : model;
  
  if (!actualModel) {
    showToast('请选择或输入模型', 'error');
    return;
  }

  // 更新按钮状态
  const originalContent = elements.testBtn.innerHTML;
  elements.testBtn.disabled = true;
  elements.testBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" class="animate-spin">
      <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clip-rule="evenodd"/>
    </svg>
    <span>测试中...</span>
  `;

  try {
    // 通过 background service worker 发起请求，避免 CORS 问题
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'testApiConnection',
        data: {
          apiBaseUrl: apiBaseUrl,
          apiKey: apiKey,
          model: actualModel,
          provider: provider
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (response.success) {
      showToast(`连接成功！模型: ${actualModel}`, 'success');
      modelListCache[provider].timestamp = 0;
      // 保存当前自定义模型值，避免更新模型列表时丢失
      const currentCustomModel = elements.customModel.value;
      updateModelList(provider).then(() => {
        // 恢复自定义模型值
        if (elements.model.value === 'custom') {
          elements.customModel.value = currentCustomModel;
        }
      });
    } else {
      showToast(`连接失败: ${response.error}`, 'error');
      console.error('[AutoFormX] API测试失败:', response.error);
    }
  } catch (error) {
    showToast(`连接异常: ${error.message}`, 'error');
    console.error('[AutoFormX] API测试异常:', error);
  } finally {
    elements.testBtn.disabled = false;
    elements.testBtn.innerHTML = originalContent;
  }
}

function createRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function renderCaptureRules() {
  if (!elements.captureRulesList) return;
  elements.captureRulesList.innerHTML = '';

  if (captureRulesDraft.length === 0) {
    elements.captureRulesList.innerHTML = '<p class="form-hint">暂无规则，点击「添加规则」创建。</p>';
    return;
  }

  captureRulesDraft.forEach((rule, index) => {
    const card = document.createElement('div');
    card.className = 'capture-rule-card';
    card.innerHTML = `
      <div class="capture-rule-card-header">
        <label class="capture-rule-enable">
          <input type="checkbox" data-field="enabled" ${rule.enabled !== false ? 'checked' : ''}>
          <span>启用</span>
        </label>
        <button type="button" class="capture-rule-remove" data-action="remove" title="删除">删除</button>
      </div>
      <div class="form-group">
        <label>规则名称</label>
        <input type="text" class="form-input" data-field="name" value="" placeholder="如：订单详情接口">
      </div>
      <div class="form-group">
        <label>接口 URL 正则</label>
        <input type="text" class="form-input" data-field="urlPattern" value="" placeholder=".*/api/order/.*">
        <div class="regex-test-row capture-rule-url-test">
          <input type="text" class="form-input regex-test-input" data-field="urlTestInput" placeholder="输入测试 URL 进行匹配">
          <span class="regex-test-result" data-field="urlTestResult"></span>
        </div>
      </div>
      <div class="form-group">
        <label>AI 提取 Prompt</label>
        <textarea class="form-textarea" data-field="extractPrompt" rows="3" placeholder="提取 orderNo、customerName、amount，返回 JSON"></textarea>
      </div>
    `;

    card.querySelector('[data-field="name"]').value = rule.name || '';
    card.querySelector('[data-field="urlPattern"]').value = rule.urlPattern || '';
    card.querySelector('[data-field="extractPrompt"]').value = rule.extractPrompt || '';

    card.querySelector('[data-field="enabled"]').addEventListener('change', (e) => {
      captureRulesDraft[index].enabled = e.target.checked;
    });
    card.querySelector('[data-field="name"]').addEventListener('input', (e) => {
      captureRulesDraft[index].name = e.target.value;
    });
    card.querySelector('[data-field="urlPattern"]').addEventListener('input', (e) => {
      captureRulesDraft[index].urlPattern = e.target.value;
      updateUrlPatternTest(card, e.target.value, card.querySelector('[data-field="urlTestInput"]')?.value || '');
    });
    card.querySelector('[data-field="extractPrompt"]').addEventListener('input', (e) => {
      captureRulesDraft[index].extractPrompt = e.target.value;
    });
    card.querySelector('[data-action="remove"]').addEventListener('click', () => {
      captureRulesDraft.splice(index, 1);
      renderCaptureRules();
    });

    const urlTestInput = card.querySelector('[data-field="urlTestInput"]');
    if (urlTestInput) {
      urlTestInput.addEventListener('input', (e) => {
        const urlPattern = card.querySelector('[data-field="urlPattern"]')?.value || '';
        updateUrlPatternTest(card, urlPattern, e.target.value);
      });
    }

    elements.captureRulesList.appendChild(card);
  });
}

function updateUrlPatternTest(card, pattern, testUrl) {
  const resultEl = card.querySelector('[data-field="urlTestResult"]');
  if (!resultEl) return;
  if (!testUrl.trim()) {
    resultEl.textContent = '';
    resultEl.className = 'regex-test-result';
    return;
  }
  if (!pattern.trim()) {
    resultEl.textContent = '请输入正则';
    resultEl.className = 'regex-test-result error';
    return;
  }
  const utils = window.AutoFormXCaptureUtils;
  const regex = utils ? utils.compilePattern(pattern) : (() => { try { return new RegExp(pattern); } catch { return null; } })();
  if (!regex) {
    resultEl.textContent = '无效正则';
    resultEl.className = 'regex-test-result error';
    return;
  }
  const matched = regex.test(testUrl);
  resultEl.textContent = matched ? '✓ 匹配' : '✗ 不匹配';
  resultEl.className = `regex-test-result ${matched ? 'match' : 'no-match'}`;
}

function updateDomainWhitelistTest() {
  if (!elements.domainWhitelistTestResult || !elements.responseCaptureDomainWhitelist) return;
  const text = elements.responseCaptureDomainWhitelist.value;
  const utils = window.AutoFormXCaptureUtils;
  if (!utils) {
    elements.domainWhitelistTestResult.textContent = '';
    elements.domainWhitelistTestResult.className = 'regex-test-result';
    return;
  }
  const patterns = utils.parsePatternLines(text);
  if (patterns.length === 0) {
    elements.domainWhitelistTestResult.textContent = '未配置规则';
    elements.domainWhitelistTestResult.className = 'regex-test-result error';
    return;
  }
  const invalid = patterns.filter((p) => !utils.compilePattern(p));
  if (invalid.length) {
    elements.domainWhitelistTestResult.textContent = `无效正则: ${invalid.join(', ')}`;
    elements.domainWhitelistTestResult.className = 'regex-test-result error';
    return;
  }

  const testHost = (elements.domainWhitelistTestInput?.value || '').trim();
  if (testHost) {
    const matched = utils.isDomainWhitelisted(testHost, text);
    elements.domainWhitelistTestResult.textContent = matched ? '✓ 匹配' : '✗ 不匹配';
    elements.domainWhitelistTestResult.className = `regex-test-result ${matched ? 'match' : 'no-match'}`;
  } else {
    elements.domainWhitelistTestResult.textContent = `${patterns.length} 条规则`;
    elements.domainWhitelistTestResult.className = 'regex-test-result';
  }
}

/**
 * 显示Toast提示
 */
function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type} show`;

  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
