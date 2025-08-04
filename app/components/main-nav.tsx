"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile view
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);

    return () => {
      window.removeEventListener("resize", checkIfMobile);
    };
  }, []);

  const getLinkClassName = (href: string) =>
    cn(
      "text-sm transition-colors hover:text-primary",
      pathname === href ? "text-foreground" : "text-muted-foreground"
    );

  const handleNavChange = (value: string) => {
    if (value.startsWith("http")) {
      window.open(value, "_blank");
    } else {
      router.push(value);
    }
  };

  const navItems = [
    { href: "/get-started", label: "Get Started" },
    { href: "/applications", label: "Applications" },
    { href: "/secrets", label: "Secrets" },
    { href: "/metrics", label: "Metrics" },
    { href: "/playground", label: "Playground" },
    { href: "/billing", label: "Billing" },
    { href: "https://corsfix.com/docs", label: "Docs", external: true },
  ];

  // Mobile view with dropdown
  if (isMobile) {
    return (
      <nav className={cn("flex items-center", className)}>
        <Select onValueChange={handleNavChange} defaultValue={pathname}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Navigation" />
          </SelectTrigger>
          <SelectContent>
            {navItems.map((item) => (
              <SelectItem key={item.href} value={item.href}>
                {item.label}
                {item.external && (
                  <ExternalLink size={14} className="ml-2 inline" />
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </nav>
    );
  }

  // Desktop view with horizontal links
  return (
    <nav className={cn("flex items-center space-x-4 lg:space-x-6", className)}>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          target={item.external ? "_blank" : undefined}
          className={getLinkClassName(item.href)}
        >
          {item.label}
          {item.external && <ExternalLink size={16} className="ml-1 inline" />}
        </Link>
      ))}
    </nav>
  );
}
