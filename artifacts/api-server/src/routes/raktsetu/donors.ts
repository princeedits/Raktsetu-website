import { and, desc, eq, ilike, inArray, notInArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  bloodBanksTable,
  contactRequestsTable,
  donorBlocksTable,
  donorsTable,
  emergencyRequestsTable,
} from "@workspace/db";
import {
  CreateContactRequestBody,
  CreateContactRequestParams,
  CreateContactRequestResponse,
  DecideContactRequestBody,
  DecideContactRequestParams,
  DecideContactRequestResponse,
  GetMyDonorProfileResponse,
  ListBloodBanksQueryParams,
  ListBloodBanksResponse,
  ListDonorsQueryParams,
  ListDonorsResponse,
  ListMyContactRequestsResponse,
  ListNearbyRequestsQueryParams,
  ListNearbyRequestsResponse,
  SaveMyDonorProfileBody,
  SaveMyDonorProfileResponse,
  SetDonorAvailabilityBody,
  SetDonorAvailabilityResponse,
  TrackContactRequestParams,
  TrackContactRequestResponse,
  UpdateMyDonorProfileBody,
  UpdateMyDonorProfileResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { requireSignedIn } from "../../middlewares/raktsetuAuth";
import { makeTrackingCode } from "../../lib/raktsetu";

const router: IRouter = Router();

function profileRecord(
  donor: typeof donorsTable.$inferSelect,
): Record<string, unknown> {
  return {
    id: donor.id,
    displayName: donor.displayName,
    bloodGroup: donor.bloodGroup,
    city: donor.city,
    area: donor.area,
    available: donor.available,
    shareContact: donor.shareContact,
    lastDonatedAt: donor.lastDonatedAt,
    createdAt: donor.createdAt,
    phone: donor.phone,
    notificationsEnabled: donor.notificationsEnabled,
  };
}

function dateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

router.get("/donors", async (req, res): Promise<void> => {
  const query = ListDonorsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { bloodGroup, city, availableOnly, limit } = query.data;
  const filters = [];
  if (bloodGroup) filters.push(eq(donorsTable.bloodGroup, bloodGroup));
  if (city?.trim()) filters.push(ilike(donorsTable.city, `%${city.trim()}%`));
  if (availableOnly) filters.push(eq(donorsTable.available, true));

  const currentUserId = res.locals.clerkUserId as string | undefined;
  let blockedIds: string[] = [];
  if (currentUserId) {
    const blocks = await db
      .select({ donorId: donorBlocksTable.donorId })
      .from(donorBlocksTable)
      .where(eq(donorBlocksTable.ownerClerkUserId, currentUserId));
    blockedIds = blocks.map((block) => block.donorId);
  }
  if (blockedIds.length) filters.push(notInArray(donorsTable.id, blockedIds));

  const donors = await db
    .select()
    .from(donorsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(donorsTable.available), desc(donorsTable.createdAt))
    .limit(limit);

  res.json(
    ListDonorsResponse.parse(
      donors.map((donor) => ({
        id: donor.id,
        displayName: donor.displayName,
        bloodGroup: donor.bloodGroup,
        city: donor.city,
        area: donor.area,
        available: donor.available,
        shareContact: donor.shareContact,
        lastDonatedAt: donor.lastDonatedAt,
        createdAt: donor.createdAt,
      })),
    ),
  );
});

router.get("/banks", async (req, res): Promise<void> => {
  const query = ListBloodBanksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const filters = query.data.city?.trim()
    ? [ilike(bloodBanksTable.city, `%${query.data.city.trim()}%`)]
    : [];
  const banks = await db
    .select({
      id: bloodBanksTable.id,
      name: bloodBanksTable.name,
      city: bloodBanksTable.city,
      area: bloodBanksTable.area,
      address: bloodBanksTable.address,
      phone: bloodBanksTable.phone,
      hours: bloodBanksTable.hours,
      verified: bloodBanksTable.verified,
    })
    .from(bloodBanksTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(bloodBanksTable.verified), bloodBanksTable.name)
    .limit(query.data.limit);
  res.json(ListBloodBanksResponse.parse(banks));
});

router.get("/donors/me", requireSignedIn, async (_req, res): Promise<void> => {
  const userId = res.locals.clerkUserId as string;
  const [donor] = await db
    .select()
    .from(donorsTable)
    .where(eq(donorsTable.clerkUserId, userId))
    .limit(1);
  if (!donor) {
    res.status(404).json({ error: "Donor profile not found." });
    return;
  }
  res.json(GetMyDonorProfileResponse.parse(profileRecord(donor)));
});

router.put("/donors/me", requireSignedIn, async (req, res): Promise<void> => {
  const parsed = SaveMyDonorProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.clerkUserId as string;
  const data = parsed.data;
  const values = {
    clerkUserId: userId,
    displayName: data.displayName.trim(),
    bloodGroup: data.bloodGroup,
    city: data.city.trim(),
    area: data.area.trim(),
    phone: data.phone.trim(),
    lastDonatedAt: dateOnly(data.lastDonatedAt),
    shareContact: data.shareContact,
    notificationsEnabled: data.notificationsEnabled,
    updatedAt: new Date(),
  };
  const [donor] = await db
    .insert(donorsTable)
    .values(values)
    .onConflictDoUpdate({
      target: donorsTable.clerkUserId,
      set: values,
    })
    .returning();

  res.json(SaveMyDonorProfileResponse.parse(profileRecord(donor)));
});

router.patch("/donors/me", requireSignedIn, async (req, res): Promise<void> => {
  const parsed = UpdateMyDonorProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.clerkUserId as string;
  const data = parsed.data;
  const updates: Partial<typeof donorsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (data.displayName !== undefined) updates.displayName = data.displayName.trim();
  if (data.bloodGroup !== undefined) updates.bloodGroup = data.bloodGroup;
  if (data.city !== undefined) updates.city = data.city.trim();
  if (data.area !== undefined) updates.area = data.area.trim();
  if (data.phone !== undefined) updates.phone = data.phone.trim();
  if (data.lastDonatedAt !== undefined) {
    updates.lastDonatedAt = dateOnly(data.lastDonatedAt);
  }
  if (data.shareContact !== undefined) updates.shareContact = data.shareContact;
  if (data.notificationsEnabled !== undefined) {
    updates.notificationsEnabled = data.notificationsEnabled;
  }

  const [donor] = await db
    .update(donorsTable)
    .set(updates)
    .where(eq(donorsTable.clerkUserId, userId))
    .returning();
  if (!donor) {
    res.status(404).json({ error: "Donor profile not found." });
    return;
  }
  res.json(UpdateMyDonorProfileResponse.parse(profileRecord(donor)));
});

router.patch(
  "/donors/me/availability",
  requireSignedIn,
  async (req, res): Promise<void> => {
    const parsed = SetDonorAvailabilityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const userId = res.locals.clerkUserId as string;
    const [donor] = await db
      .update(donorsTable)
      .set({ available: parsed.data.available, updatedAt: new Date() })
      .where(eq(donorsTable.clerkUserId, userId))
      .returning();
    if (!donor) {
      res.status(404).json({ error: "Create a donor profile before changing availability." });
      return;
    }
    res.json(SetDonorAvailabilityResponse.parse(profileRecord(donor)));
  },
);

router.get(
  "/donors/me/nearby-requests",
  requireSignedIn,
  async (req, res): Promise<void> => {
    const query = ListNearbyRequestsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: query.error.message });
      return;
    }
    const userId = res.locals.clerkUserId as string;
    const [donor] = await db
      .select()
      .from(donorsTable)
      .where(eq(donorsTable.clerkUserId, userId))
      .limit(1);
    if (!donor) {
      res.status(404).json({ error: "Create a donor profile to view nearby requests." });
      return;
    }
    const requests = await db
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
      .where(
        and(
          eq(emergencyRequestsTable.city, donor.city),
          eq(emergencyRequestsTable.bloodGroup, donor.bloodGroup),
          inArray(emergencyRequestsTable.status, ["active", "matching"]),
        ),
      )
      .orderBy(desc(emergencyRequestsTable.createdAt))
      .limit(query.data.limit);
    res.json(ListNearbyRequestsResponse.parse(requests));
  },
);

