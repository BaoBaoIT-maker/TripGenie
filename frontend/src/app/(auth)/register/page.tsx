import { redirect } from "next/navigation";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ auth: "register" });
  if (params.next) query.set("next", params.next);
  redirect(`/?${query.toString()}`);
}
