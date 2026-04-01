import type { NextConfig } from "next";

function getHostname(value?: string | null): string | null {
  if (!value) return null;

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

const imageHostnames = Array.from(
  new Set(
    [
      getHostname(process.env.NEXT_PUBLIC_SUPABASE_URL),
      getHostname(process.env.SUPABASE_URL),
      "localhost",
      "127.0.0.1",
    ].filter((value): value is string => Boolean(value))
  )
);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: imageHostnames.map((hostname) => {
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  return {
    protocol: isLocal ? "http" : "https",
    hostname,
  };
}),
  },
};

export default nextConfig;