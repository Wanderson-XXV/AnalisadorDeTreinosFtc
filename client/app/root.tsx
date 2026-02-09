// app/root.tsx
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { LinksFunction } from "react-router";
import "./styles/app.css";
import { SidebarProvider } from "./hooks/useSidebar";

export const links: LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico", type: "image/svg+xml" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <SidebarProvider>
      <Outlet />
    </SidebarProvider>
  );
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-500">Erro</h1>
        <p className="text-slate-400">Algo deu errado. Tente novamente.</p>
      </div>
    </div>
  );
}