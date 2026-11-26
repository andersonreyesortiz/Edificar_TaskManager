import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} · Gestión de tareas`,
  applicationName: APP_NAME,
  description: "Tableros, tareas, responsables y registro de tiempos para el equipo de Edificar.",
  manifest: "/manifest.webmanifest",
};

export const viewport = { themeColor: "#00A0E3" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
