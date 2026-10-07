import type { Metadata } from 'next';
import '@cloudscape-design/global-styles/index.css';
import './globals.css';
import { AppProviders } from '@/app/providers';

export const metadata: Metadata = {
  title: 'Route 53 Management Console',
  description: 'Manage hosted zones and DNS records.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
