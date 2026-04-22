import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    dataSource: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { resolveUploadDedup, hashCsvText } from "@/lib/upload/dedup";

const mocked = prisma as unknown as {
  dataSource: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe("hashCsvText", () => {
  it("returns a deterministic 64-char hex string", () => {
    const h = hashCsvText("abc,def\n1,2\n");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCsvText("abc,def\n1,2\n")).toBe(h);
  });

  it("differs for different inputs", () => {
    expect(hashCsvText("a")).not.toBe(hashCsvText("b"));
  });
});

describe("resolveUploadDedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proceeds when no prior upload has the same hash", async () => {
    mocked.dataSource.findFirst.mockResolvedValue(null);
    const res = await resolveUploadDedup({ userId: "u1", contentHash: "h1" });
    expect(res.kind).toBe("proceed");
  });

  it("returns duplicate payload when a ready DataSource has the same hash", async () => {
    mocked.dataSource.findFirst.mockResolvedValue({
      id: "ds-old",
      name: "sample.csv",
      status: "ready",
      recordCount: 42,
      createdAt: new Date("2026-04-15T10:00:00Z"),
    });
    const res = await resolveUploadDedup({ userId: "u1", contentHash: "h1" });
    expect(res.kind).toBe("duplicate");
    if (res.kind === "duplicate") {
      expect(res.duplicateOf.id).toBe("ds-old");
      expect(res.duplicateOf.name).toBe("sample.csv");
      expect(res.duplicateOf.recordCount).toBe(42);
    }
  });

  it("ignores prior DataSources that are still processing (previous upload failed)", async () => {
    mocked.dataSource.findFirst.mockResolvedValue(null);
    const res = await resolveUploadDedup({ userId: "u1", contentHash: "h1" });
    expect(res.kind).toBe("proceed");
    expect(mocked.dataSource.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "u1",
          contentHash: "h1",
          status: "ready",
        }),
      })
    );
  });

  it("deletes the old DataSource and proceeds when replace=<id> matches the duplicate", async () => {
    mocked.dataSource.findUnique.mockResolvedValue({ id: "ds-old", userId: "u1" });
    mocked.dataSource.delete.mockResolvedValue({ id: "ds-old" });
    const res = await resolveUploadDedup({
      userId: "u1",
      contentHash: "h1",
      replaceId: "ds-old",
    });
    expect(res.kind).toBe("proceed");
    expect(mocked.dataSource.delete).toHaveBeenCalledWith({ where: { id: "ds-old" } });
  });

  it("rejects replace=<id> when the id belongs to another user", async () => {
    mocked.dataSource.findUnique.mockResolvedValue({ id: "ds-old", userId: "other-user" });
    const res = await resolveUploadDedup({
      userId: "u1",
      contentHash: "h1",
      replaceId: "ds-old",
    });
    expect(res.kind).toBe("forbidden");
    expect(mocked.dataSource.delete).not.toHaveBeenCalled();
  });

  it("rejects replace=<id> when the id does not exist", async () => {
    mocked.dataSource.findUnique.mockResolvedValue(null);
    const res = await resolveUploadDedup({
      userId: "u1",
      contentHash: "h1",
      replaceId: "ds-gone",
    });
    expect(res.kind).toBe("forbidden");
    expect(mocked.dataSource.delete).not.toHaveBeenCalled();
  });
});
