import { Client, WSClient } from "@larksuiteoapi/node-sdk";

export function createFeishuClient(config) {
  const {
    appId,
    appSecret,
    verificationToken,
    encryptKey,
    useWebSocket = true,
  } = config;

  if (useWebSocket) {
    const wsClient = new WSClient({
      appId,
      appSecret,
    });
    return { type: "ws", client: wsClient };
  }

  const httpClient = new Client({
    appId,
    appSecret,
    appType: "self-built",
    verificationToken,
    encryptKey,
  });
  return { type: "http", client: httpClient };
}

export async function replyFeishuMessage(feishuClient, messageId, content, msgType = "text") {
  if (msgType === "text") {
    const textContent = JSON.stringify({ text: content });
    await feishuClient.im.message.reply({
      message_id: messageId,
      content: textContent,
      msg_type: "text",
    });
  } else {
    await feishuClient.im.message.reply({
      message_id: messageId,
      content: content,
      msg_type: msgType,
    });
  }
}

export async function sendFeishuMessage(feishuClient, receiveId, content, receiveIdType = "open_id", msgType = "text") {
  const textContent = msgType === "text" ? JSON.stringify({ text: content }) : content;
  return await feishuClient.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      content: textContent,
      msg_type: msgType,
    },
  });
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
