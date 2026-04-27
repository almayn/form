"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function SendClearancePdfEmailButton({
  declarationId,
  ship,
  reference,
}: {
  declarationId: string;
  ship: string;
  reference?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const buildPdfBase64 = async () => {
    const element = document.getElementById("maritime-pdf-area");
    if (!element) throw new Error("لم يتم العثور على منطقة PDF");

    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const originalStyle = {
      width: element.style.width,
      maxWidth: element.style.maxWidth,
      minWidth: element.style.minWidth,
      position: element.style.position,
      left: element.style.left,
      transform: element.style.transform,
    };

    element.style.width = "794px";
    element.style.maxWidth = "794px";
    element.style.minWidth = "794px";
    element.style.position = "absolute";
    element.style.left = "-9999px";
    element.style.transform = "scale(1)";

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
        height: 1123,
        ignoreElements: (el) => el.tagName === "STYLE",
        onclone: (doc) => {
          doc.querySelectorAll("*").forEach((el) => {
            const node = el as HTMLElement;

            if (node.tagName !== "IMG") {
              node.style.color = "#0f172a";
              node.style.backgroundColor = "#ffffff";
              node.style.borderColor = "#000000";
            }

            node.style.boxShadow = "none";
            node.style.transform = "none";
          });
        },
      });

      element.style.width = originalStyle.width;
      element.style.maxWidth = originalStyle.maxWidth;
      element.style.minWidth = originalStyle.minWidth;
      element.style.position = originalStyle.position;
      element.style.left = originalStyle.left;
      element.style.transform = originalStyle.transform;

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);

      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

     // شهادة الفسح صفحة واحدة فقط
pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);

      const dataUri = pdf.output("datauristring");
      return dataUri.split(",")[1];
    } catch (error) {
      element.style.width = originalStyle.width;
      element.style.maxWidth = originalStyle.maxWidth;
      element.style.minWidth = originalStyle.minWidth;
      element.style.position = originalStyle.position;
      element.style.left = originalStyle.left;
      element.style.transform = originalStyle.transform;

      console.error("❌ خطأ في إنشاء PDF:", error);
      throw new Error("فشل إنشاء ملف PDF");
    }
  };

const send = async () => {
  setLoading(true);
  setMsg("");

  try {
    const cleanShip = ship?.trim() || "Vessel";
    const cleanRef = reference?.trim() || declarationId || "No-Ref";

    const pdfBase64 = await buildPdfBase64();

    const res = await fetch("/api/send-maritime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "yanbuports@gmail.com",
        subject: `شهادة فسح الباخرة - ${cleanShip}`,
        pdfFileName: `Clearance-${cleanShip}-${cleanRef}.pdf`,
        pdfBase64,
        declarationId,
        skipAttachments: true,
        html: `
          <div dir="rtl">
            <h3>شهادة فسح الباخرة</h3>
            <p>اسم السفينة: ${cleanShip}</p>
            <p>التاريخ: ${new Date().toLocaleDateString("ar-SA")}</p>
          </div>
        `,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "فشل الإرسال");
    }

    setMsg("تم إرسال شهادة الفسح بنجاح ✅");
  } catch (err: any) {
    console.error("❌ خطأ في الإرسال:", err);
    setMsg(err.message || "حدث خطأ أثناء الإرسال");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={send}
        disabled={loading}
        className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-800 disabled:opacity-60"
      >
        {loading ? "جاري التصدير والإرسال..." : "📧 إرسال شهادة الفسح"}
      </button>

      {msg && <p className="text-xs font-bold text-green-700">{msg}</p>}
    </div>
  );
}