import ELK from 'elkjs/lib/elk-api.js';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import type { LayoutEngine } from '../core';

/** elkjs running in its own Web Worker, so layout never blocks typing. */
export const layoutEngine: LayoutEngine = new ELK({ workerUrl: elkWorkerUrl });
