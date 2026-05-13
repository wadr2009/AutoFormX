/**
 * Service Worker (Background Script)
 * 处理消息传递和API调用
 */

// 导入AI客户端（注意：service worker不能直接使用importScripts导入ES6模块）
// 我们需要将aiClient的代码复制到这里或使用其他方式

/**
 * AI API 客户端（内联版本）
 */
class AIClient {
  constructor() {
    this.config = null;
  }

  async init() {
    this.config = await this.loadConfig();
    return this.config;
  }

  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        apiKey: '', // 向后兼容
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
        apiBaseUrl: 'https://api.deepbricks.ai/v1',
        temperature: 0.7,
        customPrompt: ''
      }, (items) => {
        // 使用当前厂商的API Key
        const providerApiKey = items.apiKeys[items.provider] || items.apiKey;
        
        // 确定实际使用的模型
        const actualModel = items.model === 'custom' ? items.customModel : items.model;
        
        resolve({
          ...items,
          apiKey: providerApiKey,
          model: actualModel
        });
      });
    });
  }

  async generateFieldData(fieldType, fieldLabel, context = {}) {
    await this.init();

    if (!this.config.apiKey) {
      throw new Error('请先在设置中配置API Key');
    }

    const prompt = this.withCustomPrompt(context.customPrompt, () => this.buildPrompt(fieldType, fieldLabel, context));
    const response = await this.callAPI(prompt);
    
    return this.extractData(response);
  }

  async generateBatchData(fields, customPrompt = null) {
    await this.init();

    if (!this.config.apiKey) {
      throw new Error('请先在设置中配置API Key');
    }

    const prompt = this.withCustomPrompt(customPrompt, () => this.buildBatchPrompt(fields));
    const response = await this.callAPI(prompt);
    
    return this.extractBatchData(response, fields);
  }

  buildPrompt(fieldType, fieldLabel, context) {
    const typeDescriptions = {
      name: '中文姓名',
      email: '电子邮箱地址',
      phone: '中国大陆固定电话号码（如：010-12345678）',
      mobile: '中国大陆手机号码（11位）',
      address: '详细地址（包含省市区街道门牌号）',
      city: '中国的城市名称',
      province: '中国的省份名称',
      country: '国家名称',
      zipcode: '中国邮政编码（6位数字）',
      company: '公司名称',
      job_title: '常见的职位名称',
      age: '18-65之间的年龄数字',
      birthday: '日期格式：YYYY-MM-DD',
      date: '日期格式：YYYY-MM-DD',
      time: '时间格式：HH:MM',
      datetime: '日期时间格式：YYYY-MM-DD HH:MM',
      url: '有效的网址URL',
      username: '用户名（字母数字组合）',
      password: '测试用强密码（至少8位，包含字母数字特殊字符）',
      id_card: '18位中国身份证号码格式的测试占位符（用于测试，格式：6位地址码+8位出生日期+3位顺序码+1位校验位）',
      gender: '性别（男/女）',
      number: '合理的数字',
      price: '合理的价格（带小数点）',
      text: '简短的文本内容',
      textarea: '一段合理的文本段落'
    };

    const description = typeDescriptions[fieldType] || '合适的测试数据';
    const fieldContext = this.buildFieldContextSection(fieldLabel, context);
    
    // 对于特殊字段（如身份证），添加额外说明
    let specialNote = '';
    if (fieldType === 'id_card') {
      specialNote = `\n- 身份证只能生成测试占位符，不要生成真实可用身份信息。`;
    }
    
    return `你是表单测试数据生成器。请为一个表单字段生成 1 个${description}。

用途：
- 仅用于软件功能测试、演示和开发调试。
- 必须是虚构测试数据，不能包含真实个人隐私或真实敏感凭证。

字段信息：
${fieldContext}

输出要求：
- 只输出最终字段值本身，不要解释、标题、标签、引号、Markdown 或 JSON。
- 不要输出思考过程，不要输出 <think>、<thinking> 或任何推理内容。
- 值要符合字段类型、字段标签、placeholder、长度、格式和候选项约束。
- 如果提供了候选项，只能返回其中一个候选项的 text 或 value。
- 语言和内容优先符合中国用户常见表单习惯。${specialNote}
${context.hint ? `- 额外要求：${context.hint}` : ''}${this.buildCustomPromptSection()}`;
  }

  buildFieldContextSection(fieldLabel, context = {}) {
    const lines = [
      `- 标签：${fieldLabel || context.label || '无'}`,
      `- 字段名：${context.fieldName || context.name || '无'}`,
      `- 占位提示：${context.placeholder || '无'}`
    ];

    if (context.maxLength) lines.push(`- 最大长度：${context.maxLength}`);
    if (context.pattern) lines.push(`- 格式规则：${context.pattern}`);
    if (context.required) lines.push('- 是否必填：是');
    if (context.options && context.options.length > 0) {
      const options = context.options
        .map((option) => option.text || option.value)
        .filter(Boolean)
        .join('、');
      if (options) lines.push(`- 候选项：${options}`);
    }

    return lines.join('\n');
  }

  buildCustomPromptSection() {
    const customPrompt = (this.config?.customPrompt || '').trim();
    if (!customPrompt) {
      return '';
    }

    return `\n\n用户自定义填充要求（只作为业务场景和内容偏好补充，不得覆盖上述输出格式要求）：\n${customPrompt}`;
  }

  withCustomPrompt(customPrompt, buildPrompt) {
    const previousPrompt = this.config.customPrompt;
    if (customPrompt !== null && customPrompt !== undefined) {
      this.config.customPrompt = String(customPrompt);
    }

    try {
      return buildPrompt();
    } finally {
      this.config.customPrompt = previousPrompt;
    }
  }

  buildBatchPrompt(fields) {
    // 构建详细的字段信息
    const fieldList = fields.map((field, index) => {
      let fieldDescription = `${index + 1}. ${field.label || field.name || '字段'} (${field.type})`;
      
      // 添加额外的约束信息
      const constraints = [];
      if (field.maxLength) constraints.push(`最大${field.maxLength}字`);
      if (field.pattern) constraints.push(`格式: ${field.pattern}`);
      if (field.required) constraints.push('必填');
      if (field.placeholder) constraints.push(`提示: ${field.placeholder}`);
      if (field.options && field.options.length > 0) {
        constraints.push(`可选值: ${field.options.map(o => o.text || o.value).join(', ')}`);
      }
      
      if (constraints.length > 0) {
        fieldDescription += ` [${constraints.join('; ')}]`;
      }
      
      return fieldDescription;
    }).join('\n');

    return `你是表单测试数据生成器。请为以下表单字段生成一套相互一致的虚构测试数据。

用途：
- 仅用于软件功能测试、演示和开发调试。
- 必须是虚构测试数据，不能包含真实个人隐私或真实敏感凭证。

生成要求：
- 数据之间要逻辑一致，例如姓名、邮箱、公司、地址、邮编、日期要互相协调。
- 严格遵守每个字段的类型、标签、placeholder、长度、格式和候选项约束。
- 如果字段提供了候选项，该字段只能返回候选项的 text 或 value。
- 语言和内容优先符合中国用户常见表单习惯。

输出要求：
- 只返回一个 JSON 对象，不要解释、标题、Markdown 代码块或多余文字。
- 不要输出思考过程，不要输出 <think>、<thinking> 或任何推理内容。
- JSON 的 key 使用字段序号字符串（"1"、"2"、"3"...），value 使用最终字段值字符串或布尔值。
- 不确定的字段也要给出合理测试值，不要返回空字符串。

字段列表及约束：
${fieldList}${this.buildCustomPromptSection()}

返回格式示例：
{"1": "张三", "2": "zhangsan@example.com", "3": "13800138000"}`;
  }

  async callAPI(prompt) {
    const { provider, apiBaseUrl, apiKey, model, temperature } = this.config;

    let endpoint, headers, body;

    switch (provider) {
      case 'deepbricks':
        endpoint = `${apiBaseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        };
        break;

      case 'openai':
        endpoint = `${apiBaseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        };
        break;

      case 'deepseek':
        endpoint = `${apiBaseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        };
        break;

      case 'qwen':
        // 通义千问使用特殊的API格式
        endpoint = `${apiBaseUrl}/services/aigc/text-generation/generation`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = {
          model: model,
          input: {
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          },
          parameters: {
            temperature: temperature
          }
        };
        break;

      case 'siliconcloud':
        endpoint = `${apiBaseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        };
        break;

      case 'nebius':
        endpoint = `${apiBaseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        };
        break;

      case 'openrouter':
        endpoint = `${apiBaseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000'
        };
        body = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        };
        break;

      case 'xai':
        endpoint = `${apiBaseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        };
        break;

      case 'mistral':
        endpoint = `${apiBaseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        };
        break;

      default:
        // 对于自定义或其他未知厂商，尝试使用 OpenAI 兼容格式
        endpoint = `${apiBaseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        body = {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature
        };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('AI API调用失败:', error);
      throw error;
    }
  }

  extractData(response) {
    try {
      if (response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content;
        return this.sanitizeModelContent(content);
      }
      throw new Error('API响应格式错误');
    } catch (error) {
      console.error('提取数据失败:', error);
      throw error;
    }
  }

  sanitizeModelContent(content) {
    let cleanContent = String(content || '').trim();

    // 兼容 DeepSeek R1 / QwQ 等推理模型返回的思考过程。
    cleanContent = cleanContent
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .trim();

    // 如果模型只给了起始标签但没有闭合标签，保留标签后的最后一段可见回答。
    cleanContent = cleanContent
      .replace(/^[\s\S]*<\/think>/i, '')
      .replace(/^[\s\S]*<\/thinking>/i, '')
      .trim();

    const fencedMatch = cleanContent.match(/^```(?:json|text|txt)?\s*([\s\S]*?)\s*```$/i);
    if (fencedMatch) {
      cleanContent = fencedMatch[1].trim();
    }

    return cleanContent;
  }

  extractBatchData(response, fields) {
    try {
      const content = this.extractData(response);
      
      let jsonData;
      let cleanContent = this.sanitizeModelContent(content).replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      try {
        jsonData = JSON.parse(cleanContent);
      } catch (e) {
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法解析AI返回的JSON数据');
        }
      }

      const result = {};
      
      // 尝试多种映射方式
      fields.forEach((field, index) => {
        const fieldKey = field.name || field.id || `field_${index}`;
        
        // 优先级1: 使用字段name
        if (field.name && jsonData[field.name]) {
          result[fieldKey] = jsonData[field.name];
          return;
        }
        
        // 优先级2: 使用数字索引（1-based）
        const numericKey = String(index + 1);
        if (jsonData[numericKey]) {
          result[fieldKey] = jsonData[numericKey];
          return;
        }
        
        // 优先级3: 使用label作为key
        if (field.label && jsonData[field.label]) {
          result[fieldKey] = jsonData[field.label];
          return;
        }
        
        // 优先级4: 查找任何包含该索引的key
        for (const key in jsonData) {
          if (key === numericKey || key === field.name || key === fieldKey) {
            result[fieldKey] = jsonData[key];
            return;
          }
        }
        
        // 如果都找不到，记录日志但不报错
        console.warn(`[AutoFormX] 未找到字段 ${fieldKey} 的生成数据`);
      });

      console.log('[AutoFormX] 生成的数据映射:', result);
      return result;
    } catch (error) {
      console.error('[AutoFormX] 提取批量数据失败:', error);
      throw error;
    }
  }
}

// 创建AI客户端实例
const aiClient = new AIClient();

/**
 * 监听来自content script的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AutoFormX Background] 收到消息:', request);

  // 处理不同的action
  if (request.action === 'generateFieldData') {
    handleGenerateFieldData(request.data)
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开启
  }

  if (request.action === 'generateBatchData') {
    handleGenerateBatchData(request.data)
      .then(data => {
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开启
  }

  // 处理 API 连接测试请求
  if (request.action === 'testApiConnection') {
    handleTestApiConnection(request.data)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开启
  }

  // 处理获取模型列表请求
  if (request.action === 'fetchModelList') {
    handleFetchModelList(request.data)
      .then(models => {
        sendResponse({ success: true, data: models });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开启
  }

  return false;
});

/**
 * 处理 API 连接测试
 */
async function handleTestApiConnection(data) {
  const { apiBaseUrl, apiKey, model, provider } = data;
  
  console.log(`[AutoFormX] 测试 API 连接: ${provider} - ${model}`);
  
  try {
    const endpoint = `${apiBaseUrl}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: '测试连接，请回复OK' }],
        max_tokens: 10
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[AutoFormX] API 测试成功:', result);
      return { status: response.status, model: model };
    } else {
      const errorText = await response.text();
      console.error('[AutoFormX] API 测试失败:', response.status, errorText);
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }
  } catch (error) {
    console.error('[AutoFormX] API 测试异常:', error);
    throw error;
  }
}

