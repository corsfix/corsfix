"use client";

import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { FeedbackDialog } from "@/components/feedback-dialog";

const GITHUB_ISSUES_URL = "https://github.com/corsfix/corsfix/issues";

export function FeedbackLink() {
  const { isCloud } = useApp();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (!isCloud) {
    return (
      <a
        href={GITHUB_ISSUES_URL}
        target="_blank"
        className="text-violet-500 underline p-0.5 font-medium"
      >
        Give feedback
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setFeedbackOpen(true)}
        className="text-violet-500 underline p-0.5 font-medium"
      >
        Give feedback
      </button>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
