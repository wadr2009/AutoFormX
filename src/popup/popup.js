/**
 * 弹窗页面脚本 - AutoFormX
 */

// DOM元素
const elements = {
  statusCard: document.getElementById('statusCard'),
  quickSwitchCard: document.getElementById('quickSwitchCard'),
  fillFormBtn: document.getElementById('fillFormBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  helpBtn: document.getElementById('helpBtn'),
  shortcutBtn: document.getElementById('shortcutBtn'),
  todayCount: document.getElementById('todayCount'),
  totalCount: document.getElementById('totalCount'),
  providerQuickSwitch: document.getElementById('providerQuickSwitch'),
  modelQuickSwitch: document.getElementById('modelQuickSwitch'),
  applySwitchBtn: document.getElementById('applySwitchBtn'),
  toggleQuickSwitchBtn: document.getElementById('toggleQuickSwitchBtn'),
  quickSwitchSummary: document.getElementById('quickSwitchSummary'),
  customPromptInput: document.getElementById('customPromptInput'),
  clearPromptBtn: document.getElementById('clearPromptBtn'),
  promptStatus: document.getElementById('promptStatus'),
  promptCount: document.getElementById('promptCount')
};

const providerNames = {
  deepbricks: 'DeepBricks',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  moonshot: 'Moonshot (Kimi)',
  zhipu: 'Zhipu GLM',
  bailian: 'Bailian',
  stepfun: 'StepFun',
  minimax: 'MiniMax',
  groq: 'Groq',
  together: 'Together AI',
  fireworks: 'Fireworks AI',
  perplexity: 'Perplexity',
  qwen: '通义千问',
  siliconcloud: '硅基流动',
  nebius: 'Nebius AI',
  openrouter: 'OpenRouter',
  xai: 'xAI (Grok)',
  mistral: 'Mistral AI',
  custom: '自定义'
};

const providerDefaultApiBaseUrl = {
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

// 默认模型列表
// 仅为自定义厂商提供“自定义模型”占位，其它厂商的模型列表完全依赖真实 API，
// 在无 API Key 或无法获取模型列表时不再使用硬编码默认值。
const defaultProviderModels = {
  custom: [
    { value: 'custom', label: '自定义模型...' }
  ]
};

let currentSettings = null;
let modelRenderRequestId = 0;
let switchResultTimer = null;
let promptSaveTimer = null;
const MAX_PROMPT_LENGTH = 500;
const allQuickSwitchProviderOptions = Array.from(elements.providerQuickSwitch.options).map((option) => ({
  value: option.value,
  label: option.textContent
}));

/**
 * 初始化
 */
async function init() {
  await loadQuickSwitch();
  await checkConfig();
  await loadStats();
  await loadCustomPrompt();
  bindEvents();
}

/**
 * 检查配置状态
 */
async function checkConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      apiKey: '',
      apiKeys: {},
      provider: 'deepbricks',
      model: '',
      customModel: '',
      selectedModels: {},
      customModels: {}
    }, (items) => {
      const statusIndicator = elements.statusCard.querySelector('.status-indicator');
      const statusTitle = elements.statusCard.querySelector('.status-title');
      const statusMessage = elements.statusCard.querySelector('.status-message');
      const statusModel = document.getElementById('statusModel');
      const providerApiKey = (items.apiKeys && items.apiKeys[items.provider]) || items.apiKey;

      const currentModel = items.selectedModels[items.provider] || items.model;
      const currentCustomModel = items.customModels[items.provider] || items.customModel;
      const displayModel = currentModel === 'custom' ? currentCustomModel : currentModel;
      const hasValidModel = currentModel !== 'custom' || Boolean(currentCustomModel);

      if (providerApiKey && hasValidModel) {
        elements.statusCard.classList.add('ready');
        statusTitle.textContent = '已就绪';
        statusMessage.textContent = `使用 ${providerNames[items.provider] || items.provider}`;

        if (displayModel && statusModel) {
          const shortModelName = displayModel.includes('/') 
            ? displayModel.split('/').pop() 
            : displayModel;
          statusModel.textContent = `模型: ${shortModelName}`;
          statusModel.style.display = 'block';
        } else if (statusModel) {
          statusModel.style.display = 'none';
        }
        
        elements.fillFormBtn.disabled = false;
      } else {
        elements.statusCard.classList.remove('ready');
        statusTitle.textContent = '未就绪';
        statusMessage.textContent = providerApiKey ? '请先配置有效模型' : '点击前往设置 API Key';
        if (statusModel) {
          statusModel.style.display = 'none';
        }
        elements.fillFormBtn.disabled = true;
      }

      resolve();
    });
  });
}

