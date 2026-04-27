"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white"
    >
      إصدار PDF
    </button>
  );
}