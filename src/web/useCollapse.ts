import { useCallback, useEffect, useMemo, useState } from 'react';
import { teamChain, teamDepths, type Org } from '../core';

const storageKey = (path: string) => `org-visualizer:collapsed:${path}`;

function load(path: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(storageKey(path));
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function store(path: string, collapsed: ReadonlySet<string>) {
  try {
    localStorage.setItem(storageKey(path), JSON.stringify([...collapsed]));
  } catch {
    // Private windows or blocked storage: collapse still works, it just isn't remembered.
  }
}

/**
 * Which Teams are collapsed. A viewing choice only: kept in the browser per Org file path, never in
 * the file. The first time a file is opened, every Team starts collapsed. With no path (the Help
 * sandbox) it lives in memory and starts fully expanded.
 */
export function useCollapse(path: string | null, org: Org) {
  const [collapsed, setCollapsedState] = useState<ReadonlySet<string>>(() =>
    path === null ? new Set() : (load(path) ?? new Set(org.teams.keys())),
  );

  useEffect(() => {
    if (path !== null) store(path, collapsed);
  }, [path, collapsed]);

  const setCollapsed = useCallback((ids: Iterable<string>) => setCollapsedState(new Set(ids)), []);

  const depths = useMemo(() => teamDepths(org), [org]);
  const maxDepth = Math.max(0, ...depths.values());

  const toggle = useCallback((id: string) => {
    setCollapsedState((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /** Expand every Collapsed team that contains the given Team, so it can be seen. */
  const expandTo = useCallback(
    (teamId: string | null) => {
      const chain = teamChain(org, teamId).map((t) => t.id);
      setCollapsedState((prev) => (chain.some((id) => prev.has(id)) ? new Set([...prev].filter((id) => !chain.includes(id))) : prev));
    },
    [org],
  );

  return {
    collapsed,
    setCollapsed,
    toggle,
    expandTo,
    maxDepth,
    collapseAll: () => setCollapsed(org.teams.keys()),
    expandAll: () => setCollapsed([]),
    /** Show Teams down to `depth` levels; anything deeper is collapsed. */
    collapseToDepth: (depth: number) => setCollapsed([...depths].filter(([, d]) => d >= depth).map(([id]) => id)),
  };
}
