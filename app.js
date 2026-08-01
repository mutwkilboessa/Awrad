/* ===================== تطبيق معاهدة - إدارة أوراد متعددة ===================== */

const STORAGE_KEY = 'muaahda_plans_v2';
const DAY_NAMES = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const COLORS = ['#1B7A5C','#2563EB','#EA580C','#7C3AED','#DC2626','#0891B2','#CA8A04'];
const ICONS = ['📖','🕌','🌙','✨','📝','🔄','🎯','📚'];

let plans = [];

function loadPlans() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    plans = raw ? JSON.parse(raw) : [];
  } catch(e) { plans = []; }
}
function savePlans() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}
function uid() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
}
function todayISO(d) {
  const dt = d || new Date();
  return dt.toISOString().slice(0,10);
}
function dateFromISO(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d);
}

/* ---------- تحويل طرق الإدخال إلى صفحات ---------- */
function resolveRange(method, params) {
  if (method === 'pages') {
    return { start: Number(params.startPage), end: Number(params.endPage) };
  }
  if (method === 'juz') {
    return { start: juzStartPage(Number(params.startJuz)), end: juzEndPage(Number(params.endJuz || params.startJuz)) };
  }
  if (method === 'hizb') {
    return { start: hizbStartPage(Number(params.startHizb)), end: hizbEndPage(Number(params.endHizb || params.startHizb)) };
  }
  if (method === 'rub') {
    return { start: rubStartPage(Number(params.startRub)), end: rubEndPage(Number(params.endRub || params.startRub)) };
  }
  if (method === 'surah') {
    const si = Number(params.startSurahIdx), ei = Number(params.endSurahIdx);
    return { start: SURAHS[si].start, end: surahEndPage(ei) };
  }
  if (method === 'mixed') {
    // بداية بصفحة، نهاية بسورة (أو العكس) - نعتمد الحقول المرسلة
    const start = params.mixedStartType === 'page' ? Number(params.mixedStartVal) : SURAHS[Number(params.mixedStartVal)].start;
    const end = params.mixedEndType === 'page' ? Number(params.mixedEndVal) : surahEndPage(Number(params.mixedEndVal));
    return { start, end };
  }
  return { start: 1, end: 1 };
}

function rangeLabel(plan) {
  return `صفحة ${plan.startPage} → ${plan.endPage}`;
}

