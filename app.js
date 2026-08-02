/* ===================== تطبيق معاهدة - إدارة أوراد متعددة ===================== */

const STORAGE_KEY = 'muaahda_plans_v2';
// ترتيب الأيام يبدأ من السبت (متوافق مع تقويم الخليج)
// القيم تطابق JS Date.getDay(): 0=أحد ... 6=سبت
const DAY_NAMES = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const DAY_ORDER = [6,0,1,2,3,4,5]; // سبت، أحد، إثنين... جمعة
const COLORS = ['#1B7A5C','#2563EB','#EA580C','#7C3AED','#DC2626','#0891B2','#CA8A04'];
const NAV_RANGE_DAYS = 7; // مدى التنقل بين الأيام (أسبوع للخلف وللأمام)

let plans = [];
let viewedDate = todayISO(); // التاريخ المعروض حاليًا في تبويب "اليوم"
let clockTimer = null;

function loadPlans() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    plans = raw ? JSON.parse(raw) : [];
  } catch(e) { plans = []; }
  // ترقية الأيقونات القديمة (إيموجي) إلى معرفات SVG
  plans.forEach(p => {
    if (EMOJI_TO_ICON[p.icon]) p.icon = EMOJI_TO_ICON[p.icon];
    else if (!ICON_SVGS[p.icon]) p.icon = 'book';
  });
}
function savePlans() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}
function uid() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
}
function todayISO(d) {
  const dt = d || new Date();
  const y = dt.getFullYear(), m = String(dt.getMonth()+1).padStart(2,'0'), day = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function dateFromISO(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d);
}
function addDays(iso, delta) {
  const d = dateFromISO(iso);
  d.setDate(d.getDate() + delta);
  return todayISO(d);
}
function formatArabicDate(iso) {
  const d = dateFromISO(iso);
  try {
    return d.toLocaleDateString('ar-KW', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch(e) {
    return iso;
  }
}
function formatArabicTime() {
  try {
    return new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' });
  } catch(e) {
    return '';
  }
}
function sortDaysForDisplay(days) {
  return DAY_ORDER.filter(d => days.includes(d));
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

  const missedDates = Object.keys(schedule).filter(d => d < today && !(log[d] && log[d].done));

  if (missedDates.length === 0 || plan.rebalanceMode === 'keep') {
    return;
  }

  let unfinishedStart = null;
  missedDates.sort().forEach(d => {
    if (unfinishedStart === null) unfinishedStart = schedule[d].startPage;
  });
  if (unfinishedStart === null) return;

  const remainingPages = plan.endPage - unfinishedStart + 1;
  if (remainingPages <= 0) return;

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
  manageClock();
}

function manageClock() {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  if (currentTab === 'today' && viewedDate === todayISO()) {
    clockTimer = setInterval(() => {
      const el = document.getElementById('liveClock');
      if (el) el.textContent = formatArabicTime();
      else { clearInterval(clockTimer); clockTimer = null; }
    }, 20000);
  }
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

function navigateDay(delta) {
  const real = todayISO();
  const minIso = addDays(real, -NAV_RANGE_DAYS);
  const maxIso = addDays(real, NAV_RANGE_DAYS);
  const next = addDays(viewedDate, delta);
  if (next < minIso || next > maxIso) return;
  viewedDate = next;
  render();
}

function renderToday() {
  const real = todayISO();
  const isRealToday = viewedDate === real;
  const dow = dateFromISO(viewedDate).getDay();
  const minIso = addDays(real, -NAV_RANGE_DAYS);
  const maxIso = addDays(real, NAV_RANGE_DAYS);
  const atMin = viewedDate <= minIso;
  const atMax = viewedDate >= maxIso;

  let html = `
    <div class="daynav">
      <button class="daynav-btn" onclick="navigateDay(-1)" ${atMin?'disabled':''} aria-label="اليوم السابق">‹</button>
      <div class="daynav-center">
        <div class="daynav-label">${isRealToday ? 'اليوم' : DAY_NAMES[dow]}${isRealToday ? '' : ''}</div>
        <div class="daynav-date">${DAY_NAMES[dow]} • ${formatArabicDate(viewedDate)}</div>
        ${isRealToday ? `<div class="daynav-time" id="liveClock">${formatArabicTime()}</div>` : ''}
      </div>
      <button class="daynav-btn" onclick="navigateDay(1)" ${atMax?'disabled':''} aria-label="اليوم التالي">›</button>
    </div>
  `;

  const activePlans = plans.filter(p => p.selectedDays.includes(dow));
  let shownCount = 0;
  let doneCount = 0;

  if (plans.length === 0) {
    html += `<div class="empty">لا توجد أوراد بعد. أضف وردًا جديدًا من زر "+".</div>`;
  } else if (activePlans.length === 0) {
    html += `<div class="empty">لا يوجد ورد مجدول لهذا اليوم 🌿</div>`;
  } else {
    let cardsHtml = '';
    activePlans.forEach(plan => {
      const schedule = getPlanSchedule(plan);
      const task = schedule[viewedDate];
      const log = plan.dailyLog && plan.dailyLog[viewedDate];
      const done = log && log.done;
      if (!task) return;
      if (done) { doneCount++; return; } // المهام المنجزة تُحذف من العرض
      shownCount++;
      const pages = task.endPage - task.startPage + 1;
      const est = Math.max(1, Math.round(pages * 2));
      cardsHtml += `
      <div class="task-card" style="border-right:5px solid ${plan.color}">
        <div class="task-top">
          <label class="task-check">
            <input type="checkbox" onchange="toggleDone('${plan.id}','${viewedDate}',this.checked)">
            <span class="task-icon" style="color:${plan.color}">${iconSvg(plan.icon)}</span>
            <span class="task-name">${plan.name}</span>
          </label>
        </div>
        <div class="task-range">صفحة ${task.startPage} ${task.endPage>task.startPage?'→ '+task.endPage:''}</div>
        <div class="task-meta">⏱️ ~${est} دقيقة &nbsp;•&nbsp; ${pages} صفحة</div>
        <textarea class="task-note" placeholder="ملاحظة..." onchange="saveNote('${plan.id}','${viewedDate}',this.value)">${(log && log.note) || ''}</textarea>
      </div>`;
    });

    if (shownCount === 0) {
      html += `<div class="empty">✅ أكملت كل أوراد هذا اليوم${doneCount>0?' ('+doneCount+')':''} — أحسنت! 🎉</div>`;
    } else {
      html += cardsHtml;
      if (doneCount > 0) {
        html += `<div class="hint" style="text-align:center;margin-top:4px;">تم إنجاز ${doneCount} من ${doneCount+shownCount} مهام</div>`;
      }
    }
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
  if (checked) {
    // الانتقال المباشر لليوم التالي بعد إنجاز المهمة
    navigateDay(1);
  } else {
    render();
  }
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
    const daysLabel = plan.selectedDays.length === 7 ? 'كل يوم' : sortDaysForDisplay(plan.selectedDays).map(d=>DAY_NAMES[d]).join('، ');
    html += `
    <div class="plan-card">
      <div class="plan-head" style="border-right:5px solid ${plan.color}">
        <div class="plan-title"><span class="task-icon" style="color:${plan.color}">${iconSvg(plan.icon)}</span> ${plan.name}</div>
        <button class="icon-btn" onclick="deletePlan('${plan.id}')" aria-label="حذف">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/><path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13"/></svg>
        </button>
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
    name: '', color: COLORS[0], icon: ICON_IDS[0],
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

const METHOD_OPTIONS = [
  { id: 'pages', label: 'بالصفحات' },
  { id: 'rub', label: 'بالربع' },
  { id: 'hizb', label: 'بالحزب' },
  { id: 'juz', label: 'بالجزء' },
  { id: 'surah', label: 'بالسور' },
  { id: 'mixed', label: 'مختلط' }
];

function stepper(key, value, min, max) {
  return `
  <div class="stepper">
    <button type="button" class="step-btn" onclick="adjustField('${key}',-1,${min},${max})">−</button>
    <span class="step-val">${value}</span>
    <button type="button" class="step-btn" onclick="adjustField('${key}',1,${min},${max})">+</button>
  </div>`;
}

function adjustField(key, delta, min, max) {
  let v = (Number(newPlanState[key]) || 0) + delta;
  if (v < min) v = min;
  if (v > max) v = max;
  newPlanState[key] = v;
  renderNewPlan();
}

function renderNewPlan() {
  const s = newPlanState;
  let surahOptions = SURAHS.map((sur,i)=>`<option value="${i}" ${i===s.startSurahIdx?'selected':''}>${sur.name}</option>`).join('');
  let surahOptionsEnd = SURAHS.map((sur,i)=>`<option value="${i}" ${i===s.endSurahIdx?'selected':''}>${sur.name}</option>`).join('');

  let methodFields = '';
  let methodHelp = '';
  if (s.method === 'pages') {
    methodHelp = 'اختر رقم صفحة البداية والنهاية بالأزرار';
    methodFields = `
      <div class="row2">
        <div><label>من صفحة</label>${stepper('startPage', s.startPage, 1, 604)}</div>
        <div><label>إلى صفحة</label>${stepper('endPage', s.endPage, 1, 604)}</div>
      </div>`;
  } else if (s.method === 'juz') {
    methodHelp = 'اختر رقم الجزء من 1 إلى 30';
    methodFields = `
      <div class="row2">
        <div><label>من جزء</label>${stepper('startJuz', s.startJuz, 1, 30)}</div>
        <div><label>إلى جزء</label>${stepper('endJuz', s.endJuz, 1, 30)}</div>
      </div>`;
  } else if (s.method === 'hizb') {
    methodHelp = 'اختر رقم الحزب من 1 إلى 60';
    methodFields = `
      <div class="row2">
        <div><label>من حزب</label>${stepper('startHizb', s.startHizb, 1, 60)}</div>
        <div><label>إلى حزب</label>${stepper('endHizb', s.endHizb, 1, 60)}</div>
      </div>`;
  } else if (s.method === 'rub') {
    methodHelp = 'اختر رقم الربع من 1 إلى 240';
    methodFields = `
      <div class="row2">
        <div><label>من ربع</label>${stepper('startRub', s.startRub, 1, 240)}</div>
        <div><label>إلى ربع</label>${stepper('endRub', s.endRub, 1, 240)}</div>
      </div>`;
  } else if (s.method === 'surah') {
    methodHelp = 'اختر السورة الأولى والأخيرة من القائمة';
    methodFields = `
      <div class="row2">
        <div><label>من سورة</label><select onchange="updateField('startSurahIdx',this.value,true)">${surahOptions}</select></div>
        <div><label>إلى سورة</label><select onchange="updateField('endSurahIdx',this.value,true)">${surahOptionsEnd}</select></div>
      </div>`;
  } else if (s.method === 'mixed') {
    methodHelp = 'اختر نوع البداية والنهاية (صفحة أو سورة) بشكل مستقل';
    methodFields = `
      <div class="row2">
        <div><label>البداية</label>
          <div class="segmented" style="margin-top:4px;">
            <button type="button" class="${s.mixedStartType==='page'?'on':''}" onclick="updateField('mixedStartType','page',true)">صفحة</button>
            <button type="button" class="${s.mixedStartType==='surah'?'on':''}" onclick="updateField('mixedStartType','surah',true)">سورة</button>
          </div>
          ${s.mixedStartType==='page'
            ? stepper('mixedStartVal', s.mixedStartVal, 1, 604)
            : `<select onchange="updateField('mixedStartVal',this.value,true)">${SURAHS.map((sur,i)=>`<option value="${i}" ${i===s.mixedStartVal?'selected':''}>${sur.name}</option>`).join('')}</select>`}
        </div>
        <div><label>النهاية</label>
          <div class="segmented" style="margin-top:4px;">
            <button type="button" class="${s.mixedEndType==='page'?'on':''}" onclick="updateField('mixedEndType','page',true)">صفحة</button>
            <button type="button" class="${s.mixedEndType==='surah'?'on':''}" onclick="updateField('mixedEndType','surah',true)">سورة</button>
          </div>
          ${s.mixedEndType==='page'
            ? stepper('mixedEndVal', s.mixedEndVal, 1, 604)
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
      ${stepper('durationDays', s.durationDays, 1, 365)}
      <div class="hint">إجمالي الصفحات: ${totalPages} • تقريبًا ${(totalPages/Math.max(1,s.durationDays)).toFixed(1)} صفحة/يوم</div>`;
  }

  const daysBtns = DAY_ORDER.map(i => `
    <button type="button" class="daychip ${s.selectedDays.includes(i)?'on':''}" onclick="toggleDay(${i})">${DAY_NAMES[i]}</button>
  `).join('');

  const colorBtns = COLORS.map(c => `<button type="button" class="colordot ${s.color===c?'sel':''}" style="background:${c}" onclick="updateField('color','${c}',true)"></button>`).join('');
  const iconBtns = ICON_IDS.map(ic => `<button type="button" class="iconbtn ${s.icon===ic?'sel':''}" onclick="updateField('icon','${ic}',true)">${iconSvg(ic)}</button>`).join('');
  const methodBtns = METHOD_OPTIONS.map(m => `<button type="button" class="methodchip ${s.method===m.id?'on':''}" onclick="updateField('method','${m.id}',true)">${m.label}</button>`).join('');

  const html = `
  <div class="section-title">ورد جديد</div>
  <label>اسم الورد</label>
  <input type="text" placeholder="مثال: المراجعة اليومية" value="${s.name}" oninput="updateField('name',this.value)">

  <label>اللون</label>
  <div class="chips-row">${colorBtns}</div>

  <label>الأيقونة</label>
  <div class="chips-row">${iconBtns}</div>

  <label>طريقة تحديد الورد</label>
  <div class="chips-row method-grid">${methodBtns}</div>
  ${methodFields}
  <div class="hint">${methodHelp}</div>
  <div class="hint">📄 النطاق المحسوب: صفحة ${range.start} → ${range.end} (${totalPages} صفحة)</div>

  <label>طريقة التوزيع</label>
  <div class="segmented">
    <button type="button" class="${s.distribution==='auto'?'on':''}" onclick="updateField('distribution','auto',true)">تلقائي</button>
    <button type="button" class="${s.distribution==='manual'?'on':''}" onclick="updateField('distribution','manual',true)">يدوي</button>
  </div>
  ${manualFields}

  <label>الأيام المختارة (الأسبوع يبدأ بالسبت)</label>
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
  const numericKeys = ['startPage','endPage','startJuz','endJuz','startHizb','endHizb','startRub','endRub','durationDays','startSurahIdx','endSurahIdx','mixedStartVal','mixedEndVal'];
  newPlanState[key] = numericKeys.includes(key) ? Number(val) : val;
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
  viewedDate = todayISO();
  render();
}

function wrapPage(innerHtml) {
  return `<div class="page">${innerHtml}</div>`;
}

/* ---------- تبديل التبويبات ---------- */
document.querySelectorAll('.navbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTab = btn.dataset.tab;
    if (currentTab === 'today') viewedDate = todayISO() === viewedDate ? viewedDate : viewedDate;
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
