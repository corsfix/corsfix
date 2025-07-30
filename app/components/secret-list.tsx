"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Application,
  DeleteSecret,
  SecretItem,
  UpsertSecret,
} from "@/types/api";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
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
} from "./ui/alert-dialog";
import { Label } from "./ui/label";
import Link from "next/link";

interface SecretListProps {
  initialApplications: Application[];
  hasActiveSubscription?: boolean;
  isCloud?: boolean;
}

export default function SecretList({
  initialApplications,
  hasActiveSubscription = false,
  isCloud = false,
}: SecretListProps) {
  const [applications, setApplications] =
    useState<Application[]>(initialApplications);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [newSecret, setNewSecret] = useState<SecretItem>({
    application_id: "",
    name: "",
    note: "",
    value: "",
  });

  const [validationErrors, setValidationErrors] = useState({
    name: false,
    value: false,
  });

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.target.name === "name") {
      const value = e.target.value.toUpperCase();
      const validValue = value.replace(/[^A-Z0-9_]/g, "");

      setNewSecret({
        ...newSecret,
        [e.target.name]: validValue,
      });
      return;
    }

    setNewSecret({ ...newSecret, [e.target.name]: e.target.value });
  };

  const startAdding = (appId: string) => {
    setIsEditing(false);
    setNewSecret({
      application_id: appId,
      name: "",
      note: "",
      value: "",
    });
    setIsDialogOpen(true);
  };

  const startEditing = (secret: SecretItem) => {
    setIsEditing(true);
    setNewSecret({
      application_id: secret.application_id,
      id: secret.id,
      name: secret.name,
      note: secret.note || "",
      value: secret.value || "",
    });
    setIsDialogOpen(true);
  };

  const handleSaveSecret = async () => {
    setValidationErrors({ name: false, value: false });

    if (isEditing) {
      const errors = {
        name: !newSecret.name.trim(),
        value: false,
      };

      setValidationErrors(errors);
      if (Object.values(errors).some((error) => error)) {
        toast("Please fix the following errors:", {
          description: (
            <ul className="list-disc pl-4">
              {errors.name && <li>Name: This field is required.</li>}
            </ul>
          ),
        });
        return;
      }

      const response = await apiClient.put<SecretItem>(
        `/secrets/${newSecret.id}`,
        {
          application_id: newSecret.application_id,
          id: newSecret.id,
          name: newSecret.name.trim(),
          value: newSecret.value?.trim(),
          note: newSecret.note.trim(),
        } as UpsertSecret
      );

      if (!response.success) {
        toast.error(response.message);
        return;
      }

      setApplications(
        applications.map((app) => {
          if (app.id !== newSecret.application_id) return app;
          return {
            ...app,
            secrets: app.secrets?.map((s) =>
              s.id === newSecret.id ? response.data : s
            ),
          };
        })
      );
      toast.success("Secret updated successfully");
    } else {
      const errors = {
        name: !newSecret.name.trim(),
        value: !newSecret.value?.trim(),
      };

      setValidationErrors(errors);
      if (Object.values(errors).some((error) => error)) {
        toast("Please fix the following errors:", {
          description: (
            <ul className="list-disc pl-4">
              {errors.name && <li>Name: This field is required.</li>}
              {errors.value && <li>Secret value: This field is required.</li>}
            </ul>
          ),
        });
        return;
      }

      const response = await apiClient.post<SecretItem>("/secrets", {
        application_id: newSecret.application_id,
        name: newSecret.name.trim(),
        value: newSecret.value?.trim(),
        note: newSecret.note.trim(),
      } as UpsertSecret);

      if (!response.success) {
        toast.error(response.message);
        return;
      }

      setApplications(
        applications.map((app) =>
          app.id === newSecret.application_id
            ? { ...app, secrets: [...(app.secrets || []), response.data] }
            : app
        )
      );
      toast.success("Secret added successfully");
    }

    setIsDialogOpen(false);
  };

  const handleDeleteSecret = async (
    secretId: string | undefined,
    appId: string
  ) => {
    const response = await apiClient.delete<SecretItem>(
      `/secrets/${secretId}`,
      {
        application_id: appId,
      } as DeleteSecret
    );

    if (!response.success) {
      toast.error(response.message);
      return;
    }

    setApplications(
      applications.map((app) => {
        if (app.id !== appId) return app;
        return {
          ...app,
          secrets: app.secrets && app.secrets.filter((s) => s.id !== secretId),
        };
      })
    );
    toast.success("Secret deleted successfully");
  };

  const appUsingAllowedAllDomains = (app: Application) => {
    return app.targetDomains?.some((domain) => domain === "*");
  };

  return (
    <>
      <div className="space-y-6">
        {!isCloud && hasActiveSubscription && applications.length === 0 && (
          <>
            <div className="text-sm text-muted-foreground mb-4">
              No applications found. Start adding applications to manage your
              secrets.
            </div>
            <Link href="/applications">
              <Button data-umami-event="secrets-applications">
                Add Application
              </Button>
            </Link>
          </>
        )}
        {isCloud && !hasActiveSubscription && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <p>Upgrade to a paid plan to start managing application secrets.</p>
            <Link href="/billing">
              <Button
                variant="link"
                className="h-auto p-0"
                data-umami-event="secrets-upgrade"
              >
                Upgrade now
              </Button>
            </Link>
          </div>
        )}
        {applications.map((app) => (
          <Card key={app.id} className="w-full">
            <CardHeader className="pb-2">
              <div className="flex flex-row justify-between items-center">
                <div>
                  <CardTitle className="text-xl">{app.name}</CardTitle>
                  <CardDescription>
                    {app.secrets?.length ? app.secrets.length : 0} secret(s){" "}
                    <br />
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => startAdding(app.id)}
                  disabled={isCloud && !hasActiveSubscription}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Secret
                </Button>
              </div>
              {appUsingAllowedAllDomains(app) && (
                <span className="text-sm text-yellow-500">
                  This application target domains is set to All Domains (*),
                  your secrets could be exposed. <br />
                  For better security, restrict access to specific domains only.
                </span>
              )}
            </CardHeader>
            <CardContent>
              {app.secrets && app.secrets.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Name</TableHead>
                      <TableHead className="w-2/3">Notes</TableHead>
                      <TableHead className="w-[100px] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {app.secrets.map((secret) => (
                      <TableRow key={secret.id}>
                        <TableCell className="font-mono font-medium">
                          {secret.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {secret.note ? (
                            <span className="line-clamp-2">{secret.note}</span>
                          ) : (
                            <span className="text-muted-foreground/50 italic">
                              No notes
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              data-umami-event="secret-edit"
                              variant="outline"
                              size="icon"
                              onClick={() => startEditing(secret)}
                              title="Edit Secret"
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
                                  <AlertDialogTitle>
                                    Are you sure?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will
                                    permanently delete the secret.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handleDeleteSecret(
                                        secret.id,
                                        secret.application_id
                                      )
                                    }
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
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No secrets found for this application.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Add/Edit Secret Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Secret" : "Add Secret"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Modify the details of your existing secret."
                : "Add a new secret to your application."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="application">Application</Label>
              <Select defaultValue={newSecret.application_id} disabled>
                <SelectTrigger id="application">
                  <SelectValue>
                    {
                      applications.find(
                        (app) => app.id == newSecret.application_id
                      )?.name
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {applications.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Secret Name</Label>
              <p className="text-sm text-muted-foreground">
                Valid characters: A-Z, 0-9, _ (underscore).
              </p>
              <Input
                id="name"
                name="name"
                value={newSecret.name}
                onChange={handleInputChange}
                placeholder="API_KEY"
                className="font-mono"
              />
              {validationErrors.name && (
                <p className="text-xs text-red-500">Name is required</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="value">Secret Value</Label>
              {isEditing && (
                <p className="text-sm text-muted-foreground">
                  Leave empty to use existing value.
                </p>
              )}
              <Input
                id="value"
                name="value"
                value={newSecret.value}
                onChange={handleInputChange}
                placeholder={
                  applications
                    .find((app) => app.id == newSecret.application_id)
                    ?.secrets?.find((s) => s.id == newSecret.id)
                    ?.masked_value || "your-secret-value"
                }
                className="font-mono"
              />
              {validationErrors.value && (
                <p className="text-xs text-red-500">Secret value is required</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Notes (optional)</Label>
              <Textarea
                id="note"
                name="note"
                value={newSecret.note}
                onChange={handleInputChange}
                placeholder="Add any relevant notes about this secret..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveSecret}
              data-umami-event={
                isEditing ? "save-edit-secret" : "save-new-secret"
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
