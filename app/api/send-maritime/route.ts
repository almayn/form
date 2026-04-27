import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";

// ... (نفس المستوردات السابقة)

export async function POST(req: NextRequest) {
  try {
    const {
  to,
  subject,
  html,
  pdfBase64,
  pdfFileName,
  declarationId,
  skipAttachments,
} = await req.json();

    // 1. التحقق من البيانات الأساسية
    if (!to || !pdfBase64 || !declarationId) {
      return NextResponse.json({ error: "بيانات ناقصة (الإيميل أو الملف أو رقم المعاملة)" }, { status: 400 });
    }

    // 2. جلب بيانات المعاملة
    const { data: declaration, error: declarationError } = await supabase
      .from("maritime_health_declarations")
      .select("id, reference_no, ship_name")
      .eq("id", declarationId)
      .single();

    if (declarationError || !declaration) throw new Error("المعاملة غير موجودة في قاعدة البيانات");

    // 3. جلب المرفقات الإضافية من الجدول
  let dbAttachments: any[] = [];

if (!skipAttachments) {
  const { data, error: attachmentsError } = await supabase
    .from("maritime_attachments")
    .select("*")
    .eq("declaration_id", declarationId);

  if (attachmentsError) {
    console.error("Error fetching attachments:", attachmentsError);
  }

  dbAttachments = data || [];
}

    const attachmentDisplayNames: Record<string, string> = {
      sanitation_certificate: "Sanitation-Certificate",
      crew_list: "Crew-List",
      vaccination_certificate: "Vaccination-Certificate",
      last_10_ports: "Last-10-Ports",
      general_attachment: "Other-Attachment",
    };

    // 4. معالجة المرفقات وتحميلها من Storage
    const extraAttachments = await Promise.all(
      (dbAttachments || []).map(async (item, index) => {
        try {
          // تحسين استخراج المسار: إذا كان رابط كامل نأخذ ما بعد اسم الباكت، وإذا كان مساراً نأخذه كما هو
          let filePath = item.file_url;
          if (filePath.includes("/maritime-docs/")) {
            filePath = filePath.split("/maritime-docs/")[1];
          }

          const { data, error } = await supabase.storage
            .from("maritime-docs")
            .download(filePath);

          if (error || !data) {
            console.error(`فشل تحميل الملف ${filePath}:`, error);
            return null; // نرجع null لنتجاهل المرفق الفاشل بدلاً من إيقاف العملية كاملة
          }

          // تحويل Blob إلى Buffer بطريقة آمنة في Node.js
          const arrayBuffer = await data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const baseName = attachmentDisplayNames[item.attachment_type] || "Attachment";
          const extension = item.file_name?.split('.').pop() || "jpg"; // استخراج الامتداد الأصلي

          return {
            filename: `${baseName}-${index + 1}.${extension}`,
            content: buffer,
          };
        } catch (err) {
          console.error("خطأ في معالجة المرفق:", err);
          return null;
        }
      })
    );

    // تصفية المصفوفة من أي مرفقات فشل تحميلها (null)
    const validAttachments = extraAttachments.filter((a) => a !== null);

    // 5. إعداد NodeMailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"نظام الموانئ - Yanbu Port" <${process.env.EMAIL_USER}>`,
      to,
      subject: subject || `الإقرار الصحي البحري - ${declaration.ship_name}`,
      html: html || `<h3>مرفق لكم مستندات الإقرار الصحي رقم ${declaration.reference_no}</h3>`,
      attachments: [
        {
          filename: pdfFileName || `Declaration-${declaration.reference_no}.pdf`,
          content: pdfBase64,
          encoding: "base64",
        },
        ...validAttachments as any,
      ],
    });

    // 6. تحديث الحالة
    await supabase.from("maritime_health_declarations").update({ status: "sent" }).eq("id", declarationId);

    return NextResponse.json({ 
      success: true, 
      attachmentsCount: skipAttachments ? 0 : validAttachments.length
    });

  } catch (error: any) {
    console.error("Global Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}