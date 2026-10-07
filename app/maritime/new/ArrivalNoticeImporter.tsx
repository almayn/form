"use client";

import { useState } from "react";

type NoticeFields = {
  registration_imo_no: string;
  ship_name: string;
  vessel_nationality: string;
  crew_count: string;
  local_agent_name: string;
  expected_arrival_date: string;
};

declare global {
  interface Window {
    Tesseract?: any;
  }
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
  if (sameLine) return sameLine;
  return lines[index + 1] || "";
}

function parseExpectedDate(text: string) {
  const normalized = normalizeDigits(text);
  const matches = Array.from(
    normalized.matchAll(/\b(?:20\d{2}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}[/.\-]\d{1,2}[/.\-]20\d{2})\b/g),
  );
  if (matches.length === 0) return "";

  const expectedLabel = /يتوقع\s*وصول|موعد\s*الوصول|expected\s*arrival|\bETA\b/i;
  const labelMatch = expectedLabel.exec(normalized);
  let chosen = matches[0];
  if (labelMatch) {
    chosen = matches.reduce((best, current) =>
      Math.abs((current.index || 0) - labelMatch.index) <
      Math.abs((best.index || 0) - labelMatch.index)
        ? current
        : best,
    );
  }

  const parts = chosen[0].split(/[/.\-]/);
  let year: string;
  let month: string;
  let day: string;
  if (parts[0].length === 4) {
    [year, month, day] = parts;
  } else {
    [day, month, year] = parts;
  }
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 2000 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function extractImo(lines: string[], text: string) {
  const labelIndexes = lines
    .map((line, index) => (/\bIMO\b|رقم\s*(?:السفينة\s*)?الدولي|الرقم\s*الدولي/i.test(line) ? index : -1))
    .filter((index) => index >= 0);
  const orderedIndexes = labelIndexes.flatMap((index) => [index, index + 1, index - 1, index + 2])
    .filter((index, position, all) => index >= 0 && index < lines.length && all.indexOf(index) === position);
  const allIndexes = orderedIndexes.concat(lines.map((_, index) => index).filter((index) => !orderedIndexes.includes(index)));

  for (const index of allIndexes) {
    const candidates = lines[index].match(/\d[\d\s]{5,}\d/g) || [];
    const imo = candidates.map((value) => value.replace(/\D/g, "")).find((value) => value.length === 7);
    if (imo) return imo;
  }

  const standalone = text.match(/\b\d{7}\b/);
  return standalone ? standalone[0] : "";
}

