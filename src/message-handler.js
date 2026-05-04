import { extractTextFromFeishuEvent, replyFeishuMessage } from "./feishu.js";
import { sendPrompt, getOrCreateSession, listSessions, abortSession } from "./opencode.js";
import { getUserSessionId, setUserSessionId, removeUserSession } from "./session-manager.js";

const HELP_TEXT = `🤖 OpenCode 个人助理

直接发送消息即可与 OpenCode 对话。

可用命令：
• /new 或 /reset — 开始新会话
• /abort — 中止当前任务
• /sessions — 查看所有会话
• /help — 显示帮助

OpenCode 会在后台执行代码操作，完成后自动回复结果。`;

export async function handleMessage(feishuClient, client, event) {
  const text = extractTextFromFeishuEvent(event);
  const messageId = event?.message?.message_id;
  const chatType = event?.message?.chat_type;
  const senderOpenId = event?.sender?.sender_id?.open_id;

  if (!text || !messageId || !senderOpenId) {
    console.log("[消息处理] 跳过无效消息");
    return;
  }

  console.log(`[消息处理] 收到来自 ${senderOpenId} 的消息: ${text}`);

  if (chatType !== "p2p") {
    await replyFeishuMessage(feishuClient, messageId, "目前仅支持私聊对话。");
    return;
  }

  const commandResult = await handleCommand(feishuClient, client, messageId, senderOpenId, text);
  if (commandResult) return;

  await handlePrompt(feishuClient, client, messageId, senderOpenId, text);
}

async function handleCommand(feishuClient, client, messageId, openId, text) {
  const cmd = text.toLowerCase().trim();

  if (cmd === "/help" || cmd === "/帮助") {
    await replyFeishuMessage(feishuClient, messageId, HELP_TEXT);
    return true;
  }

  if (cmd === "/new" || cmd === "/reset" || cmd === "/新会话") {
    removeUserSession(openId);
    const session = await client.session.create({
      body: { title: `飞书私聊 ${openId.slice(-6)}` },
    });
    setUserSessionId(openId, session.data.id);
    await replyFeishuMessage(feishuClient, messageId, "✅ 已创建新会话，开始对话吧！");
    return true;
  }

  if (cmd === "/abort" || cmd === "/停止") {
    const sessionId = getUserSessionId(openId);
    if (sessionId) {
      try {
        await abortSession(client, sessionId);
        await replyFeishuMessage(feishuClient, messageId, "⏹ 已中止当前任务。");
      } catch (err) {
        await replyFeishuMessage(feishuClient, messageId, `中止失败: ${err.message}`);
      }
    } else {
      await replyFeishuMessage(feishuClient, messageId, "当前没有活跃会话。");
    }
    return true;
  }

  if (cmd === "/sessions" || cmd === "/会话列表") {
    try {
      const sessions = await listSessions(client);
      if (sessions.length === 0) {
        await replyFeishuMessage(feishuClient, messageId, "暂无会话。发送 /new 创建新会话。");
      } else {
        const currentId = getUserSessionId(openId);
        const list = sessions
          .map((s, i) => {
            const marker = s.id === currentId ? " ← 当前" : "";
            return `${i + 1}. ${s.title || "未命名"} (${s.id.slice(0, 8)})${marker}`;
          })
          .join("\n");
        await replyFeishuMessage(feishuClient, messageId, `📋 所有会话:\n${list}`);
      }
    } catch (err) {
      await replyFeishuMessage(feishuClient, messageId, `获取会话列表失败: ${err.message}`);
    }
    return true;
  }

  return false;
}

async function handlePrompt(feishuClient, client, messageId, openId, text) {
  await replyFeishuMessage(feishuClient, messageId, "🤔 正在思考中...");

  try {
    let sessionId = getUserSessionId(openId);

    if (!sessionId) {
      const session = await client.session.create({
        body: { title: `飞书私聊 ${openId.slice(-6)}` },
      });
      sessionId = session.data.id;
      setUserSessionId(openId, sessionId);
      console.log(`[会话管理] 为用户 ${openId} 创建新会话: ${sessionId}`);
    }

    const result = await sendPrompt(client, sessionId, text);

    const assistantMessage = result?.info;
    if (!assistantMessage) {
      await replyFeishuMessage(feishuClient, messageId, "⚠️ OpenCode 没有返回结果，请重试。");
      return;
    }

    const responseText = extractAssistantText(result);

    if (responseText) {
      const chunks = splitLongMessage(responseText, 4000);
      for (const chunk of chunks) {
        await replyFeishuMessage(feishuClient, messageId, chunk);
      }
    } else {
      await replyFeishuMessage(feishuClient, messageId, "✅ OpenCode 已完成处理（无文本输出）。");
    }
  } catch (err) {
    console.error("[消息处理] OpenCode 调用失败:", err);
    await replyFeishuMessage(
      feishuClient,
      messageId,
      `❌ 处理失败: ${err.message}\n\n发送 /new 重试或 /help 查看帮助。`
    );
  }
}

function extractAssistantText(result) {
  if (!result) return null;

  if (result.parts && Array.isArray(result.parts)) {
    const texts = [];
    for (const part of result.parts) {
      if (part.type === "text" && part.text) {
        texts.push(part.text);
      }
    }
    if (texts.length > 0) return texts.join("\n");
  }

  if (typeof result.content === "string") return result.content;
  if (result.text) return result.text;

  return null;
}

function splitLongMessage(text, maxLength) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n", maxLength);
    if (splitAt === -1 || splitAt < maxLength / 2) {
      splitAt = maxLength;
    }
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
