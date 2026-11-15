export function workerConfig() {
  if (!process.env.BROWSER_WORKER_URL) return null;
  try {
    const url = new URL(process.env.BROWSER_WORKER_URL);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return { url: url.href.replace(/\/$/, ''), token: process.env.BROWSER_WORKER_TOKEN };
  } catch { return null; }
}
export async function capabilities() {
  const config = workerConfig();
  const base = { apk: false, firefox: false, ai: Boolean(process.env.AICREDITS_API_KEY), model: 'Anthropic: Claude Haiku 5.5', note: 'अभी ब्राउज़र रनटाइम जुड़ा नहीं है। APK के लिए Android रनटाइम और Firefox के लिए Playwright worker चाहिए।' };
  if (!config) return base;
  try {
    const response = await fetch(config.url + '/capabilities', { headers: config.token ? { Authorization: `Bearer ${config.token}` } : {}, signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) return { ...base, note: 'ब्राउज़र सर्वर से कनेक्शन नहीं हो पाया।' };
    const info = await response.json();
    return { ...base, apk: info.apk === true, firefox: info.firefox === true, note: 'ब्राउज़र सर्वर की उपलब्धता जाँची गई है।' };
  } catch { return { ...base, note: 'ब्राउज़र सर्वर अभी जवाब नहीं दे रहा है।' }; }
}
