import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app.js';

// A single Express app instance is reused across invocations (kept warm between
// requests). On Vercel the Node runtime invokes this default export as the
// request handler for every route matched in vercel.json.
const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
