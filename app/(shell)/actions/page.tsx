import { ActionsRequired } from "@/components/command-center/actions-required";

export default function ActionsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          All Actions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage all pending actions
        </p>
      </div>

      <ActionsRequired limit={1000} showViewAll={false} />
    </div>
  );
}
