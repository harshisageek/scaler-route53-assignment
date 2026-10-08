'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api/errors';
import { useDemoSignIn, useSignIn, useSignUp } from './api';
import { SIGN_IN_PATH, SIGN_UP_PATH, safeNextPath } from './redirect';

export type AuthMode = 'signin' | 'signup';

const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validate(
  mode: AuthMode,
  email: string,
  password: string,
  confirmPassword: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Enter your password.';
  else if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;

  if (mode === 'signup' && password !== confirmPassword)
    errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

const COPY = {
  signin: {
    title: 'Sign in',
    description: 'Sign in to manage your hosted zones.',
    submit: 'Sign in',
    switchPrompt: 'New here?',
    switchLink: 'Create an account',
    switchHref: SIGN_UP_PATH,
  },
  signup: {
    title: 'Create an account',
    description: 'Each account gets its own isolated set of hosted zones.',
    submit: 'Create account',
    switchPrompt: 'Already have an account?',
    switchLink: 'Sign in',
    switchHref: SIGN_IN_PATH,
  },
} as const;

export function AuthForm({ mode, next }: { mode: AuthMode; next?: string }) {
  const router = useRouter();
  const signIn = useSignIn();
  const signUp = useSignUp();
  const demo = useDemoSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();

  const copy = COPY[mode];
  const busy = signIn.isPending || signUp.isPending || demo.isPending;

  const onSignedIn = () => router.replace(safeNextPath(next));

  const onError = (error: Error) => {
    if (error instanceof ApiError && error.code === 'EmailAlreadyRegistered') {
      setFieldErrors({ email: error.message });
      return;
    }
    setFormError(error.message);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(undefined);
    const errors = validate(mode, email, password, confirmPassword);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const body = { email: email.trim(), password };
    const mutation = mode === 'signin' ? signIn : signUp;
    mutation.mutate(body, { onSuccess: onSignedIn, onError });
  };

  const tryDemo = () => {
    setFormError(undefined);
    demo.mutate(undefined, { onSuccess: onSignedIn, onError });
  };

  const followSwitch = (event: CustomEvent<{ href?: string }>) => {
    event.preventDefault();
    router.push(copy.switchHref);
  };

  return (
    <form onSubmit={submit} noValidate>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              formAction="none"
              onClick={tryDemo}
              loading={demo.isPending}
              disabled={busy}
            >
              Try the demo
            </Button>
            <Button
              variant="primary"
              formAction="submit"
              loading={signIn.isPending || signUp.isPending}
              disabled={busy}
            >
              {copy.submit}
            </Button>
          </SpaceBetween>
        }
        errorText={formError}
        errorIconAriaLabel="Error"
      >
        <Container
          header={
            <Header variant="h1" description={copy.description}>
              {copy.title}
            </Header>
          }
        >
          <SpaceBetween size="l">
            <FormField label="Email address" errorText={fieldErrors.email}>
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={({ detail }) => setEmail(detail.value)}
                autoFocus
              />
            </FormField>
            <FormField
              label="Password"
              constraintText={
                mode === 'signup'
                  ? `At least ${MIN_PASSWORD_LENGTH} characters.`
                  : undefined
              }
              errorText={fieldErrors.password}
            >
              <Input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={({ detail }) => setPassword(detail.value)}
              />
            </FormField>
            {mode === 'signup' && (
              <FormField label="Confirm password" errorText={fieldErrors.confirmPassword}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={({ detail }) => setConfirmPassword(detail.value)}
                />
              </FormField>
            )}
            {mode === 'signin' && (
              <Alert type="info">
                The demo account is shared and its sample data resets daily.
              </Alert>
            )}
            <Box>
              {copy.switchPrompt}{' '}
              <Link href={copy.switchHref} onFollow={followSwitch}>
                {copy.switchLink}
              </Link>
            </Box>
          </SpaceBetween>
        </Container>
      </Form>
    </form>
  );
}
