# Org Visualizer

Keep your slice of a large organization as a plain text **Org file**, one fact per line, and see it as a live chart of nested Teams with Reporting lines. See `CONTEXT.md` for the domain language and `docs/adr/` for key decisions.

## Run it

```sh
npm install
npm start -- path/to/org.txt            # builds the front end, then serves http://127.0.0.1:4317
npm start -- path/to/org.txt --port 5000
```

A missing file is created from a short commented template, and Help opens to show the syntax. The server listens on 127.0.0.1 only and can read and write only that one file. Edits autosave about a second after you stop typing, and changes made outside the app (another editor, `git pull`) show up live.

## The Org file

```
team fintech  : FinTech
team payments : Payments | parent=fintech | color=purple
bob   : Bob Jones   | team=fintech  | role=Director | fn=eng
alice : Alice Smith | team=payments | reports=bob | dotted=carol | met=2024 offsite
```

Help (top right) has the full syntax reference, keyboard and mouse controls, and walkthroughs.

## Develop

```sh
npm test            # Vitest: the Org core (parse, build scene, text edits) and the server's HTTP surface
npm run typecheck
npm run serve -- path/to/org.txt   # API and the last build, without rebuilding
```

`src/core` is the pure Org core (no DOM, no network), `src/server` the local Node server, and `src/web` the React front end. The `prototype/` folder is the original throwaway prototype, kept for reference.
