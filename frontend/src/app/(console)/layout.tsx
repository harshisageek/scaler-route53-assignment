import type { ReactNode } from 'react';
import { ConsoleLayout } from '@/features/shell/ConsoleLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return <ConsoleLayout>{children}</ConsoleLayout>;
}
