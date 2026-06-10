// Rewarded-ad abstraction. The real SDK (AppLovin/AdMob/etc.) slots in behind this
// interface once the game is wrapped — the rest of the game only knows `AdProvider`.

export type AdPlacement = "double_earnings" | "instant_grill" | "double_offline";

export interface AdProvider {
  /** Whether a rewarded ad can be shown right now for this placement. */
  isReady(placement: AdPlacement): boolean;
  /**
   * Show a rewarded ad. `onSecond` reports the countdown (3 → 1) for UI.
   * Resolves true if the reward should be granted (ad watched to completion).
   */
  show(placement: AdPlacement, onSecond?: (remaining: number) => void): Promise<boolean>;
}

/** Stand-in provider: a 3-second fake countdown that always rewards. */
export class MockAdProvider implements AdProvider {
  isReady(_placement: AdPlacement): boolean {
    return true;
  }

  show(_placement: AdPlacement, onSecond?: (remaining: number) => void): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let remaining = 3;
      onSecond?.(remaining);
      const tick = (): void => {
        remaining -= 1;
        if (remaining <= 0) {
          resolve(true);
          return;
        }
        onSecond?.(remaining);
        setTimeout(tick, 1000);
      };
      setTimeout(tick, 1000);
    });
  }
}
