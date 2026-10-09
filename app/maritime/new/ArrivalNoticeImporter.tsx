"use client";
import { useState } from "react";

type NoticeFields = {
  registration_imo_no: string;
  ship_name: string;
  vessel_nationality: string;
  crew_count: string;
  local_agent_name: string;
  arriving_from: string;
  expected_arrival_date: string;
};

declare global {
  interface Window {
    Tesseract?: any;
  }
}

// --- تحسينات معالجة النص والبحث ---

// تطبيع الحروف العربية المتشابهة لتسهيل البحث عن العناوين (دون التأثير على النص الأصلي للقيم)
function normalizeArabicForMatch(text: string) {
  return text
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F]/g, ""); // إزالة التشكيل
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

// تنظيف القيم المستخرجة من الرموز الزائدة التي يضيفها OCR
function cleanValue(val: string) {
  return val
    .replace(/[.:;|\-–_—]+$/g, "")
    .replace(/^\s*[:：\-]\s*/, "")
    .replace(/\.{2,}/g, "")
    .trim();
}

// استخراج النص من أسطر Tesseract الأصلية (أدق بكثير من تجميع الكلمات يدوياً)
function extractTextFromLines(lines: any[]) {
  if (!Array.isArray(lines)) return "";
  const sortedLines = [...lines].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  return sortedLines.map((line) => line.text.trim()).filter(Boolean).join("\n");
}

// البحث الذكي عن القيمة: يبحث في نفس السطر ثم السطر التالي
function findLineValue(
  originalLines: string[],
  matchLines: string[],
  labelRegex: RegExp
) {
  for (let i = 0; i < matchLines.length; i++) {
    const match = matchLines[i].match(labelRegex);
    if (match) {
      const matchEndIndex = (match.index || 0) + match[0].length;
      const sameLine = cleanValue(originalLines[i].slice(matchEndIndex));
      if (sameLine.length > 1) return sameLine;

      if (i + 1 < originalLines.length) {
        const nextLine = cleanValue(originalLines[i + 1]);
        if (nextLine.length > 1 && !labelRegex.test(matchLines[i + 1]))
          return nextLine;
      }
    }
  }
  return "";
}

// --- التحقق من رقم IMO ---
function isValidImo(value: string) {
  if (!/^\d{7}$/.test(value)) return false;
  const checksum = value
    .slice(0, 6)
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * (7 - index), 0);
  return checksum % 10 === Number(value[6]);
}

function imoCandidates(line: string) {
  const digits = normalizeDigits(line).replace(/\D/g, "");
  const candidates: string[] = [];
  for (let start = 0; start <= digits.length - 7; start += 1) {
    candidates.push(digits.slice(start, start + 7));
  }
  return candidates;
}

function extractImo(originalLines: string[], matchLines: string[]) {
  // البحث أولاً بالقرب من العناوين
  const labelIndexes = matchLines
    .map((line, index) =>
      /\bimo\b|(?:رقم|الرقم).*(?:تعريف|دولي)/i.test(line) ? index : -1
    )
    .filter((index) => index >= 0);

  const orderedLines = labelIndexes
    .flatMap((index) => [index, index + 1, index - 1])
    .filter(
      (index, position, all) =>
        index >= 0 &&
        index < originalLines.length &&
        all.indexOf(index) === position
    )
    .map((index) => originalLines[index]);

  for (const line of orderedLines) {
    const candidates = imoCandidates(line);
    const valid = candidates.find(isValidImo);
    if (valid) return valid;
    const reversed = candidates
      .map((c) => c.split("").reverse().join(""))
      .find(isValidImo);
    if (reversed) return reversed;
  }

  // احتياط: البحث في كامل النص عن أي رقم IMO صحيح
  for (const line of originalLines) {
    const valid = imoCandidates(line).find(isValidImo);
    if (valid) return valid;
  }
  return "";
}

// --- معالجة التواريخ ---
function hijriToGregorian(year: number, month: number, day: number) {
  const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
  for (let t = Date.UTC(year + 577, 0, 1); t < Date.UTC(year + 580, 0, 1); t += 86400000) {
    const p = Object.fromEntries(
      fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value])
    );
    if (+p.year === year && +p.month === month && +p.day === day)
      return new Date(t).toISOString().slice(0, 10);
  }
  return "";
}

