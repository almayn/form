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
    pdfjsLib?: any;
  }
}

// --- 1. تحسين استخراج النص لترتيب أفضل ---
function textFromWords(words: any[], language: "eng" | "ara") {
  if (!Array.isArray(words)) return "";
  const items = words
    .filter((word) => word?.text?.trim() && word?.bbox)
    .map((word) => ({
      text: String(word.text).trim(),
      x0: Number(word.bbox.x0),
      y0: Number(word.bbox.y0),
      x1: Number(word.bbox.x1),
      y1: Number(word.bbox.y1),
    }))
    .filter((word) => [word.x0, word.y0, word.x1, word.y1].every(Number.isFinite));

  items.sort((a, b) => (a.y0 + a.y1) / 2 - ((b.y0 + b.y1) / 2));
  
  const rows: Array<{ words: typeof items; center: number; height: number }> = [];
  for (const word of items) {
    const center = (word.y0 + word.y1) / 2;
    const height = Math.max(1, word.y1 - word.y0);
    let row = rows.find(
      (candidate) => Math.abs(candidate.center - center) <= Math.max(10, ((candidate.height + height) / 2) * 0.75)
    );
    if (!row) {
      row = { words: [], center, height };
      rows.push(row);
    }
    row.words.push(word);
    row.center = row.words.reduce((sum, item) => sum + (item.y0 + item.y1) / 2, 0) / row.words.length;
    row.height = row.words.reduce((sum, item) => sum + (item.y1 - item.y0), 0) / row.words.length;
  }

  return rows
    .sort((a, b) => a.center - b.center)
    .map((row) =>
      row.words
        .sort((a, b) => (language === "ara" ? b.x0 - a.x0 : a.x0 - b.x0))
        .map((word) => word.text)
        .join(" ")
    )
    .join("\n");
}

function textFromLines(lines: any[]) {
  if (!Array.isArray(lines)) return "";
  return lines.map((line) => String(line?.text || "").trim()).filter(Boolean).join("\n");
}

// --- 2. تحسين تطبيع النصوص والأرقام ---
function normalizeDigits(value: string) {
  return value
    .replace(/ـ/g, "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[Oo]/g, "0") // تصحيح أخطاء OCR الشائعة
    .replace(/[lI]/g, "1")
    .replace(/[S]/g, "5")
    .replace(/[Z]/g, "2");
}

function isNoticeLabel(line: string) {
  return /(?:اسم\s*(?:الباخرة|السفينة|الواسطة)|(?:رقم|الرقم).*?(?:الدولي|IMO)|IMO|الجنسية|جنسيتها|العلم|عدد.*(?:الطاقم|البحارة)|البحارة|الوكيل|agent|nationality|flag|crew|(?:قادمة|القادمة).*من|\bfrom\b)/i.test(line);
}

// بحث مرن عن القيمة بعد العنوان (يتعامل مع الفواصل السطرية)
function valueAfterLabel(lines: string[], label: RegExp) {
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return "";
  
  const line = lines[index];
  const sameLine = line.replace(label, "").replace(/^[\s:：=\-\.]+/, "").trim();
  if (sameLine && sameLine.length > 1) return sameLine;

  // البحث في الأسطر التالية (حتى 3 أسطر) مع تجاهل العناوين الأخرى
  for (let i = 1; i <= 3; i++) {
    if (index + i < lines.length) {
      const nextLine = lines[index + i].trim();
      if (nextLine && !isNoticeLabel(nextLine) && nextLine.length > 1) {
        return nextLine.replace(/^[\s:：=\-\.]+/, "").trim();
      }
    }
  }
  return "";
}

// --- 3. الصياد الشامل لرقم IMO (يعمل بغض النظر عن الموقع يمين/يسار) ---
function isValidImo(value: string) {
  if (!/^\d{7}$/.test(value)) return false;
  const checksum = value
    .slice(0, 6)
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * (7 - index), 0);
  return checksum % 10 === Number(value[6]);
}

