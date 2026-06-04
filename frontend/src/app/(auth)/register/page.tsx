'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/shared/PageHeader';

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ name, email, password }: FormValues) => {
    setLoading(true);
    setError('');
    try {
      await registerUser(name, email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create account</CardTitle>
        <CardDescription>Start reviewing PRs with AI</CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" className="mt-1.5" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-[#f85149] mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" className="mt-1.5" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-xs text-[#f85149] mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" className="mt-1.5" {...form.register('password')} />
            {form.formState.errors.password && (
              <p className="text-xs text-[#f85149] mt-1">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              className="mt-1.5"
              {...form.register('confirmPassword')}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-xs text-[#f85149] mt-1">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-[#f85149]">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner /> : 'Create account'}
          </Button>
        </form>
        <p className="text-sm text-center mt-4 text-gh-text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-gh-blue-muted hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
