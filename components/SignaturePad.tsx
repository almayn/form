"use client";

import { useRef, useState } from "react";

export default function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const getPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    isDrawing.current = true;
    setHasInk(true);

    const context = canvasRef.current!.getContext("2d")!;
    const position = getPosition(event);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    context.beginPath();
    context.moveTo(position.x, position.y);
    context.lineTo(position.x + 0.5, position.y + 0.5);
    context.stroke();
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;

    event.preventDefault();
    const context = canvasRef.current!.getContext("2d")!;
    const position = getPosition(event);

    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    context.lineTo(position.x, position.y);
    context.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    isDrawing.current = false;
    setHasInk(false);
  };

  const approve = () => {
    if (!hasInk) return;
    onChange(canvasRef.current!.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-medium text-slate-600">
        وقّع داخل المساحة، ثم راجع التوقيع واضغط «اعتماد التوقيع».
      </p>

      <div className="overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          width={900}
          height={300}
          aria-label="مساحة التوقيع"
          className="block w-full touch-none select-none cursor-crosshair"
          style={{ touchAction: "none" }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={clear}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          مسح التوقيع
        </button>
        <button
          type="button"
          onClick={approve}
          disabled={!hasInk}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          اعتماد التوقيع
        </button>
      </div>
    </div>
  );
}
