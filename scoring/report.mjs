// Builds results/scorecard.md from the saved call logs, answers and credit readings of every run.
// Run: node scoring/report.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cases, scoreRun } from "./score.mjs";

const path = (p) => new URL(`../results/${p}`, import.meta.url);
const load = (p) => JSON.parse(readFileSync(path(p), "utf8"));
const RUNS = ["run1", "run2"].filter((r) => existsSync(path(`${r}/calls-standard.json`)));
const AGENTS = [["standard", "Standard"], ["harness", "Copilot harness"]];

const data = {};
for (const r of RUNS) {
  data[r] = { credits: load(`${r}/credits-harness.json`).history };
  for (const [a] of AGENTS) data[r][a] = scoreRun(load(`${r}/calls-${a}.json`), load(`${r}/answers-${a}.json`));
}

const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const r1 = (x) => x.toFixed(1), r2 = (x) => x.toFixed(2);
const ids = (b) => cases.filter((c) => !b || c.band === b).map((c) => c.id);
const BANDS = [["A", "A: simple lookups"], ["B", "B: multi-step policy"], ["C", "C: injected tool failures"]];
const row = (r, a, id) => data[r][a].rows.find((x) => x.id === id);
const calls = (r, a, b) => sum(data[r][a].rows.filter((x) => !b || x.band === b).map((x) => x.toolCalls));
const hist = (r, b) => ids(b).map((id) => data[r].credits[id]);
// Standard harness credits are not shown per chat. Estimate from Microsoft's published rates:
// agent action = 5 credits, generative answer = 2. Low = tool calls only; high = tool calls + one answer per case.
const stdLow = (r, b) => 5 * calls(r, "standard", b), stdHigh = (r, b) => stdLow(r, b) + 2 * ids(b).length;

const cols = RUNS.flatMap((r) => AGENTS.map(([a, name]) => ({ r, a, head: `${name}, ${r.replace("run", "run ")}` })));
const L = [];
L.push("# Scorecard", "");
L.push(`Runs on 2026-11-10 in a Developer environment. Both agents: same instructions, same six MCP tools, model Claude Sonnet 4.6, 36 single-turn cases, one fresh chat per case. ${RUNS.length} runs per agent; the backend's failure counters were reset between runs.`, "");

L.push("## Quality", "", `| | ${cols.map((c) => c.head).join(" | ")} |`, `|---|${cols.map(() => "---").join("|")}|`);
const S = (c) => data[c.r][c.a].summary;
L.push(`| Cases passed | ${cols.map((c) => `${S(c).passed} / ${S(c).total}`).join(" | ")} |`);
for (const [b, name] of BANDS) L.push(`| ${name} | ${cols.map((c) => `${S(c)[b].passed} / ${S(c)[b].cases}`).join(" | ")} |`);
L.push(`| Injected failures followed by a retry | ${cols.map((c) => `${S(c).retriedAfterFault} / ${S(c).injectedFaults}`).join(" | ")} |`);
L.push(`| Tool calls made | ${cols.map((c) => S(c).toolCalls).join(" | ")} |`, "");
L.push("Across runs: " + AGENTS.map(([a, name]) => `${name} ${sum(RUNS.map((r) => data[r][a].summary.passed))} / ${36 * RUNS.length}`).join(", ") + ".", "");

L.push("## Cases that failed at least once", "", `| Case | ${cols.map((c) => c.head).join(" | ")} |`, `|---|${cols.map(() => "---").join("|")}|`);
for (const c of cases) {
  const cells = cols.map((k) => row(k.r, k.a, c.id));
  if (cells.every((x) => x.pass)) continue;
  L.push(`| ${c.id} "${c.utterance}" | ${cells.map((x) => (x.pass ? "pass" : x.reasons.join("; "))).join(" | ")} |`);
}

L.push("", "## Copilot Credits", "");
L.push("Copilot harness figures are measured: the per-conversation figure on the agent's History page. Standard harness figures are an estimate from Microsoft's published rates (5 credits per agent action, 2 per generative answer), because Copilot Studio does not show credits per test chat for Standard agents and the admin centre had not posted the day's usage.", "");
const ccols = RUNS.flatMap((r) => [{ r, kind: "std", head: `Standard, ${r.replace("run", "run ")} (estimate)` }, { r, kind: "har", head: `Copilot harness, ${r.replace("run", "run ")} (measured)` }]);
const cell = (c, b, per) => {
  const n = per === "pass" ? (c.kind === "std" ? data[c.r].standard.summary.passed : data[c.r].harness.summary.passed) : per ? ids(b).length : 1;
  return c.kind === "std" ? (per ? `${r1(stdLow(c.r, b) / n)} to ${r1(stdHigh(c.r, b) / n)}` : `${stdLow(c.r, b)} to ${stdHigh(c.r, b)}`) : r1(sum(hist(c.r, b)) / n);
};
L.push(`| | ${ccols.map((c) => c.head).join(" | ")} |`, `|---|${ccols.map(() => "---").join("|")}|`);
L.push(`| Total, 36 cases | ${ccols.map((c) => cell(c)).join(" | ")} |`);
L.push(`| Average per case | ${ccols.map((c) => cell(c, undefined, true)).join(" | ")} |`);
for (const [b, name] of BANDS) L.push(`| Average, ${name} | ${ccols.map((c) => cell(c, b, true)).join(" | ")} |`);
L.push(`| Per passed case | ${ccols.map((c) => cell(c, undefined, "pass")).join(" | ")} |`);
L.push(`| Cheapest / dearest case | ${ccols.map((c) => (c.kind === "std" ? `${5 * Math.min(...data[c.r].standard.rows.map((x) => x.toolCalls))} / ${5 * Math.max(...data[c.r].standard.rows.map((x) => x.toolCalls)) + 2}` : `${r2(Math.min(...hist(c.r)))} / ${r2(Math.max(...hist(c.r)))}`)).join(" | ")} |`, "");

for (const r of RUNS) {
  const c = load(`${r}/credits-harness.json`);
  const paired = ids().filter((id) => c.live?.[id] != null && !(c.pendingTopUp ?? []).includes(id));
  const delta = paired.map((id) => c.history[id] - c.live[id]);
  L.push(`Delayed charge, Copilot harness ${r.replace("run", "run ")}: for ${paired.length} conversations with both readings, the History figure was ${r2(Math.min(...delta))} to ${r2(Math.max(...delta))} credits (mean ${r2(sum(delta) / delta.length)}) above the live counter shown in the Preview chat.${(c.pendingTopUp ?? []).length ? ` Not yet topped up when last read: ${c.pendingTopUp.join(", ")}, so this run's total is slightly low.` : ""}`, "");
}

L.push("## Per case", "", `| Case | ${cols.map((c) => `${c.head} (tool calls)`).join(" | ")} | ${RUNS.map((r) => `Harness credits, ${r.replace("run", "run ")}`).join(" | ")} |`, `|---|${cols.map(() => "---").join("|")}|${RUNS.map(() => "---").join("|")}|`);
for (const c of cases) L.push(`| ${c.id} | ${cols.map((k) => { const x = row(k.r, k.a, c.id); return `${x.pass ? "pass" : "FAIL"} (${x.toolCalls})`; }).join(" | ")} | ${RUNS.map((r) => r2(data[r].credits[c.id])).join(" | ")} |`);

writeFileSync(path("scorecard.md"), L.join("\n") + "\n");
console.log(L.slice(0, 12 + 8 + 20).join("\n"));