/**
 * 加载统计数据
 */
async function loadStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get({
      todayCount: 0,
      totalCount: 0,
      lastDate: new Date().toDateString()
    }, (items) => {
      const today = new Date().toDateString();
      
      // 如果是新的一天，重置今日计数
      if (items.lastDate !== today) {
        items.todayCount = 0;
        items.lastDate = today;
        chrome.storage.local.set({
          todayCount: 0,
          lastDate: today
        });
      }

      // 动画更新数字
      animateNumber(elements.todayCount, items.todayCount);
      animateNumber(elements.totalCount, items.totalCount);

      resolve();
    });
  });
}

/**
 * 数字动画效果
 */
function animateNumber(element, targetValue) {
  const duration = 500;
  const startValue = parseInt(element.textContent) || 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // 使用 easeOutQuart 缓动函数
    const easeProgress = 1 - Math.pow(1 - progress, 4);
    const currentValue = Math.round(startValue + (targetValue - startValue) * easeProgress);
    
    element.textContent = currentValue;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

/**
 * 增加使用统计
 */
function incrementStats() {
  chrome.storage.local.get({
    todayCount: 0,
    totalCount: 0,
    lastDate: new Date().toDateString()
  }, (items) => {
    const today = new Date().toDateString();
    
    let todayCount = items.todayCount;
    let totalCount = items.totalCount;

    // 如果是新的一天，重置今日计数
    if (items.lastDate !== today) {
      todayCount = 0;
    }

    todayCount++;
    totalCount++;

    chrome.storage.local.set({
      todayCount,
      totalCount,
      lastDate: today
    });

    animateNumber(elements.todayCount, todayCount);
    animateNumber(elements.totalCount, totalCount);
  });
}

/**
 * 绑定事件
 */
function bindEvents() {
  elements.providerQuickSwitch.addEventListener('change', async (event) => {
    await renderQuickSwitchModels(event.target.value);
  });

  elements.modelQuickSwitch.addEventListener('change', updateQuickSwitchSummary);

  elements.applySwitchBtn.addEventListener('click', applyQuickSwitch);

  elements.toggleQuickSwitchBtn.addEventListener('click', () => {
    setQuickSwitchExpanded(elements.quickSwitchCard.classList.contains('is-collapsed'));
  });

  // 一键填写按钮
  elements.fillFormBtn.addEventListener('click', handleFillForm);

  elements.customPromptInput.addEventListener('input', handlePromptInput);

  elements.clearPromptBtn.addEventListener('click', () => {
    elements.customPromptInput.value = '';
    updatePromptMeta();
    saveCustomPrompt('');
    elements.customPromptInput.focus();
  });

  // 状态卡片点击跳转设置
  elements.statusCard.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 设置按钮
  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 帮助按钮 - 打开本地帮助页面
  elements.helpBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/help/help.html')
    });
  });

  elements.shortcutBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }, () => {
      if (chrome.runtime.lastError) {
        chrome.runtime.openOptionsPage();
      }
    });
  });
}

async function loadCustomPrompt() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      customPrompt: ''
    }, (items) => {
      elements.customPromptInput.value = normalizePrompt(items.customPrompt);
      updatePromptMeta();
      resolve();
    });
  });
}

function handlePromptInput() {
  const normalizedPrompt = normalizePrompt(elements.customPromptInput.value);
  if (elements.customPromptInput.value !== normalizedPrompt) {
    elements.customPromptInput.value = normalizedPrompt;
  }

  updatePromptMeta();

  clearTimeout(promptSaveTimer);
  promptSaveTimer = setTimeout(() => {
    saveCustomPrompt(elements.customPromptInput.value);
  }, 300);
}

function normalizePrompt(prompt) {
  return String(prompt || '').slice(0, MAX_PROMPT_LENGTH);
}

