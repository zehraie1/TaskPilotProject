// Deletes tasks created by the headed demo (titles starting with "TPW-DEMO-"). Only those — nothing else.
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const api = (process.env.API_BASE_URL ?? 'https://taskpilot-api-k11v.onrender.com').replace(/\/+$/, '');
const res = await fetch(`${api}/api/v1/tasks?search=TPW-DEMO-&limit=100`);
const { items } = await res.json();
const demo = items.filter((t) => t.title.startsWith('TPW-DEMO-'));
for (const t of demo) {
  const del = await fetch(`${api}/api/v1/tasks/${t.id}`, { method: 'DELETE' });
  console.log(`${del.status} ${t.title}`);
}
console.log(`Removed ${demo.length} demo task(s).`);
