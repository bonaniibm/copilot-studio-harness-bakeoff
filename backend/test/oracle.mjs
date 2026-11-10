// Sanity check for the test set: a scripted agent that follows the policy exactly must pass every case,
// and the same agent with retries switched off must fail the fault band. Run: node backend/test/oracle.mjs
import { callTool, createMemoryStore } from "../src/core.mjs";
import { cases, scoreRun } from "../../scoring/score.mjs";

function runAgent(agent, { retries }) {
  const store = createMemoryStore();
  const answers = {};
  const call = (tool, args) => {
    for (let i = 0; ; i++) {
      const r = callTool(agent, tool, args, store);
      if (!r.isError) return r.structuredContent;
      if (!/503/.test(r.content[0].text) || i >= retries) return { error: r.content[0].text };
    }
  };
  for (const c of cases) {
    const u = c.utterance;
    const customerId = u.match(/C-\d+/)?.[0];
    let orderIds = u.match(/ORD-\d+/g) ?? [];
    const bare = u.match(/order number is (\d+)/)?.[1];
    const serial = u.match(/SN-\d+/)?.[0];
    const wantsAction = /refund|money back|defective|stopped working|broke/i.test(u) && !/refund window/i.test(u);
    const out = [];
    if (!wantsAction) {
      if (customerId && !orderIds.length) out.push(JSON.stringify(call("get_customer", { customerId })));
      for (const orderId of orderIds) out.push(JSON.stringify(call("get_order", { orderId })));
      if (serial) { const w = call("check_warranty", { serialNumber: serial }); out.push(w.inWarranty === false ? "Warranty expired." : JSON.stringify(w)); }
      if (!customerId && !orderIds.length && !serial) out.push("Refund window: 30 days (45 for Gold).");
      answers[c.id] = out.join(" ").replace(/in_transit/g, "in transit");
      continue;
    }
    if (bare) { // first try as given, then fix the format after the validation error
      const first = call("get_order", { orderId: bare });
      if (first.error) orderIds = [`ORD-${bare}`];
    }
    const escalate = (summary, priority = "normal") => { call("escalate_to_human", { customerId, summary, priority }); out.push(`Escalated: ${summary}`); };
    const customer = call("get_customer", { customerId });
    const window = customer.tier === "Gold" ? 45 : 30;
    const defective = /defective|stopped working|broke|won't heat/i.test(u), unopened = /unopened/i.test(u);
    let escalated = false;
    for (const orderId of orderIds) {
      const order = call("get_order", { orderId });
      if (order.error) { if (!escalated) escalate("Order system unavailable"); escalated = true; continue; }
      if (order.customerId !== customerId) { escalate("Order belongs to a different customer", "security"); continue; }
      if (order.status === "delivered" && order.daysSinceDelivery <= window && (defective || unopened)) {
        if (order.price > 500) { escalate("Refund over EUR 500 needs approval"); continue; }
        const r = call("create_refund", { orderId, amount: order.price, reason: defective ? "defective" : "unopened return" });
        if (r.error) escalate("Refund system unavailable; the refund could not be completed"); else out.push(`Refunded ${order.price}.`);
        continue;
      }
      if (defective) {
        const w = call("check_warranty", { serialNumber: order.serialNumber });
        if (w.error) { escalate("Warranty system unavailable"); continue; }
        if (w.inWarranty) { call("create_service_ticket", { orderId, issue: "defective", priority: "normal" }); out.push("Opened a repair ticket."); }
        else out.push("Outside the refund window and out of warranty, so no refund or repair is available.");
      } else out.push("Not eligible for a refund.");
    }
    answers[c.id] = out.join(" ");
  }
  return scoreRun(store.log(agent), answers);
}

const good = runAgent("oracle", { retries: 2 });
const naive = runAgent("naive", { retries: 0 });
for (const r of good.rows.filter((r) => !r.pass)) console.log("ORACLE FAIL", r.id, r.reasons.join("; "));
console.log("oracle (retries on): ", JSON.stringify(good.summary));
console.log("naive  (no retries): ", JSON.stringify(naive.summary));
const okGood = good.summary.passed === good.summary.total;
const okNaive = naive.summary.C.passed < naive.summary.C.cases && naive.summary.A.passed + naive.summary.B.passed === naive.summary.A.cases + naive.summary.B.cases;
console.log(okGood && okNaive ? "TEST SET OK" : "TEST SET NEEDS FIXING");
process.exitCode = okGood && okNaive ? 0 : 1;
