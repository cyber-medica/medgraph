import "server-only";

import {
  isLocalAuthShadowEnabled,
  loadLocalAuthShadowEnvironment,
} from "./environment.ts";

export function isLocalAuthShadowEnabledOnServer() {
  return isLocalAuthShadowEnabled(process.env);
}

export function loadLocalAuthShadowEnvironmentFromServer() {
  return loadLocalAuthShadowEnvironment(process.env);
}
