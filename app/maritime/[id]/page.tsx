import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExportPdfButton from "@/components/ExportPdfButton";
import SendPdfEmailButton from "@/components/SendPdfEmailButton";

type Declaration = {
  id: string;
  reference_no: string | null;
  status: string;
  submitted_at_port: string;
  submission_date: string;
  ship_name: string;
  vessel_nationality: string;
  registration_imo_no: string;
  master_name: string;
  arriving_from: string;
  sailing_to: string;
  gross_tonnage_ship: number | null;
  crew_count: number;
  cargo_type: string | null;
  local_agent_name: string | null;
  passengers_count: number;
  umrah_count: number | null;
  ship_stamp_url: string | null;

  q1_death_other_than_accident: boolean;
  q2_infectious_case_suspected: boolean;
  q3_total_ill_passengers_greater_than_normal: boolean;
  q4_any_ill_person_on_board_now: boolean;
  q5_medical_practitioner_consulted: boolean;
  q6_any_condition_lead_to_infection_spread: boolean;
  q7_sanitary_measure_applied: boolean;
  q8_stowaways_found: boolean;
  q9_sick_animal_or_pet: boolean;

  master_signature_url: string | null;

  free_pratique_time: string | null;
  free_pratique_date: string | null;
  sanitary_officer_in_charge: string | null;
  created_by: string | null;
maritime_users:
  | {
      name: string;
    }
  | {
      name: string;
    }[]
  | null;

  has_valid_sanitation_certificate: boolean | null;
  sanitation_certificate_issued_at: string | null;
  sanitation_certificate_issued_date: string | null;
  visited_who_affected_area: boolean | null;
  affected_area_port: string | null;
  affected_area_date: string | null;
  last_ports_text: string | null;
  joined_persons_text: string | null;
  passenger_nationalities_text: string | null;
};

type Attachment = {
  attachment_type: string;
  file_name: string;
  original_file_name: string | null;
};

function Mark({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center border border-black text-[10px] font-black">
      {checked ? "✓" : ""}
    </span>
  );
}

function YesNo({ value }: { value: boolean | null | undefined }) {
  return (
    <div className="flex items-center justify-center gap-3 text-[10px]">
      <span className="inline-flex items-center gap-1">
        نعم <Mark checked={value === true} />
      </span>
      <span className="inline-flex items-center gap-1">
        لا <Mark checked={value !== true} />
      </span>
    </div>
  );
}

function val(value: string | number | null | undefined) {
  return value || "—";
}

async function signedUrl(url: string | null) {
  if (!url) return null;

  const path = url.split("/maritime-docs/")[1];
  if (!path) return url;

  const { data } = await supabase.storage
    .from("maritime-docs")
    .createSignedUrl(path, 60 * 60);

  return data?.signedUrl || url;
}

export default async function MaritimeDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

 const { data: declaration, error } = await supabase
  .from("maritime_health_declarations")
  .select(`
    *,
    maritime_users:created_by (
      id,
      name
    )
  `)
  .eq("id", id)
  .single();

if (error || !declaration) notFound();

