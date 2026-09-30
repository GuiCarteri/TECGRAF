import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth-policy";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const p = await searchParams;
  redirect(
    "/login?mode=register&next=" +
      encodeURIComponent(safeNext(p.next || "/account")),
  );
}