function extractImo(lines: string[], rawText: string) {
  const normalizedText = normalizeDigits(rawText);
  
  // الخطوة 1: البحث الشامل في كامل النص (إزالة كل شيء ما عدا الأرقام)
  // هذا يحل مشكلة الأعمدة المتباعدة أو الأرقام المقروءة بشكل متقطع
  const allDigits = normalizedText.replace(/\D/g, "");
  const globalCandidates = new Set<string>();
  
  for (let i = 0; i <= allDigits.length - 7; i++) {
    const cand = allDigits.slice(i, i + 7);
    if (isValidImo(cand)) {
      globalCandidates.add(cand);
    }
  }

  const validImos = Array.from(globalCandidates);
  
  // إذا وجدنا رقم IMO صحيح رياضياً، نتحقق من سياقه
  if (validImos.length > 0) {
    // إذا كان هناك أكثر من رقم، نفضل الرقم الأقرب لكلمة IMO
    if (validImos.length > 1) {
      const labelLineIndex = lines.findIndex((line) => /IMO|الرقم\s*الدولي|رقم\s*التعريف/i.test(line));
      if (labelLineIndex >= 0) {
        // نبحث عن أي من الأرقام الصحيحة يظهر في السطور المحيطة بالعنوان
        for (const imo of validImos) {
          const imoLineIndex = lines.findIndex((line) => line.includes(imo));
          if (imoLineIndex >= 0 && Math.abs(imoLineIndex - labelLineIndex) <= 3) {
            return imo;
          }
        }
      }
    }
    // إرجاع أول رقم صحيح كخيار افتراضي آمن
    return validImos[0];
  }

  return "";
}

function extractFlag(lines: string[]) {
  const value = valueAfterLabel(lines, /(?:العلم\s*(?:الذي\s*ترفعه)?|الجنسية|جنسيتها|\bnationality\b|\bflag\b)/i);
  const clean = value.replace(/[,:;]+$/g, "").trim();
  return clean.length <= 60 && clean.split(/\s+/).length <= 6 ? clean : "";
}

function hijriToGregorian(year: number, month: number, day: number) {
  const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
  for (let t = Date.UTC(year + 577, 0, 1); t < Date.UTC(year + 580, 0, 1); t += 86400000) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    if (+p.year === year && +p.month === month && +p.day === day) {
      return new Date(t).toISOString().slice(0, 10);
    }
  }
  return "";
}

function parseExpectedDate(text: string) {
  const normalized = normalizeDigits(text).replace(/ـ/g, "");
  const matches = Array.from(normalized.matchAll(/(?:\d{1,4})[/.\-](?:\d{1,2})[/.\-](?:\d{1,4})/g));
  if (!matches.length) return "";

  const label = /تاريخ\s*وصولها|تاريخ\s*الوصول|بتاريخ|الموافق|موعد\s*الوصول/i.exec(normalized);
  const chosen = label
    ? matches.reduce((best, cur) =>
        Math.abs((cur.index || 0) - (label.index || 0)) < Math.abs((best.index || 0) - (label.index || 0)) ? cur : best
      )
    : matches[0];
    
  const q = chosen[0].split(/[/.\-]/).map(Number);
  let y: number, m: number, d: number;
  if (q[0] > 999) [y, m, d] = q;
  else [d, m, y] = q;
  
  if (y >= 1300 && y <= 1600) return hijriToGregorian(y, m, d);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0")
    : "";
}

