# AutoFormX 隐私政策

最后更新：2026年5月14日

## 概述

AutoFormX 是一款用于软件测试、演示和开发调试的 AI 表单测试数据生成与自动填写扩展。扩展的单一用途是识别网页表单字段，并根据用户配置的 AI 服务生成虚构测试数据。

## 我们不会做什么

- AutoFormX 不会运营自有服务器接收或存储用户数据。
- AutoFormX 不会出售、出租或转让用户数据。
- AutoFormX 不会将数据用于广告、营销、信用评估或与核心功能无关的目的。
- AutoFormX 不会收集浏览历史记录。

## 本地存储的数据

扩展会使用 Chrome Storage API 保存以下配置和偏好：

- AI 服务商选择
- API Key
- 模型名称和自定义模型配置
- 自定义填充要求
- 界面偏好设置
- 本地使用统计，例如今日填写次数和累计使用次数

这些数据用于提供扩展功能，保存在用户浏览器的扩展存储中。用户可以通过扩展设置修改配置，也可以通过卸载扩展删除相关本地数据。

## 发送给第三方 AI 服务商的数据

当用户主动触发表单填写时，扩展会将完成该功能所需的表单字段上下文发送给用户配置的 AI 服务商，例如 DeepBricks、DeepSeek、OpenAI、通义千问、Moonshot、智谱、百炼、硅基流动、OpenRouter、xAI、Mistral 或用户自定义的 OpenAI 兼容 API。

发送内容可能包括：

- 表单字段类型
- 表单字段标签、名称、ID 和 placeholder
- 字段格式限制，例如 maxlength、pattern、required
- 下拉框候选项文本或值
- 用户在扩展中输入的自定义填充要求

扩展发送这些信息的唯一目的是生成虚构测试数据并填回用户当前页面。第三方 AI 服务商会按照其各自的隐私政策和服务条款处理请求数据。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存 API 配置、模型选择、界面偏好和本地使用统计 |
| `activeTab` | 在用户主动使用扩展时与当前活动标签页交互 |
| content script matches `<all_urls>` | 在用户访问的网页中识别表单字段并显示填写按钮 |

扩展不请求 `tabs`、`cookies`、`history`、`webRequest`、`scripting` 或额外 host permissions。

## 数据安全

- 扩展仅通过 HTTPS 调用用户配置的 AI API 地址。
- API Key 不会发送给 AutoFormX 作者或 AutoFormX 自有服务器。
- 所有扩展代码均随扩展包发布，不使用远程托管代码。

## Chrome Web Store Limited Use

AutoFormX 对用户数据的使用遵守 Chrome Web Store 用户数据政策，包括 Limited Use 要求。扩展只会在提供用户明确可见的表单测试数据生成功能所需范围内使用数据。

## 联系方式

如有隐私相关问题，请联系：yanqc@vip.qq.com

