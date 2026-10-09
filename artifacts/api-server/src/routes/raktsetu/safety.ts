import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  BlockDonorBody,
  BlockDonorResponse,
  CreateReportBody,
  CreateReportResponse,
  ListBlockedDonorsResponse,
  UnblockDonorParams,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { donorBlocksTable, donorsTable, reportsTable } from "@workspace/db";
import { requireSignedIn } from "../../middlewares/raktsetuAuth";

const router: IRouter = Router();

router.post("/reports", async (req, res): Promise<void> => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [report] = await db
    .insert(reportsTable)
    .values({
      subjectType: parsed.data.subjectType,
      subjectId: parsed.data.subjectId,
      reason: parsed.data.reason,
      details: parsed.data.details.trim(),
    })
    .returning();
  res.status(201).json(
    CreateReportResponse.parse({ id: report.id, status: report.status }),
  );
});

router.get("/blocks", requireSignedIn, async (_req, res): Promise<void> => {
  const userId = res.locals.clerkUserId as string;
  const blocks = await db
    .select({
      donorId: donorBlocksTable.donorId,
      displayName: donorsTable.displayName,
      createdAt: donorBlocksTable.createdAt,
    })
    .from(donorBlocksTable)
    .innerJoin(donorsTable, eq(donorBlocksTable.donorId, donorsTable.id))
    .where(eq(donorBlocksTable.ownerClerkUserId, userId))
    .orderBy(desc(donorBlocksTable.createdAt));
  res.json(ListBlockedDonorsResponse.parse(blocks));
});

router.post("/blocks", requireSignedIn, async (req, res): Promise<void> => {
  const parsed = BlockDonorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = res.locals.clerkUserId as string;
  const [donor] = await db
    .select()
    .from(donorsTable)
    .where(eq(donorsTable.id, parsed.data.donorId))
    .limit(1);
  if (!donor || donor.clerkUserId === userId) {
    res.status(404).json({ error: "Donor not found." });
    return;
  }
  const [block] = await db
    .insert(donorBlocksTable)
    .values({ ownerClerkUserId: userId, donorId: donor.id })
    .onConflictDoNothing()
    .returning();
  res.status(201).json(
    BlockDonorResponse.parse({
      donorId: donor.id,
      displayName: donor.displayName,
      createdAt: block?.createdAt ?? new Date(),
    }),
  );
});

router.delete(
  "/blocks/:donorId",
  requireSignedIn,
  async (req, res): Promise<void> => {
    const params = UnblockDonorParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db
      .delete(donorBlocksTable)
      .where(
        and(
          eq(donorBlocksTable.ownerClerkUserId, res.locals.clerkUserId as string),
          eq(donorBlocksTable.donorId, params.data.donorId),
        ),
      );
    res.sendStatus(204);
  },
);

export default router;
