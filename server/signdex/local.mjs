import http from 'node:http';
import { mkdir,readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import worker from './worker.mjs';
import { openDatabase } from './sqlite-adapter.mjs';
const root = path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.pdf':'application/pdf' };
export async function startLocalServer({ port = 8788, database = ':memory:' } = {}) {
  const DB = openDatabase(database);
  let origin;
  const env = { DB, ENVIRONMENT:'development', RATE_LIMIT_SALT:'signdex-local-development-only', ADMIN_TOKEN:process.env.SIGNDEX_ADMIN_TOKEN || 'local-review-only' };
  const server = http.createServer(async (req,res) => {
    try {
      const url = new URL(req.url,origin);
      if (url.pathname.startsWith('/signdex-api/')) {
        const headers = new Headers();
        for (const [key,value] of Object.entries(req.headers)) if (value) headers.set(key,Array.isArray(value) ? value.join(',') : value);
        // Local clients cannot spoof a production visitor IP.
        headers.delete('cf-connecting-ip');
        const request = new Request(origin + url.pathname.replace('/signdex-api','') + url.search,{ method:req.method, headers, ...(!['GET','HEAD'].includes(req.method) ? { body:Readable.toWeb(req), duplex:'half' } : {}) });
        const response = await worker.fetch(request,env);
        res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      if (url.pathname === '/assets/js/signdex-config.js') { res.writeHead(200,{ 'Content-Type':'text/javascript' });res.end("globalThis.SignDexConfig = { apiBase: '/signdex-api' };"); return; }
      // Only serve public site assets, never the local database or server configuration.
      if (!(url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/assets/'))) { res.writeHead(404).end(); return; }
      const filename = path.resolve(root,'.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!filename.startsWith(root + path.sep) || (url.pathname.startsWith('/assets/') && !filename.startsWith(path.join(root,'assets') + path.sep))) { res.writeHead(403).end(); return; }
      const body = await readFile(filename);res.writeHead(200,{ 'Content-Type':types[path.extname(filename)] || 'application/octet-stream' });res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(port,'127.0.0.1',resolve));
  origin = `http://127.0.0.1:${server.address().port}`; env.ALLOWED_ORIGINS = origin;
  return { origin, DB, env, close: () => new Promise(resolve => server.close(() => { DB.close(); resolve(); })) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await mkdir(path.join(root,'.signdex-data'),{ recursive:true });
  const service = await startLocalServer({ database:path.join(root,'.signdex-data/local.sqlite') });
  console.log(`Portfolio + shared local SignDex: ${service.origin}/#signdex\nLocal review token: use SIGNDEX_ADMIN_TOKEN, or the documented local-review-only default.`);
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async () => { await service.close(); process.exit(0); });
}