function parseExpectedDate(originalText: string, matchText: string) {
  const normalizedOriginal = normalizeDigits(originalText);
  const normalizedMatch = normalizeDigits(matchText);

  // دعم التواريخ الرقمية والنصية (بالعربي والإنجليزي)
  const monthNames =
    "(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)";
  
  const dateRegexes = [
    /(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/g,
    new RegExp(`(\\d{1,2})\\s*${monthNames}\\s*(\\d{2,4})`, "gi"),
  ];

  const allMatches: { index: number; match: string }[] = [];
  for (const regex of dateRegexes) {
    let m;
    while ((m = regex.exec(normalizedOriginal)) !== null) {
      allMatches.push({ index: m.index, match: m[0] });
    }
  }

  if (!allMatches.length) return "";

  const labelRegex =
    /يتوقع\s*وصول|موعد\s*الوصول|expected\s*arrival|\bETA\b|بتاريخ|تاريخ\s*(?:الوصول|وصول)|التاريخ|\barrival\b|\bdate\b/i;
  const labelMatch = labelRegex.exec(normalizedMatch);

  const chosen = labelMatch
    ? allMatches.reduce((best, cur) =>
        Math.abs(cur.index - (labelMatch.index || 0)) <
        Math.abs(best.index - (labelMatch.index || 0))
          ? cur
          : best
      )
    : allMatches[0];

  const q = chosen.match.split(/[\/\-.]/).map(Number);
  let y: number, m: number, d: number;

  if (q.length === 3) {
    if (q[0] > 999) [y, m, d] = q;
    else [d, m, y] = q;
  } else {
    // Handle text dates (DD Month YYYY) - simplified fallback
    return ""; 
  }

  if (y >= 1300 && y <= 1600) return hijriToGregorian(y, m, d);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";

  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    : "";
}

// --- تجميع الحقول ---
function parseNotice(text: string): NoticeFields {
  const originalLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const matchLines = originalLines.map(normalizeArabicForMatch);
  const matchText = matchLines.join(" ");

  const shipName =
    findLineValue(originalLines, matchLines, /(?:ا?ل?اسم).*(?:باخر|سفين|واسط)/i) ||
    findLineValue(originalLines, matchLines, /(?:ship|vessel).*name/i);

  return {
    registration_imo_no: extractImo(originalLines, matchLines),
    ship_name: shipName,
    vessel_nationality: findLineValue(originalLines, matchLines, /(?:جنسي|national)/i),
    crew_count: (
      findLineValue(originalLines, matchLines, /(?:عدد.*طاقم|عدد.*بحار|crew)/i).match(
        /\d+/
      ) || [""]
    )[0],
    local_agent_name:
      findLineValue(originalLines, matchLines, /(?:وكيل|agent)/i) ||
      originalLines.find((l) =>
        /(?:SHIPPING AGENCY|SHIPPING COMPANY|MARITIME SERVICES|شركة.*(?:الشحن|البحرية))/i.test(l)
      ) ||
      "",
    arriving_from: findLineValue(originalLines, matchLines, /(?:قادم.*من|last.*port|from)/i),
    expected_arrival_date: parseExpectedDate(text, matchText),
  };
}

// --- معالجة الصورة (تمت إضافة خطوة Binarization) ---
function prepareNoticeImage(file: File): Promise<Blob> {
  return createImageBitmap(file).then(
    (bitmap) =>
      new Promise((resolve, reject) => {
        const maxSide = 2600;
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          bitmap.close();
          reject(new Error("تعذر تجهيز الصورة للقراءة"));
          return;
        }

        // تحسين التباين والسطوع
        context.filter = "grayscale(100%) contrast(160%) brightness(110%)";
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        // خطوة العتبة (Thresholding) لتحويل الصورة لأبيض وأسود نقي (يزيل الضوضاء)
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const threshold = 140; // يمكن تعديلها حسب جودة الصور المتوقعة
        for (let i = 0; i < data.length; i += 4) {
          const avg = data[i];
          data[i] = data[i + 1] = data[i + 2] = avg > threshold ? 255 : 0;
        }
        context.putImageData(imageData, 0, 0);

        bitmap.close();
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("تعذر تجهيز الصورة للقراءة")),
          "image/png"
        );
      })
  );
}

function loadTesseract(): Promise<any> {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-arrival-ocr]"
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Tesseract));
      existing.addEventListener("error", () =>
        reject(new Error("تعذر تحميل أداة قراءة الصورة"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.dataset.arrivalOcr = "true";
    script.onload = () =>
      window.Tesseract
        ? resolve(window.Tesseract)
        : reject(new Error("لم تعمل أداة قراءة الصورة"));
    script.onerror = () => reject(new Error("تعذر تحميل أداة قراءة الصورة"));
    document.head.appendChild(script);
  });
}

function emptyFields(): NoticeFields {
  return {
    registration_imo_no: "",
    ship_name: "",
    vessel_nationality: "",
    crew_count: "",
    local_agent_name: "",
    arriving_from: "",
    expected_arrival_date: "",
  };
}

