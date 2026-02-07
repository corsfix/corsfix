"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

const GOOGLE_FORM_ID =
  "1FAIpQLScIIaabxM8buZH6NlKY7pADUNtLZjwGjiMEKteVFwu2EsV5Cw";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return;

    const email = session?.user?.email || "anonymous";
    const url = `https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/formResponse`;

    const formData = new URLSearchParams();
    formData.append("entry.794576676", email);
    formData.append("entry.1515150468", feedback);
    formData.append("entry.589579847", pathname);

    setIsSubmitting(true);

    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      toast.success("Thank you for your feedback!");
      onOpenChange(false);
      setFeedback("");
    } catch {
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setFeedback("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give Feedback</DialogTitle>
          <DialogDescription>
            Share your feedback about Corsfix. If you need immediate support, we
            are available via chat or{" "}
            <a
              href="mailto:rey@corsfix.com"
              className="underline text-foreground"
            >
              email
            </a>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Tell us what you think..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
          />
          <Button
            onClick={handleSubmitFeedback}
            disabled={isSubmitting || !feedback.trim()}
            className="w-full"
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