function parseNotice(text: string): NoticeFields {
  const normalized = normalizeDigits(text);
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const imo = extractImo(lines, normalized);
  const labeledArabicName = valueAfterLabel(lines, /اسم\s*(?:الباخرة|السفينة|الواسطة).*?(?:بالعربي|عربي)/i);
  const labeledEnglishName = valueAfterLabel(lines, /اسم\s*(?:الباخرة|السفينة|الواسطة).*?(?:باللاتيني|بالإنجليزي|بالانجليزي|بالإنجليزية|باللاتينية)/i);
  const englishCandidates = lines.filter((line) =>
    /^[A-Z][A-Z0-9 .&'-]{3,}$/.test(line.toUpperCase()) &&
    !/SQUARE ROOT|MARITIME SERVICES|MARITIME$|^IMO\b|^MEDWAY MARITIME|SHIPPING AGENCY|SHIPPING COMPANY/.test(line.toUpperCase()),
  );
  const shipName = labeledArabicName || labeledEnglishName ||
    englishCandidates.find((line) => line.split(/\s+/).length >= 2) || "";

  const flag = valueAfterLabel(lines, /(?:جنسيتها|الجنسية|العلم\s*(?:الذي\s*ترفعه|السفينة)?|علم\s*(?:السفينة)?|\bflag\b)/i);
  const crewValue = valueAfterLabel(lines, /(?:عدد\s*(?:البحارة|الطاقم)|\bcrew\s*(?:count|members)?)/i);
  const crew = (crewValue.match(/\d+/) || [""])[0];
  const agentValue = valueAfterLabel(lines, /(?:اسم\s*الوكيل|الوكيل\s*(?:الملاحي)?|shipping\s*agent|local\s*agent)/i);
  const companyLine = lines.find((line) =>
    /(?:SHIPPING AGENCY|SHIPPING COMPANY|MARITIME SERVICES|MARINE SERVICES|SEA POWER|شركة.*(?:الشحن|البحرية))/i.test(line),
  ) || "";
  const agent = agentValue || companyLine;

  return {
    registration_imo_no: imo,
    ship_name: shipName,
    vessel_nationality: flag,
    crew_count: crew,
    local_agent_name: agent,
    expected_arrival_date: parseExpectedDate(normalized),
  };
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

export default function ArrivalNoticeImporter({
  onApply,
}: {
  onApply: (fields: NoticeFields) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [fields, setFields] = useState<NoticeFields | null>(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ocrLanguage, setOcrLanguage] = useState<"ara" | "eng">("ara");

  const applyText = (text: string) => {
    setRawText(text);
    setFields(parseNotice(text));
  };

  const readPhoto = async () => {
    if (!photo) return;
    setBusy(true);
    setStatus(ocrLanguage === "ara" ? "يتم تحميل قارئ العربية أول مرة..." : "يتم تحميل قارئ الإنجليزية أول مرة...");
    setProgress(0);
    let worker: any;
    try {
      const Tesseract = await loadTesseract();
      worker = await Tesseract.createWorker(ocrLanguage, 1, {
        logger: (message: any) => {
          if (message.status === "recognizing text") {
            setStatus("جاري قراءة الإشعار");
            setProgress(Math.round((message.progress || 0) * 100));
          }
        },
      });
      const result = await worker.recognize(photo);
      applyText(result.data.text || "");
      setProgress(100);
      setStatus("اكتملت القراءة. راجع الحقول وصححها قبل التطبيق.");
    } catch (error: any) {
      setStatus(error?.message || "تعذرت قراءة الصورة. جرّب صورة أوضح أو الصق نص Google Lens.");
    } finally {
      if (worker) await worker.terminate();
      setBusy(false);
    }
  };

  const updateField = (key: keyof NoticeFields, value: string) => {
    setFields((current) => current ? { ...current, [key]: value } : current);
  };

  return (
    <section className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-5 shadow">
      <h2 className="text-xl font-black text-slate-900">تجربة إدخال إشعار الوصول من صورة</h2>
      <p className="mt-2 text-sm text-slate-700">
        اختر لغة واحدة للقراءة؛ العربية هي الافتراضية. صوّر الورقة بوضوح، ثم راجع النص والحقول قبل تطبيقها على النموذج.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">\n        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          لغة القراءة
          <select
            value={ocrLanguage}
            onChange={(event) => setOcrLanguage(event.target.value as "ara" | "eng")}
            className="rounded-lg border border-blue-300 bg-white px-3 py-2"
          >
            <option value="ara">العربية (افتراضي)</option>
            <option value="eng">English</option>
          </select>
        </label>
        <label className="cursor-pointer rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-bold text-blue-900">
          تصوير أو اختيار صورة
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              setPhoto(event.target.files?.[0] || null);
              setFields(null);
              setRawText("");
              setStatus("");
              setProgress(0);
            }}
          />
        </label>
        <button
          type="button"
          disabled={!photo || busy}
          onClick={readPhoto}
          className="rounded-xl bg-blue-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "جاري القراءة..." : "قراءة الصورة"}
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

      <details className="mt-4 rounded-xl border border-blue-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-bold text-blue-900">
          أو الصق النص المنسوخ من Google Lens
        </summary>
        <textarea
          value={rawText}
          onChange={(event) => applyText(event.target.value)}
          placeholder="افتح صورة الورقة في Google Photos، استخدم Lens لنسخ النص، ثم الصقه هنا"
          className="mt-3 min-h-28 w-full rounded-lg border border-slate-300 p-3 text-sm"
          dir="auto"
        />
      </details>

      {fields && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-bold text-slate-800">راجع البيانات المستخرجة وعدّلها عند الحاجة</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm font-bold">رقم IMO
              <input value={fields.registration_imo_no} onChange={(e) => updateField("registration_imo_no", e.target.value)} className="w-full rounded-lg border p-2" dir="ltr" />
            </label>
            <label className="space-y-1 text-sm font-bold">اسم السفينة
              <input value={fields.ship_name} onChange={(e) => updateField("ship_name", e.target.value)} className="w-full rounded-lg border p-2" />
            </label>
            <label className="space-y-1 text-sm font-bold">العلم / الجنسية
              <input value={fields.vessel_nationality} onChange={(e) => updateField("vessel_nationality", e.target.value)} className="w-full rounded-lg border p-2" />
            </label>
            <label className="space-y-1 text-sm font-bold">عدد الطاقم
              <input value={fields.crew_count} onChange={(e) => updateField("crew_count", e.target.value)} className="w-full rounded-lg border p-2" inputMode="numeric" />
            </label>
            <label className="space-y-1 text-sm font-bold">الوكيل
              <input value={fields.local_agent_name} onChange={(e) => updateField("local_agent_name", e.target.value)} className="w-full rounded-lg border p-2" />
            </label>
            <label className="space-y-1 text-sm font-bold">موعد الوصول المتوقع
              <input type="date" value={fields.expected_arrival_date} onChange={(e) => updateField("expected_arrival_date", e.target.value)} className="w-full rounded-lg border p-2" />
            </label>
          </div>
          <button
            type="button"
            onClick={() => onApply(fields)}
            className="mt-4 w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white hover:bg-green-800"
          >
            تطبيق البيانات على النموذج للمراجعة
          </button>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-slate-600">إظهار النص الذي قرأه النظام</summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs" dir="auto">{rawText}</pre>
          </details>
          <p className="mt-2 text-xs text-amber-800">
            التطبيق يملأ الحقول فقط؛ راجعها ثم احفظ المعاملة يدويًا. لا يُملأ تاريخ الفسح.
          </p>
        </div>
      )}
    </section>
  );
}