export default function ArrivalNoticeImporter({
  onApply,
}: {
  onApply: (fields: NoticeFields) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [fields, setFields] = useState<NoticeFields | null>(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const choosePhoto = (file?: File) => {
    setPhoto(file || null);
    setFields(null);
    setStatus("");
    setProgress(0);
  };

  const readNotice = async (Tesseract: any, image: Blob) => {
    // استخدام PSM 6 الأنسب للنماذج والإشعارات الموحدة
    const worker = await Tesseract.createWorker("ara+eng", 1, {
      logger: (message: any) => {
        if (message.status === "recognizing text") {
          setStatus("قراءة موحدة للإشعار؛ تُحفظ القيم بلغتها كما وردت");
          setProgress(Math.round((message.progress || 0) * 100));
        }
      },
    });

    try {
      await worker.setParameters({
        preserve_interword_spaces: "1",
      });
      
      const result = await worker.recognize(image);
      
      // استخدام بنية الأسطر الأصلية من Tesseract لدقة أعلى في ترتيب القراءة
      const spatialText = extractTextFromLines(result.data.lines);
      return parseNotice(spatialText || result.data.text || "");
    } finally {
      await worker.terminate();
    }
  };

  const readPhoto = async () => {
    if (!photo) return;
    setBusy(true);
    setStatus("تحميل قارئ الإشعار أول مرة...");
    setProgress(0);
    try {
      const Tesseract = await loadTesseract();
      setStatus("تحسين وضوح الصورة وتحويلها لأبيض وأسود...");
      const preparedImage = await prepareNoticeImage(photo);
      const result = await readNotice(Tesseract, preparedImage);
      setFields(result);
      setProgress(100);
      setStatus("اكتملت القراءة. راجع الحقول وصححها قبل التطبيق.");
    } catch (error: any) {
      setStatus(error?.message || "تعذرت قراءة الصورة. جرّب صورة أوضح.");
    } finally {
      setBusy(false);
    }
  };

  const updateField = (key: keyof NoticeFields, value: string) => {
    setFields((current) => (current ? { ...current, [key]: value } : current));
  };

  const fieldLabel: Record<keyof NoticeFields, string> = {
    registration_imo_no: "رقم IMO / الرقم الدولي",
    ship_name: "اسم السفينة / الواسطة",
    vessel_nationality: "الجنسية",
    crew_count: "عدد الطاقم",
    local_agent_name: "الوكيل / الشركة",
    arriving_from: "قادمة من / الجهة القادمة منها",
    expected_arrival_date: "التاريخ / بتاريخ",
  };

  return (
    <section className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-5 shadow">
      <h2 className="text-xl font-black text-slate-900">إدخال إشعار الوصول من صورة</h2>
      <p className="mt-2 text-sm text-slate-700">
        قراءة موحدة موجهة للعربية، مع الاحتفاظ بالكلمات والأسماء بلغتها كما تظهر في الإشعار دون ترجمة.
        (تم تحسين دقة استخراج البيانات ومعالجة الصور).
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-bold text-blue-900">
          فتح الكاميرا
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => choosePhoto(event.target.files?.[0])}
          />
        </label>
        <label className="cursor-pointer rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-bold text-blue-900">
          اختيار صورة
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => choosePhoto(event.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          disabled={!photo || busy}
          onClick={readPhoto}
          className="rounded-xl bg-blue-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "جاري القراءة..." : "قراءة الإشعار"}
        </button>
        {photo && <span className="text-xs text-slate-600">{photo.name}</span>}
      </div>
      {busy && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full bg-blue-700 transition-all"
              style={{ width: progress + "%" }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {status} {progress ? progress + "%" : ""}
          </p>
        </div>
      )}
      {status && !busy && (
        <p className="mt-3 text-sm font-bold text-slate-700">{status}</p>
      )}
      {fields && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-bold text-slate-800">
            الحقول التي قرأها النظام (يمكن تعديلها)
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {(Object.keys(fieldLabel) as (keyof NoticeFields)[]).map((key) => (
              <label key={key} className="space-y-1 text-sm font-bold">
                {fieldLabel[key]}
                <input
                  type={key === "expected_arrival_date" ? "date" : "text"}
                  value={fields[key]}
                  onChange={(event) => updateField(key, event.target.value)}
                  className="w-full rounded-lg border p-2"
                  dir={key === "registration_imo_no" ? "ltr" : "auto"}
                  inputMode={
                    key === "registration_imo_no" || key === "crew_count"
                      ? "numeric"
                      : undefined
                  }
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onApply(fields)}
            className="mt-4 w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white hover:bg-green-800"
          >
            تطبيق الحقول على النموذج للمراجعة
          </button>
          <p className="mt-2 text-xs text-amber-800">
            لا تُحفظ المعاملة تلقائيًا، ولا يتغير تاريخ الفسح. تحقق من رقم IMO قبل التطبيق.
          </p>
        </div>
      )}
    </section>
  );
}
