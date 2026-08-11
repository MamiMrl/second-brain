# Triage labels

Five canonical labels structure the triage workflow. Map these to your repo's actual label names (if different).

| Label | Meaning | When to use |
|---|---|---|
| `needs-triage` | Maintainer evaluation needed | New issue, unclear scope |
| `needs-info` | Waiting on reporter | Need more context to proceed |
| `ready-for-agent` | Fully specified, AFK-ready | Complete repro, clear acceptance criteria |
| `ready-for-human` | Needs human implementation | Agent can't or shouldn't handle alone |
| `wontfix` | Won't be actioned | Duplicate, out of scope, or rejected |

**Creating labels:** If these don't exist in your repo yet, create them manually in GitHub Issues settings, or `/triage` will create them on first run.
