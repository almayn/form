"use client";

import { useRef, useState } from "react";

export default function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const getPos = (e: any) => {
  const canvas = canvasRef.current!;
  const rect = canvas.getBoundingClientRect();

  const point = e.touches ? e.touches[0] : e;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (point.clientX - rect.left) * scaleX,
    y: (point.clientY - rect.top) * scaleY,
  };
};

  const start = (e: any) => {
    isDrawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e.nativeEvent || e);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const move = (e: any) => {
    if (!isDrawing.current) return;

    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e.nativeEvent || e);

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stop = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const canvas = canvasRef.current!;
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white p-2">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={stop}
        />
      </div>

      <button
        type="button"
        onClick={clear}
        className="rounded-xl bg-red-600 px-4 py-2 text-white"
      >
        مسح التوقيع
      </button>
    </div>
  );
}