import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ auth: "login" });
  if (params.next) query.set("next", params.next);
  if (params.error) query.set("error", params.error);
  redirect(`/?${query.toString()}`);
}