const item = declaration as Declaration;

  const signatureSignedUrl = await signedUrl(declaration.master_signature_url);
  const stampSignedUrl = await signedUrl(declaration.ship_stamp_url);

  const { data: attachmentsData } = await supabase
    .from("maritime_attachments")
    .select("attachment_type, file_name, original_file_name")
    .eq("declaration_id", id)
    .order("created_at", { ascending: true });

  const attachments: Attachment[] = attachmentsData || [];

  const attachmentNames: Record<string, string> = {
    sanitation_certificate: "شهادة المراقبة الصحية",
    crew_list: "قائمة الطاقم",
    vaccination_certificate: "شهادة التطعيم",
    last_10_ports: "آخر 10 موانئ",
    general_attachment: "مرفق آخر",
  };

  const healthQuestions = [
    {
      ar: "هل توفي شخص على متن السفينة أثناء الرحلة لأسباب غير الحوادث؟",
      en: "Has any person died on board during the voyage otherwise than as a result of accident?",
      value: declaration.q1_death_other_than_accident,
    },
    {
      ar: "هل توجد على متن السفينة أو حدثت أثناء الرحلة الدولية أي حالة اشتباه بمرض معدي؟",
      en: "Is there on board or has there been during the international voyage any case of disease suspected to be infectious?",
      value: declaration.q2_infectious_case_suspected,
    },
    {
      ar: "هل كان العدد الإجمالي للمسافرين المرضى خلال الرحلة أكبر من المعتاد؟",
      en: "Has the total number of ill passengers during the voyage been greater than normal?",
      value: declaration.q3_total_ill_passengers_greater_than_normal,
    },
    {
      ar: "هل يوجد أي شخص مريض على متن السفينة الآن؟",
      en: "Is there any ill person on board now?",
      value: declaration.q4_any_ill_person_on_board_now,
    },
    {
      ar: "هل تم استشارة طبيب؟",
      en: "Was a medical practitioner consulted?",
      value: declaration.q5_medical_practitioner_consulted,
    },
    {
      ar: "هل تعلم بوجود أي حالة على متن السفينة قد تؤدي إلى عدوى أو انتشار مرض؟",
      en: "Are you aware of any condition on board which may lead to infection or spread of disease?",
      value: declaration.q6_any_condition_lead_to_infection_spread,
    },
    {
      ar: "هل تم تطبيق أي إجراء صحي مثل الحجر أو العزل أو التطهير؟",
      en: "Has any sanitary measure such as quarantine, isolation, disinfection or decontamination been applied?",
      value: declaration.q7_sanitary_measure_applied,
    },
    {
      ar: "هل تم العثور على متسللين على متن السفينة؟",
      en: "Have any stowaways been found on board?",
      value: declaration.q8_stowaways_found,
    },
    {
      ar: "هل يوجد حيوان مريض أو أليف على متن السفينة؟",
      en: "Is there a sick animal or pet on board?",
      value: declaration.q9_sick_animal_or_pet,
    },
  ];
const officerName = Array.isArray(item.maritime_users)
  ? item.maritime_users[0]?.name || ""
  : item.maritime_users?.name || "";

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0"
    >
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap gap-2 print:hidden">
        <Link
          href="/maritime/new"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          نموذج جديد
        </Link>
{/* داخل الشريط العلوي، أضف هذا الزر */}
<Link
  href={`/maritime/clearance/${item.id}`}
  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
>
  📜 شهادة الفسح
</Link>
        <Link
          href="/maritime"
          className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-bold text-white"
        >
          لوحة المعاملات
        </Link>

<SendPdfEmailButton
  declarationId={declaration.id}
  reference={declaration.reference_no || ""}
  ship={declaration.ship_name || ""}
  imo={declaration.registration_imo_no || ""}
