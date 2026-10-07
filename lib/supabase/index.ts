import "server-only";

export {
  LOCAL_SUPABASE_ORIGIN_OPT_IN,
  LOCAL_SUPABASE_PROJECT_REF,
  LEGACY_SUPABASE_ANON_KEY_ENV,
  LEGACY_SUPABASE_SERVICE_ROLE_KEY_ENV,
  PRODUCTION_SUPABASE_PROJECT_REF,
  PROJECT_BOUND_SUPABASE_REF_ENV,
  PROJECT_BOUND_SUPABASE_URL_ENV,
  STAGING_SUPABASE_PROJECT_REF,
  SUPABASE_PUBLISHABLE_KEY_ENV,
  SUPABASE_SECRET_KEY_ENV,
  SupabaseEnvironmentError,
  getSupabasePrivilegedCredential,
  getProjectBoundSupabaseServiceEnvironment,
  hasSupabasePrivilegedCredentialConfiguration,
  validateSupabaseProjectBinding,
  validateSupabaseProjectOrigin,
  type SupabaseApiCredential,
  type SupabaseCredentialMode,
  type SupabaseProjectBoundServiceEnvironment,
  type SupabaseDeploymentEnvironment,
  type ValidateSupabaseProjectBindingOptions,
  type ValidateSupabaseProjectOriginOptions,
} from "./env.ts";
export {
  createProjectBoundSupabaseServerClient,
  createSupabaseServerClient,
  type CreateProjectBoundSupabaseServerClientOptions,
  SupabaseConnectionError,
  type CreateSupabaseServerClientOptions,
  type SupabaseServerAccess,
  type SupabaseServerClient,
} from "./client.server.ts";
export {
  checkSupabaseConnection,
  type SupabaseHealthResult,
} from "./health.ts";
