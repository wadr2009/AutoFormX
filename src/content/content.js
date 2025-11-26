/**
 * Content Script - 页面注入脚本
 * 负责扫描表单、添加按钮、处理用户交互
 */

(function() {
  'use strict';

  // 配置
  let config = {
    showFieldButtons: true,
    showGlobalButton: true,
    globalButtonPosition: { bottom: '32px', right: '32px' }
  };

  // 已处理的字段集合，避免重复添加按钮
  const processedFields = new WeakSet();
  
  // 全局按钮元素
  let globalButton = null;

  /**
   * 初始化
   */
  async function init() {
    console.log('[AutoFormX] 开始初始化...');
    
    // 加载配置
    await loadConfig();
    
    // 扫描页面中的表单字段
    scanAndProcessFields();
    
    // 添加全局按钮
    if (config.showGlobalButton) {
      createGlobalButton();
    }
    
    // 监听DOM变化
    observePageChanges();
    
    console.log('[AutoFormX] 初始化完成 ✓');
  }

  /**
   * 加载配置
   */
  async function loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        showFieldButtons: true,
        showGlobalButton: true,
        globalButtonPosition: { bottom: '32px', right: '32px' }
      }, (items) => {
        config = items;
        console.log('[AutoFormX] 配置已加载:', config);
        resolve();
      });
    });
  }

  /**
   * 扫描并处理表单字段
   */
  function scanAndProcessFields() {
    // 查找所有表单元素
    const fields = document.querySelectorAll('input, textarea, select');
    
    fields.forEach(field => {
      if (!processedFields.has(field) && isValidField(field)) {
        processField(field);
        processedFields.add(field);
      }
    });
  }

  /**
   * 判断是否为有效的表单字段
   */
  function isValidField(field) {
    // 排除隐藏字段
    if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') {
      return false;
    }
    
    // 排除不可见字段
    if (field.offsetParent === null) {
      return false;
    }
    
    // 排除只读和禁用字段
    if (field.readOnly || field.disabled) {
      return false;
    }
    
    return true;
  }

  /**
   * 处理单个字段
   */
  function processField(field) {
    if (!config.showFieldButtons) return;
    
    // 检测字段类型
    const detection = window.FieldDetector.detectFieldType(field);
    
    // 为字段添加标识
    field.setAttribute('data-autoformx-type', detection.type);
    field.setAttribute('data-autoformx-confidence', detection.confidence);
    
    // 添加AI生成按钮
    addFieldButton(field, detection);
  }

  /**
   * 为字段添加AI生成按钮
   */
  function addFieldButton(field, detection) {
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'autoformx-field-button';
    buttonContainer.title = `AI生成${window.FieldDetector.getFieldTypeDescription(detection.type)}`;
    
    // 创建按钮图标（魔法棒）
    buttonContainer.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M14 2L10 6M14 2L12 4M14 2L15 1M10 6L8 8M10 6L11 7M8 8L2 14M8 8L6 10M2 14L1 15M2 14L4 12" 
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="3" cy="5" r="0.8" fill="currentColor"/>
        <circle cx="6" cy="2" r="0.8" fill="currentColor"/>
        <circle cx="11" cy="11" r="0.8" fill="currentColor"/>
      </svg>
    `;
    
    // 添加点击事件
    buttonContainer.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleFieldButtonClick(field, buttonContainer, detection);
    });
    
    // 添加Hover事件来显示按钮
    buttonContainer.addEventListener('mouseenter', () => {
      buttonContainer.classList.add('visible');
    });
    
    buttonContainer.addEventListener('mouseleave', () => {
      // 仅在input失焦时隐藏
      if (document.activeElement !== field) {
        buttonContainer.classList.remove('visible');
      }
    });
    
    // 当相关的input获得焦点时显示按钮
    field.addEventListener('focus', () => {
      buttonContainer.classList.add('visible');
    });
    
    // 当input失焦时隐藏按钮（除非鼠标悬停）
    field.addEventListener('blur', () => {
      if (!buttonContainer.matches(':hover')) {
        buttonContainer.classList.remove('visible');
      }
    });
    
    // 将按钮定位到字段旁边
    positionFieldButton(field, buttonContainer);
    
    document.body.appendChild(buttonContainer);
    
    // 监听字段位置变化
    observeFieldPosition(field, buttonContainer);
  }

  /**
   * 定位字段按钮
   */
  function positionFieldButton(field, button) {
    const rect = field.getBoundingClientRect();
    button.style.position = 'fixed';
    button.style.left = `${rect.right - 30}px`;
    button.style.top = `${rect.top + (rect.height - 26) / 2}px`;
    button.style.zIndex = '999999';
  }

  /**
   * 监听字段位置变化
   */
  function observeFieldPosition(field, button) {
    // 使用 Intersection Observer 优化性能
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          positionFieldButton(field, button);
        } else {
          button.style.display = 'none';
        }
      });
    });
    
    observer.observe(field);
    
    // 滚动时更新位置
    let scrollTimeout;
    const scrollHandler = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (field.offsetParent !== null) {
          positionFieldButton(field, button);
          button.style.display = 'flex';
        }
      }, 100);
    };
    
    window.addEventListener('scroll', scrollHandler, { passive: true });
    window.addEventListener('resize', scrollHandler, { passive: true });
  }

  /**
   * 处理字段按钮点击
   */
  async function handleFieldButtonClick(field, button, detection) {
    // 显示加载状态
    button.classList.add('autoformx-loading');
    
    try {
      // 获取字段标签
      const label = window.FieldDetector.getFieldLabel(field);
      
      // 发送消息给background script
      const response = await chrome.runtime.sendMessage({
        action: 'generateFieldData',
        data: {
          fieldType: detection.type,
          fieldLabel: label,
          fieldName: field.name || field.id
        }
      });
      
      if (response.success) {
        // 填充数据到字段
        fillField(field, response.data);
        
        // 显示成功提示
        showToast('生成成功', 'success');
      } else {
        throw new Error(response.error || '生成失败');
      }
    } catch (error) {
      console.error('生成数据失败:', error);
      showToast(error.message || '生成失败，请检查配置', 'error');
    } finally {
      // 移除加载状态
      button.classList.remove('autoformx-loading');
    }
  }

  /**
   * 创建全局填写按钮（悬浮球）
   */
  function createGlobalButton() {
    // 避免重复创建
    if (globalButton && document.body.contains(globalButton)) {
      return;
    }

    globalButton = document.createElement('div');
    globalButton.id = 'autoformx-global-button';
    globalButton.className = 'autoformx-global-button';
    
    // 使用更醒目的魔法棒图标
    globalButton.innerHTML = `
      <div class="autoformx-global-button-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M21 3L15 9M21 3L19 5M21 3L22 2M15 9L11 13M15 9L16 10M11 13L4 20M11 13L9 15M4 20L3 21M4 20L6 18" 
                stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="6" cy="8" r="1.5" fill="white" opacity="0.9"/>
          <circle cx="10" cy="4" r="1.2" fill="white" opacity="0.8"/>
          <circle cx="18" cy="18" r="1.5" fill="white" opacity="0.9"/>
        </svg>
      </div>
    `;

    // 设置初始位置
    globalButton.style.bottom = config.globalButtonPosition.bottom || '32px';
    globalButton.style.right = config.globalButtonPosition.right || '32px';

    // 添加点击事件
    globalButton.addEventListener('click', (e) => {
      // 如果正在拖动则不触发点击
      if (globalButton.dataset.dragging === 'true') {
        return;
      }
      handleGlobalButtonClick();
    });

    // 添加拖动功能
    makeButtonDraggable(globalButton);

    // 添加到页面
    document.body.appendChild(globalButton);
    
    console.log('[AutoFormX] 悬浮球已创建 ✓');
  }

  /**
   * 使按钮可拖动
   */
  function makeButtonDraggable(button) {
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, startLeft, startTop;

    button.addEventListener('mousedown', (e) => {
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = button.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      button.style.transition = 'none';
      button.style.animation = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // 超过5px才算移动
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          hasMoved = true;
          button.dataset.dragging = 'true';
        }
        
        button.style.left = `${startLeft + deltaX}px`;
        button.style.top = `${startTop + deltaY}px`;
        button.style.right = 'auto';
        button.style.bottom = 'auto';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        button.style.transition = '';
        
        // 短暂延迟后重置拖动状态，防止触发点击
        setTimeout(() => {
          button.dataset.dragging = 'false';
        }, 100);

        // 保存位置
        const rect = button.getBoundingClientRect();
        const position = {
          bottom: `${window.innerHeight - rect.bottom}px`,
          right: `${window.innerWidth - rect.right}px`
        };
        chrome.storage.sync.set({ globalButtonPosition: position });
      }
    });
  }

  /**
   * 处理全局按钮点击
   */
  async function handleGlobalButtonClick() {
    // 收集所有表单字段
    const fields = collectAllFields();
    
    if (fields.length === 0) {
      showToast('未找到可填写的表单字段', 'warning');
      return;
    }
    
    // 显示加载状态
    globalButton.classList.add('autoformx-loading');
    
    try {
      // 准备精简的字段信息（不发送HTML）
      const fieldInfos = fields.map(field => buildFieldContext(field));
      
      console.log('[AutoFormX] 批量生成字段数量:', fieldInfos.length);
      console.log('[AutoFormX] 发送给AI的字段信息:', fieldInfos);
      
      // 发送消息给background script
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'generateBatchData',
          data: {
            fields: fieldInfos
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
        // 填充数据到字段
        let successCount = 0;
        fields.forEach((field, index) => {
          const fieldKey = field.name || field.id || `field_${index}`;
          if (response.data[fieldKey]) {
            fillField(field, response.data[fieldKey]);
            successCount++;
          }
        });
        
        showToast(`成功填写 ${successCount}/${fields.length} 个字段`, 'success');
        console.log(`[AutoFormX] 一键填写完成: ${successCount}/${fields.length}`);
        
        // 增加统计数据
        incrementStats();
      } else {
        throw new Error(response.error || '生成失败');
      }
    } catch (error) {
      console.error('[AutoFormX] 批量生成数据失败:', error);
      showToast(error.message || '生成失败，请检查配置', 'error');
    } finally {
      globalButton.classList.remove('autoformx-loading');
    }
  }

  /**
   * 收集所有表单字段并构建精简的字段信息
   */
  function collectAllFields() {
    const fields = [];
    const allFields = document.querySelectorAll('input, textarea, select');
    
    allFields.forEach(field => {
      if (isValidField(field)) {
        // 确保字段已被处理
        if (!processedFields.has(field)) {
          const detection = window.FieldDetector.detectFieldType(field);
          field.setAttribute('data-autoformx-type', detection.type);
          processedFields.add(field);
        }
        fields.push(field);
      }
    });
    
    return fields;
  }

  /**
   * 为字段构建精简的上下文信息（不包含整个HTML）
   */
  function buildFieldContext(field) {
    const fieldType = field.getAttribute('data-autoformx-type') || 'text';
    const label = window.FieldDetector.getFieldLabel(field);
    
    // 构建字段的约束信息
    const context = {
      type: fieldType,
      label: label || field.name || field.id || '未知字段',
      name: field.name,
      id: field.id,
      placeholder: field.placeholder,
      maxLength: field.maxLength && field.maxLength > 0 ? field.maxLength : null,
      pattern: field.pattern,
      required: field.required,
      readonly: field.readOnly,
    };
    
    // 对于select，添加option选项
    if (field.tagName.toLowerCase() === 'select') {
      const options = Array.from(field.options)
        .filter(opt => opt.value && opt.value !== '')
        .map(opt => ({
          value: opt.value,
          text: opt.text
        }))
        .slice(0, 10); // 最多发送10个选项
      context.options = options;
    }
    
    // 对于textarea，添加行列信息
    if (field.tagName.toLowerCase() === 'textarea') {
      context.rows = field.rows;
      context.cols = field.cols;
    }
    
    return context;
  }

  /**
   * 填充字段数据
   */
  function fillField(field, value) {
    if (!field || !value) {
      console.warn('[AutoFormX] 无效的字段或值:', field, value);
      return;
    }

    const tagName = field.tagName.toLowerCase();
    
    try {
      if (tagName === 'select') {
        // 对于select，先清空，再尝试找到匹配的option
        field.value = '';
        
        const options = Array.from(field.options);
        const matchedOption = options.find(opt => 
          opt.value === value || opt.text === value || opt.value.toString() === value.toString()
        );
        
        if (matchedOption) {
          field.value = matchedOption.value;
        } else if (options.length > 1) {
          // 如果没有匹配的，选择第一个非空option
          for (const opt of options) {
            if (opt.value && opt.value !== '') {
              field.value = opt.value;
              break;
            }
          }
        }
      } else if (field.type === 'checkbox') {
        // 对于checkbox，50%概率选中
        field.checked = Math.random() > 0.5;
      } else if (field.type === 'radio') {
        // 对于radio，选中当前的
        field.checked = true;
      } else {
        // 普通输入框：先清空，再填充
        field.value = '';
        field.value = value.toString().trim();
      }
      
      // 触发change和input事件，兼容各种框架
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // 针对React的特殊处理
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(field, value.toString().trim());
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      console.log(`[AutoFormX] 成功填充字段: ${field.name || field.id || '未命名'} = ${value}`);
    } catch (error) {
      console.error('[AutoFormX] 填充字段失败:', error, field);
    }
  }

  /**
   * 显示提示消息
   */
  function showToast(message, type = 'info') {
    // 移除已存在的toast
    const existingToast = document.querySelector('.autoformx-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `autoformx-toast autoformx-toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 动画显示
    requestAnimationFrame(() => {
      toast.classList.add('autoformx-toast-show');
    });
    
    // 3秒后移除
    setTimeout(() => {
      toast.classList.remove('autoformx-toast-show');
      setTimeout(() => toast.remove(), 350);
    }, 3000);
  }

  /**
   * 监听页面DOM变化
   */
  function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      
      if (shouldScan) {
        // 防抖处理
        clearTimeout(observer.scanTimeout);
        observer.scanTimeout = setTimeout(() => {
          scanAndProcessFields();
        }, 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
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

      console.log(`[AutoFormX] 统计已更新 - 今日: ${todayCount}, 累计: ${totalCount}`);
    });
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /**
   * 监听来自popup或background的消息
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[AutoFormX] 收到消息:', request);

    try {
      if (request.action === 'fillAllForms') {
        // 处理一键填写请求
        console.log('[AutoFormX] 执行一键填写表单');
        
        // 收集所有表单字段
        const fields = collectAllFields();

        if (fields.length === 0) {
          sendResponse({ 
            success: false, 
            error: '未找到可填写的表单字段' 
          });
          return;
        }

        // 显示加载状态
        if (globalButton) {
          globalButton.classList.add('autoformx-loading');
        }

        try {
          // 准备字段信息
          const fieldInfos = fields.map(field => ({
            type: field.getAttribute('data-autoformx-type') || 'text',
            label: window.FieldDetector.getFieldLabel(field),
            name: field.name || field.id || `field_${Math.random()}`
          }));

          // 发送消息给background script
          chrome.runtime.sendMessage({
            action: 'generateBatchData',
            data: {
              fields: fieldInfos
            }
          }, (response) => {
            if (response && response.success) {
              // 填充数据到字段
              fields.forEach((field, index) => {
                const fieldName = fieldInfos[index].name;
                if (response.data[fieldName]) {
                  fillField(field, response.data[fieldName]);
                }
              });

              showToast(`成功填写 ${fields.length} 个字段`, 'success');
              console.log('[AutoFormX] 批量填写完成');
              sendResponse({ 
                success: true, 
                message: `成功填写 ${fields.length} 个字段` 
              });
            } else {
              throw new Error(response?.error || '生成失败');
            }

            // 移除加载状态
            if (globalButton) {
              globalButton.classList.remove('autoformx-loading');
            }
          });

          // 不立即返回，等待background的响应
          return true;
        } catch (error) {
          console.error('[AutoFormX] 批量生成数据失败:', error);
          showToast(error.message || '生成失败，请检查配置', 'error');
          
          // 移除加载状态
          if (globalButton) {
            globalButton.classList.remove('autoformx-loading');
          }

          sendResponse({ 
            success: false, 
            error: error.message 
          });
        }
      } else {
        // 未知的action
        sendResponse({ 
          success: false, 
          error: `未知的action: ${request.action}` 
        });
      }
    } catch (error) {
      console.error('[AutoFormX] 消息处理异常:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  });
})();
