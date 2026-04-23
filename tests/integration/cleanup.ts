// tests/integration/cleanup.ts
import { prisma } from "@/lib/db";

// Deletes a test user and all its rows in dependency order. The schema has
// no User-level cascades, so children must be removed explicitly. This is
// intentionally verbose — trying to be clever here masks FK errors.
export async function deleteTestUser(userId: string): Promise<void> {
  // Action-side: ActionEvent references Action; ChatMessage references Action
  await prisma.actionEvent.deleteMany({ where: { userId } });
  await prisma.chatMessage.deleteMany({ where: { userId } });
  await prisma.action.deleteMany({ where: { userId } });

  // MatchRun cascades to MatchLink and Break
  await prisma.matchRun.deleteMany({ where: { userId } });

  // Documents, journals, recon periods (Restrict)
  await prisma.document.deleteMany({ where: { userId } });
  await prisma.journalAdjustment.deleteMany({ where: { userId } });
  await prisma.reconPeriod.deleteMany({ where: { userId } });

  // DataSource cascades to FinancialRecord/Invoice/GLEntry/SubLedgerEntry
  await prisma.dataSource.deleteMany({ where: { userId } });

  await prisma.user.delete({ where: { id: userId } });
}
