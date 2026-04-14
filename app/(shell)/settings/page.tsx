"use client";

import { useState, useEffect } from "react";

interface UserData {
  name: string;
  email: string;
  credits: number;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((session) => {
        if (session?.userId) {
          setUser({
            name: session.name || session.email.split("@")[0],
            email: session.email,
            credits: session.credits ?? 1000,
          });
        }
      });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your profile and preferences.
          </p>
        </div>

        <div className="bg-bg-card rounded-card border border-border shadow-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Name
              </label>
              <input
                type="text"
                value={user.name}
                readOnly
                className="w-full rounded-btn border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                readOnly
                className="w-full rounded-btn border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            Profile is managed through your Lyzr account.
          </p>
        </div>

        <div className="bg-bg-card rounded-card border border-border shadow-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Credits</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-text-primary">
              {user.credits.toLocaleString()}
            </span>
            <span className="text-sm text-text-secondary">credits remaining</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary rounded-full transition-all"
              style={{ width: `${Math.min((user.credits / 1000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-text-secondary">
            Credits are consumed when the AI agent processes uploads and answers questions.
          </p>
        </div>

        <div className="bg-bg-card rounded-card border border-border shadow-card p-6">
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-btn border border-danger/30 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
