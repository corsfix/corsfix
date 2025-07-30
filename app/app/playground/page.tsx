"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Code, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import Nav from "@/components/nav";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

// Types
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type ContentType =
  | "none"
  | "application/json"
  | "application/x-www-form-urlencoded"
  | "application/ld+json"
  | "application/hal+json"
  | "application/vnd.api+json"
  | "application/xml"
  | "text/plain"
  | "text/html"
  | "text/xml";

type ProxyRegion = "auto" | "ap" | "us" | "eu";

interface HeaderItem {
  id: string;
  name: string;
  value: string;
}

interface RequestConfig {
  url: string;
  method: HTTPMethod;
  headers: Record<string, string>;
  headerItems: HeaderItem[];
  overrideHeaderItems: HeaderItem[];
  overrideHeaders: Record<string, string>;
  body?: string;
  contentType: ContentType;
  enableCache: boolean;
  region: ProxyRegion;
}

interface RequestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  blobUrl?: string;
  size: number;
  time: number;
}

interface ExamplePreset {
  id: string;
  name: string;
  description: string;
  explanation: string;
  config: Partial<RequestConfig>;
}

const PROXY_REGIONS = {
  auto: "proxy.corsfix.com",
  ap: "proxy-ap.corsfix.com",
  us: "proxy-us.corsfix.com",
  eu: "proxy-eu.corsfix.com",
};

// Example presets
const EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    id: "bypass-cors",
    name: "Bypass CORS",
    description: "CORS bypass with Corsfix",
    explanation:
      "● This example demonstrates how Corsfix bypasses CORS errors by proxying a request to the Bing Image of The Day API.\n" +
      "● The request would normally be blocked by CORS if called directly from a browser.",
    config: {
      url: "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1",
      method: "GET",
      contentType: "none",
      enableCache: false,
      headerItems: [],
      overrideHeaderItems: [],
      region: "auto",
    },
  },
  {
    id: "header-override",
    name: "Header Override",
    description: "Set custom request headers",
    explanation:
      "● This example shows how to override request headers using Corsfix.\n" +
      "● The request will be sent to httpbin.org which reflects all headers back to you.\n" +
      "● We've set a custom Origin and User-Agent that would not normally be possible to modify in a browser environment.",
    config: {
      url: "https://httpbin.org/get",
      method: "GET",
      contentType: "none",
      enableCache: false,
      headerItems: [],
      overrideHeaderItems: [
        {
          id: generateId(),
          name: "Origin",
          value: "https://custom-origin.com",
        },
        {
          id: generateId(),
          name: "User-Agent",
          value: "Corsfix Example Bot/1.0",
        },
      ],
      region: "auto",
    },
  },
  {
    id: "cached-response",
    name: "Cached Response",
    description: "Enabled cached response using Corsfix",
    explanation:
      "● This example demonstrates Corsfix's cached response feature.\n" +
      "● The request is made to random.org to get a random number with caching enabled.\n" +
      "● Subsequent requests will return the same number without calling the API again, until the cache expires.\n" +
      "● Try clicking Send multiple times and notice how the response time is much faster and the response stays the same.",
    config: {
      url: "https://www.random.org/integers/?num=1&min=1&max=100&col=1&base=10&format=plain",
      method: "GET",
      contentType: "none",
      enableCache: true,
      headerItems: [],
      overrideHeaderItems: [],
      region: "auto",
    },
  },
];

