import { useEffect, useState } from 'react';

import { lockRemainingMs } from '@/utils/pin-security';

/** Seconds of PIN lockout left (0 when unlocked); re-renders every ~250 ms while locked. */
export function usePinCountdown(lockedUntil: number): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (lockedUntil <= 0) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [lockedUntil]);

  return Math.ceil(lockRemainingMs(lockedUntil, now) / 1000);
}
