
(function(){
  const sample = `Buscamos UX/UI para equipo de producto ✨
Contrato indefinido, salario competitivo. Imprescindible portfolio.
Tareas: investigación, diseño de interfaces, colaboración con desarrollo.
Email: talent@empresa.com
Ubicación: Madrid o remoto en España.`;

  const el = {
    input: document.getElementById('jobInput'),
    seniority: document.getElementById('seniority'),
    location: document.getElementById('location'),
    analyze: document.getElementById('analyzeBtn'),
    clear: document.getElementById('clearBtn'),
    riskScore: document.getElementById('riskScore'),
    riskTags: document.getElementById('riskTags'),
    salaryRange: document.getElementById('salaryRange'),
    salaryExplain: document.getElementById('salaryExplain'),
    detail: document.getElementById('detail'),
  };

  if(!el.input.value.trim()) el.input.value = sample;

  function analyze() {
    const raw = el.input.value.trim();
    const text = raw.toLowerCase();

    const riskSignals = [];
    let risk = 0;

    const isURL = /^https?:\/\/\S+$/i.test(raw);

    const badWords = [
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
    badWords.forEach(b => {
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

    const senSel = el.seniority.value === 'auto' ? detectedSeniority : el.seniority.value;
    const locSel = el.location.value === 'auto' ? detectedLocation : el.location.value;

    const base = { junior: [18000, 26000], mid: [26000, 38000], senior: [38000, 55000] }[senSel] || [24000, 36000];
    let low = base[0], high = base[1];

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
    el.salaryExplain.textContent = `Estimación heurística basada en seniority "${senSel}", ubicación "${locSel}" y rol detectado. No sustituye a datos reales de mercado.`;

    const detail = {
      brand: 'Light',
      inputs: { detectedSeniority, detectedLocation, isURL },
      risk: { score: risk, signals: riskSignals },
      salary: { low, high, roleWeight, seniority: senSel, location: locSel }
    };
    el.detail.textContent = JSON.stringify(detail, null, 2);
  }

  function clearAll(){
    el.input.value = '';
    el.riskScore.textContent = '—'; el.riskScore.className = 'badge';
    el.riskTags.innerHTML = '';
    el.salaryRange.textContent = '—';
    el.salaryExplain.textContent = '';
    el.detail.textContent = '';
  }

  el.analyze.addEventListener('click', analyze);
  el.clear.addEventListener('click', clearAll);
})();
