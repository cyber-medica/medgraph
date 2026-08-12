export const PRODUCTION_YANDEX_METRICA_COUNTER_ID = "98376495";

/**
 * The release contract authorizes exactly one Production counter. An absent,
 * malformed or stale environment value keeps Metrica disabled rather than
 * sending conversion events to an unintended account.
 */
export function readApprovedMetricaCounterId(
  value = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID,
) {
  return value?.trim() === PRODUCTION_YANDEX_METRICA_COUNTER_ID
    ? Number(PRODUCTION_YANDEX_METRICA_COUNTER_ID)
    : null;
}
