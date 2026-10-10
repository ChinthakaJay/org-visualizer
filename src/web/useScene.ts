import { useEffect, useMemo, useRef, useState } from 'react';
import { buildScene, parse, type Org, type Scene } from '../core';
import { layoutEngine } from './layout';

export const RENDER_DELAY_MS = 180;

/**
 * Parses the text and builds its scene shortly after it stops changing.
 * If Build scene fails, the last good scene stays and `stale` is set until the next success.
 */
export function useScene(text: string) {
  const org: Org = useMemo(() => parse(text), [text]);
  const [scene, setScene] = useState<Scene | null>(null);
  const [stale, setStale] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      buildScene(org, { engine: layoutEngine }).then(
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
    }, scene ? RENDER_DELAY_MS : 0);
    return () => clearTimeout(timer);
    // Re-run only when the Org changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  return { org, scene, stale };
}
