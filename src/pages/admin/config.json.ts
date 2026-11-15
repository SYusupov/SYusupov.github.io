import type { APIRoute } from 'astro';
import { buildCmsConfig } from '../../admin/config';

// Built into dist/admin/config.json. CMS_BACKEND=test keeps the admin in the browser (checks
// without GitHub); CMS_BRANCH points it at another branch, e.g. `redesign` before the release.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      buildCmsConfig({
        backend: process.env.CMS_BACKEND === 'test' ? 'test' : 'github',
        branch: process.env.CMS_BRANCH || undefined,
      }),
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
