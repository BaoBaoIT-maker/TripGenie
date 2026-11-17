import { redirect } from 'next/navigation';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ auth: 'verify-email' });
  if (params.token) query.set('token', params.token);
  if (params.next) query.set('next', params.next);
  redirect(`/?${query.toString()}`);
}
