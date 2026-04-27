"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import SignaturePad from "@/components/SignaturePad";
import countries from "i18n-iso-countries";
import arCountries from "i18n-iso-countries/langs/ar.json";
import enCountries from "i18n-iso-countries/langs/en.json";
import StampCropper from "@/components/StampCropper";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
countries.registerLocale(arCountries);
countries.registerLocale(enCountries);

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function currentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function toArabicFlag(flag?: string | null) {
  if (!flag) return "";
  const cleanFlag = flag.trim();
  const code = countries.getAlpha2Code(cleanFlag, "en");
  if (!code) return cleanFlag;
  return countries.getName(code, "ar") || cleanFlag;
}

function getSanitationCertificateStatus(issueDate?: string | null) {
  if (!issueDate) {
    return {
      text: "لم يتم إدخال تاريخ الإصدار",
      className: "bg-slate-100 text-slate-500 border-slate-200",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const issued = new Date(issueDate);
  issued.setHours(0, 0, 0, 0);

  const expiryDate = new Date(issued);
  expiryDate.setMonth(expiryDate.getMonth() + 6);

  const diffMs = expiryDate.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      text: `منتهية ${Math.abs(daysLeft)} يوم`,
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }

  if (daysLeft < 30) {
    return {
      text: `${daysLeft} يوم`,
      className: "bg-yellow-50 text-yellow-800 border-yellow-200",
    };
  }

  return {
    text: `${daysLeft} يوم`,
    className: "bg-green-50 text-green-700 border-green-200",
  };
}

type AttachmentItem = {
  file: File;
  type: string;
};

function Field({
  label,
  type = "text",
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  type?: string;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-700 ${
          disabled ? "bg-slate-100 text-slate-600" : "bg-white"
        }`}
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
      <span className="text-sm font-bold text-slate-700">{label}</span>
    </label>
  );
}

export default function NewMaritimeDeclarationPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [arrivalStatus, setArrivalStatus] = useState<"waiting" | "arrived">("waiting");
  const [expectedArrival, setExpectedArrival] = useState("");

  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [officerSignatureDataUrl, setOfficerSignatureDataUrl] = useState("");
const [recipientSignatureDataUrl, setRecipientSignatureDataUrl] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [stampPreviewUrl, setStampPreviewUrl] = useState("");
  
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [form, setForm] = useState({
    submitted_at_port: "ينبع التجاري",
    submission_date: todayDate(),

    ship_name: "",
    vessel_nationality: "",
    registration_imo_no: "",
    master_name: "",
    arriving_from: "",
    sailing_to: "للأمر",

    gross_tonnage_ship: "",
    crew_count: "",
    cargo_type: "",
    local_agent_name: "",
    passengers_count: "",
    vessel_type: "external",
    umrah_count: "",

    q1_death_other_than_accident: false,
    q2_infectious_case_suspected: false,
    q3_total_ill_passengers_greater_than_normal: false,
    q4_any_ill_person_on_board_now: false,
    q5_medical_practitioner_consulted: false,
    q6_any_condition_lead_to_infection_spread: false,
    q7_sanitary_measure_applied: false,
    q8_stowaways_found: false,
    q9_sick_animal_or_pet: false,

    has_valid_sanitation_certificate: false,
    sanitation_certificate_issued_at: "",
    sanitation_certificate_issued_date: "",

    reinspection_required: false,

    visited_who_affected_area: false,
    affected_area_port: "",
    affected_area_date: "",

    last_ports_text: "",
    joined_persons_text: "",
    passenger_nationalities_text: "",

    q1_death_particulars: "",
    q2_case_particulars: "",
    q4_ill_person_particulars: "",
    q5_medical_treatment_details: "",
    q6_condition_particulars: "",
    q7_sanitary_measure_details: "",
    q8_stowaways_joined_ship_details: "",

    free_pratique_time: "",
    free_pratique_date: "",
    sanitary_officer_in_charge: "",
    certificate_recipient_name: "",
    recipient_designation: "",
  });

  useEffect(() => {
    const loadUsers = async () => {
      const { data } = await supabase
        .from("maritime_users")
        .select("id, name")
        .order("name", { ascending: true });
      if (data) setUsers(data);
    };
    loadUsers();
  }, []);

  useEffect(() => {
    if (!editId) return;

    const loadData = async () => {
      const { data } = await supabase
        .from("maritime_health_declarations")
        .select("*")
        .eq("id", editId)
        .single();

      if (!data) return;

      setForm((prev) => ({
        ...prev,
        submitted_at_port: data.submitted_at_port || "",
        submission_date: data.submission_date || "",
        ship_name: data.ship_name || "",
        vessel_nationality: data.vessel_nationality || "",
        registration_imo_no: data.registration_imo_no || "",
        master_name: data.master_name || "",
        arriving_from: data.arriving_from || "",
        sailing_to: data.sailing_to || "",
        gross_tonnage_ship: data.gross_tonnage_ship || "",
        crew_count: data.crew_count || "",
        cargo_type: data.cargo_type || "",
        local_agent_name: data.local_agent_name || "",
        passengers_count: data.passengers_count || "",
        umrah_count: data.umrah_count || "",
        sanitary_officer_in_charge: data.sanitary_officer_in_charge || "",
        free_pratique_date: data.free_pratique_date || "",
        free_pratique_time: data.free_pratique_time || "",
        has_valid_sanitation_certificate: data.has_valid_sanitation_certificate || false,
        sanitation_certificate_issued_at: data.sanitation_certificate_issued_at || "",
        sanitation_certificate_issued_date: data.sanitation_certificate_issued_date || "",
        reinspection_required: data.reinspection_required || false,
        visited_who_affected_area: data.visited_who_affected_area || false,
        affected_area_port: data.affected_area_port || "",
        affected_area_date: data.affected_area_date || "",
        last_ports_text: data.last_ports_text || "",
        joined_persons_text: data.joined_persons_text || "",
        passenger_nationalities_text: data.passenger_nationalities_text || "",
        q1_death_other_than_accident: data.q1_death_other_than_accident || false,
        q2_infectious_case_suspected: data.q2_infectious_case_suspected || false,
        q3_total_ill_passengers_greater_than_normal: data.q3_total_ill_passengers_greater_than_normal || false,
        q4_any_ill_person_on_board_now: data.q4_any_ill_person_on_board_now || false,
        q5_medical_practitioner_consulted: data.q5_medical_practitioner_consulted || false,
        q6_any_condition_lead_to_infection_spread: data.q6_any_condition_lead_to_infection_spread || false,
        q7_sanitary_measure_applied: data.q7_sanitary_measure_applied || false,
        q8_stowaways_found: data.q8_stowaways_found || false,
        q9_sick_animal_or_pet: data.q9_sick_animal_or_pet || false,
        q1_death_particulars: data.q1_death_particulars || "",
        q2_case_particulars: data.q2_case_particulars || "",
        q4_ill_person_particulars: data.q4_ill_person_particulars || "",
        q5_medical_treatment_details: data.q5_medical_treatment_details || "",
        q6_condition_particulars: data.q6_condition_particulars || "",
        q7_sanitary_measure_details: data.q7_sanitary_measure_details || "",
        q8_stowaways_joined_ship_details: data.q8_stowaways_joined_ship_details || "",
        certificate_recipient_name: data.certificate_recipient_name || "",
        recipient_designation: data.recipient_designation || "",
      }));
  // ✅ إضافة هذين السطرين فقط
      if (data.master_signature_url) setSignatureDataUrl(data.master_signature_url);
      if (data.ship_stamp_url) setStampPreviewUrl(data.ship_stamp_url);
      if (data.clearance_officer_signature_url) {
  setOfficerSignatureDataUrl(data.clearance_officer_signature_url);
}

if (data.clearance_recipient_signature_url) {
  setRecipientSignatureDataUrl(data.clearance_recipient_signature_url);
}
      if (data.free_pratique_date && data.free_pratique_date.trim() !== "") {
        setArrivalStatus("arrived");
      } else {
        setArrivalStatus("waiting");
      }
      setExpectedArrival(data.expected_arrival || "");
    };

    loadData();
  }, [editId]);

  const update = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const dataUrlToFile = async (dataUrl: string, fileName: string) => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], fileName, { type: "image/png" });
  };

  const uploadFile = async (path: string, file: File) => {
  const { error } = await supabase.storage
    .from("maritime-docs")
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (error) {
    console.error("❌ خطأ في رفع الملف:", error);
    throw error;
  }

  // ✅ استخدم createSignedUrl لضمان الوصول حتى لو كانت الصلاحيات غير واضحة
  const { data: signedData, error: signedError } = await supabase.storage
    .from("maritime-docs")
    .createSignedUrl(path, 60 * 60 * 24 * 365); // صلاحية سنة

  if (signedError) {
    // fallback إلى public URL إذا فشل signed
    const { data: publicData } = supabase.storage.from("maritime-docs").getPublicUrl(path);
    return publicData.publicUrl;
  }

  return signedData.signedUrl;
};

  const handleAttachments = (files: FileList | null, type: string) => {
    if (!files) return;
    const newFiles = Array.from(files).map((file) => ({
      file,
      type,
    }));
    setAttachments((prev) => [...prev, ...newFiles]);
  };

 const saveDeclaration = async () => {
    setLoading(true);
    setMessage("");

    try {
      if (!form.submitted_at_port || !form.submission_date || !form.ship_name) {
        throw new Error("أدخل الميناء والتاريخ واسم السفينة على الأقل");
      }

      if (arrivalStatus === "arrived" && !signatureDataUrl) {
        throw new Error("توقيع الربان مطلوب عند وصول السفينة");
      }

      // ... (كود التحقق من السفينة وتحديث بياناتها) ...
      const cleanImo = form.registration_imo_no.trim();
      if (cleanImo && form.ship_name.trim()) {
        const { data: existingShip } = await supabase
          .from("ships")
          .select("id")
          .eq("imo", cleanImo)
          .maybeSingle();

        if (!existingShip) {
          await supabase.from("ships").insert({
            imo: cleanImo,
            name: form.ship_name.trim().toUpperCase(),
            flag: form.vessel_nationality.trim() || null,
            type: form.cargo_type?.trim() || null,
          });
        }
      }

      let finalFreePratiqueTime = form.free_pratique_time;
      let computedArrivalStatus: "waiting" | "arrived" = "waiting";

      if (form.free_pratique_date && form.free_pratique_date.trim() !== "") {
        computedArrivalStatus = "arrived";
        if (!finalFreePratiqueTime) finalFreePratiqueTime = currentTime();
      }

      const declarationPayload = {
        // ... (بقية الـ Payload كما هي في كودك) ...
        submitted_at_port: form.submitted_at_port,
        submission_date: form.submission_date,
        ship_name: form.ship_name,
        vessel_nationality: form.vessel_nationality,
        registration_imo_no: form.registration_imo_no,
        master_name: form.master_name,
        arriving_from: form.arriving_from,
        sailing_to: form.sailing_to || "للأمر",
        gross_tonnage_ship: form.gross_tonnage_ship ? Number(form.gross_tonnage_ship) : null,
        crew_count: form.crew_count ? Number(form.crew_count) : 0,
        cargo_type: form.cargo_type || null,
        local_agent_name: form.local_agent_name || null,
        passengers_count: form.passengers_count ? Number(form.passengers_count) : 0,
        vessel_type: form.vessel_type || "external",
        umrah_count: form.umrah_count ? Number(form.umrah_count) : 0,
        arrival_status: computedArrivalStatus,
        expected_arrival: expectedArrival || null,
        free_pratique_time: finalFreePratiqueTime || null,
        free_pratique_date: form.free_pratique_date || null,
        sanitary_officer_in_charge: form.sanitary_officer_in_charge || null,
        certificate_recipient_name: form.certificate_recipient_name || null,
        recipient_designation: form.recipient_designation || null,
        has_valid_sanitation_certificate: form.has_valid_sanitation_certificate,
        sanitation_certificate_issued_at: form.sanitation_certificate_issued_at || null,
        sanitation_certificate_issued_date: form.sanitation_certificate_issued_date || null,
        reinspection_required: form.reinspection_required,
        visited_who_affected_area: form.visited_who_affected_area,
        affected_area_port: form.affected_area_port || null,
        affected_area_date: form.affected_area_date || null,
        q1_death_other_than_accident: form.q1_death_other_than_accident,
        q2_infectious_case_suspected: form.q2_infectious_case_suspected,
        q3_total_ill_passengers_greater_than_normal: form.q3_total_ill_passengers_greater_than_normal,
        q4_any_ill_person_on_board_now: form.q4_any_ill_person_on_board_now,
        q5_medical_practitioner_consulted: form.q5_medical_practitioner_consulted,
        q6_any_condition_lead_to_infection_spread: form.q6_any_condition_lead_to_infection_spread,
        q7_sanitary_measure_applied: form.q7_sanitary_measure_applied,
        q8_stowaways_found: form.q8_stowaways_found,
        q9_sick_animal_or_pet: form.q9_sick_animal_or_pet,
        q1_death_particulars: form.q1_death_particulars,
        q2_case_particulars: form.q2_case_particulars,
        q4_ill_person_particulars: form.q4_ill_person_particulars,
        q5_medical_treatment_details: form.q5_medical_treatment_details,
        q6_condition_particulars: form.q6_condition_particulars,
        q7_sanitary_measure_details: form.q7_sanitary_measure_details,
        q8_stowaways_joined_ship_details: form.q8_stowaways_joined_ship_details,
        last_ports_text: form.last_ports_text || null,
        joined_persons_text: form.joined_persons_text || null,
        passenger_nationalities_text: form.passenger_nationalities_text || null,
        master_declaration_confirmed: true,
      };

      let declaration;
      let dbError;

      if (editId) {
        const res = await supabase.from("maritime_health_declarations").update(declarationPayload).eq("id", editId).select().single();
        declaration = res.data;
        dbError = res.error;
      } else {
        const res = await supabase.from("maritime_health_declarations").insert({
          ...declarationPayload,
          reference_no: `MHD-${Date.now()}`,
          status: "draft",
          created_by: form.sanitary_officer_in_charge || null,
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          vessel_type: "external",
        }).select().single();
        declaration = res.data;
        dbError = res.error;
      }

      if (dbError) throw dbError;

      // 1. رفع التوقيع
      if (signatureDataUrl && signatureDataUrl.startsWith("data:")) {
        const signatureFile = await dataUrlToFile(signatureDataUrl, "signature.png");
        const signatureUrl = await uploadFile(`declarations/${declaration.id}/signature.png`, signatureFile);
        await supabase.from("maritime_health_declarations").update({ master_signature_url: signatureUrl }).eq("id", declaration.id);
      }
if (
  officerSignatureDataUrl &&
  officerSignatureDataUrl.startsWith("data:")
) {
  const officerFile = await dataUrlToFile(
    officerSignatureDataUrl,
    "clearance-officer-signature.png"
  );

  const officerUrl = await uploadFile(
    `declarations/${declaration.id}/clearance-officer-signature.png`,
    officerFile
  );

  await supabase
    .from("maritime_health_declarations")
    .update({ clearance_officer_signature_url: officerUrl })
    .eq("id", declaration.id);
}

if (
  recipientSignatureDataUrl &&
  recipientSignatureDataUrl.startsWith("data:")
) {
  const recipientFile = await dataUrlToFile(
    recipientSignatureDataUrl,
    "clearance-recipient-signature.png"
  );

  const recipientUrl = await uploadFile(
    `declarations/${declaration.id}/clearance-recipient-signature.png`,
    recipientFile
  );

  await supabase
    .from("maritime_health_declarations")
    .update({ clearance_recipient_signature_url: recipientUrl })
    .eq("id", declaration.id);
}
      // 2. رفع الختم
      if (stampFile) {
        const stampPath = `declarations/${declaration.id}/ship-stamp.png`;
        const stampUrl = await uploadFile(stampPath, stampFile);
        await supabase.from("maritime_health_declarations").update({ ship_stamp_url: stampUrl }).eq("id", declaration.id);
      }

      // 3. 🆕 رفع المرفقات المتعددة (هنا نضع الكود الذي سبب الخطأ)
      if (attachments.length > 0) {
        console.log(`⏳ جاري رفع ${attachments.length} مرفق...`);
        await Promise.all(attachments.map(async (item, index) => {
          const fileExt = item.file.name.split('.').pop();
          const fileName = `${item.type}-${Date.now()}-${index}.${fileExt}`;
          const filePath = `declarations/${declaration.id}/attachments/${fileName}`;
          
          const fileUrl = await uploadFile(filePath, item.file);
          
          const { error: attError } = await supabase.from("maritime_attachments").insert({
            declaration_id: declaration.id,
            attachment_type: item.type,
            file_name: fileName,
            original_file_name: item.file.name,
            file_url: fileUrl,
            mime_type: item.file.type,
            file_size: item.file.size
          });
          if (attError) throw attError;
        }));
        setAttachments([]);
      }

      update("free_pratique_time", finalFreePratiqueTime);
      setArrivalStatus(computedArrivalStatus);
      setMessage(editId ? "تم تحديث المعاملة بنجاح ✅" : `تم حفظ المعاملة بنجاح. رقمها: ${declaration.reference_no}`);
    } catch (error: any) {
      setMessage(error.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const sanitationCertificateStatus = getSanitationCertificateStatus(
    form.sanitation_certificate_issued_date
  );

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
          <p className="text-sm text-amber-300">Maritime Health Declaration</p>
          <h1 className="mt-2 text-2xl font-black">
            نظام الإقرار الصحي والفسح البحري
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            نسخة أولية لحفظ النموذج والتوقيع والمرفقات
          </p>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-slate-900">بيانات السفينة والرحلة</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="الميناء المقدم إليه" value={form.submitted_at_port} onChange={(v) => update("submitted_at_port", v)} disabled />
            <Field label="التاريخ" type="date" value={form.submission_date} onChange={(v) => update("submission_date", v)} />
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">رقم التسجيل / IMO</span>
              <input
                type="text"
                value={form.registration_imo_no ?? ""}
                onChange={async (e) => {
                  const imo = e.target.value.trim();
                  update("registration_imo_no", imo);
                  if (imo.length === 7) {
                    const { data } = await supabase.from("ships").select("imo, name, flag, type").eq("imo", imo).maybeSingle();
                    if (data) {
                      update("ship_name", data.name || "");
                      if (data.flag) update("vessel_nationality", toArabicFlag(data.flag));
                      if (data.type) update("cargo_type", data.type);
                    }
                  }
                }}
                placeholder="مثال: 9952957"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-700"
              />
            </label>
            <Field label="اسم السفينة" value={form.ship_name} onChange={(v) => update("ship_name", v)} />
            <Field label="الجنسية / علم السفينة" value={form.vessel_nationality} onChange={(v) => update("vessel_nationality", v)} />
            <Field label="اسم الربان" value={form.master_name} onChange={(v) => update("master_name", v)} />
            <Field label="قادمة من" value={form.arriving_from} onChange={(v) => update("arriving_from", v)} />
            <Field label="مبحرة إلى" value={form.sailing_to} onChange={(v) => update("sailing_to", v)} />
            <Field label="الحمولة الإجمالية" type="number" value={form.gross_tonnage_ship} onChange={(v) => update("gross_tonnage_ship", v)} />
            <Field label="عدد الطاقم" type="number" value={form.crew_count} onChange={(v) => update("crew_count", v)} />
            <Field label="نوع الشحنة" value={form.cargo_type} onChange={(v) => update("cargo_type", v)} />
              <label className="block space-y-2">
  <span className="text-sm font-bold text-slate-700">تصنيف السفينة</span>

  <select
    value={form.vessel_type}
    onChange={(e) => update("vessel_type", e.target.value)}
    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
  >
    <option value="external">خارجية</option>
    <option value="internal">داخلية</option>
  </select>
</label>
            <Field label="اسم الوكيل" value={form.local_agent_name} onChange={(v) => update("local_agent_name", v)} />
            <Field label="عدد الركاب" type="number" value={form.passengers_count} onChange={(v) => update("passengers_count", v)} />
              <Field
  label="عدد المعتمرين"
  type="number"
  value={form.umrah_count}
  onChange={(v) => update("umrah_count", v)}
/>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-slate-900">الشهادة الصحية</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Check label="هل توجد شهادة رقابة صحية سارية؟" checked={form.has_valid_sanitation_certificate} onChange={(v) => update("has_valid_sanitation_certificate", v)} />
            <Field label="مكان إصدار الشهادة" value={form.sanitation_certificate_issued_at} onChange={(v) => update("sanitation_certificate_issued_at", v)} />
            <Field label="تاريخ إصدار الشهادة" type="date" value={form.sanitation_certificate_issued_date} onChange={(v) => update("sanitation_certificate_issued_date", v)} />
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">المدة المتبقية للشهادة</span>
              <div className={`w-full rounded-xl border px-4 py-3 text-center text-sm font-black ${sanitationCertificateStatus.className}`}>
                {sanitationCertificateStatus.text}
              </div>
            </label>
            <Check label="هل يلزم إعادة التفتيش؟" checked={form.reinspection_required} onChange={(v) => update("reinspection_required", v)} />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-slate-900">مناطق الخطر</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Check label="هل زارت السفينة منطقة متأثرة؟" checked={form.visited_who_affected_area} onChange={(v) => update("visited_who_affected_area", v)} />
            <Field label="اسم الميناء" value={form.affected_area_port} onChange={(v) => update("affected_area_port", v)} />
            <Field label="التاريخ" type="date" value={form.affected_area_date} onChange={(v) => update("affected_area_date", v)} />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-slate-900">معلومات إضافية</h2>
          <div className="space-y-4">
            <textarea placeholder="آخر 10 موانئ" value={form.last_ports_text} onChange={(e) => update("last_ports_text", e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-700" />
            <textarea placeholder="الأشخاص الذين انضموا" value={form.joined_persons_text} onChange={(e) => update("joined_persons_text", e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-700" />
            <textarea placeholder="توزيع الركاب حسب الجنسيات" value={form.passenger_nationalities_text} onChange={(e) => update("passenger_nationalities_text", e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-blue-700" />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-slate-900">الأسئلة الصحية</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Check label="هل توفي أحد لسبب غير الحوادث؟" checked={form.q1_death_other_than_accident} onChange={(v) => update("q1_death_other_than_accident", v)} />
            <Check label="هل توجد حالة مرضية معدية مشتبهة؟" checked={form.q2_infectious_case_suspected} onChange={(v) => update("q2_infectious_case_suspected", v)} />
            <Check label="هل عدد المرضى أكبر من المعتاد؟" checked={form.q3_total_ill_passengers_greater_than_normal} onChange={(v) => update("q3_total_ill_passengers_greater_than_normal", v)} />
            <Check label="هل يوجد مريض حالياً على متن السفينة؟" checked={form.q4_any_ill_person_on_board_now} onChange={(v) => update("q4_any_ill_person_on_board_now", v)} />
            <Check label="هل تمت استشارة طبيب؟" checked={form.q5_medical_practitioner_consulted} onChange={(v) => update("q5_medical_practitioner_consulted", v)} />
            <Check label="هل توجد حالة قد تؤدي لانتشار مرض؟" checked={form.q6_any_condition_lead_to_infection_spread} onChange={(v) => update("q6_any_condition_lead_to_infection_spread", v)} />
            <Check label="هل طُبقت تدابير صحية؟" checked={form.q7_sanitary_measure_applied} onChange={(v) => update("q7_sanitary_measure_applied", v)} />
            <Check label="هل عُثر على متسللين؟" checked={form.q8_stowaways_found} onChange={(v) => update("q8_stowaways_found", v)} />
            <Check label="هل يوجد حيوان مريض على متن السفينة؟" checked={form.q9_sick_animal_or_pet} onChange={(v) => update("q9_sick_animal_or_pet", v)} />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow">
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">حالة الوصول</span>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              {arrivalStatus === "waiting" ? "⏳ في قائمة الانتظار" : "✅ وصلت وتم فسحها"}
            </div>
          </label>
          {arrivalStatus === "waiting" && (
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-bold text-slate-700">موعد الوصول المتوقع (اختياري)</span>
              <input type="datetime-local" value={expectedArrival} onChange={(e) => setExpectedArrival(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-700" />
            </label>
          )}
        </section>

             <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-slate-900">التوقيع</h2>
          
          <div className="grid grid-cols-3 gap-6 border-t border-dashed border-gray-500 pt-3 text-center">
            <div className="col-span-3">
              <div className="flex h-[40px] flex-col justify-center leading-tight">
                <p className="text-[11px] font-bold">توقيع الربان</p>
                <p className="text-[9px] text-gray-600" dir="ltr">
                  Master Signature
                </p>
              </div>

              <div className="mt-2 flex h-24 items-center justify-center">
                {signatureDataUrl ? (
                  <div className="relative w-full">
                    <img
                      src={signatureDataUrl}
                      alt="توقيع الربان"
                      className="mx-auto max-h-20 object-contain"
                      style={{
                        filter: "invert(22%) sepia(98%) saturate(2500%) hue-rotate(200deg) brightness(90%) contrast(95%)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setSignatureDataUrl("")}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow hover:bg-red-600"
                    >
                      ↺ تعديل
                    </button>
                  </div>
                ) : (
                  <div className="w-full max-w-xs">
                    <SignaturePad
                      onChange={(dataUrl) => {
                        setSignatureDataUrl(dataUrl);
                        // تفعيل حالة الوصول تلقائياً عند أول توقيع
                        if (!form.free_pratique_date) {
                          update("free_pratique_date", todayDate());
                          update("free_pratique_time", currentTime());
                          setArrivalStatus("arrived");
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

             <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-slate-900">ختم السفينة</h2>

          {stampPreviewUrl && stampPreviewUrl.trim() !== "" ? (
            <div className="space-y-3">
              <div className="rounded-xl border-2 border-dashed border-purple-200 bg-purple-50 p-4 text-center">
                <p className="mb-2 text-sm font-bold text-purple-800">✅ الختم محفوظ</p>
                <img
                  src={stampPreviewUrl}
                  alt="ختم السفينة"
                  className="mx-auto max-h-32 object-contain rounded-lg border border-slate-200 bg-white p-2"
                  onError={(e) => {
                    console.error("❌ فشل تحميل الختم من:", stampPreviewUrl);
                    // اعرض رسالة بدلاً من الصورة المكسورة
                    e.currentTarget.style.display = "none";
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="text-red-500 text-sm font-bold">
                          ⚠️ الصورة غير متوفرة
                          <button 
                            onclick="window.location.reload()" 
                            class="block mx-auto mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs"
                          >
                            إعادة المحاولة
                          </button>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm("⚠️ هل تريد استبدال الختم الحالي؟")) {
                    setStampPreviewUrl("");
                    setStampFile(null);
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                🔄 استبدال الختم
              </button>
            </div>
          ) : (
                      <StampCropper
              onStampReady={(file, previewUrl) => {
                console.log("📸 ختم جديد جاهز:", file?.name, previewUrl);
                setStampFile(file);
                setStampPreviewUrl(previewUrl);
              }}
            />
          )}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-slate-900">المرفقات</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: "شهادة الرقابة الصحية", desc: "PDF أو صورة", type: "sanitation_certificate", multiple: false },
              { title: "قائمة الطاقم Crew List", desc: "PDF أو صورة", type: "crew_list", multiple: false },
              { title: "شهادة التطعيم Vaccination", desc: "PDF أو صورة", type: "vaccination_certificate", multiple: false },
              { title: "Last 10 Ports", desc: "آخر 10 موانئ", type: "last_10_ports", multiple: false },
              { title: "مرفقات أخرى", desc: "يمكن اختيار أكثر من ملف", type: "general_attachment", multiple: true },
            ].map((item) => (
              <label key={item.type} className="group relative cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 transition hover:border-blue-700 hover:bg-blue-50">
                <input type="file" accept="image/*,.pdf" multiple={item.multiple} onChange={(e) => handleAttachments(e.target.files, item.type)} className="absolute inset-0 cursor-pointer opacity-0" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-black text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{item.desc}</p>
                  </div>
                  <div className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-black text-white shadow group-hover:bg-blue-900">اختيار ملف</div>
                </div>
              </label>
            ))}
          </div>
          {attachments.length > 0 && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 font-black text-slate-900">المرفقات المختارة ({attachments.length})</p>
              <ul className="space-y-2 text-sm">
                {attachments.map((item, index) => (
                  <li key={`${item.type}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
                    <span className="truncate font-bold text-slate-800">{item.file.name}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{item.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-slate-900">بيانات الفسح الصحي</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="وقت الفسح" type="time" value={form.free_pratique_time} onChange={(v) => update("free_pratique_time", v)} />
            <Field
              label="تاريخ الفسح"
              type="date"
              value={form.free_pratique_date}
              onChange={(v) => {
                update("free_pratique_date", v);
                if (v && v.trim() !== "") {
                  setArrivalStatus("arrived");
                  if (!form.free_pratique_time) update("free_pratique_time", currentTime());
                } else {
                  setArrivalStatus("waiting");
                  update("free_pratique_time", "");
                }
              }}
            />
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">المسؤول عن الفسح</span>
              <select value={form.sanitary_officer_in_charge} onChange={(e) => update("sanitary_officer_in_charge", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-700">
                <option value="">اختر المسؤول</option>
                {users.map((user) => (<option key={user.id} value={user.id}>{user.name}</option>))}
              </select>
              <section className="rounded-3xl bg-white p-5 shadow">
  <h2 className="mb-4 text-xl font-black text-slate-900">
    توقيعات شهادة الفسح
  </h2>

  <div className="grid gap-6 md:grid-cols-2">
    <div>
      <p className="mb-2 text-sm font-bold text-slate-700">
        توقيع المسؤول عن الفسح
      </p>

      <div className="flex min-h-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
        {officerSignatureDataUrl ? (
          <div className="relative w-full">
            <img
              src={officerSignatureDataUrl}
              alt="توقيع المسؤول عن الفسح"
              className="mx-auto max-h-24 object-contain"
              style={{
                filter:
                  "invert(22%) sepia(98%) saturate(2500%) hue-rotate(200deg) brightness(90%) contrast(95%)",
              }}
            />
            <button
              type="button"
              onClick={() => setOfficerSignatureDataUrl("")}
              className="absolute -right-2 -top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow hover:bg-red-600"
            >
              ↺ تعديل
            </button>
          </div>
        ) : (
          <div className="w-full max-w-xs">
            <SignaturePad
              onChange={(dataUrl) => setOfficerSignatureDataUrl(dataUrl)}
            />
          </div>
        )}
      </div>
    </div>

    <div>
      <p className="mb-2 text-sm font-bold text-slate-700">
        توقيع مستلم الشهادة
      </p>

      <div className="flex min-h-32 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
        {recipientSignatureDataUrl ? (
          <div className="relative w-full">
            <img
              src={recipientSignatureDataUrl}
              alt="توقيع مستلم الشهادة"
              className="mx-auto max-h-24 object-contain"
              style={{
                filter:
                  "invert(22%) sepia(98%) saturate(2500%) hue-rotate(200deg) brightness(90%) contrast(95%)",
              }}
            />
            <button
              type="button"
              onClick={() => setRecipientSignatureDataUrl("")}
              className="absolute -right-2 -top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow hover:bg-red-600"
            >
              ↺ تعديل
            </button>
          </div>
        ) : (
          <div className="w-full max-w-xs">
            <SignaturePad
              onChange={(dataUrl) => setRecipientSignatureDataUrl(dataUrl)}
            />
          </div>
        )}
      </div>
    </div>
  </div>
</section>
            </label>
            <Field label="اسم مستلم الشهادة" value={form.certificate_recipient_name} onChange={(v) => update("certificate_recipient_name", v)} />
            <Field label="وظيفة المستلم" value={form.recipient_designation} onChange={(v) => update("recipient_designation", v)} />
          </div>
        </section>

          {/* ================= زر الحفظ ================= */}
        <button
          onClick={saveDeclaration}
          disabled={loading}
          className="w-full rounded-2xl bg-blue-800 px-6 py-4 text-lg font-black text-white shadow-lg disabled:opacity-60"
        >
          {loading ? "جاري الحفظ..." : (editId ? "تحديث المعاملة" : "حفظ المعاملة")}
        </button>

        {/* ================= أزرار التصدير (تظهر فقط عند اكتمال الفسح) ================= */}
        {editId && arrivalStatus === "arrived" && (
          <section className="rounded-3xl bg-white p-5 shadow border-t-4 border-green-500 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-slate-900">✅ المعاملة مكتملة - جاهزة للتصدير</h2>
              <span className="text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                حالة: مفسوحة
              </span>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* زر تصدير محلي - ينقل لصفحة التفاصيل */}
              <Link
                href={`/maritime/${editId}`}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 transition flex items-center gap-2"
              >
                📄 تصدير PDF
              </Link>
              
              {/* زر إرسال بالبريد - ينقل لصفحة التفاصيل */}
              <Link
                href={`/maritime/${editId}`}
                className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 transition flex items-center gap-2"
              >
                📧 إرسال بالبريد
              </Link>
            </div>
            
            <p className="mt-3 text-xs text-slate-500">
              💡 اضغط على أي زر للانتقال لصفحة الشهادة الرسمية وإتمام التصدير
            </p>
          </section>
        )}


        {message && (<div className="rounded-2xl bg-white p-4 text-center font-bold shadow">{message}</div>)}
      </div>
    </main>
  );
}