officer={officerName}
/>

        <ExportPdfButton />
      </div>

      <div
        id="maritime-pdf-area"
        className="pdf-arabic mx-auto max-w-[210mm] space-y-4 bg-white text-[10.5px] leading-relaxed text-black shadow-sm print:space-y-0 print:shadow-none"
      >
        {/* الصفحة الأولى */}
        <div className="pdf-page min-h-[297mm] bg-white p-8">
          <header className="mb-4 pb-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-6">
              <div className="text-right text-[11px] font-bold leading-6 text-sky-600">
                <p>المملكة العربية السعودية</p>
                <p>وزارة الصحة</p>
                <p>تجمع المدينة المنورة الصحي</p>
                <p>مركز المراقبة الصحية بميناء ينبع التجاري</p>
              </div>

              <div className="flex w-[90px] justify-center">
                <img
                  src="/moh-logo.png"
                  alt="Logo"
                  className="h-16 w-16 object-contain"
                />
              </div>

              <div
                className="text-left text-[11px] font-bold leading-6 text-sky-600"
                dir="ltr"
              >
                <p>Kingdom of Saudi Arabia</p>
                <p>Madinah Health Cluster</p>
                <p>Health Monitoring Center in Yanbu</p>
                <p>Commercial Port</p>
              </div>
            </div>

            <div className="mt-3 border-t border-black pt-3 text-center">
              <div className="flex items-center justify-center gap-3 font-black leading-tight">
                <span className="text-[19px]" dir="rtl">
                  الإقرار الصحي البحري
                </span>
                <span className="text-[16px]">—</span>
                <span className="text-[15px] font-bold" dir="ltr">
                  MARITIME DECLARATION OF HEALTH
                </span>
              </div>
            </div>
          </header>

          <section className="mb-4 border border-black">
            <table className="w-full table-fixed border-collapse">
              <tbody>
                {[
                  [
                    "1",
                    "الميناء / Submitted at port",
                    declaration.submitted_at_port,
                    "التاريخ / Date",
                    declaration.submission_date,
                  ],
                  [
                    "2",
                    "اسم السفينة / Name of ship",
                    declaration.ship_name,
                    "العلم / Flag",
                    declaration.vessel_nationality,
                  ],
                  [
                    "3",
                    "رقم التسجيل / IMO No",
                    declaration.registration_imo_no,
                    "اسم الربان / Master",
                    declaration.master_name,
                  ],
                  [
                    "4",
                    "قادمة من / Arriving from",
                    declaration.arriving_from,
                    "مبحرة إلى / Sailing to",
                    declaration.sailing_to,
                  ],
                  [
                    "5",
                    "الحمولة الإجمالية / Gross tonnage",
                    declaration.gross_tonnage_ship,
                    "عدد الطاقم / Crew",
                    declaration.crew_count,
                  ],
                  [
                    "6",
                    "نوع الشحنة / Type of cargo",
                    declaration.cargo_type,
                    "اسم الوكيل / Local Agent",
                    declaration.local_agent_name,
                  ],
                  [
  "7",
  "عدد الركاب / Number of passengers",
  declaration.passengers_count,
  "عدد المعتمرين / Umrah passengers",
  declaration.umrah_count,
],
                ].map(([no, label1, value1, label2, value2]) => (
                  <tr
                    key={no}
                    className="border-b border-black last:border-b-0"
                  >
                    <td className="w-8 border-l border-black p-1 text-center font-bold">
                      {no}
                    </td>
                    <td className="w-[24%] border-l border-black p-1 text-right font-bold">
                      {label1}
                    </td>
                    <td className="w-[24%] border-l border-black p-1 text-center font-bold">
                      {val(value1 as string | number | null | undefined)}
                    </td>
                    <td className="w-[24%] border-l border-black p-1 text-right font-bold">
                      {label2 || "—"}
                    </td>
                    <td className="p-1 text-center font-bold">
                      {label2
                        ? val(value2 as string | number | null | undefined)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mb-4">
            <h2 className="mb-2 text-center text-xs font-black">
              الأسئلة الصحية / HEALTH QUESTIONS
            </h2>

            <table className="w-full table-fixed border-collapse border border-black">
              <thead>
                <tr className="border-b border-black bg-slate-100">
                  <th className="w-7 border-l border-black p-1 text-center">
                    #
                  </th>
                  <th className="border-l border-black p-1 text-right">
                    السؤال الصحي / Question
                  </th>
                  <th className="w-14 border-l border-black p-1 text-center">
                    نعم / Yes
                  </th>
                  <th className="w-14 border-l border-black p-1 text-center">
                    لا / No
                  </th>
                </tr>
              </thead>

              <tbody>
                {healthQuestions.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-black align-top last:border-b-0"
                  >
                    <td className="border-l border-black p-1 text-center">
                      {index + 1}
                    </td>
                    <td className="border-l border-black p-1">
                      <p className="text-right leading-relaxed">{item.ar}</p>
                      <p
                        className="mt-1 text-left text-[8px] leading-relaxed"
                        dir="ltr"
                      >
                        {item.en}
                      </p>
                    </td>
                    <td className="border-l border-black p-1 text-center">
                      <Mark checked={item.value} />
                    </td>
                    <td className="p-1 text-center">
                      <Mark checked={!item.value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mb-4 border border-black bg-slate-50 p-5 leading-loose">
            <p className="mb-1 font-bold">
              ملاحظة: في حالة عدم وجود طبيب على متن السفينة، يجب على الربان
              اعتبار الأعراض التالية سببًا للاشتباه بوجود مرض معدي:
            </p>

            <p className="mb-1 text-left text-[9px] font-bold" dir="ltr">
              Note: In the absence of a surgeon, the master should regard the
              following symptoms as grounds for suspecting an infectious
              disease:
            </p>

            <ul className="list-disc space-y-1 pr-5 leading-loose">
              <li>
                حمى مستمرة لعدة أيام أو مصحوبة بإنهاك شديد، انخفاض الوعي، تورم
                الغدد، يرقان، سعال أو ضيق تنفس، نزيف غير معتاد، أو شلل.
              </li>
              <li>
                مع أو بدون حمى: طفح جلدي حاد، قيء شديد، إسهال شديد، أو نوبات
                متكررة.
              </li>
            </ul>
          </section>
        </div>

        {/* الصفحة الثانية */}
        <div className="pdf-page min-h-[297mm] bg-white p-8">
          <section className="mb-4 border border-black p-2">
            <div className="grid grid-cols-3 divide-x divide-black divide-x-reverse">
              <div className="px-2">
                <p className="mb-2 border-b border-black pb-1 text-center text-[11px] font-black">
                  الشهادة الصحية
                </p>
                <table className="w-full table-fixed border-collapse text-[10px]">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="w-[42%] border-l border-black p-1 align-top font-bold">
                        هل توجد شهادة
                      </td>
                      <td className="p-1 align-top">
                        <YesNo
                          value={declaration.has_valid_sanitation_certificate}
                        />
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-l border-black p-1 align-top font-bold">
                        مكان الإصدار
                      </td>
                      <td className="p-1 align-top text-center font-bold">
                        {val(declaration.sanitation_certificate_issued_at)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border-l border-black p-1 align-top font-bold">
                        التاريخ
                      </td>
                      <td className="p-1 align-top text-center font-bold">
                        {val(declaration.sanitation_certificate_issued_date)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="px-2">
                <p className="mb-2 border-b border-black pb-1 text-center text-[11px] font-black">
                  مناطق الخطر
                </p>
                <table className="w-full table-fixed border-collapse text-[10px]">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="w-[42%] border-l border-black p-1 align-top font-bold">
                        منطقة متأثرة
                      </td>
                      <td className="p-1 align-top">
                        <YesNo value={declaration.visited_who_affected_area} />
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-l border-black p-1 align-top font-bold">
                        الميناء
                      </td>
                      <td className="p-1 align-top text-center font-bold">
                        {val(declaration.affected_area_port)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border-l border-black p-1 align-top font-bold">
                        التاريخ
                      </td>
                      <td className="p-1 align-top text-center font-bold">
                        {val(declaration.affected_area_date)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="px-2">
                <p className="mb-2 border-b border-black pb-1 text-center text-[11px] font-black">
                  بيانات إضافية
                </p>
                <table className="w-full table-fixed border-collapse text-[10px]">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="w-[42%] border-l border-black p-1 align-top font-bold">
                        آخر الموانئ
                      </td>
                      <td className="p-1 align-top text-center font-bold">
                        {val(declaration.last_ports_text)}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-l border-black p-1 align-top font-bold">
                        الأشخاص المنضمون
                      </td>
                      <td className="p-1 align-top text-center font-bold">
                        {val(declaration.joined_persons_text)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border-l border-black p-1 align-top font-bold">
                        جنسيات الركاب
                      </td>
                      <td className="p-1 align-top text-center font-bold">
                        {val(declaration.passenger_nationalities_text)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="mb-4 border border-black p-3">
            <p className="mb-2 text-justify">
              <span className="font-bold">أقر:</span> بأن البيانات والإجابات
              الواردة في هذا الإقرار الصحي البحري، بما في ذلك الجداول
              والمرفقات، صحيحة ودقيقة حسب علمي واعتقادي.
            </p>

            <p className="mb-3 text-left text-[9.5px]" dir="ltr">
              <span className="font-bold">I hereby declare:</span> that the
              particulars and answers given in this Declaration of Health,
              including attached schedules and documents, are true and correct
              to the best of my knowledge and belief.
            </p>

            <div className="grid grid-cols-3 gap-6 border-t border-dashed border-gray-500 pt-3 text-center">
              <div>
                <div className="flex h-[40px] flex-col justify-center leading-tight">
                  <p className="text-[11px] font-bold">توقيع الربان</p>
                  <p className="text-[9px] text-gray-600" dir="ltr">
                    Master Signature
                  </p>
                </div>

                <div className="mt-2 flex h-24 items-center justify-center">
                  {signatureSignedUrl ? (
                    <img
                      src={signatureSignedUrl}
                      alt="Signature"
                      className="max-h-20 object-contain"
                      style={{
                        filter:
                          "invert(22%) sepia(98%) saturate(2500%) hue-rotate(200deg) brightness(90%) contrast(95%)",
                      }}
                    />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex h-[40px] flex-col justify-center leading-tight">
                  <p className="text-[11px] font-bold">اسم الربان</p>
                  <p className="text-[9px] text-gray-600" dir="ltr">
                    Master's Name
                  </p>
                </div>

                <div className="mt-2 flex h-24 items-center justify-center">
                  <p className="font-bold">{val(declaration.master_name)}</p>
                </div>
              </div>

              <div>
                <div className="flex h-[40px] flex-col justify-center leading-tight">
                  <p className="text-[11px] font-bold">ختم السفينة</p>
                  <p className="text-[9px] text-gray-600" dir="ltr">
                    Ship's Stamp
                  </p>
                </div>

                <div className="mt-2 flex h-24 items-center justify-center text-gray-400">
                  {stampSignedUrl ? (
                    <img
                      src={stampSignedUrl}
                      alt="Ship Stamp"
                      className="mx-auto max-h-20 object-contain opacity-90"
                    />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="mb-4 border border-black p-2">
            <p className="font-bold">بيانات الفسح الصحي / Free Pratique</p>
            <div className="mt-1 grid grid-cols-3 gap-3">
              <p>
                <span className="font-bold">وقت الفسح:</span>{" "}
                {val(declaration.free_pratique_time)}
              </p>
              <p>
                <span className="font-bold">تاريخ الفسح:</span>{" "}
                {val(declaration.free_pratique_date)}
              </p>
              <p>
                <span className="font-bold">المسؤول:</span>{" "}
               {val(officerName)}
              </p>
            </div>
          </section>

          <section className="mb-4 border border-black p-2">
            <p className="font-bold">المرفقات ({attachments.length || 0}):</p>
            <p className="mt-1 leading-5">
              {attachments.length > 0
                ? attachments
                    .map(
                      (file) =>
                        attachmentNames[file.attachment_type] ||
                        file.original_file_name ||
                        file.file_name
                    )
                    .join(" - ")
                : "لا توجد مرفقات"}
            </p>
          </section>

          <footer className="mt-auto border-t border-gray-300 pt-3 text-center text-[9px] text-gray-500">
            
            تم إنشاء هذا النموذج إلكترونيًا عبر نظام الإقرار الصحي والفسح البحري
          </footer>
        </div>
      </div>
    </main>
  );
}