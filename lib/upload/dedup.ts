import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export function hashCsvText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export type DedupResult =
  | { kind: "proceed" }
  | {
      kind: "duplicate";
      duplicateOf: {
        id: string;
        name: string;
        recordCount: number;
        createdAt: Date;
      };
    }
  | { kind: "forbidden" };

export async function resolveUploadDedup(params: {
  userId: string;
  contentHash: string;
  replaceId?: string | null;
}): Promise<DedupResult> {
  const { userId, contentHash, replaceId } = params;

  if (replaceId) {
    const target = await prisma.dataSource.findUnique({
      where: { id: replaceId },
      select: { id: true, userId: true },
    });
    if (!target || target.userId !== userId) return { kind: "forbidden" };
    await prisma.dataSource.delete({ where: { id: replaceId } });
    return { kind: "proceed" };
  }

  const prior = await prisma.dataSource.findFirst({
    where: { userId, contentHash, status: "ready" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, recordCount: true, createdAt: true },
  });
  if (!prior) return { kind: "proceed" };
  return { kind: "duplicate", duplicateOf: prior };
}
