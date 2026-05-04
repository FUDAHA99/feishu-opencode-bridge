# Feishu-OpenCode Bridge

飞书个人助理 ↔ OpenCode AI 编程助手的桥接服务。

在飞书中私聊机器人，即可远程控制 OpenCode 执行代码任务。

## 架构

```
飞书用户 ←→ 飞书平台 ←→ 桥接服务 ←→ OpenCode CLI
                ↑
         WebSocket 长连接
```

**无需公网 IP**，使用飞书 WebSocket 长连接模式接收事件。

## 前置条件

1. **OpenCode** 已安装（`npm install -g opencode-ai`）
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
5. 配置事件订阅：
   - **订阅方式**：选择「使用长连接接收事件」
   - **订阅事件**：添加 `im.message.receive_v1`
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

# OpenCode 模型（可选，默认使用 opencode/big-pickle）
OPENCODE_MODEL=opencode/big-pickle
```

### 3. 启动服务

```bash
npm run start
```

看到以下输出表示成功：

```
🚀 Feishu-OpenCode Bridge 启动中...
[飞书] WS 客户端初始化成功
[飞书] 启动 WebSocket 长连接...
[info]: [ '[ws]', 'ws client ready' ]

✅ 服务就绪！在飞书中给机器人发消息即可
```

### 4. 在飞书中使用

1. 打开飞书，搜索你创建的机器人应用
2. 发送消息，OpenCode 会自动回复

## 命令

| 命令 | 说明 |
|------|------|
| `/new` `/reset` `/新会话` | 创建新会话 |
| `/help` `/帮助` | 显示帮助 |

## 文件结构

```
feishu-opencode-bridge/
├── src/
│   ├── index.js           # 主入口，飞书 WebSocket 事件处理
│   ├── opencode.js        # OpenCode CLI 调用封装
│   └── session-manager.js # 用户会话管理
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
A: 在 `.env` 文件中设置 `OPENCODE_MODEL` 环境变量，或在 OpenCode 配置文件中修改默认模型。

**Q: 机器人不回复消息？**
A: 检查以下几点：
1. 确认飞书开放平台的订阅方式是「长连接」模式
2. 确认已订阅 `im.message.receive_v1` 事件
3. 确认应用已发布并审批通过
4. 检查控制台日志是否有错误信息
