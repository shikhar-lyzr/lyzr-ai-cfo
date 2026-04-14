"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send } from "lucide-react";
import { clsx } from "clsx";

export function SearchBar() {
  const [value, setValue] = useState("");
  const router = useRouter();

  const handleSubmit = () => {
    if (value.trim()) {
      router.push(`/agent-console?message=${encodeURIComponent(value.trim())}`);
      setValue("");
    }
  };

  return (
    <div className={clsx(
      "flex items-center gap-3 px-4 py-3 rounded-2xl",
      "border border-border glass-input",
      "focus-within:ring-2 focus-within:ring-ring/20",
      "w-full max-w-2xl"
    )}>
      <button className="text-muted-foreground hover:text-foreground transition-colors">
        <Paperclip size={18} />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="How can I help?"
        className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
          value.trim()
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground"
        )}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
