import { createOpencode } from "@opencode-ai/sdk";

let instance = null;

export async function initOpenCode(options = {}) {
  if (instance) return instance;

  const { hostname = "127.0.0.1", port = 4096, config = {} } = options;

  instance = await createOpencode({
    hostname,
    port,
    config,
  });

  console.log(`[OpenCode] 已连接到服务器: ${instance.server.url}`);
  return instance;
}

export async function getOrCreateSession(client, sessionId) {
  try {
    const result = await client.session.get({ path: { id: sessionId } });
    return result.data;
  } catch {
    const created = await client.session.create({
      body: { title: `飞书会话 ${sessionId.slice(0, 8)}` },
    });
    return created.data;
  }
}

export async function sendPrompt(client, sessionId, text) {
  const result = await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [{ type: "text", text }],
    },
  });
  return result.data;
}

export async function listSessions(client) {
  const result = await client.session.list();
  return result.data || [];
}

export async function abortSession(client, sessionId) {
  await client.session.abort({ path: { id: sessionId } });
}
