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
  saveBtn: document.getElementById('saveBtn'),
  testBtn: document.getElementById('testBtn'),
  toast: document.getElementById('toast')
};

// 本地模型列表缓存（带时间戳）
let modelListCache = {
  deepbricks: { models: [], timestamp: 0 },
  deepseek: { models: [], timestamp: 0 },
  openai: { models: [], timestamp: 0 },
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
const defaultProviderModels = {
  deepbricks: [
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo Preview' },
    { value: 'custom', label: '自定义模型...' }
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
    { value: 'custom', label: '自定义模型...' }
  ],
  openai: [
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo Preview' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-32k', label: 'GPT-4 32K' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-3.5-turbo-16k', label: 'GPT-3.5 Turbo 16K' },
    { value: 'custom', label: '自定义模型...' }
  ],
  qwen: [
    { value: 'qwen-max', label: 'Qwen Max (最强)' },
    { value: 'qwen-plus', label: 'Qwen Plus (均衡)' },
    { value: 'qwen-turbo', label: 'Qwen Turbo (快速)' },
    { value: 'custom', label: '自定义模型...' }
  ],
  siliconcloud: [
    { value: 'Qwen/QwQ-32B', label: 'QwQ-32B (推理)' },
    { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek-V3' },
    { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek-R1 (推理)' },
    { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B' },
    { value: 'Qwen/Qwen2.5-32B-Instruct', label: 'Qwen2.5-32B' },
    { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B' },
    { value: 'THUDM/glm-4-9b-chat', label: 'GLM-4-9B' },
    { value: 'custom', label: '自定义模型...' }
  ],
  nebius: [
    { value: 'meta-llama/Meta-Llama-3.1-405B-Instruct', label: 'Llama 3.1 405B' },
    { value: 'mistralai/Mistral-7B-Instruct-v0.2', label: 'Mistral 7B' },
    { value: 'custom', label: '自定义模型...' }
  ],
  openrouter: [
    { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'mistralai/mistral-7b-instruct', label: 'Mistral 7B' },
    { value: 'meta-llama/llama-2-70b-chat', label: 'Llama 2 70B' },
    { value: 'custom', label: '自定义模型...' }
  ],
  xai: [
    { value: 'grok-beta', label: 'Grok Beta' },
    { value: 'grok-vision-beta', label: 'Grok Vision Beta' },
    { value: 'custom', label: '自定义模型...' }
  ],
  mistral: [
    { value: 'mistral-large-latest', label: 'Mistral Large' },
    { value: 'mistral-medium-latest', label: 'Mistral Medium' },
    { value: 'mistral-small-latest', label: 'Mistral Small' },
    { value: 'custom', label: '自定义模型...' }
  ],
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
    showFieldButtons: true,
    showGlobalButton: true
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
    // 如果没有 API Key 或是自定义厂商，返回默认模型列表
    if (!apiKey && provider !== 'custom') {
      const fallbackModels = ensureCustomModelOption(defaultProviderModels[provider] || []);
      modelListCache[provider] = { models: fallbackModels, timestamp: now };
      return fallbackModels;
    }

    if (provider === 'custom') {
      return defaultProviderModels.custom;
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
      let models = ensureCustomModelOption(response.data);
      modelListCache[provider] = { models: models, timestamp: now };
      return models;
    } else {
      // 如果获取失败，返回默认模型列表
      const fallbackModels = ensureCustomModelOption(defaultProviderModels[provider] || []);
      modelListCache[provider] = { models: fallbackModels, timestamp: now };
      return fallbackModels;
    }
    
  } catch (error) {
    console.warn('[AutoFormX] 获取模型列表失败，使用默认列表:', error);
    const fallbackModels = ensureCustomModelOption(defaultProviderModels[provider] || []);
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
      showGlobalButton: elements.showGlobalButton.checked
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
      updateModelList(provider);
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
