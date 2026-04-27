// app/maritime/arrived/page.tsx
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function ArrivedPage() {
  // ✅ استعلام بسيط بدون JOIN معقد
  const { data, error } = await supabase
    .from("maritime_health_declarations")
    .select(`
      id,
      ship_name,
      registration_imo_no,
      free_pratique_date,
      free_pratique_time,
      created_at,
      arrival_status,
      sanitary_officer_in_charge
    `)
    .eq("arrival_status", "arrived")
    .is("deleted_at", null)
    .order("free_pratique_date", { ascending: false });

  if (error) {
    console.error("❌ خطأ في جلب سجل الوصول:", error);
  }

  const items = data || [];

  // ✅ جلب أسماء المسؤولين في خطوة منفصلة (إذا وجدنا معرفات)
  const officerIds = [...new Set(items.map(i => i.sanitary_officer_in_charge).filter(Boolean))] as string[];
  const officerNames: Record<string, string> = {};

  if (officerIds.length > 0) {
    const { data: users } = await supabase
      .from("maritime_users")
      .select("id, name")
      .in("id", officerIds);
    
    if (users) {
      users.forEach(u => { officerNames[u.id] = u.name; });
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black">سجل الوصول والفسح الصحي</h1>
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-black text-green-800">
            {items.length} سفينة
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-3xl mb-2">🚢</p>
            <p className="font-bold text-slate-700">لا توجد سفن تم فسحها بعد</p>
            <p className="text-sm text-slate-500 mt-1">
              ستظهر هنا السفن التي أدخلت تاريخ ووقت الفسح الصحي
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => (
              <Link
                key={item.id}
                href={`/maritime/new?id=${item.id}`}
                className="block rounded-xl bg-white p-4 shadow transition hover:border-green-300 hover:bg-green-50"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">
                      {item.ship_name}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      IMO: {item.registration_imo_no || "غير محدد"}
                    </p>
                    <p className="mt-1 text-xs font-bold text-green-700">
                      ✅ فُسحت: {item.free_pratique_date ? new Date(item.free_pratique_date).toLocaleDateString("ar-SA") : "—"} 
                      {item.free_pratique_time ? ` الساعة ${item.free_pratique_time}` : ""}
                    </p>
                  </div>

                  <div className="text-left text-xs text-slate-500">
                    <p className="font-bold text-slate-700">
                      {new Date(item.created_at).toLocaleDateString("ar-SA")}
                    </p>
                    <p>
                      بواسطة:{" "}
                      {/* ✅ عرض اسم المسؤول من الكاش أو الرمز كاحتياط */}
                      {officerNames[item.sanitary_officer_in_charge] || 
                       item.sanitary_officer_in_charge?.slice(0, 8) + "..." || 
                       "—"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}