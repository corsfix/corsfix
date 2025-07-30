import { Metadata } from "next";
import Page from "./page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playground | Corsfix Dashboard",
};
export default function PageLayout() {
  return <Page />;
}
