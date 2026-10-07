"use client";

import { useRef, useState } from "react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type Props = {
  onStampReady: (file: File, previewUrl: string) => void;
};

export default function StampCropper({ onStampReady }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [imageSrc, setImageSrc] = useState("");
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    x: 25,
    y: 25,
    width: 35,
    height: 25,
  });

  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);

  const onSelectImage = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(String(reader.result));
      setCompletedCrop(null);
      setCrop({
        unit: "%",
        x: 25,
        y: 25,
        width: 35,
        height: 25,
      });
    };
    reader.readAsDataURL(file);
  };

  const cropStamp = async () => {
    if (!imgRef.current || !completedCrop) return;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");

    const scaleX = image.naturalWidth / image.clientWidth;
    const scaleY = image.naturalHeight / image.clientHeight;

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    canvas.width = Math.round(cropWidth);
    canvas.height = Math.round(cropHeight);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const file = new File([blob], "ship-stamp.png", {
          type: "image/png",
        });

        const previewUrl = URL.createObjectURL(blob);
        onStampReady(file, previewUrl);
        setImageSrc("");
setCompletedCrop(null);
      },
      "image/png",
      1
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
        <p className="font-black text-slate-900">أضف صورة لاستخراج الختم</p>
        <p className="mt-1 text-sm font-bold text-slate-500">
          اختر صورة من الجهاز أو التقطها الآن من الشهادة أو الكرو لست أو التطعيمات
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <label className="cursor-pointer rounded-xl bg-blue-800 px-4 py-2 text-sm font-black text-white shadow hover:bg-blue-900">
            تحميل / اختيار صورة
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onSelectImage(e.target.files?.[0] || null);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <label className="cursor-pointer rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-black text-blue-900 shadow-sm hover:bg-blue-50">
            التقاط بالكاميرا
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                onSelectImage(e.target.files?.[0] || null);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {imageSrc && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex justify-center overflow-auto rounded-xl bg-slate-100 p-2">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              keepSelection
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Stamp source"
                className="block max-h-[420px] max-w-full"
                style={{
                  width: "auto",
                  height: "auto",
                  objectFit: "unset",
                }}
              />
            </ReactCrop>
          </div>

          <button
            type="button"
            onClick={cropStamp}
            disabled={!completedCrop?.width || !completedCrop?.height}
            className="mt-4 w-full rounded-2xl bg-blue-800 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            قص الختم واعتماده
          </button>
        </div>
      )}
    </div>
  );
}