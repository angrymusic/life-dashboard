import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth";
import prisma from "@/server/prisma";
import { jsonError } from "@/server/api-response";

const adminRoles = new Set(["parent", "admin"]);

export function isAdminRole(role: string | null | undefined) {
  if (!role) return false;
  return adminRoles.has(role);
}

type RequestContext = {
  session: Awaited<ReturnType<typeof getServerSession>>;
  email: string | null;
  user: Awaited<ReturnType<typeof prisma.user.findUnique>>;
  userId: string | null;
};

export async function createRequestContext(): Promise<RequestContext> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  return { session, email, user, userId: user?.id ?? null };
}

type AuthContext = {
  session: RequestContext["session"];
  email: string;
  user: NonNullable<RequestContext["user"]>;
  userId: string;
};

type RequireUserResult =
  | { ok: true; context: AuthContext }
  | { ok: false; response: ReturnType<typeof jsonError> };

export async function requireUser(): Promise<RequireUserResult> {
  const context = await createRequestContext();
  if (!context.user || !context.userId || !context.email) {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }
  return {
    ok: true,
    context: {
      session: context.session,
      email: context.email,
      user: context.user,
      userId: context.userId,
    },
  };
}
