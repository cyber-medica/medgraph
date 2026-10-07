export class SupabaseEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseEnvironmentError";
  }
}

export type SupabaseCredentialMode =
  | "publishable"
  | "legacy_anon"
  | "secret"
  | "legacy_service_role";

export interface SupabaseApiCredential {
  key: string;
  mode: SupabaseCredentialMode;
  sendAsBearer: boolean;
}

export interface SupabasePublicEnvironment {
  url: string;
  publicCredential: SupabaseApiCredential;
}

export interface SupabaseServiceEnvironment {
  url: string;
  privilegedCredential: SupabaseApiCredential;
}

export interface SupabaseProjectBoundServiceEnvironment {
  url: string;
  projectRef: string;
  privilegedCredential: SupabaseApiCredential;
}

export const LOCAL_SUPABASE_ORIGIN_OPT_IN = "CYBERMEDICA_ALLOW_LOCAL_SUPABASE_ORIGIN";
export const PROJECT_BOUND_SUPABASE_URL_ENV = "CYBERMEDICA_SUPABASE_URL";
export const PROJECT_BOUND_SUPABASE_REF_ENV = "CYBERMEDICA_SUPABASE_PROJECT_REF";
export const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
export const LEGACY_SUPABASE_ANON_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
export const SUPABASE_SECRET_KEY_ENV = "SUPABASE_SECRET_KEY";
export const LEGACY_SUPABASE_SERVICE_ROLE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";
export const STAGING_SUPABASE_PROJECT_REF = "gjlpkqdhlzbfnzzoxlsk";
export const PRODUCTION_SUPABASE_PROJECT_REF = "clbzibuusyuajsylcbvl";
export const LOCAL_SUPABASE_PROJECT_REF = "localdevelopment0001";

const supabaseProjectHostname = /^[a-z0-9]{20}\.supabase\.co$/u;
const supabaseProjectRef = /^[a-z0-9]{20}$/u;
const publishableKeyPattern = /^sb_publishable_[A-Za-z0-9_-]{16,}$/u;
const secretKeyPattern = /^sb_secret_[A-Za-z0-9_-]{16,}$/u;
const jwtSegmentPattern = /^[A-Za-z0-9_-]+$/u;
const localSupabaseHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type SupabaseDeploymentEnvironment = "production" | "preview" | "local";

const approvedProjectRefByEnvironment: Readonly<
  Record<SupabaseDeploymentEnvironment, string>
> = Object.freeze({
  production: PRODUCTION_SUPABASE_PROJECT_REF,
  preview: STAGING_SUPABASE_PROJECT_REF,
  local: STAGING_SUPABASE_PROJECT_REF,
});

export interface ValidateSupabaseProjectOriginOptions {
  allowLocalDevelopment?: boolean;
}

export interface ValidateSupabaseProjectBindingOptions {
  deploymentEnvironment: SupabaseDeploymentEnvironment;
  allowLocalQa?: boolean;
}

function resolveSupabaseDeploymentEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): SupabaseDeploymentEnvironment {
  const vercelEnvironment = environment.VERCEL_ENV?.trim();
  if (vercelEnvironment === "production" || vercelEnvironment === "preview") {
    return vercelEnvironment;
  }
  if (vercelEnvironment === "development") return "local";
  if (vercelEnvironment !== undefined && vercelEnvironment !== "") {
    throw new SupabaseEnvironmentError("Supabase deployment environment is unsupported.");
  }

  if (environment.VERCEL === "1") {
    throw new SupabaseEnvironmentError("Supabase deployment environment is required.");
  }

  const nodeEnvironment = environment.NODE_ENV?.trim();
  if (nodeEnvironment === "development" || nodeEnvironment === "test") {
    return "local";
  }

  throw new SupabaseEnvironmentError("Supabase deployment environment is required.");
}

function requireValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) throw new SupabaseEnvironmentError(`${name} is required.`);
  return value;
}

