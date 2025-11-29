"use client";

import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  isLogin: boolean;
  isModal?: boolean;
  isCloud: boolean;
}

export function UserAuthForm({
  className,
  isLogin,
  isModal,
  isCloud,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonSuccessRef = useRef<HTMLButtonElement>(null);

  function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    const email = inputRef.current?.value?.trim() || "";

    if (!email) {
      toast.error("Please enter your email");
      inputRef.current?.focus();
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      toast.error("Please enter a valid email address");
      inputRef.current?.focus();
      return;
    }

    handleSignIn("email", { email });
  }

  async function handleSignIn(
    provider: string,
    options?: Record<string, unknown>
  ) {
    setIsLoading(true);
    try {
      await signIn(provider, options);
    } catch (error) {
      console.error("Error signing in:", error);
      toast.error("Unable to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      {isCloud ? (
        <>
          <form onSubmit={onSubmit}>
            <div className="grid gap-2">
              <div className="grid gap-1">
                <Label className="sr-only" htmlFor="email">
                  Email
                </Label>
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  ref={inputRef}
                />
              </div>
              <Button data-umami-event="auth-email" disabled={isLoading}>
                {isLoading && (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isLogin ? "Sign In with Email" : "Sign Up with Email"}
              </Button>
            </div>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>
          <Button
            data-umami-event="auth-google"
            variant="secondary"
            type="button"
            disabled={isLoading}
            onClick={() => handleSignIn("google")}
          >
            {isLoading ? (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icons.google className="mr-2 h-4 w-4" />
            )}{" "}
            Google
          </Button>
          <Button
            data-umami-event="auth-github"
            variant="secondary"
            type="button"
            disabled={isLoading}
            onClick={() => handleSignIn("github")}
          >
            {isLoading ? (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icons.gitHub className="mr-2 h-4 w-4" />
            )}{" "}
            GitHub
          </Button>
          <button
            ref={buttonSuccessRef}
            className="hidden"
            data-umami-event={isModal ? "auth-success-modal" : "auth-success"}
          />
        </>
      ) : (
        <>
          <div className="text-center">
            <Link href={"/api/auth/signin"}>
              <Button type="button">Open authentication page &rarr;</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
