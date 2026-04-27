"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "@/lib/supabase";

export default function SendPdfEmailButton({
  declarationId,
  reference,
  ship,
  imo,
  officer,
}: {
  declarationId: string;
  reference: string;
  ship: string;
  imo?: string;
  officer?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const buildPdfBase64 = async () => {
    // 1. العثور على العنصر (نموذج الإقرار الصحي)
    const element = document.getElementById("maritime-pdf-area");
    if (!element) throw new Error("لم يتم العثور على منطقة PDF");

    // 2. التأكد من تحميل الخطوط والصور قبل الالتقاط
    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. حفظ الأنماط الأصلية للاستعادة لاحقاً
    const originalStyle = {
      width: element.style.width,
      maxWidth: element.style.maxWidth,
      minWidth: element.style.minWidth,
      position: element.style.position,
      left: element.style.left,
      transform: element.style.transform,
    };

    // ✅ إجبار العنصر على أبعاد A4 ثابتة للالتقاط (210mm ≈ 794px @ 96DPI)
    // هذا يضمن أن الـ PDF يكون متناسقاً بغض النظر عن حجم شاشة الجهاز
    element.style.width = "794px";
    element.style.maxWidth = "794px";
    element.style.minWidth = "794px";
    element.style.position = "absolute";
    element.style.left = "-9999px"; // إخفاء خارج الشاشة لتجنب الوميض
    element.style.transform = "scale(1)"; // إلغاء أي تحويلات زووم

    // ✅ إجبار كل الصفحات الداخلية على عرض ثابت أيضاً
    const pages = element.querySelectorAll(".pdf-page");
    pages.forEach((page) => {
      (page as HTMLElement).style.width = "794px";
      (page as HTMLElement).style.minWidth = "794px";
      (page as HTMLElement).style.maxWidth = "794px";
    });

    try {
      // 4. إعدادات التقاط عالية الجودة مع أبعاد ثابتة
      const canvas = await html2canvas(element, {
        scale: 2, // دقة مضاعفة (Retina) لجودة نص عالية
        useCORS: true, // للسماح بالتقاط صور خارجية (التوقيع/الختم)
        backgroundColor: "#ffffff", // خلفية بيضاء نقية
        logging: false,
        width: 794, // ✅ عرض ثابت للالتقاط لضمان A4 على كل الأجهزة
        height: element.scrollHeight, // ارتفاع ديناميكي حسب المحتوى
        ignoreElements: (el) => el.tagName === "STYLE",
        onclone: (doc) => {
          // تعقيم الألوان ومنع أخطاء lab() في المتصفحات الحديثة
          doc.querySelectorAll("*").forEach((el) => {
            const node = el as HTMLElement;
            // استثناء الصور من تغيير الألوان للحفاظ على التوقيع والختم
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

      // ✅ استعادة الأنماط الأصلية بعد الالتقاط فوراً
      element.style.width = originalStyle.width;
      element.style.maxWidth = originalStyle.maxWidth;
      element.style.minWidth = originalStyle.minWidth;
      element.style.position = originalStyle.position;
      element.style.left = originalStyle.left;
      element.style.transform = originalStyle.transform;
      
      pages.forEach((page) => {
        (page as HTMLElement).style.width = "";
        (page as HTMLElement).style.minWidth = "";
        (page as HTMLElement).style.maxWidth = "";
      });

      // 5. تحويل الصورة لـ PDF
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  // الإقرار الصحي صفحتان فقط
pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);

// الصفحة الثانية فقط
pdf.addPage();
pdf.addImage(imgData, "JPEG", 0, -pageHeight, imgWidth, imgHeight);
      const dataUri = pdf.output("datauristring");
      return dataUri.split(",")[1];
    } catch (error) {
      // استعادة الأنماط في حالة حدوث خطأ
      element.style.width = originalStyle.width;
      element.style.maxWidth = originalStyle.maxWidth;
      element.style.minWidth = originalStyle.minWidth;
      element.style.position = originalStyle.position;
      element.style.left = originalStyle.left;
      element.style.transform = originalStyle.transform;
      
      pages.forEach((page) => {
        (page as HTMLElement).style.width = "";
        (page as HTMLElement).style.minWidth = "";
        (page as HTMLElement).style.maxWidth = "";
      });
      
      console.error("❌ خطأ في إنشاء PDF:", error);
      throw new Error("فشل إنشاء ملف PDF");
    }
  };

  const send = async () => {
    setLoading(true);
    setMsg("");

    try {
      const cleanShip = ship?.trim() || "Vessel";
      const cleanImo = imo?.trim() || reference?.trim() || "No-IMO";
      const cleanOfficer = officer?.trim() || "غير محدد";

      // إنشاء ملف PDF
      const pdfBase64 = await buildPdfBase64();

      // إرسال للـ API
      const res = await fetch("/api/send-maritime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "yanbuports@gmail.com",
          subject: `إقرار ${cleanShip} - ${cleanImo} | ${cleanOfficer}`,
          pdfFileName: `${cleanShip}-${cleanImo}.pdf`,
          pdfBase64,
          declarationId,
          html: `
            <div dir="rtl">
              <h3>الإقرار الصحي البحري</h3>
              <p>مرفق لكم ملف PDF للمعاملة رقم ${reference}</p>
            </div>
          `,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "فشل الإرسال");

      // تحديث الحالة في قاعدة البيانات
      await supabase
        .from("maritime_health_declarations")
        .update({
          status: "sent",
          email_sent: true,
          sent_at: new Date().toISOString(),
        })
        .eq("id", declarationId);

      setMsg("تم الإرسال بنجاح ✅");
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
        className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 hover:bg-green-800 transition"
      >
        {loading ? "جاري التصدير والإرسال..." : "📧 إرسال PDF"}
      </button>
      {msg && <p className="text-xs font-bold text-green-700">{msg}</p>}
    </div>
  );
}