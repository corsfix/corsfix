import Nav from "@/components/nav";
import SecretList from "@/components/secret-list";
import { Application } from "@/types/api";
import { Metadata } from "next";
import Link from "next/link";
import { CircleHelp, ExternalLink, KeyRound } from "lucide-react";
import { getApplicationSecrets } from "@/lib/services/secretService";
import { auth } from "@/auth";
import { getUserId } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Secrets | Corsfix Dashboard",
};

export default async function SecretsPage() {
  const session = await auth();

  let idToken, initialApplications: Application[];

  try {
    idToken = getUserId(session);
    initialApplications = await getApplicationSecrets(idToken);
  } catch (error: unknown) {
    console.error(JSON.stringify(error, null, 2));
    idToken = null;
    initialApplications = [];
  }

  return (
    <>
      <Nav />
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 inline-flex items-center">
          <KeyRound size={28} className="mr-2" />
          Secrets
        </h1>
        <p className="text-muted-foreground mb-1">
          Add API keys, access tokens, and other secrets to use with your web
          application.
        </p>
        <Link
          href="https://corsfix.com/docs/dashboard/secrets"
          target="_blank"
          className="inline-block text-violet-500 hover:text-secondary-foreground transition-colors underline mb-6"
        >
          Secrets documentation{" "}
          <ExternalLink size={24} className="inline pb-1" />
        </Link>
        <SecretList initialApplications={initialApplications} />
        <div className="mt-8 flex items-center p-3 border rounded-md mx-auto w-fit text-sm">
          <CircleHelp size={16} className="text-violet-400 mr-2" />
          <span>
            Need help? Let us know at{" "}
            <a
              href="mailto:rey@corsfix.com"
              className="text-violet-500 underline p-0.5 font-medium"
            >
              rey@corsfix.com
            </a>
          </span>
        </div>
      </div>
    </>
  );
}
