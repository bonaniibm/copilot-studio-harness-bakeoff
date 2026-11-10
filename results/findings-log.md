# Findings log

Observations made while building, kept as raw material for the post. Dated 2026-11-10, in a Developer environment in a sandbox tenant.

## Setup facts

- Copilot harness agent: `Contoso Service - Copilot harn`. Tool: MCP server at `/api/mcp/harness`.
- Standard agent: `Contoso Service - Standard harness`. Tool: MCP server at `/api/mcp/standard`.
- Both have the same instructions and no knowledge sources.

## Observations

1. **Credits gate the Copilot harness before the first message.** The harness agent's Preview returned "This environment is out of credits" (error `EnforcementUsageCredits`) on a Developer environment with 0 Copilot Credits and no billing plan. The Standard agent in the same environment answered and called tools with no credits.
2. **Defaults differ.** A new Copilot harness agent came with Work IQ as a tool and "Search all websites" as knowledge, both removed here for parity. A new Standard agent came with neither.
3. **Model menus differ.** Copilot harness default: Claude Opus 5.5; menu leads with GPT 6 Astra, GPT 6.1 Sol/Terra, GPT 6 Luna, Claude Sonnet 5.5, Claude Haiku 5.5. Standard default: GPT Chat Latest (Nov 2026); menu has GPT-5 Chat/Auto/Reasoning, GPT-4.1, Claude Sonnet 4.6, Claude Opus 4.6/4.7/4.8. Models seen on both: Claude Sonnet 4.6, Claude Opus 4.8, GPT-5 Chat (under "More models" on the harness).
4. **Three harnesses, not two.** "Other ways to build" also offers a Customer Assist Agent on a "Customer conversation" harness.
5. **MCP tool setup** took the same server URL on both; each harness created its own connection.

## Smoke test

- Standard agent, model GPT Chat Latest (Nov 2026), case B01: called `get_customer`, `get_order`, `create_refund` (129) and passed. Server log saved in `smoke-standard-B01.json`; log then reset.
- Copilot harness agent: not run (no credits).

## Full run (2026-11-10, both agents on Claude Sonnet 4.6)

Numbers are in `scorecard.md`; raw data in `calls-*.json`, `answers-*.json`, `credits-harness.json`.

6. **Same score.** Both agents passed 33 of 36, with identical results per band (A 8/10, B 14/14, C 11/12).
7. **Both retried every injected failure (12 of 12).** Microsoft's published gap (84-91% vs under 7%) did not show up here. Caveats: the instructions tell the agent to retry, the model was the same on both sides, and this is one run.
8. **Same three failures, same cause.** When the customer gave no customer ID (A04, A08, C03), the agent compared the order's owner with the signed-in maker and filed a "security" escalation. Standard did this on all three; the Copilot harness did it on A04 and A08 and asked for the customer ID on C03. A05 and A07 are worded the same way and were answered normally by both, so the behaviour is inconsistent.
9. **ID carried between chats on the Copilot harness.** In A04 and C03 (separate new chats) the harness agent called tools with `C-101`, the customer ID from the first chat (A01). Memory was switched off. Cause not investigated.
10. **Both harnesses pass the signed-in user's name and email to the model.** They appeared in escalation summaries that both agents sent to the backend (redacted in the saved logs).
11. **Credits, Copilot harness (measured):** 367.8 for 36 cases, 10.2 per case; range 4.71 (a policy question with no tool call) to 14.18.
12. **Credits, Standard (estimated, not measured):** 550 to 622 at list rates (5 per agent action, 2 per generative answer), 15.3 to 17.3 per case. Copilot Studio shows no per-chat credits for Standard, and the admin centre had not posted the day's usage. Re-check Licensing > Copilot Studio for the measured figure.
13. **Delayed charge on the Copilot harness.** The live counter in Preview understated every conversation: the History page later showed 4.16 to 4.43 more credits per conversation. For a one-tool lookup that is about two thirds of the cost. What the extra charge is for was not determined.

## Second run (2026-11-10, afternoon; same agents, same model, backend failure counters reset)

Run 1 files are in `run1/`, run 2 in `run2/`; `scorecard.md` now covers both. Where this section and the "Full run" section above disagree on a number, this one is current.

14. **The tie held, within one case.** Standard passed 33 then 32 of 36; the Copilot harness passed 33 then 33. Across both runs: Standard 65 of 72, Copilot harness 66 of 72. Bands B and C were identical in every run (14/14 and 11/12).
15. **Retries: 12 of 12 again on both.** That is 24 of 24 for each harness over two runs.
16. **All seven Standard failures and all six Copilot harness failures are the identity problem.** Cases A04, A08 and C03 (no customer ID given) failed on both harnesses in both runs. In run 2 the Standard agent also escalated A03, where the customer did give an ID, because the signed-in maker's name and email "do not match the details on file".
17. **The two harnesses fail those cases differently.** Standard filed a wrongful security escalation every time (7 of 7). The Copilot harness did so in 3 of its 6 failures (A04 twice, A08 once) and in the other 3 asked the customer for their ID without answering.
18. **The carried-over customer ID is repeatable.** In run 2 the Copilot harness again called `get_customer` with `C-101` (the first chat's customer) inside the C03 chat.
19. **Credits, Copilot harness (measured):** run 1 total 371.9, run 2 total 369.7; 10.3 per case in both runs.
20. **Credits, Standard (still an estimate):** 550 to 622 in run 1 and 555 to 627 in run 2 at list rates. The admin centre showed no usage for either new agent when checked at about 14:10.
21. **The delayed charge is consistent:** mean 4.18 credits per conversation in run 1 and 4.17 in run 2 (71 conversations with both readings), posted about six minutes after the chat.
22. **Run-2 mechanics.** Three Standard replies (B13, C07, C11) had not rendered when the next chat was started; the backend log shows each had already completed its actions. In C11 the Standard agent went straight to `ORD-251` in run 2, so the validation-error path was not exercised that time.
