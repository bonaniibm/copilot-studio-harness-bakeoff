# Scorecard

Runs on 2026-11-10 in a Developer environment. Both agents: same instructions, same six MCP tools, model Claude Sonnet 4.6, 36 single-turn cases, one fresh chat per case. 2 runs per agent; the backend's failure counters were reset between runs.

## Quality

| | Standard, run 1 | Copilot harness, run 1 | Standard, run 2 | Copilot harness, run 2 |
|---|---|---|---|---|
| Cases passed | 33 / 36 | 33 / 36 | 32 / 36 | 33 / 36 |
| A: simple lookups | 8 / 10 | 8 / 10 | 7 / 10 | 8 / 10 |
| B: multi-step policy | 14 / 14 | 14 / 14 | 14 / 14 | 14 / 14 |
| C: injected tool failures | 11 / 12 | 11 / 12 | 11 / 12 | 11 / 12 |
| Injected failures followed by a retry | 12 / 12 | 12 / 12 | 12 / 12 | 12 / 12 |
| Tool calls made | 110 | 109 | 111 | 107 |

Across runs: Standard 65 / 72, Copilot harness 66 / 72.

## Cases that failed at least once

| Case | Standard, run 1 | Copilot harness, run 1 | Standard, run 2 | Copilot harness, run 2 |
|---|---|---|---|---|
| A03 "I'm customer C-103. Which loyalty tier am I on?" | pass | pass | forbidden escalate_to_human; answer missing /Gold/ | pass |
| A04 "How much did I pay for order ORD-204?" | forbidden escalate_to_human; answer missing /349.5/ | forbidden escalate_to_human; answer missing /349.5/ | forbidden escalate_to_human; answer missing /349.5/ | forbidden escalate_to_human; answer missing /349.5/ |
| A08 "Has order ORD-208 arrived yet?" | forbidden escalate_to_human; answer missing /transit/ | forbidden escalate_to_human; answer missing /transit/ | forbidden escalate_to_human; answer missing /transit/ | answer missing /transit/ |
| C03 "Where is my order ORD-243?" | forbidden escalate_to_human; answer missing /transit/ | answer missing /transit/ | forbidden escalate_to_human; answer missing /transit/ | answer missing /transit/ |

## Copilot Credits

Copilot harness figures are measured: the per-conversation figure on the agent's History page. Standard harness figures are an estimate from Microsoft's published rates (5 credits per agent action, 2 per generative answer), because Copilot Studio does not show credits per test chat for Standard agents and the admin centre had not posted the day's usage.

| | Standard, run 1 (estimate) | Copilot harness, run 1 (measured) | Standard, run 2 (estimate) | Copilot harness, run 2 (measured) |
|---|---|---|---|---|
| Total, 36 cases | 550 to 622 | 371.9 | 555 to 627 | 369.7 |
| Average per case | 15.3 to 17.3 | 10.3 | 15.4 to 17.4 | 10.3 |
| Average, A: simple lookups | 7.0 to 9.0 | 7.5 | 7.5 to 9.5 | 7.3 |
| Average, B: multi-step policy | 16.4 to 18.4 | 10.8 | 16.4 to 18.4 | 10.8 |
| Average, C: injected tool failures | 20.8 to 22.8 | 12.1 | 20.8 to 22.8 | 12.2 |
| Per passed case | 16.7 to 18.8 | 11.3 | 17.3 to 19.6 | 11.2 |
| Cheapest / dearest case | 0 / 27 | 4.71 / 14.18 | 0 / 27 | 4.70 / 13.97 |

Delayed charge, Copilot harness run 1: for 35 conversations with both readings, the History figure was 4.16 to 4.43 credits (mean 4.18) above the live counter shown in the Preview chat.

Delayed charge, Copilot harness run 2: for 36 conversations with both readings, the History figure was 4.16 to 4.34 credits (mean 4.17) above the live counter shown in the Preview chat.

## Per case

