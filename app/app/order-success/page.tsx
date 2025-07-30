import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { Polar } from "@polar-sh/sdk";
import { redirect } from "next/navigation";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Order Success | Corsfix Dashboard",
};

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const checkoutId = (await searchParams).checkout_id as string;

  if (!checkoutId) {
    redirect("/");
  }

  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
    server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
  });

  const checkout = await polar.checkouts.get({
    id: checkoutId as string,
  });

  const orderData = {
    plan: checkout.product.name,
    status: "Active",
    date: checkout.createdAt,
    total: (checkout.amount ?? 0) / 100,
    orderId: checkout.id,
    email: checkout.customerEmail,
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] p-4">
      <div className="w-full max-w-2xl mx-auto">
        <Card className="w-full">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-24 w-24 text-green-500" />
            </div>
            <CardTitle className="text-3xl font-bold">
              Thank you for your purchase!
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              Your {orderData.plan} subscription is now active.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Status</TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full">
                      {orderData.status}
                    </span>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Date</TableCell>
                  <TableCell className="text-right">
                    {orderData.date.toUTCString()}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Total Payment</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      currencyDisplay: "code",
                    }).format(orderData.total)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Order ID</TableCell>
                  <TableCell className="text-right">
                    {orderData.orderId}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Email</TableCell>
                  <TableCell className="text-right">
                    {orderData.email}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="flex justify-center pt-4">
              <Link href="/" className="w-full sm:w-auto">
                <Button
                  className="w-full sm:w-auto"
                  size="lg"
                  data-umami-event="order-success-dashboard"
                >
                  Continue to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <Script id="track-convert">{`gtag('event', 'conversion', {
      'send_to': 'AW-16729025633/b04yCJPb6MAaEOHYgqk-',
      'value': ${orderData.total},
      'currency': 'USD',
      'transaction_id': '${orderData.orderId}'
  });`}</Script>
    </div>
  );
}
