import { useEffect, useRef, useState } from 'react';
import { saveOrgFile, type OrgFile, type SaveResult } from './api';

export const AUTOSAVE_DELAY_MS = 1000;
const RETRY_DELAY_MS = 3000;

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'conflict' | 'error';

/**
 * Saves `text` about a second after it stops changing, sending the version last seen on disk.
 * A rejected save (the file changed on disk) is reported through `onConflict`.
 */
export function useAutosave(file: OrgFile | null, text: string, onConflict: (disk: OrgFile) => void) {
  /** The text and version we know are on disk. */
  const [saved, setSaved] = useState<{ text: string; version: string } | null>(null);
  const [state, setState] = useState<SaveState>('saved');
  /** Bumped to retry after a failed save, since nothing else would re-run the effect. */
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  const conflictHandler = useRef(onConflict);
  conflictHandler.current = onConflict;

  useEffect(() => {
    if (file) setSaved({ text: file.text, version: file.version });
  }, [file]);

  const dirty = !!saved && text !== saved.text;

  useEffect(() => {
    if (!saved || !dirty) {
      if (state === 'unsaved') setState('saved');
      return;
    }
    if (state === 'conflict') return;
    if (state !== 'saving') setState('unsaved');
    const timer = setTimeout(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState('saving');
      let result: SaveResult;
      try {
        result = await saveOrgFile(text, saved.version);
      } catch {
        inFlight.current = false;
        setState('error');
        setTimeout(() => setAttempt((n) => n + 1), RETRY_DELAY_MS);
        return;
      }
      inFlight.current = false;
      if (result.ok) {
        setSaved({ text, version: result.version });
        setState('saved');
      } else {
        setState('conflict');
        conflictHandler.current(result.disk);
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, saved, dirty, attempt]);

  return { state, dirty, saved, setSaved, setState };
}
