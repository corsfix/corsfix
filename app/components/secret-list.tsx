"use client";

import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import { Application, SecretItem } from "@/types/api";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

interface SecretListProps {
  initialApplications: Application[];
}

interface SecretFormData {
  id?: string;
  clientId?: string;
  name: string;
  value: string;
  masked_value?: string;
}

interface UnsavedChanges {
  [appId: string]: boolean;
}

export default function SecretList({ initialApplications }: SecretListProps) {
  const [applications, setApplications] =
    useState<Application[]>(initialApplications);

  const [appSecrets, setAppSecrets] = useState<{
    [appId: string]: SecretFormData[];
  }>({});

  // Store original secrets for comparison
  const [originalSecrets, setOriginalSecrets] = useState<{
    [appId: string]: SecretItem[];
  }>({});

  const [unsavedChanges, setUnsavedChanges] = useState<UnsavedChanges>({});
  const [saveLoading, setSaveLoading] = useState<{ [appId: string]: boolean }>(
    {},
  );
  useEffect(() => {
    setApplications(initialApplications);

    const initialSecrets: { [appId: string]: SecretFormData[] } = {};
    const originalSecretsData: { [appId: string]: SecretItem[] } = {};

    initialApplications.forEach((app) => {
      if (app.secrets) {
        // Store original secrets for comparison
        originalSecretsData[app.id] = [...app.secrets];

        // Initialize form data with empty values
        initialSecrets[app.id] = app.secrets.map((secret) => ({
          id: secret.id,
          name: secret.name,
          value: "",
          masked_value: secret.masked_value,
        }));
      } else {
        originalSecretsData[app.id] = [];
        initialSecrets[app.id] = [];
      }
    });

    setOriginalSecrets(originalSecretsData);
    setAppSecrets(initialSecrets);
  }, [initialApplications]);

  const addNewSecretRow = (appId: string) => {
    setAppSecrets((prev) => ({
      ...prev,
      [appId]: [
        ...(prev[appId] || []),
        { clientId: crypto.randomUUID(), name: "", value: "" },
      ],
    }));
    setUnsavedChanges((prev) => ({ ...prev, [appId]: true }));
  };

  const updateSecretRow = (
    appId: string,
    index: number,
    field: "name" | "value",
    value: string,
  ) => {
    setAppSecrets((prev) => {
      const updated = [...(prev[appId] || [])];
      if (field === "name") {
        const upperValue = value.toUpperCase();
        const validValue = upperValue.replace(/[^A-Z0-9_]/g, "");
        updated[index][field] = validValue;
      } else {
        updated[index][field] = value;
      }
      return { ...prev, [appId]: updated };
    });
    setUnsavedChanges((prev) => ({ ...prev, [appId]: true }));
  };

  const deleteSecretRow = (appId: string, index: number) => {
    setAppSecrets((prev) => {
      const updated = [...(prev[appId] || [])];
      updated.splice(index, 1);
      return { ...prev, [appId]: updated };
    });
    setUnsavedChanges((prev) => ({ ...prev, [appId]: true }));
  };

  const handleSaveSecrets = async (appId: string) => {
    setSaveLoading((prev) => ({ ...prev, [appId]: true }));

    const currentSecrets = appSecrets[appId] || [];
    const originalSecretsForApp = originalSecrets[appId] || [];

    // Validation
    const errors: string[] = [];
    const secretNames = new Set<string>();

    for (const secret of currentSecrets) {
      if (!secret.name.trim()) continue; // Skip empty names

      // Check for duplicate names
      if (secretNames.has(secret.name)) {
        errors.push(`Duplicate secret name: ${secret.name}`);
      }
      secretNames.add(secret.name);

      // Check if new secret without value
      if (!secret.id && !secret.value?.trim()) {
        errors.push(`New secret "${secret.name}" must have a value`);
      }
    }

    if (errors.length > 0) {
      toast("Please fix the following errors:", {
        description: (
          <ul className="list-disc pl-4">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        ),
      });
      setSaveLoading((prev) => ({ ...prev, [appId]: false }));
      return;
    }

    // Create maps for easier comparison using ID as key
    const originalSecretsMap = new Map(
      originalSecretsForApp.map((secret) => [secret.id!, secret]),
    );
    const currentSecretsMap = new Map(
      currentSecrets
        .filter((s) => s.id && s.name.trim())
        .map((secret) => [secret.id!, secret]),
    );

    const secretsData: Array<{
      id?: string;
      name: string;
      value: string | null;
      delete?: boolean;
    }> = [];

    // Check for deletions (exists in original but not in current)
    for (const [id, originalSecret] of originalSecretsMap) {
      if (!currentSecretsMap.has(id)) {
        secretsData.push({
          id: originalSecret.id,
          name: originalSecret.name,
          value: null,
          delete: true,
        });
      }
    }

    // Check for updates (existing secrets with ID)
    for (const [id, currentSecret] of currentSecretsMap) {
      const originalSecret = originalSecretsMap.get(id);

      if (originalSecret) {
        secretsData.push({
          id: currentSecret.id,
          name: currentSecret.name,
          value: currentSecret.value.trim(),
        });
      }
    }

    // Check for additions (new secrets without ID)
    for (const currentSecret of currentSecrets) {
      if (!currentSecret.id && currentSecret.name.trim()) {
        // New secret - only add if it has a value
        if (currentSecret.value?.trim()) {
          secretsData.push({
            name: currentSecret.name,
            value: currentSecret.value.trim(),
          });
        }
      }
    }

    try {
      const response = await apiClient.post<SecretItem[]>(`/secrets`, {
        application_id: appId,
        secrets: secretsData,
      });

      if (!response.success) {
        toast.error(response.message);
        return;
      }

      // Update the applications state with the new secrets
      setApplications((prev) =>
        prev.map((app) =>
          app.id === appId ? { ...app, secrets: response.data } : app,
        ),
      );

      // Update the original secrets for future comparisons
      setOriginalSecrets((prev) => ({
        ...prev,
        [appId]: [...response.data],
      }));

      // Update the form secrets state with the returned secrets
      setAppSecrets((prev) => ({
        ...prev,
        [appId]: response.data.map((secret) => ({
          id: secret.id,
          name: secret.name,
          value: "",
          masked_value: secret.masked_value,
        })),
      }));

      setUnsavedChanges((prev) => ({ ...prev, [appId]: false }));
      toast.success("Secrets updated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save secrets");
    } finally {
      setSaveLoading((prev) => ({ ...prev, [appId]: false }));
    }
  };

  if (applications.length === 0) {
    return (
      <div className="w-full space-y-6">
        <div className="text-center space-y-4 p-8 border rounded-lg">
          <div className="text-sm text-muted-foreground mb-4">
            Add your web application to start using secrets.
          </div>
          <Link href="/applications">
            <Button data-umami-event="secrets-applications">
              Add Application
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {applications.map((app) => {
        const secrets = appSecrets[app.id] || [];
        const hasUnsavedChanges = unsavedChanges[app.id];
        const secretCount = app.secrets?.length || 0;
        const hasNoTargetDomains = app.targetDomains?.includes("*");

        return (
          <div key={app.id} className="w-full border rounded-lg">
            <details className="group">
              <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer">
                <div className="flex items-center justify-between px-6 py-4 rounded-lg hover:bg-muted/50">
                  <div className="flex flex-col items-start gap-2">
                    <div className="font-semibold leading-none tracking-tight">
                      {app.name}&apos;s secrets
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ({secretCount} {secretCount === 1 ? "secret" : "secrets"})
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="p-6 pt-0">
                {hasNoTargetDomains && (
                  <div className="text-sm text-yellow-600 mb-2">
                    <a
                      href="https://corsfix.com/docs/dashboard/secrets#keeping-your-secrets-safe"
                      target="_blank"
                      className="underline"
                    >
                      Protect your secrets from being exposed
                    </a>{" "}
                    by specifying target domains for this application.
                  </div>
                )}
                <div className="space-y-3">
                  {secrets.length > 0 && (
                    <div className="flex gap-2 items-start">
                      <div className="w-1/2 md:w-1/4">
                        <label className="text-sm font-medium text-muted-foreground">
                          Name
                        </label>
                      </div>
                      <div className="w-1/2 md:w-3/4">
                        <label className="text-sm font-medium text-muted-foreground">
                          Value
                        </label>
                      </div>
                    </div>
                  )}
                  {secrets.map((secret, index) => (
                    <div
                      key={secret.id ?? secret.clientId}
                      className="flex gap-2 items-start"
                    >
                      <div className="w-1/2 md:w-1/4">
                        <Input
                          value={secret.name}
                          onChange={(e) =>
                            updateSecretRow(
                              app.id,
                              index,
                              "name",
                              e.target.value,
                            )
                          }
                          placeholder="YOUR-API-KEY"
                          className="font-mono font-bold placeholder:text-foreground/50 placeholder:font-normal"
                          maxLength={64}
                        />
                      </div>
                      <div className="w-1/2 md:w-3/4">
                        <Input
                          value={secret.value}
                          onChange={(e) =>
                            updateSecretRow(
                              app.id,
                              index,
                              "value",
                              e.target.value,
                            )
                          }
                          placeholder={
                            secret.id && secret.masked_value
                              ? secret.masked_value
                              : secret.id
                                ? "Leave empty to keep current value"
                                : "your-secret-value"
                          }
                          className="font-mono placeholder:text-foreground/50"
                          maxLength={255}
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteSecretRow(app.id, index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-6">
                  {secrets.length < 20 ? (
                    <Button
                      variant="outline"
                      onClick={() => addNewSecretRow(app.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add new
                    </Button>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-2 items-center">
                    {hasUnsavedChanges && (
                      <>
                        <span className="text-sm text-amber-600">
                          Unsaved changes
                        </span>
                        <Button
                          variant="outline"
                          disabled={saveLoading[app.id]}
                          onClick={() => {
                            const original = originalSecrets[app.id] || [];
                            setAppSecrets((prev) => ({
                              ...prev,
                              [app.id]: original.map((secret) => ({
                                id: secret.id,
                                name: secret.name,
                                value: "",
                                masked_value: secret.masked_value,
                              })),
                            }));
                            setUnsavedChanges((prev) => ({
                              ...prev,
                              [app.id]: false,
                            }));
                          }}
                        >
                          Revert
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={() => handleSaveSecrets(app.id)}
                      disabled={!hasUnsavedChanges || saveLoading[app.id]}
                    >
                      {saveLoading[app.id] ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