router.post(
  "/donors/:donorId/contact-requests",
  async (req, res): Promise<void> => {
    const params = CreateContactRequestParams.safeParse(req.params);
    const parsed = CreateContactRequestBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: params.error?.message ?? parsed.error?.message ?? "Invalid request.",
      });
      return;
    }

    const [donor] = await db
      .select()
      .from(donorsTable)
      .where(
        and(
          eq(donorsTable.id, params.data.donorId),
          eq(donorsTable.available, true),
          eq(donorsTable.shareContact, true),
        ),
      )
      .limit(1);
    if (!donor) {
      res.status(404).json({ error: "This donor is not accepting contact requests." });
      return;
    }

    const [contactRequest] = await db
      .insert(contactRequestsTable)
      .values({
        trackingCode: makeTrackingCode(),
        donorId: donor.id,
        requesterName: parsed.data.requesterName.trim(),
        requesterPhone: parsed.data.requesterPhone.trim(),
        requesterEmail: parsed.data.requesterEmail?.trim() || null,
        message: parsed.data.message.trim(),
      })
      .returning();
    res.status(201).json(
      CreateContactRequestResponse.parse({
        id: contactRequest.id,
        trackingCode: contactRequest.trackingCode,
        status: contactRequest.status,
      }),
    );
  },
);