function optionalCredentialValue(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): string | null {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === "") return null;
  const value = rawValue.trim();
  if (!value || value !== rawValue) {
    throw new SupabaseEnvironmentError(`${name} is malformed.`);
  }
  return value;
}

function legacyJwtRole(value: string): string | null {
  const segments = value.split(".");
  if (segments.length !== 3 || segments.some((segment) => !jwtSegmentPattern.test(segment))) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(segments[1], "base64url").toString("utf8"),
    ) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function resolvePublicCredential(
  environment: Readonly<Record<string, string | undefined>>,
): SupabaseApiCredential {
  const publishableKey = optionalCredentialValue(environment, SUPABASE_PUBLISHABLE_KEY_ENV);
  const legacyAnonKey = optionalCredentialValue(environment, LEGACY_SUPABASE_ANON_KEY_ENV);
  if (publishableKey && legacyAnonKey) {
    throw new SupabaseEnvironmentError("Supabase public credential configuration is ambiguous.");
  }
  if (publishableKey) {
    if (!publishableKeyPattern.test(publishableKey)) {
      throw new SupabaseEnvironmentError(`${SUPABASE_PUBLISHABLE_KEY_ENV} is malformed.`);
    }
    return { key: publishableKey, mode: "publishable", sendAsBearer: false };
  }
  if (legacyAnonKey) {
    if (legacyJwtRole(legacyAnonKey) !== "anon") {
      throw new SupabaseEnvironmentError(`${LEGACY_SUPABASE_ANON_KEY_ENV} is malformed.`);
    }
    return { key: legacyAnonKey, mode: "legacy_anon", sendAsBearer: true };
  }
  throw new SupabaseEnvironmentError("Supabase public credential is required.");
}

export function getSupabasePrivilegedCredential(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SupabaseApiCredential {
  const secretKey = optionalCredentialValue(environment, SUPABASE_SECRET_KEY_ENV);
  const legacyServiceRoleKey = optionalCredentialValue(
    environment,
    LEGACY_SUPABASE_SERVICE_ROLE_KEY_ENV,
  );
  if (secretKey && legacyServiceRoleKey) {
    throw new SupabaseEnvironmentError("Supabase privileged credential configuration is ambiguous.");
  }
  if (secretKey) {
    if (!secretKeyPattern.test(secretKey)) {
      throw new SupabaseEnvironmentError(`${SUPABASE_SECRET_KEY_ENV} is malformed.`);
    }
    return { key: secretKey, mode: "secret", sendAsBearer: false };
  }
  if (legacyServiceRoleKey) {
    if (legacyJwtRole(legacyServiceRoleKey) !== "service_role") {
      throw new SupabaseEnvironmentError(
        `${LEGACY_SUPABASE_SERVICE_ROLE_KEY_ENV} is malformed.`,
      );
    }
    return {
      key: legacyServiceRoleKey,
      mode: "legacy_service_role",
      sendAsBearer: true,
    };
  }
  throw new SupabaseEnvironmentError("Supabase privileged credential is required.");
}

export function hasSupabasePrivilegedCredentialConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  try {
    getSupabasePrivilegedCredential(environment);
    return true;
  } catch {
    return false;
  }
}

function validateUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SupabaseEnvironmentError("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new SupabaseEnvironmentError(
      "NEXT_PUBLIC_SUPABASE_URL must use HTTPS, except for localhost development.",
    );
  }
  return url.toString().replace(/\/$/u, "");
}

/**
 * Restricts service-role storefront traffic to a canonical Supabase project
 * origin. Loopback is available only through an explicit local-test opt-in.
 */
