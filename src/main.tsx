import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SpotlightApp from "./SpotlightApp";
import "./index.css"; 
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
const appWindow = getCurrentWebviewWindow()

// 获取窗口 Label
const label = appWindow.label;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* 根据 Label 渲染不同界面 */}
    {label === 'spotlight' ? <SpotlightApp /> : <App />}
  </React.StrictMode>
);