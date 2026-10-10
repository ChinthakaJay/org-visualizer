# Text → org chart tools: research

_Researched 2026-10-10. Sources are primary (official docs, GitHub repos, source code, npm registry metadata), cited inline. Items I could not confirm at the source are marked **(unverified)**. Lines marked "my assessment" are judgement, not sourced fact. Lines marked **(tested)** were checked by running the tool locally in a scratch directory (mermaid 12.1.0 via `@mermaid-js/mermaid-cli` with system Chrome; Graphviz via `@viz-js/viz` 3.31.0). Those test files are not part of the repo._

## The model being drawn

The chart holds **two independent trees** that can disagree:

1. **The reporting tree:** person → manager. It is sparse, with unknown managers.
2. **The team tree:** team → parent team. For example, X contains Y and Z.

Each person belongs to one team. The diagram should show **nested team boxes** (X ⊃ Y, Z), with people inside and **reporting edges that may cross box boundaries**, for example a person in Y reporting to someone placed directly in X.

**Editing goal:** each of these changes should be a one-line edit:
- a person's manager
- a person's team
- a team's parent team

---

## TL;DR recommendation

Nested teams change the picture. A plain tree layout (d3-hierarchy, Mr. Tree, dagre without compounds) cannot draw nested boxes with cross-boundary edges. **What you need is a layered layout of a compound graph: ELK Layered with `hierarchyHandling: INCLUDE_CHILDREN`, or dagre's compound mode.** Mermaid already ships the ELK option.

**1. Use today: still Mermaid `flowchart`, with a "one-line subgraph" style (tested on mermaid 12.1.0).**

Mermaid's flowchart parser **merges repeated `subgraph <id>` blocks** and **nests a subgraph inside any block that mentions its id**. That lets every fact sit on one line:

```
subgraph fintech; subgraph payments [Payments]; end; end   %% team payments, parent = fintech
subgraph payments; alice["Alice Smith"]; end               %% person alice, team = payments
bob --> alice                                              %% reporting line
```

