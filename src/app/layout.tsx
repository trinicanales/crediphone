import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-ui",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-data",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "CREDIPHONE - Sistema Administrativo",
  description: "Sistema administrativo completo para gestión de créditos y ventas",
  manifest: "/manifest.json",
  themeColor: "#0B1929",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CREDIPHONE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* __name es un helper de esbuild/Turbopack inyectado en el script inline de next-themes.
          Debe definirse antes de que el script de detección de tema corra. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: "var __name=(f,n)=>f;" }} />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
