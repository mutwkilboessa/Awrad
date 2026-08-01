/* ===================================================================
   قاعدة بيانات المصحف المدني (604 صفحة) — بيانات مرجعية عامة
   صفحات بداية كل سورة وكل جزء وفق طبعة مجمع الملك فهد (تقريب معتمد شائع)
   =================================================================== */

const TOTAL_PAGES = 604;

// اسم السورة + رقم صفحة البداية
const SURAHS = [
  { n: 1, name: "الفاتحة", start: 1 },
  { n: 2, name: "البقرة", start: 2 },
  { n: 3, name: "آل عمران", start: 50 },
  { n: 4, name: "النساء", start: 77 },
  { n: 5, name: "المائدة", start: 106 },
  { n: 6, name: "الأنعام", start: 128 },
  { n: 7, name: "الأعراف", start: 151 },
  { n: 8, name: "الأنفال", start: 177 },
  { n: 9, name: "التوبة", start: 187 },
  { n: 10, name: "يونس", start: 208 },
  { n: 11, name: "هود", start: 221 },
  { n: 12, name: "يوسف", start: 235 },
  { n: 13, name: "الرعد", start: 249 },
  { n: 14, name: "إبراهيم", start: 255 },
  { n: 15, name: "الحجر", start: 262 },
  { n: 16, name: "النحل", start: 267 },
  { n: 17, name: "الإسراء", start: 282 },
  { n: 18, name: "الكهف", start: 293 },
  { n: 19, name: "مريم", start: 305 },
  { n: 20, name: "طه", start: 312 },
  { n: 21, name: "الأنبياء", start: 322 },
  { n: 22, name: "الحج", start: 332 },
  { n: 23, name: "المؤمنون", start: 342 },
  { n: 24, name: "النور", start: 350 },
  { n: 25, name: "الفرقان", start: 359 },
  { n: 26, name: "الشعراء", start: 367 },
  { n: 27, name: "النمل", start: 377 },
  { n: 28, name: "القصص", start: 385 },
  { n: 29, name: "العنكبوت", start: 396 },
  { n: 30, name: "الروم", start: 404 },
  { n: 31, name: "لقمان", start: 411 },
  { n: 32, name: "السجدة", start: 415 },
  { n: 33, name: "الأحزاب", start: 418 },
  { n: 34, name: "سبأ", start: 428 },
  { n: 35, name: "فاطر", start: 434 },
  { n: 36, name: "يس", start: 440 },
  { n: 37, name: "الصافات", start: 446 },
  { n: 38, name: "ص", start: 453 },
  { n: 39, name: "الزمر", start: 458 },
  { n: 40, name: "غافر", start: 467 },
  { n: 41, name: "فصلت", start: 477 },
  { n: 42, name: "الشورى", start: 483 },
  { n: 43, name: "الزخرف", start: 489 },
  { n: 44, name: "الدخان", start: 496 },
  { n: 45, name: "الجاثية", start: 499 },
  { n: 46, name: "الأحقاف", start: 502 },
  { n: 47, name: "محمد", start: 507 },
  { n: 48, name: "الفتح", start: 511 },
  { n: 49, name: "الحجرات", start: 515 },
  { n: 50, name: "ق", start: 518 },
  { n: 51, name: "الذاريات", start: 520 },
  { n: 52, name: "الطور", start: 523 },
  { n: 53, name: "النجم", start: 526 },
  { n: 54, name: "القمر", start: 528 },
  { n: 55, name: "الرحمن", start: 531 },
  { n: 56, name: "الواقعة", start: 534 },
  { n: 57, name: "الحديد", start: 537 },
  { n: 58, name: "المجادلة", start: 542 },
  { n: 59, name: "الحشر", start: 545 },
  { n: 60, name: "الممتحنة", start: 549 },
  { n: 61, name: "الصف", start: 551 },
  { n: 62, name: "الجمعة", start: 553 },
  { n: 63, name: "المنافقون", start: 554 },
  { n: 64, name: "التغابن", start: 556 },
  { n: 65, name: "الطلاق", start: 558 },
  { n: 66, name: "التحريم", start: 560 },
  { n: 67, name: "الملك", start: 562 },
  { n: 68, name: "القلم", start: 564 },
  { n: 69, name: "الحاقة", start: 566 },
  { n: 70, name: "المعارج", start: 568 },
  { n: 71, name: "نوح", start: 570 },
  { n: 72, name: "الجن", start: 572 },
  { n: 73, name: "المزمل", start: 574 },
  { n: 74, name: "المدثر", start: 575 },
  { n: 75, name: "القيامة", start: 577 },
  { n: 76, name: "الإنسان", start: 578 },
  { n: 77, name: "المرسلات", start: 580 },
  { n: 78, name: "النبأ", start: 582 },
  { n: 79, name: "النازعات", start: 583 },
  { n: 80, name: "عبس", start: 585 },
  { n: 81, name: "التكوير", start: 586 },
  { n: 82, name: "الإنفطار", start: 587 },
  { n: 83, name: "المطففين", start: 587 },
  { n: 84, name: "الإنشقاق", start: 589 },
  { n: 85, name: "البروج", start: 590 },
  { n: 86, name: "الطارق", start: 591 },
  { n: 87, name: "الأعلى", start: 591 },
  { n: 88, name: "الغاشية", start: 592 },
  { n: 89, name: "الفجر", start: 593 },
  { n: 90, name: "البلد", start: 594 },
  { n: 91, name: "الشمس", start: 595 },
  { n: 92, name: "الليل", start: 595 },
  { n: 93, name: "الضحى", start: 596 },
  { n: 94, name: "الشرح", start: 596 },
  { n: 95, name: "التين", start: 597 },
  { n: 96, name: "العلق", start: 597 },
  { n: 97, name: "القدر", start: 598 },
  { n: 98, name: "البينة", start: 598 },
  { n: 99, name: "الزلزلة", start: 599 },
  { n: 100, name: "العاديات", start: 599 },
  { n: 101, name: "القارعة", start: 600 },
  { n: 102, name: "التكاثر", start: 600 },
  { n: 103, name: "العصر", start: 601 },
  { n: 104, name: "الهمزة", start: 601 },
  { n: 105, name: "الفيل", start: 601 },
  { n: 106, name: "قريش", start: 602 },
  { n: 107, name: "الماعون", start: 602 },
  { n: 108, name: "الكوثر", start: 602 },
  { n: 109, name: "الكافرون", start: 603 },
  { n: 110, name: "النصر", start: 603 },
  { n: 111, name: "المسد", start: 603 },
  { n: 112, name: "الإخلاص", start: 604 },
  { n: 113, name: "الفلق", start: 604 },
  { n: 114, name: "الناس", start: 604 },
];

