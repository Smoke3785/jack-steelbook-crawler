"use client";

import type { ReactNode } from "react";
import { useApplyLastRowClass } from "@/shared/hooks/useApplyLastRowClass";

/**
 * Client boundary for a wrapping grid/flex results container. The hook must
 * attach to the container — not the items — so it can cluster children into
 * rows. Children pass through untouched and stay server-rendered.
 */
export function LastRowWrap({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useApplyLastRowClass<HTMLDivElement>("last-row-selector");

  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}
