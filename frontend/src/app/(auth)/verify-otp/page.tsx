import { redirect } from "next/navigation";

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ auth: "verify-otp" });
  if (params.email) query.set("email", params.email);
  redirect(`/?${query.toString()}`);
}
