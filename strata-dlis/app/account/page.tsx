import { Shell } from "@/components/strata/shell";
import { Account } from "@/components/strata/account";
import { requireIdentity } from "@/lib/server/session";
import { profileForIdentity } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  return <Protected params={p} />;
}
async function Protected({ params }: { params: Record<string, string> }) {
  const next =
    "/account" +
    (params.file ? "?file=" + encodeURIComponent(params.file) : "");
  const user = await profileForIdentity(await requireIdentity(next));
  return (
    <Shell active="account" initialUser={user}>
      <Account initialUser={user} />
    </Shell>
  );
}
