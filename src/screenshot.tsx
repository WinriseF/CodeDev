import React from "react";
import ReactDOM from "react-dom/client";
import ScreenshotApp from "./ScreenshotApp";
import "./index.css"; // 复用全局样式（Tailwind等）

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ScreenshotApp />
  </React.StrictMode>
);