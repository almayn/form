"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type VesselType = "internal" | "external" | string | null;

type DeclarationRow = {
  id: string;
  ship_name: string | null;
  vessel_nationality: string | null;
  free_pratique_date: string | null;
  crew_count: number | null;
  passengers_count: number | null;
  umrah_count: number | null;
  vessel_type: VesselType;
  sanitary_officer_in_charge: string | null;
};

type OfficerRow = {
  id: string;
  name: string;
  count: number;
};

type ActiveTable =
  | "month"
  | "last3"
  | "range"
  | "external"
  | "internal"
  | null;
function isInternal(type: VesselType) {
  return type === "internal" || type === "داخلية" || type === "local";
}

function isExternal(type: VesselType) {
  return type === "external" || type === "خارجية";
}
function formatVesselType(type: VesselType) {
  if (isInternal(type)) return "داخلية";
  if (isExternal(type)) return "خارجية";
  return "غير محدد";
}

function formatDate(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("ar-SA");
}

function toExcelDate(date?: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB");
}

function downloadExcel(rows: DeclarationRow[], title: string) {
  const headers = [
    "م",
    "اسم الناقلة",
    "العلم",
    "التاريخ",
    "طاقم",
    "ركاب",
    "معتمرين",
    "نوعها",
  ];

  const bodyRows = rows.map((item, index) => [
    index + 1,
    item.ship_name || "",
    item.vessel_nationality || "",
    toExcelDate(item.free_pratique_date),
    item.crew_count || 0,
    item.passengers_count || 0,
    item.umrah_count || 0,
    formatVesselType(item.vessel_type),
  ]);

  const html = `
    <html dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; width: 100%; direction: rtl; }
          th, td { border: 1px solid #999; padding: 8px; text-align: center; }
          th { background: #e5e7eb; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${bodyRows
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff" + html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DeclarationRow[]>([]);
  const [officers, setOfficers] = useState<OfficerRow[]>([]);

  const [activeTable, setActiveTable] = useState<ActiveTable>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("maritime_health_declarations")
        .select(
          `
          id,
          ship_name,
          vessel_nationality,
          free_pratique_date,
          crew_count,
          passengers_count,
          umrah_count,
          vessel_type,
          sanitary_officer_in_charge
        `
        )
        .eq("arrival_status", "arrived")
        .is("deleted_at", null)
        .order("free_pratique_date", { ascending: false });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const declarations = (data || []) as DeclarationRow[];
      setRows(declarations);

      const officerMap: Record<string, number> = {};
      declarations.forEach((item) => {
        if (item.sanitary_officer_in_charge) {
          officerMap[item.sanitary_officer_in_charge] =
            (officerMap[item.sanitary_officer_in_charge] || 0) + 1;
        }
      });

      const officerIds = Object.keys(officerMap);

      if (officerIds.length > 0) {
        const { data: users } = await supabase
          .from("maritime_users")
          .select("id, name")
          .in("id", officerIds);

        const list =
          users
            ?.map((user) => ({
              id: user.id,
              name: user.name,
              count: officerMap[user.id] || 0,
            }))
            .sort((a, b) => b.count - a.count) || [];

        setOfficers(list);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const totalCleared = rows.length;
  const totalCrew = rows.reduce((sum, item) => sum + Number(item.crew_count || 0), 0);
  const totalPassengers = rows.reduce(
    (sum, item) => sum + Number(item.passengers_count || 0),
    0
  );
  const totalUmrah = rows.reduce((sum, item) => sum + Number(item.umrah_count || 0), 0);
 const externalCount = rows.filter((item) => isExternal(item.vessel_type)).length;
const internalCount = rows.filter((item) => isInternal(item.vessel_type)).length;

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();

    rows.forEach((item) => {
      if (!item.free_pratique_date) return;

      const d = new Date(item.free_pratique_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
      });

      map.set(key, label);
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => b.value.localeCompare(a.value));
  }, [rows]);

  const selectedRows = useMemo(() => {
    const today = new Date();
if (activeTable === "external") {
  return rows.filter((item) => isExternal(item.vessel_type));
}

if (activeTable === "internal") {
  return rows.filter((item) => isInternal(item.vessel_type));
}

    if (activeTable === "last3") {
      const start = new Date();
      start.setMonth(today.getMonth() - 3);

      return rows.filter((item) => {
        if (!item.free_pratique_date) return false;
        const d = new Date(item.free_pratique_date);
        return d >= start && d <= today;
      });
    }

    if (activeTable === "month" && selectedMonth) {
      return rows.filter((item) => {
        if (!item.free_pratique_date) return false;
        return item.free_pratique_date.startsWith(selectedMonth);
      });
    }

    if (activeTable === "range" && startDate && endDate) {
      return rows.filter((item) => {
        if (!item.free_pratique_date) return false;
        return item.free_pratique_date >= startDate && item.free_pratique_date <= endDate;
      });
    }

    return [];
  }, [rows, activeTable, selectedMonth, startDate, endDate]);

  const tableTitle =
    activeTable === "month"
      ? `إحصائية شهر ${monthOptions.find((m) => m.value === selectedMonth)?.label || ""}`
      : activeTable === "last3"
      ? "إحصائية آخر 3 أشهر"
      : activeTable === "range"
      ? "إحصائية بين تاريخين"
      : activeTable === "external"
      ? "إحصائية السفن الخارجية"
      : activeTable === "internal"
      ? "إحصائية السفن الداخلية"
      : "";

  if (loading) {
    return (
      <div dir="rtl" className="p-8 text-center font-bold text-slate-600">
        جاري تحميل الإحصائيات...
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">
            📊 إحصائيات الفسح الصحي
          </h1>
          <p className="mt-1 font-bold text-slate-600">
            جداول مختصرة قابلة للتصدير
          </p>
        </div>

        <Link
          href="/maritime"
          className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200"
        >
          ← القائمة الرئيسية
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border-r-4 border-green-500 bg-white p-6 shadow">
          <p className="text-sm font-bold text-slate-500">إجمالي السفن</p>
          <p className="mt-2 text-4xl font-black text-green-600">{totalCleared}</p>
        </div>

        <div className="rounded-2xl border-r-4 border-sky-500 bg-white p-6 shadow">
          <p className="text-sm font-bold text-slate-500">إجمالي الطاقم</p>
          <p className="mt-2 text-4xl font-black text-sky-600">{totalCrew}</p>
        </div>

        <div className="rounded-2xl border-r-4 border-indigo-500 bg-white p-6 shadow">
          <p className="text-sm font-bold text-slate-500">إجمالي الركاب</p>
          <p className="mt-2 text-4xl font-black text-indigo-600">
            {totalPassengers}
          </p>
        </div>

        <div className="rounded-2xl border-r-4 border-amber-500 bg-white p-6 shadow">
          <p className="text-sm font-bold text-slate-500">إجمالي المعتمرين</p>
          <p className="mt-2 text-4xl font-black text-amber-600">{totalUmrah}</p>
        </div>

        <button
          onClick={() => setActiveTable("external")}
          className="rounded-2xl border-r-4 border-blue-500 bg-white p-6 text-right shadow hover:bg-blue-50"
        >
          <p className="text-sm font-bold text-slate-500">السفن الخارجية</p>
          <p className="mt-2 text-4xl font-black text-blue-600">{externalCount}</p>
        </button>

        <button
          onClick={() => setActiveTable("internal")}
          className="rounded-2xl border-r-4 border-emerald-500 bg-white p-6 text-right shadow hover:bg-emerald-50"
        >
          <p className="text-sm font-bold text-slate-500">السفن الداخلية</p>
          <p className="mt-2 text-4xl font-black text-emerald-600">{internalCount}</p>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-5">
        <button
          onClick={() => {
            setActiveTable("month");
            if (!selectedMonth && monthOptions[0]) {
              setSelectedMonth(monthOptions[0].value);
            }
          }}
          className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white hover:bg-blue-800"
        >
          شهر
        </button>

        <button
          onClick={() => setActiveTable("last3")}
          className="rounded-xl bg-slate-800 px-4 py-3 font-bold text-white hover:bg-slate-900"
        >
          آخر 3 شهور
        </button>

        <button
          onClick={() => setActiveTable("range")}
          className="rounded-xl bg-purple-700 px-4 py-3 font-bold text-white hover:bg-purple-800"
        >
          بين تاريخين
        </button>

        <button
          onClick={() => setActiveTable("external")}
          className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
        >
          خارجية
        </button>

        <button
          onClick={() => setActiveTable("internal")}
          className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700"
        >
          داخلية
        </button>
      </div>

      {activeTable === "month" && (
        <div className="rounded-2xl bg-white p-5 shadow">
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">اختر الشهر</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 font-bold"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {activeTable === "range" && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-5 shadow md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">من تاريخ</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">إلى تاريخ</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>
        </div>
      )}

      {activeTable && (
        <div className="rounded-2xl bg-white shadow">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">{tableTitle}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                عدد السجلات: {selectedRows.length}
              </p>
            </div>

            <button
              onClick={() => downloadExcel(selectedRows, tableTitle || "statistics")}
              disabled={selectedRows.length === 0}
              className="rounded-xl bg-green-700 px-4 py-2 font-bold text-white disabled:opacity-50"
            >
              تصدير Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border p-3 text-right">م</th>
                  <th className="border p-3 text-right">اسم الناقلة</th>
                  <th className="border p-3 text-right">العلم</th>
                  <th className="border p-3 text-right">التاريخ</th>
                  <th className="border p-3 text-right">طاقم</th>
                  <th className="border p-3 text-right">ركاب</th>
                  <th className="border p-3 text-right">معتمرين</th>
                  <th className="border p-3 text-right">نوعها</th>
                </tr>
              </thead>

              <tbody>
                {selectedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center font-bold text-slate-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  selectedRows.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="border p-3">{index + 1}</td>
                      <td className="border p-3 font-bold">{item.ship_name || "—"}</td>
                      <td className="border p-3">{item.vessel_nationality || "—"}</td>
                      <td className="border p-3">{formatDate(item.free_pratique_date)}</td>
                      <td className="border p-3">{item.crew_count || 0}</td>
                      <td className="border p-3">{item.passengers_count || 0}</td>
                      <td className="border p-3">{item.umrah_count || 0}</td>
                      <td className="border p-3">{formatVesselType(item.vessel_type)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-black text-slate-900">👥 أداء المدخلين</h2>

        {officers.length === 0 ? (
          <p className="py-6 text-center font-bold text-slate-500">
            لا توجد بيانات
          </p>
        ) : (
          <div className="space-y-3">
            {officers.map((officer, index) => (
              <div
                key={officer.id}
                className="flex items-center gap-4 rounded-xl bg-slate-50 p-4"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 font-bold text-white">
                  {index + 1}
                </div>

                <p className="flex-1 font-bold text-slate-900">{officer.name}</p>

                <div className="text-left">
                  <p className="text-2xl font-black text-slate-800">{officer.count}</p>
                  <p className="text-xs font-bold text-slate-500">سفينة</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}