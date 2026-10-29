const DEFAULT_INITIAL_DELAY_MS = 300;

/** Poll an authoritative server status endpoint with bounded backoff. */
export function startStatusPolling(checkStatus, delays, options = {}) {
  const schedule = options.schedule || ((callback, delay) => setTimeout(callback, delay));
  const cancel = options.cancel || ((timer) => clearTimeout(timer));
  const initialDelay = options.initialDelay ?? DEFAULT_INITIAL_DELAY_MS;
  const onStop = options.onStop || (() => {});
  const onExhausted = options.onExhausted || (() => {});
  let active = true;
  const timers = new Set();

  const stop = () => {
    if (!active) return;
    active = false;
    timers.forEach(cancel);
    timers.clear();
    onStop();
  };

  const scheduleCheck = (delay, remainingDelays) => {
    const timer = schedule(async () => {
      timers.delete(timer);
      if (!active) return;

      let verified = false;
      try {
        verified = await checkStatus();
      } catch {
        // A temporary network failure is treated as pending and uses the next bounded retry.
      }

      if (!active) return;
      if (verified || remainingDelays.length === 0) {
        if (!verified) onExhausted();
        stop();
        return;
      }
      scheduleCheck(remainingDelays[0], remainingDelays.slice(1));
    }, delay);
    timers.add(timer);
  };

  scheduleCheck(initialDelay, delays);
  return stop;
}
