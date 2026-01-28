import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MemoMobile from "@/components/features/memo/mobile/MemoMobile";
import FileMobile from "@/components/features/files/mobile/FileMobile";
import "./index.css";

const MobileApp = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Routes>
          <Route path="/mobile/memo" element={<MemoMobile />} />
          <Route path="/mobile/files" element={<FileMobile />} />
          <Route path="*" element={<Navigate to="/mobile/memo" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
);
