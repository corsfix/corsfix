import Link from "next/link";
import { Logo } from "@/components/Logo";
import { IS_CLOUD } from "@/config/constants";
import { Metadata } from "next";
import { MeshAnimation } from "@/components/MeshAnimation";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authentication | Corsfix Dashboard",
};

export default function AuthenticationPage() {
  return (
    <>
      <div className="container px-8 relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <MeshAnimation />
          <div className="relative z-20 flex items-center text-lg font-medium">
            <Link href="https://corsfix.com" className="flex items-center">
              <Logo className="mr-2 size-8" />
              Corsfix
            </Link>
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;I was quite surprised at how easy it was to use Corsfix
                and how well it&apos;s documented.&rdquo;
              </p>
              <footer className="text-sm">
                Prem Daryanani - Web Developer
              </footer>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <AuthForm isCloud={IS_CLOUD} />
        </div>
      </div>
    </>
  );
}
