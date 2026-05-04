import "dotenv/config";
import { WSClient, EventDispatcher, Client } from "@larksuiteoapi/node-sdk";
import { runPrompt } from "./opencode.js";
import { getUserSessionId, setUserSessionId, removeUserSession } from "./session-manager.js";

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

        const cmd = text.toLowerCase().trim();
        if (cmd === "/help" || cmd === "/帮助") {
          await reply(messageId, "🤖 OpenCode 个人助理\n\n直接发送消息即可对话。\n\n命令：\n• /new — 新会话\n• /abort — 中止任务\n• /help — 帮助");
          return;
        }
        if (cmd === "/new" || cmd === "/reset" || cmd === "/新会话") {
          removeUserSession(openId);
          await reply(messageId, "✅ 已重置");
          return;
        }

        await reply(messageId, "🤔 思考中...");

        const responseText = await runPrompt(text);
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
