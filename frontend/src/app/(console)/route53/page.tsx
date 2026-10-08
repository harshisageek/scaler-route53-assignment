import { redirect } from 'next/navigation';
import { ROUTES } from '@/features/shell/navigation';

export default function Route53HomePage() {
  redirect(ROUTES.hostedZones);
}
