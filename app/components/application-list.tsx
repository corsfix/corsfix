"use client";

import { Plus, X, Trash2, Pencil } from "lucide-react";
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
    allowedOrigins: [],
    allowedUrls: [],
  });
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [domainMode, setDomainMode] = useState<"all" | "custom">("all");

  const [validationErrors, setValidationErrors] = useState({
    name: false,
    allowedOrigins: false,
    allowedUrls: false,
    invalidOriginFormat: false,
    invalidDomainFormat: false,
  });

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewApp({ ...newApp, [e.target.name]: e.target.value });
  };

  const startEditing = (app: Application) => {
    setNewApp({ ...app });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const startAdding = () => {
    setNewApp({
      id: "",
      name: "",
      allowedOrigins: [],
      allowedUrls: [],
    });
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setNewApp({
      id: "",
      name: "",
      allowedOrigins: [],
      allowedUrls: [],
    });
    setCurrentOrigin("");
    setDomainMode("all");
    setIsDialogOpen(false);
  };

  const validateOriginFormat = (origin: string): boolean => {
    // Regex to validate origin format: scheme://hostname[:port]
    const originRegex =
      /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[a-zA-Z0-9\-._~%]+(?::[0-9]+)?$/;
    return originRegex.test(origin);
  };

  const validateDomainFormat = (domain: string): boolean => {
    // Simple domain validation: something.something
    if (domain === "*") {
      return true;
    }
    const domainRegex =
      /^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+$/;
    return domainRegex.test(domain);
  };

  // Set the domain mode when editing an application - ONLY when editing begins
  useEffect(() => {
    // Only run this effect when editing status changes or when dialog opens
    if (isDialogOpen && isEditing && newApp.allowedUrls) {
      // If there's only one URL and it's an asterisk, set mode to "all"
      if (newApp.allowedUrls.length === 1 && newApp.allowedUrls[0] === "*") {
        setDomainMode("all");
      } else {
        setDomainMode("custom");
      }
    } else if (isDialogOpen && !isEditing) {
      // For new applications, default to "all"
      setDomainMode("all");
    }
  }, [isDialogOpen, isEditing]); // Remove dependency on newApp.allowedUrls

  const handleSubmit = async () => {
    // Reset validation errors
    setValidationErrors({
      name: false,
      allowedOrigins: false,
      allowedUrls: false,
      invalidOriginFormat: false,
      invalidDomainFormat: false,
    });

    // Get the trimmed current inputs
    const pendingOrigin = currentOrigin.trim();

    // Validate the format of all origins
    const allOrigins = [
      ...(newApp.allowedOrigins || []),
      ...(pendingOrigin ? [pendingOrigin] : []),
    ];

    const invalidOrigins = allOrigins.filter(
      (origin) => !validateOriginFormat(origin)
    );

    // Validate domains format if in custom mode
    let invalidDomains: string[] = [];
    if (domainMode === "custom") {
      const allDomains = [...(newApp.allowedUrls || [])].filter(Boolean); // Filter out empty domains
      invalidDomains = allDomains.filter(
        (domain) => !validateDomainFormat(domain)
      );
    }

    // Perform validation
    const errors = {
      name: !newApp.name.trim(),
      allowedOrigins: !newApp.allowedOrigins?.length && !pendingOrigin,
      allowedUrls:
        domainMode === "custom" &&
        (!newApp.allowedUrls?.length ||
          newApp.allowedUrls.every((url) => !url.trim())),
      invalidOriginFormat: invalidOrigins.length > 0,
      invalidDomainFormat: invalidDomains.length > 0,
    };

    // Update validation errors state
    setValidationErrors(errors);

    // If any validation fails, show toast and return
    if (Object.values(errors).some(Boolean)) {
      toast("Please fix the following errors:", {
        description: (
          <ul className="list-disc pl-4">
            {errors.name && <li>Name is required</li>}
            {errors.allowedOrigins && (
              <li>At least one allowed origin is required</li>
            )}
            {errors.allowedUrls && (
              <li>At least one allowed domain is required</li>
            )}
            {invalidOrigins.length > 0 && (
              <li>
                Invalid origin format: {invalidOrigins.join(", ")}
                <br />
                <span className="text-xs">
                  Format should be: scheme://domain[:port]
                </span>
              </li>
            )}
            {errors.invalidDomainFormat && (
              <li>
                Invalid domain format: {invalidDomains.join(", ")}
                <br />
                <span className="text-xs">Format should be: domain.tld</span>
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
      let finalDomains: string[];
      if (domainMode === "all") {
        finalDomains = ["*"];
      } else {
        // Filter out empty strings
        finalDomains = (appData.allowedUrls || []).filter((url) => url.trim());
      }

      // Include current input values in the submission data
      const dataToSubmit = {
        ...appData,
        allowedOrigins: [
          ...(appData.allowedOrigins || []),
          ...(pendingOrigin ? [pendingOrigin] : []),
        ],
        allowedUrls: finalDomains,
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
        resetForm();
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

  const addOrigin = () => {
    if (currentOrigin && !newApp.allowedOrigins?.includes(currentOrigin)) {
      setNewApp({
        ...newApp,
        allowedOrigins: [...(newApp.allowedOrigins || []), currentOrigin],
      });
      setCurrentOrigin("");
    }
  };

  const removeOrigin = (origin: string) => {
    setNewApp({
      ...newApp,
      allowedOrigins: newApp.allowedOrigins?.filter((o) => o !== origin),
    });
  };

  const addNewDomain = () => {
    setDomainMode("custom"); // Ensure mode stays as custom when adding a domain
    setNewApp((prev) => ({
      ...prev,
      allowedUrls: [...(prev.allowedUrls || []), ""],
    }));
  };

  const updateDomain = (index: number, value: string) => {
    setNewApp((prev) => {
      const newAllowedUrls = [...(prev.allowedUrls || [])];
      newAllowedUrls[index] = value;
      return {
        ...prev,
        allowedUrls: newAllowedUrls,
      };
    });
  };

  const removeDomain = (index: number) => {
    setNewApp((prev) => ({
      ...prev,
      allowedUrls: prev.allowedUrls?.filter((_, i) => i !== index),
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
          <div className="grid gap-5 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="applicationName">Application Name</Label>
              <Input
                id="applicationName"
                name="name"
                placeholder="Enter application name"
                value={newApp.name}
                onChange={handleInputChange}
              />
              {validationErrors.name && (
                <p className="text-xs text-red-500">Name is required</p>
              )}
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="allowedOrigin">Allowed Origins</Label>
              <p className="text-sm text-muted-foreground">
                Your application base URL: (e.g., https://myapplication.com)
              </p>
              <div className="flex flex-wrap items-center gap-2 border rounded-md min-h-9 text-sm px-3 py-1 focus-within:ring-1 focus-within:ring-ring focus-within:border-input">
                {newApp.allowedOrigins?.map((origin) => (
                  <Badge key={origin} variant="secondary">
                    {origin}
                    <X
                      className="h-4 w-4 ml-2 cursor-pointer"
                      onClick={() => removeOrigin(origin)}
                    />
                  </Badge>
                ))}
                <input
                  id="allowedOrigin"
                  className="flex-1 bg-transparent border-none outline-none"
                  placeholder={
                    newApp.allowedOrigins?.length === 0
                      ? "Enter text and hit space to add multiple values"
                      : ""
                  }
                  value={currentOrigin}
                  onChange={(e) => setCurrentOrigin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === " " && currentOrigin.trim()) {
                      e.preventDefault();
                      addOrigin();
                    }
                    if (
                      e.key === "Backspace" &&
                      currentOrigin === "" &&
                      newApp.allowedOrigins &&
                      newApp.allowedOrigins.length > 0
                    ) {
                      removeOrigin(
                        newApp.allowedOrigins[newApp.allowedOrigins.length - 1]
                      );
                    }
                  }}
                />
              </div>
              {validationErrors.invalidOriginFormat && (
                <p className="text-xs text-red-500">
                  Please use a valid origin format: scheme://domain[:port]
                </p>
              )}
              {validationErrors.allowedOrigins && (
                <p className="text-xs text-red-500">
                  At least one allowed origin is required
                </p>
              )}
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="domainMode">Allowed Domains</Label>
              <p className="text-sm text-muted-foreground">Enable fetch to:</p>
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
                  <SelectItem value="custom">Custom domains</SelectItem>
                </SelectContent>
              </Select>

              {domainMode === "custom" && (
                <>
                  <p className="text-sm text-muted-foreground mt-2">
                    Enter domain names like example.com, app.example.com
                  </p>
                  <div className="space-y-2 mt-1">
                    {(newApp.allowedUrls || []).map((domain, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Enter domain (e.g., example.com)"
                          value={domain}
                          onChange={(e) => updateDomain(index, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDomain(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    onClick={addNewDomain}
                    className="w-full mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Domain
                  </Button>

                  {validationErrors.allowedUrls && (
                    <p className="text-xs text-red-500">
                      At least one allowed domain is required
                    </p>
                  )}
                  {validationErrors.invalidDomainFormat && (
                    <p className="text-xs text-red-500">
                      Please use a valid domain format: domain.tld
                    </p>
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
                <TableHead>Allowed Origins</TableHead>
                <TableHead>Allowed Domains</TableHead>
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
                      {app.allowedOrigins?.map((origin) => (
                        <Badge key={origin} variant="secondary">
                          {origin}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {app.allowedUrls?.map((url) => (
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