- Changing a manager, a team, or a team's parent is a **one-token edit on one line**.
- Both ELK (the v12 default) and dagre rendered nested boxes with cross-boundary edges correctly in my test.
- The merging behaviour is code plus release notes, not the syntax docs. ELK merging was broken in 12.0.0 and fixed in 12.1.0 ([#8326](https://github.com/mermaid-js/mermaid/issues/8326), [12.1.0 notes](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.1.0)). Pin ≥ 12.1.0, or set `layout: dagre` for older hosts.

**2. Custom build: ELK becomes the required layout engine.** The format is:

```
team payments : Payments | parent=fintech
alice : Alice Smith | team=payments | reports=bob
```

There are two ways to render it:
- **(a) Shortest:** the parser *emits Mermaid text* in the style above and calls `mermaid.render`. Nested boxes and ELK come for free, in about 150 lines of code (my estimate).
- **(b) More control:** feed `elkjs` directly (`elk.layered`, `hierarchyHandling: INCLUDE_CHILDREN`) and draw your own SVG cards.

d3-hierarchy alone **cannot** do this. It lays out one hierarchy and has no compound-graph or box layout. It is still useful for validating the trees (cycle and missing-parent detection), not for layout.

**3. draw.io CSV falls further behind.**
- `# parent:` can express nested containers, since any earlier row can be a parent.
- From the source: re-importing with `# identity` **does not re-parent existing shapes**, and does not add connectors for updated rows. Team moves and manager changes therefore need a clean re-import.
- It is still not live.

**Dropped or poor for nested teams:**
- **Graphviz:** cluster names are scoped to their parent, so every person line must spell out the whole team path (tested).
- **D2:** the container path is the node key, so a team move rewrites every member and every edge.
- **Mermaid architecture-beta:** has a perfect `in parent` one-line syntax, but its fcose force layout does not draw a top-down hierarchy (tested).
- **PlantUML:** braces-only nesting.

---

## Comparison table: existing tools

Legend: **Field** = edit one value or line in place. **Line-move** = move a line into another block. **Indent** = move or re-indent a block. **Path** = the full team path is part of the identifier, so moving a team rewrites every member and edge.

| Tool | Input format | Reporting-line change | **Nested teams (boxes in boxes)** | **Team / parent-team change** | Partial forest / unknown manager | Wide-tree layout | Live preview | Data location / privacy | Cost / license, maintenance |
|---|---|---|---|---|---|---|---|---|---|
| **Mermaid flowchart** | nodes + `a --> b` + `subgraph` | **Field** (one edge line) | **Yes**: subgraphs nest; cross-boundary edges laid out by ELK (`INCLUDE_CHILDREN`) or dagre (tested) | **Field** with one-line repeated subgraphs (tested, ≥ 12.1.0); otherwise line-move | Yes; edges independent | Layered; wide rows, no leaf stacking (my assessment) | Yes (mermaid.live, VS Code, Obsidian) | mermaid.live client-side; URL + localStorage; exports via third parties | MIT; 12.1.0 (2026-10-02), active |
| **Mermaid architecture-beta** | `group g[..] in parent`, `service s[..] in g`, `a:B --> T:b` | Field (but each edge needs port sides) | Yes, nested groups | **Field** (`in parent`) | Yes | **Force layout (fcose), not hierarchical** (tested) | Yes | Same as above | MIT |
| **Mermaid treeView / mindmap** | Indentation | Indent | No boxes | — | Single tree | — | Yes | Same | MIT |
| **PlantUML** (WBS / MindMap; component/deployment for boxes) | Depth markers; braces for containers | Indent (WBS) / field (arrows in deployment) | Containers via nested `{ }` only | **Indent / line-move**; no "place in container" statement | WBS: one root | WBS tidy; deployment layered via Graphviz | Plugins/server | Public server doesn't store; local jar recommended | LGPL-3.0 etc.; v1.2026.8 |
| **Graphviz DOT** | `a -> b;`, `subgraph cluster_x {}` | **Field** | Yes, nested clusters | **Path**: re-opening a cluster by name only merges at the same parent level, so a person line must repeat the full cluster path (tested) | Yes | `dot` layered; wide | Via online editors / VS Code | Local CLI / in-browser WASM | 16.1.0 listed; EPL (**unverified**) |
| **D2** | `a -> b`, containers `x.y.alice` | Field, but edges use full paths | Yes, nested containers | **Path** (key = container path) | Yes | dagre / ELK / TALA (paid) | `d2 --watch` | Local CLI | MPL-2.0; v0.9.0 |
| **Markmap** | Markdown lists | Indent | No | — | One root | Mindmap | Yes | Local | MIT |
| **Kroki** | Front-end for others | — | Per language | — | — | — | No editor | Self-host for privacy | MIT; v0.33.0 |
| **draw.io CSV** | CSV + `#` directives | **Field** (`manager` column) | **Yes**: `# parent:` nests a row in any earlier row's shape, so containers can nest (source) | **Field**, but re-import with `# identity` doesn't re-parent existing shapes (source); clean re-import needed | `auto` → organic layout for several roots (source); set the layout explicitly | ELK tree/layered, `orgchart`; layout inside nested containers **unverified** | **No** (re-import) | Client-side; PDF export via server; Desktop offline | Apache-2.0 / GPL-3.0; v32.4.1 |
| **Lucidchart** | CSV / Excel / Sheets | Field + refresh | No nested team boxes found (**unverified**); can split into several charts by a column | — | Stubs required (every supervisor listed) | Org-chart layout | No | Cloud | Proprietary |
| **Google Sheets / Charts OrgChart** | child, parent, tooltip | Field | No | — | Blank parent = root | Wide | Sheets: yes | Charts: no server, but online-only loader; Sheets = cloud | Free, proprietary |
| **Excalidraw / Whimsical** | Mermaid (one-shot) | One-shot | Excalidraw converts flowcharts natively; nested subgraph fidelity **unverified**. Whimsical: subgraphs → groups | One-shot | — | — | No | SaaS | MIT lib / proprietary |
| **yEd** | Excel node + edge list / GraphML | Field (edge row) | Groups exist in yEd; import via spreadsheet **unverified** | — | Yes | Hierarchical etc. | No | Desktop | Free, proprietary; v3.25.1 |
| **Structurizr** | C4 DSL | — | — | — | — | — | — | — | Poor fit |

---

## Per-tool notes

### Mermaid flowchart (best existing fit, now with caveats)

**Basics**
- **Version:** mermaid **12.1.0** (2026-10-02). MIT, very active ([releases](https://github.com/mermaid-js/mermaid/releases)).
- **No org-chart type:** open requests are [#1360](https://github.com/mermaid-js/mermaid/issues/1360), [#7458](https://github.com/mermaid-js/mermaid/issues/7458) and [#3989](https://github.com/mermaid-js/mermaid/issues/3989). TreeView (`treeView-beta`, v11.14.0) is indentation-only and file-tree styled ([docs](https://mermaid.js.org/syntax/treeView.html)).
- **Default layout:** v12 made **ELK the default layout**, and `layout: dagre` restores the old one ([12.0.0 notes](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.0.0), [flowchart docs](https://mermaid.js.org/syntax/flowchart.html)).

**Nested subgraphs (documented)**
- Subgraphs are `subgraph id [title] … end` blocks. The docs show subgraphs nested inside subgraphs (`TOP` containing `B1`, `B2`) and edges to and from subgraphs ([flowchart docs § Subgraphs](https://mermaid.js.org/syntax/flowchart.html#subgraphs)).
- Documented limitation: if a subgraph's nodes link outside it, its own `direction` is ignored and it inherits the parent's direction. That doesn't matter here, since an org chart uses one direction.
- v11.17.0+ can collapse a subgraph with `id@{ view: collapsed }`, and crossing edges are redirected to the collapsed node. This is useful for hiding a big team.

**One line per fact (code-level, tested)**
The [flowDb source](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagrams/flowchart/flowDb.ts) works like this:
- **Merge:** "A repeated id merges its members into the first declaration, which keeps its title, direction and position."
- **First block wins:** members already in another subgraph are removed from the new one.
- **Nesting by mention:** a subgraph is nested in any subgraph whose member list contains its id (the `subGraphParent` map).

I ran the 12.1.0 parser and renderer and confirmed:
- `subgraph fintech; subgraph payments [Payments]; end; end` on one line makes `payments` a child of `fintech`.
- `subgraph payments; alice["Alice Smith"]; end` on one line declares Alice, with her label, inside Payments.
- The order of these lines doesn't matter for nesting.
- A node listed in two teams stays in the **first** one.
- **Title rule:** a team's title comes from its **first** `subgraph <id>` declaration. Put each team's titled line before any line that opens that team to add members. If an untitled `subgraph payments; …; end` came first, the title was lost in my test.
- Rendering the sample org below with ELK and with dagre gave correct nested boxes (FinTech ⊃ Payments ⊃ Cards; FinTech ⊃ Risk). Cross-boundary edges (Dir in FinTech → EM in Payments; Risk → Platform) and a ghost manager outside all boxes were drawn correctly. Under ELK, one edge passed through a box title. That's cosmetic.

**Version caveat**
- With ELK, repeated subgraph ids rendered NaN geometry in **12.0.0**. This was fixed in **12.1.0** ("now renders as one merged subgraph with the ELK layout"). dagre always merged ([#8326](https://github.com/mermaid-js/mermaid/issues/8326), [PR #8337 in 12.1.0 notes](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.1.0)).
- Hosts that bundle an older Mermaid (Obsidian, GitHub, VS Code previews) may behave differently (**unverified** per host). Add `config: layout: dagre` for portability.

**How cross-boundary edges are laid out**
- Mermaid's ELK renderer sets the root graph to `elk.hierarchyHandling: INCLUDE_CHILDREN`.
- It switches containers that have cross-boundary edges to `INCLUDE_CHILDREN` as well ([elk/render.ts](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/rendering-util/layout-algorithms/elk/render.ts)).
- So people inside nested teams are ranked together with their managers outside the team.

**Known open issues with nested subgraphs (cosmetic)**
- A long title draws the child outside its parent: [#8035](https://github.com/mermaid-js/mermaid/issues/8035), [#7901](https://github.com/mermaid-js/mermaid/issues/7901).
- Titles get clipped: [#2874](https://github.com/mermaid-js/mermaid/issues/2874).
- Linking a subgraph that contains a nested subgraph to a node: [#2311](https://github.com/mermaid-js/mermaid/issues/2311). This doesn't affect person-to-person edges.

**Privacy**
- mermaid.live says "Your diagrams never leave your browser", stored only in the URL and localStorage. It works offline as a PWA.
- Exports to mermaid.ink or Kroki share the diagram with those services ([Privacy.svelte](https://github.com/mermaid-js/mermaid-live-editor/blob/develop/src/lib/components/Privacy.svelte)).
- Self-host via Docker ([README](https://github.com/mermaid-js/mermaid-live-editor#readme)).

### Mermaid architecture-beta (right syntax, wrong layout)
- `group {id}({icon})[{title}] (in {parent id})?` and `service {id}({icon})[{title}] (in {parent id})?` give **one-line parent declarations** for both teams and people ([architecture docs](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/architecture.md)).
- Drawbacks:
  - Every edge must name port sides (`bob:B --> T:alice`).
  - Identifiers must be declared before use.
  - Cross-group edges need a `{group}` modifier.
  - The renderer uses Cytoscape **fcose**, a force-directed layout ([architectureRenderer.ts](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagrams/architecture/architectureRenderer.ts)).
- In my test, managers did **not** end up above their reports, and edges cut diagonally across boxes. Not suitable for an org chart (tested).

### PlantUML
- There is no org-chart type ([plantuml.com](https://plantuml.com/)).
- **WBS:** hierarchy comes from `*`/`+`/`-` depth markers ([WBS](https://plantuml.com/wbs-diagram)). It draws no boxes-in-boxes.
- **Deployment/component diagrams:** containers nest with braces, e.g. `cloud vpc { node ec2 { stack stack } }`. Every container example declares its children inside `{ }` ([deployment](https://plantuml.com/deployment-diagram)).
- I found no "place X in container Y" statement (**unverified** that none exists), so team moves are block or line moves.
- **Privacy:** the public server "do[es] not store any diagrams". The local jar server is recommended ([FAQ](https://plantuml.com/faq)).
- **Version:** v1.2026.8, 2026-09-05 ([repo](https://github.com/plantuml/plantuml)).

### Graphviz / DOT
- `dot` draws hierarchical, layered drawings ([dot](https://graphviz.org/docs/layouts/dot/)), with `rankdir` TB/LR/BT/RL ([rankdir](https://graphviz.org/docs/attrs/rankdir/)).
- Subgraphs named `cluster…` are drawn as boxes ([DOT language](https://graphviz.org/doc/info/lang.html)). Related attributes are `compound` (edges between clusters), `clusterrank` and `newrank` ([dot attrs](https://graphviz.org/docs/layouts/dot/)).
- **Nested clusters work, but cluster names are scoped to their parent graph (tested, viz.js 3.31.0):**
  - Writing `subgraph cluster_fintech { … }` again at top level merges into the same cluster.
  - Writing `subgraph cluster_payments { alice }` at top level, when `cluster_payments` lives inside `cluster_fintech`, creates a **second, unrelated top-level cluster**.
  - A person line must therefore be `subgraph cluster_fintech { subgraph cluster_payments { alice } }`. That is still one line, but it encodes the whole team path. Moving Payments under another org means rewriting every Payments member's line.
- Empty clusters are not drawn (my test).
- **Versions:** 16.1.0 is the newest listed ([download](https://graphviz.org/download/)). Browser builds: [@viz-js/viz](https://www.npmjs.com/package/@viz-js/viz) (MIT) and [@hpcc-js/wasm-graphviz](https://www.npmjs.com/package/@hpcc-js/wasm-graphviz) (Apache-2.0).

### D2
- Containers are declared by key path: `server.process`, or `apartment.Bedroom.Bathroom -> office.Spare Room.Bathroom` ([containers example source](https://github.com/terrastruct/d2-docs/blob/master/static/d2/containers-1.d2), [docs](https://d2lang.com/tour/containers)).
- Nesting is a one-liner (`fintech.payments.alice`), but **the team path is part of every reference**. Moving a person or team rewrites the node key and all its edges. Worst fit for "one-line edits" under nested teams (my assessment).
- **Layouts:** dagre (default), ELK, TALA ([layouts](https://d2lang.com/tour/layouts)). TALA needs a licence for commercial use and shows a watermark without one ([TALA](https://github.com/terrastruct/TALA)).
- **Live preview:** `d2 --watch` live-reloads locally ([README](https://github.com/terrastruct/d2)).
- MPL-2.0; v0.9.0 (2026-09-07).

### Markmap, Kroki
- **Markmap:** Markdown-list mindmaps, single root, no boxes ([README](https://github.com/markmap/markmap)). MIT; last release v0.18.0 (2024-12).
- **Kroki:** a self-hostable rendering gateway for Mermaid, Graphviz, D2, PlantUML and others ([install](https://docs.kroki.io/kroki/setup/install/)). Its nesting ability equals the chosen language's. MIT, v0.33.0.

### draw.io / diagrams.net CSV import
- **Menu path:** Arrange > Insert > Advanced > CSV ([docs](https://www.drawio.com/blog/insert-from-csv)).
- **Template:** `manager` column + `# connect: {"from": "manager", "to": "name", "invert": true, …}`.
- **Nested containers (`# parent:`):**
  - The docs: puts each shape "inside the shape referenced in this column". The parent must appear earlier in the data. With `# identity`, the cell holds the parent's identity ([docs](https://www.drawio.com/blog/insert-from-csv)).
  - From the source, the parent is looked up as any existing vertex by id ([EditorUi.js](https://github.com/jgraph/drawio/blob/dev/src/main/webapp/js/diagramly/EditorUi.js)). Team rows can therefore have a parent team row, and person rows a team row: nested boxes from one flat CSV, with `# parentstyle:` styling the containers.
  - Rows must be ordered parents first.
- **Re-import gotchas (from source):**
  - `graph.addCell(cell, parent)` only runs when the cell does **not** already exist (`if (!exists)`). Re-importing with `# identity` updates labels and styles but **does not move an existing person or team to a new parent**.
  - The docs also say updated rows don't add connectors.
  - So team moves and manager changes require deleting and re-importing.
- **Layouts (source, v32.4.1):**
  - `verticaltree`/`horizontaltree` → ELK tree; `verticalflow`/`horizontalflow` → ELK layered; `orgchart` → mxOrgChartLayout.
  - `auto` with several roots and edges → organic.
  - How these layouts treat nested containers is **unverified**.
- **Privacy:** data "only lives in your browser". PDF export is the exception ([data protection](https://www.drawio.com/blog/data-protection)). Desktop is offline ([desktop](https://www.drawio.com/docs/security/desktop-secure-diagrams/)).
- Apache-2.0 / GPL-3.0; v32.4.1 (2026-10-08).

### Lucidchart, Google Sheets/Charts, Excalidraw, Whimsical, yEd, Structurizr
- **Lucidchart:** CSV, Excel or Sheets import. Supervisor by name or ID. Can split into several charts by a column ([import](https://help.lucid.co/hc/en-us/articles/44818725952276)). "Every supervisor must also appear as an employee"; about 2,000 rows max for performance ([format](https://help.lucid.co/hc/en-us/articles/44818070371092)). Nested team boxes from data: not found (**unverified**). Cloud SaaS.
- **Google Charts OrgChart:** DataTable of name, manager, tooltip. "No data is sent to any server" ([docs](https://developers.google.com/chart/interactive/docs/gallery/orgchart)). Offline use is forbidden by the ToS ([FAQ](https://developers.google.com/chart/interactive/faq)). Sheets uses child, parent, tooltip columns ([help](https://support.google.com/docs/answer/9146871)). No team boxes.
- **Excalidraw:** `mermaid-to-excalidraw` converts flowchart, sequence, class, ER and state natively; others become images ([parseMermaid.ts](https://github.com/excalidraw/mermaid-to-excalidraw/blob/master/src/parseMermaid.ts)). It is one-shot. Nested-subgraph fidelity is **unverified**.
- **Whimsical:** pasted Mermaid flowcharts become editable shapes, with subgraphs as groups ([release](https://whimsical.com/releases/mermaid-to-flowchart), [guide](https://whimsical.com/learn/boards/mermaid)). One-shot, SaaS.
- **yEd:** free desktop app, v3.25.1 ([product](https://www.yworks.com/products/yed)). Spreadsheet import takes a node list plus an edge list or matrix, with hierarchical, organic and circular layouts ([import](https://yed.yworks.com/support/manual/import_excel.html)). Groups from spreadsheet are **unverified**.
- **Structurizr:** a C4 DSL and a poor fit. Repos were consolidated into [structurizr/structurizr](https://github.com/structurizr/structurizr).

### "Org chart as code" projects on GitHub
I found no maintained text-DSL + live-preview org chart tool. The hits are widgets: dabeng/OrgChart, bumbeishvili/org-chart, BALKAN, GoJS, unicef/react-org-chart (2022). Two notes:
- **[n1crack/klad](https://github.com/n1crack/klad)** (AGPL-3.0, `@klad/core` 1.11.2) takes `{id, parentId}`. Its README describes a single tree, with no nested team boxes.
- **[Hoogkamer/vue-org-chart](https://github.com/Hoogkamer/vue-org-chart)** (MIT) is a GUI-edited static org chart site.

---

## Build-your-own building blocks

### What nested teams require of the layout engine
1. **A compound graph:** team boxes contain people and other team boxes.
2. **Layered (top-down) placement across the whole hierarchy**, so a manager in X sits above a report in Y ⊂ X.
3. **Cross-hierarchy edges** routed between nested boxes.

Tree-only layouts satisfy none of these.

| Library | Compound / nested boxes | Cross-boundary edges in one layered layout | Fit | Licence, version |
|---|---|---|---|---|
| **ELK.js** (`elk.layered`) | Yes: hierarchical graph with `children` | **Yes**: `hierarchyHandling: INCLUDE_CHILDREN` "will lay out that node and all of its descendants in a single layout run" ([option](https://eclipse.dev/elk/reference/options/org-eclipse-elk-hierarchyHandling.html)). Layered lists "Compound" (edges between hierarchy levels) and "Clusters" as supported features ([layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)) | **Required engine for the custom build.** Mermaid uses exactly this ([render.ts](https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/rendering-util/layout-algorithms/elk/render.ts)) | EPL-2.0 OR GPL-3.0; 0.12.0 (2026-07-17), active ([repo](https://github.com/kieler/elkjs)) |
| ELK Mr. Tree | Feature list shows only "Disconnected" ([mrtree](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-mrtree.html)) | No | Tree-only, no boxes | — |
| **dagre** (`@dagrejs/dagre`) | Yes: compound graphs via nesting-graph and border segments, after Sander's "Layout of Compound Directed Graphs" ([nesting-graph.ts](https://github.com/dagrejs/dagre/blob/master/lib/nesting-graph.ts)) | Yes, though React Flow warns that dagre "prevents it from laying out sub-flows correctly" when sub-flow nodes connect outside ([React Flow layouting](https://reactflow.dev/learn/layouting/layouting)). Mermaid's dagre mode rendered my nested test fine (tested) | Viable fallback; smaller than ELK | MIT; npm 3.1.1 (2026-08) |
| **Cytoscape.js** | Yes: `data.parent` (one field!), changeable via `eles.move()`. Compound bounds are inferred from children ([docs source](https://github.com/cytoscape/cytoscape.js/blob/unstable/documentation/md/notation.md)) | Via extensions: **cytoscape-elk** (ELK adapter, 2.3.0), **cytoscape-klay** ("supports compound nodes"), **cytoscape-dagre** (4.0.1). fcose / cose-bilkent support compounds but are **force-directed**, not top-down ([fcose](https://github.com/iVis-at-Bilkent/cytoscape.js-fcose), [cose-bilkent](https://github.com/cytoscape/cytoscape.js-cose-bilkent), [cytoscape-elk](https://github.com/cytoscape/cytoscape.js-elk), [klay](https://github.com/cytoscape/cytoscape.js-klay)) | Good if you want interaction (pan, zoom, select) for free; use with cytoscape-elk | MIT; 3.34.3 |
| **React Flow** (`@xyflow/react`) | Sub-flows: child `parentId`, positions relative to the parent, `extent: 'parent'`; **parents must precede children in the array**; group size is set by you ([sub-flows](https://reactflow.dev/learn/layouting/sub-flows)) | No built-in layout; pair with ELK ([layouting](https://reactflow.dev/learn/layouting/layouting)) | Renderer only; you compute positions and box sizes with ELK | MIT; 12.12.0 |
| **d3-hierarchy** | **No.** It provides tree, cluster, partition, **pack** (nested circles) and treemap of *one* hierarchy ([d3-hierarchy](https://d3js.org/d3-hierarchy)) | No compound-graph layout. A tree layout can't also nest boxes from a second, disagreeing hierarchy. `stratify` throws `"multiple roots"`, `"missing: <id>"`, `"cycle"` ([stratify.js](https://github.com/d3/d3-hierarchy/blob/main/src/stratify.js)) | Use only for **validation** (each tree is a forest, no cycles), or for a separate team-only view (treemap or pack of teams). Not the main layout | ISC; 3.1.2 |
| d3-org-chart, dabeng/OrgChart, BALKAN, ECharts tree | Single reporting tree (flat `parentId` / nested `children`) | No nested team boxes found in docs (**unverified** for BALKAN) | Not suitable once teams are boxes | MIT / MIT / proprietary / Apache-2.0 |
| **GoJS** | Groups and nested groups exist, but that is from general knowledge: **unverified** at source in this pass | — | Commercial (watermark without a key; free only for personal non-commercial use ([deployment](https://gojs.net/latest/intro/deployment.html))) | Proprietary; 4.0.5 |

**Conclusion (my assessment):** once teams are nested boxes, the layout engine is **ELK Layered with `INCLUDE_CHILDREN`**, used directly or through Mermaid. dagre compound mode is the lighter fallback. The earlier d3.stratify plan is demoted to input validation.

### Editor pane and text formats
No change from before:
- **CodeMirror 6:** MIT; `@codemirror/view` 6.43.14 (2026-10-07). Use `@codemirror/lint` for diagnostics. The GitHub repo is archived only because development moved to `code.haverbeke.berlin` ([README](https://github.com/codemirror/dev)).
- **Monaco:** MIT, v0.57.0 ([repo](https://github.com/microsoft/monaco-editor)).
- **No editor:** edit `org.txt` in your own editor and let Vite hot-reload the page.

**Formats:**
- A one-line DSL keeps both parent relations as fields.
- YAML (`yaml` 2.9.1) and CSV (`kind=team|person` column) can too.
- Nested YAML (`teams: fintech: payments: [...]`) would bring back indentation moves. Avoid it.

---

## Recommended format sketch

### A. Use today: Mermaid, one fact per line (needs mermaid ≥ 12.1.0, or `layout: dagre`)

```mermaid
---
config:
  layout: dagre        # portable; remove to use ELK (12.1.0+ default)
---
flowchart TB
  %% ---- TEAMS: one line per team =  subgraph <parent>; subgraph <team> [Title]; end; end
  %% (top-level teams: subgraph <team> [Title]; end). Keep team lines FIRST: a team's
  %% title comes from its first declaration.
  subgraph fintech [FinTech]; end
  subgraph platform [Platform]; end
  subgraph fintech; subgraph payments [Payments]; end; end
  subgraph fintech; subgraph risk [Risk]; end; end
  subgraph payments; subgraph cards [Cards]; end; end

  %% ---- PEOPLE: one line per person =  subgraph <team>; <id>["Name"]; end
  subgraph fintech;  bob["Bob Jones · Dir"]; end
  subgraph payments; alice["Alice Smith · EM"]; end
  subgraph cards;    dan["Dan Ruiz"]; end
  subgraph cards;    gia["Gia Lam"]; end
  subgraph risk;     carol["Carol Lee"]; end
  subgraph risk;     eve["Eve Park"]; end
  subgraph platform; hal["Hal Ng"]; end
  frank["? Eve's manager"]:::unknown

  %% ---- REPORTING: one line per edge =  <manager> --> <report>
  bob --> alice
  alice --> dan
  alice --> gia
  bob --> carol
  frank --> eve
  carol --> hal          %% crosses from FinTech/Risk into Platform

  classDef unknown stroke-dasharray:4 4,color:#888
```

I rendered this with both ELK and dagre on mermaid 12.1.0, and both drew the nested boxes and cross-boundary edges correctly (tested). The three kinds of change are each one token on one line:

| Change | Edit |
|---|---|
| Alice now reports to Carol | `bob --> alice` → `carol --> alice` |
| Eve moves from Risk to Payments | `subgraph risk; eve[…]; end` → `subgraph payments; eve[…]; end` |
| Cards moves from Payments to Platform | `subgraph payments; subgraph cards …` → `subgraph platform; subgraph cards …` |

**Limits:**
- No validation: a typo in a team id silently creates a new box.
- Person data is limited to the label.
- No compact stacking of leaves on wide teams.

### B. Custom build: one-line DSL with two parent fields

```text
# org.txt  — git-tracked, one fact per line, order-independent
# ---- teams:  team <id> : <Title> | parent=<team-id>
team fintech  : FinTech
team platform : Platform
team payments : Payments  | parent=fintech
team risk     : Risk      | parent=fintech
team cards    : Cards     | parent=payments

# ---- people: <id> : <Name> | team=<team-id> | reports=<person-id> | k=v...
bob   : Bob Jones   | team=fintech  | role=Director
alice : Alice Smith | team=payments | reports=bob   | role=EM
dan   : Dan Ruiz    | team=cards    | reports=alice
gia   : Gia Lam     | team=cards    | reports=alice
carol : Carol Lee   | team=risk     | reports=bob
eve   : Eve Park    | team=risk     | reports=frank      # frank undefined → ghost person
hal   : Hal Ng      | team=platform | reports=carol      # crosses team boundary
zoe   : Zoe Kim     | reports=?                          # no team, unknown manager
```

**Each change is a one-line diff:**

```diff
-alice : Alice Smith | team=payments | reports=bob   | role=EM
+alice : Alice Smith | team=payments | reports=carol | role=EM
```

```diff
-team cards    : Cards     | parent=payments
+team cards    : Cards     | parent=platform
```

**Parser and validation**
1. **Two flat maps:** `teams[id] = {title, parent}` and `people[id] = {name, team, reports, …}`.
2. **Unknown references become ghosts:**
   - An unknown `reports=` id creates a dashed **ghost person**, placed at top level or in the reporter's team (your choice).
   - An unknown `team=` or `parent=` id creates a dashed **ghost team** at top level.
   - `reports=?` or a missing `reports` means no edge (the person is a local root).
3. **Validate each tree separately.** Run d3.stratify on each with a virtual root added, or use a 10-line DFS. Report `cycle` (e.g. a team that is its own ancestor) and duplicate ids as CodeMirror lint diagnostics on the offending line, while keeping the last good render.
4. **Nothing forces the two trees to agree**, which is the point. A reporting edge from a person in X to a person in Y ⊂ X, or across top-level orgs, is a normal cross-hierarchy edge.

**Render path (a), shortest: generate Mermaid text**
- One `subgraph <parent>; subgraph <team> [Title]; end; end` per team, emitted **before** people.
- One `subgraph <team>; <id>["Name<br/>role"]; end` per person.
- One `<mgr> --> <id>` per edge.
- Then call `mermaid.render()`.
- You get ELK with `INCLUDE_CHILDREN`, nested boxes, collapse (`@{ view: collapsed }`), and offline rendering.
- The cost is less control over card design and leaf compaction.

**Render path (b), full control: elkjs directly**
- **Graph:** build an ELK graph where each team is a node with `children` (sub-teams and people) and `layoutOptions: {'elk.algorithm':'layered','elk.direction':'DOWN','elk.hierarchyHandling':'INCLUDE_CHILDREN'}`. Reporting edges go at the root, or set ELK's edge-coordinate mode so you needn't compute containers ([coordinate system](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html)).
- **Drawing:** draw boxes and cards yourself (SVG or React Flow with `parentId`, parents first in the array).
- **Interaction:** collapse a team by replacing its subtree with a single node before layout.
- **Alternative:** Cytoscape.js with `data.parent` plus `cytoscape-elk` gives pan, zoom and selection for free with the same ELK layout.

**Shell (both paths)**
- CodeMirror 6 left, diagram right, about 150 ms debounce.
- Click a card to jump to its line.
- File via the File System Access API (Chromium; other browsers **unverified**), or a Vite dev server importing `org.txt?raw`.
- No network calls.

---

## Sources

**Mermaid**
- Intro: https://mermaid.js.org/intro/
- Releases: https://github.com/mermaid-js/mermaid/releases; 12.0.0: https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.0.0; 12.1.0: https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.1.0
- Flowchart (subgraphs, collapse, layout): https://mermaid.js.org/syntax/flowchart.html
- flowDb (subgraph merge and nesting logic): https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagrams/flowchart/flowDb.ts
- ELK renderer (`INCLUDE_CHILDREN`): https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/rendering-util/layout-algorithms/elk/render.ts
- Issues: https://github.com/mermaid-js/mermaid/issues/8326, https://github.com/mermaid-js/mermaid/issues/8035, https://github.com/mermaid-js/mermaid/issues/7901, https://github.com/mermaid-js/mermaid/issues/2874, https://github.com/mermaid-js/mermaid/issues/2311, https://github.com/mermaid-js/mermaid/issues/1360, https://github.com/mermaid-js/mermaid/issues/7458, https://github.com/mermaid-js/mermaid/issues/3989
- Architecture: https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/architecture.md, https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagrams/architecture/architectureRenderer.ts
- TreeView: https://mermaid.js.org/syntax/treeView.html
- Live editor: https://github.com/mermaid-js/mermaid-live-editor, https://github.com/mermaid-js/mermaid-live-editor/blob/develop/src/lib/components/Privacy.svelte

**Other text-to-diagram tools**
- PlantUML: https://plantuml.com/, https://plantuml.com/wbs-diagram, https://plantuml.com/deployment-diagram, https://plantuml.com/faq, https://github.com/plantuml/plantuml
- Graphviz: https://graphviz.org/docs/layouts/dot/, https://graphviz.org/docs/attrs/rankdir/, https://graphviz.org/doc/info/lang.html, https://graphviz.org/download/, https://www.npmjs.com/package/@viz-js/viz
- D2: https://d2lang.com/tour/containers, https://github.com/terrastruct/d2-docs/blob/master/static/d2/containers-1.d2, https://d2lang.com/tour/layouts, https://github.com/terrastruct/d2, https://github.com/terrastruct/TALA
- Markmap: https://github.com/markmap/markmap
- Kroki: https://docs.kroki.io/kroki/setup/install/

**Diagram editors and SaaS**
- draw.io: https://www.drawio.com/blog/insert-from-csv, https://github.com/jgraph/drawio/blob/dev/src/main/webapp/js/diagramly/EditorUi.js, https://www.drawio.com/blog/data-protection, https://www.drawio.com/docs/security/desktop-secure-diagrams/, https://github.com/jgraph/drawio-desktop
- Lucid: https://help.lucid.co/hc/en-us/articles/44818725952276, https://help.lucid.co/hc/en-us/articles/44818070371092
- Google: https://developers.google.com/chart/interactive/docs/gallery/orgchart, https://developers.google.com/chart/interactive/faq, https://support.google.com/docs/answer/9146871
- Excalidraw: https://github.com/excalidraw/mermaid-to-excalidraw/blob/master/src/parseMermaid.ts
- Whimsical: https://whimsical.com/releases/mermaid-to-flowchart, https://whimsical.com/learn/boards/mermaid
- yEd: https://www.yworks.com/products/yed, https://yed.yworks.com/support/manual/import_excel.html
- Structurizr: https://github.com/structurizr/structurizr

**Layout and rendering libraries**
- ELK: https://eclipse.dev/elk/reference/options/org-eclipse-elk-hierarchyHandling.html, https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html, https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-mrtree.html, https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html, https://github.com/kieler/elkjs
- dagre: https://github.com/dagrejs/dagre/blob/master/lib/nesting-graph.ts
- Cytoscape.js: https://github.com/cytoscape/cytoscape.js/blob/unstable/documentation/md/notation.md, https://github.com/iVis-at-Bilkent/cytoscape.js-fcose, https://github.com/cytoscape/cytoscape.js-cose-bilkent, https://github.com/cytoscape/cytoscape.js-elk, https://github.com/cytoscape/cytoscape.js-klay, https://github.com/cytoscape/cytoscape.js-dagre
- React Flow: https://reactflow.dev/learn/layouting/sub-flows, https://reactflow.dev/learn/layouting/layouting
- d3-hierarchy: https://d3js.org/d3-hierarchy, https://github.com/d3/d3-hierarchy/blob/main/src/stratify.js
- Widgets: https://github.com/bumbeishvili/org-chart, https://github.com/dabeng/OrgChart, https://balkan.app/OrgChartJS/Pricing, https://gojs.net/latest/intro/deployment.html, https://github.com/n1crack/klad, https://github.com/Hoogkamer/vue-org-chart

**Editors**
- CodeMirror: https://github.com/codemirror/dev
- Monaco: https://github.com/microsoft/monaco-editor
- npm registry metadata (versions, dates, licences) via `npm view`, 2026-10-10.
