import { createHash } from "node:crypto";

import { RFQ_CONSENT_CANONICAL_TEXT } from "./legal-documents.ts";

export const RFQ_CONSENT_TEXT_SHA256 = createHash("sha256")
  .update(RFQ_CONSENT_CANONICAL_TEXT, "utf8")
  .digest("hex");
