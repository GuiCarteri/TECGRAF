import { Shell } from "@/components/strata/shell";
import { Viewer } from "@/components/strata/viewer";
import { requireChatGPTUser, chatGPTSignInPath } from "@/app/chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  return (
    <Shell active="viewer">
      <Protected params={p} />
    </Shell>
  );
}
async function Protected({ params }: { params: Record<string, string> }) {
  const next =
    "/viewer" + (params.file ? "?file=" + encodeURIComponent(params.file) : "");
  await requireChatGPTUser(next);
  return <Viewer {...params} />;
}
