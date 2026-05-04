# Feishu-OpenCode Bridge

飞书个人助理 ↔ OpenCode AI 编程助手的桥接服务。

在飞书中私聊机器人，即可远程控制 OpenCode 执行代码任务。

## 架构

```
飞书用户 ←→ 飞书平台 ←→ 桥接服务 ←→ OpenCode Server (HTTP API)
                ↑
         WebSocket / HTTP
```

## 前置条件

1. **OpenCode** 已安装并在运行
2. **飞书自建应用** 已在 [飞书开放平台](https://open.feishu.cn/) 创建

## 快速开始

### 1. 配置飞书应用

在 [飞书开放平台](https://open.feishu.cn/app)：

1. 创建企业自建应用
2. 获取 **App ID** 和 **App Secret**
3. 启用机器人能力：应用能力 → 机器人
4. 配置权限：
   - `im:message` — 获取与发送消息
   - `im:message:send_as_bot` — 以机器人身份发消息
   - `im:chat` — 获取群组信息
5. 配置事件订阅：
   - 订阅 `im.message.receive_v1` 事件

**WebSocket 模式（推荐本地使用）：**
- 在「长连接」Tab 中添加能力 → 长连接
- 不需要公网 IP

**HTTP 模式（需要公网可达）：**
- 需要公网 IP 或内网穿透（如 ngrok、frp）
- 设置请求地址为 `http://<公网地址>:3000/feishu/event`

6. 发布应用版本，等待审批通过

### 2. 配置桥接服务

```bash
cd feishu-opencode-bridge
cp .env.example .env
```

编辑 `.env`，填入你的飞书应用凭证：

```env
FEISHU_APP_ID=cli_xxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxx
FEISHU_USE_WS=true
```

### 3. 启动服务

**确保 OpenCode Server 先运行：**

```bash
opencode serve --port 4096
```

**然后启动桥接服务：**

```bash
npm run start
```

看到以下输出表示成功：

```
🚀 Feishu-OpenCode Bridge 启动中...
[OpenCode] 已连接到服务器: http://127.0.0.1:4096
[飞书] 初始化客户端...
[启动] WebSocket 已连接，等待飞书消息...
✅ 桥接服务已就绪！在飞书中给机器人发消息即可使用 OpenCode。
```

### 4. 在飞书中使用

1. 打开飞书，搜索你创建的机器人应用
2. 发送消息，OpenCode 会自动回复

## 命令

| 命令 | 说明 |
|------|------|
| `/new` `/reset` `/新会话` | 创建新会话 |
| `/abort` `/停止` | 中止当前任务 |
| `/sessions` `/会话列表` | 查看所有会话 |
| `/help` `/帮助` | 显示帮助 |

## 两种连接模式对比

| 特性 | WebSocket 模式 | HTTP 模式 |
|------|---------------|-----------|
| 需要公网 IP | ❌ 不需要 | ✅ 需要 |
| 延迟 | 低 | 稍高 |
| 配置复杂度 | 简单 | 需要内网穿透 |
| 适用场景 | 本地开发/内网 | 云端部署 |

## 内网穿透（HTTP 模式）

如果你使用 HTTP 模式但只有本地网络，可以用 ngrok：

```bash
# 安装 ngrok 后
ngrok http 3000
```

将生成的公网 URL 填写到飞书开放平台的事件订阅中。

## 文件结构

```
feishu-opencode-bridge/
├── src/
│   ├── index.js           # 主入口，启动逻辑
│   ├── feishu.js          # 飞书 SDK 封装
│   ├── opencode.js        # OpenCode SDK 封装
│   ├── session-manager.js # 用户会话管理
│   └── message-handler.js # 消息路由和处理
├── .env.example           # 环境变量模板
├── package.json
└── README.md
```

## 常见问题

**Q: OpenCode 回复很慢怎么办？**
A: OpenCode 执行代码任务可能需要较长时间，桥接服务会等待完整回复后发送。可以先用简单问题测试。

**Q: 消息超过飞书长度限制？**
A: 桥接服务会自动将长消息分块发送。

**Q: 如何切换 OpenCode 模型？**
A: 在 OpenCode 的配置文件或 TUI 中切换模型，桥接服务会自动使用。
