import type { Metadata } from "next";
import "@fontsource-variable/inter";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast-provider";
import { ProductFeaturesProvider } from "@/components/product-features-provider";
import { getProductFeatures } from "@/server/config/product-mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "Board Game Collection",
  description: "Personal collection manager built around Item.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <ToastProvider>
          <ProductFeaturesProvider features={getProductFeatures()}>
            <AppShell>{children}</AppShell>
          </ProductFeaturesProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
