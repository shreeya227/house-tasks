"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/client/push";

// The app reads the sign-in from localStorage, which only exists in the browser,
// so it is rendered on the client only. The page itself is a static shell.
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <div className="wrap">
      <p className="muted">Loading…</p>
    </div>
  ),
});

export default function ClientApp() {
  useEffect(() => {
    registerServiceWorker().catch((e) => console.warn("Service worker not registered", e));
  }, []);
  return <App />;
}
