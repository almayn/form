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

function textFromWords(words: any[], language: "eng" | "ara") {
  if (!Array.isArray(words)) return "";
  const items = words.filter((word) => word?.text?.trim() && word?.bbox).map((word) => ({
    text: String(word.text).trim(), x0: Number(word.bbox.x0), y0: Number(word.bbox.y0),
    x1: Number(word.bbox.x1), y1: Number(word.bbox.y1),
  })).filter((word) => [word.x0, word.y0, word.x1, word.y1].every(Number.isFinite));
  items.sort((a, b) => ((a.y0 + a.y1) / 2) - ((b.y0 + b.y1) / 2));
  const rows: Array<{ words: typeof items; center: number; height: number }> = [];
  for (const word of items) {
    const center = (word.y0 + word.y1) / 2;
    const height = Math.max(1, word.y1 - word.y0);
    let row = rows.find((candidate) => Math.abs(candidate.center - center) <= Math.max(7, ((candidate.height + height) / 2) * 0.55));
    if (!row) { row = { words: [], center, height }; rows.push(row); }
    row.words.push(word);
    row.center = row.words.reduce((sum, item) => sum + (item.y0 + item.y1) / 2, 0) / row.words.length;
    row.height = row.words.reduce((sum, item) => sum + (item.y1 - item.y0), 0) / row.words.length;
  }
  return rows.sort((a, b) => a.center - b.center).map((row) => row.words
    .sort((a, b) => language === "ara" ? b.x0 - a.x0 : a.x0 - b.x0)
    .map((word) => word.text).join(" ")).join("\n");
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function valueAfterLabel(lines: string[], label: RegExp) {
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return "";
  const line = lines[index];
  const sameLine = line.replace(label, "").replace(/^\s*[:：\-]?\s*/, "").trim();
  return sameLine || lines[index + 1] || "";
}

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

function extractImo(lines: string[]) {
  const labelIndexes = lines
    .map((line, index) =>
      /\bIMO\b|(?:رقم|الرقم)\s*(?:(?:التعريف|تعريف)\s*)?(?:الدولي|IMO)|الرقم\s*الدولي/i.test(line) ? index : -1,
    )
    .filter((index) => index >= 0);

  const orderedLines = labelIndexes
    .flatMap((index) => [index, index + 1, index - 1])
    .filter((index, position, all) => index >= 0 && index < lines.length && all.indexOf(index) === position)
    .map((index) => lines[index]);

  for (const line of orderedLines) {
    const candidates = imoCandidates(line);
    const valid = candidates.find(isValidImo);
    if (valid) return valid;
    const reversed = candidates.map((candidate) => candidate.split("").reverse().join("")).find(isValidImo);
    if (reversed) return reversed;
  }
  return "";
}

function hijriToGregorian(year: number, month: number, day: number) {
  const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
  for (let t = Date.UTC(year + 577, 0, 1); t < Date.UTC(year + 580, 0, 1); t += 86400000) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map(x => [x.type, x.value]));
    if (+p.year === year && +p.month === month && +p.day === day) return new Date(t).toISOString().slice(0, 10);
  }
  return "";
}
function parseExpectedDate(text: string) {
  const normalized = normalizeDigits(text);
  const matches = Array.from(normalized.matchAll(/(?:\d{1,4})[/.\-](?:\d{1,2})[/.\-](?:\d{1,4})/g));
  if (!matches.length) return "";
  const label = /يتوقع\s*وصول|موعد\s*الوصول|expected\s*arrival|\bETA\b|بتاريخ|تاريخ\\s*(?:الوصول|وصول)|التاريخ|\\barrival\\b|\\bdate\\b/i.exec(normalized);
  const chosen = label ? matches.reduce((best, cur) => Math.abs((cur.index || 0)-label.index) < Math.abs((best.index || 0)-label.index) ? cur : best) : matches[0];
  const q = chosen[0].split(/[/.\-]/).map(Number);
  let y: number, m: number, d: number;
  if (q[0] > 999) [y,m,d] = q; else [d,m,y] = q;
  if (y >= 1300 && y <= 1600) return hijriToGregorian(y,m,d);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y,m-1,d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m-1 && dt.getUTCDate() === d ? y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0") : "";
}
function extractFlag(lines: string[]) {
  const value = valueAfterLabel(lines, /(?:جنسيتها|الجنسية|\\bnationality\\b)/i);
  const clean = value.replace(/[,:;]+$/g, "").trim();
  return clean.length <= 60 && clean.split(/\\s+/).length <= 6 ? clean : "";
}

