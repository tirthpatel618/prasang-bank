export const metadata = {
  title: "Prasang Bank",
  description: "Browse prasangs and filter by topics",
};

import "../styles/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
