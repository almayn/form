"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import SendClearancePdfEmailButton from "@/components/SendClearancePdfEmailButton";

const ExportPdfButton = dynamic(() => import("@/components/ExportPdfButton"), {
  ssr: false,
});

type Declaration = {
  id: string;
  ship_name: string;
  vessel_nationality: string;
  arriving_from: string;
  free_pratique_time: string | null;
  free_pratique_date: string | null;
  local_agent_name: string | null;
  certificate_recipient_name: string | null;
  recipient_designation: string | null;

  maritime_users:
    | { name: string }
    | { name: string }[]
    | null;

  clearance_officer_signature_url: string | null;
  clearance_recipient_signature_url: string | null;
  ship_stamp_url: string | null;
};

async function getSignedUrl(url: string | null) {
  if (!url) return null;

  const path = url.split("/maritime-docs/")[1];
  if (!path) return url;

  const { data } = await supabase.storage
    .from("maritime-docs")
    .createSignedUrl(path, 3600);

  return data?.signedUrl || url;
}

function SignatureBox({
  url,
  fallbackText,
}: {
  url: string | null;
  fallbackText: string;
}) {
  return (
    <span className="inline-flex h-10 min-w-[120px] items-end justify-center border-b border-gray-400 align-bottom">
      {url ? (
        <img
          src={url}
          alt="توقيع إلكتروني"
          className="max-h-9 w-auto object-contain"
          style={{
            filter:
              "invert(22%) sepia(98%) saturate(2500%) hue-rotate(200deg) brightness(90%) contrast(95%)",
          }}
        />
      ) : (
        <span className="pb-1 text-xs italic text-slate-400">
          {fallbackText}
        </span>
      )}
    </span>
  );
}

