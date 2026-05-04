import "dotenv/config";
import { WSClient, EventDispatcher, Client } from "@larksuiteoapi/node-sdk";
import { runPrompt, listModels } from "./opencode.js";
import { getUserSessionId, setUserSessionId, removeUserSession, getUserModel, setUserModel, getUserDir, setUserDir, removeUserDir } from "./session-manager.js";

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;

if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
  console.error("❌ 缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET");
  process.exit(1);
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

const processedMessages = new Set();
const SERVICE_START_TIME = Date.now();

async function reply(messageId, text) {
  const http = new Client({ appId: FEISHU_APP_ID, appSecret: FEISHU_APP_SECRET });
  await http.im.message.reply({
    data: { content: JSON.stringify({ text }), msg_type: "text" },
    path: { message_id: messageId },
  });
}

async function main() {
  console.log("🚀 Feishu-OpenCode Bridge 启动中...");

  const wsClient = new WSClient({
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
  });
  console.log("[飞书] WS 客户端初始化成功");

  const eventDispatcher = new EventDispatcher({
    encryptKey: process.env.FEISHU_ENCRYPT_KEY || "",
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || "",
  });

  eventDispatcher.register({
    "im.message.receive_v1": async (data) => {
      try {
        const message = data?.message;
        if (!message || message.message_type !== "text") return;

        // 跳过服务启动前的历史消息（Feishu 重连时会重放）
        const createTime = parseInt(message.create_time || "0", 10);
        if (createTime > 0 && createTime < SERVICE_START_TIME - 5000) {
          console.log(`[去重] 跳过历史消息 (${new Date(createTime).toISOString()}): ${message.message_id}`);
          return;
        }

        const messageId = message.message_id;
        if (processedMessages.has(messageId)) {
          console.log(`[去重] 跳过已处理消息: ${messageId}`);
          return;
        }
        processedMessages.add(messageId);
        if (processedMessages.size > 1000) {
          const arr = [...processedMessages];
          arr.slice(0, 500).forEach((id) => processedMessages.delete(id));
        }

        const content = safeJsonParse(message.content);
        const text = content?.text || "";
        const openId = data?.sender?.sender_id?.open_id;

        console.log(`[消息] ${openId}: ${text}`);

        const cmd = text.trim();
        const cmdLower = cmd.toLowerCase();
        if (cmdLower === "/help" || cmdLower === "/帮助") {
          const currentModel = getUserModel(openId) || process.env.OPENCODE_MODEL || "opencode/big-pickle";
          const currentDir = getUserDir(openId) || "（默认）";
          await reply(messageId, `🤖 OpenCode 个人助理\n\n直接发送消息即可对话。\n\n命令：\n• /models — 查看所有可用模型\n• /model <名称> — 切换模型\n• /model — 查看当前模型\n• /dir <路径> — 切换工作目录\n• /dir — 查看当前目录\n• /new — 新会话\n• /help — 帮助\n\n当前模型：${currentModel}\n当前目录：${currentDir}`);
          return;
        }
        if (cmdLower === "/new" || cmdLower === "/reset" || cmdLower === "/新会话") {
          removeUserSession(openId);
          await reply(messageId, "✅ 已重置");
          return;
        }
        if (cmdLower === "/models") {
          await reply(messageId, "⏳ 查询可用模型中...");
          const models = await listModels();
          const text = `📋 可用模型列表（共 ${models.length} 个）：\n\n${models.join("\n")}\n\n用法：/model <模型名> 切换模型\n例如：/model google/gemini-2.5-flash`;
          const chunks = splitLongMessage(text, 4000);
          for (const chunk of chunks) await reply(messageId, chunk);
          return;
        }
        if (cmdLower.startsWith("/model ") || cmdLower === "/model") {
          const parts = cmd.split(/\s+/);
          if (parts.length === 1) {
            const currentModel = getUserModel(openId) || process.env.OPENCODE_MODEL || "opencode/big-pickle";
            await reply(messageId, `当前模型：${currentModel}\n\n发送 /models 查看可用模型列表`);
          } else {
            const newModel = parts.slice(1).join(" ").trim();
            if (!newModel.includes("/")) {
              await reply(messageId, `❌ 模型名格式错误：${newModel}\n\n模型名必须包含 provider/model，例如：\n• opencode/big-pickle\n• google/gemini-2.5-flash\n\n发送 /models 查看完整列表`);
            } else {
              setUserModel(openId, newModel);
              await reply(messageId, `✅ 已切换模型：${newModel}`);
            }
          }
          return;
        }
        if (cmdLower.startsWith("/dir ") || cmdLower === "/dir") {
          const parts = cmd.split(/\s+/);
          if (parts.length === 1) {
            const currentDir = getUserDir(openId) || "（默认）";
            await reply(messageId, `当前工作目录：${currentDir}`);
          } else {
            const newDir = parts.slice(1).join(" ").trim();
            setUserDir(openId, newDir);
            await reply(messageId, `✅ 已切换工作目录：${newDir}`);
          }
          return;
        }

        await reply(messageId, "🤔 思考中...");

        const userModel = getUserModel(openId);
        const userDir = getUserDir(openId);
        const responseText = await runPrompt(text, userModel, userDir);
        console.log(`[OpenCode] 回复: ${responseText.slice(0, 100)}`);

        if (responseText) {
          const chunks = splitLongMessage(responseText, 4000);
          for (const chunk of chunks) {
            await reply(messageId, chunk);
          }
        } else {
          await reply(messageId, "✅ 已完成（无文本输出）");
        }
      } catch (err) {
        console.error("[错误]", err.message);
        try {
          const msgId = data?.message?.message_id;
          if (msgId) await reply(msgId, `❌ ${err.message}`);
        } catch {}
      }
    },
  });

  console.log("[飞书] 启动 WebSocket 长连接...");
  await wsClient.start({ eventDispatcher });

  console.log("\n✅ 服务就绪！在飞书中给机器人发消息即可\n");

  process.on("SIGINT", () => {
    console.log("\n👋 关闭");
    wsClient.close();
    process.exit(0);
  });
}

function splitLongMessage(text, maxLength) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n", maxLength);
    if (splitAt === -1 || splitAt < maxLength / 2) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

main().catch((err) => {
  console.error("❌ 启动失败:", err);
  process.exit(1);
});
