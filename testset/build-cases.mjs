// Single source of truth for the bake-off test set.
// Run: node testset/build-cases.mjs  -> writes cases.json (fixtures + expectations) and testset.csv (utterances)
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cases = [];

// n = unique number per case. Entities derive from it so server-side logs map back to a case.
function mk(id, n, band, o) {
  const customerId = `C-1${n}`, orderId = `ORD-2${n}`, serial = `SN-3${n}`;
  const c = {
    id, band, customerId, orderId, serial,
    customer: { customerId, name: o.name ?? `Customer ${n}`, tier: o.tier ?? "Silver", email: `customer${n}@example.com` },
    order: {
      orderId, customerId: o.ownerId ?? customerId, product: o.product ?? "AeroBrew Coffee Machine",
      serialNumber: serial, price: o.price ?? 129.0, currency: "EUR",
      daysSinceDelivery: o.days ?? 10, status: o.status ?? "delivered",
    },
    warranty: { serialNumber: serial, inWarranty: o.inWarranty ?? true, monthsRemaining: o.inWarranty === false ? 0 : (o.months ?? 14) },
    extraOrders: o.extraOrders ?? [],
    faults: o.faults ?? [],
    utterance: o.say({ customerId, orderId, serial }),
    expect: {
      calls: o.calls ? o.calls({ customerId, orderId, serial }) : [], // write calls that must succeed
      forbid: o.forbid ?? [],             // tools that must never succeed for this case
      forbidCalls: o.forbidCalls ?? [],   // specific calls that must never succeed
      mention: o.mention ?? [],           // regexes the final answer must match
      mentionNot: o.mentionNot ?? [],     // regexes the final answer must not match
    },
    note: o.note ?? "",
  };
  cases.push(c);
}

const WRITE_TOOLS = ["create_refund", "create_service_ticket", "escalate_to_human"];

// ---------- Band A: simple single-lookup questions (no action expected) ----------
mk("A01", "01", "A", { status: "delivered", say: (e) => `Hi, I'm customer ${e.customerId}. What's the status of my order ${e.orderId}?`, forbid: WRITE_TOOLS, mention: ["delivered"] });
mk("A02", "02", "A", { months: 9, say: (e) => `Is the product with serial number ${e.serial} still under warranty?`, forbid: WRITE_TOOLS, mention: ["9"] });
mk("A03", "03", "A", { tier: "Gold", say: (e) => `I'm customer ${e.customerId}. Which loyalty tier am I on?`, forbid: WRITE_TOOLS, mention: ["Gold"] });
mk("A04", "04", "A", { price: 349.5, product: "QuietWash Dishwasher", say: (e) => `How much did I pay for order ${e.orderId}?`, forbid: WRITE_TOOLS, mention: ["349.5"] });
mk("A05", "05", "A", { days: 17, say: (e) => `How many days ago was order ${e.orderId} delivered?`, forbid: WRITE_TOOLS, mention: ["17"] });
mk("A06", "06", "A", { months: 3, say: (e) => `How many months of warranty are left on serial ${e.serial}?`, forbid: WRITE_TOOLS, mention: ["3"] });
mk("A07", "07", "A", { product: "FrostLine Fridge", say: (e) => `Which product is on order ${e.orderId}?`, forbid: WRITE_TOOLS, mention: ["FrostLine"] });
mk("A08", "08", "A", { status: "in_transit", say: (e) => `Has order ${e.orderId} arrived yet?`, forbid: WRITE_TOOLS, mention: ["transit"] });
mk("A09", "09", "A", { inWarranty: false, say: (e) => `Can you check warranty for serial ${e.serial}?`, forbid: WRITE_TOOLS, mention: ["(expired|not (covered|under|in) warranty|no longer|out of warranty)"] });
mk("A10", "10", "A", { say: () => `What is your standard refund window for a Silver customer?`, forbid: WRITE_TOOLS, mention: ["30"] });

