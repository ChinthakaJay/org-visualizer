import { useEffect, useRef, useState } from 'react';
import { buildScene, type Org, type Scene } from '../core';
import { layoutEngine } from './layout';

export const RENDER_DELAY_MS = 180;
const NONE: ReadonlySet<string> = new Set();

/**
 * Builds the scene for an Org shortly after it stops changing.
 * If Build scene fails, the last good scene stays and `stale` is set until the next success.
 */
export function useScene(org: Org, collapsed: ReadonlySet<string> = NONE) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [stale, setStale] = useState(false);
  const seq = useRef(0);
  const lastOrg = useRef<Org | null>(null);

  useEffect(() => {
    const mine = ++seq.current;
    // Typing waits for a pause; a collapse or expand click redraws straight away.
    const delay = scene && org !== lastOrg.current ? RENDER_DELAY_MS : 0;
    lastOrg.current = org;
    const timer = setTimeout(() => {
      buildScene(org, collapsed, { engine: layoutEngine }).then(
        (next) => {
          if (mine !== seq.current) return;
          setScene(next);
          setStale(false);
        },
        (err) => {
          if (mine !== seq.current) return;
          console.error('Build scene failed; keeping the last good chart', err);
          setStale(true);
        },
      );
    }, delay);
    return () => clearTimeout(timer);
    // Re-run only when the Org or the collapse state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, collapsed]);

  return { scene, stale };
}
