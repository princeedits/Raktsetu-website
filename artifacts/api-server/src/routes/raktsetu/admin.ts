import { count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetAdminOverviewResponse,
  ListAdminReportsQueryParams,
  ListAdminReportsResponse,
  UpdateAdminReportBody,
  UpdateAdminReportParams,
  UpdateAdminReportResponse,
} from "@workspace/api-zod";
import {
  bloodBanksTable,
  donorsTable,
  emergencyRequestsTable,
  reportsTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import { requireRaktsetuAdmin } from "../../middlewares/raktsetuAuth";

const router: IRouter = Router();

router.get(
  "/admin/overview",
  requireRaktsetuAdmin,
  async (_req, res): Promise<void> => {
    const [
      [donorCount],
      [availableDonorCount],
      [activeRequestCount],
      [openReportCount],
      recentRequests,
    ] = await Promise.all([
      db.select({ value: count() }).from(donorsTable),
      db
        .select({ value: count() })
        .from(donorsTable)
        .where(eq(donorsTable.available, true)),
      db
        .select({ value: count() })
        .from(emergencyRequestsTable)
        .where(eq(emergencyRequestsTable.status, "active")),
      db
        .select({ value: count() })
        .from(reportsTable)
        .where(eq(reportsTable.status, "open")),
      db
        .select({
          id: emergencyRequestsTable.id,
          bloodGroup: emergencyRequestsTable.bloodGroup,
          city: emergencyRequestsTable.city,
          area: emergencyRequestsTable.area,
          hospital: emergencyRequestsTable.hospital,
          units: emergencyRequestsTable.units,
          urgency: emergencyRequestsTable.urgency,
          status: emergencyRequestsTable.status,
          createdAt: emergencyRequestsTable.createdAt,
        })
        .from(emergencyRequestsTable)
        .orderBy(desc(emergencyRequestsTable.createdAt))
        .limit(5),
    ]);

    res.json(
      GetAdminOverviewResponse.parse({
        donorCount: donorCount.value,
        availableDonorCount: availableDonorCount.value,
        activeRequestCount: activeRequestCount.value,
        openReportCount: openReportCount.value,
        recentRequests,
      }),
    );
  },
);

router.get(
  "/admin/reports",
  requireRaktsetuAdmin,
  async (req, res): Promise<void> => {
    const query = ListAdminReportsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }
    const reports = await db
      .select()
      .from(reportsTable)
      .where(
        query.data.status
          ? eq(reportsTable.status, query.data.status)
          : undefined,
      )
      .orderBy(desc(reportsTable.createdAt));
    res.json(ListAdminReportsResponse.parse(reports));
  },
);

router.patch(
  "/admin/reports/:id",
  requireRaktsetuAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminReportParams.safeParse(req.params);
    const parsed = UpdateAdminReportBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: params.error?.message ?? parsed.error?.message ?? "Invalid update.",
      });
      return;
    }
    const [report] = await db
      .update(reportsTable)
      .set({
        status: parsed.data.status,
        reviewedAt: new Date(),
      })
      .where(eq(reportsTable.id, params.data.id))
      .returning();
    if (!report) {
      res.status(404).json({ error: "Report not found." });
      return;
    }
    res.json(UpdateAdminReportResponse.parse(report));
  },
);

export default router;