export function validateSupabaseProjectOrigin(
  value: string,
  options: ValidateSupabaseProjectOriginOptions = {},
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SupabaseEnvironmentError(
      "NEXT_PUBLIC_SUPABASE_URL must be an approved Supabase project origin.",
    );
  }

  const hasUnexpectedParts = value !== value.trim()
    || value.includes("%")
    || url.username !== ""
    || url.password !== ""
    || url.pathname !== "/"
    || url.search !== ""
    || url.hash !== "";
  const approvedCloudOrigin = url.protocol === "https:"
    && url.port === ""
    && supabaseProjectHostname.test(url.hostname);
  const approvedLocalOrigin = options.allowLocalDevelopment === true
    && url.protocol === "http:"
    && localSupabaseHostnames.has(url.hostname);

  if (hasUnexpectedParts || (!approvedCloudOrigin && !approvedLocalOrigin)) {
    throw new SupabaseEnvironmentError(
      "NEXT_PUBLIC_SUPABASE_URL must be an approved Supabase project origin.",
    );
  }

  return url.origin;
}

/**
 * Binds a service credential target to one explicitly configured Supabase
 * project. The loopback exception exists only for isolated local QA and uses a
 * fixed non-cloud project identity.
 */
export function validateSupabaseProjectBinding(
  value: string,
  projectRefValue: string,
  options: ValidateSupabaseProjectBindingOptions,
): string {
  const projectRef = projectRefValue.trim();
  if (projectRefValue !== projectRef || !supabaseProjectRef.test(projectRef)) {
    throw new SupabaseEnvironmentError(
      `${PROJECT_BOUND_SUPABASE_REF_ENV} must be a canonical 20-character project ref.`,
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SupabaseEnvironmentError(
      `${PROJECT_BOUND_SUPABASE_URL_ENV} must match the approved Supabase project.`,
    );
  }

  const hasUnexpectedParts = value !== value.trim()
    || value.includes("%")
    || url.username !== ""
    || url.password !== ""
    || url.pathname !== "/"
    || url.search !== ""
    || url.hash !== "";
  const approvedProjectRef = approvedProjectRefByEnvironment[options.deploymentEnvironment];
  const approvedCloudOrigin = projectRef === approvedProjectRef
    && url.protocol === "https:"
    && url.port === ""
    && url.hostname === `${projectRef}.supabase.co`;
  const approvedLocalOrigin = options.deploymentEnvironment === "local"
    && options.allowLocalQa === true
    && projectRef === LOCAL_SUPABASE_PROJECT_REF
    && url.protocol === "http:"
    && localSupabaseHostnames.has(url.hostname);

  if (hasUnexpectedParts || (!approvedCloudOrigin && !approvedLocalOrigin)) {
    throw new SupabaseEnvironmentError(
      `${PROJECT_BOUND_SUPABASE_URL_ENV} must match the approved Supabase project.`,
    );
  }

  return url.origin;
}

export function getSupabasePublicEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SupabasePublicEnvironment {
  return {
    url: validateUrl(requireValue(environment, "NEXT_PUBLIC_SUPABASE_URL")),
    publicCredential: resolvePublicCredential(environment),
  };
}

export function getSupabaseServiceEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SupabaseServiceEnvironment {
  return {
    url: validateUrl(requireValue(environment, "NEXT_PUBLIC_SUPABASE_URL")),
    privilegedCredential: getSupabasePrivilegedCredential(environment),
  };
}

export function getProjectBoundSupabaseServiceEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  options: { allowLocalDevelopment?: boolean } = {},
): SupabaseProjectBoundServiceEnvironment {
  const deploymentEnvironment = resolveSupabaseDeploymentEnvironment(environment);
  const projectRef = requireValue(environment, PROJECT_BOUND_SUPABASE_REF_ENV);
  return {
    url: validateSupabaseProjectBinding(
      requireValue(environment, PROJECT_BOUND_SUPABASE_URL_ENV),
      projectRef,
      {
        deploymentEnvironment,
        allowLocalQa: options.allowLocalDevelopment === true
          && deploymentEnvironment === "local"
          && environment.NODE_ENV === "test"
          && environment.VERCEL_ENV === undefined
          && environment.VERCEL !== "1",
      },
    ),
    projectRef,
    privilegedCredential: getSupabasePrivilegedCredential(environment),
  };
}
