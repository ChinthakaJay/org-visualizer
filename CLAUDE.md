# Org Visualizer

A locally run web app that turns a one-fact-per-line text file into an interactive chart of nested teams with reporting lines. See `CONTEXT.md` for the domain language and `docs/adr/` for key decisions.

## Agent skills

### Issue tracker

GitHub Issues on `ChinthakaJay/org-visualizer`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary, applied as GitHub labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
