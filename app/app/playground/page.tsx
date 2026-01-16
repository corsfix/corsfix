import { Metadata } from "next";
import { IS_CLOUD } from "@/config/constants";
import Playground from "@/components/Playground";
import { getProxyDomain } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playground | Corsfix Dashboard",
};
export default function PlaygroundPage() {
  return (
    <Playground isCloud={IS_CLOUD} proxyDomain={getProxyDomain()} />
  );
}