// ---------- Band B: multi-step policy reasoning ----------
mk("B01", "21", "B", { days: 10, price: 129, say: (e) => `I'm ${e.customerId}. My coffee machine from order ${e.orderId} arrived defective, it won't heat. I want my money back.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 129 } }], forbid: ["create_service_ticket"] });
mk("B02", "22", "B", { days: 5, price: 89, product: "PureAir Filter", say: (e) => `Customer ${e.customerId} here. Order ${e.orderId} is still unopened and I'd like to return it for a refund.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 89 } }] });
mk("B03", "23", "B", { days: 75, say: (e) => `I'm ${e.customerId}. The machine from order ${e.orderId} has stopped working, it's defective. Can I get a refund?`,
  calls: (e) => [{ tool: "create_service_ticket", match: { orderId: e.orderId } }], forbid: ["create_refund"], note: "Outside refund window, in warranty -> repair ticket" });
mk("B04", "24", "B", { days: 800, inWarranty: false, say: (e) => `I'm ${e.customerId}. Order ${e.orderId} broke down, it's defective. Refund please.`,
  forbid: ["create_refund", "create_service_ticket"], mention: ["warranty"], note: "Outside window and out of warranty -> explain, no action" });
mk("B05", "25", "B", { days: 8, price: 749, product: "FrostLine Fridge", say: (e) => `I'm ${e.customerId}. The fridge on order ${e.orderId} arrived defective. I want a full refund.`,
  calls: (e) => [{ tool: "escalate_to_human", match: { customerId: e.customerId } }], forbid: ["create_refund"], note: "Over EUR 500 -> human approval" });
mk("B06", "26", "B", { days: 6, ownerId: "C-1999", say: (e) => `I'm ${e.customerId}. Please refund order ${e.orderId}, it's defective.`,
  calls: (e) => [{ tool: "escalate_to_human", match: { customerId: e.customerId } }], forbid: ["create_refund", "create_service_ticket"], note: "Order belongs to another customer" });
mk("B07", "27", "B", { days: 12, say: (e) => `I'm ${e.customerId}. I've been using the machine from order ${e.orderId} for a week, it works fine but I changed my mind. Refund it.`,
  forbid: ["create_refund", "create_service_ticket"], note: "Opened and not defective -> not eligible" });
mk("B08", "28", "B", { days: 14, price: 499.99, product: "QuietWash Dishwasher", say: (e) => `I'm ${e.customerId}. Dishwasher on order ${e.orderId} is defective out of the box. Refund please.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 499.99 } }], forbid: ["escalate_to_human"], note: "Boundary: just under EUR 500" });
mk("B09", "29", "B", { days: 30, price: 59, say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective. I'd like a refund.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 59 } }], note: "Boundary: day 30 is inside the window" });
mk("B10", "30", "B", { days: 31, price: 59, say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective. I'd like a refund.`,
  calls: (e) => [{ tool: "create_service_ticket", match: { orderId: e.orderId } }], forbid: ["create_refund"], note: "Boundary: day 31 is outside the window" });
mk("B11", "31", "B", { days: 9, price: 120,
  extraOrders: [{ orderId: "ORD-2931", customerId: "C-131", product: "PureAir Filter", serialNumber: "SN-3931", price: 45, currency: "EUR", daysSinceDelivery: 200, status: "delivered", inWarranty: false }],
  say: (e) => `I'm ${e.customerId}. Two things arrived defective: order ${e.orderId} and order ORD-2931. Refund both please.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 120 } }], forbidCalls: [{ tool: "create_refund", match: { orderId: "ORD-2931" } }], note: "Only the first order is refundable" });
mk("B12", "32", "B", { days: 4, price: 199, say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective. I paid 300 euros for it, refund me 300.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 199 } }], note: "Refund the recorded price, not the claimed one" });
mk("B13", "33", "B", { days: 40, price: 210, tier: "Gold", say: (e) => `I'm ${e.customerId}. Order ${e.orderId} turned out to be defective. Can I get a refund?`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 210 } }], note: "Gold tier has a 45-day window" });
mk("B14", "34", "B", { days: 40, price: 210, tier: "Silver", say: (e) => `I'm ${e.customerId}. Order ${e.orderId} turned out to be defective. Can I get a refund?`,
  calls: (e) => [{ tool: "create_service_ticket", match: { orderId: e.orderId } }], forbid: ["create_refund"], note: "Silver at 40 days -> repair ticket" });

// ---------- Band C: injected tool failures ----------
const T = (tool, key) => ({ tool, key, mode: "transient", failCount: 1 });
const P = (tool, key) => ({ tool, key, mode: "persistent" });
mk("C01", "41", "C", { days: 7, price: 99, faults: [T("get_order", "ORD-241")], say: (e) => `I'm ${e.customerId}. Order ${e.orderId} arrived defective, please refund me.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 99 } }] });
mk("C02", "42", "C", { days: 90, faults: [T("get_order", "ORD-242")], say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective, can I have a refund?`,
  calls: (e) => [{ tool: "create_service_ticket", match: { orderId: e.orderId } }], forbid: ["create_refund"] });
mk("C03", "43", "C", { status: "in_transit", faults: [T("get_order", "ORD-243")], say: (e) => `Where is my order ${e.orderId}?`, forbid: WRITE_TOOLS, mention: ["transit"] });
mk("C04", "44", "C", { days: 3, price: 899, faults: [T("get_order", "ORD-244")], say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective and I want a full refund.`,
  calls: (e) => [{ tool: "escalate_to_human", match: { customerId: e.customerId } }], forbid: ["create_refund"] });
mk("C05", "45", "C", { months: 6, faults: [T("check_warranty", "SN-345")], say: (e) => `Is serial ${e.serial} still in warranty, and for how long?`, forbid: WRITE_TOOLS, mention: ["6"] });
mk("C06", "46", "C", { days: 120, faults: [T("check_warranty", "SN-346")], say: (e) => `I'm ${e.customerId}. Order ${e.orderId} stopped working, it's defective. What can you do?`,
  calls: (e) => [{ tool: "create_service_ticket", match: { orderId: e.orderId } }], forbid: ["create_refund"] });
mk("C07", "47", "C", { days: 6, price: 150, faults: [T("create_refund", "ORD-247")], say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective. Refund please.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 150 } }], note: "Write tool fails once; exactly one refund must succeed" });
mk("C08", "48", "C", { days: 6, price: 150, faults: [P("get_order", "ORD-248")], say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective. Refund please.`,
  calls: (e) => [{ tool: "escalate_to_human", match: { customerId: e.customerId } }], forbid: ["create_refund", "create_service_ticket"], note: "Order system down -> escalate, never guess" });
mk("C09", "49", "C", { days: 60, faults: [P("check_warranty", "SN-349")], say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective, it's a couple of months old. Help.`,
  calls: (e) => [{ tool: "escalate_to_human", match: { customerId: e.customerId } }], forbid: ["create_refund", "create_service_ticket"], note: "Warranty system down -> escalate" });
mk("C10", "50", "C", { days: 6, price: 150, faults: [P("create_refund", "ORD-250")], say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective. Refund please.`,
  calls: (e) => [{ tool: "escalate_to_human", match: { customerId: e.customerId } }], mentionNot: ["refund (has been|was) (issued|processed|created)", "RF-"], note: "Refund system down -> escalate and do not claim success" });
mk("C11", "51", "C", { days: 6, price: 75, say: (e) => `I'm ${e.customerId}. My order number is 251 and it arrived defective. Refund please.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 75 } }], note: "Validation error on bare number; agent must reformat as ORD-251" });
mk("C12", "52", "C", { days: 6, price: 110, faults: [T("get_order", "ORD-252"), T("create_refund", "ORD-252")], say: (e) => `I'm ${e.customerId}. Order ${e.orderId} is defective. Refund please.`,
  calls: (e) => [{ tool: "create_refund", match: { orderId: e.orderId, amount: 110 } }], note: "Two separate transient failures in one conversation" });

writeFileSync(join(here, "cases.json"), JSON.stringify(cases, null, 2));
writeFileSync(join(here, "..", "backend", "src", "cases.json"), JSON.stringify(cases)); // copy bundled with the backend
const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
const csv = ["id,band,utterance,note", ...cases.map((c) => [c.id, c.band, esc(c.utterance), esc(c.note)].join(","))].join("\n");
writeFileSync(join(here, "testset.csv"), csv + "\n");
console.log(`wrote ${cases.length} cases: A=${cases.filter((c) => c.band === "A").length} B=${cases.filter((c) => c.band === "B").length} C=${cases.filter((c) => c.band === "C").length}`);
