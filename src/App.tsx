import { Routes, Route } from "react-router-dom";

import { MapPage } from "./routes/MapPage";
import { AdminPage } from "./routes/AdminPage";
import { BenchProbPage } from "./routes/BenchProbPage";
import { AuthCallbackPage } from "./routes/AuthCallbackPage";

export default function App() {
  return (
    <div className="h-dvh w-dvw bg-slate-950 text-slate-50">
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:tabKey" element={<AdminPage />} />
        <Route path="/ai/bench-prob" element={<BenchProbPage />} />
      </Routes>
    </div>
  );
}
