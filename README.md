@just-every/task

Task adds meta-cognition, adaptive model rotation and cost tracking to your @just-every/ensemble agents in a single call.

⸻

🚀 Quick install

npm install @just-every/task

⸻

🔑 One-minute setup

Set your LLM keys (any you have will do):

export OPENAI_API_KEY="…"
export ANTHROPIC_API_KEY="…"
export GOOGLE_API_KEY="…"


⸻

⚡ Hello Task

import { mindTask } from "@just-every/task";
import { Agent } from "@just-every/ensemble";

const agent = new Agent({ modelClass: "reasoning" });

const stream = mindTask(agent,
  "Review this function: function add(a, b) { return a + b; }"
);

Task picks the best model, runs until the task is done, and logs every decision.

⸻

🎯 Why Task?
	•	Auto model rotation – performance-based, cost-aware.
	•	Meta-cognition – agents reflect & self-correct.
	•	Tool wiring – any Ensemble tool, zero boilerplate.
	•	Cost tracker – live totals across providers.
	•	Tiny API – one function, sensible defaults.

⸻

🧠 Model classes

Class	Typical use-cases
reasoning	Logic, multi-step problems
code	Code review & generation
standard	Writing, Q&A, summaries

Set modelClass and let Mind handle the rest.

⸻

📚 Docs & examples
	•	Examples – ./examples/*
	•	API Reference – /docs/api.md

⸻

📄 License

MIT – hack away.