// Utility functions
function ensureValidUrl(url: string): string {
  if (!url) return url;

  // Add http if no protocol is specified
  if (!url.match(/^[a-zA-Z]+:\/\//)) {
    return `http://${url}`;
  }
  return url;
}

function getProxiedUrl(url: string, region: ProxyRegion = "auto"): string {
  const proxyBaseUrl = `https://${PROXY_REGIONS[region]}/?`;
  return `${proxyBaseUrl}${url}`;
}

function stripProxyUrl(url: string): string {
  // Check against all possible proxy URLs
  for (const domain of Object.values(PROXY_REGIONS)) {
    const proxyUrl = `https://${domain}/?`;
    if (url.startsWith(proxyUrl)) {
      return url.slice(proxyUrl.length);
    }
  }
  return url;
}

function generateFetch(config: RequestConfig): string {
  const proxiedUrl = getProxiedUrl(config.url, config.region);
  const options: Record<string, unknown> = {
    method: config.method,
  };

  const headers: Record<string, string> = { ...config.headers };

  // Add override headers via x-corsfix-headers if any exist
  if (Object.keys(config.overrideHeaders).length > 0) {
    headers["x-corsfix-headers"] = JSON.stringify(config.overrideHeaders);
  }

  if (Object.keys(headers).length > 0) {
    options.headers = headers;
  }

  if (config.body) {
    options.body = config.body;
  }

  return `fetch("${proxiedUrl}", ${JSON.stringify(options, null, 2)})`;
}

// Generate a unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Create a default empty config
function getDefaultConfig(): RequestConfig {
  return {
    url: "",
    method: "GET",
    headers: {},
    headerItems: [],
    overrideHeaderItems: [],
    overrideHeaders: {},
    body: "",
    contentType: "none",
    enableCache: false,
    region: "auto",
  };
}

export default function Playground() {
  const [config, setConfig] = useState<RequestConfig>(getDefaultConfig());
  const [response, setResponse] = useState<RequestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [requestTab, setRequestTab] = useState<
    "headers" | "body" | "overrides" | "cache" | "region"
  >("body");
  const [responseTab, setResponseTab] = useState<
    "headers" | "body" | "preview"
  >("body");
  const [selectedPreset, setSelectedPreset] = useState<ExamplePreset | null>(
    null
  );
  const [showExampleDialog, setShowExampleDialog] = useState(false);
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  const isHtmlResponse =
    response?.headers["content-type"]?.includes("text/html");
  const isImageResponse = response?.headers["content-type"]?.includes("image/");
  const isVideoResponse = response?.headers["content-type"]?.includes("video/");
  const hasPreview = isHtmlResponse || isImageResponse || isVideoResponse;

  // Set preview tab as default when preview is available
  useEffect(() => {
    if (hasPreview) {
      setResponseTab("preview");
    }
  }, [hasPreview]);

  // Update headers Record when headerItems change
  useEffect(() => {
    const headersObj: Record<string, string> = {};
    config.headerItems.forEach((item) => {
      if (item.name && item.value) {
        headersObj[item.name] = item.value;
      }
    });

    setConfig((prev) => ({
      ...prev,
      headers: headersObj,
    }));
  }, [config.headerItems]);

  // Update override headers Record when overrideHeaderItems change
  useEffect(() => {
    const headersObj: Record<string, string> = {};
    config.overrideHeaderItems.forEach((item) => {
      if (item.name && item.value) {
        headersObj[item.name] = item.value;
      }
    });

    setConfig((prev) => ({
      ...prev,
      overrideHeaders: headersObj,
    }));
  }, [config.overrideHeaderItems]);

  // Update Content-Type header when contentType changes
  useEffect(() => {
    if (config.contentType === "none") {
      // Remove Content-Type header if set to "none"
      setConfig((prev) => {
        const newHeaderItems = prev.headerItems.filter(
          (item) => item.name !== "Content-Type"
        );
        return {
          ...prev,
          headerItems: newHeaderItems,
        };
      });
    } else {
      // Add or update Content-Type header
      const contentTypeIndex = config.headerItems.findIndex(
        (item) => item.name === "Content-Type"
      );

      if (contentTypeIndex >= 0) {
        // Update existing Content-Type header
        setConfig((prev) => {
          const newHeaderItems = [...prev.headerItems];
          newHeaderItems[contentTypeIndex] = {
            ...newHeaderItems[contentTypeIndex],
            value: prev.contentType,
          };
          return { ...prev, headerItems: newHeaderItems };
        });
      } else {
        // Add new Content-Type header
        setConfig((prev) => ({
          ...prev,
          headerItems: [
            ...prev.headerItems,
            { id: generateId(), name: "Content-Type", value: prev.contentType },
          ],
        }));
      }
    }
  }, [config.contentType]);

  // Update headers Record when enableCache changes
  useEffect(() => {
    if (config.enableCache) {
      setConfig((prev) => ({
        ...prev,
        headerItems: [
          ...prev.headerItems.filter((item) => item.name !== "x-corsfix-cache"),
          { id: generateId(), name: "x-corsfix-cache", value: "true" },
        ],
      }));
    } else {
      setConfig((prev) => ({
        ...prev,
        headerItems: prev.headerItems.filter(
          (item) => item.name !== "x-corsfix-cache"
        ),
      }));
    }
  }, [config.enableCache]);

  const resetPlayground = () => {
    setConfig(getDefaultConfig());
    setResponse(null);
    setIsLoading(false);
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const applyPreset = (preset: ExamplePreset) => {
    setSelectedPreset(preset);
    setShowExampleDialog(true);
  };

  const confirmApplyPreset = () => {
    if (!selectedPreset) return;

    // Reset first
    resetPlayground();

    // Then apply the preset
    setConfig(() => ({
      ...getDefaultConfig(),
      ...selectedPreset.config,
      headerItems: [...(selectedPreset.config.headerItems || [])],
      overrideHeaderItems: [
        ...(selectedPreset.config.overrideHeaderItems || []),
      ],
    }));

    // Set appropriate tab based on preset
    if (selectedPreset.id === "header-override") {
      setRequestTab("overrides");
    } else if (selectedPreset.id === "cached-response") {
      setRequestTab("cache");
    } else {
      setRequestTab("body");
    }

    setShowExampleDialog(false);
    toast.success(`Applied "${selectedPreset.name}" example`);
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      if (!config.url.trim()) {
        toast.error("Please enter a URL");
        return;
      }

      const controller = new AbortController();
      setAbortController(controller);

      const validUrl = ensureValidUrl(config.url);
      const proxiedUrl = getProxiedUrl(validUrl, config.region);
      setConfig((prev) => ({ ...prev, url: validUrl }));

      setIsLoading(true);
      const startTime = Date.now();

      const headers: Record<string, string> = { ...config.headers };

      // Add override headers via x-corsfix-headers if any exist
      if (Object.keys(config.overrideHeaders).length > 0) {
        headers["x-corsfix-headers"] = JSON.stringify(config.overrideHeaders);
      }

      const res = await fetch(proxiedUrl, {
        method: config.method,
        headers: headers,
        body: config.method !== "GET" ? config.body : null,
        cache: "no-cache",
        signal: controller.signal,
      });

      const endTime = Date.now();
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const contentType = responseHeaders["content-type"] || "";
      let responseBody;
      let blobUrl = "";
      let contentSize = 0;

      if (contentType.includes("image/") || contentType.includes("video/")) {
        const blob = await res.blob();
        blobUrl = URL.createObjectURL(blob);
        responseBody = "Binary content - use preview tab to view";
        contentSize = blob.size;
      } else {
        responseBody = await res.text();
        contentSize = responseBody.length;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: responseBody,
        blobUrl,
        size: contentSize,
        time: endTime - startTime,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setResponse(null);
        toast.info("Request cancelled");
      } else {
        console.error(error);
        setResponse({
          status: 0,
          statusText: "Error",
          headers: {},
          body: error instanceof Error ? error.message : "Unknown error",
          size: 0,
          time: 0,
        });
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const addNewHeader = () => {
    setConfig((prev) => ({
      ...prev,
      headerItems: [
        ...prev.headerItems,
        { id: generateId(), name: "", value: "" },
      ],
    }));
  };

  const updateHeaderItem = (
    id: string,
    field: "name" | "value",
    newValue: string
  ) => {
    setConfig((prev) => ({
      ...prev,
      headerItems: prev.headerItems.map((item) =>
        item.id === id ? { ...item, [field]: newValue } : item
      ),
    }));
  };

  const removeHeaderItem = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      headerItems: prev.headerItems.filter((item) => item.id !== id),
    }));
  };

  const addNewOverrideHeader = () => {
    setConfig((prev) => ({
      ...prev,
      overrideHeaderItems: [
        ...prev.overrideHeaderItems,
        { id: generateId(), name: "", value: "" },
      ],
    }));
  };

  const updateOverrideHeaderItem = (
    id: string,
    field: "name" | "value",
    newValue: string
  ) => {
    setConfig((prev) => ({
      ...prev,
      overrideHeaderItems: prev.overrideHeaderItems.map((item) =>
        item.id === id ? { ...item, [field]: newValue } : item
      ),
    }));
  };

  const removeOverrideHeaderItem = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      overrideHeaderItems: prev.overrideHeaderItems.filter(
        (item) => item.id !== id
      ),
    }));
  };

  const copyToClipboard = (text: string, type: "curl" | "fetch") => {
    if (!config.url.trim()) {
      toast.error("Please enter a URL");
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${type} command to clipboard`);
  };

  const handleContentTypeChange = (value: string) => {
    setConfig((prev) => ({
      ...prev,
      contentType: value as ContentType,
    }));
  };

  return (
    <>
      <Nav />
      <div className="flex flex-col h-[calc(100vh-65px)]">
        <div className="p-4 flex flex-col flex-grow">
          {/* Example pills */}
          <div className="mb-4 flex items-center">
            <h3 className="text-sm text-muted-foreground mr-2">Examples</h3>
            <div
              className="flex overflow-x-auto no-scrollbar"
              style={{
                scrollbarWidth: "none" /* Firefox */,
                msOverflowStyle: "none" /* IE and Edge */,
              }}
            >
              <div className="flex gap-2">
                {EXAMPLE_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="flex items-center gap-1 whitespace-nowrap"
                    data-umami-event={`playground-example-${preset.id}`}
                  >
                    {preset.name}
                    <Info className="h-3 w-3 ml-1 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card flex flex-col flex-grow">
            <div className="flex flex-row gap-2 p-4">
              <Select
                value={config.method}
                onValueChange={(value) =>
                  setConfig((prev) => ({
                    ...prev,
                    method: value as HTTPMethod,
                  }))
                }
              >
                <SelectTrigger className="w-[90px] text-xs">
                  <SelectValue>{config.method}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1 flex">
                <div className="bg-accent hidden md:flex px-1 text-sm text-muted-foreground border rounded-l items-center">
                  {`https://${PROXY_REGIONS[config.region]}/?`}
                </div>
                <Input
                  type="url"
                  placeholder="Enter request URL"
                  value={stripProxyUrl(config.url)}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, url: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendButtonRef.current?.click();
                    }
                  }}
                  className="flex-1 rounded-l-none"
                />
              </div>
              <div className="inline-flex justify-end">
                <Button
                  ref={sendButtonRef}
                  onClick={isLoading ? handleCancel : handleSend}
                  variant={isLoading ? "destructive" : "default"}
                  className="rounded-r-none border-r-0"
                  data-umami-event={
                    isLoading ? "playground-cancel" : "playground-send"
                  }
                >
                  {isLoading ? "Cancel" : "Send"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" className="rounded-l-none px-2">
                      <Code className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        copyToClipboard(generateFetch(config), "fetch")
                      }
                    >
                      Copy as Fetch
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <ResizablePanelGroup direction="vertical" className="flex-grow">
              <ResizablePanel
                defaultSize={50}
                className="min-h-[150px] text-sm"
              >
                <div className="flex flex-col h-full">
                  <div
                    className="flex border-b overflow-scroll no-scrollbar"
                    style={{
                      scrollbarWidth: "none" /* Firefox */,
                      msOverflowStyle: "none" /* IE and Edge */,
                    }}
                  >
                    <button
                      className={`px-4 py-2 text-sm ${
                        requestTab === "body" ? "border-b-2 border-primary" : ""
                      }`}
                      onClick={() => setRequestTab("body")}
                    >
                      Body
                    </button>
                    <button
                      className={`px-4 py-2 text-sm ${
                        requestTab === "headers"
                          ? "border-b-2 border-primary"
                          : ""
                      }`}
                      onClick={() => setRequestTab("headers")}
                    >
                      Headers
                    </button>
                    <button
                      className={`px-4 py-2 text-sm ${
                        requestTab === "overrides"
                          ? "border-b-2 border-primary"
                          : ""
                      }`}
                      onClick={() => setRequestTab("overrides")}
                    >
                      Header&nbsp;Override
                    </button>
                    <button
                      className={`px-4 py-2 text-sm ${
                        requestTab === "cache"
                          ? "border-b-2 border-primary"
                          : ""
                      }`}
                      onClick={() => setRequestTab("cache")}
                    >
                      Cache
                    </button>
                    <button
                      className={`px-4 py-2 text-sm ${
                        requestTab === "region"
                          ? "border-b-2 border-primary"
                          : ""
                      }`}
                      onClick={() => setRequestTab("region")}
                    >
                      Region
                    </button>
                  </div>
                  <div className="flex-grow overflow-y-auto">
                    {requestTab === "headers" && (
                      <div className="space-y-4 p-4">
                        <div className="space-y-2">
                          {config.headerItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex gap-2 items-center"
                            >
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Header name"
                                  value={item.name}
                                  onChange={(e) =>
                                    updateHeaderItem(
                                      item.id,
                                      "name",
                                      e.target.value
                                    )
                                  }
                                  className="font-mono text-sm"
                                />
                                <Input
                                  placeholder="Header value"
                                  value={item.value}
                                  onChange={(e) =>
                                    updateHeaderItem(
                                      item.id,
                                      "value",
                                      e.target.value
                                    )
                                  }
                                  className="font-mono text-sm"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeHeaderItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          onClick={addNewHeader}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add Header
                        </Button>
                      </div>
                    )}
                    {requestTab === "overrides" && (
                      <div className="space-y-4 p-4">
                        <div className="text-sm text-muted-foreground mb-4">
                          Headers added here will be sent as overrides via the
                          x-corsfix-headers header.
                        </div>
                        <div className="space-y-2">
                          {config.overrideHeaderItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex gap-2 items-center"
                            >
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Header name"
                                  value={item.name}
                                  onChange={(e) =>
                                    updateOverrideHeaderItem(
                                      item.id,
                                      "name",
                                      e.target.value
                                    )
                                  }
                                  className="font-mono text-sm"
                                />
                                <Input
                                  placeholder="Header value"
                                  value={item.value}
                                  onChange={(e) =>
                                    updateOverrideHeaderItem(
                                      item.id,
                                      "value",
                                      e.target.value
                                    )
                                  }
                                  className="font-mono text-sm"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  removeOverrideHeaderItem(item.id)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          onClick={addNewOverrideHeader}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add Override Header
                        </Button>
                      </div>
                    )}
                    {requestTab === "body" && (
                      <div className="p-4 h-full flex flex-col gap-4">
                        <div className="flex items-center">
                          <label className="mr-4">Content&nbsp;Type</label>
                          <Select
                            value={config.contentType}
                            onValueChange={handleContentTypeChange}
                          >
                            <SelectTrigger className="w-80">
                              <SelectValue placeholder="Select a content type" />
                            </SelectTrigger>
                            <SelectContent className="inline-block">
                              <SelectGroup>
                                <SelectLabel>Commonly Used</SelectLabel>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="application/json">
                                  application/json
                                </SelectItem>
                                <SelectItem value="application/x-www-form-urlencoded">
                                  application/x-www-form-urlencoded
                                </SelectItem>
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>Others</SelectLabel>
                                <SelectItem value="application/ld+json">
                                  application/ld+json
                                </SelectItem>
                                <SelectItem value="application/hal+json">
                                  application/hal+json
                                </SelectItem>
                                <SelectItem value="application/vnd.api+json">
                                  application/vnd.api+json
                                </SelectItem>
                                <SelectItem value="application/xml">
                                  application/xml
                                </SelectItem>
                                <SelectItem value="text/plain">
                                  text/plain
                                </SelectItem>
                                <SelectItem value="text/html">
                                  text/html
                                </SelectItem>
                                <SelectItem value="text/xml">
                                  text/xml
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          placeholder="Request body"
                          value={
                            config.contentType === "none" ? "" : config.body
                          }
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              body: e.target.value,
                            }))
                          }
                          className="font-mono resize-none flex-1"
                          disabled={config.contentType === "none"}
                        />
                      </div>
                    )}
                    {requestTab === "cache" && (
                      <div className="p-4 space-y-4">
                        <div className="text-sm text-muted-foreground">
                          When enabled, the proxy will attempt to serve a cached
                          version of this request if available. <br />
                          The cached response via the API is available only to
                          users on paid plans.
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="enableCache"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={config.enableCache}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                enableCache: e.target.checked,
                              }))
                            }
                          />
                          <label
                            htmlFor="enableCache"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Enable cached response
                          </label>
                        </div>
                      </div>
                    )}
                    {requestTab === "region" && (
                      <div className="p-4 space-y-4">
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground mb-4">
                            Select which proxy server region to use for your
                            requests.
                          </div>
                          <Select
                            value={config.region}
                            onValueChange={(value: string) =>
                              setConfig((prev) => ({
                                ...prev,
                                region: value as ProxyRegion,
                              }))
                            }
                          >
                            <SelectTrigger className="max-w-72">
                              <SelectValue placeholder="Select a region" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="auto">
                                  Auto: proxy.corsfix.com
                                </SelectItem>
                                <SelectItem value="ap">
                                  Asia Pacific: proxy-ap.corsfix.com
                                </SelectItem>
                                <SelectItem value="us">
                                  North America: proxy-us.corsfix.com
                                </SelectItem>
                                <SelectItem value="eu">
                                  Europe: proxy-eu.corsfix.com
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={50}
                className="min-h-[150px] text-sm"
              >
                <div className="h-full flex flex-col">
                  {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground animate-pulse">
                      Loading...
                    </div>
                  ) : response ? (
                    <>
                      <div className="p-4 space-y-4 flex-shrink-0">
                        <div className="flex items-center gap-4">
                          <Badge
                            variant={
                              response.status >= 200 && response.status < 300
                                ? "default"
                                : "destructive"
                            }
                          >
                            {response.status} {response.statusText}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            {response.time}ms •{" "}
                            {(response.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <div className="flex border-b">
                          {hasPreview && (
                            <button
                              className={`px-4 py-2 ${
                                responseTab === "preview"
                                  ? "border-b-2 border-primary"
                                  : ""
                              }`}
                              onClick={() => setResponseTab("preview")}
                            >
                              Preview
                            </button>
                          )}
                          <button
                            className={`px-4 py-2 ${
                              responseTab === "body"
                                ? "border-b-2 border-primary"
                                : ""
                            }`}
                            onClick={() => setResponseTab("body")}
                          >
                            Raw
                          </button>
                          <button
                            className={`px-4 py-2 ${
                              responseTab === "headers"
                                ? "border-b-2 border-primary"
                                : ""
                            }`}
                            onClick={() => setResponseTab("headers")}
                          >
                            Headers
                          </button>
                        </div>
                      </div>
                      <div className="flex-grow overflow-y-auto">
                        {responseTab === "body" && (
                          <div className="p-4">
                            <pre className="text-sm whitespace-pre-wrap">
                              {response.body}
                            </pre>
                          </div>
                        )}
                        {responseTab === "preview" && (
                          <div className="p-4 h-full">
                            {isHtmlResponse && (
                              <iframe
                                srcDoc={response.body}
                                className="w-full h-full border rounded bg-white"
                                sandbox="allow-same-origin"
                                title="HTML Preview"
                              />
                            )}
                            {isImageResponse && (
                              <img
                                src={response.blobUrl}
                                alt="Response Preview"
                                className="max-w-full max-h-full object-contain mx-auto"
                              />
                            )}
                            {isVideoResponse && (
                              <video
                                src={response.blobUrl}
                                controls
                                className="max-w-full max-h-full mx-auto"
                              >
                                Your browser does not support the video tag.
                              </video>
                            )}
                          </div>
                        )}
                        {responseTab === "headers" && (
                          <div className="p-4 space-y-2">
                            {Object.entries(response.headers).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="grid grid-cols-2 gap-4"
                                >
                                  <div className="font-mono text-sm">{key}</div>
                                  <div className="font-mono text-sm">
                                    {value}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      Send a request to see the response
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
      </div>

      {/* Example Dialog */}
      <Dialog open={showExampleDialog} onOpenChange={setShowExampleDialog}>
        <DialogContent className="sm:max-w-md mx-1">
          <DialogHeader>
            <DialogTitle>{selectedPreset?.name}</DialogTitle>
            <DialogDescription>{selectedPreset?.description}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {selectedPreset?.explanation}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExampleDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-umami-event={`playground-apply-example-${selectedPreset?.id}`}
              onClick={confirmApplyPreset}
            >
              Apply Example
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}
