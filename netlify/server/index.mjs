import express from 'express';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { readFile } from 'node:fs/promises';
import { getStore } from '../../db/client.mjs';
import { capabilities } from './runtime.mjs';
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
const store = getStore;
const validId = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.method === 'POST' && (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host))) return res.status(403).json({ error: 'यह अनुरोध वेबसाइट से भेजें।' });
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('kaarya_session='))?.slice(15);
  req.owner = validId(cookie) ? cookie : randomUUID();
  if (!validId(cookie)) res.cookie('kaarya_session', req.owner, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 31536000000, path: '/' });
  next();
});
const expire = async () => { await store().sql`UPDATE jobs SET status = 'failed', message = 'समय सीमा पूरी हुई। काम पूरा होने की पुष्टि नहीं हुई; दोबारा चलाने से पहले वेबसाइट पर परिणाम जाँचें।', updated_at = NOW() WHERE status IN ('queued','running') AND created_at < NOW() - INTERVAL '16 minutes'`; };
app.get('/api/capabilities', async (req, res) => res.json(await capabilities()));
app.get('/api/jobs', async (req, res) => {
  await expire();
  const rows = await store().sql`SELECT id, url, runtime, status, message, created_at FROM jobs WHERE owner = ${req.owner} ORDER BY created_at DESC LIMIT 12`;
  res.json(rows);
});
app.get('/api/jobs/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'काम नहीं मिला।' });
  await expire();
  const [job] = await store().sql`SELECT id, url, instruction, runtime, status, message, plan, result, created_at, updated_at FROM jobs WHERE id = ${req.params.id} AND owner = ${req.owner}`;
  if (!job) return res.status(404).json({ error: 'इस ब्राउज़र में काम का रिकॉर्ड नहीं मिला। मूल ब्राउज़र से खोलें।' });
  res.json(job);
});
app.post('/api/jobs', async (req, res) => {
  const { runtime, instruction, url } = req.body || {};
  if (!['apk', 'firefox'].includes(runtime) || typeof instruction !== 'string' || !instruction.trim() || instruction.length > 4000 || typeof url !== 'string' || url.length > 2048) return res.status(400).json({ error: 'वेबसाइट और काम का सही विवरण लिखें।' });
  let target;
  try {
    target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw Error();
    const addresses = await lookup(target.hostname.replace(/^\[|\]$/g, ''), { all: true });
    if (!addresses.length || addresses.some(a => ipaddr.process(a.address).range() !== 'unicast')) throw Error();
  } catch { return res.status(400).json({ error: 'एक सार्वजनिक वेबसाइट का मान्य http या https URL डालें।' }); }
  await expire();
  const caps = await capabilities();
  const ready = caps[runtime] && caps.ai;
  const id = randomUUID();
  const nonce = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(nonce).digest('hex');
  const message = !caps[runtime] ? 'चुना हुआ ब्राउज़र सर्वर पर उपलब्ध नहीं है। अनुरोध सुरक्षित है, लेकिन काम शुरू नहीं हुआ है।' : !caps.ai ? 'AI कनेक्शन अभी कॉन्फ़िगर नहीं है। काम शुरू नहीं हुआ है।' : 'अनुरोध मिल गया। AI काम के चरण तैयार कर रहा है।';
  try {
    await store().sql`INSERT INTO jobs (id, owner, url, instruction, runtime, status, message, dispatch_hash) VALUES (${id}, ${req.owner}, ${target.href}, ${instruction.trim()}, ${runtime}, ${ready ? 'queued' : 'blocked'}, ${message}, ${ready ? hash : null})`;
  } catch (error) {
    if (error.code === '23505' || error.cause?.code === '23505') return res.status(409).json({ error: 'अभी किसी दूसरे अनुरोध पर काम चल रहा है। एक समय में एक ही काम हो सकता है। थोड़ी देर बाद कोशिश करें।' });
    throw error;
  }
  if (ready) {
    try {
      // Only this site's background function receives the one-use dispatch nonce.
      const origin = process.env.DEPLOY_PRIME_URL || process.env.URL;
      if (!origin) throw Error();
      const response = await fetch(new URL('/.netlify/functions/execute-background', origin), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, nonce }), signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (!response.ok) throw Error();
    } catch {
      await store().sql`UPDATE jobs SET status = 'failed', message = 'काम की प्रक्रिया शुरू नहीं हो पाई। फिर कोशिश करें।', updated_at = NOW() WHERE id = ${id} AND status = 'queued'`;
    }
  }
  res.status(201).json({ id });
});
app.get('/', async (req, res) => res.type('html').send(await readFile(new URL('../../public/index.html', import.meta.url), 'utf8')));
app.use('/api', (req, res) => res.status(404).json({ error: 'यह API उपलब्ध नहीं है।' }));
app.use((error, req, res, next) => { res.status(error.status === 413 ? 413 : 503).json({ error: 'सेवा से कनेक्शन नहीं हुआ। थोड़ी देर बाद दोबारा कोशिश करें।' }); });
export default app;