function getCurrentPrompt() {
  return elements.customPromptInput.value.trim();
}

function updatePromptMeta() {
  const length = elements.customPromptInput.value.length;
  const hasPrompt = getCurrentPrompt().length > 0;
  elements.promptCount.textContent = `${length}/${MAX_PROMPT_LENGTH}`;
  elements.promptStatus.textContent = hasPrompt ? '将应用自定义要求' : '默认规则';
  elements.clearPromptBtn.disabled = !hasPrompt;
}

function saveCustomPrompt(customPrompt) {
  chrome.storage.sync.set({
    customPrompt: normalizePrompt(customPrompt)
  });
}

async function loadQuickSwitch() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      apiKey: '',
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
      provider: 'deepbricks',
      model: 'gpt-4-turbo',
      customModel: '',
      selectedModels: {},
      customModels: {},
      apiBaseUrl: providerDefaultApiBaseUrl.deepbricks
    }, async (items) => {
      currentSettings = items;
      const configuredProviders = getConfiguredProviders(items.apiKeys, items.provider, items.apiKey);

      if (configuredProviders.length === 0) {
        elements.quickSwitchCard.classList.add('is-hidden');
        resolve();
        return;
      }

      elements.quickSwitchCard.classList.remove('is-hidden');
      const activeProvider = configuredProviders.includes(items.provider)
        ? items.provider
        : configuredProviders[0];

      renderProviderQuickSwitchOptions(configuredProviders, activeProvider);
      elements.providerQuickSwitch.value = activeProvider;
      await renderQuickSwitchModels(activeProvider, items);
      resolve();
    });
  });
}

function getConfiguredProviders(apiKeys, currentProvider, fallbackApiKey) {
  if (!apiKeys || typeof apiKeys !== 'object') {
    apiKeys = {};
  }

  const configured = allQuickSwitchProviderOptions
    .map((option) => option.value)
    .filter((provider) => {
      const key = apiKeys[provider];
      return typeof key === 'string' && key.trim() !== '';
    });

  if (configured.length === 0 && typeof fallbackApiKey === 'string' && fallbackApiKey.trim() !== '') {
    const currentProviderExists = allQuickSwitchProviderOptions.some((option) => option.value === currentProvider);
    if (currentProviderExists) {
      configured.push(currentProvider);
    }
  }

  return configured;
}

function renderProviderQuickSwitchOptions(providers, selectedProvider) {
  elements.providerQuickSwitch.innerHTML = '';

  providers.forEach((provider) => {
    const option = allQuickSwitchProviderOptions.find((item) => item.value === provider);
    if (!option) {
      return;
    }
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    elements.providerQuickSwitch.appendChild(optionEl);
  });

  if (selectedProvider && providers.includes(selectedProvider)) {
    elements.providerQuickSwitch.value = selectedProvider;
  }

  updateQuickSwitchSummary();
}

function ensureCustomModelOption(models) {
  const list = Array.isArray(models) ? [...models] : [];
  if (!list.some((item) => item.value === 'custom')) {
    list.push({ value: 'custom', label: '自定义模型...' });
  }
  return list;
}

async function fetchModelsForProvider(provider, settings) {
  if (provider === 'custom') {
    // 仅在选择“自定义”供应商时，才提供“自定义模型”占位选项
    return ensureCustomModelOption(defaultProviderModels.custom);
  }

  const apiKey = (settings.apiKeys && settings.apiKeys[provider]) || settings.apiKey || '';
  const apiBaseUrl = providerDefaultApiBaseUrl[provider] || settings.apiBaseUrl || '';

  if (!apiKey) {
    // 无 API Key 时认为不知道该厂商的可用模型列表，直接返回空数组，
    // 不再为已配置供应商追加“自定义模型”占位。
    return [];
  }

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'fetchModelList',
        data: { apiBaseUrl, apiKey, provider }
      }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    });

    if (response.success && Array.isArray(response.data) && response.data.length > 0) {
      // 对于已配置供应商，模型下拉框只展示真实模型列表
      return response.data;
    }
  } catch (error) {
    console.warn('[AutoFormX Popup] 拉取模型列表失败，不再使用硬编码默认模型:', error);
  }

  // 未能获取到真实列表时，如果该厂商当前在设置页里使用了“自定义模型”，
  // 则至少在下拉中回显这一项；否则返回空数组。
  const selectedModels = settings.selectedModels || {};
  const customModels = settings.customModels || {};
  const isUsingCustomModel = selectedModels[provider] === 'custom' && customModels[provider];

  if (isUsingCustomModel) {
    return [
      {
        value: 'custom',
        label: customModels[provider]
      }
    ];
  }

  return [];
}

