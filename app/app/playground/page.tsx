import { Metadata } from "next";
import Playground from "@/components/Playground";
import { getProxyDomain } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playground | Corsfix Dashboard",
};
export default function PlaygroundPage() {
  return (
    <Playground proxyDomain={getProxyDomain()} />
  );
}
