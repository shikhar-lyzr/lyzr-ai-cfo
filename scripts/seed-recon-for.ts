import { seedReconciliation } from "@/lib/seed/reconciliation";

const userId = process.argv[2];
if (!userId) {
  console.error("usage: tsx scripts/seed-recon-for.ts <userId>");
  process.exit(1);
}

seedReconciliation(userId)
  .then(() => {
    console.log("seeded", userId);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