router.get(
  "/donors/me/contact-requests",
  requireSignedIn,
  async (_req, res): Promise<void> => {
    const userId = res.locals.clerkUserId as string;
    const [donor] = await db
      .select({ id: donorsTable.id })
      .from(donorsTable)
      .where(eq(donorsTable.clerkUserId, userId))
      .limit(1);
    if (!donor) {
      res.json([]);
      return;
    }
    const requests = await db
      .select({
        id: contactRequestsTable.id,
        requesterName: contactRequestsTable.requesterName,
        requesterPhone: contactRequestsTable.requesterPhone,
        requesterEmail: contactRequestsTable.requesterEmail,
        message: contactRequestsTable.message,
        status: contactRequestsTable.status,
        sharePhone: contactRequestsTable.sharePhone,
        createdAt: contactRequestsTable.createdAt,
      })
      .from(contactRequestsTable)
      .where(eq(contactRequestsTable.donorId, donor.id))
      .orderBy(desc(contactRequestsTable.createdAt));
    res.json(ListMyContactRequestsResponse.parse(requests));
  },
);

router.patch(
  "/contact-requests/:id/decision",
  requireSignedIn,
  async (req, res): Promise<void> => {
    const params = DecideContactRequestParams.safeParse(req.params);
    const parsed = DecideContactRequestBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: params.error?.message ?? parsed.error?.message ?? "Invalid decision.",
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
      res.status(404).json({ error: "Donor profile not found." });
      return;
    }

    const approvedShare =
      parsed.data.status === "accepted" &&
      parsed.data.sharePhone &&
      donor.shareContact;
    const [saved] = await db
      .update(contactRequestsTable)
      .set({
        status: parsed.data.status,
        sharePhone: approvedShare,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contactRequestsTable.id, params.data.id),
          eq(contactRequestsTable.donorId, donor.id),
        ),
      )
      .returning();
    if (!saved) {
      res.status(404).json({ error: "Contact request not found." });
      return;
    }
    res.json(
      DecideContactRequestResponse.parse({
        id: saved.id,
        requesterName: saved.requesterName,
        requesterPhone: saved.requesterPhone,
        requesterEmail: saved.requesterEmail,
        message: saved.message,
        status: saved.status,
        sharePhone: saved.sharePhone,
        createdAt: saved.createdAt,
      }),
    );
  },
);

router.get(
  "/contact-requests/track/:trackingCode",
  async (req, res): Promise<void> => {
    const params = TrackContactRequestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [record] = await db
      .select({
        request: contactRequestsTable,
        donorName: donorsTable.displayName,
        donorPhone: donorsTable.phone,
        donorStillConsents: donorsTable.shareContact,
      })
      .from(contactRequestsTable)
      .innerJoin(donorsTable, eq(contactRequestsTable.donorId, donorsTable.id))
      .where(eq(contactRequestsTable.trackingCode, params.data.trackingCode))
      .limit(1);
    if (!record) {
      res.status(404).json({ error: "Contact request not found." });
      return;
    }
    const sharePhone =
      record.request.status === "accepted" &&
      record.request.sharePhone &&
      record.donorStillConsents;
    res.json(
      TrackContactRequestResponse.parse({
        id: record.request.id,
        donorName: record.donorName,
        status: record.request.status,
        sharePhone,
        donorPhone: sharePhone ? record.donorPhone : null,
        createdAt: record.request.createdAt,
      }),
    );
  },
);

export default router;
