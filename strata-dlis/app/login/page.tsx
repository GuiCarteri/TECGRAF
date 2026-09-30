import { LoginContent } from "@/components/auth/login-content";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  return <LoginContent p={await searchParams} />;
}
