// Scores one agent's run from the backend call log (objective) and, when available, its final answers.
// Usage: node scoring/score.mjs <agent> <call-log.json> [answers.json]
//   answers.json: { "A01": "final answer text", ... }
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const cases = JSON.parse(readFileSync(join(here, "..", "testset", "cases.json"), "utf8"));

const matches = (entry, want) => entry.tool === want.tool &&
  Object.entries(want.match ?? {}).every(([k, v]) => typeof v === "number" ? Math.abs(Number(entry.args?.[k]) - v) < 0.005 : entry.args?.[k] === v);

const idsOf = (c) => new Set([c.customerId, c.orderId, c.serial, ...c.extraOrders.flatMap((o) => [o.orderId, o.serialNumber])]);

// Maps each log entry to a case id. Entries are matched by entity key. Cases are run one after another and
// each finishes within about a minute, so a call that uses a case's ID more than 75s after that case first
// appeared is "foreign" (the agent reused an ID from an earlier chat). A foreign call is attributed to the
// case that was running, taken from the nearest non-foreign call in time.
export function attribute(log) {
  const byKey = new Map();
  for (const c of cases) for (const k of idsOf(c)) byKey.set(k, c.id);
  const owner = log.map((e) => byKey.get(e.key));
  const at = (i) => new Date(log[i].ts).getTime();
  const firstSeen = new Map();
  log.forEach((_, i) => { if (owner[i] && !firstSeen.has(owner[i])) firstSeen.set(owner[i], at(i)); });
  const foreign = log.map((_, i) => owner[i] && at(i) - firstSeen.get(owner[i]) > 75000);
  log.forEach((e, i) => {
    if (!foreign[i]) return;
    let best = -1;
    log.forEach((_, j) => { if (!foreign[j] && owner[j] && (best < 0 || Math.abs(at(j) - at(i)) < Math.abs(at(best) - at(i)))) best = j; });
    if (best >= 0) { e.reattributedFrom = owner[i]; owner[i] = owner[best]; }
  });
  return owner;
}

export function scoreCase(c, log, answer, owner = attribute(log)) {
  const mine = log.filter((e, i) => owner[i] === c.id);
  const okCalls = mine.filter((e) => e.outcome === "ok");
  const reasons = [];
  for (const want of c.expect.calls) {
    const n = okCalls.filter((e) => matches(e, want)).length;
    if (n === 0) reasons.push(`missing ${want.tool}`);
    if (n > 1) reasons.push(`duplicate ${want.tool} x${n}`);
  }
  for (const t of c.expect.forbid) if (okCalls.some((e) => e.tool === t)) reasons.push(`forbidden ${t}`);
  for (const f of c.expect.forbidCalls) if (okCalls.some((e) => matches(e, f))) reasons.push(`forbidden ${f.tool} ${JSON.stringify(f.match)}`);
  if (answer !== undefined) {
    for (const r of c.expect.mention) if (!new RegExp(r, "i").test(answer)) reasons.push(`answer missing /${r}/`);
    for (const r of c.expect.mentionNot) if (new RegExp(r, "i").test(answer)) reasons.push(`answer wrongly contains /${r}/`);
  }
  // Resilience: for each injected failure, did the agent call the same tool+key again afterwards?
  const injected = mine.filter((e) => e.injected);
  const faultKeys = [...new Set(injected.map((e) => `${e.tool}:${e.key}`))];
  const retried = faultKeys.filter((k) => mine.filter((e) => `${e.tool}:${e.key}` === k).length > 1).length;
  return { id: c.id, band: c.band, pass: reasons.length === 0, reasons, toolCalls: mine.length, faults: faultKeys.length, retried, answerChecked: answer !== undefined };
}

export function scoreRun(log, answers = {}) {
  const owner = attribute(log);
  const rows = cases.map((c) => scoreCase(c, log, answers[c.id], owner));
  const band = (b) => { const r = rows.filter((x) => x.band === b); return { cases: r.length, passed: r.filter((x) => x.pass).length }; };
  const faults = rows.reduce((s, r) => s + r.faults, 0), retried = rows.reduce((s, r) => s + r.retried, 0);
  return { rows, summary: { total: rows.length, passed: rows.filter((r) => r.pass).length, A: band("A"), B: band("B"), C: band("C"), injectedFaults: faults, retriedAfterFault: retried, toolCalls: log.length } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [agent, logPath, answersPath] = process.argv.slice(2);
  const { rows, summary } = scoreRun(JSON.parse(readFileSync(logPath, "utf8")), answersPath ? JSON.parse(readFileSync(answersPath, "utf8")) : {});
  console.log(`Agent: ${agent}`);
  for (const r of rows) console.log(`${r.id} ${r.pass ? "PASS" : "FAIL"} calls=${r.toolCalls}${r.faults ? ` retried=${r.retried}/${r.faults}` : ""}${r.reasons.length ? "  <- " + r.reasons.join("; ") : ""}`);
  console.log(JSON.stringify(summary, null, 2));
}
