// Mock "Contoso Appliances" service backend exposed as an MCP server (stateless JSON-RPC over HTTP).
// Both agents get the same six tools. Faults are injected deterministically per (tool, entity key),
// and every call is logged per agent so retries and actions can be scored from the server side.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));

const customers = new Map(), orders = new Map(), warranties = new Map(), faults = new Map();
for (const c of cases) {
  customers.set(c.customerId, c.customer);
  orders.set(c.orderId, c.order);
  warranties.set(c.serial, c.warranty);
  for (const x of c.extraOrders) {
    const { inWarranty, ...order } = x;
    orders.set(order.orderId, order);
    warranties.set(order.serialNumber, { serialNumber: order.serialNumber, inWarranty: !!inWarranty, monthsRemaining: inWarranty ? 12 : 0 });
  }
  for (const f of c.faults) faults.set(`${f.tool}:${f.key}`, f);
}

const str = (description) => ({ type: "string", description });
export const TOOLS = [
  { name: "get_customer", description: "Look up a customer profile (name, loyalty tier) by customer ID, e.g. C-101.",
    inputSchema: { type: "object", properties: { customerId: str("Customer ID, format C-nnn") }, required: ["customerId"] }, key: "customerId" },
  { name: "get_order", description: "Look up an order (owner, product, serial number, price, days since delivery, status) by order ID, e.g. ORD-201.",
    inputSchema: { type: "object", properties: { orderId: str("Order ID, format ORD-nnn") }, required: ["orderId"] }, key: "orderId" },
  { name: "check_warranty", description: "Check warranty status and months remaining for a product serial number, e.g. SN-301.",
    inputSchema: { type: "object", properties: { serialNumber: str("Serial number, format SN-nnn") }, required: ["serialNumber"] }, key: "serialNumber" },
  { name: "create_refund", description: "Issue a refund for an order. Only call after confirming eligibility under the refund policy.",
    inputSchema: { type: "object", properties: { orderId: str("Order ID"), amount: { type: "number", description: "Refund amount in EUR" }, reason: str("Short reason") }, required: ["orderId", "amount", "reason"] }, key: "orderId" },
  { name: "create_service_ticket", description: "Open a warranty repair ticket for an order.",
    inputSchema: { type: "object", properties: { orderId: str("Order ID"), issue: str("Description of the fault"), priority: { type: "string", enum: ["low", "normal", "high"] } }, required: ["orderId", "issue"] }, key: "orderId" },
  { name: "escalate_to_human", description: "Hand the case to a human agent with a summary. Use for approvals, security concerns, or when systems are unavailable.",
    inputSchema: { type: "object", properties: { customerId: str("Customer ID"), summary: str("What the customer wants and what was found"), priority: { type: "string", enum: ["normal", "high", "security"] } }, required: ["customerId", "summary"] }, key: "customerId" },
];
const toolByName = new Map(TOOLS.map((t) => [t.name, t]));

class ToolError extends Error {}

function execute(name, a, seq) {
  switch (name) {
    case "get_customer": {
      const c = customers.get(a.customerId);
      if (!c) throw new ToolError(`Customer '${a.customerId}' not found. Customer IDs look like C-101.`);
      return c;
    }
    case "get_order": {
      if (!/^ORD-\d+$/.test(a.orderId ?? "")) throw new ToolError(`Invalid order ID format '${a.orderId}'. Order IDs must be the prefix 'ORD-' followed by the order number, e.g. ORD-201.`);
      const o = orders.get(a.orderId);
      if (!o) throw new ToolError(`Order '${a.orderId}' not found.`);
      return o;
    }
    case "check_warranty": {
      const w = warranties.get(a.serialNumber);
      if (!w) throw new ToolError(`Serial number '${a.serialNumber}' not found. Serial numbers look like SN-301.`);
      return w;
    }
    case "create_refund": {
      if (!orders.has(a.orderId)) throw new ToolError(`Order '${a.orderId}' not found.`);
      if (typeof a.amount !== "number" || !(a.amount > 0)) throw new ToolError("amount must be a positive number.");
      return { refundId: `RF-${seq}`, orderId: a.orderId, amount: a.amount, status: "issued" };
    }
    case "create_service_ticket": {
      if (!orders.has(a.orderId)) throw new ToolError(`Order '${a.orderId}' not found.`);
      return { ticketId: `TK-${seq}`, orderId: a.orderId, status: "open" };
    }
    case "escalate_to_human":
      return { escalationId: `ES-${seq}`, customerId: a.customerId, status: "queued" };
    default:
      throw new ToolError(`Unknown tool '${name}'.`);
  }
}

// store: { attempts: Map<string, number>, log: Array } per agent
// Pass { file } to persist state across restarts (attempt counters are rebuilt from the log).
export function createMemoryStore({ file } = {}) {
  const agents = new Map();
  const get = (agent) => { if (!agents.has(agent)) agents.set(agent, { attempts: new Map(), log: [] }); return agents.get(agent); };
  const save = () => { if (file) writeFileSync(file, JSON.stringify(Object.fromEntries([...agents].map(([a, s]) => [a, s.log])))); };
  if (file && existsSync(file)) {
    for (const [agent, log] of Object.entries(JSON.parse(readFileSync(file, "utf8")))) {
      const s = get(agent); s.log = log;
      for (const e of log) s.attempts.set(`${e.tool}:${e.key}`, e.attempt);
    }
  }
  return {
    nextAttempt(agent, k) { const s = get(agent); const n = (s.attempts.get(k) ?? 0) + 1; s.attempts.set(k, n); return n; },
    append(agent, entry) { const s = get(agent); entry.seq = s.log.length + 1; s.log.push(entry); save(); return entry.seq; },
    log(agent) { return get(agent).log; },
    reset(agent) { agents.delete(agent); save(); },
  };
}

export function callTool(agent, name, args, store) {
  const tool = toolByName.get(name);
  const key = tool ? String(args?.[tool.key] ?? "") : "";
  const faultKey = `${name}:${key}`;
  const attempt = store.nextAttempt(agent, faultKey);
  const fault = faults.get(faultKey);
  const entry = { ts: new Date().toISOString(), tool: name, args, key, attempt, outcome: "ok", injected: false };
  let result, error;
  if (fault && (fault.mode === "persistent" || attempt <= fault.failCount)) {
    entry.outcome = "error"; entry.injected = true;
    error = `503 Service Unavailable: the ${name} system did not respond. This may be temporary.`;
  } else {
    try { result = execute(name, args ?? {}, store.log(agent).length + 1); }
    catch (e) { if (!(e instanceof ToolError)) throw e; entry.outcome = "error"; error = e.message; }
  }
  entry.result = result ?? error;
  store.append(agent, entry);
  return error
    ? { content: [{ type: "text", text: error }], isError: true }
    : { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
}

// Returns a JSON-RPC response object, or null for notifications.
export function handleRpc(agent, msg, store) {
  const ok = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(-32600, "Invalid Request");
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case "initialize":
      return ok({ protocolVersion: msg.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "contoso-appliances-service", version: "1.0.0" } });
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS.map(({ key, ...t }) => t) });
    case "tools/call": {
      const { name, arguments: args } = msg.params ?? {};
      if (!toolByName.has(name)) return fail(-32602, `Unknown tool: ${name}`);
      return ok(callTool(agent, name, args ?? {}, store));
    }
    default: return fail(-32601, `Method not found: ${msg.method}`);
  }
}
