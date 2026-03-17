import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "../components/layouts";
import { ProtectedRoute } from "../components/ProtectedRoute.jsx";
import { SettingsProvider } from "../contexts/SettingsContext.jsx";
import {
  Dashboard,
  Login,
  Clients,
  Inventario,
  Ventas,
  Servicios,
  Historial,
  Expenses,
  Reports,
  Settings,
} from "../pages";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <SettingsProvider>
          <Layout />
        </SettingsProvider>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "inventario", element: <Inventario /> },
      { path: "ventas", element: <Ventas /> },
      { path: "servicios", element: <Servicios /> },
      { path: "clientes", element: <Clients /> },
      { path: "historial", element: <Historial /> },
      { path: "egresos", element: <Expenses /> },
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <Settings /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
