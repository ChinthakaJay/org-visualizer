import { useId, useMemo, useState } from 'react';
import type { Org } from '../core';

export interface SearchResult {
  kind: 'person' | 'team';
  id: string;
  label: string;
  /** Where it sits, for telling similar names apart. */
  detail: string;
}

const MAX_RESULTS = 12;

/** People and Teams whose name, title or id contains the query, ignoring case. Prefix matches first. */
export function searchOrg(org: Org, query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: (SearchResult & { rank: number })[] = [];
  const rank = (...texts: string[]) => {
    const lower = texts.map((t) => t.toLowerCase());
    if (lower.some((t) => t.startsWith(q))) return 0;
    if (lower.some((t) => t.split(/\s+/).some((w) => w.startsWith(q)))) return 1;
    return lower.some((t) => t.includes(q)) ? 2 : -1;
  };
  for (const p of org.people.values()) {
    const r = rank(p.name, p.id);
    const team = p.team ? org.teams.get(p.team)?.title ?? p.team : 'No Team';
    if (r >= 0) results.push({ kind: 'person', id: p.id, label: p.name, detail: p.placeholder ? 'Placeholder' : team, rank: r });
  }
  for (const t of org.teams.values()) {
    const r = rank(t.title, t.id);
    if (r >= 0) results.push({ kind: 'team', id: t.id, label: t.title, detail: t.placeholder ? 'Placeholder Team' : 'Team', rank: r });
  }
  return results
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .slice(0, MAX_RESULTS)
    .map(({ rank: _, ...r }) => r);
}

/** The chart toolbar's search box: type part of a name, pick a result to go to it. */
export function Search({ org, onPick }: { org: Org; onPick(result: SearchResult): void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchOrg(org, query), [org, query]);
  const listId = useId();

  const pick = (r: SearchResult | undefined) => {
    if (!r) return;
    onPick(r);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && query.trim() !== '';
  return (
    <div className="search">
      <input
        type="search"
        placeholder="Search People and Teams"
        aria-label="Search People and Teams"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="search-results" role="listbox" id={listId}>
          {results.length === 0 && <li className="search-empty">No matches</li>}
          {results.map((r, i) => (
            <li
              key={`${r.kind}:${r.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              // mousedown, not click, so it fires before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="search-label">{r.label}</span>
              <span className="search-detail">{r.kind === 'team' ? '▢ ' : ''}{r.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
