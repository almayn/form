"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("بيانات خاطئة");
    } else {
      router.push("/maritime");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="rounded-2xl bg-white p-6 shadow w-80 space-y-4">
        <h2 className="text-xl font-black text-center">تسجيل الدخول</h2>

        <input
          type="email"
          placeholder="البريد"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded p-2"
        />

        <input
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded p-2"
        />

        <button
          onClick={login}
          className="w-full bg-blue-600 text-white py-2 rounded font-bold"
        >
          دخول
        </button>
      </div>
    </div>
  );
}