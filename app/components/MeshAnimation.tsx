"use client";

import { computeComplementaryColor } from "@/lib/utils";
import { useEffect, useMemo } from "react";
import { Gradient } from "@/components/Gradient";

export function MeshAnimation() {
  const gradient = useMemo(
    () => (typeof window !== "undefined" ? new Gradient() : undefined),
    []
  );

  useEffect(() => {
    if (!gradient) {
      return;
    }

    const root = document.documentElement;

    const [a, b, c, d] = computeComplementaryColor("#595ce7");

    root.style.setProperty("--gradient-color-1", `#${a.toHex()}`);
    root.style.setProperty("--gradient-color-2", `#${b.toHex()}`);
    root.style.setProperty("--gradient-color-3", `#${c.toHex()}`);
    root.style.setProperty("--gradient-color-4", `#${d.toHex()}`);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    /* @ts-expect-error */
    gradient.initGradient("#gradient-canvas");
  }, [gradient]);

  return (
    <canvas id="gradient-canvas" className="absolute inset-0 h-full w-full" />
  );
}
