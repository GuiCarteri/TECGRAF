import { Shell } from "@/components/strata/shell";
import { Publication } from "@/components/strata/publish";
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
    "/publish" +
    (params.file ? "?file=" + encodeURIComponent(params.file) : "");
  const user = await profileForIdentity(await requireIdentity(next));
  return (
    <Shell active="publish" initialUser={user}>
      <Publication initialUser={user} />
    </Shell>
  );
}
