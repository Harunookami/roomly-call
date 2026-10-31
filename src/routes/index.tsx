import { BrowserRouter, Routes, Route } from "react-router-dom";

import NotFoundPage from "../pages/NotFoundPage";
import RoomPage from "../pages/RoomPage";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<RoomPage />}
        />
        <Route
          path="*"
          element={<NotFoundPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}
