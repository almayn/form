"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Declaration = {
  id: string;
  reference_no: string | null;
  status: string;
  ship_name: string;
  registration_imo_no: string;
  submitted_at_port: string;
  submission_date: string;
  master_name: string;
  sanitary_officer_in_charge: string | null;
  created_at: string;
  maritime_users?: { name: string } | null;
};

function statusLabel(status: string) {
  const labels: Record<string, { text: string; color: string }> = {
    draft: { text: "مسودة", color: "bg-slate-100 text-slate-700" },
    ready: { text: "جاهزة", color: "bg-blue-100 text-blue-700" },
    generated: { text: "تم إصدار PDF", color: "bg-purple-100 text-purple-700" },
    sent: { text: "تم الإرسال", color: "bg-green-100 text-green-700" },
    archived: { text: "مؤرشفة", color: "bg-amber-100 text-amber-700" },
    deleted: { text: "محذوفة", color: "bg-red-100 text-red-700" },
  };
  return labels[status] || { text: status, color: "bg-slate-100 text-slate-700" };
}

// ✅ تصدير Excel فقط (بدون PDF)
function exportToExcel(data: Declaration[]) {
  const headers = ["رقم المعاملة", "السفينة", "IMO", "الميناء", "تاريخ الإقرار", "الربان", "الحالة", "المسؤول", "تاريخ الإنشاء"];
  const rows = data.map(item => [
    item.reference_no || "",
    item.ship_name,
    item.registration_imo_no,
    item.submitted_at_port,
    item.submission_date,
    item.master_name,
    statusLabel(item.status).text,
    item.maritime_users?.name || "—",
    new Date(item.created_at).toLocaleDateString("ar-SA")
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `معاملات_بحرية_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DeclarationsTable({
  declarations,
  count,
  uniquePorts,
  searchParams,
}: {
  declarations: Declaration[];
  count: number;
  uniquePorts: string[];
  searchParams: { search?: string; status?: string; port?: string; from?: string; to?: string };
}) {
  const router = useRouter();
  const { search, status, port, from, to } = searchParams;

  const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    if (fd.get("search")) params.set("search", fd.get("search") as string);
    if (fd.get("status")) params.set("status", fd.get("status") as string);
    if (fd.get("port")) params.set("port", fd.get("port") as string);
    if (fd.get("from")) params.set("from", fd.get("from") as string);
    if (fd.get("to")) params.set("to", fd.get("to") as string);
    router.push(`/maritime/declarations?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">📋 لوحة المعاملات</h1>
          <p className="text-slate-600 font-bold mt-1">عرض، بحث، وتصدير جميع المعاملات</p>
        </div>
        <div className="flex gap-2">
          <Link href="/maritime/new" className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-500 transition">+ معاملة جديدة</Link>
          {declarations.length > 0 && (
            <button onClick={() => exportToExcel(declarations)} className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-black text-white hover:bg-green-700 transition flex items-center gap-2">📊 تصدير Excel</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white p-4 shadow-lg border border-slate-200">
        <form onSubmit={handleFilter} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input name="search" type="text" placeholder="🔍 بحث (سفينة، IMO، ربان...)" defaultValue={search} className="rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 outline-none" />
          <select name="status" defaultValue={status} className="rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 outline-none bg-white">
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="ready">جاهزة</option>
            <option value="generated">تم إصدار PDF</option>
            <option value="sent">تم الإرسال</option>
            <option value="archived">مؤرشفة</option>
          </select>
          <select name="port" defaultValue={port} className="rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 outline-none bg-white">
            <option value="">كل الموانئ</option>
            {uniquePorts.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input name="from" type="date" defaultValue={from} className="rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 outline-none" />
          <input name="to" type="date" defaultValue={to} className="rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 outline-none" />
          <div className="lg:col-span-5 flex gap-2 justify-end mt-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition">🔍 تطبيق الفلاتر</button>
            <button type="button" onClick={() => router.push("/maritime/declarations")} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition">↺ إعادة تعيين</button>
          </div>
        </form>
      </div>

      {/* Table */}
      <section className="rounded-3xl bg-white p-5 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">نتائج البحث</h2>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">{count} معاملة</span>
        </div>

        {declarations.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-8 text-center">
            <p className="font-bold text-slate-600">لا توجد معاملات تطابق معايير البحث</p>
            <button onClick={() => router.push("/maritime/declarations")} className="mt-4 inline-block text-blue-600 font-bold hover:underline">عرض جميع المعاملات</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-right text-slate-600">
                  <th className="p-3">رقم المعاملة</th>
                  <th className="p-3">السفينة / IMO</th>
                  <th className="p-3">الميناء / التاريخ</th>
                  <th className="p-3">الربان</th>
                  <th className="p-3">المسؤول</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {declarations.map((item) => (
                  <tr key={item.id} className="border-b transition hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{item.reference_no || "—"}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{item.ship_name}</div>
                      <div className="text-xs text-slate-500">IMO: {item.registration_imo_no || "—"}</div>
                    </td>
                    <td className="p-3">
                      <div>{item.submitted_at_port}</div>
                      <div className="text-xs text-slate-500">{item.submission_date}</div>
                    </td>
                    <td className="p-3">{item.master_name || "—"}</td>
                    <td className="p-3 text-xs text-slate-600">{item.maritime_users?.name || "—"}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${statusLabel(item.status).color}`}>
                        {statusLabel(item.status).text}
                      </span>
                    </td>
                    <td className="p-3">
                      {/* ✅ الزر الوحيد هنا: ينقل لصفحة التفاصيل حيث توجد أزرار الـ PDF */}
                        <Link
    href={`/maritime/new?id=${item.id}`}  // ✅ يفتح صفحة الإدخال مع تعبئة البيانات
    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
  >
    ✏️ تعديل المعاملة
  </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}