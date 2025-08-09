"use client";

import { Plus, Trash2, Pencil } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  DialogHeader,
  DialogFooter,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import { Application } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

interface ApplicationListProps {
  initialApplications: Application[];
  hasActiveSubscription?: boolean;
  isCloud?: boolean;
}

export default function ApplicationList({
  initialApplications,
  hasActiveSubscription = false,
  isCloud = false,
}: ApplicationListProps) {
  const [applications, setApplications] =
    useState<Application[]>(initialApplications);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newApp, setNewApp] = useState<Application>({
    id: "",
    name: "",
    originDomains: [""],
    targetDomains: ["*"],
  });
  const [domainMode, setDomainMode] = useState<"all" | "custom">("all");

  const [validationErrors, setValidationErrors] = useState({
    name: false,
    originDomains: false,
    targetDomains: false,
    invalidOriginFormat: false,
    invalidDomainFormat: false,
  });

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewApp({ ...newApp, [e.target.name]: e.target.value });
  };

  const resetValidationErrors = () => {
    setValidationErrors({
      name: false,
      originDomains: false,
      targetDomains: false,
      invalidOriginFormat: false,
      invalidDomainFormat: false,
    });
  };

  const startEditing = (app: Application) => {
    setNewApp({
      ...app,
      // Ensure there's always at least one origin domain
      originDomains:
        app.originDomains && app.originDomains.length > 0
          ? app.originDomains
          : [""],
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const startAdding = () => {
    resetValidationErrors();
    setNewApp({
      id: "",
      name: "",
      originDomains: [""],
      targetDomains: [""],
    });
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const extractDomainFromInput = (input: string): string => {
    if (!input || !input.trim()) {
      return "";
    }

    let cleanInput = input.trim();
    cleanInput = cleanInput.replace(/^(https?:\/\/|\/\/)/i, "");
    cleanInput = cleanInput.split("/")[0].split("?")[0].split("#")[0];
    cleanInput = cleanInput.split(":")[0];
    cleanInput = cleanInput.toLowerCase();

    if (isValidDomain(cleanInput)) {
      return cleanInput;
    }

    // If it doesn't match, return the cleaned input anyway
    // This allows the user to see what we extracted and fix it if needed
    return input;
  };

  const isValidDomain = (domain: string): boolean => {
    const domainRegex =
      /^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+$/;
    return domainRegex.test(domain);
  };

  const isValidTargetDomain = (domain: string): boolean => {
    // Asterisk is only allowed for target domains
    if (domain === "*") {
      return true;
    }
    return isValidDomain(domain);
  };

  // Set the domain mode when editing an application - ONLY when editing begins
  useEffect(() => {
    // Only run this effect when editing status changes or when dialog opens
    if (isDialogOpen && isEditing && newApp.targetDomains) {
      // If there's only one URL and it's an asterisk, set mode to "all"
      if (
        newApp.targetDomains.length === 1 &&
        newApp.targetDomains[0] === "*"
      ) {
        setDomainMode("all");
      } else {
        setDomainMode("custom");
      }
    } else if (isDialogOpen && !isEditing) {
      // For new applications, default to "all"
      setDomainMode("all");
    }
  }, [isDialogOpen, isEditing]);

  const handleSubmit = async () => {
    // Reset validation errors
    resetValidationErrors();

    // Extract and clean origin domains
    const cleanedOriginDomains = (newApp.originDomains || [])
      .map((origin) => extractDomainFromInput(origin))
      .filter((origin) => origin.trim());

    const invalidOriginDomains = cleanedOriginDomains.filter(
      (origin) => !isValidDomain(origin)
    );

    // Extract and clean target domains if in custom mode
    let cleanedTargetDomains: string[] = [];
    let invalidTargetDomains: string[] = [];

    if (domainMode === "custom") {
      cleanedTargetDomains = (newApp.targetDomains || [])
        .map((domain) => extractDomainFromInput(domain))
        .filter((domain) => domain.trim());

      invalidTargetDomains = cleanedTargetDomains.filter(
        (domain) => !isValidTargetDomain(domain)
      );
    }

    // Perform validation
    const errors = {
      name: !newApp.name.trim(),
      originDomains: cleanedOriginDomains.length === 0,
      targetDomains:
        domainMode === "custom" && cleanedTargetDomains.length === 0,
      invalidOriginFormat: invalidOriginDomains.length > 0,
      invalidDomainFormat: invalidTargetDomains.length > 0,
    };

    // Update validation errors state
    setValidationErrors(errors);

    // If any validation fails, show toast and return
    if (Object.values(errors).some(Boolean)) {
      toast("Please fix the following errors:", {
        description: (
          <ul className="list-disc pl-4">
            {errors.name && <li>Name is required</li>}
            {errors.originDomains && (
              <li>At least one origin domain is required</li>
            )}
            {errors.targetDomains && (
              <li>At least one target domain is required</li>
            )}
            {invalidOriginDomains.length > 0 && (
              <li>
                Invalid origin domains: {invalidOriginDomains.join(", ")}
                <br />
                <span className="text-xs">Please check these domains</span>
              </li>
            )}
            {errors.invalidDomainFormat && (
              <li>
                Invalid target domains: {invalidTargetDomains.join(", ")}
                <br />
                <span className="text-xs">Please check these domains</span>
              </li>
            )}
          </ul>
        ),
      });
      return;
    }

    if (isCloud && !hasActiveSubscription) {
      toast.error(
        "An active subscription is required to add a production application."
      );
      return;
    }

    try {
      const { id, ...appData } = newApp;

      // Prepare domains based on mode
      let targetDomains: string[];
      if (domainMode === "all") {
        targetDomains = ["*"];
      } else {
        targetDomains = cleanedTargetDomains;
      }

      // Use cleaned domains for submission
      const dataToSubmit = {
        ...appData,
        originDomains: cleanedOriginDomains,
        targetDomains: targetDomains,
      };

      const endpoint = isEditing ? `/applications/${id}` : "/applications";
      const method = isEditing ? "put" : "post";

      const response = await apiClient[method]<Application>(
        endpoint,
        dataToSubmit
      );

      if (response.success) {
        setApplications((prev) =>
          isEditing
            ? prev.map((app) => (app.id === id ? response.data : app))
            : [...prev, response.data]
        );
        toast(`${isEditing ? "Updated" : "Added"} application successfully`);
        setIsDialogOpen(false);
      } else {
        toast(response.message);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast("Error saving application", {
          description: "Please try again later",
        });
      }
    }
  };

  const deleteApplication = async (id: string) => {
    try {
      await apiClient.delete(`/applications/${id}`);
      setApplications(applications.filter((app) => app.id !== id));
      toast("Deleted application successfully");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast("Error deleting application", {
          description: "Please try again later",
        });
      }
    }
  };

  const addNewOrigin = () => {
    setNewApp((prev) => ({
      ...prev,
      originDomains: [...(prev.originDomains || []), ""],
    }));
  };

  const updateOrigin = (index: number, value: string) => {
    setNewApp((prev) => {
      const newOriginDomains = [...(prev.originDomains || [])];
      newOriginDomains[index] = value;
      return {
        ...prev,
        originDomains: newOriginDomains,
      };
    });
  };

  const handleOriginBlur = (index: number, value: string) => {
    if (value.trim()) {
      const cleanedValue = extractDomainFromInput(value);
      if (cleanedValue !== value) {
        updateOrigin(index, cleanedValue);
      }
    }
  };

  const removeOrigin = (index: number) => {
    setNewApp((prev) => {
      const currentOrigins = prev.originDomains || [];
      // Don't allow removing if there's only one origin domain
      if (currentOrigins.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        originDomains: prev.originDomains?.filter((_, i) => i !== index),
      };
    });
  };

  const addNewDomain = () => {
    setDomainMode("custom"); // Ensure mode stays as custom when adding a domain
    setNewApp((prev) => ({
      ...prev,
      targetDomains: [...(prev.targetDomains || []), ""],
    }));
  };

  const updateDomain = (index: number, value: string) => {
    setNewApp((prev) => {
      const newtargetDomains = [...(prev.targetDomains || [])];
      newtargetDomains[index] = value;
      return {
        ...prev,
        targetDomains: newtargetDomains,
      };
    });
  };

  const handleDomainBlur = (index: number, value: string) => {
    if (value.trim()) {
      const cleanedValue = extractDomainFromInput(value);
      if (cleanedValue !== value) {
        updateDomain(index, cleanedValue);
      }
    }
  };

  const removeDomain = (index: number) => {
    setNewApp((prev) => ({
      ...prev,
      targetDomains: prev.targetDomains?.filter((_, i) => i !== index),
    }));
  };

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <div className="flex flex-col items-start gap-4 mb-6">
          <DialogTrigger asChild>
            <Button data-umami-event="application-add" onClick={startAdding}>
              <Plus className="mr-2 h-4 w-4" /> Add New Application
            </Button>
          </DialogTrigger>
          {isCloud && !hasActiveSubscription && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <p>
                An active subscription is required to add a production
                application.
              </p>
              <Link href="/billing">
                <Button
                  variant="link"
                  className="h-auto p-0"
                  data-umami-event="application-upgrade"
                >
                  Upgrade now
                </Button>
              </Link>
            </div>
          )}
        </div>
        <DialogContent className="max-w-[425px] mx-1">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Application" : "Add New Application"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="applicationName">Name</Label>
              <Input
                id="applicationName"
                name="name"
                placeholder="my app"
                value={newApp.name}
                onChange={handleInputChange}
                maxLength={64}
              />
              {validationErrors.name && (
                <p className="text-xs text-red-500">Name is required</p>
              )}
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="originDomains">Origin Domains</Label>
              <p className="text-sm text-muted-foreground">
                Your website domain (e.g., acme.com, www.acme.com)
              </p>
              <div className="space-y-2 mt-1">
                {(newApp.originDomains || []).map((origin, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="acme.com"
                      value={origin}
                      onChange={(e) => updateOrigin(index, e.target.value)}
                      onBlur={(e) => handleOriginBlur(index, e.target.value)}
                      className="flex-1"
                      maxLength={255}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOrigin(index)}
                      disabled={(newApp.originDomains || []).length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {validationErrors.invalidOriginFormat && (
                <p className="text-xs text-red-500">
                  Please enter valid domains. We couldn&apos;t extract valid
                  domains from some inputs.
                </p>
              )}
              {validationErrors.originDomains && (
                <p className="text-xs text-red-500">
                  At least one origin domain is required
                </p>
              )}

              {newApp.originDomains && newApp.originDomains?.length < 8 && (
                <div>
                  <Button
                    variant="outline"
                    onClick={addNewOrigin}
                    className="text-sm text-muted-foreground"
                  >
                    <Plus className="size-2" /> Add more
                  </Button>
                </div>
              )}
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="domainMode">Target Domains</Label>
              <p className="text-sm text-muted-foreground">
                Domains you want to fetch (e.g., api.external.com)
              </p>
              <Select
                value={domainMode}
                onValueChange={(value) =>
                  setDomainMode(value as "all" | "custom")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select domain option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All domains</SelectItem>
                  <SelectItem value="custom">Select domains</SelectItem>
                </SelectContent>
              </Select>

              {domainMode === "custom" && (
                <>
                  <div className="space-y-2">
                    {(newApp.targetDomains || []).map((domain, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="api.external.com"
                          value={domain}
                          onChange={(e) => updateDomain(index, e.target.value)}
                          onBlur={(e) =>
                            handleDomainBlur(index, e.target.value)
                          }
                          className="flex-1"
                          maxLength={255}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDomain(index)}
                          disabled={(newApp.targetDomains || []).length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {validationErrors.targetDomains && (
                    <p className="text-xs text-red-500">
                      At least one target domain is required
                    </p>
                  )}
                  {validationErrors.invalidDomainFormat && (
                    <p className="text-xs text-red-500">
                      Please enter valid domains. We couldn&apos;t extract valid
                      domains from some inputs.
                    </p>
                  )}

                  {newApp.targetDomains && newApp.targetDomains?.length < 8 && (
                    <div>
                      <Button
                        variant="outline"
                        onClick={addNewDomain}
                        className="text-sm text-muted-foreground"
                      >
                        <Plus className="size-2" /> Add more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              data-umami-event={`application-save-${
                isEditing ? "edit" : "add"
              }`}
              onClick={handleSubmit}
            >
              {isEditing ? "Save Changes" : "Add Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Your Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Origin Domains</TableHead>
                <TableHead>Target Domains</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <p className="text-sm text-muted-foreground">
                        No applications found
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>{app.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {app.originDomains?.map((origin) => (
                        <Badge key={origin} variant="secondary">
                          {origin}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {app.targetDomains?.map((url) => (
                        <Badge key={url} variant="secondary">
                          {url}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        data-umami-event="application-edit"
                        variant="outline"
                        size="icon"
                        onClick={() => startEditing(app)}
                        disabled={isCloud && !hasActiveSubscription}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            data-umami-event="application-delete"
                            variant="destructive"
                            size="icon"
                            disabled={isCloud && !hasActiveSubscription}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="mx-1">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will
                              permanently delete the application.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteApplication(app.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
