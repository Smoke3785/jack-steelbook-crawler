import { useCallback, useRef } from "react";

/**
 * Applies `className` to every child of the ref'd element that sits on the
 * last wrapped flex line. No state, no re-renders — pure DOM mutation.
 *
 *   const ref = useApplyLastRowClass("last-wrap-row");
 *   <ul ref={ref} className="cards">…</ul>
 *
 * Assumes a horizontal `flex-wrap: wrap` container whose DOM order matches
 * visual order (no `order`, no `wrap-reverse`).
 */
export function useApplyLastRowClass<T extends HTMLElement = HTMLElement>(
  className: string,
) {
  const cleanupRef = useRef<(() => void) | null>(null);

  // Callback ref: runs on attach/detach, so it survives conditional
  // rendering without a useEffect and never touches React state.
  return useCallback(
    (node: T | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!node) return;

      let frame = 0;

      const apply = () => {
        const children = Array.from(node.children);

        // Cluster children into flex lines: a child starts a new line when
        // its top edge clears the bottom of the line being built. Robust to
        // mixed item heights and any align-items value, unlike comparing
        // offsetTop for strict equality.
        let lastRowStart = 0;
        let rowBottom = -Infinity;

        children.forEach((child, i) => {
          const { top, bottom } = child.getBoundingClientRect();
          if (top >= rowBottom - 1) {
            lastRowStart = i; // starts a new line
            rowBottom = bottom;
          } else if (bottom > rowBottom) {
            rowBottom = bottom; // extends the current line's band
          }
        });

        children.forEach((child, i) => {
          child.classList.toggle(className, i >= lastRowStart);
          // Only-when-actually-wrapped variant (single line gets nothing):
          // child.classList.toggle(className, lastRowStart > 0 && i >= lastRowStart);
        });
      };

      // Coalesce observer bursts into one measurement per frame.
      const schedule = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(apply);
      };

      // Re-measure when the container or any child changes size…
      const ro = new ResizeObserver(schedule);
      const observeAll = () => {
        ro.disconnect();
        ro.observe(node);
        for (const child of node.children) ro.observe(child);
      };

      // …and when children are added/removed (list re-renders).
      const mo = new MutationObserver(() => {
        observeAll();
        schedule();
      });
      mo.observe(node, { childList: true });

      observeAll();
      apply(); // sync first pass so classes land before first paint

      cleanupRef.current = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        mo.disconnect();
        for (const child of node.children) child.classList.remove(className);
      };
    },
    [className],
  );
}
