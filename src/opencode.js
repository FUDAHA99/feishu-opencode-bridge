import { spawn } from "child_process";

const MODEL = process.env.OPENCODE_MODEL || "opencode/big-pickle";

export function runPrompt(text) {
  return new Promise((resolve, reject) => {
    console.log(`[OpenCode] 执行: opencode run -m ${MODEL} "${text.slice(0, 50)}..."`);
    
    const child = spawn("opencode", ["run", "-m", MODEL, text], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      console.log(`[OpenCode] 退出码: ${code}`);
      console.log(`[OpenCode] stdout: ${stdout.slice(0, 200)}`);

      // 过滤掉标题行和 ANSI 颜色代码
      const lines = stdout.split("\n").filter(line => 
        !line.startsWith(">") && 
        !line.includes("·") &&
        !line.includes("Skill") &&
        line.trim() !== ""
      );
      const result = lines.join("\n").trim();
      console.log(`[OpenCode] 结果: ${result.slice(0, 100)}`);
      resolve(result);
    });

    child.on("error", (err) => {
      console.error(`[OpenCode] 错误:`, err.message);
      reject(err);
    });

    // 超时处理
    setTimeout(() => {
      child.kill();
      reject(new Error("OpenCode 执行超时"));
    }, 120000);
  });
}

export async function createSession(title) {
  const res = await fetch(`${process.env.OPENCODE_BASE_URL || "http://127.0.0.1:4096"}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title || "飞书会话" }),
  });
  return (await res.json()).id;
}

export async function listSessions() {
  const res = await fetch(`${process.env.OPENCODE_BASE_URL || "http://127.0.0.1:4096"}/session`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.sessions || [];
}

export async function abortSession(sessionId) {
  await fetch(`${process.env.OPENCODE_BASE_URL || "http://127.0.0.1:4096"}/session/${sessionId}/abort`, { method: "POST" });
}

export function subscribeEvents(onEvent) {
  // no-op when using CLI mode
  return () => {};
}
