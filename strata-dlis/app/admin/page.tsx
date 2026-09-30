import { currentUser } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { Shell } from "@/components/strata/shell";
import { Admin } from "@/components/strata/admin";
import { requireIdentity } from "@/lib/server/session";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  return (
    <Shell active="admin">
      <Protected params={p} />
    </Shell>
  );
}
async function Protected({ params }: { params: Record<string, string> }) {
  const next =
    "/admin" + (params.file ? "?file=" + encodeURIComponent(params.file) : "");
  await requireIdentity(next);
  if ((await currentUser())?.role !== "admin") redirect("/account");
  return <Admin {...params} />;
}
