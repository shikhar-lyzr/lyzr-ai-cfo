import { cookies } from "next/headers";

export async function getSession(): Promise<{ userId: string; email: string; name: string } | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("lyzr-session");

  if (!session?.value) return null;

  try {
    return JSON.parse(session.value);
  } catch {
    return null;
  }
}

export function createSessionCookie(userId: string, email: string, name: string): string {
  return JSON.stringify({ userId, email, name });
}
