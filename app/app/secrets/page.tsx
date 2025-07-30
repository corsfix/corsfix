import Nav from "@/components/nav";
import SecretList from "@/components/secret-list";
import { Application } from "@/types/api";
import { getActiveSubscription } from "@/lib/services/subscriptionService";
import { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, CircleHelp } from "lucide-react";
import { getApplicationSecrets } from "@/lib/services/secretService";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";
import { IS_CLOUD } from "@/config/constants";

export const metadata: Metadata = {
  title: "Secrets | Corsfix Dashboard",
};

export default async function SecretsPage() {
  const session = await auth();

  let idToken, initialApplications: Application[], activeSubscription;

  try {
    idToken = getUserId(session);
    initialApplications = await getApplicationSecrets(idToken);
    activeSubscription = await getActiveSubscription(idToken);
  } catch (error: unknown) {
    console.error(JSON.stringify(error, null, 2));
    idToken = null;
    initialApplications = [];
    activeSubscription = {
      name: "Free",
      customer_id: "",
      active: false,
    };
  }

  return (
    <>
      <Nav />
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-2">Secrets</h1>
        <Link
          href="https://corsfix.com/docs/dashboard/secrets"
          target="_blank"
          className="inline-flex items-center gap-1 text-xs mb-8 border px-2 py-1 rounded-full text-violet-400 border-violet-400 hover:bg-violet-950 transition-colors"
        >
          <BookOpenText size={14} />
          Secrets documentation
        </Link>
        <SecretList
          initialApplications={initialApplications}
          hasActiveSubscription={activeSubscription.active}
          isCloud={IS_CLOUD}
        />
        <div className="mt-8 flex items-center p-3 bg-gray-800 border border-gray-700 rounded-md mx-auto w-fit text-sm text-gray-400">
          <CircleHelp size={16} className="text-violet-400 mr-2" />
          <span>
            Need help? Let us know at{" "}
            <a
              href="mailto:rey@corsfix.com"
              className="text-violet-400 bg-violet-950 px-1 py-0.5 rounded-md"
            >
              rey@corsfix.com
            </a>
          </span>
        </div>
      </div>
    </>
  );
}
