import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContentFlow - Generateur de contenu SaaS",
  description:
    "Transformez une URL en article, post LinkedIn, carousel et newsletter automatisee.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
