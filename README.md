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

# OpenCode 默认模型（可选，默认使用 opencode/big-pickle）
OPENCODE_MODEL=opencode/big-pickle
```

### 3. 启动服务

**Windows 双击启动（推荐）：**

直接双击项目根目录的 `启动.bat`。

**命令行启动：**

```bash
npm start
```

看到以下输出表示成功：

```
🚀 Feishu-OpenCode Bridge 启动中...
[飞书] WS 客户端初始化成功
[飞书] 启动 WebSocket 长连接...
✅ 服务就绪！在飞书中给机器人发消息即可
```

> 关闭终端窗口即可停止服务。

### 4. 在飞书中使用

打开飞书，搜索你创建的机器人应用，直接发消息即可。

## 命令

| 命令 | 说明 |
|------|------|
| `/help` `/帮助` | 显示帮助及当前状态 |
| `/new` `/reset` `/新会话` | 重置当前会话 |
| `/models` | 列出所有可用模型 |
| `/model` | 查看当前使用的模型 |
| `/model <模型名>` | 切换模型（格式：`provider/model`） |
| `/dir` | 查看当前工作目录 |
| `/dir <路径>` | 切换工作目录 |

### 切换模型示例

```
/models                              # 查看可用模型列表
/model google/gemini-2.5-flash       # 切换到 Gemini
/model LongCat/LongCat-2.0-Preview   # 切换到 LongCat
/model opencode/big-pickle           # 切回默认
```

> 模型名必须是 `provider/model` 格式，可通过 `/models` 查看完整列表。

### 切换工作目录示例

```
/dir F:\my-project    # 切换到指定目录
/dir                  # 查看当前目录
```

切换后，后续所有对话都在该目录下执行。

## 文件结构

```
feishu-opencode-bridge/
├── src/
│   ├── index.js           # 主入口，飞书 WebSocket 事件处理
│   ├── opencode.js        # OpenCode CLI 调用封装
│   ├── session-manager.js # 用户会话、模型、目录状态管理
│   ├── feishu.js          # 飞书消息工具函数
│   └── message-handler.js # 消息处理模块
├── 启动.bat               # Windows 一键启动脚本
├── .env.example           # 环境变量模板
├── package.json
└── README.md
```

## 常见问题

**Q: 如何切换模型？**
A: 发送 `/models` 查看可用模型列表，再用 `/model <模型名>` 切换。模型名格式为 `provider/model`，例如 `google/gemini-2.5-flash`。

**Q: 切换目录后权限报错？**
A: 使用 `/dir <路径>` 命令切换工作目录，不要直接让 OpenCode 自己去切换，否则会触发权限拦截。

**Q: OpenCode 回复很慢或超时？**
A: 不同模型响应速度差异较大，超时上限为 300 秒。慢模型（如 LongCat）正常，耐心等待即可。

**Q: 消息超过飞书长度限制？**
A: 桥接服务会自动将长消息分块发送。

**Q: 机器人不回复消息？**
A: 检查以下几点：
1. 确认飞书开放平台的订阅方式是「长连接」模式
2. 确认已订阅 `im.message.receive_v1` 事件
3. 确认应用已发布并审批通过
4. 检查控制台日志是否有错误信息

**Q: 重启服务后收到重复回复？**
A: 已内置去重机制，服务启动前 5 秒的历史消息会自动跳过，不会重复处理。
