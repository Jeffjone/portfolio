// API credentials are read only from the environment; they are never shipped to the site.
const base = process.env.SIGNDEX_API?.replace(/\/$/,'');
const token = process.env.SIGNDEX_ADMIN_TOKEN;
const [action = 'list',id] = process.argv.slice(2);
if (!base || !token) throw new Error('Set SIGNDEX_API and SIGNDEX_ADMIN_TOKEN in your terminal first.');
const url = new URL(base);
if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Use HTTPS for the deployed API.');
if (!['list','approve','reject','delete'].includes(action)) throw new Error('Usage: list | approve ID | reject ID | delete ID');
if (action !== 'list' && !/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('Supply the full signature ID.');
const response = await fetch(`${base}/admin/signatures${action === 'list' ? '' : '/' + id}`,{
  method:action === 'list' ? 'GET' : action === 'delete' ? 'DELETE' : 'PATCH',
  headers:{ Authorization:`Bearer ${token}`,'Content-Type':'application/json' },
  ...(['approve','reject'].includes(action) ? { body:JSON.stringify({ status:action === 'approve' ? 'approved' : 'rejected' }) } : {})
});
const data = await response.json();
if (!response.ok) throw new Error(data.error || `API returned ${response.status}`);
console.log(JSON.stringify(data,null,2));