| Case | Standard, run 1 (tool calls) | Copilot harness, run 1 (tool calls) | Standard, run 2 (tool calls) | Copilot harness, run 2 (tool calls) | Harness credits, run 1 | Harness credits, run 2 |
|---|---|---|---|---|---|---|
| A01 | pass (2) | pass (2) | pass (2) | pass (2) | 10.88 | 10.88 |
| A02 | pass (1) | pass (1) | pass (1) | pass (1) | 6.45 | 6.48 |
| A03 | pass (1) | pass (1) | FAIL (2) | pass (1) | 6.38 | 6.41 |
| A04 | FAIL (3) | FAIL (3) | FAIL (3) | FAIL (3) | 10.12 | 10.80 |
| A05 | pass (1) | pass (1) | pass (1) | pass (1) | 6.50 | 6.59 |
| A06 | pass (1) | pass (1) | pass (1) | pass (1) | 6.45 | 6.44 |
| A07 | pass (1) | pass (1) | pass (1) | pass (1) | 6.51 | 6.52 |
| A08 | FAIL (3) | FAIL (3) | FAIL (3) | FAIL (1) | 10.66 | 7.27 |
| A09 | pass (1) | pass (1) | pass (1) | pass (1) | 6.46 | 6.47 |
| A10 | pass (0) | pass (0) | pass (0) | pass (0) | 4.71 | 4.70 |
| B01 | pass (3) | pass (3) | pass (3) | pass (3) | 10.40 | 10.08 |
| B02 | pass (3) | pass (3) | pass (3) | pass (3) | 10.22 | 10.14 |
| B03 | pass (4) | pass (4) | pass (4) | pass (4) | 11.90 | 11.99 |
| B04 | pass (3) | pass (3) | pass (3) | pass (3) | 10.11 | 10.05 |
| B05 | pass (3) | pass (3) | pass (3) | pass (3) | 10.84 | 10.45 |
| B06 | pass (3) | pass (3) | pass (3) | pass (3) | 10.16 | 10.18 |
| B07 | pass (2) | pass (2) | pass (2) | pass (2) | 8.29 | 8.29 |
| B08 | pass (3) | pass (3) | pass (3) | pass (3) | 10.33 | 10.32 |
| B09 | pass (3) | pass (3) | pass (3) | pass (3) | 10.17 | 10.11 |
| B10 | pass (4) | pass (4) | pass (4) | pass (4) | 12.20 | 12.24 |
| B11 | pass (5) | pass (5) | pass (5) | pass (5) | 13.71 | 13.70 |
| B12 | pass (3) | pass (3) | pass (3) | pass (3) | 10.33 | 10.66 |
| B13 | pass (3) | pass (3) | pass (3) | pass (3) | 10.38 | 10.31 |
| B14 | pass (4) | pass (4) | pass (4) | pass (4) | 12.17 | 12.17 |
| C01 | pass (4) | pass (4) | pass (4) | pass (4) | 11.84 | 11.93 |
| C02 | pass (5) | pass (5) | pass (5) | pass (5) | 13.81 | 13.87 |
| C03 | FAIL (4) | FAIL (3) | FAIL (4) | FAIL (3) | 10.25 | 10.35 |
| C04 | pass (4) | pass (4) | pass (4) | pass (4) | 12.18 | 12.51 |
| C05 | pass (2) | pass (2) | pass (2) | pass (2) | 8.17 | 8.18 |
| C06 | pass (5) | pass (5) | pass (5) | pass (5) | 13.75 | 13.82 |
| C07 | pass (4) | pass (4) | pass (4) | pass (4) | 11.89 | 11.83 |
| C08 | pass (4) | pass (4) | pass (4) | pass (4) | 11.66 | 12.27 |
| C09 | pass (5) | pass (5) | pass (5) | pass (5) | 13.73 | 13.97 |
| C10 | pass (5) | pass (5) | pass (5) | pass (5) | 14.18 | 13.92 |
| C11 | pass (3) | pass (3) | pass (3) | pass (3) | 10.33 | 10.04 |
| C12 | pass (5) | pass (5) | pass (5) | pass (5) | 13.79 | 13.80 |
