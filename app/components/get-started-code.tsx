"use client";

import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GetStartedCodeProps {
  /** Proxy origin including scheme, e.g. https://proxy.corsfix.com */
  proxyUrl: string;
  /** Whether the SDK needs an explicit proxyUrl (self-hosted). */
  customProxy: boolean;
}

// The snippets are short and fixed, so tokens are colored by hand instead of
// pulling in a highlighter.
const C = ({ children }: { children: ReactNode }) => (
  <span className="text-muted-foreground">{children}</span>
);
const K = ({ children }: { children: ReactNode }) => (
  <span className="text-violet-600 dark:text-violet-400">{children}</span>
);
const S = ({ children }: { children: ReactNode }) => (
  <span className="text-emerald-600 dark:text-emerald-400">{children}</span>
);
const F = ({ children }: { children: ReactNode }) => (
  <span className="text-sky-600 dark:text-sky-400">{children}</span>
);
const T = ({ children }: { children: ReactNode }) => (
  <span className="text-rose-600 dark:text-rose-400">{children}</span>
);

const Snippet = ({ children }: { children: ReactNode }) => (
  <pre className="overflow-x-auto text-sm w-full border px-3 py-4 rounded-lg">
    <code>{children}</code>
  </pre>
);

export default function GetStartedCode({
  proxyUrl,
  customProxy,
}: GetStartedCodeProps) {
  // Self-hosted: the SDK needs to be pointed at the instance. Kept inline so
  // every snippet stays exactly four lines and the card never changes height.
  const proxyOption = customProxy ? (
    <>
      {", { corsfix: { proxyUrl: "}
      <S>&quot;{proxyUrl}&quot;</S>
      {" } }"}
    </>
  ) : null;

  return (
    <Tabs defaultValue="api" className="relative w-full">
      {/* Floats over the top-right corner of the code block. Each snippet
          keeps its first line short so nothing sits underneath the tabs. */}
      <TabsList className="absolute right-2 top-2 h-7 p-0.5">
        <TabsTrigger value="api" className="h-6 px-2 text-xs">
          API
        </TabsTrigger>
        <TabsTrigger value="cdn" className="h-6 px-2 text-xs">
          CDN
        </TabsTrigger>
        <TabsTrigger value="npm" className="h-6 px-2 text-xs">
          NPM
        </TabsTrigger>
      </TabsList>

      <TabsContent value="api" className="mt-0">
        <Snippet>
          <C>{"// Prefix the target URL"}</C>
          {"\n"}
          <K>const</K>
          {" url = "}
          <S>&quot;https://example.com&quot;</S>
          {";\n\n"}
          <K>const</K>
          {" response = "}
          <K>await</K> <F>fetch</F>
          {"("}
          <S>&quot;{proxyUrl}/?&quot;</S>
          {" + url);"}
        </Snippet>
      </TabsContent>

      <TabsContent value="cdn" className="mt-0">
        <Snippet>
          <C>{"<!-- Load from CDN -->"}</C>
          {"\n"}
          <T>{"<script"}</T>
          {" src="}
          <S>&quot;https://unpkg.com/corsfix&quot;</S>
          <T>{">"}</T>
          <T>{"</script>"}</T>
          {"\n\n"}
          <T>{"<script>"}</T>
          {"corsfix."}
          <F>fetch</F>
          {"("}
          <S>&quot;https://example.com&quot;</S>
          {proxyOption}
          {")."}
          <F>then</F>
          {"(console.log);"}
          <T>{"</script>"}</T>
        </Snippet>
      </TabsContent>

      <TabsContent value="npm" className="mt-0">
        <Snippet>
          <C>{"// npm install corsfix"}</C>
          {"\n"}
          <K>import</K>
          {" corsfix "}
          <K>from</K> <S>&quot;corsfix&quot;</S>
          {";\n\n"}
          <K>const</K>
          {" response = "}
          <K>await</K>
          {" corsfix."}
          <F>fetch</F>
          {"("}
          <S>&quot;https://example.com&quot;</S>
          {proxyOption}
          {");"}
        </Snippet>
      </TabsContent>


    </Tabs>
  );
}
