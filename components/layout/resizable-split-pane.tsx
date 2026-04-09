"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { clsx } from "clsx";

interface ResizableSplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
}

export function ResizableSplitPane({
  left,
  right,
  defaultLeftPercent = 60,
  minLeftPercent = 30,
  maxLeftPercent = 80,
}: ResizableSplitPaneProps) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = (x / rect.width) * 100;
      const clamped = Math.min(maxLeftPercent, Math.max(minLeftPercent, percent));
      setLeftPercent(clamped);
    },
    [isDragging, minLeftPercent, maxLeftPercent]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div
        className="overflow-y-auto"
        style={{ width: `${leftPercent}%` }}
      >
        {left}
      </div>

      <div
        onMouseDown={handleMouseDown}
        className={clsx(
          "w-1 shrink-0 cursor-col-resize transition-colors relative group",
          isDragging ? "bg-accent-primary" : "bg-border hover:bg-accent-primary/50"
        )}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      <div
        className="overflow-y-auto"
        style={{ width: `${100 - leftPercent}%` }}
      >
        {right}
      </div>
    </div>
  );
}
