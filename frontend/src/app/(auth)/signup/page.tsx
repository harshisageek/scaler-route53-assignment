import type { Metadata } from 'next';
import { AuthForm } from '@/features/auth/AuthForm';

export const metadata: Metadata = { title: 'Create an account | Route 53' };

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}
