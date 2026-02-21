const fs = require('fs');
const path = require('path');

const layoutContent = `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "React Dashboard",
  description: "Performance Monitoring Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`;

const filePath = path.join(__dirname, 'src', 'app', 'layout.tsx');

try {
  fs.writeFileSync(filePath, layoutContent);
  console.log('Successfully wrote layout.tsx to ' + filePath);
} catch (error) {
  console.error('Error writing layout.tsx:', error);
  process.exit(1);
}
