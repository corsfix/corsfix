"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Check } from "lucide-react";
import { useState } from "react";

interface FounderBenefitModalProps {
  extraBandwidth?: string;
  regionSelection?: boolean;
  noMinCacheTtl?: boolean;
  noConcurrencyLimit?: boolean;
}

export const FounderBenefitModal = ({
  extraBandwidth,
  regionSelection,
  noMinCacheTtl,
  noConcurrencyLimit,
}: FounderBenefitModalProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const benefits: string[] = [];
  if (extraBandwidth) benefits.push(`+${extraBandwidth} extra data transfer`);
  if (regionSelection) benefits.push("Select any proxy regions");
  if (noMinCacheTtl) benefits.push("No minimum cache TTL");
  if (noConcurrencyLimit) benefits.push("No concurrency limit");

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        onClick={() => setIsOpen(true)}
      >
        <Gift className="h-4 w-4 text-primary" />
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Founder&apos;s Benefit
            </DialogTitle>
            <DialogDescription>
              Thank you for being an early supporter! You have the following
              benefits on top of your current plan.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm">{benefit}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
};
