import Link from "next/link";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shown in place of the secrets editor when the plan does not include
// secrets. A blurred, non-interactive mock of the editor sits behind an
// upgrade prompt so the user sees what they are missing.
const SAMPLE_SECRETS = [
  { name: "API_KEY", value: "sk_live_4f8c••••••••••••••••" },
  { name: "ACCESS_TOKEN", value: "ghp_x9Ka••••••••••••••••" },
  { name: "WEBHOOK_SECRET", value: "whsec_7d2e••••••••••••••" },
];

export default function SecretsLocked() {
  return (
    <div className="relative w-full">
      <div
        className="w-full border rounded-lg blur-[3px] opacity-70 pointer-events-none select-none"
        aria-hidden="true"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex flex-col items-start gap-2">
            <div className="font-semibold leading-none tracking-tight">
              My App&apos;s secrets
            </div>
            <div className="text-sm text-muted-foreground">
              ({SAMPLE_SECRETS.length} secrets)
            </div>
          </div>
          <ChevronDown className="h-5 w-5 rotate-180" />
        </div>
        <div className="p-6 pt-0">
          <div className="space-y-3">
            <div className="flex gap-2 items-start">
              <div className="w-1/2 md:w-1/4 text-sm font-medium text-muted-foreground">
                Name
              </div>
              <div className="w-1/2 md:w-3/4 text-sm font-medium text-muted-foreground">
                Value
              </div>
            </div>
            {SAMPLE_SECRETS.map((secret) => (
              <div key={secret.name} className="flex gap-2 items-start">
                <div className="w-1/2 md:w-1/4 h-9 rounded-md border bg-background px-3 py-2 text-sm font-mono font-bold">
                  {secret.name}
                </div>
                <div className="w-1/2 md:w-3/4 h-9 rounded-md border bg-background px-3 py-2 text-sm font-mono">
                  {secret.value}
                </div>
                <div className="h-9 w-9 flex items-center justify-center rounded-md bg-destructive text-destructive-foreground">
                  <Trash2 className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-6">
            <div className="inline-flex items-center h-9 rounded-md border px-4 text-sm font-medium">
              <Plus className="h-4 w-4 mr-2" /> Add new
            </div>
            <div className="inline-flex items-center h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Save
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 rounded-lg border bg-background/95 backdrop-blur p-8 shadow-lg">
          <h2 className="text-xl font-semibold">
            Upgrade to use Secrets
          </h2>
          <p className="text-sm text-muted-foreground">
            Add your API keys and use them in your requests
            without exposing them in the frontend.
          </p>
          <Link href="/billing" className="inline-block">
            <Button data-umami-event="secrets-locked-upgrade">
              Upgrade
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
