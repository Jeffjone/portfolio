// Local/test adapter for D1's prepared-statement API. Production uses Cloudflare D1.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
export function openDatabase(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys = ON');
  const migrations = new URL('./migrations/',import.meta.url);
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(name,migrations),'utf8'));
  function prepare(sql,values = []) {
    return {
      bind(...args) { return prepare(sql,args); },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      execute() { return { success: true, meta: sqlite.prepare(sql).run(...values) }; },
      async run() { return this.execute(); }
    };
  }
  async function batch(statements) {
    sqlite.exec('BEGIN');
    try { const results=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return results; }
    catch (error) { sqlite.exec('ROLLBACK');throw error; }
  }
  return { prepare, batch, close: () => sqlite.close(), sqlite };
}
