export function periodKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function isValidPeriodKey(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export async function upsertPeriod(
  tx: { reconPeriod: { upsert: (args: any) => Promise<any> } },
  userId: string,
  periodKey: string
): Promise<void> {
  await tx.reconPeriod.upsert({
    where: { userId_periodKey: { userId, periodKey } },
    create: { userId, periodKey, status: "open" },
    update: {},
  });
}
