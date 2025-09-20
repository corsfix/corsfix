import { Metadata } from "next";
import Page from "./page";
import { IS_CLOUD } from "@/config/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playground | Corsfix Dashboard",
};
export default function PageLayout() {
  return <Page isCloud={IS_CLOUD} domain={process.env.DOMAIN as string} />;
}