function parseNotice(text: string): NoticeFields {
  const normalized = normalizeDigits(text);
  const lines = normalized.split(/\r?\n/).map((line) => line.trim().replace(/\s+/g, " ")).filter(Boolean);

  const arabicName = valueAfterLabel(lines, /اسم\s*(?:الباخرة|السفينة|الواسطة)\s*(?:بالعربي|عربي)/i);
  const englishName = valueAfterLabel(
    lines,
    /اسم\s*(?:الباخرة|السفينة|الواسطة)\s*(?:باللاتيني|بالإنجليزي|بالانجليزي|بالإنجليزية|بالانجليزية|باللاتينية)/i
  );
  const genericName = valueAfterLabel(
    lines,
    /اسم\s*(?:الباخرة|السفينة|الواسطة)(?!\s*(?:بالعربي|عربي|باللاتيني|بالإنجليزي|بالانجليزي|بالإنجليزية|بالانجليزية|باللاتينية))/i
  );

  const flag = extractFlag(lines);

  const crewValue = valueAfterLabel(
    lines,
    /(?:عدد\s*(?:(?:أفراد|افراد)\s*)?(?:طاقم\s*)?(?:البحارة|البحار|الطاقم)|(?:طاقم\s*)?البحارة|\bcrew\s*(?:count|members)?|\bnumber\s*of\s*(?:crew|sailors)\b)/i
  );
  const crew = (normalizeDigits(crewValue).match(/\d+/) || [""])[0];

  const arrivingFrom = valueAfterLabel(
    lines,
    /(?:الجهة\s*القادمة\s*منها|قادمة\s*من|القادمة\s*من|ميناء\s*المغادرة|ميناء\s*القدوم|arriving\s*from|last\s*port|port\s*of\s*origin|\bfrom\b)/i
  );

  const agentLabelValue = valueAfterLabel(lines, /(?:اسم\s*الوكيل|الوكيل\s*(?:الملاحي)?|shipping\s*agent|local\s*agent)/i);
  const companyHeader =
    lines.find((line) =>
      /(?:SHIPPING AGENCY|SHIPPING COMPANY|MARITIME SERVICES|MARINE SERVICES|SEA POWER|شركة.*(?:الشحن|البحرية|للملاحة|ملاحة))/i.test(line)
    ) || "";

  return {
    registration_imo_no: extractImo(lines, text),
    ship_name: arabicName || englishName || genericName,
    vessel_nationality: flag,
    crew_count: crew,
    local_agent_name: agentLabelValue || companyHeader,
    arriving_from: arrivingFrom,
    expected_arrival_date: parseExpectedDate(normalized),
  };
}

// --- 4. معالجة متقدمة للصور (Binarization) لتحسين دقة OCR ---
function applyImageEnhancement(context: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const threshold = 140; // نقطة الفصل بين الأسود والأبيض
  
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const val = avg > threshold ? 255 : 0; // تحويل نقي لأبيض وأسود
    data[i] = data[i + 1] = data[i + 2] = val;
  }
  context.putImageData(imageData, 0, 0);
}

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
        
        // تحسين أولي
        context.filter = "grayscale(100%) contrast(150%) brightness(110%)";
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        
        // تطبيق التعتيق (Binarization) لإزالة الضوضاء وجعل النص حاداً
        applyImageEnhancement(context, canvas.width, canvas.height);
        
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("تعذر تجهيز الصورة للقراءة"))),
          "image/png"
        );
      })
  );
}

function loadPdfJs(): Promise<any> {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-arrival-pdf]");
    if (existing) {
      existing.addEventListener("load", () => (window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error("لم تعمل أداة قراءة PDF"))));
      existing.addEventListener("error", () => reject(new Error("تعذر تحميل أداة قراءة PDF")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.dataset.arrivalPdf = "true";
    script.onload = () => {
      if (!window.pdfjsLib) {
        reject(new Error("لم تعمل أداة قراءة PDF"));
        return;
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("تعذر تحميل أداة قراءة PDF"));
    document.head.appendChild(script);
  });
}

