import { useCallback, useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

import Dashboard from "./pages/Dashboard";
import Forecast from "./pages/Forecast";
import RegimeAnalysis from "./pages/RegimeAnalysis";
import Verification from "./pages/Verification";
import Historical from "./pages/Historical";
import Landing from "./pages/Landing";

import { checkHealth } from "./api/api";
import MoEExplainer from "./pages/MoEExplainer";
import PostProcessing from "./pages/PostProcessing";

/*
 * Sidebar + Navbar exist ONLY inside this layout.
 * The landing page is outside the dashboard layout.
 */

function DashboardLayout({ health }) {
  const [menuOpen, setMenuOpen] =
    useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      <Sidebar
        open={menuOpen}
        onClose={() =>
          setMenuOpen(false)
        }
        health={health}
      />

      <div className="lg:ml-64">

        <Navbar
          health={health}
          onMenu={() =>
            setMenuOpen(true)
          }
        />

        <main className="p-4 sm:p-6 lg:p-8">

          <Outlet />

        </main>
      </div>
    </div>
  );
}

function App() {
  const [health, setHealth] =
    useState({
      status: "offline",
      mlModels: false,
    });

  const refresh = useCallback(() => {
    checkHealth()
      .then((result) => {
        setHealth(result);
      })
      .catch(() => {
        setHealth({
          status: "offline",
          mlModels: false,
        });
      });
  }, []);

  useEffect(() => {
    refresh();

    const id = setInterval(
      refresh,
      30000
    );

    return () =>
      clearInterval(id);
  }, [refresh]);

  return (
    <Routes>

      {/* =================================================
          LANDING PAGE
      ================================================= */}

      <Route
        path="/"
        element={<Landing />}
      />

      {/* =================================================
          DASHBOARD LAYOUT
      ================================================= */}

      <Route
        element={
          <DashboardLayout
            health={health}
          />
        }
      >

        <Route
          path="/dashboard"
          element={
            <Dashboard
              health={health}
            />
          }
        />

        <Route
          path="/forecast"
          element={<Forecast />}
        />

        <Route
          path="/regime"
          element={
            <RegimeAnalysis />
          }
        />

        <Route
          path="/verification"
          element={
            <Verification />
          }
        />

        <Route
          path="/historical"
          element={
            <Historical />
          }
        />
        
        <Route
          path="/moe-forecast"
          element={
            <MoEExplainer />
          }
        />

        <Route
        path="/post-processing"
        element={<PostProcessing />}
      />
        

      </Route>

      {/* =================================================
          FALLBACK
      ================================================= */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}

export default App;