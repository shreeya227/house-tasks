import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { registerServiceWorker } from "./push.js";
import "./styles.css";

registerServiceWorker().catch((e) => console.warn("Service worker not registered", e));

createRoot(document.getElementById("root")).render(<App />);
