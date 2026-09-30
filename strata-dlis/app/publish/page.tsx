import { Shell } from "@/components/strata/shell";
import { Publication } from "@/components/strata/publish";
import { requireIdentity } from "@/lib/server/session";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  return (
    <Shell active="publish">
      <Protected params={p} />
    </Shell>
  );
}
async function Protected({ params }: { params: Record<string, string> }) {
  const next =
    "/publish" +
    (params.file ? "?file=" + encodeURIComponent(params.file) : "");
  await requireIdentity(next);
  return <Publication {...params} />;
}
