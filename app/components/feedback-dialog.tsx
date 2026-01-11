"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const TRUSTPILOT_URL = "https://www.trustpilot.com/review/corsfix.com";
const GOOGLE_FORM_ID =
  "1FAIpQLScIIaabxM8buZH6NlKY7pADUNtLZjwGjiMEKteVFwu2EsV5Cw";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { data: session } = useSession();
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setHoveredStar(0);
      setSelectedStar(0);
      setShowFeedbackForm(false);
      setFeedback("");
    }
  }, [open]);

  const handleStarClick = (star: number) => {
    setSelectedStar(star);

    if (star >= 4) {
      window.open(TRUSTPILOT_URL, "_blank");
      onOpenChange(false);
    } else {
      setShowFeedbackForm(true);
    }
  };

  const handleSubmitFeedback = async () => {
    const email = session?.user?.email || "anonymous";
    const url = `https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/formResponse`;

    const formData = new URLSearchParams();
    formData.append("entry.794576676", email);
    formData.append("entry.1515150468", feedback);

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
    } catch {
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueToReview = () => {
    window.open(TRUSTPILOT_URL, "_blank");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedStar(0);
      setHoveredStar(0);
      setShowFeedbackForm(false);
      setFeedback("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md h-[260px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] items-start">
        <DialogHeader>
          <DialogTitle className="text-center">
            How&apos;s your experience with Corsfix?
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="p-1 transition-transform hover:scale-110 focus:outline-none"
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => handleStarClick(star)}
            >
              <Star
                className={`h-8 w-8 ${
                  star <= (hoveredStar || selectedStar)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>

        {showFeedbackForm ? (
          <div className="space-y-4">
            <Textarea
              placeholder="Tell us how we can improve..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
            <div className="flex flex-col gap-6">
              <Button onClick={handleSubmitFeedback} disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </Button>
              <Button
                variant="ghost"
                onClick={handleContinueToReview}
                disabled={isSubmitting}
              >
                Continue to review
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
