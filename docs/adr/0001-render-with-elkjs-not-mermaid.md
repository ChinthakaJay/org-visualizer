# Render the chart with elkjs and our own SVG, not Mermaid

The research's shortest path was to generate Mermaid flowchart text. We draw the chart ourselves instead: elkjs (`elk.layered`, `hierarchyHandling: INCLUDE_CHILDREN`) computes the layout, and we render the SVG. The app needs pan and zoom, collapse and expand by clicking a Team, clicking a card to jump to its line in the editor, and card styling. Mermaid re-renders the whole SVG on every change and offers collapse only as a syntax flag, so each of those would be fighting the library. We keep the same layout engine Mermaid uses, so nested Team boxes with Reporting lines that cross box boundaries still lay out correctly.

## Considered Options

- **Mermaid plus svg-pan-zoom:** fastest to build, but collapse means regenerating the text, and the cards can't be styled much.
- **Cytoscape.js plus cytoscape-elk:** pan and zoom come free, but drawing rich cards and Team headers is awkward.
