import type { NextConfig } from "next";

const config: NextConfig = {
  // web-push and pg are Node libraries; keep them out of the bundler.
  serverExternalPackages: ["web-push", "pg"],
  async headers() {
    return [
      {
        // The service worker must never be cached, or a fix to it takes days to reach phones.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default config;
