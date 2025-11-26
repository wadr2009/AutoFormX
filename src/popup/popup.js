/**
 * 弹窗页面脚本 - AutoFormX
 */

// DOM元素
const elements = {
  statusCard: document.getElementById('statusCard'),
  fillFormBtn: document.getElementById('fillFormBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  helpBtn: document.getElementById('helpBtn'),
  todayCount: document.getElementById('todayCount'),
  totalCount: document.getElementById('totalCount')
};

/**
 * 初始化
 */
async function init() {
  await checkConfig();
  await loadStats();
  bindEvents();
}

/**
 * 检查配置状态
 */
async function checkConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      apiKey: '',
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

      if (items.apiKey) {
        elements.statusCard.classList.add('ready');
        statusTitle.textContent = '已就绪';
        
        // 获取提供商显示名称
        const providerNames = {
          'deepbricks': 'DeepBricks',
          'deepseek': 'DeepSeek',
          'openai': 'OpenAI',
          'qwen': '通义千问',
          'siliconcloud': '硅基流动',
          'nebius': 'Nebius AI',
          'openrouter': 'OpenRouter',
          'xai': 'xAI (Grok)',
          'mistral': 'Mistral AI',
          'custom': '自定义'
        };
        statusMessage.textContent = `使用 ${providerNames[items.provider] || items.provider}`;
        
        // 获取当前使用的模型
        const currentModel = items.selectedModels[items.provider] || items.model;
        const currentCustomModel = items.customModels[items.provider] || items.customModel;
        const displayModel = currentModel === 'custom' ? currentCustomModel : currentModel;
        
        if (displayModel && statusModel) {
          // 简化模型名称显示（去掉前缀路径）
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
        statusTitle.textContent = '未配置';
        statusMessage.textContent = '点击前往设置 API Key';
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
  // 一键填写按钮
  elements.fillFormBtn.addEventListener('click', handleFillForm);

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
}

/**
 * 处理填写表单
 */
async function handleFillForm() {
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
      { action: 'fillAllForms' },
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
