# LinkedIn post — draft

> Every number comes from `results/scorecard.md` (two runs per agent). The Standard harness credit figure is an estimate from Microsoft's list rates, not a measurement.

---

**I built the same agent on both Copilot Studio harnesses and ran it twice. The scores tied. The bill did not.**

Copilot Studio now gives you a choice when you create an agent: the Standard harness, or the new Microsoft Copilot harness (called the GitHub Copilot harness until two weeks ago). The choice is permanent, so I wanted numbers before making it.

**The setup**

- One customer service agent, built twice. Same instructions, same six tools, same model (Claude Sonnet 4.6).
- 36 test cases: 10 simple lookups, 14 multi-step refund and warranty decisions, 12 where I made a tool fail on purpose.
- Two full runs per agent, 144 conversations in total.
- Scored from the backend's own call log, so "pass" means the right refund, ticket or escalation actually happened, exactly once.

**What I found**

1. **Quality: a tie.** Standard passed 65 of 72. The Copilot harness passed 66 of 72. Every multi-step case passed on both, every time.
2. **Resilience: identical.** Both agents retried after every injected failure, 24 out of 24 each. Microsoft's published data shows a large gap here; with the model held constant and a clear "retry, then escalate" instruction, I did not see one.
3. **Cost: a different shape.** The Copilot harness averaged 10.3 Copilot Credits per case (measured). The Standard harness works out to roughly 15 to 17 at list rates (estimated). Standard charges per tool call, so it gets expensive as tasks get longer. The Copilot harness stayed between 5 and 14 credits whatever the task, but even a question that needed no tool cost 4.7.
4. **The live credit counter understates.** Every Copilot harness chat showed about 4.2 more credits on the History page a few minutes later.
5. **Credits gate the new harness before the first message.** With zero credits, the Copilot harness agent refused to answer in Preview. The Standard agent in the same environment worked.
6. **Every failure was about identity, not the harness.** When a customer did not state a customer ID, both agents compared the order's owner with me, the signed-in maker. Standard filed a wrongful security escalation all seven times. The Copilot harness did so three times and asked for the customer ID the other three.

**What I would do with this**

- Short, lookup-style agents: Standard is at least as cheap and needs no credits to prototype.
- Agents that chain several tool calls per request: price the Copilot harness; it may well be cheaper.
- Tell your agent explicitly who the customer is and what to do when it does not know. That was the only thing that broke here.
- Test with your own cases. The harness did not rescue or sink this agent; the instructions and the model did the work.

**Limits:** one scenario, one model, two runs per agent, one tenant, on 10 November 2026. Treat it as a case study, not a benchmark.

Test set, mock backend and scoring code: https://github.com/bonaniibm/copilot-studio-harness-bakeoff

#CopilotStudio #AIAgents #PowerPlatform #Microsoft365Copilot
