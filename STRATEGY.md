---
name: markview
last_updated: 2026-09-20
---

# markview Strategy

## Target problem

In the agent-writing era, Markdown is easy to *produce* but hard to *present*. Existing previews are either too plain or locked inside editors; there is no focused local tool for turning Markdown into something readable, navigable, demonstrable, and exportable.

## Our approach

Go local-first: a CLI discovers and serves on-disk Markdown, and a browser provides a **read-only presentation surface** (render, navigate, slides, export). Deliberately **not** an editor — writing stays with agents and other tools.

## Who it's for

**Primary:** People doing technical sharing and repo-doc review — they're hiring markview to turn local Markdown into a finished artifact they can read, navigate, and present without opening an editor.

**Secondary:** Publishing a whole repo's Markdown as a static site / GitHub Pages–style output.

## Key metrics

- **Cold start to readable** - One CLI invocation opens a usable browser view of the docs
- **Stay out of the editor** - Tech talks and doc review happen mainly in markview, not a second preview pane
- **Demo-ready slides** - `---` slides (or export) can carry a full technical talk without PowerPoint
- **Export fidelity** - PDF/static output keeps theme contrast, diagrams, and links readable
- **Polish gap** - Functional coverage is ~80%; remaining work is usability and visual presentation quality (tracked as an explicit backlog of gaps, not vague "more features")

## Tracks

### Presentation quality

Slides, fullscreen atmosphere, typography, and deck-like media so talks feel finished.

_Why it serves the approach:_ The product wins as a presentation surface, not a writer.

### Reading / review experience

Multi-file groups, TOC, search, graph/outline, and navigation for repo docs.

_Why it serves the approach:_ Local-only viewing has to beat editor previews for day-to-day review.

### Export and static publishing

PDF export, static builds, and Pages-like publishing with theme-aware fidelity.

_Why it serves the approach:_ "展出" must survive leaving the live server.

### Diagram and extension rendering

Mermaid, PlantUML, SvgBob, math, and future Markdown-adjacent renderers — depth over a plugin marketplace for now.

_Why it serves the approach:_ Agent-written docs are diagram-heavy; display quality is the differentiator.

## Not working on

- In-app Markdown editing (writing stays with agents / external editors)
- Cloud collaborative editing as a core product bet
