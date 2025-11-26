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
        temperature: 0.7
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

    const prompt = this.buildPrompt(fieldType, fieldLabel, context);
    const response = await this.callAPI(prompt);
    
    return this.extractData(response);
  }

  /**
   * 批量生成多个字段的测试数据
   * @param {Array} fields - 字段列表 [{type, label, name}, ...]
   * @returns {Promise<Object>} - 生成的数据对象 {fieldName: value, ...}
   */
  async generateBatchData(fields) {
    await this.init();

    if (!this.config.apiKey) {
      throw new Error('请先在设置中配置API Key');
    }

    const prompt = this.buildBatchPrompt(fields);
    const response = await this.callAPI(prompt);
    
    return this.extractBatchData(response, fields);
  }

  /**
   * 构建单字段提示词
   */
  buildPrompt(fieldType, fieldLabel, context) {
    const typeDescriptions = {
      name: '真实的中文姓名',
      email: '有效的电子邮箱地址',
      phone: '有效的中国大陆电话号码（如：010-12345678）',
      mobile: '有效的中国大陆手机号码（11位）',
      address: '真实的详细地址（包含省市区街道门牌号）',
      city: '中国的城市名称',
      province: '中国的省份名称',
      country: '国家名称',
      zipcode: '有效的中国邮政编码（6位数字）',
      company: '真实的公司名称',
      job_title: '常见的职位名称',
      age: '18-65之间的年龄数字',
      birthday: '日期格式：YYYY-MM-DD',
      date: '日期格式：YYYY-MM-DD',
      time: '时间格式：HH:MM',
      datetime: '日期时间格式：YYYY-MM-DD HH:MM',
      url: '有效的网址URL',
      username: '用户名（字母数字组合）',
      password: '强密码（至少8位，包含字母数字特殊字符）',
      id_card: '18位中国身份证号码格式的测试占位符（用于测试，格式：6位地址码+8位出生日期+3位顺序码+1位校验位）',
      gender: '性别（男/女）',
      number: '合理的数字',
      price: '合理的价格（带小数点）',
      text: '简短的文本内容',
      textarea: '一段合理的文本段落'
    };

    const description = typeDescriptions[fieldType] || '合适的测试数据';
    
    // 对于特殊字段（如身份证），添加额外说明
    let specialNote = '';
    if (fieldType === 'id_card') {
      specialNote = `\n提示：身份证号码仅用于测试/演示，不用于任何实际用途。可生成格式类似但明显不可用的号码（如用Z替代校验位）。`;
    }
    
    return `[仅用于软件测试/演示] 请为以下字段生成${description}。要求：
1. 这是**应用软件功能测试**的虚构测试数据，仅用于开发/测试/演示目的
2. 生成格式正确但明显不可被当作真实数据使用的内容
3. 符合中国用户使用习惯
4. 直接返回数据值，不要有任何解释或额外文字
5. 字段标签提示：${fieldLabel || '无'}${specialNote}
${context.hint ? `6. 额外要求：${context.hint}` : ''}`;
  }

  /**
   * 构建批量字段提示词
   */
  buildBatchPrompt(fields) {
    const fieldList = fields.map((field, index) => 
      `${index + 1}. ${field.label || field.name || '未知字段'} (${field.type})`
    ).join('\n');

    return `[测试/演示用途] 请为以下表单字段生成一套完整的**测试数据**。要求：
1. 生成真实可信的测试数据（仅供开发/测试/演示使用）
2. 数据之间要相互关联、合理（例如地址和邮编要匹配）
3. 符合中国用户使用习惯
4. 返回JSON格式，key为字段序号（从1开始），value为生成的数据值
5. 只返回JSON对象，不要有任何解释或markdown格式
6. 这是用于**应用软件功能测试**的虚构测试数据，不用于任何实际用途

字段列表：
${fieldList}

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
        return content.trim();
      }
      throw new Error('API响应格式错误');
    } catch (error) {
      console.error('提取数据失败:', error);
      throw error;
    }
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
      let cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
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

