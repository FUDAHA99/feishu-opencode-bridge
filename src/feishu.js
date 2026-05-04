export async function replyFeishuMessage(client, messageId, content) {
  console.log(`[飞书] 回复消息: msgId="${messageId}" content="${content.slice(0,50)}..."`);
  try {
    const res = await client.im.message.reply({
      data: {
        content: JSON.stringify({ text: content }),
        msg_type: "text",
      },
      path: {
        message_id: messageId,
      },
    });
    console.log(`[飞书] 回复结果:`, JSON.stringify(res).slice(0, 300));
    if (res?.code !== 0) {
      throw new Error(`飞书回复失败: ${res?.msg || "未知错误"} (code: ${res?.code})`);
    }
  } catch (err) {
    if (err.response?.data) {
      console.error(`[飞书] API 错误:`, JSON.stringify(err.response.data));
    }
    throw err;
  }
}

export function extractTextFromFeishuEvent(event) {
  try {
    const message = event?.message;
    if (!message) return null;

    if (message.message_type === "text") {
      const content = JSON.parse(message.content);
      let text = content.text || "";
      const mentions = message.mentions || [];
      for (const mention of mentions) {
        text = text.replace(mention.key, "");
      }
      return text.trim();
    }

    return `[不支持的消息类型: ${message.message_type}]`;
  } catch (err) {
    console.error("解析飞书消息失败:", err);
    return null;
  }
}