async function renderQuickSwitchModels(provider, settings = currentSettings) {
  const requestId = ++modelRenderRequestId;
  elements.modelQuickSwitch.innerHTML = '<option value="">加载中...</option>';
  elements.modelQuickSwitch.disabled = true;

  const models = await fetchModelsForProvider(provider, settings);
  if (requestId !== modelRenderRequestId || provider !== elements.providerQuickSwitch.value) {
    return;
  }

  elements.modelQuickSwitch.innerHTML = '';

  models.forEach((model) => {
    const option = document.createElement('option');
    option.value = model.value;
    option.textContent = model.label;
    elements.modelQuickSwitch.appendChild(option);
  });

  const preferredModel = settings.selectedModels[provider] || settings.model || models[0]?.value || '';
  const modelExists = models.some((item) => item.value === preferredModel);
  elements.modelQuickSwitch.value = modelExists ? preferredModel : (models[0]?.value || '');
  elements.modelQuickSwitch.disabled = false;
  updateQuickSwitchSummary();
}

function setQuickSwitchExpanded(isExpanded) {
  elements.quickSwitchCard.classList.toggle('is-collapsed', !isExpanded);
  elements.toggleQuickSwitchBtn.textContent = isExpanded ? '收起' : '展开';
}

function updateQuickSwitchSummary() {
  const provider = elements.providerQuickSwitch.value;
  const providerName = providerNames[provider] || provider || '当前服务商';
  const selectedOption = elements.modelQuickSwitch.selectedOptions && elements.modelQuickSwitch.selectedOptions[0];
  const modelText = selectedOption && selectedOption.value ? selectedOption.textContent : '当前模型';
  elements.quickSwitchSummary.textContent = `${providerName} / ${modelText}`;
}

async function applyQuickSwitch() {
  const provider = elements.providerQuickSwitch.value;
  const model = elements.modelQuickSwitch.value;

  if (!provider || !model) {
    return;
  }

  elements.applySwitchBtn.disabled = true;
  elements.providerQuickSwitch.disabled = true;
  elements.modelQuickSwitch.disabled = true;
  elements.applySwitchBtn.textContent = '应用中...';

  chrome.storage.sync.get({
    selectedModels: {},
    customModels: {},
    apiBaseUrl: providerDefaultApiBaseUrl.deepbricks
  }, (items) => {
    const previousModel = (currentSettings?.selectedModels && currentSettings.selectedModels[provider])
      || currentSettings?.model
      || '';
    const selectedModels = { ...items.selectedModels };
    selectedModels[provider] = model;

    const customModels = { ...items.customModels };
    if (model !== 'custom') {
      customModels[provider] = '';
    }

    if (model === 'custom' && !customModels[provider]) {
      elements.applySwitchBtn.disabled = false;
      elements.providerQuickSwitch.disabled = false;
      elements.modelQuickSwitch.disabled = false;
      elements.applySwitchBtn.textContent = '应用并记住';
      if (previousModel && Array.from(elements.modelQuickSwitch.options).some((o) => o.value === previousModel)) {
        elements.modelQuickSwitch.value = previousModel;
      }
      showSwitchResult('请先在设置页填写自定义模型', true);
      return;
    }

    const nextBaseUrl = provider === 'custom'
      ? items.apiBaseUrl
      : (providerDefaultApiBaseUrl[provider] || items.apiBaseUrl);

    chrome.storage.sync.set({
      provider,
      model,
      customModel: model === 'custom' ? (customModels[provider] || '') : '',
      selectedModels,
      customModels,
      apiBaseUrl: nextBaseUrl
    }, async () => {
      await loadQuickSwitch();
      await checkConfig();
      elements.applySwitchBtn.disabled = false;
      elements.providerQuickSwitch.disabled = false;
      elements.modelQuickSwitch.disabled = false;
      elements.applySwitchBtn.textContent = '应用并记住';
      showSwitchResult(`已切换到 ${providerNames[provider]} / ${model}`);
    });
  });
}

