# 图标文件说明

本目录应包含以下PNG格式的图标文件：

- `icon16.png` - 16x16像素，用于扩展图标显示
- `icon48.png` - 48x48像素，用于扩展管理页面
- `icon128.png` - 128x128像素，用于Chrome网上应用店

## 创建图标

您可以使用以下工具创建图标：

1. **在线工具**
   - [Favicon Generator](https://realfavicongenerator.net/)
   - [IconScout](https://iconscout.com/)
   
2. **设计软件**
   - Adobe Illustrator
   - Figma
   - Sketch

3. **简单方式**
   使用以下SVG转PNG的在线工具：
   - [CloudConvert](https://cloudconvert.com/svg-to-png)

## 图标设计建议

- 使用紫色渐变主题色（#667eea 到 #764ba2）
- 图标主体为魔法棒图案
- 保持简洁，在小尺寸下也要清晰可辨
- 背景可以是透明或白色

## 临时解决方案

在没有实际PNG图标的情况下，您可以：

1. 使用Chrome默认图标（将在安装时提示）
2. 使用在线工具快速生成占位图标
3. 找设计师制作专业图标

## SVG源文件

魔法棒图标SVG代码：

```svg
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="24" fill="url(#gradient)"/>
  <path d="M90 20L60 50M90 20L80 30M90 20L95 15M60 50L40 70M60 50L65 55M40 70L15 95M40 70L30 80M15 95L10 100M15 95L20 90" 
        stroke="white" stroke-width="6" stroke-linecap="round"/>
  <circle cx="25" cy="40" r="4" fill="white"/>
  <circle cx="45" cy="15" r="4" fill="white"/>
  <circle cx="85" cy="85" r="4" fill="white"/>
  <defs>
    <linearGradient id="gradient" x1="0" y1="0" x2="128" y2="128">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
  </defs>
</svg>
```

您可以将此SVG保存并转换为PNG格式。

