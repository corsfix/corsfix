"use client";

import { useState, useEffect } from "react";
import { parseCurlCommand } from "curl-parser-ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateId } from "@/lib/utils";
import { HeaderItem } from "@/types/api";

interface ImportCurlData {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headerItems: HeaderItem[];
  overrideHeaderItems: HeaderItem[];
  body: string;
  contentType?: string;
}

interface ImportCurlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: ImportCurlData) => void;
  initialCurl?: string;
}

export const ImportCurlModal = ({
  isOpen,
  onClose,
  onImport,
  initialCurl = "",
}: ImportCurlModalProps) => {
  const [curlCommand, setCurlCommand] = useState(initialCurl);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Update curl command when initialCurl changes
  useEffect(() => {
    if (initialCurl) {
      setCurlCommand(initialCurl);
    }
  }, [initialCurl]);

  const handleImport = () => {
    if (!curlCommand.trim()) {
      setError("Please enter a curl command");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const parsed = parseCurlCommand(curlCommand.trim());

      // Extract data from parsed curl command
      const importData: ImportCurlData = {
        url: parsed.url,
        method: (parsed.method || "GET") as ImportCurlData["method"],
        headerItems: [],
        overrideHeaderItems: [],
        body: "",
      };

      // Convert headers object to array format
      if (parsed.headers) {
        // Extract Content-Type separately
        const contentTypeHeader = Object.entries(parsed.headers).find(
          ([key]) => key.toLowerCase() === "content-type"
        );
        if (contentTypeHeader) {
          importData.contentType = contentTypeHeader[1] as string;
        }

        // Add other headers to headerItems (excluding Content-Type since it's handled separately)
        importData.headerItems = Object.entries(parsed.headers)
          .filter(([key]) => key.toLowerCase() !== "content-type")
          .map(([key, value]) => ({
            id: generateId(),
            name: key,
            value: value as string,
          }));
      }

      // Handle body data
      if (parsed.data) {
        importData.body =
          typeof parsed.data === "string"
            ? parsed.data
            : JSON.stringify(parsed.data);
      }

      // Handle query parameters - append to URL if they exist
      if (parsed.query && Object.keys(parsed.query).length > 0) {
        const url = new URL(parsed.url);
        Object.entries(parsed.query).forEach(([key, value]) => {
          url.searchParams.set(key, value as string);
        });
        importData.url = url.toString();
      }

      onImport(importData);
      setCurlCommand("");
      onClose();
    } catch (err) {
      console.error("Error parsing curl command:", err);
      setError("Invalid curl command. Please check the syntax and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCurlCommand("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Import from cURL
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">
              Paste your cURL command:
            </label>
            <Textarea
              value={curlCommand}
              onChange={(e) => setCurlCommand(e.target.value)}
              placeholder={`curl -X POST 'https://api.example.com/data' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token123' \\
  -d '{"name": "John", "age": 30}'`}
              className="min-h-[120px] font-mono text-sm"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            <p className="mb-1">
              <strong>Tip:</strong> This will extract the URL, method, headers,
              and body from your cURL command.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isLoading || !curlCommand.trim()}
          >
            {isLoading ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
