"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthModal } from "./auth-modal";
import { useSession } from "next-auth/react";
import { LoadingSpinner } from "./loading-spinner";

export function AuthGuard({
  children,
  isCloud,
}: {
  children: React.ReactNode;
  isCloud: boolean;
}) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/auth") {
      // trying to access a protected route, without being authenticated, show the modal
      router.refresh();
      setIsAuthModalOpen(true);
    } else if (status === "authenticated" && pathname === "/auth") {
      // trying to access the auth page while authenticated, redirect to home
      router.push("/");
    } else if (status === "authenticated") {
      // Close modal if user is authenticated
      setIsAuthModalOpen(false);
      router.refresh();
    }
  }, [status]);

  // Pages that don't require authentication
  if (pathname === "/auth" || pathname === "/order-success") {
    return children;
  }

  // If we're still loading auth state, show spinner
  if (status === "loading") {
    return <LoadingSpinner />;
  }

  // Return the children with the modal
  // The modal will only be shown if isAuthModalOpen is true
  return (
    <>
      {children}
      <AuthModal isOpen={isAuthModalOpen} isCloud={isCloud} />
    </>
  );
}