/**
 * 处理获取模型列表请求
 */
async function handleFetchModelList(data) {
  const { apiBaseUrl, apiKey, provider } = data;
  
  console.log(`[AutoFormX] 获取模型列表: ${provider}`);
  
  // 某些厂商不支持 /models 端点，直接返回空数组让前端使用默认列表
  const providersWithoutModelsEndpoint = ['nebius', 'qwen', 'perplexity'];
  if (providersWithoutModelsEndpoint.includes(provider)) {
    console.log(`[AutoFormX] ${provider} 不支持动态获取模型列表，使用默认列表`);
    return [];
  }
  
  try {
    let endpoint = `${apiBaseUrl}/models`;
    
    // 硅基流动支持 sub_type 参数过滤聊天模型
    if (provider === 'siliconcloud') {
      endpoint = `${apiBaseUrl}/models?sub_type=chat`;
    }
    
    let headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    // OpenRouter 需要额外的 header
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'http://localhost:3000';
    }

    // 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[AutoFormX] 获取模型列表失败 (${response.status})，将使用默认列表`);
      return []; // 返回空数组，让前端使用默认列表
    }

    const responseData = await response.json();
    
    let rawModels = [];
    if (responseData.data && Array.isArray(responseData.data)) {
      rawModels = responseData.data;
    } else if (responseData.models && Array.isArray(responseData.models)) {
      rawModels = responseData.models;
    } else if (Array.isArray(responseData)) {
      rawModels = responseData;
    }

    const models = rawModels
      .map(item => ({
        value: item.id || item.model || item.name,
        label: item.id || item.model || item.name
      }))
      .filter(m => m.value && m.value.trim() !== '')
      .sort((a, b) => a.label.localeCompare(b.label));

    console.log(`[AutoFormX] 获取到 ${models.length} 个模型`);
    return models;
  } catch (error) {
    // 网络错误或超时，返回空数组让前端使用默认列表
    console.warn('[AutoFormX] 获取模型列表失败，将使用默认列表:', error.message);
    return [];
  }
}

