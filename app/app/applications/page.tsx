import Nav from "@/components/nav";
import { getApplications } from "@/lib/services/applicationService";
import ApplicationList from "@/components/application-list";
import { getActiveSubscription } from "@/lib/services/subscriptionService";
import { Application } from "@/types/api";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, CircleHelp } from "lucide-react";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";
import { IS_CLOUD } from "@/config/constants";

export const metadata: Metadata = {
  title: "Applications | Corsfix Dashboard",
};

export default async function ApplicationsPage() {
  const session = await auth();

  let idToken, initialApplications: Application[], activeSubscription;

  try {
    idToken = getUserId(session);
    initialApplications = await getApplications(idToken);
    activeSubscription = await getActiveSubscription(idToken);
  } catch (error: unknown) {
    console.error(JSON.stringify(error, null, 2));
    idToken = null;
    initialApplications = [];
    activeSubscription = { active: false };
  }

  return (
    <>
      <Nav />
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-2">Applications</h1>{" "}
        <Link
          href="https://corsfix.com/docs/dashboard/application"
          target="_blank"
          className="inline-flex items-center gap-1 text-xs mb-8 border px-2 py-1 rounded-full text-violet-400 border-violet-400 bg-muted font-medium hover:bg-background transition-colors"
        >
          <BookOpenText size={14} />
          Applications documentation
        </Link>
        <ApplicationList
          initialApplications={initialApplications}
          hasActiveSubscription={activeSubscription.active}
          isCloud={IS_CLOUD}
        />
        <div className="mt-8 flex items-center p-3 border rounded-md mx-auto w-fit text-sm">
          <CircleHelp size={16} className="text-violet-400 mr-2" />
          <span>
            Need help? Let us know at{" "}
            <a
              href="mailto:rey@corsfix.com"
              className="text-violet-400 bg-muted px-1 py-0.5 rounded-md font-medium"
            >
              rey@corsfix.com
            </a>
          </span>
        </div>
      </div>
    </>
  );
}