// صفحات بداية كل جزء (30 جزءًا)
const JUZ_START = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582
];

function surahEndPage(index) {
  // نهاية السورة = بداية التي تليها - 1، وآخر سورة تنتهي عند 604
  if (index === SURAHS.length - 1) return TOTAL_PAGES;
  return SURAHS[index + 1].start - 1;
}

// حساب صفحة بداية كل جزء/حزب/ربع (تقريب خطي داخل كل جزء لعدم توفر بيانات آية-بآية)
function juzStartPage(juzNum) {
  return JUZ_START[juzNum - 1];
}
function juzEndPage(juzNum) {
  return juzNum === 30 ? TOTAL_PAGES : JUZ_START[juzNum] - 1;
}
function hizbStartPage(hizbNum) {
  // كل جزء = حزبان
  const juzNum = Math.ceil(hizbNum / 2);
  const isSecondHalf = hizbNum % 2 === 0;
  const s = juzStartPage(juzNum);
  const e = juzEndPage(juzNum);
  const mid = s + Math.round((e - s + 1) / 2);
  return isSecondHalf ? mid : s;
}
function hizbEndPage(hizbNum) {
  const nextStart = hizbStartPage(hizbNum + 1);
  if (hizbNum === 60) return TOTAL_PAGES;
  return (nextStart || TOTAL_PAGES) - 1;
}
function rubStartPage(rubNum) {
  // كل حزب = 4 أرباع، رقم الربع الإجمالي من 1 إلى 240
  const hizbNum = Math.ceil(rubNum / 4);
  const posInHizb = ((rubNum - 1) % 4); // 0..3
  const s = hizbStartPage(hizbNum);
  const e = hizbEndPage(hizbNum);
  const span = (e - s + 1) / 4;
  return s + Math.round(posInHizb * span);
}
function rubEndPage(rubNum) {
  if (rubNum === 240) return TOTAL_PAGES;
  return rubStartPage(rubNum + 1) - 1;
}

function surahLabel(index) {
  return SURAHS[index] ? SURAHS[index].name : "";
}
function surahIndexByName(name) {
  return SURAHS.findIndex(s => s.name === name);
}
