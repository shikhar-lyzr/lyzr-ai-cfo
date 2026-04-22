import { prisma } from "@/lib/db";

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("no user — run base seed first");
  await prisma.reconPeriod.upsert({
    where: { userId_periodKey: { userId: user.id, periodKey: "2026-04" } },
    create: { userId: user.id, periodKey: "2026-04" },
    update: {},
  });
  console.log("seeded close demo period 2026-04 for", user.email);
}

main().finally(() => prisma.$disconnect());
