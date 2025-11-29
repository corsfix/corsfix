import Link from "next/link";
import { Logo } from "@/components/Logo";
import { IS_CLOUD } from "@/config/constants";
import { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authentication | Corsfix Dashboard",
};

export default function AuthenticationPage() {
  return (
    <>
      <div className="px-6 relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col p-16 text-white lg:flex">
          <div className="inset-0 absolute w-full h-full p-5">
            <img src="/mesh3.svg" className="h-full w-full object-cover rounded-2xl" />
          </div>
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
          <AuthForm isCloud={IS_CLOUD} />
        </div>
      </div>
    </>
  );
}
