"use client";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function ExportPdfButton() {
  const exportPdf = async () => {
    const element = document.getElementById("maritime-pdf-area");
    if (!element) return;

await document.fonts.ready;
await new Promise((r) => setTimeout(r, 400));

   const canvas = await html2canvas(element, {
  scale: 2,
  useCORS: true,
  backgroundColor: "#ffffff",

  ignoreElements: (el) => {
    return el.tagName === "STYLE";
  },

  onclone: (doc) => {
    doc.querySelectorAll("*").forEach((el) => {
      const node = el as HTMLElement;

      node.style.color = "#0f172a";
      node.style.backgroundColor = "#ffffff";
      node.style.borderColor = "#e2e8f0";
      node.style.boxShadow = "none";
      doc.querySelectorAll(".pdf-only-break").forEach((el) => {
  const node = el as HTMLElement;
  node.style.display = "block";
  node.style.height = "70mm";
});
    });
  },
});

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = 210;
    const pageHeight = 297;

  const imgWidth = pageWidth;

// نخلي الصورة الطويلة موزعة على صفحتين فقط
const imgHeight = pageHeight * 2;

pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);

pdf.addPage();
pdf.addImage(imgData, "JPEG", 0, -pageHeight, imgWidth, imgHeight);

    pdf.save(`maritime-declaration-${Date.now()}.pdf`);
  };

  return (
    <button
      onClick={exportPdf}
      className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white"
    >
      إصدار PDF مباشر
    </button>
  );
}