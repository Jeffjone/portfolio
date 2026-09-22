// Local/test adapter for D1's prepared-statement API. Production uses Cloudflare D1.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function openDatabase(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec(readFileSync(new URL('./migrations/0001_signatures.sql',import.meta.url),'utf8'));
  function prepare(sql,values = []) {
    return {
      bind(...args) { return prepare(sql,args); },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { return { success: true, meta: sqlite.prepare(sql).run(...values) }; }
    };
  }
  return { prepare, close: () => sqlite.close(), sqlite };
}
