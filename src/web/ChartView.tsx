import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import type { Rect, Scene } from '../core';
import { Chart } from './Chart';

export interface ChartHandle {
  /** Frame the whole chart. */
  fit(): void;
  /** Pan so a scene rectangle is in view, if it isn't already. */
  reveal(rect: Rect): void;
  /** The chart as a standalone SVG document. */
  toSvg(): string;
}

interface ChartViewProps {
  scene: Scene | null;
  stale?: boolean;
  /** Extra toolbar controls, placed before the zoom buttons. */
  toolbar?: ReactNode;
  /** File name for SVG export. */
  exportName?: string;
  onToggleTeam?(id: string): void;
  onSelectLine?(line: number): void;
  onDefine?(kind: 'person' | 'team', id: string): void;
  highlight?: string | null;
  children?: ReactNode;
}

interface View { x: number; y: number; k: number }

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const FIT_MAX_ZOOM = 1.25;
const FIT_MARGIN = 24;
const DRAG_THRESHOLD = 4;
const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/** The chart pane: a pannable, zoomable viewport over the scene, with its toolbar. */
export const ChartView = forwardRef<ChartHandle, ChartViewProps>(function ChartView(
  { scene, stale = false, toolbar, exportName = 'org-chart.svg', onToggleTeam, onSelectLine, onDefine, highlight, children },
  ref,
) {
  const viewport = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const fitted = useRef(false);

  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el || !scene) return;
    const { clientWidth: w, clientHeight: h } = el;
    const k = clampZoom(Math.min(FIT_MAX_ZOOM, (w - FIT_MARGIN * 2) / scene.width, (h - FIT_MARGIN * 2) / scene.height));
    setView({ k, x: (w - scene.width * k) / 2, y: Math.max(FIT_MARGIN, (h - scene.height * k) / 2) });
  }, [scene]);

  // Frame the chart the first time there's something to show.
  useEffect(() => {
    if (scene && !fitted.current) {
      fitted.current = true;
      fit();
    }
  }, [scene, fit]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const k = clampZoom(v.k * factor);
      const f = k / v.k;
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });
  }, []);

  const zoomCentre = (factor: number) => {
    const el = viewport.current!;
    zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
  };

  // Wheel and trackpad pinch zoom around the pointer. Registered natively so it can preventDefault.
  useEffect(() => {
    const el = viewport.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const lines = e.deltaMode === 1 ? 16 : 1;
      const speed = e.ctrlKey ? 0.01 : 0.0018;
      zoomAt(Math.exp(-e.deltaY * lines * speed), e.clientX - box.left, e.clientY - box.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Drag to pan. Pointer capture starts only once the pointer has moved, so plain clicks still reach cards.
  const drag = useRef<{ id: number; startX: number; startY: number; view: View; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, view: viewRef.current, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      viewport.current!.setPointerCapture(e.pointerId);
    }
    setView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy });
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) {
      // Swallow the click that follows a drag.
      const swallow = (ev: Event) => ev.stopPropagation();
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    }
    drag.current = null;
  };

  const reveal = useCallback((r: Rect) => {
    const el = viewport.current;
    if (!el) return;
    const v = viewRef.current;
    const margin = 40;
    const left = r.x * v.k + v.x;
    const top = r.y * v.k + v.y;
    const right = left + r.width * v.k;
    const bottom = top + r.height * v.k;
    const inView = left >= 0 && top >= 0 && right <= el.clientWidth && bottom <= el.clientHeight;
    if (inView) return;
    setView({
      k: v.k,
      x: el.clientWidth / 2 - (r.x + r.width / 2) * v.k,
      y: Math.min(el.clientHeight / 2 - (r.y + r.height / 2) * v.k, margin - r.y * v.k),
    });
  }, []);

  const toSvg = useCallback(() => {
    const clone = svg.current!.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute('class');
    clone.setAttribute('class', 'chart-svg');
    clone.setAttribute('width', String(scene?.width ?? 0));
    clone.setAttribute('height', String(scene?.height ?? 0));
    clone.setAttribute('viewBox', `0 0 ${scene?.width ?? 0} ${scene?.height ?? 0}`);
    const content = clone.querySelector('.viewport-transform')!;
    content.removeAttribute('transform');
    // A standalone file needs its own background, since the theme's text colours assume one.
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('class', 'chart-bg');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    content.prepend(bg);
    clone.querySelectorAll('.highlight').forEach((n) => n.classList.remove('highlight'));
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }, [scene]);

  useImperativeHandle(ref, () => ({ fit, reveal, toSvg }), [fit, reveal, toSvg]);

  const exportSvg = () => {
    const url = URL.createObjectURL(new Blob([toSvg()], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div className="toolbar" role="toolbar" aria-label="Chart">
        {toolbar}
        <span className="spacer" />
        <span className="toolbar-group">
          <button onClick={() => zoomCentre(1 / 1.25)} title="Zoom out" aria-label="Zoom out">−</button>
          <span className="zoom-level" aria-live="polite">{Math.round(view.k * 100)}%</span>
          <button onClick={() => zoomCentre(1.25)} title="Zoom in" aria-label="Zoom in">+</button>
          <button onClick={fit} title="Frame the whole chart">Fit</button>
          <button onClick={exportSvg} disabled={!scene} title="Download the chart as an SVG file">Export SVG</button>
        </span>
      </div>
      {stale && <div className="stale-badge" role="status">Couldn't redraw. Showing the last good chart.</div>}
      <div
        ref={viewport}
        className={`chart-viewport${stale ? ' stale' : ''}${drag.current?.moved ? ' dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {scene && (
          <Chart
            ref={svg}
            scene={scene}
            transform={`translate(${view.x} ${view.y}) scale(${view.k})`}
            onToggleTeam={onToggleTeam}
            onSelectLine={onSelectLine}
            onDefine={onDefine}
            highlight={highlight}
          />
        )}
        {children}
      </div>
    </>
  );
});
