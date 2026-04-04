import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable webpack persistent cache to avoid filling disk during build in CI/VM
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack: (config: any) => {
    config.cache = false;
    return config;
  },
  images: {
    remotePatterns: [
      // Cloudflare R2 — público (pub-*.r2.dev y dominio propio)
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "storage.crediphone.com.mx",
      },
      // Supabase — compatibilidad con fotos existentes antes de la migración
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "ihvjjfsefnvcrczrcmhp.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
