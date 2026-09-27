"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Allow only works once the consent page has been visible and focused for a
// moment and the user has moved the pointer or pressed a key since. A site
// that opens this page under the user's cursor (double-click hijacking)
// can't turn a click meant for something else into an approval.
const ARM_DELAY_MS = 700;

export function ConsentButtons() {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let waited = false;
    let interacted = false;

    const update = () => setArmed(waited && interacted);
    const restart = () => {
      clearTimeout(timer);
      waited = false;
      interacted = false;
      update();
      if (document.visibilityState === "visible" && document.hasFocus()) {
        timer = setTimeout(() => {
          waited = true;
          update();
        }, ARM_DELAY_MS);
      }
    };
    const onInteract = () => {
      interacted = true;
      update();
    };

    restart();
    window.addEventListener("focus", restart);
    window.addEventListener("blur", restart);
    window.addEventListener("pageshow", restart);
    document.addEventListener("visibilitychange", restart);
    window.addEventListener("pointermove", onInteract);
    window.addEventListener("keydown", onInteract);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", restart);
      window.removeEventListener("blur", restart);
      window.removeEventListener("pageshow", restart);
      document.removeEventListener("visibilitychange", restart);
      window.removeEventListener("pointermove", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  return (
    <>
      <Button
        type="submit"
        name="decision"
        value="deny"
        variant="outline"
        className="flex-1"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        name="decision"
        value="approve"
        className="flex-1"
        disabled={!armed}
        data-umami-event="mcp-oauth-approve"
      >
        Allow
      </Button>
    </>
  );
}
