import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function decodeVerifyPath(encoded: string): string | null {
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    return decoded.startsWith("/api/auth/callback/") ? decoded : null;
  } catch {
    return null;
  }
}

function extractEmailFromPath(path: string): string | null {
  try {
    const url = new URL(path, "http://localhost");
    return url.searchParams.get("email");
  } catch {
    return null;
  }
}

export function EmailVerifyForm({ encodedPath }: { encodedPath: string }) {
  const callbackPath = decodeVerifyPath(encodedPath);
  const email = callbackPath ? extractEmailFromPath(callbackPath) : null;

  if (!callbackPath || !email) {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[370px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Invalid link</h1>
          <p className="text-sm text-muted-foreground">
            This link may be expired or invalid.
          </p>
        </div>
        <Button asChild>
          <a href="/auth">Back to sign in</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[370px]">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Continue to Corsfix</h1>
        <p className="text-sm text-muted-foreground">
          Click continue to access your account
        </p>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Input id="verify-email" type="email" defaultValue={email} disabled />
        </div>
        <form action={callbackPath} method="POST">
          <Button type="submit" data-umami-event="auth-verify-continue" className="w-full">
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
