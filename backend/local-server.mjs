// HTTP host for the mock backend (runs locally and on Azure App Service, no dependencies).
//   POST /api/mcp/{agent}         MCP endpoint (agent = standard | harness)
//   GET  /api/admin/log/{agent}   call log
//   POST /api/admin/reset/{agent} clear log and failure counters
// When API_KEY is set, the admin routes require it as the x-api-key header. The MCP routes are open.
import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createMemoryStore, handleRpc } from "./src/core.mjs";

const port = Number(process.env.PORT || 7071);
const apiKey = process.env.API_KEY || "";
const dataDir = process.env.DATA_DIR || (existsSync("/home/site") ? "/home/data" : "");
if (dataDir) mkdirSync(dataDir, { recursive: true });
const store = createMemoryStore(dataDir ? { file: join(dataDir, "calls.json") } : {});

createServer(async (req, res) => {
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/") return send(200, { service: "contoso-appliances-service", ok: true });
  const m = url.pathname.match(/^\/api\/(mcp|admin\/log|admin\/reset)\/([a-z0-9-]+)$/);
  if (!m) return send(404, { error: "not found" });
  const [, route, agent] = m;
  // The MCP routes serve only fake data and are open; the admin routes (log, reset) need the key.
  if (route !== "mcp" && apiKey && req.headers["x-api-key"] !== apiKey) return send(401, { error: "unauthorized" });
  if (route === "admin/log" && req.method === "GET") return send(200, store.log(agent));
  if (route === "admin/reset" && req.method === "POST") { store.reset(agent); return send(200, { reset: agent }); }
  if (route !== "mcp" || req.method !== "POST") return send(405, { error: "method not allowed" });
  let raw = ""; for await (const chunk of req) raw += chunk;
  let msg; try { msg = JSON.parse(raw); } catch { return send(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); }
  const out = Array.isArray(msg) ? msg.map((x) => handleRpc(agent, x, store)).filter(Boolean) : handleRpc(agent, msg, store);
  if (out === null || (Array.isArray(out) && !out.length)) { res.writeHead(202); return res.end(); }
  send(200, out);
}).listen(port, () => console.log(`mock backend listening on ${port}${apiKey ? " (key required)" : ""}`));
