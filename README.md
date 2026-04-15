# 颐心 AI 虚拟老人陪伴系统

## 说明
这是一个静态页面与简单后端结合的 AI 数字人陪伴系统示例，适合演示老年人友好的交互体验。

## 运行方式
1. 进入项目目录：

```powershell
cd d:\服创\files
```

2. 安装依赖：

```powershell
npm install
```

3. 启动服务器：

```powershell
npm start
```

4. 在浏览器打开：

```text
http://localhost:3000/page1_login.html
```

## 大模型接入
如果希望将聊天功能接入真实大模型，请按照下面步骤配置：

1. 申请 `QWEN_API_KEY`。
2. 在项目根目录创建 `.env` 文件：

```text
QWEN_API_KEY=你的通义千问 API Key
QWEN_API_URL=https://dashscope.aliyun.com/api/v1/chat/completions
```

3. 重新安装依赖并启动：

```powershell
npm install
npm start
```

当 `QWEN_API_KEY` 可用时，后端会优先调用千文（Qwen）模型生成更自然的“晴晴”回复；否则仍会使用本地规则回退。

## 功能
- 登录与验证码交互
- AI 聊天接入大模型（通义千问 Qwen）
- 心理报告与趋势展示
- 数字人形象定制与保存
- 个人中心设置同步后端
