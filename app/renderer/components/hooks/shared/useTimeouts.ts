import { useCallback, useEffect, useMemo, useRef } from "react";

type Timer = ReturnType<typeof setTimeout>;

/**
 * `setTimeout` and `clearTimeout` for a component, with every pending
 * timeout cleared when the component unmounts, so a callback can't set
 * state or call a parent after it's gone (#709). While mounted, `set` works
 * as `setTimeout` does: scheduling another timeout doesn't cancel earlier
 * ones. After unmount (say, at the end of async work that outlived the
 * component), `set` schedules nothing and returns null.
 */
export function useTimeouts() {
  const pending = useRef(new Set<Timer>());
  const mounted = useRef(false);

  useEffect(() => {
    const timers = pending.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const set = useCallback(
    (callback: () => void, delay: number): null | Timer => {
      if (!mounted.current) return null;
      const timer = setTimeout(() => {
        pending.current.delete(timer);
        callback();
      }, delay);
      pending.current.add(timer);
      return timer;
    },
    [],
  );

  const clear = useCallback((timer: null | Timer) => {
    if (timer === null) return;
    clearTimeout(timer);
    pending.current.delete(timer);
  }, []);

  return useMemo(() => ({ clear, set }), [clear, set]);
}
