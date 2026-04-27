import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function MaritimeDashboard() {
  // جلب الإحصائيات السريعة
  const [waitingCount, arrivedCount, totalDeclarations] = await Promise.all([
    supabase
      .from("maritime_health_declarations")
      .select("*", { count: "exact", head: true })
      .eq("arrival_status", "waiting")
      .is("deleted_at", null),
    supabase
      .from("maritime_health_declarations")
      .select("*", { count: "exact", head: true })
      .eq("arrival_status", "arrived")
      .is("deleted_at", null),
    supabase
      .from("maritime_health_declarations")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
  ]);

  const stats = {
    waiting: waitingCount.count || 0,
    arrived: arrivedCount.count || 0,
    total: totalDeclarations.count || 0,
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-slate-900">
            🚢 نظام الإقرار الصحي البحري
          </h1>
          <p className="text-slate-600 font-bold">
            Maritime Health Declaration System
          </p>
        </div>

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 shadow-lg border-r-4 border-blue-500">
            <p className="text-sm font-bold text-slate-500">في قائمة الانتظار</p>
            <p className="text-4xl font-black text-blue-600 mt-2">{stats.waiting}</p>
            <p className="text-xs text-slate-400 mt-1">سفينة</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border-r-4 border-green-500">
            <p className="text-sm font-bold text-slate-500">تم فسحها</p>
            <p className="text-4xl font-black text-green-600 mt-2">{stats.arrived}</p>
            <p className="text-xs text-slate-400 mt-1">سفينة</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border-r-4 border-purple-500">
            <p className="text-sm font-bold text-slate-500">إجمالي المعاملات</p>
            <p className="text-4xl font-black text-purple-600 mt-2">{stats.total}</p>
            <p className="text-xs text-slate-400 mt-1">معاملة</p>
          </div>
        </div>

        {/* البطاقات الرئيسية - 5 بطاقات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. معاملات جديدة */}
          <Link
            href="/maritime/new"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white shadow-xl transition hover:scale-[1.02] hover:shadow-2xl"
          >
            <div className="relative z-10">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-2xl font-black mb-2">معاملات جديدة</h2>
              <p className="text-blue-100 font-bold">
                إدخال بيانات السفن وحفظها كمسودة أو فسحها
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-blue-200 group-hover:text-white transition">
                <span>انتقال</span>
                <span>←</span>
              </div>
            </div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          </Link>

          {/* 2. قائمة الانتظار */}
          <Link
            href="/maritime/waiting"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-white shadow-xl transition hover:scale-[1.02] hover:shadow-2xl"
          >
            <div className="relative z-10">
              <div className="text-6xl mb-4">⏳</div>
              <h2 className="text-2xl font-black mb-2">قائمة الانتظار</h2>
              <p className="text-orange-100 font-bold">
                عرض السفن في انتظار الوصول والفسح
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-orange-200 group-hover:text-white transition">
                <span>عرض</span>
                <span>←</span>
              </div>
            </div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          </Link>

          {/* 3. الوصول والفسح */}
          <Link
            href="/maritime/arrived"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 to-emerald-700 p-8 text-white shadow-xl transition hover:scale-[1.02] hover:shadow-2xl"
          >
            <div className="relative z-10">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-black mb-2">الوصول والفسح</h2>
              <p className="text-green-100 font-bold">
                سجل السفن التي تم فسحها صحياً
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-green-200 group-hover:text-white transition">
                <span>عرض</span>
                <span>←</span>
              </div>
            </div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          </Link>

          {/* 4. لوحة المعاملات */}
          <Link
            href="/maritime/declarations"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 to-blue-700 p-8 text-white shadow-xl transition hover:scale-[1.02] hover:shadow-2xl"
          >
            <div className="relative z-10">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-2xl font-black mb-2">لوحة المعاملات</h2>
              <p className="text-cyan-100 font-bold">
                عرض شامل لجميع المعاملات والبحث فيها
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-cyan-200 group-hover:text-white transition">
                <span>عرض</span>
                <span>←</span>
              </div>
            </div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          </Link>

          {/* 5. الإحصائيات */}
          <Link
            href="/maritime/statistics"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 to-indigo-700 p-8 text-white shadow-xl transition hover:scale-[1.02] hover:shadow-2xl"
          >
            <div className="relative z-10">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-2xl font-black mb-2">الإحصائيات والتقارير</h2>
              <p className="text-purple-100 font-bold">
                تحليل البيانات وإصدار التقارير الشهرية
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-purple-200 group-hover:text-white transition">
                <span>عرض</span>
                <span>←</span>
              </div>
            </div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 font-bold">
          <p>نظام الإقرار الصحي والفسح البحري © {new Date().getFullYear()}</p>
        </div>
        
      </div>
      
    </main>
  );
}