function parseNotice(text: string): NoticeFields {
  const normalized = normalizeDigits(text);
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const arabicName = valueAfterLabel(
    lines,
    /اسم\s*(?:الباخرة|السفينة|الواسطة).*?(?:بالعربي|عربي)/i,
  );
  const englishName = valueAfterLabel(
    lines,
    /اسم\s*(?:الباخرة|السفينة|الواسطة).*?(?:باللاتيني|بالإنجليزي|بالانجليزي|بالإنجليزية|باللاتينية)/i,
  );
  const flag = extractFlag(lines);
  const crewValue = valueAfterLabel(
    lines,
    /(?:عدد\s*(?:طاقم\s*)?(?:البحارة|البحار|الطاقم)|البحارة|\bcrew\s*(?:count|members)?)/i,
  );
  const crew = (normalizeDigits(crewValue).match(/\d+/) || [""])[0];
  const arrivingFrom = valueAfterLabel(lines, /(?:الجهة\s*القادمة\s*منها|قادمة\s*من|القادمة\s*من|\bfrom\b)/i);
  const agentLabelValue = valueAfterLabel(
    lines,
    /(?:اسم\s*الوكيل|الوكيل\s*(?:الملاحي)?|shipping\s*agent|local\s*agent)/i,
  );
  const companyHeader = lines.find((line) =>
    /(?:SHIPPING AGENCY|SHIPPING COMPANY|MARITIME SERVICES|MARINE SERVICES|SEA POWER|شركة.*(?:الشحن|البحرية))/i.test(line),
  ) || "";

  return {
    registration_imo_no: extractImo(lines),
    ship_name: arabicName || englishName,
    vessel_nationality: flag,
    crew_count: crew,
    local_agent_name: agentLabelValue || companyHeader,
    arriving_from: arrivingFrom,
    expected_arrival_date: parseExpectedDate(normalized),
  };
}

function prepareNoticeImage(file: File): Promise<Blob> {
  return createImageBitmap(file).then((bitmap) => new Promise((resolve, reject) => {
    const maxSide = 2600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close(); reject(new Error("تعذر تجهيز الصورة للقراءة")); return; }
    context.filter = "grayscale(100%) contrast(120%)";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("تعذر تجهيز الصورة للقراءة")), "image/png");
  }));
}

function loadTesseract(): Promise<any> {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-arrival-ocr]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Tesseract));
      existing.addEventListener("error", () => reject(new Error("تعذر تحميل أداة قراءة الصورة")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.dataset.arrivalOcr = "true";
    script.onload = () => window.Tesseract
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
  const [language, setLanguage] = useState<"ara" | "eng">("ara");
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
    const worker = await Tesseract.createWorker("ara+eng", 1, {
      logger: (message: any) => {
        if (message.status === "recognizing text") {
          setStatus("قراءة موحدة للإشعار؛ تُحفظ القيم بلغتها كما وردت");
          setProgress(Math.round((message.progress || 0) * 100));
        }
      },
    });
    try {
      const result = await worker.recognize(image);
      const spatialText = textFromWords(result.data.words, "ara");
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
      setStatus("تحسين وضوح الصورة...");
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
    setFields((current) => current ? { ...current, [key]: value } : current);
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
            <div className="h-full bg-blue-700 transition-all" style={{ width: progress + "%" }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">{status} {progress ? progress + "%" : ""}</p>
        </div>
      )}

      {status && !busy && <p className="mt-3 text-sm font-bold text-slate-700">{status}</p>}

      {fields && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-bold text-slate-800">الحقول التي قرأها النظام (يمكن تعديلها)</p>
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
                  inputMode={key === "registration_imo_no" || key === "crew_count" ? "numeric" : undefined}
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
