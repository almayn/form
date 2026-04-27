"use client";

import { useState } from "react";

export default function SendButton({
  reference,
  ship,
}: {
  reference: string;
  ship: string;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const send = async () => {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/send-maritime", {
        method: "POST",
        body: JSON.stringify({
          to: "yanbuports@gmail.com",
          subject: `معاملة بحرية ${reference}`,
          html: `
            <h2>تم إرسال معاملة جديدة</h2>
            <p>رقم المعاملة: ${reference}</p>
            <p>السفينة: ${ship}</p>
          `,
        }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setMsg("تم الإرسال بنجاح ✅");
    } catch (err: any) {
      setMsg(err.message || "فشل الإرسال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={send}
        disabled={loading}
        className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {loading ? "جاري الإرسال..." : "إرسال المعاملة"}
      </button>

      {msg && (
        <p className="text-xs font-bold text-slate-600">{msg}</p>
      )}
    </div>
  );
}