export default function ShipClearanceCertificate() {
  const [data, setData] = useState<Declaration | null>(null);
  const [loading, setLoading] = useState(true);

  const [mediaUrls, setMediaUrls] = useState<{
    officerSignature: string | null;
    recipientSignature: string | null;
    stamp: string | null;
  }>({
    officerSignature: null,
    recipientSignature: null,
    stamp: null,
  });

  useEffect(() => {
    const loadData = async () => {
      const pathParts = window.location.pathname.split("/");
      const id = pathParts[pathParts.length - 1];

      if (!id) {
        setLoading(false);
        return;
      }

      const { data: declaration, error } = await supabase
        .from("maritime_health_declarations")
        .select(`
          id,
          ship_name,
          vessel_nationality,
          arriving_from,
          free_pratique_time,
          free_pratique_date,
          local_agent_name,
          certificate_recipient_name,
          recipient_designation,
          clearance_officer_signature_url,
          clearance_recipient_signature_url,
          ship_stamp_url,
          maritime_users:created_by (name)
        `)
        .eq("id", id)
        .single();

      if (error || !declaration) {
        setLoading(false);
        notFound();
        return;
      }

      const item = declaration as unknown as Declaration;

      const officerSignature = await getSignedUrl(
        item.clearance_officer_signature_url
      );

      const recipientSignature = await getSignedUrl(
        item.clearance_recipient_signature_url
      );

      const stamp = await getSignedUrl(item.ship_stamp_url);

      setData(item);

      setMediaUrls({
        officerSignature,
        recipientSignature,
        stamp,
      });

      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-bold text-slate-500 italic">
        جاري التجهيز...
      </div>
    );
  }

  if (!data) return null;

  const officerName = Array.isArray(data.maritime_users)
    ? data.maritime_users[0]?.name || ""
    : data.maritime_users?.name || "";

  const getDayName = (dateString: string | null) => {
    if (!dateString) return "—";

    return new Date(dateString).toLocaleDateString("ar-SA", {
      weekday: "long",
    });
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-100 pb-10 pt-5 print:bg-white print:p-0"
    >
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
        <Link
          href="/maritime"
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white"
        >
          العودة
        </Link>

        <div className="flex items-center gap-2">
          <SendClearancePdfEmailButton
            declarationId={data.id}
            ship={data.ship_name}
            reference={data.id}
          />

          <ExportPdfButton />
        </div>
      </div>

      <div className="mx-auto w-full overflow-x-auto px-2 sm:px-4 print:overflow-visible print:px-0">
        <div
          id="maritime-pdf-area"
          className="mx-auto h-[297mm] w-[210mm] overflow-hidden bg-white px-12 pb-5 pt-4 text-slate-900 shadow-lg print:h-[297mm] print:overflow-hidden print:px-10 print:pb-4 print:pt-4 print:shadow-none"
        >
          <header className="mb-5 flex items-start justify-between">
            <div className="space-y-0.5 whitespace-nowrap text-right text-[11px] font-bold text-sky-900">
              <p>المملكة العربية السعودية</p>
              <p>وزارة الصحة</p>
              <p>تجمع المدينة المنورة الصحي</p>
              <p>النطاق الرابع بصحة المدينة</p>
              <p>مركز المراقبة الصحية بميناء ينبع التجاري</p>
            </div>

            <img
              src="/moh-logo.png"
              alt="Logo"
              className="h-14 w-14 object-contain"
            />
          </header>

          <div className="mb-6 text-center">
            <h1 className="inline-block border-b-2 border-double border-black px-12 pb-1 text-xl font-black">
              شهادة فسح البواخر
            </h1>
          </div>

          <div className="mb-6 text-right text-[15px] leading-[2.8]">
            <p className="mb-6 font-bold">
              تشهد إدارة مركز المراقبة الصحية بميناء ينبع التجاري بأن:
            </p>

            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <span className="whitespace-nowrap font-bold">الباخرة:</span>
                <span className="flex-1 border-b border-dotted border-black px-2 text-[17px] font-black">
                  {data.ship_name || "—"}
                </span>

                <span className="whitespace-nowrap font-bold">العلم:</span>
                <span className="w-1/4 border-b border-dotted border-black px-2">
                  {data.vessel_nationality || "—"}
                </span>
              </div>

              <div className="flex items-end gap-3">
                <span className="whitespace-nowrap font-bold">
                  جهة القدوم:
                </span>
                <span className="flex-1 border-b border-dotted border-black px-2">
                  {data.arriving_from || "—"}
                </span>
              </div>
            </div>

            <p className="mt-8">
              قد فسحت صحياً في تمام الساعة (
              <span className="px-2 font-black">
                {data.free_pratique_time || "—"}
              </span>
              ) من يوم (
              <span className="px-2 font-black">
                {getDayName(data.free_pratique_date)}
              </span>
              ) الموافق (
              <span className="px-2 font-black">
                {data.free_pratique_date || "—"}
              </span>
              )
            </p>

            <p className="mt-6 text-[14px] font-bold">
              وقد تم منحها حرية الاتصال ولا مانع من صعود الجهات ذات الاختصاص
              للباخرة لإكمال إجراءاتها.
            </p>
          </div>

          <div className="mb-12 border-t-2 border-black pt-6">
            <p className="mb-4 text-[15px] font-black">المسئول عن الفسح:</p>

            <div className="flex items-end justify-between gap-6 text-[13px] font-bold">
              <div className="flex items-baseline gap-2">
                <span className="whitespace-nowrap">الاسم:</span>
                <span className="min-w-[180px] border-b border-gray-400 pb-1">
                  {officerName || "—"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap">التوقيع:</span>
                <SignatureBox
                  url={mediaUrls.officerSignature}
                  fallbackText="..........................."
                />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="whitespace-nowrap">التاريخ:</span>
                <span className="min-w-[100px] border-b border-gray-400 pb-1">
                  {data.free_pratique_date || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded border border-black bg-slate-50/50 p-5">
            <p className="mb-6 text-center text-[15px] font-black underline">
              إقرار استلام الشهادة
            </p>

            <p className="mb-8 text-[13px] font-medium">
              لقد استلمت أصل شهادة الفسح الصحي من المسئول الذي قام بفسح الباخرة
              الموضح اسمها وبياناتها أعلاه.
            </p>

            <div className="flex items-center justify-between text-[12px] font-bold">
              <div className="flex flex-1 items-baseline gap-2">
                <span className="whitespace-nowrap">الاسم:</span>
                <span className="w-full border-b border-gray-300 pb-1">
                  {data.certificate_recipient_name || ""}
                </span>
              </div>

              <div className="flex flex-1 items-baseline justify-center gap-2">
                <span className="whitespace-nowrap">الوظيفة:</span>
                <span className="border-b border-gray-300 px-4 pb-1">
                  {data.recipient_designation || ""}
                </span>
              </div>

              <div className="flex flex-1 items-end justify-end gap-2">
                <span className="whitespace-nowrap">التوقيع:</span>
                <SignatureBox
                  url={mediaUrls.recipientSignature}
                  fallbackText=""
                />
              </div>
            </div>
          </div>

          <footer className="mt-6 border-t border-slate-100 pt-10 text-center text-[10px] font-bold text-slate-400">
            نظام الإقرار الصحي والفسح البحري - مركز المراقبة الصحية بميناء ينبع
            التجاري
          </footer>
        </div>
      </div>
    </main>
  );
}