/* ---------- توليد الجدول الزمني ---------- */
function getActiveDatesForPlan(plan, count) {
  // يرجع مصفوفة تواريخ (ISO) للأيام المفعّلة بدءًا من تاريخ الإنشاء
  const dates = [];
  let cursor = dateFromISO(plan.createdDate);
  let guard = 0;
  while (dates.length < count && guard < 3000) {
    const dow = cursor.getDay();
    if (plan.selectedDays.includes(dow)) {
      dates.push(todayISO(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return dates;
}

function buildSchedule(plan) {
  // يبني جدول {date: {startPage,endPage,label}}
  const totalPages = plan.endPage - plan.startPage + 1;
  const schedule = {};

  if (plan.distribution === 'manual' && Array.isArray(plan.manualAmounts) && plan.manualAmounts.length) {
    const dates = getActiveDatesForPlan(plan, plan.manualAmounts.length);
    let cursor = plan.startPage;
    dates.forEach((date, i) => {
      const amt = Math.max(1, Number(plan.manualAmounts[i]) || 1);
      const s = cursor;
      const e = Math.min(plan.endPage, cursor + amt - 1);
      schedule[date] = { startPage: s, endPage: e };
      cursor = e + 1;
    });
    return schedule;
  }

  // تلقائي: نوزع بالتساوي على عدد الأيام المحدد
  const durationDays = Math.max(1, Number(plan.durationDays) || 1);
  const dates = getActiveDatesForPlan(plan, durationDays);
  const perDay = totalPages / dates.length;
  let cursor = plan.startPage;
  dates.forEach((date, i) => {
    const isLast = i === dates.length - 1;
    const s = Math.round(cursor);
    let e = isLast ? plan.endPage : Math.round(plan.startPage + (i+1) * perDay) - 1;
    if (e < s) e = s;
    if (e > plan.endPage) e = plan.endPage;
    schedule[date] = { startPage: s, endPage: e };
    cursor = e + 1;
  });
  return schedule;
}

/* ---------- إعادة التوزيع الذكي ---------- */
function rebalancePlan(plan) {
  const today = todayISO();
  const schedule = buildSchedule(plan);
  const log = plan.dailyLog || {};

  // إيجاد الأيام الفائتة (تاريخها قبل اليوم ولم تُنجز)
  const missedDates = Object.keys(schedule).filter(d => d < today && !(log[d] && log[d].done));

  if (missedDates.length === 0 || plan.rebalanceMode === 'keep') {
    return; // لا تغيير
  }

  // إعادة التوزيع: نجمع الصفحات غير المنجزة ونعيد توزيعها على الأيام المتبقية (من اليوم فصاعدًا)
  let unfinishedStart = null;
  missedDates.sort().forEach(d => {
    if (unfinishedStart === null) unfinishedStart = schedule[d].startPage;
  });
  if (unfinishedStart === null) return;

  const remainingPages = plan.endPage - unfinishedStart + 1;
  if (remainingPages <= 0) return;

  // نحسب الأيام المتبقية بدءًا من اليوم حتى نهاية الخطة الأصلية
  const lastScheduledDate = Object.keys(schedule).sort().pop();
  const remainingDates = [];
  let cursor = dateFromISO(today);
  let guard = 0;
  while (guard < 3000) {
    const dow = cursor.getDay();
    const iso = todayISO(cursor);
    if (plan.selectedDays.includes(dow)) remainingDates.push(iso);
    if (iso >= lastScheduledDate && remainingDates.length > 0) break;
    cursor.setDate(cursor.getDate() + 1);
    guard++;
    if (guard > 2000) break;
  }
  if (remainingDates.length === 0) remainingDates.push(today);

  const perDay = remainingPages / remainingDates.length;
  let p = unfinishedStart;
  const newSchedule = {};
  // نحتفظ بالأيام المنجزة كما هي
  Object.keys(schedule).forEach(d => {
    if (d < today && log[d] && log[d].done) newSchedule[d] = schedule[d];
  });
  remainingDates.forEach((d, i) => {
    const isLast = i === remainingDates.length - 1;
    const s = Math.round(p);
    let e = isLast ? plan.endPage : Math.round(unfinishedStart + (i+1)*perDay) - 1;
    if (e < s) e = s;
    newSchedule[d] = { startPage: s, endPage: e };
    p = e + 1;
  });
  plan.cachedSchedule = newSchedule;
  plan.lastRebalanced = today;
}

function getPlanSchedule(plan) {
  if (plan.cachedSchedule) return plan.cachedSchedule;
  return buildSchedule(plan);
}

/* ---------- تقدّم الخطة ---------- */
function planProgress(plan) {
  const total = plan.endPage - plan.startPage + 1;
  const log = plan.dailyLog || {};
  const schedule = getPlanSchedule(plan);
  let doneePages = 0;
  Object.keys(schedule).forEach(d => {
    if (log[d] && log[d].done) {
      doneePages += (schedule[d].endPage - schedule[d].startPage + 1);
    }
  });
  const pct = total > 0 ? Math.min(100, Math.round((doneePages/total)*100)) : 0;
  return { doneePages, total, pct };
}

/* ===================== واجهة المستخدم ===================== */
const app = document.getElementById('app');
let currentTab = 'today';

function render() {
  plans.forEach(rebalanceIfNeeded);
  if (currentTab === 'today') renderToday();
  else if (currentTab === 'plans') renderPlans();
  else if (currentTab === 'new') renderNewPlan();
  renderNav();
}

function rebalanceIfNeeded(plan) {
  const today = todayISO();
  if (plan.lastRebalanced !== today) {
    rebalancePlan(plan);
    savePlans();
  }
}

function renderNav() {
  document.querySelectorAll('.navbtn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === currentTab);
  });
}

function renderToday() {
  const today = todayISO();
  const todayDow = new Date().getDay();
  let html = `<div class="section-title">مهام اليوم</div>`;
  const activePlans = plans.filter(p => p.selectedDays.includes(todayDow));

  if (plans.length === 0) {
    html += `<div class="empty">لا توجد أوراد بعد. أضف وردًا جديدًا من زر "+".</div>`;
  } else if (activePlans.length === 0) {
    html += `<div class="empty">لا يوجد ورد مجدول لليوم 🌿</div>`;
  } else {
    activePlans.forEach(plan => {
      const schedule = getPlanSchedule(plan);
      const task = schedule[today];
      const log = plan.dailyLog && plan.dailyLog[today];
      const done = log && log.done;
      if (!task) return;
      const pages = task.endPage - task.startPage + 1;
      const est = Math.max(1, Math.round(pages * 2)); // تقدير دقيقتين لكل صفحة تقريبًا
      html += `
      <div class="task-card" style="border-right:5px solid ${plan.color}">
        <div class="task-top">
          <label class="task-check">
            <input type="checkbox" ${done ? 'checked':''} onchange="toggleDone('${plan.id}','${today}',this.checked)">
            <span class="task-name">${plan.icon} ${plan.name}</span>
          </label>
        </div>
        <div class="task-range">صفحة ${task.startPage} ${task.endPage>task.startPage?'→ '+task.endPage:''}</div>
        <div class="task-meta">⏱️ ~${est} دقيقة &nbsp;•&nbsp; ${pages} صفحة</div>
        <textarea class="task-note" placeholder="ملاحظة..." onchange="saveNote('${plan.id}','${today}',this.value)">${(log && log.note) || ''}</textarea>
      </div>`;
    });
  }
  app.innerHTML = wrapPage(html);
}

function toggleDone(planId, date, checked) {
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  plan.dailyLog = plan.dailyLog || {};
  plan.dailyLog[date] = plan.dailyLog[date] || {};
  plan.dailyLog[date].done = checked;
  savePlans();
  render();
}
function saveNote(planId, date, note) {
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  plan.dailyLog = plan.dailyLog || {};
  plan.dailyLog[date] = plan.dailyLog[date] || {};
  plan.dailyLog[date].note = note;
  savePlans();
}

function renderPlans() {
  let html = `<div class="section-title">الأوراد</div>`;
  if (plans.length === 0) {
    html += `<div class="empty">لا توجد أوراد بعد.</div>`;
  }
  plans.forEach(plan => {
    const prog = planProgress(plan);
    const daysLabel = plan.selectedDays.length === 7 ? 'كل يوم' : plan.selectedDays.map(d=>DAY_NAMES[d]).join('، ');
    html += `
    <div class="plan-card">
      <div class="plan-head" style="border-right:5px solid ${plan.color}">
        <div class="plan-title">${plan.icon} ${plan.name}</div>
        <button class="icon-btn" onclick="deletePlan('${plan.id}')">🗑️</button>
      </div>
      <div class="plan-range">${rangeLabel(plan)}</div>
      <div class="plan-days">📅 ${daysLabel}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${prog.pct}%;background:${plan.color}"></div></div>
      <div class="progress-label">${prog.pct}% (${prog.doneePages}/${prog.total} صفحة)</div>
      <div class="plan-mode">${plan.distribution === 'auto' ? 'توزيع تلقائي' : 'توزيع يدوي'} • ${plan.rebalanceMode==='redistribute' ? 'إعادة توزيع عند التفويت':'يحافظ على الجدول الأصلي'}</div>
    </div>`;
  });
  app.innerHTML = wrapPage(html);
}

function deletePlan(id) {
  if (!confirm('حذف هذا الورد؟')) return;
  plans = plans.filter(p => p.id !== id);
  savePlans();
  render();
}

/* ---------- نموذج إنشاء ورد جديد ---------- */
let newPlanState = defaultNewPlan();
function defaultNewPlan() {
  return {
    name: '', color: COLORS[0], icon: ICONS[0],
    method: 'pages',
    startPage: 1, endPage: 20,
    startJuz: 1, endJuz: 1,
    startHizb: 1, endHizb: 1,
    startRub: 1, endRub: 1,
    startSurahIdx: 0, endSurahIdx: 0,
    mixedStartType: 'page', mixedStartVal: 1,
    mixedEndType: 'surah', mixedEndVal: 18,
    distribution: 'auto',
    durationDays: 10,
    manualAmounts: [],
    selectedDays: [0,1,2,3,4,5,6],
    rebalanceMode: 'redistribute'
  };
}

function renderNewPlan() {
  const s = newPlanState;
  let surahOptions = SURAHS.map((sur,i)=>`<option value="${i}" ${i===s.startSurahIdx?'selected':''}>${sur.name}</option>`).join('');
  let surahOptionsEnd = SURAHS.map((sur,i)=>`<option value="${i}" ${i===s.endSurahIdx?'selected':''}>${sur.name}</option>`).join('');

  let methodFields = '';
  if (s.method === 'pages') {
    methodFields = `
      <div class="row2">
        <div><label>من صفحة</label><input type="number" min="1" max="604" value="${s.startPage}" oninput="updateField('startPage',this.value,true)"></div>
        <div><label>إلى صفحة</label><input type="number" min="1" max="604" value="${s.endPage}" oninput="updateField('endPage',this.value,true)"></div>
      </div>`;
  } else if (s.method === 'juz') {
    methodFields = `
      <div class="row2">
        <div><label>من جزء</label><input type="number" min="1" max="30" value="${s.startJuz}" oninput="updateField('startJuz',this.value,true)"></div>
        <div><label>إلى جزء</label><input type="number" min="1" max="30" value="${s.endJuz}" oninput="updateField('endJuz',this.value,true)"></div>
      </div>`;
  } else if (s.method === 'hizb') {
    methodFields = `
      <div class="row2">
        <div><label>من حزب</label><input type="number" min="1" max="60" value="${s.startHizb}" oninput="updateField('startHizb',this.value,true)"></div>
        <div><label>إلى حزب</label><input type="number" min="1" max="60" value="${s.endHizb}" oninput="updateField('endHizb',this.value,true)"></div>
      </div>`;
  } else if (s.method === 'rub') {
    methodFields = `
      <div class="row2">
        <div><label>من ربع</label><input type="number" min="1" max="240" value="${s.startRub}" oninput="updateField('startRub',this.value,true)"></div>
        <div><label>إلى ربع</label><input type="number" min="1" max="240" value="${s.endRub}" oninput="updateField('endRub',this.value,true)"></div>
      </div>`;
  } else if (s.method === 'surah') {
    methodFields = `
      <div class="row2">
        <div><label>من سورة</label><select onchange="updateField('startSurahIdx',this.value,true)">${surahOptions}</select></div>
        <div><label>إلى سورة</label><select onchange="updateField('endSurahIdx',this.value,true)">${surahOptionsEnd}</select></div>
      </div>`;
  } else if (s.method === 'mixed') {
    methodFields = `
      <div class="row2">
        <div><label>البداية</label>
          <select onchange="updateField('mixedStartType',this.value,true)">
            <option value="page" ${s.mixedStartType==='page'?'selected':''}>صفحة</option>
            <option value="surah" ${s.mixedStartType==='surah'?'selected':''}>سورة</option>
          </select>
          ${s.mixedStartType==='page'
            ? `<input type="number" min="1" max="604" value="${s.mixedStartVal}" oninput="updateField('mixedStartVal',this.value,true)">`
            : `<select onchange="updateField('mixedStartVal',this.value,true)">${SURAHS.map((sur,i)=>`<option value="${i}">${sur.name}</option>`).join('')}</select>`}
        </div>
        <div><label>النهاية</label>
          <select onchange="updateField('mixedEndType',this.value,true)">
            <option value="page" ${s.mixedEndType==='page'?'selected':''}>صفحة</option>
            <option value="surah" ${s.mixedEndType==='surah'?'selected':''}>سورة</option>
          </select>
          ${s.mixedEndType==='page'
            ? `<input type="number" min="1" max="604" value="${s.mixedEndVal}" oninput="updateField('mixedEndVal',this.value,true)">`
            : `<select onchange="updateField('mixedEndVal',this.value,true)">${SURAHS.map((sur,i)=>`<option value="${i}" ${i===s.mixedEndVal?'selected':''}>${sur.name}</option>`).join('')}</select>`}
        </div>
      </div>`;
  }

  const range = resolveRange(s.method, s);
  const totalPages = Math.max(1, range.end - range.start + 1);

  let manualFields = '';
  if (s.distribution === 'manual') {
    manualFields = `
      <label>الكمية اليومية (صفحات) — افصل بينها بفاصلة</label>
      <input type="text" placeholder="مثال: 3,3,4,3,3" value="${s.manualAmounts.join(',')}" oninput="updateManualAmounts(this.value)">
      <div class="hint">سيتم توزيعها بالترتيب على الأيام المختارة بدءًا من اليوم</div>`;
  } else {
    manualFields = `
      <label>عدد الأيام</label>
      <input type="number" min="1" value="${s.durationDays}" oninput="updateField('durationDays',this.value)">
      <div class="hint">إجمالي الصفحات: ${totalPages} • تقريبًا ${(totalPages/Math.max(1,s.durationDays)).toFixed(1)} صفحة/يوم</div>`;
  }

  const daysBtns = DAY_NAMES.map((d,i) => `
    <button type="button" class="daychip ${s.selectedDays.includes(i)?'on':''}" onclick="toggleDay(${i})">${d}</button>
  `).join('');

  const colorBtns = COLORS.map(c => `<button type="button" class="colordot ${s.color===c?'sel':''}" style="background:${c}" onclick="updateField('color','${c}',true)"></button>`).join('');
  const iconBtns = ICONS.map(ic => `<button type="button" class="iconbtn ${s.icon===ic?'sel':''}" onclick="updateField('icon','${ic}',true)">${ic}</button>`).join('');

  const html = `
  <div class="section-title">ورد جديد</div>
  <label>اسم الورد</label>
  <input type="text" placeholder="مثال: المراجعة اليومية" value="${s.name}" oninput="updateField('name',this.value)">

  <label>اللون</label>
  <div class="chips-row">${colorBtns}</div>

  <label>الأيقونة</label>
  <div class="chips-row">${iconBtns}</div>

  <label>طريقة تحديد الورد</label>
  <select onchange="updateField('method',this.value,true)">
    <option value="pages" ${s.method==='pages'?'selected':''}>بالصفحات</option>
    <option value="rub" ${s.method==='rub'?'selected':''}>بالربع</option>
    <option value="hizb" ${s.method==='hizb'?'selected':''}>بالحزب</option>
    <option value="juz" ${s.method==='juz'?'selected':''}>بالجزء</option>
    <option value="surah" ${s.method==='surah'?'selected':''}>بالسور</option>
    <option value="mixed" ${s.method==='mixed'?'selected':''}>مختلط (صفحة/سورة)</option>
  </select>
  ${methodFields}
  <div class="hint">📄 النطاق المحسوب: صفحة ${range.start} → ${range.end} (${totalPages} صفحة)</div>

  <label>طريقة التوزيع</label>
  <div class="segmented">
    <button type="button" class="${s.distribution==='auto'?'on':''}" onclick="updateField('distribution','auto',true)">تلقائي</button>
    <button type="button" class="${s.distribution==='manual'?'on':''}" onclick="updateField('distribution','manual',true)">يدوي</button>
  </div>
  ${manualFields}

  <label>الأيام المختارة</label>
  <div class="chips-row">${daysBtns}</div>

  <label>عند تفويت يوم</label>
  <div class="segmented">
    <button type="button" class="${s.rebalanceMode==='redistribute'?'on':''}" onclick="updateField('rebalanceMode','redistribute',true)">إعادة توزيع الباقي</button>
    <button type="button" class="${s.rebalanceMode==='keep'?'on':''}" onclick="updateField('rebalanceMode','keep',true)">الإبقاء على الجدول</button>
  </div>

  <button class="primary-btn" onclick="createPlan()">➕ إضافة الورد</button>
  `;
  app.innerHTML = wrapPage(html);
}

function updateField(key, val, rerender) {
  newPlanState[key] = isNaN(val) || val === '' ? val : (typeof newPlanState[key] === 'number' ? Number(val) : val);
  if (['startPage','endPage','startJuz','endJuz','startHizb','endHizb','startRub','endRub','durationDays','startSurahIdx','endSurahIdx','mixedStartVal','mixedEndVal'].includes(key)) {
    newPlanState[key] = Number(val);
  }
  if (rerender) renderNewPlan();
}
function updateManualAmounts(str) {
  newPlanState.manualAmounts = str.split(',').map(x=>x.trim()).filter(x=>x!=='').map(Number);
}
function toggleDay(i) {
  const idx = newPlanState.selectedDays.indexOf(i);
  if (idx >= 0) newPlanState.selectedDays.splice(idx,1);
  else newPlanState.selectedDays.push(i);
  renderNewPlan();
}

function createPlan() {
  const s = newPlanState;
  if (!s.name.trim()) { alert('يرجى إدخال اسم للورد'); return; }
  if (s.selectedDays.length === 0) { alert('يرجى اختيار يوم واحد على الأقل'); return; }
  const range = resolveRange(s.method, s);
  if (range.end < range.start) { alert('النطاق غير صحيح'); return; }

  const plan = {
    id: uid(),
    name: s.name.trim(),
    color: s.color,
    icon: s.icon,
    method: s.method,
    startPage: range.start,
    endPage: range.end,
    distribution: s.distribution,
    durationDays: s.durationDays,
    manualAmounts: s.distribution === 'manual' ? s.manualAmounts.slice() : [],
    selectedDays: s.selectedDays.slice(),
    rebalanceMode: s.rebalanceMode,
    createdDate: todayISO(),
    dailyLog: {},
    cachedSchedule: null,
    lastRebalanced: null
  };
  plans.push(plan);
  savePlans();
  newPlanState = defaultNewPlan();
  currentTab = 'today';
  render();
}

function wrapPage(innerHtml) {
  return `<div class="page">${innerHtml}</div>`;
}

/* ---------- تبديل التبويبات ---------- */
document.querySelectorAll('.navbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTab = btn.dataset.tab;
    render();
  });
});

/* ---------- تسجيل service worker (PWA) ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  });
}

/* ---------- زر التثبيت على الهاتف ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.classList.remove('hidden');
});
function triggerInstall() {
  const btn = document.getElementById('installBtn');
  if (!deferredPrompt) {
    alert('لتثبيت التطبيق: افتح قائمة المتصفح (⋮) ثم اختر "إضافة إلى الشاشة الرئيسية".');
    return;
  }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    if (btn) btn.classList.add('hidden');
  });
}
window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('installBtn');
  if (btn) btn.classList.add('hidden');
});

/* ---------- تشغيل ---------- */
loadPlans();
render();
