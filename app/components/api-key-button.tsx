"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiKeyModal } from "@/components/api-key-modal";

interface ApiKeyButtonProps {
  variant?: "default" | "secondary" | "outline" | "ghost";
}

export const ApiKeyButton = ({ variant = "secondary" }: ApiKeyButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setIsOpen(true)}
        data-umami-event="api-key-button"
      >
        API Key
      </Button>
      <ApiKeyModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
