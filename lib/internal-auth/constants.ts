export const INTERNAL_AUTH_CALLBACK_PATH = "/auth/callback";
export const GENERIC_REVIEW_QUEUE_PATH = "/internal/review";
export const HAMILTON_REVIEW_PATH = "/internal/review/hamilton-t1";
export const MINDRAY_REVIEW_PATH = "/internal/review/mindray-sv300";
export const AGILIA_REVIEW_PATH = "/internal/review/agilia-sp-mc";
export const INTERNAL_LOGIN_PATH = "/internal/login";

export const HAMILTON_REVIEW = Object.freeze({
  productId: "e66a1165-030b-4aa4-a400-959f1ac70fe3",
  productName: "Hamilton-T1",
  revisionId: "8d48a2b5-0842-4796-803f-4e4daf6f6e17",
  reviewItemId: "68926883-2923-4dce-acea-cdb13ea08ded",
  revisionNumber: 1,
  payloadChecksum:
    "f391551c5eede060365d23440f79dce518d41e7197cee01511a63587da97c2bf",
  candidatePayloadChecksum:
    "70bca4a6707b0b3f52e5bd9535075ca68a31257514e1bf34535e04510a18b562",
  productIdentityChecksum:
    "495e2a41c1527df3748e6ac0cc770bc4321d8044f121416e6792b2597fc3aea2",
  rationale:
    "Reviewed immutable Hamilton-T1 revision 1. Product identity, canonical Russian content, SEO, characteristics, media and approved claims match the current publication candidate. Warnings missing_documents and missing_registration are acknowledged as non-blocking for this lifecycle stage.",
});

export const MINDRAY_REVIEW = Object.freeze({
  productId: "00e3f62b-797b-40ff-bf9f-9d1750828ca4",
  productName: "Mindray SV300",
  revisionId: "8088bdda-cad1-4341-8780-528ba2338565",
  reviewItemId: "28dc7e10-46b8-4202-928f-979a647aeb78",
  revisionNumber: 1,
  candidatePayloadChecksum:
    "2f95e154efaecf4daf3a9a475572059e5440db58bd8c0a13b0de5eff13fc5d4c",
  payloadChecksum:
    "bd7b23d845cf0dd2a5a5f53e9a5f2165b3c13af12e1adb0e93a39b34ab537cc8",
  rationale:
    "Reviewed immutable Mindray SV300 revision 1. Product identity, canonical Russian content, SEO, characteristics, media and source-grounded claims match the current publication candidate. Warnings missing_registration and missing_documents are acknowledged as non-blocking for this lifecycle stage.",
});

export const AGILIA_REVIEW = Object.freeze({
  productId: "b7f07e3e-5cdd-4988-b2a4-423bed321f46",
  productName: "Fresenius Kabi Agilia SP MC",
  revisionId: "e09f69c9-fbc5-4f6e-a240-05372e959510",
  reviewItemId: "a656c3aa-47e8-4985-8d3a-c3af0478829c",
  revisionNumber: 1,
  candidatePayloadChecksum:
    "d14d6199641cec398e2d9ab48e86583fcab1575bd904e03d4fa4d7c0d8060747",
  payloadChecksum:
    "3a00677a295110252d1f963c4296b099de78c36af4ea152d6e655944dedf0472",
  productIdentityChecksum:
    "7e17a8f60997dc9fae5843ef4857e6e634fbd6741baa6ff5e034842c956a9d7e",
  rationale:
    "Reviewed immutable Fresenius Kabi Agilia SP MC revision 1. Product identity, canonical Russian content, SEO, characteristics, media and source-grounded claims match the current publication candidate. Warnings missing_registration and missing_documents are acknowledged as non-blocking for this lifecycle stage.",
});

export const AUTH_ERROR_CODES = Object.freeze({
  invalidCallback: "AUTH_CALLBACK_INVALID",
  exchangeFailed: "AUTH_CALLBACK_EXCHANGE_FAILED",
  notAuthorized: "AUTH_PROFILE_NOT_AUTHORIZED",
  sessionRequired: "AUTH_SESSION_REQUIRED",
  loginUnavailable: "AUTH_LOGIN_UNAVAILABLE",
  emailRateLimited: "EMAIL_RATE_LIMITED",
  emailNotAllowed: "EMAIL_NOT_ALLOWED",
  authConfigurationError: "AUTH_CONFIGURATION_ERROR",
  authProviderError: "AUTH_PROVIDER_ERROR",
});

export const SENSITIVE_AUTH_PARAMETERS = new Set([
  "code",
  "token",
  "token_hash",
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
  "session",
  "jwt",
]);
