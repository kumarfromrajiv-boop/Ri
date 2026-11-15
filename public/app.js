const $ = id => document.getElementById(id);
let currentJob = null;
let currentPage = 'welcome';
let refreshTimer;
let capRequest = 0;
let historyRequest = 0;
const labels = { queued: 'प्रतीक्षा में', running: 'काम चल रहा है', blocked: 'सेटअप की प्रतीक्षा', completed: 'पूरा हुआ', failed: 'प्रक्रिया रुकी' };
async function api(path, options) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'सर्वर से कनेक्शन नहीं हो पाया।');
  return data;
}
function go(page, id) {
  location.hash = page === 'progress' && id ? `progress/${id}` : page;
}
function route() {
  const [page, id] = location.hash.slice(1).split('/');
  currentPage = ['task', 'progress'].includes(page) ? page : 'welcome';
  clearTimeout(refreshTimer);
  document.querySelectorAll('.page').forEach(el => el.classList.toggle('hidden', el.id !== currentPage));
  document.querySelectorAll('[data-step]').forEach(el => {
    el.classList.toggle('active', el.dataset.step === currentPage);
    if (el.dataset.step === currentPage) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    if (el.dataset.step === 'progress') el.disabled = !currentJob && !id;
  });
  if (currentPage === 'task') checkCapabilities();
  if (currentPage === 'progress') {
    currentJob = id || currentJob;
    if (currentJob) loadJob();
    else go('task');
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
async function checkCapabilities() {
  const request = ++capRequest;
  const runtime = document.querySelector('[name=runtime]:checked').value;
  const box = $('availability');
  box.textContent = 'सर्वर पर उपलब्धता जाँची जा रही है…';
  box.classList.remove('available');
  $('check-runtime').disabled = true;
  try {
    const caps = await api('/api/capabilities');
    if (request !== capRequest) return;
    const available = caps[runtime];
    $('ai-connection').textContent = caps.ai ? 'API key कॉन्फ़िगर है। मॉडल की पुष्टि काम शुरू होने पर होती है।' : 'AI की API key अभी कॉन्फ़िगर नहीं है।';
    box.classList.toggle('available', available);
    const name = runtime === 'apk' ? 'APK / Android' : 'Playwright Firefox';
    box.textContent = available ? `हाँ, ${name} सर्वर पर उपलब्ध है।${caps.ai ? '' : ' AI कनेक्शन अभी जुड़ा नहीं है।'}` : `${name} अभी सर्वर पर उपलब्ध नहीं है। ${runtime === 'apk' ? 'APK चलाने के लिए Android रनटाइम जोड़ना आवश्यक है।' : 'Firefox चलाने के लिए Playwright worker जोड़ना आवश्यक है।'}`;
    $('server-state').textContent = caps.firefox || caps.apk ? 'ब्राउज़र सर्वर जुड़ा है' : 'ब्राउज़र सेटअप बाकी है';
  } catch {
    if (request !== capRequest) return;
    box.textContent = 'उपलब्धता की जाँच नहीं हो पाई। दोबारा जाँचें।';
    $('server-state').textContent = 'कनेक्शन नहीं हो पाया';
    $('ai-connection').textContent = 'AI कॉन्फ़िगरेशन की जाँच नहीं हो पाई।';
  } finally { if (request === capRequest) $('check-runtime').disabled = false; }
}
$('start-button').onclick = () => go('task');
$('back-button').onclick = () => go('welcome');
$('new-task').onclick = () => go('task');
$('refresh-job').onclick = () => loadJob();
$('check-runtime').onclick = checkCapabilities;
document.querySelectorAll('[data-step]').forEach(el => el.onclick = () => go(el.dataset.step, currentJob));
document.querySelectorAll('[name=runtime]').forEach(el => el.addEventListener('change', () => {
  document.querySelectorAll('.runtime-card').forEach(card => card.classList.toggle('selected', card.querySelector('input').checked));
  checkCapabilities();
}));
$('instruction').addEventListener('input', () => { $('char-count').textContent = `${$('instruction').value.length} / 4000`; });
document.querySelectorAll('[data-example]').forEach(el => el.onclick = () => {
  $('instruction').value = el.dataset.example === 'information' ? 'इस वेबसाइट पर उपलब्ध कोर्स की जानकारी, अवधि और फीस ढूँढकर एक सूची तैयार करें।' : 'इस वेबसाइट पर उपलब्ध उत्पादों की कीमत और सुविधाओं की तुलना करके एक सारांश तैयार करें।';
  $('instruction').dispatchEvent(new Event('input'));
  $('instruction').focus();
});
$('task-form').addEventListener('submit', async event => {
  event.preventDefault();
  const error = $('form-error');
  error.classList.add('hidden');
  const button = $('submit-button');
  button.disabled = true;
  button.textContent = 'अनुरोध सुरक्षित हो रहा है…';
  try {
    const job = await api('/api/jobs', { method: 'POST', body: JSON.stringify({ url: $('url').value.trim(), instruction: $('instruction').value.trim(), runtime: document.querySelector('[name=runtime]:checked').value }) });
    currentJob = job.id;
    go('progress', job.id);
  } catch (err) { error.textContent = err.message; error.classList.remove('hidden'); }
  finally { button.disabled = false; button.replaceChildren(document.createTextNode('आगे बढ़ें ')); const arrow = document.createElement('span'); arrow.textContent = '→'; button.append(arrow); }
});
async function loadJob() {
  clearTimeout(refreshTimer);
  const requestedJob = currentJob;
  if (!requestedJob) return;
  $('refresh-job').disabled = true;
  $('job-error').classList.add('hidden');
  try {
    const job = await api(`/api/jobs/${encodeURIComponent(requestedJob)}`);
    if (currentJob !== requestedJob || currentPage !== 'progress') return;
    $('progress-title').textContent = job.status === 'completed' ? 'आपका काम पूरा हुआ।' : job.status === 'blocked' ? 'अनुरोध सुरक्षित है।' : job.status === 'failed' ? 'काम की प्रक्रिया रुकी।' : 'आपके काम की प्रगति';
    $('progress-subtitle').textContent = ['queued', 'running'].includes(job.status) ? 'काम सर्वर पर चल रहा है। अपडेट अपने आप यहाँ दिखाई देते हैं।' : job.status === 'blocked' ? 'ज़रूरी कनेक्शन उपलब्ध होने पर नया अनुरोध भेजें।' : 'काम का रिकॉर्ड और अंतिम अपडेट नीचे देखें।';
    $('status-label').textContent = labels[job.status] || job.status;
    $('status-symbol').textContent = job.status === 'completed' ? '✓' : job.status === 'blocked' || job.status === 'failed' ? '!' : '◷';
    $('status-message').textContent = job.message;
    $('job-host').textContent = new URL(job.url).hostname;
    $('job-runtime').textContent = job.runtime === 'apk' ? 'Android APK' : 'Firefox · Playwright';
    $('job-time').textContent = new Intl.DateTimeFormat('hi-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(job.created_at));
    $('job-instruction').textContent = job.instruction;
    const phases = [
      ['अनुरोध सुरक्षित हुआ', 'वेबसाइट और आपके निर्देश मिल गए।'],
      ['AI की योजना', job.plan ? 'काम के चरण तैयार हैं।' : 'AI कनेक्शन और मॉडल की पुष्टि आवश्यक है।'],
      ['ब्राउज़र पर काम', job.status === 'completed' ? 'ब्राउज़र सर्वर ने प्रक्रिया पूरी की।' : 'उपलब्ध रनटाइम पर प्रक्रिया चलेगी।'],
      ['परिणाम', job.status === 'completed' ? 'काम का परिणाम नीचे देखें।' : 'अभी काम पूरा होने की पुष्टि नहीं है।']
    ];
    const done = job.status === 'completed' ? 4 : job.plan ? 2 : 1;
    $('job-timeline').replaceChildren();
    phases.forEach(([title, detail], index) => {
      const row = document.createElement('div');
      row.className = `timeline-row ${index < done ? 'done' : index === done ? 'current' : ''}`;
      const icon = document.createElement('span'); icon.textContent = index < done ? '✓' : String(index + 1);
      const content = document.createElement('div');
      const heading = document.createElement('strong'); heading.textContent = title;
      const description = document.createElement('p'); description.textContent = detail;
      content.append(heading, description); row.append(icon, content); $('job-timeline').append(row);
    });
    for (const field of ['plan', 'result']) {
      const el = $(`job-${field}`); el.classList.toggle('hidden', !job[field]); el.querySelector('pre').textContent = job[field] || '';
    }
    if (['queued', 'running'].includes(job.status)) refreshTimer = setTimeout(loadJob, 5000);
  } catch (err) {
    if (currentJob !== requestedJob || currentPage !== 'progress') return;
    $('progress-title').textContent = 'स्थिति नहीं मिल पाई';
    $('progress-subtitle').textContent = 'अपडेट देखने के लिए फिर कोशिश करें।';
    $('status-label').textContent = 'कनेक्शन त्रुटि';
    $('status-message').textContent = 'सर्वर से स्थिति नहीं मिल पाई।';
    $('job-timeline').replaceChildren();
    $('job-plan').classList.add('hidden'); $('job-result').classList.add('hidden');
    $('job-host').textContent = '—'; $('job-runtime').textContent = '—'; $('job-time').textContent = '—'; $('job-instruction').textContent = '—';
    $('job-error').textContent = err.message; $('job-error').classList.remove('hidden');
  } finally { $('refresh-job').disabled = false; }
}
$('guide-button').onclick = () => $('guide-dialog').showModal();
document.querySelectorAll('.close-dialog').forEach(el => el.onclick = () => el.closest('dialog').close());
document.querySelectorAll('dialog').forEach(el => el.addEventListener('click', event => { if (event.target === el) { const rect = el.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) el.close(); } }));
$('history-button').onclick = async () => {
  const request = ++historyRequest;
  $('history-dialog').showModal();
  const list = $('history-list'); list.textContent = 'अनुरोध लोड हो रहे हैं…';
  try {
    const jobs = await api('/api/jobs');
    if (request !== historyRequest) return;
    list.replaceChildren();
    if (!jobs.length) { list.className = 'history-empty'; list.textContent = 'अभी कोई अनुरोध नहीं है। “अपना काम शुरू करें” से पहला अनुरोध जोड़ें।'; return; }
    list.className = '';
    jobs.forEach(job => {
      const el = document.createElement('button'); el.className = 'history-entry';
      const title = document.createElement('strong'); title.textContent = new URL(job.url).hostname;
      const detail = document.createElement('small'); detail.textContent = `${labels[job.status] || job.status} · ${new Date(job.created_at).toLocaleDateString('hi-IN')}`;
      el.append(title, detail); el.onclick = () => { $('history-dialog').close(); go('progress', job.id); }; list.append(el);
    });
  } catch (err) { list.textContent = err.message; list.className = 'error'; }
};
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden && currentPage === 'progress') loadJob(); });
checkCapabilities(); route();
