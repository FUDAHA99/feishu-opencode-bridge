import { spawn } from "child_process";

const DEFAULT_MODEL = process.env.OPENCODE_MODEL || "opencode/big-pickle";

export function runPrompt(text, model, dir) {
  const m = model || DEFAULT_MODEL;
  const args = ["/c", "opencode", "run", "--format", "json", "-m", m];
  if (dir) args.push("--dir", dir);
  args.push(text);

  return new Promise((resolve, reject) => {
    console.log(`[OpenCode] 执行: opencode run -m ${m}${dir ? ` --dir ${dir}` : ""} "${text.slice(0, 50)}..."`);

    const child = spawn("cmd.exe", args, { stdio: ["ignore", "pipe", "pipe"], shell: false });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(`[OpenCode] stderr: ${data.toString().slice(0, 200)}`);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      console.log(`[OpenCode] 退出码: ${code}`);

      // 解析 JSON 事件流，提取所有 text 片段
      const lines = stdout.split("\n").filter(Boolean);
      const textParts = [];
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type === "text" && event.part?.text) {
            textParts.push(event.part.text);
          }
        } catch {}
      }
      const result = textParts.join("").trim();
      console.log(`[OpenCode] 结果: ${result.slice(0, 100)}`);

      // 结果为空但有 stderr 错误时，提取关键错误信息返回
      if (!result && stderr) {
        const errLine = stderr.split("\n").find((l) => l.includes("Error:") || l.includes("error:")) || stderr.split("\n")[0];
        resolve(`❌ ${errLine.trim()}`);
        return;
      }

      resolve(result);
    });

    child.on("error", (err) => {
      console.error(`[OpenCode] 错误:`, err.message);
      reject(err);
    });

    const timer = setTimeout(() => {
      // Windows 上需要用 taskkill 杀掉整个进程树
      try { spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { shell: false }); } catch {}
      reject(new Error("OpenCode 执行超时（300s）"));
    }, 300000);
  });
}

export function listModels() {
  return new Promise((resolve, reject) => {
    const child = spawn("cmd.exe", ["/c", "opencode", "models"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.on("close", () => resolve(stdout.trim().split("\n").map((l) => l.trim()).filter(Boolean)));
    child.on("error", reject);
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
