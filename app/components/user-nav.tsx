"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, User } from "lucide-react";
import { FeedbackDialog } from "@/components/feedback-dialog";
import * as React from "react";

export function UserNav() {
  const { data: session } = useSession();
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const logOut = async () => {
    if (!session?.user) return;
    await signOut();
    toast("You have been logged out");
  };

  const cycleTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!mounted) return;

    if (theme === "system") {
      setTheme("light");
    } else if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("system");
    }
  };

  const getThemeIcon = () => {
    if (!mounted) return <Monitor className="h-4 w-4" />;

    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeLabel = () => {
    if (!mounted) return "Auto";

    switch (theme) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      default:
        return "Auto";
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-umami-event="user-nav"
            variant="ghost"
            className="relative h-8 w-8 rounded-full border"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {session?.user ? (
                  session.user.name?.[0] || session.user.email?.[0]
                ) : (
                  <User className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          {session?.user && (
            <>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session.user.name || session.user.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            data-umami-event="theme-toggle"
            onClick={cycleTheme}
          >
            Theme:&nbsp;
            {getThemeLabel()}
            {getThemeIcon()}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-umami-event="give-feedback"
            onClick={() => setFeedbackOpen(true)}
          >
            Give Feedback
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {session?.user ? (
            <DropdownMenuItem data-umami-event="user-logout" onClick={logOut}>
              Log out
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              data-umami-event="user-login"
              onClick={() => router.push("/auth")}
            >
              Log in
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
