# AI usage

This folder records how Claude Code (Anthropic's AI coding assistant) was used to build this project, so a reviewer
can see what was AI-generated, how it was checked, and what a human decided.

| File | Contents |
| ---- | -------- |
| [ai-usage-log.md](ai-usage-log.md) | Dated entries: the request, what Claude produced, how it was verified, problems found |
| [transcript.md](transcript.md) | The full Claude Code session: every message, and each tool call with its result (long results shortened) |
| [transcript-subagent-strategy-survey.md](transcript-subagent-strategy-survey.md) | The research subagent's session that surveyed the trading-strategies studies |

The transcripts are generated from the session logs by `tools/export-transcript.mjs`. That script leaves out content the
app injects behind the scenes and Claude's private reasoning, and redacts email addresses. The export was taken just
before the final commit and push, so it ends there.

## How to keep it useful

- Add an entry per working session or meaningful task, newest at the bottom.
- Record what was verified by running it, separately from what was only read or assumed.
- Record places where the output was wrong, changed or rejected. That is the most useful information here.
- The **Author review** lines in the log are for the project author to fill in. Claude cannot know what you
  reviewed or changed by hand, so they are left blank on purpose.
