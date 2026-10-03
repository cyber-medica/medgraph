import "server-only";

import { createHash } from "node:crypto";

export const IDN_03_PUBLICATION_OPERATION_KEY = "idn-03-publication-v1";
export const IDN_03_APPROVAL_IDEMPOTENCY_KEY = "idn-03-approval-v1";
export const IDN_03_PUBLICATION_MANIFEST_SHA256 =
  "ddac576c6a5b5d9322e15d9f109d91120ca5bf3145de1b6a6a4afd4d8a20e4c2";

export const IDN_03_PUBLICATION_MANIFEST = Object.freeze({
  version: "idn-03-publication-v1",
  createdAt: "2026-08-02T00:00:00Z",
  operationKey: IDN_03_PUBLICATION_OPERATION_KEY,
  approvalIdempotencyKey: IDN_03_APPROVAL_IDEMPOTENCY_KEY,
  productCount: 1,
  entries: Object.freeze([{
    productId: "24ac72fc-5c64-4f4e-9f92-cd4eca58e426",
    sourceUid: "363181290312",
    model: "ИДН-03",
    revisionId: "5801cde4-9341-4fe9-9e35-da47627754f9",
    reviewItemId: "a0654fd4-d65f-450d-b8ed-2270408fdcbe",
    decisionId: "9b06ac1b-2108-40fa-96ac-ed7a8fc64fdb",
    candidatePayloadChecksum:
      "85dda33600089199c2075edf08cd75f77b474e9bcee424de254f3431b3347540",
    payloadChecksum:
      "de5abe9eff70f515ab3d2908ff91f02888b46e60c0667c3b96c83fffe09a4b80",
    productIdentityChecksum:
      "855dff5fab9e9531e2063550b4bf9641f0ef12efac50d26adb743dd902faa561",
    warnings: ["missing_documents", "missing_registration"],
  }]),
} as const);

export function idn03PublicationManifestDigestInput() {
  return IDN_03_PUBLICATION_MANIFEST;
}

export function calculateIdn03PublicationManifestSha256() {
  return createHash("sha256")
    .update(JSON.stringify(idn03PublicationManifestDigestInput()))
    .digest("hex");
}

export function validateIdn03PublicationOperationRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2
    && record.operationKey === IDN_03_PUBLICATION_OPERATION_KEY
    && record.manifestSha256 === IDN_03_PUBLICATION_MANIFEST_SHA256;
}