function showSwitchResult(message, isError = false) {
  if (switchResultTimer) {
    clearTimeout(switchResultTimer);
  }
  elements.applySwitchBtn.textContent = message;
  elements.applySwitchBtn.style.borderColor = isError ? '#ef4444' : '#22c55e';

  switchResultTimer = setTimeout(() => {
    elements.applySwitchBtn.textContent = '应用并记住';
    elements.applySwitchBtn.style.borderColor = '';
    switchResultTimer = null;
  }, 1400);
}

/**
 * 处理填写表单
 */
async function handleFillForm() {
  const customPrompt = getCurrentPrompt();
  saveCustomPrompt(customPrompt);

  // 显示加载状态
  elements.fillFormBtn.classList.add('loading');
  elements.fillFormBtn.disabled = true;
  
  const btnTitle = elements.fillFormBtn.querySelector('.btn-title');
  const btnSubtitle = elements.fillFormBtn.querySelector('.btn-subtitle');
  const originalTitle = btnTitle.textContent;
  const originalSubtitle = btnSubtitle.textContent;
  
  btnTitle.textContent = '正在生成...';
  btnSubtitle.textContent = 'AI 正在智能识别表单';

  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('无法获取当前标签页');
    }

    console.log('[AutoFormX Popup] 向content script发送消息，标签页ID:', tab.id);

    // 向content script发送消息
    chrome.tabs.sendMessage(
      tab.id,
      {
        action: 'fillAllForms',
        data: {
          customPrompt
        }
      },
      (response) => {
        console.log('[AutoFormX Popup] 收到响应:', response);

        if (chrome.runtime.lastError) {
          console.error('[AutoFormX Popup] 消息发送错误:', chrome.runtime.lastError.message);
          showButtonError('连接失败', '请刷新页面后重试');
        } else if (response && response.success) {
          // 增加统计
          incrementStats();
          // 显示成功提示
          showButtonSuccess();
        } else {
          showButtonError('填写失败', response?.error || '请重试');
        }

        // 恢复按钮状态
        setTimeout(() => {
          elements.fillFormBtn.classList.remove('loading', 'success', 'error');
          elements.fillFormBtn.disabled = false;
          btnTitle.textContent = originalTitle;
          btnSubtitle.textContent = originalSubtitle;
        }, 2000);
      }
    );
  } catch (error) {
    console.error('[AutoFormX Popup] 填写表单异常:', error);
    showButtonError('操作失败', error.message || '请重试');
    
    // 恢复按钮状态
    setTimeout(() => {
      elements.fillFormBtn.classList.remove('loading', 'success', 'error');
      elements.fillFormBtn.disabled = false;
      btnTitle.textContent = originalTitle;
      btnSubtitle.textContent = originalSubtitle;
    }, 2000);
  }
}

/**
 * 显示成功状态
 */
function showButtonSuccess() {
  const btnTitle = elements.fillFormBtn.querySelector('.btn-title');
  const btnSubtitle = elements.fillFormBtn.querySelector('.btn-subtitle');
  const btnIcon = elements.fillFormBtn.querySelector('.btn-icon');
  
  elements.fillFormBtn.classList.remove('loading');
  elements.fillFormBtn.classList.add('success');
  
  btnIcon.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  btnTitle.textContent = '填写成功';
  btnSubtitle.textContent = '表单已自动填充完成';
}

/**
 * 显示错误状态
 */
function showButtonError(title, message) {
  const btnTitle = elements.fillFormBtn.querySelector('.btn-title');
  const btnSubtitle = elements.fillFormBtn.querySelector('.btn-subtitle');
  const btnIcon = elements.fillFormBtn.querySelector('.btn-icon');
  
  elements.fillFormBtn.classList.remove('loading');
  elements.fillFormBtn.classList.add('error');
  
  btnIcon.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `;
  btnTitle.textContent = title;
  btnSubtitle.textContent = message;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
