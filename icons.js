/* ===================== أيقونات SVG للتطبيق ===================== */

const ICON_IDS = ['book','mosque','moon','star','pencil','cycle','target','stack'];

const ICON_SVGS = {
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4V5.5Z"/><path d="M20 5.5C20 4.7 19.3 4 18.5 4H13a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H20V5.5Z"/></svg>`,
  mosque: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5v3"/><circle cx="12" cy="6.3" r="1" fill="currentColor" stroke="none"/><path d="M5.5 21v-6.2a6.5 6.5 0 0 1 13 0V21"/><path d="M2.5 21h19"/><path d="M9.3 21v-4.2a2.7 2.7 0 0 1 5.4 0V21"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 14.7A8.5 8.5 0 1 1 9.3 3.8a7 7 0 0 0 10.9 10.9Z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2l2.1 5 5.2.8-3.8 3.6.9 5.2-4.4-2.4-4.4 2.4.9-5.2-3.8-3.6 5.2-.8 2.1-5Z"/></svg>`,
  pencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l0.9-4L15.5 5.4l3.1 3.1L8 19.1 4 20Z"/><path d="M13.7 6.7l3.1 3.1"/></svg>`,
  cycle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L19.5 8"/><path d="M19.5 4v4h-4"/><path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4.5 16"/><path d="M4.5 20v-4h4"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/></svg>`,
  stack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="14.2" width="16" height="4" rx="1"/><rect x="5" y="9.1" width="14" height="4" rx="1"/><rect x="6" y="4" width="12" height="4" rx="1"/></svg>`
};

// دعم البيانات القديمة المخزّنة بالإيموجي (ترقية تلقائية)
const EMOJI_TO_ICON = {
  '📖': 'book', '🕌': 'mosque', '🌙': 'moon', '✨': 'star',
  '📝': 'pencil', '🔄': 'cycle', '🎯': 'target', '📚': 'stack'
};

function iconSvg(id) {
  return ICON_SVGS[id] || ICON_SVGS.book;
}
