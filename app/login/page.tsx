"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-primary">
      <div className="w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-full bg-accent-primary flex items-center justify-center mb-3">
            <span className="text-white text-xl font-semibold">L</span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Lyzr AI CFO</h1>
          <p className="text-sm text-text-secondary mt-1">
            Sign in with your Lyzr account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-bg-card rounded-card border border-border shadow-card p-6 space-y-4"
        >
          {error && (
            <div className="px-3 py-2 rounded-btn bg-danger/10 text-danger text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full rounded-btn border border-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full rounded-btn border border-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-btn bg-accent-primary text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-xs text-center text-text-secondary">
            Don&apos;t have an account?{" "}
            <span className="text-accent-primary font-medium cursor-pointer hover:underline">
              Sign up on Lyzr
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
