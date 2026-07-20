import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowlyMail",
  description: "Répondez à vos clients en moins de 2 secondes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
