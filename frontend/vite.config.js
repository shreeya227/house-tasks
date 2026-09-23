import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Talk to Spring Boot in development without CORS headaches.
    proxy: { "/api": "http://localhost:8080" },
  },
});
