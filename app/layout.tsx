import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEN · Sistema de Envasado",
  description: "Captura, programa y tablero del envasado de La Quinta.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
