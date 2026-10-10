/**
 * Styles for the chart SVG. They live inside the <svg> (not in the page stylesheet) so an exported
 * SVG looks the same on its own, including the light or dark theme.
 *
 * Team colours arrive as custom properties on each Team box and card: --h (hue), --s (saturation)
 * and --shade (depth, capped). Elements without them are neutral grey. A Function badge has its own
 * hue and saturation, --fh and --fs.
 */
export const CHART_CSS = `
.chart-svg {
  --c-ink: #1d1d1f; --c-muted: #6b6b70; --c-panel: #ffffff; --c-line: #5b6474; --c-dotted: #2f6fdf;
  --c-highlight: #f59e0b; --c-bg: #f6f6f4;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.chart-svg .chart-bg { fill: var(--c-bg); }
.chart-svg .team, .chart-svg .card { --h: 0; --s: 0; --shade: 0; }

.chart-svg .team-box {
  fill: hsl(var(--h) calc(var(--s) * 0.9%) calc(96.5% - var(--shade) * 3.2%));
  stroke: hsl(var(--h) calc(var(--s) * 0.7%) 62%);
  stroke-width: 1.2;
}
.chart-svg .team-title { font-size: 13px; font-weight: 650; fill: hsl(var(--h) calc(var(--s) * 0.8%) 28%); }
.chart-svg .team-hit { fill: transparent; cursor: pointer; }
.chart-svg .team-hit:hover { fill: hsl(var(--h) calc(var(--s) * 0.6%) 50% / 0.08); }
.chart-svg .team-hit:focus { outline: none; }
.chart-svg .team-hit:focus-visible { outline: none; stroke: var(--c-dotted); stroke-width: 2; }
.chart-svg .team-chevron { font-size: 11px; fill: hsl(var(--h) calc(var(--s) * 0.6%) 40%); pointer-events: none; }
.chart-svg .team-title, .chart-svg .team-counts { pointer-events: none; }
.chart-svg .team-title.link { pointer-events: auto; cursor: pointer; }
.chart-svg .team-title.link:hover { text-decoration: underline; }
.chart-svg .card { cursor: pointer; }
.chart-svg .card.placeholder { cursor: default; }
.chart-svg .define-button { cursor: pointer; }
.chart-svg .define-button rect { fill: var(--c-panel); stroke: var(--c-dotted); stroke-width: 1; }
.chart-svg .define-button text { font-size: 11px; font-weight: 600; fill: var(--c-dotted); }
.chart-svg .define-button:hover rect { fill: var(--c-dotted); }
.chart-svg .define-button:hover text { fill: var(--c-panel); }
.chart-svg .define-button:focus { outline: none; }
.chart-svg .define-button:focus-visible rect { stroke-width: 2.5; }
.chart-svg .highlight > .team-box, .chart-svg .highlight > .card-box {
  stroke: var(--c-highlight); stroke-width: 3; stroke-dasharray: none;
}
.chart-svg .team-counts { font-size: 12px; fill: var(--c-muted); }
.chart-svg .team.collapsed .team-box { stroke-width: 1.6; }
.chart-svg .team.placeholder .team-box { fill: #8e8e93; fill-opacity: 0.06; stroke: #8e8e93; stroke-dasharray: 6 4; }
.chart-svg .team.placeholder .team-title { fill: var(--c-muted); font-weight: 500; font-style: italic; }

.chart-svg .card-box {
  fill: hsl(var(--h) calc(var(--s) * 0.6%) 99%);
  stroke: hsl(var(--h) calc(var(--s) * 0.35%) 72%);
  stroke-width: 1;
}
.chart-svg .card-name { font-size: 13px; font-weight: 600; fill: var(--c-ink); }
.chart-svg .card-role { font-size: 12px; fill: var(--c-muted); }
.chart-svg .fn-badge { --fh: 0; --fs: 0; }
.chart-svg .fn-badge rect {
  fill: hsl(var(--fh) calc(var(--fs) * 1%) 50% / 0.14);
  stroke: hsl(var(--fh) calc(var(--fs) * 1%) 45% / 0.55); stroke-width: 1;
}
.chart-svg .fn-badge text { font-size: 10.5px; font-weight: 600; fill: hsl(var(--fh) calc(var(--fs) * 1%) 30%); letter-spacing: 0.02em; }
.chart-svg .card.placeholder .card-box { fill: transparent; stroke: #8e8e93; stroke-dasharray: 5 4; }
.chart-svg .card.placeholder .card-name { fill: var(--c-muted); font-weight: 500; }

.chart-svg .line { fill: none; stroke-width: 1.5; }
.chart-svg .line.reporting { stroke: var(--c-line); }
.chart-svg .line.dotted { stroke: var(--c-dotted); stroke-dasharray: 5 4; stroke-width: 1.4; }
.chart-svg .arrow-head.reporting { fill: var(--c-line); }
.chart-svg .arrow-head.dotted { fill: none; stroke: var(--c-dotted); stroke-width: 1.6; }

@media (prefers-color-scheme: dark) {
  .chart-svg {
    --c-ink: #ececee; --c-muted: #a1a1aa; --c-panel: #1d1d20; --c-line: #9aa3b2; --c-dotted: #7aa7ff;
    --c-highlight: #fbbf24; --c-bg: #151517;
  }
  .chart-svg .team-box {
    fill: hsl(var(--h) calc(var(--s) * 0.32%) calc(14% + var(--shade) * 3.5%));
    stroke: hsl(var(--h) calc(var(--s) * 0.55%) 42%);
  }
  .chart-svg .team-title { fill: hsl(var(--h) calc(var(--s) * 0.8%) 82%); }
  .chart-svg .team-chevron { fill: hsl(var(--h) calc(var(--s) * 0.6%) 70%); }
  .chart-svg .card-box {
    fill: hsl(var(--h) calc(var(--s) * 0.22%) 11%);
    stroke: hsl(var(--h) calc(var(--s) * 0.3%) 34%);
  }
  .chart-svg .fn-badge rect {
    fill: hsl(var(--fh) calc(var(--fs) * 1%) 62% / 0.16);
    stroke: hsl(var(--fh) calc(var(--fs) * 1%) 65% / 0.5);
  }
  .chart-svg .fn-badge text { fill: hsl(var(--fh) calc(var(--fs) * 1%) 80%); }
}
`;
