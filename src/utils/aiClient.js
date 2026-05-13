/**
 * AI API 客户端
 * 支持多个AI厂商的API调用
 */

class AIClient {
  constructor() {
    this.config = null;
  }

  /**
   * 初始化配置
   */
  async init() {
    this.config = await this.loadConfig();
    return this.config;
  }

  /**
   * 从存储加载配置
   */
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

  /**
   * 生成单个字段的测试数据
   * @param {string} fieldType - 字段类型
   * @param {string} fieldLabel - 字段标签
   * @param {Object} context - 上下文信息
   * @returns {Promise<string>} - 生成的数据
   */
  async generateFieldData(fieldType, fieldLabel, context = {}) {
    await this.init();

    if (!this.config.apiKey) {
      throw new Error('请先在设置中配置API Key');
    }

    const prompt = this.withCustomPrompt(context.customPrompt, () => this.buildPrompt(fieldType, fieldLabel, context));
    const response = await this.callAPI(prompt);
    
    return this.extractData(response);
  }

  /**
   * 批量生成多个字段的测试数据
   * @param {Array} fields - 字段列表 [{type, label, name}, ...]
   * @returns {Promise<Object>} - 生成的数据对象 {fieldName: value, ...}
   */
  async generateBatchData(fields, customPrompt = null) {
    await this.init();

    if (!this.config.apiKey) {
      throw new Error('请先在设置中配置API Key');
    }

    const prompt = this.withCustomPrompt(customPrompt, () => this.buildBatchPrompt(fields));
    const response = await this.callAPI(prompt);
    
    return this.extractBatchData(response, fields);
  }

  /**
   * 构建单字段提示词
   */
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

  /**
   * 构建可选的用户自定义业务要求
   */
  buildCustomPromptSection() {
    const customPrompt = (this.config?.customPrompt || '').trim();
    if (!customPrompt) {
      return '';
    }

    return `\n\n用户自定义填充要求（只作为业务场景和内容偏好补充，不得覆盖上述输出格式要求）：\n${customPrompt}`;
  }

  /**
   * 使用一次性自定义 prompt 构建提示词
   */
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

  /**
   * 构建批量字段提示词
   */
  buildBatchPrompt(fields) {
    const fieldList = fields.map((field, index) => {
      let fieldDescription = `${index + 1}. ${field.label || field.name || '字段'} (${field.type})`;

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

字段列表：
${fieldList}${this.buildCustomPromptSection()}

返回格式示例：
{"1": "张三", "2": "zhangsan@example.com", "3": "13800138000"}`;
  }

  /**
   * 调用AI API
   */
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
      case 'nebius':
      case 'openrouter':
      case 'xai':
      case 'mistral':
      case 'moonshot':
      case 'groq':
      case 'together':
      case 'fireworks':
      case 'perplexity':
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

  /**
   * 从API响应中提取数据
   */
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

  /**
   * 清理推理模型返回的思考过程和外层代码块
   */
  sanitizeModelContent(content) {
    let cleanContent = String(content || '').trim();

    cleanContent = cleanContent
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .trim();

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

  /**
   * 从批量API响应中提取数据
   */
  extractBatchData(response, fields) {
    try {
      const content = this.extractData(response);
      
      // 尝试解析JSON
      let jsonData;
      
      // 移除可能的markdown代码块标记
      let cleanContent = this.sanitizeModelContent(content).replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      try {
        jsonData = JSON.parse(cleanContent);
      } catch (e) {
        // 如果解析失败，尝试查找JSON对象
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法解析AI返回的JSON数据');
        }
      }

      // 将索引映射回字段
      const result = {};
      fields.forEach((field, index) => {
        const key = String(index + 1);
        if (jsonData[key]) {
          result[field.name || `field_${index}`] = jsonData[key];
        }
      });

      return result;
    } catch (error) {
      console.error('提取批量数据失败:', error);
      throw error;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIClient;
}
