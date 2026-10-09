import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateDonorResponseBody,
  CreateDonorResponseParams,
  CreateDonorResponseResponse,
  CreateEmergencyRequestBody,
  CreateEmergencyRequestResponse,
  TrackEmergencyRequestParams,
  TrackEmergencyRequestResponse,
} from "@workspace/api-zod";
import {
  donorResponsesTable,
  donorsTable,
  emergencyRequestsTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import { requireSignedIn } from "../../middlewares/raktsetuAuth";
import { makeTrackingCode } from "../../lib/raktsetu";

const router: IRouter = Router();

router.post("/requests", async (req, res): Promise<void> => {
  const parsed = CreateEmergencyRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.consentToContact !== true) {
    res.status(400).json({ error: "Consent to contact is required to submit a request." });
    return;
  }

  const data = parsed.data;
  const [request] = await db
    .insert(emergencyRequestsTable)
    .values({
      trackingCode: makeTrackingCode(),
      patientName: data.patientName.trim(),
      contactPhone: data.contactPhone.trim(),
      bloodGroup: data.bloodGroup,
      city: data.city.trim(),
      area: data.area.trim(),
      hospital: data.hospital.trim(),
      units: data.units,
      urgency: data.urgency,
      neededBy: data.neededBy ?? null,
      details: data.details.trim(),
      consentToContact: true,
    })
    .returning();
  res.status(201).json(
    CreateEmergencyRequestResponse.parse({
      id: request.id,
      trackingCode: request.trackingCode,
      status: request.status,
      createdAt: request.createdAt,
    }),
  );
});

router.get(
  "/requests/track/:trackingCode",
  async (req, res): Promise<void> => {
    const params = TrackEmergencyRequestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [request] = await db
      .select()
      .from(emergencyRequestsTable)
      .where(eq(emergencyRequestsTable.trackingCode, params.data.trackingCode))
      .limit(1);
    if (!request) {
      res.status(404).json({ error: "Blood request not found." });
      return;
    }

    const responses = await db
      .select({
        id: donorResponsesTable.id,
        donorName: donorsTable.displayName,
        message: donorResponsesTable.message,
        shareContact: donorResponsesTable.shareContact,
        donorPhone: donorsTable.phone,
        donorStillConsents: donorsTable.shareContact,
        createdAt: donorResponsesTable.createdAt,
      })
      .from(donorResponsesTable)
      .innerJoin(donorsTable, eq(donorResponsesTable.donorId, donorsTable.id))
      .where(eq(donorResponsesTable.requestId, request.id))
      .orderBy(desc(donorResponsesTable.createdAt));

    res.json(
      TrackEmergencyRequestResponse.parse({
        id: request.id,
        bloodGroup: request.bloodGroup,
        city: request.city,
        area: request.area,
        hospital: request.hospital,
        units: request.units,
        urgency: request.urgency,
        status: request.status,
        createdAt: request.createdAt,
        responses: responses.map((response) => {
          const shareContact = response.shareContact && response.donorStillConsents;
          return {
            id: response.id,
            donorName: response.donorName,
            message: response.message,
            shareContact,
            donorPhone: shareContact ? response.donorPhone : null,
            createdAt: response.createdAt,
          };
        }),
      }),
    );
  },
);

router.post(
  "/requests/:requestId/responses",
  requireSignedIn,
  async (req, res): Promise<void> => {
    const params = CreateDonorResponseParams.safeParse(req.params);
    const parsed = CreateDonorResponseBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: params.error?.message ?? parsed.error?.message ?? "Invalid response.",
      });
      return;
    }
    const userId = res.locals.clerkUserId as string;
    const [donor] = await db
      .select()
      .from(donorsTable)
      .where(eq(donorsTable.clerkUserId, userId))
      .limit(1);
    if (!donor) {
      res.status(404).json({ error: "Create a donor profile before responding." });
      return;
    }

    const [request] = await db
      .select()
      .from(emergencyRequestsTable)
      .where(
        and(
          eq(emergencyRequestsTable.id, params.data.requestId),
          inArray(emergencyRequestsTable.status, ["active", "matching"]),
        ),
      )
      .limit(1);
    if (!request) {
      res.status(404).json({ error: "Active blood request not found." });
      return;
    }
    if (
      request.city.toLocaleLowerCase() !== donor.city.toLocaleLowerCase() ||
      request.bloodGroup !== donor.bloodGroup
    ) {
      res.status(404).json({ error: "This request is not a match for your current profile." });
      return;
    }

    const shareContact = parsed.data.shareContact && donor.shareContact;
    let [response] = await db
      .insert(donorResponsesTable)
      .values({
        requestId: request.id,
        donorId: donor.id,
        message: parsed.data.message.trim(),
        shareContact,
      })
      .onConflictDoNothing()
      .returning();
    if (!response) {
      [response] = await db
        .select()
        .from(donorResponsesTable)
        .where(
          and(
            eq(donorResponsesTable.requestId, request.id),
            eq(donorResponsesTable.donorId, donor.id),
          ),
        )
        .limit(1);
    } else if (request.status === "active") {
      await db
        .update(emergencyRequestsTable)
        .set({ status: "matching", updatedAt: new Date() })
        .where(eq(emergencyRequestsTable.id, request.id));
    }

    res.status(201).json(
      CreateDonorResponseResponse.parse({
        id: response.id,
        donorName: donor.displayName,
        message: response.message,
        shareContact: response.shareContact && donor.shareContact,
        donorPhone:
          response.shareContact && donor.shareContact ? donor.phone : null,
        createdAt: response.createdAt,
      }),
    );
  },
);

export default router;
