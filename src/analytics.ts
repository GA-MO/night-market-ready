// Analytics funnel — logs to the console for now; swap the sink before launch.
// These event names define the funnel we'll measure (install → unlock → retain → monetize).

export type AnalyticsEvent =
  | "session_start"
  | "unlock"
  | "upgrade"
  | "ad_watched"
  | "prestige"
  | "daily_claim"
  | "star_earned";

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  // eslint-disable-next-line no-console
  console.info(`[analytics] ${event}`, props);
}
