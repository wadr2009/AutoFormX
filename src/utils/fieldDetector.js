/**
 * 字段类型识别工具
 * 智能识别表单字段的类型，用于生成相应的测试数据
 */

const FieldDetector = {
  // 字段类型枚举
  FIELD_TYPES: {
    NAME: 'name',
    EMAIL: 'email',
    PHONE: 'phone',
    MOBILE: 'mobile',
    ADDRESS: 'address',
    CITY: 'city',
    PROVINCE: 'province',
    COUNTRY: 'country',
    ZIPCODE: 'zipcode',
    COMPANY: 'company',
    JOB_TITLE: 'job_title',
    AGE: 'age',
    BIRTHDAY: 'birthday',
    DATE: 'date',
    TIME: 'time',
    DATETIME: 'datetime',
    URL: 'url',
    USERNAME: 'username',
    PASSWORD: 'password',
    ID_CARD: 'id_card',
    GENDER: 'gender',
    NUMBER: 'number',
    PRICE: 'price',
    TEXT: 'text',
    TEXTAREA: 'textarea',
    SELECT: 'select',
    CHECKBOX: 'checkbox',
    RADIO: 'radio'
  },

  // 字段类型关键词映射（支持中英文）
  KEYWORDS: {
    name: ['name', 'username', '姓名', '用户名', '名字', 'fullname', 'realname'],
    email: ['email', 'mail', '邮箱', '电子邮箱', 'e-mail'],
    phone: ['phone', 'tel', 'telephone', '电话', '联系电话', 'contact'],
    mobile: ['mobile', 'cellphone', 'cell', '手机', '手机号', '移动电话'],
    address: ['address', '地址', '详细地址', 'street', 'location'],
    city: ['city', '城市', 'town'],
    province: ['province', 'state', '省份', '省', '州'],
    country: ['country', 'nation', '国家'],
    zipcode: ['zip', 'zipcode', 'postal', 'postcode', '邮编', '邮政编码'],
    company: ['company', 'corporation', 'organization', '公司', '单位', '企业'],
    job_title: ['job', 'title', 'position', '职位', '职称', '岗位'],
    age: ['age', '年龄'],
    birthday: ['birthday', 'birth', 'dob', '生日', '出生日期'],
    date: ['date', '日期'],
    time: ['time', '时间'],
    url: ['url', 'website', 'link', '网址', '链接'],
    username: ['user', 'account', '账号', '账户'],
    password: ['password', 'pwd', 'pass', '密码'],
    id_card: ['idcard', 'id', 'identity', '身份证', '证件号'],
    gender: ['gender', 'sex', '性别'],
    number: ['number', 'num', 'count', '数量', '编号'],
    price: ['price', 'amount', 'cost', '价格', '金额', '费用']
  },

  /**
   * 检测字段类型
   * @param {HTMLElement} element - 表单字段元素
   * @returns {Object} - { type: 字段类型, confidence: 置信度 }
   */
  detectFieldType(element) {
    if (!element) return { type: this.FIELD_TYPES.TEXT, confidence: 0 };

    const tagName = element.tagName.toLowerCase();
    
    // 根据标签类型处理
    if (tagName === 'textarea') {
      return { type: this.FIELD_TYPES.TEXTAREA, confidence: 1.0 };
    }
    
    if (tagName === 'select') {
      return { type: this.FIELD_TYPES.SELECT, confidence: 1.0 };
    }
    
    if (tagName === 'input') {
      const inputType = (element.type || 'text').toLowerCase();
      
      // 根据input type直接判断
      switch (inputType) {
        case 'email':
          return { type: this.FIELD_TYPES.EMAIL, confidence: 1.0 };
        case 'tel':
          return { type: this.FIELD_TYPES.PHONE, confidence: 1.0 };
        case 'url':
          return { type: this.FIELD_TYPES.URL, confidence: 1.0 };
        case 'number':
          return { type: this.FIELD_TYPES.NUMBER, confidence: 0.8 };
        case 'date':
          return { type: this.FIELD_TYPES.DATE, confidence: 1.0 };
        case 'time':
          return { type: this.FIELD_TYPES.TIME, confidence: 1.0 };
        case 'datetime-local':
          return { type: this.FIELD_TYPES.DATETIME, confidence: 1.0 };
        case 'password':
          return { type: this.FIELD_TYPES.PASSWORD, confidence: 1.0 };
        case 'checkbox':
          return { type: this.FIELD_TYPES.CHECKBOX, confidence: 1.0 };
        case 'radio':
          return { type: this.FIELD_TYPES.RADIO, confidence: 1.0 };
      }
    }

    // 通过属性和上下文分析
    const scores = {};
    for (const [type, keywords] of Object.entries(this.KEYWORDS)) {
      scores[type] = this.calculateScore(element, keywords);
    }

    // 找到得分最高的类型
    let maxScore = 0;
    let detectedType = this.FIELD_TYPES.TEXT;
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedType = this.FIELD_TYPES[type.toUpperCase()];
      }
    }

    return {
      type: detectedType,
      confidence: Math.min(maxScore / 10, 1.0) // 归一化到0-1
    };
  },

  /**
   * 计算字段匹配分数
   * @param {HTMLElement} element - 表单元素
   * @param {Array} keywords - 关键词列表
   * @returns {number} - 匹配分数
   */
  calculateScore(element, keywords) {
    let score = 0;
    
    // 获取所有相关属性
    const name = (element.name || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const placeholder = (element.placeholder || '').toLowerCase();
    const className = (element.className || '').toLowerCase();
    
    // 获取label文本
    const label = this.getFieldLabel(element);
    const labelText = label ? label.toLowerCase() : '';

    // 检查每个关键词
    for (const keyword of keywords) {
      const kw = keyword.toLowerCase();
      
      // name属性权重最高
      if (name.includes(kw)) score += 5;
      
      // id属性次之
      if (id.includes(kw)) score += 4;
      
      // placeholder权重中等
      if (placeholder.includes(kw)) score += 3;
      
      // label文本
      if (labelText.includes(kw)) score += 3;
      
      // class名称权重较低
      if (className.includes(kw)) score += 1;
    }

    return score;
  },

  /**
   * 获取字段的label文本
   * @param {HTMLElement} element - 表单元素
   * @returns {string} - label文本
   */
  getFieldLabel(element) {
    // 通过for属性查找label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }

    // 查找父级label
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      if (parent.tagName.toLowerCase() === 'label') {
        return parent.textContent.trim();
      }
      parent = parent.parentElement;
    }

    // 查找前面相邻的label
    let sibling = element.previousElementSibling;
    while (sibling) {
      if (sibling.tagName.toLowerCase() === 'label') {
        return sibling.textContent.trim();
      }
      sibling = sibling.previousElementSibling;
    }

    return '';
  },

  /**
   * 获取字段的中文类型描述
   * @param {string} fieldType - 字段类型
   * @returns {string} - 中文描述
   */
  getFieldTypeDescription(fieldType) {
    const descriptions = {
      name: '姓名',
      email: '邮箱',
      phone: '电话',
      mobile: '手机号',
      address: '地址',
      city: '城市',
      province: '省份',
      country: '国家',
      zipcode: '邮编',
      company: '公司',
      job_title: '职位',
      age: '年龄',
      birthday: '生日',
      date: '日期',
      time: '时间',
      datetime: '日期时间',
      url: '网址',
      username: '用户名',
      password: '密码',
      id_card: '身份证',
      gender: '性别',
      number: '数字',
      price: '价格',
      text: '文本',
      textarea: '多行文本',
      select: '选择框',
      checkbox: '复选框',
      radio: '单选框'
    };
    
    return descriptions[fieldType] || '文本';
  }
};

// 导出供content script使用
if (typeof window !== 'undefined') {
  window.FieldDetector = FieldDetector;
}