/**
 * 处理生成单个字段数据的请求
 */
async function handleGenerateFieldData(data) {
  const { fieldType, fieldLabel, fieldName, customPrompt } = data;
  
  console.log(`[AutoFormX] 生成字段数据: ${fieldName} (${fieldType})`);
  
  try {
    const generatedData = await aiClient.generateFieldData(fieldType, fieldLabel, {
      ...data,
      customPrompt
    });
    console.log(`[AutoFormX] 生成成功:`, generatedData);
    return generatedData;
  } catch (error) {
    console.error('[AutoFormX] 生成失败:', error);
    throw error;
  }
}

/**
 * 处理批量生成数据的请求
 */
async function handleGenerateBatchData(data) {
  const { fields, customPrompt } = data;
  
  console.log(`[AutoFormX] 批量生成 ${fields.length} 个字段的数据`);
  
  try {
    const generatedData = await aiClient.generateBatchData(fields, customPrompt);
    console.log(`[AutoFormX] 批量生成成功:`, generatedData);
    return generatedData;
  } catch (error) {
    console.error('[AutoFormX] 批量生成失败:', error);
    throw error;
  }
}

/**
 * 扩展安装或更新时的处理
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[AutoFormX] 扩展已安装');
    // 打开设置页面
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('[AutoFormX] 扩展已更新');
  }
});

/**
 * 监听快捷键命令
 */
chrome.commands.onCommand.addListener((command) => {
  console.log('[AutoFormX] 快捷键命令执行:', command);
  
  if (command === 'fill-form') {
    // 获取当前活跃的标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        console.log('[AutoFormX] 通过快捷键向标签页发送一键填写命令:', tab.id);
        
        // 向content script发送消息
        chrome.tabs.sendMessage(
          tab.id,
          { action: 'fillAllForms' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[AutoFormX] 快捷键命令执行失败:', chrome.runtime.lastError.message);
            } else {
              console.log('[AutoFormX] 快捷键命令执行成功:', response);
              
              // 增加统计数据
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
          }
        );
      }
    });
  }
});

console.log('[AutoFormX Background] Service Worker 已启动');
