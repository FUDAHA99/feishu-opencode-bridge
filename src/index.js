import "dotenv/config";
import express from "express";
import { createFeishuClient } from "./feishu.js";
import { initOpenCode } from "./opencode.js";
import { handleMessage } from "./message-handler.js";

const config = {
  feishu: {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN,
    encryptKey: process.env.FEISHU_ENCRYPT_KEY,
    useWebSocket: process.env.FEISHU_USE_WS !== "false",
  },
  opencode: {
    hostname: process.env.OPENCODE_HOSTNAME || "127.0.0.1",
    port: parseInt(process.env.OPENCODE_PORT || "4096", 10),
  },
  http: {
    port: parseInt(process.env.HTTP_PORT || "3000", 10),
  },
};

function validateConfig() {
  const missing = [];
  if (!config.feishu.appId) missing.push("FEISHU_APP_ID");
  if (!config.feishu.appSecret) missing.push("FEISHU_APP_SECRET");
  if (!config.feishu.useWebSocket) {
    if (!config.feishu.verificationToken) missing.push("FEISHU_VERIFICATION_TOKEN");
  }
  if (missing.length > 0) {
    console.error(`❌ 缺少必要环境变量: ${missing.join(", ")}`);
    console.error("请复制 .env.example 为 .env 并填写配置");
    process.exit(1);
  }
}

async function startWebSocketMode(feishu, opencodeClient) {
  console.log("[启动] 使用 WebSocket 模式连接飞书...");

  const eventDispatcher = feishu.client.eventDispatcher;

  eventDispatcher.register({
    "im.message.receive_v1": async (data) => {
      try {
        await handleMessage(feishu.client, opencodeClient, data);
      } catch (err) {
        console.error("[WebSocket] 消息处理错误:", err);
      }
    },
  });

  feishu.client.start();
  console.log("[启动] WebSocket 已连接，等待飞书消息...");
}

async function startHTTPMode(feishu, opencodeClient) {
  console.log("[启动] 使用 HTTP 模式连接飞书...");

  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/feishu/event", async (req, res) => {
    const body = req.body;

    if (body.challenge) {
      console.log("[HTTP] 收到 URL 验证请求");
      return res.json({ challenge: body.challenge });
    }

    if (body.header?.event_type === "im.message.receive_v1") {
      try {
        await handleMessage(feishu.client, opencodeClient, body.event);
      } catch (err) {
        console.error("[HTTP] 消息处理错误:", err);
      }
    }

    res.json({ code: 0 });
  });

  app.listen(config.http.port, () => {
    console.log(`[启动] HTTP 服务监听端口 ${config.http.port}`);
    console.log(`[启动] 请在飞书开放平台设置事件订阅 URL: http://<你的公网IP或域名>:${config.http.port}/feishu/event`);
  });
}

async function main() {
  console.log("🚀 Feishu-OpenCode Bridge 启动中...");

  validateConfig();

  console.log(`[OpenCode] 连接到 ${config.opencode.hostname}:${config.opencode.port}`);
  const opencode = await initOpenCode(config.opencode);
  const client = opencode.client;

  console.log("[飞书] 初始化客户端...");
  const feishu = createFeishuClient(config.feishu);

  if (feishu.type === "ws") {
    await startWebSocketMode(feishu, client);
  } else {
    await startHTTPMode(feishu, client);
  }

  console.log("✅ 桥接服务已就绪！在飞书中给机器人发消息即可使用 OpenCode。");

  process.on("SIGINT", () => {
    console.log("\n👋 正在关闭服务...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("❌ 启动失败:", err);
  process.exit(1);
});
