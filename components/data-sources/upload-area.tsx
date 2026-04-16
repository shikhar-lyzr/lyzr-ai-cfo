"use client";

import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { clsx } from "clsx";

interface UploadAreaProps {
  onUpload: (file: File) => void;
  isUploading?: boolean;
  hint?: string;
}

export function UploadArea({ onUpload, isUploading = false, hint }: UploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      onUpload(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = "";
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={clsx(
        "flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-card cursor-pointer transition-colors",
        isDragOver
          ? "border-accent-primary bg-accent-primary/5"
          : "border-border hover:border-accent-primary/50 hover:bg-bg-primary",
        isUploading && "pointer-events-none opacity-60"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="hidden"
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Processing file...</p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-accent-primary/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-accent-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">
              Drop a CSV file here or click to browse
            </p>
            <p className="text-xs text-text-secondary mt-1">
              {hint ?? "P&L, budget vs actual, trial balance — we auto-detect the format"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
