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
    // 查找所有原生表单元素
    const nativeFields = document.querySelectorAll('input, textarea, select');
    
    nativeFields.forEach(field => {
      if (!processedFields.has(field) && isValidField(field)) {
        processField(field);
        processedFields.add(field);
      }
    });
    
    // 查找自定义下拉框组件
    scanCustomSelectComponents();
  }

  /**
   * 扫描自定义下拉框组件
   */
  function scanCustomSelectComponents() {
    // 常见 UI 框架的下拉框选择器
    const customSelectSelectors = [
      // Ant Design
      '.ant-select:not([data-autoformx-processed])',
      // Element UI / Plus
      '.el-select:not([data-autoformx-processed])',
      // Naive UI
      '.n-select:not([data-autoformx-processed])',
      // Arco Design
      '.arco-select:not([data-autoformx-processed])',
      // TDesign
      '.t-select:not([data-autoformx-processed])',
      // Semi Design
      '.semi-select:not([data-autoformx-processed])',
      // iView
      '.ivu-select:not([data-autoformx-processed])'
    ];
    
    customSelectSelectors.forEach(selector => {
      const selects = document.querySelectorAll(selector);
      selects.forEach(select => {
        // 检查是否已有内部的 input 被处理
        const innerInput = select.querySelector('input');
        if (innerInput && processedFields.has(innerInput)) {
          select.setAttribute('data-autoformx-processed', 'true');
          return;
        }
        
        // 标记为已处理
        select.setAttribute('data-autoformx-processed', 'true');
        
        // 检测类型
        const detection = detectCustomSelectType(select);
        select.setAttribute('data-autoformx-type', detection.type);
        
        // 如果配置了显示按钮，则添加按钮
        if (config.showFieldButtons) {
          addFieldButtonForCustomSelect(select, detection);
        }
      });
    });
  }

  /**
   * 检测自定义下拉框的类型（性别、状态等）
   */
  function detectCustomSelectType(selectElement) {
    // 查找关联的 label
    let label = '';
    
    // 尝试通过相邻元素查找 label
    const parent = selectElement.parentElement;
    if (parent) {
      const prevLabel = parent.previousElementSibling;
      if (prevLabel && (prevLabel.tagName === 'LABEL' || prevLabel.classList.contains('ant-form-item-label'))) {
        label = prevLabel.textContent?.trim() || '';
      }
      
      // Ant Design Form.Item 结构
      const formItemLabel = parent.closest('.ant-form-item')?.querySelector('.ant-form-item-label');
      if (formItemLabel) {
        label = formItemLabel.textContent?.trim() || '';
      }
      
      // Element UI Form Item 结构
      const elFormLabel = parent.closest('.el-form-item')?.querySelector('.el-form-item__label');
      if (elFormLabel) {
        label = elFormLabel.textContent?.trim() || '';
      }
    }
    
    // 尝试从 placeholder 获取
    const placeholder = selectElement.querySelector('input')?.placeholder || 
                        selectElement.getAttribute('placeholder') || '';
    
    // 使用 FieldDetector 来检测类型
    const fakeElement = {
      tagName: 'SELECT',
      name: '',
      id: selectElement.id || '',
      placeholder: placeholder,
      className: selectElement.className
    };
    
    // 根据 label 判断类型
    const labelLower = label.toLowerCase();
    if (labelLower.includes('性别') || labelLower.includes('gender') || labelLower.includes('sex')) {
      return { type: 'gender', confidence: 0.9, label };
    }
    if (labelLower.includes('状态') || labelLower.includes('status')) {
      return { type: 'select', confidence: 0.8, label };
    }
    if (labelLower.includes('角色') || labelLower.includes('role')) {
      return { type: 'select', confidence: 0.8, label };
    }
    
    return { type: 'select', confidence: 0.7, label };
  }

  /**
   * 为自定义下拉框添加按钮
   */
  function addFieldButtonForCustomSelect(selectElement, detection) {
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'autoformx-field-button';
    buttonContainer.title = `AI生成${detection.label || '选择'}`;
    
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
      await handleCustomSelectButtonClick(selectElement, buttonContainer, detection);
    });
    
    // 定位按钮
    positionFieldButton(selectElement, buttonContainer);
    document.body.appendChild(buttonContainer);
    
    // 监听位置变化
    observeFieldPosition(selectElement, buttonContainer);
  }

  /**
   * 处理自定义下拉框按钮点击
   */
  async function handleCustomSelectButtonClick(selectElement, button, detection) {
    button.classList.add('autoformx-loading');
    
    try {
      // 获取下拉框的选项
      const options = await getCustomSelectOptions(selectElement);
      
      // 发送消息给 background script
      const response = await chrome.runtime.sendMessage({
        action: 'generateFieldData',
        data: {
          fieldType: detection.type,
          fieldLabel: detection.label,
          fieldName: selectElement.id || 'custom_select',
          options: options
        }
      });
      
      if (response.success) {
        // 填充数据
        await fillCustomSelectByElement(selectElement, response.data);
        showToast('生成成功', 'success');
      } else {
        throw new Error(response.error || '生成失败');
      }
    } catch (error) {
      console.error('[AutoFormX] 自定义下拉框生成数据失败:', error);
      showToast(error.message || '生成失败，请检查配置', 'error');
    } finally {
      button.classList.remove('autoformx-loading');
    }
  }

  /**
   * 获取自定义下拉框的选项
   */
  async function getCustomSelectOptions(selectElement) {
    const options = [];
    
    // 尝试点击打开下拉框获取选项
    const clickTarget = selectElement.querySelector('.ant-select-selector') ||
                        selectElement.querySelector('.el-input') ||
                        selectElement.querySelector('.n-base-selection') ||
                        selectElement;
    
    // 保存当前状态
    clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    await sleep(200);
    
    // 查找下拉选项
    const dropdownSelectors = [
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
      '.el-select__popper .el-select-dropdown__item',
      '.el-select-dropdown__item',
      '.n-base-select-option',
      '.arco-select-option',
      '[role="option"]'
    ];
    
    for (const selector of dropdownSelectors) {
      const items = Array.from(document.querySelectorAll(selector)).filter(isElementVisible);
      if (items.length > 0) {
        items.forEach(item => {
          const text = item.textContent?.trim();
          const value = item.getAttribute('data-value') || item.dataset.value || text;
          if (text && !item.classList.contains('ant-select-item-option-disabled')) {
            options.push({ text, value });
          }
        });
        break;
      }
    }
    
    // 关闭下拉框
    closeDropdown();
    
    return options.slice(0, 10); // 最多返回10个选项
  }

  /**
   * 通过元素填充自定义下拉框
   */
  async function fillCustomSelectByElement(selectElement, value) {
    const classList = selectElement.classList;
    let type = 'unknown';
    
    if (classList.contains('ant-select')) type = 'antd';
    else if (classList.contains('el-select')) type = 'element';
    else if (classList.contains('n-select')) type = 'naive';
    else if (classList.contains('arco-select')) type = 'arco';
    else if (classList.contains('t-select')) type = 'tdesign';
    else if (classList.contains('semi-select')) type = 'semi';
    else if (classList.contains('ivu-select')) type = 'iview';
    
    // 使用已有的填充逻辑
    const customSelect = { type, element: selectElement };
    await fillCustomSelect(customSelect, null, value);
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
    if (!field || value === undefined || value === null) {
      console.warn('[AutoFormX] 无效的字段或值:', field, value);
      return;
    }

    const tagName = field.tagName.toLowerCase();
    
    try {
      if (tagName === 'select') {
        // 原生 select 元素
        fillNativeSelect(field, value);
      } else if (field.type === 'checkbox') {
        // 对于checkbox，根据值判断或50%概率选中
        if (typeof value === 'boolean') {
          field.checked = value;
        } else if (typeof value === 'string') {
          field.checked = ['true', '1', 'yes', '是'].includes(value.toLowerCase());
        } else {
          field.checked = Math.random() > 0.5;
        }
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (field.type === 'radio') {
        // 对于radio，选中当前的
        field.checked = true;
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // 检查是否是自定义下拉框组件的输入框
        const customSelect = findCustomSelectComponent(field);
        if (customSelect) {
          fillCustomSelect(customSelect, field, value);
        } else {
          // 普通输入框：先清空，再填充
          fillInputField(field, value);
        }
      }
      
      console.log(`[AutoFormX] 成功填充字段: ${field.name || field.id || '未命名'} = ${value}`);
    } catch (error) {
      console.error('[AutoFormX] 填充字段失败:', error, field);
    }
  }

  /**
   * 填充原生 select 元素
   */
  function fillNativeSelect(field, value) {
    field.value = '';
    
    const options = Array.from(field.options);
    const valueStr = String(value).toLowerCase().trim();
    
    // 尝试多种匹配方式
    let matchedOption = options.find(opt => 
      opt.value === value || 
      opt.text === value || 
      opt.value.toString() === value.toString() ||
      opt.value.toLowerCase() === valueStr ||
      opt.text.toLowerCase() === valueStr ||
      opt.text.includes(value) ||
      value.toString().includes(opt.text)
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
    
    // 触发事件
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * 填充普通输入框
   */
  function fillInputField(field, value) {
    const valueStr = value.toString().trim();
    
    // 使用原生setter来绑定值（兼容React等框架）
    const descriptor = Object.getOwnPropertyDescriptor(
      field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    );
    
    if (descriptor && descriptor.set) {
      descriptor.set.call(field, valueStr);
    } else {
      field.value = valueStr;
    }
    
    // 触发各种事件，确保框架能够响应
    field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    field.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * 查找自定义下拉框组件
   * 支持 Ant Design, Element UI, Naive UI, Arco Design 等常见框架
   */
  function findCustomSelectComponent(field) {
    // 向上查找父元素，最多查找5层
    let current = field;
    for (let i = 0; i < 5; i++) {
      if (!current || current === document.body) break;
      
      const classList = current.classList;
      
      // Ant Design Select
      if (classList.contains('ant-select') || 
          classList.contains('ant-select-selector') ||
          classList.contains('ant-select-selection-search-input')) {
        return { type: 'antd', element: current.closest('.ant-select') || current };
      }
      
      // Element UI / Element Plus Select
      if (classList.contains('el-select') || 
          classList.contains('el-input') && current.closest('.el-select')) {
        return { type: 'element', element: current.closest('.el-select') || current };
      }
      
      // Naive UI Select
      if (classList.contains('n-select') || 
          classList.contains('n-base-selection')) {
        return { type: 'naive', element: current.closest('.n-select') || current };
      }
      
      // Arco Design Select
      if (classList.contains('arco-select') || 
          classList.contains('arco-select-view')) {
        return { type: 'arco', element: current.closest('.arco-select') || current };
      }
      
      // TDesign Select
      if (classList.contains('t-select') || 
          classList.contains('t-select-input')) {
        return { type: 'tdesign', element: current.closest('.t-select') || current };
      }
      
      // Semi Design Select
      if (classList.contains('semi-select') || 
          classList.contains('semi-select-selection')) {
        return { type: 'semi', element: current.closest('.semi-select') || current };
      }
      
      // iView / View UI Select  
      if (classList.contains('ivu-select') || 
          classList.contains('ivu-select-selection')) {
        return { type: 'iview', element: current.closest('.ivu-select') || current };
      }
      
      current = current.parentElement;
    }
    
    return null;
  }

  /**
   * 填充自定义下拉框组件
   */
  async function fillCustomSelect(customSelect, field, value) {
    const { type, element } = customSelect;
    console.log(`[AutoFormX] 检测到自定义下拉框: ${type}`, element);
    
    try {
      // 点击打开下拉框
      await clickToOpenSelect(element, type);
      
      // 等待下拉框动画
      await sleep(150);
      
      // 查找并点击匹配的选项
      const clicked = await selectOptionByValue(type, value);
      
      if (!clicked) {
        // 如果没找到匹配的选项，尝试选择第一个选项
        console.log('[AutoFormX] 未找到匹配选项，尝试选择第一个');
        await selectFirstOption(type);
      }
      
      // 等待选择完成
      await sleep(100);
      
    } catch (error) {
      console.error('[AutoFormX] 填充自定义下拉框失败:', error);
      // 尝试关闭可能打开的下拉框
      closeDropdown();
    }
  }

  /**
   * 点击打开自定义下拉框
   */
  async function clickToOpenSelect(element, type) {
    let clickTarget = element;
    
    // 根据不同框架找到点击目标
    switch (type) {
      case 'antd':
        clickTarget = element.querySelector('.ant-select-selector') || element;
        break;
      case 'element':
        clickTarget = element.querySelector('.el-input__wrapper') || 
                      element.querySelector('.el-input__inner') ||
                      element.querySelector('.el-input') || 
                      element;
        break;
      case 'naive':
        clickTarget = element.querySelector('.n-base-selection') || element;
        break;
      case 'arco':
        clickTarget = element.querySelector('.arco-select-view') || element;
        break;
      case 'tdesign':
        clickTarget = element.querySelector('.t-input__wrap') || element;
        break;
      case 'semi':
        clickTarget = element.querySelector('.semi-select-selection') || element;
        break;
      case 'iview':
        clickTarget = element.querySelector('.ivu-select-selection') || element;
        break;
    }
    
    // 模拟鼠标点击
    clickTarget.dispatchEvent(new Event('focus', { bubbles: true, cancelable: true }));
    clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  /**
   * 根据值选择下拉选项
   */
  async function selectOptionByValue(type, value) {
    const valueStr = String(value).toLowerCase().trim();
    
    // 获取所有可能的下拉选项容器
    const dropdownSelectors = [
      // Ant Design
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
      '.ant-select-dropdown',
      // Element UI / Plus
      '.el-select-dropdown:not([style*="display: none"])',
      '.el-select-dropdown__wrap',
      '.el-popper:not([style*="display: none"])',
      // Naive UI
      '.n-select-menu',
      '.n-base-select-menu',
      // Arco Design
      '.arco-select-popup',
      '.arco-select-dropdown',
      // TDesign
      '.t-select-dropdown',
      '.t-select__dropdown',
      // Semi Design
      '.semi-select-option-list',
      // iView
      '.ivu-select-dropdown',
      // 通用
      '[role="listbox"]',
      '.dropdown-menu'
    ];
    
    // 等待下拉框出现
    await sleep(100);
    
    const dropdowns = getVisibleDropdowns(dropdownSelectors);
    if (dropdowns.length === 0) {
      console.warn('[AutoFormX] 未找到下拉框');
      return false;
    }
    
    // 获取所有选项
    const optionSelectors = [
      '.ant-select-item-option',
      '.ant-select-item',
      '.el-select-dropdown__item',
      '.el-option',
      '.n-base-select-option',
      '.arco-select-option',
      '.t-select-option',
      '.semi-select-option',
      '.ivu-select-item',
      '[role="option"]',
      'li'
    ];
    
    for (const dropdown of dropdowns) {
      const options = getOptionsFromDropdown(dropdown, optionSelectors);
      if (options.length === 0) continue;
      
      console.log(`[AutoFormX] 找到 ${options.length} 个选项，尝试匹配: ${value}`);
      
      // 查找匹配的选项
      let matchedOption = null;
      
      for (const option of options) {
        // 跳过禁用的选项
        if (option.classList.contains('ant-select-item-option-disabled') ||
            option.classList.contains('el-select-dropdown__item--disabled') ||
            option.classList.contains('is-disabled') ||
            option.hasAttribute('disabled')) {
          continue;
        }
        
        const optionText = option.textContent?.trim().toLowerCase() || '';
        const optionValue = option.getAttribute('data-value') || 
                            option.getAttribute('value') || 
                            option.dataset.value || '';
        
        // 多种匹配方式
        if (optionText === valueStr || 
            optionValue.toLowerCase() === valueStr ||
            optionText.includes(valueStr) ||
            valueStr.includes(optionText) ||
            option.textContent?.trim() === value) {
          matchedOption = option;
          break;
        }
      }
      
      if (matchedOption) {
        console.log('[AutoFormX] 找到匹配选项:', matchedOption.textContent?.trim());
        
        // 点击选中
        triggerOptionSelect(matchedOption);
        return true;
      }
    }
    
    return false;
  }

  /**
   * 选择第一个可用选项
   */
  async function selectFirstOption(type) {
    const optionSelectors = [
      '.ant-select-item-option:not(.ant-select-item-option-disabled)',
      '.el-select-dropdown__item:not(.is-disabled)',
      '.n-base-select-option:not(.n-base-select-option--disabled)',
      '.arco-select-option:not(.arco-select-option-disabled)',
      '[role="option"]:not([aria-disabled="true"])',
      'li:not(.disabled)'
    ];
    
    const dropdownSelectors = [
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
      '.el-select-dropdown:not([style*="display: none"])',
      '.el-select-dropdown__wrap',
      '.el-popper:not([style*="display: none"])',
      '.n-select-menu',
      '.n-base-select-menu',
      '.arco-select-popup',
      '.arco-select-dropdown',
      '.t-select-dropdown',
      '.t-select__dropdown',
      '.semi-select-option-list',
      '.ivu-select-dropdown',
      '[role="listbox"]',
      '.dropdown-menu'
    ];
    
    const dropdowns = getVisibleDropdowns(dropdownSelectors);
    for (const dropdown of dropdowns) {
      const options = getOptionsFromDropdown(dropdown, optionSelectors);
      if (options.length === 0) continue;
      triggerOptionSelect(options[0]);
      return true;
    }
    
    return false;
  }

  /**
   * 关闭可能打开的下拉框
   */
  function closeDropdown() {
    // 点击 body 关闭下拉框
    document.body.click();
    
    // 按 Escape 键关闭
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      bubbles: true
    }));
  }

  /**
   * 判断元素是否可见（兼容浮层组件）
   */
  function isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    return element.getClientRects().length > 0;
  }

  /**
   * 获取可见的下拉容器
   */
  function getVisibleDropdowns(selectors) {
    const dropdowns = [];
    const seen = new Set();
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(node => {
        if (node && !seen.has(node) && isElementVisible(node)) {
          seen.add(node);
          dropdowns.push(node);
        }
      });
    });
    return dropdowns;
  }

  /**
   * 从下拉容器中获取可用选项
   */
  function getOptionsFromDropdown(dropdown, optionSelectors) {
    for (const selector of optionSelectors) {
      const found = Array.from(dropdown.querySelectorAll(selector)).filter(isElementVisible);
      if (found.length > 0) {
        return found;
      }
    }
    return [];
  }

  /**
   * 触发选项点击（兼容不同框架事件）
   */
  function triggerOptionSelect(option) {
    option.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    option.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    option.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  /**
   * 等待指定毫秒数
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      const fillOptions = request.data || {};
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
          const requestData = {
            fields: fieldInfos
          };
          if (Object.prototype.hasOwnProperty.call(fillOptions, 'customPrompt')) {
            requestData.customPrompt = fillOptions.customPrompt || '';
          }

          chrome.runtime.sendMessage({
            action: 'generateBatchData',
            data: requestData
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