async function prepareNoticeFile(file: File): Promise<Blob> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return prepareNoticeImage(file);
  }

  const pdfjs = await loadPdfJs();
  const documentTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await documentTask.promise;
  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, 2600 / Math.max(baseViewport.width, baseViewport.height)); // زيادة الدقة لـ 2.5
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذر تجهيز صفحة PDF للقراءة");
    
    context.filter = "grayscale(100%) contrast(150%) brightness(110%)";
    await page.render({ canvasContext: context, viewport }).promise;
    
    // تطبيق التعتيق على صفحات PDF أيضاً
    applyImageEnhancement(context, canvas.width, canvas.height);
    
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("تعذر تجهيز صفحة PDF للقراءة"))), "image/png");
    });
  } finally {
    await pdf.destroy();
  }
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
    script.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error("لم تعمل أداة قراءة الصورة")));
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
          setStatus("جاري قراءة الإشعار وتحليل البيانات...");
          setProgress(Math.round((message.progress || 0) * 100));
        }
      },
    });
    
    try {
      // إضافة إعدادات لتحسين قراءة النماذج والجداول
      await worker.setParameters({
        tessedit_pageseg_mode: "6", // افتراض كتلة نصية موحدة (أفضل للنماذج)
        preserve_interword_spaces: "1",
      });

      const result = await worker.recognize(image);
      
      // دمج استراتيجيات الاستخراج لضمان أعلى دقة
      const lineText = textFromLines(result.data.lines);
      const spatialText = textFromWords(result.data.words, "ara");
      const rawText = result.data.text || "";
      
      const preferredText = lineText || spatialText || rawText;
      const preferredFields = parseNotice(preferredText);
      const fallbackFields = parseNotice(spatialText || rawText);
      
      const fieldCount = (value: NoticeFields) => Object.values(value).filter(Boolean).length;
      return fieldCount(fallbackFields) > fieldCount(preferredFields) ? fallbackFields : preferredFields;
    } finally {
      await worker.terminate();
    }
  };

  const readPhoto = async () => {
    if (!photo) return;
    setBusy(true);
    setStatus("تحميل محركات القراءة...");
    setProgress(0);
    try {
      const Tesseract = await loadTesseract();
      setStatus("تحسين جودة الصورة وإزالة الضوضاء...");
      const preparedImage = await prepareNoticeFile(photo);
      const result = await readNotice(Tesseract, preparedImage);
      setFields(result);
      setProgress(100);
      setStatus("اكتملت القراءة بنجاح. يرجى مراجعة الحقول أدناه.");
    } catch (error: any) {
      setStatus(error?.message || "تعذرت قراءة الملف. يرجى التأكد من وضوح الصورة أو الملف.");
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
    expected_arrival_date: "تاريخ الوصول",
    arriving_from: "قادمة من / الجهة القادمة منها",
    crew_count: " البحارة",
    local_agent_name: "الوكيل / الشركة",
  };

  return (
    <section className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-5 shadow">
      <h2 className="text-xl font-black text-slate-900">إدخال إشعار الوصول من صورة أو PDF</h2>
      <p className="mt-2 text-sm text-slate-700">
        تم تحسين المحرك للتعامل مع التخطيطات المختلفة (يمين/يسار) ومعالجة ضوضاء الصور تلقائياً لزيادة الدقة.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-50">
          فتح الكاميرا
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => choosePhoto(event.target.files?.[0])}
          />
        </label>
        <label className="cursor-pointer rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-50">
          اختيار صورة أو PDF
          <input
            type="file"
            accept="image/*,.pdf,application/pdf"
            className="sr-only"
            onChange={(event) => choosePhoto(event.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          disabled={!photo || busy}
          onClick={readPhoto}
          className="rounded-xl bg-blue-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-900 disabled:opacity-50"
        >
          {busy ? "جاري المعالجة..." : "قراءة الإشعار"}
        </button>
        {photo && <span className="text-xs text-slate-600 truncate max-w-[200px]">{photo.name}</span>}
      </div>

      {busy && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-blue-100">
            <div className="h-full bg-blue-700 transition-all duration-300" style={{ width: progress + "%" }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {status} {progress > 0 ? progress + "%" : ""}
          </p>
        </div>
      )}

      {status && !busy && <p className="mt-3 text-sm font-bold text-slate-700">{status}</p>}

      {fields && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 font-bold text-slate-800">الحقول التي تم استخراجها (يمكنك تعديلها يدوياً)</p>
          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(fieldLabel) as (keyof NoticeFields)[]).map((key) => (
              <label key={key} className="space-y-1 text-sm font-bold text-slate-700">
                {fieldLabel[key]}
                <input
                  type={key === "expected_arrival_date" ? "date" : "text"}
                  value={fields[key]}
                  onChange={(event) => updateField(key, event.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  dir={key === "registration_imo_no" ? "ltr" : "auto"}
                  inputMode={key === "registration_imo_no" || key === "crew_count" ? "numeric" : undefined}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onApply(fields)}
            className="mt-6 w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white transition hover:bg-green-800 active:scale-[0.98]"
          >
            تطبيق الحقول على النموذج للمراجعة
          </button>
          <p className="mt-3 text-center text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
            تنبيه: يرجى التحقق من صحة رقم IMO وتاريخ الوصول قبل التطبيق النهائي.
          </p>
        </div>
      )}
    </section>
  );
}
