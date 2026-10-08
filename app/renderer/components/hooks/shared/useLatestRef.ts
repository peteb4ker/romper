import { useLayoutEffect, useRef } from "react";

/**
 * A ref holding the latest `value`, for callbacks and async work that need
 * the newest props or state without being recreated. It's updated once a
 * render commits, before the browser paints or any event handler runs, so
 * a render React throws away can't leave it holding a value that never
 * reached the screen.
 *
 * Callbacks may also write to it, to keep rapid changes in step before the
 * next render; the next commit sets it back to `value`.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
