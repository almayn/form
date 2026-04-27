"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const navLinks = [
  { href: "/maritime", label: "الرئيسية", icon: "🏠" },
  { href: "/maritime/new", label: "معاملة جديدة", icon: "📝" },
  { href: "/maritime/waiting", label: "قائمة الانتظار", icon: "⏳" },
  { href: "/maritime/arrived", label: "الوصول والفسح", icon: "✅" },
  { href: "/maritime/declarations", label: "لوحة المعاملات", icon: "📋" },
  { href: "/maritime/statistics", label: "الإحصائيات", icon: "📊" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState("...");

  // جلب المستخدم
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        setUserName(data.user.email || "مستخدم");
      }
    };

    loadUser();
  }, []);

  // تسجيل خروج
  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* الشعار */}
          <Link href="/maritime" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">🚢</span>
            <span className="font-black text-slate-800 text-lg hidden sm:block">
              نظام الإقرار الصحي البحري
            </span>
          </Link>

          {/* روابط سطح المكتب */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/maritime" &&
                  pathname?.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
                    isActive
                      ? "bg-blue-100 text-blue-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="ml-1">{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}

            {/* فاصل */}
            <div className="mx-2 h-6 w-px bg-slate-200" />

            {/* المستخدم */}
            <div className="text-xs font-bold text-slate-600">
              👤 {userName}
            </div>

            {/* خروج */}
            <button
              onClick={logout}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 transition"
            >
              خروج
            </button>
          </div>

          {/* زر الجوال */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-700"
          >
            <span className="text-2xl">{isOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* قائمة الجوال */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white animate-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/maritime" &&
                  pathname?.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-bold transition ${
                    isActive
                      ? "bg-blue-100 text-blue-800"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="ml-1">{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}

            {/* قسم المستخدم */}
            <div className="border-t border-slate-200 pt-3 mt-2 space-y-2">
              <div className="text-xs font-bold text-slate-500 px-3">
                👤 {userName}
              </div>

              <button
                onClick={logout}
                className="w-full text-right px-3 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50"
              >
                تسجيل خروج
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}