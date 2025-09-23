import { Metadata } from "next";
import { IS_CLOUD } from "@/config/constants";
import Playground from "@/components/Playground";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playground | Corsfix Dashboard",
};
export default function PlaygroundPage() {
  return (
    <Playground isCloud={IS_CLOUD} domain={process.env.DOMAIN as string} />
  );
}
