import { randomBytes } from "node:crypto";

export function makeTrackingCode(): string {
  return randomBytes(32).toString("base64url");
}
