import { supabase } from "@/lib/supabase";
import Link from "next/link";
import ArrivalButton from "./ArrivalButton";

export default async function WaitingPage() {
  const { data } = await supabase
   .from("maritime_health_declarations")
  .select(`id, ship_name, registration_imo_no, created_at, maritime_users:created_by(name)`)
  .eq("arrival_status", "waiting") // ✅ فلتر واحد فقط
  .order("created_at", { ascending: false });

  const items = data || [];

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-xl font-black">قائمة الانتظار</h1>

        {items.length === 0 && (
          <p className="text-sm text-gray-500">لا توجد بيانات</p>
        )}

        {items.map((item: any) => (
          <Link
            key={item.id}
            href={`/maritime/new?id=${item.id}`}
            className="block rounded-xl bg-white p-4 shadow hover:bg-slate-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">{item.ship_name}</p>
                <p className="text-xs text-gray-500">
                  IMO: {item.registration_imo_no}
                </p>
                  <p className="mt-1 text-xs text-gray-500">
        المدخل: {item.maritime_users?.name || "—"}
      </p>
              </div>

              <div className="text-left text-xs text-gray-600">
                <p>{item.maritime_users?.name || "—"}</p>
                <p>
                  {new Date(item.created_at).toLocaleDateString("ar-SA")}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}