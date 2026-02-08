import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DISABLE_SIGNUP } from "@/config/constants";
import { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { EmailVerifyForm } from "@/components/email-verify-form";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";

export const metadata: Metadata = {
  title: "Authentication | Corsfix Dashboard",
};

export default async function AuthenticationPage({
  searchParams,
}: {
  searchParams: Promise<{ emailVerify?: string }>;
}) {
  const { emailVerify } = await searchParams;
  return (
    <>
      <div className="px-4 relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <Link
          href="https://corsfix.com"
          className="absolute top-6 left-6 flex items-center lg:hidden"
        >
          <Logo className="mr-2 size-8" />
          <span className="text-lg font-medium">Corsfix</span>
        </Link>
        <div className="relative hidden h-full flex-col p-16 text-white lg:flex">
          <div className="inset-0 absolute w-full h-full p-5">
            <img
              src="/mesh3.svg"
              className="h-full w-full object-cover rounded-2xl"
            />
          </div>
          <div className="absolute inset-5 bg-gradient-to-t from-black/10 via-transparent to-transparent rounded-2xl" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            <Link href="https://corsfix.com" className="flex items-center">
              <Logo className="mr-2 size-8" />
              Corsfix
            </Link>
          </div>
          <div className="relative z-20 mt-auto">
            <TestimonialCarousel />
          </div>
        </div>
        <div className="lg:p-8">
          {emailVerify ? (
            <EmailVerifyForm encodedPath={emailVerify} />
          ) : (
            <AuthForm disableSignup={DISABLE_SIGNUP} />
          )}
        </div>
      </div>
    </>
  );
}
