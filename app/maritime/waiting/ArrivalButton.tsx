"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ArrivalButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const markArrived = async () => {
    setLoading(true);

    const { error } = await supabase
      .from("maritime_health_declarations")
      .update({
        arrival_status: "arrived",
        actual_arrival_at: new Date().toISOString(),
      })
      .eq("id", id);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={markArrived}
      disabled={loading}
      className="rounded-xl bg-green-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
    >
      {loading ? "جاري التسجيل..." : "تسجيل الوصول"}
    </button>
  );
}