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
    const customSelectSelectors = window.PlaywrightSelect.CUSTOM_SELECT_SELECTOR.split(',').map(
      (selector) => `${selector.trim()}:not([data-autoformx-processed])`
    );

    customSelectSelectors.forEach((selector) => {
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
      await handleCustomSelectButtonClick(selectElement, buttonContainer);
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
  async function handleCustomSelectButtonClick(selectElement, button) {
    button.classList.add('autoformx-loading');

    try {
      const success = await window.PlaywrightSelect.fillSelectRandom(selectElement);
      showToast(success ? '已随机选择' : '无可选选项', success ? 'success' : 'warning');
    } catch (error) {
      console.error('[AutoFormX] 自定义下拉框选择失败:', error);
      showToast(error.message || '选择失败', 'error');
    } finally {
      button.classList.remove('autoformx-loading');
    }
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
    
    // 排除已有值的输入框（非空字段不处理）
    const tagName = field.tagName.toLowerCase();
    // 文件字段不检查是否已有值（因为文件输入的value在未选择时也是空的）
    if ((tagName === 'input' && field.type !== 'checkbox' && field.type !== 'radio' && field.type !== 'file') || 
        tagName === 'textarea') {
      const currentValue = field.value && field.value.trim();
      if (currentValue && currentValue.length > 0) {
        console.log(`[AutoFormX] [isValidField] 跳过已有值的字段:`, {
          tagName: tagName,
          type: field.type,
          id: field.id,
          value: currentValue.substring(0, 30) + (currentValue.length > 30 ? '...' : '')
        });
        return false;
      }
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
    button.classList.add('autoformx-loading');

    try {
      if (window.PlaywrightSelect.isSelectField(field)) {
        const success = await window.PlaywrightSelect.fillSelectRandom(field);
        showToast(success ? '已随机选择' : '无可选选项', success ? 'success' : 'warning');
        return;
      }

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
    console.log('[AutoFormX] ===== handleGlobalButtonClick 开始 =====');
    
    // 收集所有表单字段
    const fields = collectAllFields();
    
    if (fields.length === 0) {
      showToast('未找到可填写的表单字段, 已经填写的字段已被跳过', 'warning');
      return;
    }
    
    // 显示加载状态
    globalButton.classList.add('autoformx-loading');
    
    try {
      // 准备精简的字段信息（不发送HTML，排除文件上传字段和自定义下拉框）
      const fieldInfos = fields.map((field, index) => {
        // 文件上传字段不需要发送给AI
        if (window.FileUploader.isFileField(field)) {
          return null;
        }
        
        // 自定义下拉框不需要发送给AI（直接随机选择）
        if (window.PlaywrightSelect.isSelectField(field)) {
          console.log(`[AutoFormX] [handleGlobalButtonClick] 字段[${index}] 是下拉框，跳过发送给AI`);
          return null;
        }
        
        console.log(`[AutoFormX] [handleGlobalButtonClick] 构建字段[${index}]上下文:`, {
          tagName: field.tagName,
          className: field.className,
          id: field.id,
          name: field.name
        });
        return buildFieldContext(field);
      }).filter(info => info !== null);
      
      console.log('[AutoFormX] [handleGlobalButtonClick] 批量生成字段数量:', fieldInfos.length);
      console.log('[AutoFormX] [handleGlobalButtonClick] 发送给AI的字段信息:', JSON.stringify(fieldInfos, null, 2));
      
      // 发送消息给background script
      console.log('[AutoFormX] [handleGlobalButtonClick] 发送消息给 background script...');
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'generateBatchData',
          data: {
            fields: fieldInfos
          }
        }, (response) => {
          console.log('[AutoFormX] [handleGlobalButtonClick] 收到 background script 响应:', response);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      if (response.success) {
        console.log('[AutoFormX] [handleGlobalButtonClick] AI 生成数据成功');
        console.log('[AutoFormX] [handleGlobalButtonClick] AI 返回的数据:', JSON.stringify(response.data, null, 2));
        
        // 填充数据到字段 - 普通字段先处理
        let successCount = 0;

        // 顺序处理所有字段（确保串行执行，避免多个下拉框同时打开）
        console.log(`[AutoFormX] [handleGlobalButtonClick] 开始顺序处理 ${fields.length} 个字段`);
        for (const [index, field] of fields.entries()) {
          // 文件字段直接处理，不依赖AI
          if (window.FileUploader.isFileField(field)) {
            if (await window.FileUploader.fillFile(field)) {
              successCount++;
            }
            await sleep(80);
            continue;
          }

          // 使用存储在元素上的字段名来匹配（保持与发送给AI时的一致性）
          const fieldKey = field.getAttribute('data-autoformx-name') || field.name || field.id || `field_${index}`;
          const value = response.data[fieldKey];
          
          if (window.PlaywrightSelect.isSelectField(field)) {
            console.log(`[AutoFormX] [handleGlobalButtonClick] 字段[${index}] 是下拉框，Playwright 随机选择...`);
            try {
              if (await window.PlaywrightSelect.fillSelectRandom(field)) {
                successCount++;
              }
              await sleep(60);
            } catch (error) {
              console.error(`[AutoFormX] [handleGlobalButtonClick] 字段[${index}] 处理失败:`, error);
            }
          } else if (value) {
            console.log(`[AutoFormX] [handleGlobalButtonClick] 字段[${index}] fieldKey="${fieldKey}", value=`, value);
            await fillField(field, value);
            successCount++;
          } else {
            console.log(`[AutoFormX] [handleGlobalButtonClick] 字段[${index}] 没有对应的AI数据，跳过`);
          }
        }
        
        showToast(`成功填写 ${successCount}/${fields.length} 个字段`, 'success');
        console.log(`[AutoFormX] [handleGlobalButtonClick] 一键填写完成: ${successCount}/${fields.length}`);
        
        // 增加统计数据
        incrementStats();
      } else {
        console.error('[AutoFormX] [handleGlobalButtonClick] AI 生成数据失败:', response.error);
        throw new Error(response.error || '生成失败');
      }
    } catch (error) {
      console.error('[AutoFormX] [handleGlobalButtonClick] 批量生成数据失败:', error);
      showToast(error.message || '生成失败，请检查配置', 'error');
    } finally {
      globalButton.classList.remove('autoformx-loading');
      console.log('[AutoFormX] ===== handleGlobalButtonClick 结束 =====');
    }
  }

  /**
   * 收集所有表单字段并构建精简的字段信息
   */
  function collectAllFields() {
    const fields = [];
    const allFields = document.querySelectorAll('input, textarea, select');
    
    console.log('[AutoFormX] ===== 开始收集表单字段 =====');
    console.log('[AutoFormX] 原始元素数量:', allFields.length);
    
    allFields.forEach((field, index) => {
      // 排除自定义下拉框内部的 input 元素
      if (window.PlaywrightSelect.isInsideCustomSelect(field)) {
        return;
      }

      if (field.type === 'file' && window.FileUploader.isInsideUploadComponent(field)) {
        return;
      }
      
      if (isValidField(field)) {
        console.log(`[AutoFormX] [${index}] 收集字段:`, {
          tagName: field.tagName,
          type: field.type,
          id: field.id,
          name: field.name,
          className: field.className,
          placeholder: field.placeholder
        });
        
        // 确保字段已被处理
        if (!processedFields.has(field)) {
          const detection = window.FieldDetector.detectFieldType(field);
          field.setAttribute('data-autoformx-type', detection.type);
          processedFields.add(field);
        }
        fields.push(field);
      }
    });
    
    // 收集自定义下拉框组件
    const customSelects = collectCustomSelectComponents();
    console.log(`[AutoFormX] 收集到自定义下拉框数量: ${customSelects.length}`);
    
    // 收集自定义上传组件（如 Ant Design Upload）
    const customUploads = collectCustomUploadComponents();
    console.log(`[AutoFormX] 收集到自定义上传组件数量: ${customUploads.length}`);
    fields.push(...customUploads);
    customSelects.forEach((select, index) => {
      console.log(`[AutoFormX] [自定义下拉框 ${index}]:`, {
        className: select.className,
        id: select.id,
        dataType: select.getAttribute('data-autoformx-type')
      });
    });
    fields.push(...customSelects);
    
    console.log(`[AutoFormX] ===== 字段收集完成，总计: ${fields.length} 个字段 =====`);
    return fields;
  }

  /**
   * 收集自定义上传组件（如 Ant Design Upload）
   */
  function collectCustomUploadComponents() {
    console.log('[AutoFormX] ===== 开始收集自定义上传组件 =====');
    
    const uploadSelectors = window.FileUploader.UPLOAD_ROOT_SELECTOR.split(',').map((s) => s.trim());
    
    const uploads = [];
    const seen = new Set();
    
    uploadSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`[AutoFormX] [collectCustomUploadComponents] 选择器 "${selector}" 找到 ${elements.length} 个元素`);
      
      elements.forEach(upload => {
        if (seen.has(upload)) return;
        seen.add(upload);
        
        // 查找内部的隐藏文件输入
        const fileInput = upload.querySelector('input[type="file"]');
        if (fileInput && !seen.has(fileInput)) {
          seen.add(fileInput);
          
          // 检查是否已有文件
          if (fileInput.files && fileInput.files.length > 0) {
            console.log(`[AutoFormX] [collectCustomUploadComponents] 跳过已有文件的上传组件`);
            return;
          }
          
          console.log(`[AutoFormX] [collectCustomUploadComponents] 找到隐藏的文件输入`, {
            accept: fileInput.accept,
            multiple: fileInput.multiple
          });
          fileInput.setAttribute('data-autoformx-type', 'file');
          uploads.push(fileInput);
        }
      });
    });
    
    console.log(`[AutoFormX] ===== 自定义上传组件收集完成，总计: ${uploads.length} 个 =====`);
    return uploads;
  }

  /**
   * 判断元素是否在自定义下拉框内部（只检查直接父元素）
   */
  /**
   * 收集自定义下拉框组件
   */
  function collectCustomSelectComponents() {
    const selects = [];
    const seen = new Set();
    const elements = document.querySelectorAll(window.PlaywrightSelect.CUSTOM_SELECT_SELECTOR);

    elements.forEach((select) => {
      if (seen.has(select)) return;
      if (window.PlaywrightSelect.hasExistingValue(select)) return;
      seen.add(select);
      select.setAttribute('data-autoformx-type', 'select');
      selects.push(select);
    });

    return selects;
  }

  /**
   * 为字段构建精简的上下文信息（不包含整个HTML）
   */
  function buildFieldContext(field) {
    const fieldType = field.getAttribute('data-autoformx-type') || 'text';
    const isCustomSelect = window.PlaywrightSelect.isCustomSelect(field);
    
    console.log(`[AutoFormX] [buildFieldContext] 构建字段上下文:`, {
      tagName: field.tagName,
      type: field.type,
      isCustomSelect: isCustomSelect,
      className: field.className,
      id: field.id,
      name: field.name
    });
    
    // 获取字段标签（支持自定义下拉框）
    let label = '';
    if (isCustomSelect) {
      label = getCustomSelectLabel(field);
      console.log(`[AutoFormX] [buildFieldContext] 自定义下拉框标签: "${label}"`);
    } else {
      label = window.FieldDetector.getFieldLabel(field);
    }
    
    // 获取字段名称（支持自定义下拉框）
    let fieldName = '';
    let fieldId = '';
    let placeholder = '';
    if (isCustomSelect) {
      const innerInput = field.querySelector('input');
      fieldId = field.id || innerInput?.id || '';
      fieldName = field.name || innerInput?.name || '';
      placeholder = innerInput?.placeholder || field.getAttribute('placeholder') || '';
    } else {
      fieldName = field.name;
      fieldId = field.id;
      placeholder = field.placeholder;
    }
    
    // 生成字段名称（保持一致性）
    const generatedName = fieldName || fieldId || `custom_select_${Math.random().toString(36).substr(2, 9)}`;
    
    // 将字段名存储在元素上，方便后续填充时使用
    field.setAttribute('data-autoformx-name', generatedName);
    
    // 构建字段的约束信息
    const context = {
      type: fieldType,
      label: label || fieldName || fieldId || '未知字段',
      name: generatedName,
      id: fieldId,
      placeholder: placeholder,
      maxLength: field.maxLength && field.maxLength > 0 ? field.maxLength : null,
      pattern: field.pattern,
      required: field.hasAttribute('aria-required') ? field.getAttribute('aria-required') === 'true' : field.required,
      readonly: field.readOnly,
    };
    
    
    // 对于textarea，添加行列信息
    if (field.tagName.toLowerCase() === 'textarea') {
      context.rows = field.rows;
      context.cols = field.cols;
    }
    
    console.log(`[AutoFormX] [buildFieldContext] 最终上下文:`, context);
    return context;
  }

  /**
   * 获取自定义下拉框的标签
   */
  function getCustomSelectLabel(selectElement) {
    let label = '';
    
    const parent = selectElement.parentElement;
    if (parent) {
      const prevLabel = parent.previousElementSibling;
      if (prevLabel && (prevLabel.tagName === 'LABEL' || prevLabel.classList.contains('ant-form-item-label'))) {
        label = prevLabel.textContent?.trim() || '';
      }
      
      const formItemLabel = parent.closest('.ant-form-item')?.querySelector('.ant-form-item-label');
      if (formItemLabel) {
        label = formItemLabel.textContent?.trim() || '';
      }
      
      const elFormLabel = parent.closest('.el-form-item')?.querySelector('.el-form-item__label');
      if (elFormLabel) {
        label = elFormLabel.textContent?.trim() || '';
      }
    }
    
    return label;
  }

  /**
   * 填充字段值
   */
  async function fillField(field, value) {
    if (!field || value === undefined || value === null) {
      console.warn('[AutoFormX] 无效的字段或值:', field, value);
      return;
    }

    const tagName = field.tagName.toLowerCase();

    console.log(`[AutoFormX] [fillField] 开始填充字段:`, {
      tagName: tagName,
      type: field.type,
      isSelectField: window.PlaywrightSelect.isSelectField(field),
      className: field.className,
      id: field.id,
      name: field.name,
      value: value
    });
    
    try {
      if (window.PlaywrightSelect.isSelectField(field)) {
        await window.PlaywrightSelect.fillSelectRandom(field);
        return;
      }

      if (window.FileUploader.isFileField(field)) {
        await window.FileUploader.fillFile(field);
        return;
      }

      if (field.type === 'checkbox') {
        console.log(`[AutoFormX] [fillField] checkbox，值: ${value}`);
        if (typeof value === 'boolean') {
          field.checked = value;
        } else if (typeof value === 'string') {
          field.checked = ['true', '1', 'yes', '是'].includes(value.toLowerCase());
        } else {
          field.checked = Math.random() > 0.5;
        }
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (field.type === 'radio') {
        console.log(`[AutoFormX] [fillField] radio，值: ${value}`);
        field.checked = true;
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.log(`[AutoFormX] [fillField] 普通输入框，调用 fillInputField`);
        fillInputField(field, value);
      }
      
      console.log(`[AutoFormX] [fillField] 成功填充字段: ${field.name || field.id || '未命名'} = ${value}`);
    } catch (error) {
      console.error('[AutoFormX] [fillField] 填充字段失败:', error, field);
    }
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
            error: '未找到可填写的表单字段, 已经填写的字段已被跳过' 
          });
          return;
        }

        // 显示加载状态
        if (globalButton) {
          globalButton.classList.add('autoformx-loading');
        }

        try {
          const fieldInfos = fields
            .map((field, index) => {
              if (window.FileUploader.isFileField(field) || window.PlaywrightSelect.isSelectField(field)) {
                return null;
              }
              return buildFieldContext(field);
            })
            .filter((info) => info !== null);

          const requestData = { fields: fieldInfos };
          if (Object.prototype.hasOwnProperty.call(fillOptions, 'customPrompt')) {
            requestData.customPrompt = fillOptions.customPrompt || '';
          }

          chrome.runtime.sendMessage({
            action: 'generateBatchData',
            data: requestData
          }, async (response) => {
            try {
              if (!response?.success) {
                throw new Error(response?.error || '生成失败');
              }

              let successCount = 0;
              for (const [index, field] of fields.entries()) {
                if (window.FileUploader.isFileField(field)) {
                  if (await window.FileUploader.fillFile(field)) {
                    successCount++;
                  }
                  await sleep(80);
                  continue;
                }
                if (window.PlaywrightSelect.isSelectField(field)) {
                  if (await window.PlaywrightSelect.fillSelectRandom(field)) {
                    successCount++;
                  }
                  await sleep(60);
                  continue;
                }
                const fieldKey = field.getAttribute('data-autoformx-name') || field.name || field.id || `field_${index}`;
                const value = response.data[fieldKey];
                if (value) {
                  await fillField(field, value);
                  successCount++;
                }
              }

              showToast(`成功填写 ${successCount}/${fields.length} 个字段`, 'success');
              sendResponse({
                success: true,
                message: `成功填写 ${successCount}/${fields.length} 个字段`
              });
            } catch (error) {
              showToast(error.message || '生成失败，请检查配置', 'error');
              sendResponse({ success: false, error: error.message });
            } finally {
              if (globalButton) {
                globalButton.classList.remove('autoformx-loading');
              }
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
