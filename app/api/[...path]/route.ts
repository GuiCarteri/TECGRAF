import { handle } from "@/lib/server/handlers";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, (await context.params).path);
}
export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
