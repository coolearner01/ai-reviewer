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

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setError('');
    try {
      await login(values.email, values.password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign in</CardTitle>
        <CardDescription>Access your PR review dashboard</CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
          {error && <p className="text-sm text-[#f85149]">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner /> : 'Sign in'}
          </Button>
        </form>
        <p className="text-sm text-center mt-4 text-gh-text-muted">
          No account?{' '}
          <Link href="/register" className="text-gh-blue-muted hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
