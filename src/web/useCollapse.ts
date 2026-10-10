import { useCallback, useEffect, useMemo, useState } from 'react';
import { teamDepths, type Org } from '../core';

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
 * the file. The first time a file is opened, every Team starts collapsed.
 */
export function useCollapse(path: string, org: Org) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => load(path) ?? new Set(org.teams.keys()));

  useEffect(() => store(path, collapsed), [path, collapsed]);

  const depths = useMemo(() => teamDepths(org), [org]);
  const maxDepth = Math.max(0, ...depths.values());

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /** Expand every Collapsed team that contains the given Team, so it can be seen. */
  const expandTo = useCallback(
    (teamId: string | null) => {
      const chain: string[] = [];
      for (let t = teamId ? org.teams.get(teamId) : undefined; t; t = t.parent ? org.teams.get(t.parent) : undefined) chain.push(t.id);
      setCollapsed((prev) => (chain.some((id) => prev.has(id)) ? new Set([...prev].filter((id) => !chain.includes(id))) : prev));
    },
    [org],
  );

  return {
    collapsed,
    toggle,
    expandTo,
    maxDepth,
    collapseAll: () => setCollapsed(new Set(org.teams.keys())),
    expandAll: () => setCollapsed(new Set()),
    /** Show Teams down to `depth` levels; anything deeper is collapsed. */
    collapseToDepth: (depth: number) => setCollapsed(new Set([...depths].filter(([, d]) => d >= depth).map(([id]) => id))),
  };
}
