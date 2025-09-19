
let lastTerms = [];

const el = {
  tabPage: document.getElementById('tabPage'),
  tabPaste: document.getElementById('tabPaste'),
  pagePanel: document.getElementById('pagePanel'),
  pastePanel: document.getElementById('pastePanel'),
  analyzePage: document.getElementById('analyzePage'),
  highlightPage: document.getElementById('highlightPage'),
  clearHighlights: document.getElementById('clearHighlights'),
  analyzeText: document.getElementById('analyzeText'),
  pageStatus: document.getElementById('pageStatus'),
  jobInput: document.getElementById('jobInput'),
  seniority: document.getElementById('seniority'),
  location: document.getElementById('location'),
  riskScore: document.getElementById('riskScore'),
  riskTags: document.getElementById('riskTags'),
  salaryRange: document.getElementById('salaryRange'),
  salaryExplain: document.getElementById('salaryExplain')
};

el.tabPage.addEventListener('click', () => switchTab('page'));
el.tabPaste.addEventListener('click', () => switchTab('paste'));

function switchTab(which){
  const isPage = which === 'page';
  el.tabPage.classList.toggle('active', isPage);
  el.tabPaste.classList.toggle('active', !isPage);
  el.pagePanel.classList.toggle('active', isPage);
  el.pastePanel.classList.toggle('active', !isPage);
}

const BAD_WORDS = [
  {w: 'rockstar', tag: 'Buzzword "rockstar"', p: 12},
  {w: 'ninja', tag: 'Buzzword "ninja"', p: 12},
  {w: 'urgente', tag: 'Urgencia excesiva', p: 8},
  {w: 'autónom', tag: 'Exige autónomo', p: 10},
  {w: 'colaboración', tag: 'Colaboración (no salario fijo)', p: 14},
  {w: 'pago por éxito', tag: 'Pago por éxito', p: 16},
  {w: 'práctic', tag: 'Prácticas disfrazadas', p: 14},
  {w: 'de todo', tag: 'Funciones poco claras', p: 10},
  {w: 'exposición', tag: 'Promesas vagas', p: 6},
];

function analyze(raw, opts={}){
  const text = (raw || '').toLowerCase();
  const riskSignals = [];
  let risk = 0;

  BAD_WORDS.forEach(b => {
    if(text.includes(b.w)) { risk += b.p; riskSignals.push(b.tag); }
  });

  const salaryRegex = /(\d{2,3})\s?k|\b(\d{2,3}\s?\.?\d{0,3})\s?(?:€|eur|euros)\b/gi;
  const hasSalary = salaryRegex.test(text);
  if(!hasSalary) { risk += 18; riskSignals.push('Salario no especificado'); }

  const emailMatch = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g);
  if (emailMatch) {
    const badEmail = emailMatch.find(e => /gmail\.com|hotmail\.com|outlook\.com|yahoo\.com/i.test(e));
    if (badEmail) { risk += 10; riskSignals.push('Email genérico (' + badEmail + ')'); }
  }

  const detectedSeniority =
    /junior/.test(text) ? 'junior' :
    /senior|sr\./.test(text) ? 'senior' : 'mid';

  const detectedLocation =
    /madrid/.test(text) ? 'madrid' :
    /barcelona/.test(text) ? 'barcelona' :
    /remot/.test(text) ? 'remote-es' : 'other';

  risk = Math.max(0, Math.min(100, risk));

  const roleWeight =
    /ux|ui|product designer|diseñador/i.test(raw) ? 1.0 :
    /frontend|backend|fullstack/i.test(raw) ? 1.15 :
    /data|ml|ai/i.test(raw) ? 1.25 : 0.95;

  const senSel = (opts.seniority === 'auto' || !opts.seniority) ? detectedSeniority : opts.seniority;
  const locSel = (opts.location === 'auto' || !opts.location) ? detectedLocation : opts.location;

  const baseMap = { junior: [18000, 26000], mid: [26000, 38000], senior: [38000, 55000] };
  let [low, high] = baseMap[senSel] || [24000, 36000];

  if (locSel === 'madrid' || locSel === 'barcelona') { low *= 1.12; high *= 1.18; }
  if (locSel === 'remote-es') { low *= 1.05; high *= 1.08; }

  low *= roleWeight; high *= roleWeight;

  function round500(n){ return Math.round(n/500)*500; }
  low = round500(low); high = round500(high);

  el.riskScore.textContent = risk + '/100';
  el.riskScore.className = 'badge ' + (risk >= 70 ? 'danger' : (risk >= 40 ? 'warning' : ''));

  el.riskTags.innerHTML = '';
  riskSignals.slice(0, 12).forEach(t => {
    const li = document.createElement('li'); li.textContent = t; el.riskTags.appendChild(li);
  });

  el.salaryRange.textContent = `${low.toLocaleString('es-ES')}€ - ${high.toLocaleString('es-ES')}€ bruto/año`;
  el.salaryExplain.textContent = `Heurístico; basado en seniority "${senSel}", ubicación "${locSel}" y rol detectado.`;

  // Terms for highlighting
  lastTerms = BAD_WORDS.filter(b => text.includes(b.w)).map(b => b.w);
  if(!hasSalary) lastTerms.push('€', 'salario', 'retribución', 'compensación');
  if (emailMatch) lastTerms.push(...emailMatch.slice(0,3));
}

async function readActiveTabText(){
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  const resp = await chrome.tabs.sendMessage(tab.id, {type: 'GET_PAGE_TEXT'});
  return {tab, resp};
}

el.analyzePage.addEventListener('click', async () => {
  el.pageStatus.textContent = 'Leyendo la página...';
  try {
    const {tab, resp} = await readActiveTabText();
    if (!resp || !resp.text) {
      el.pageStatus.textContent = 'No pude leer el contenido. Prueba pegando el texto.';
      return;
    }
    el.pageStatus.textContent = 'Analizando...';
    analyze(resp.text, {seniority: 'auto', location: 'auto'});
    el.pageStatus.textContent = resp.url || 'Página analizada.';
  } catch(e){
    el.pageStatus.textContent = 'Error leyendo la página.';
  }
});

el.highlightPage.addEventListener('click', async () => {
  try{
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    await chrome.tabs.sendMessage(tab.id, {type: 'HIGHLIGHT', terms: lastTerms});
    el.pageStatus.textContent = `Resaltado (${lastTerms.length} término/s).`;
  }catch(e){
    el.pageStatus.textContent = 'No se pudo resaltar en esta página.';
  }
});

el.clearHighlights.addEventListener('click', async () => {
  try{
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    await chrome.tabs.sendMessage(tab.id, {type: 'CLEAR_HIGHLIGHT'});
    el.pageStatus.textContent = 'Resaltado eliminado.';
  }catch(e){
    el.pageStatus.textContent = 'No se pudo eliminar resaltado.';
  }
});

el.analyzeText.addEventListener('click', () => {
  const raw = el.jobInput.value.trim();
  if(!raw){ return; }
  analyze(raw, {seniority: el.seniority.value, location: el.location.value});
});
