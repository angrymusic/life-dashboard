// /server/prisma.ts
import { PrismaClient } from "@prisma/client";

/**
 * Next dev(HMR)에서 PrismaClient가 여러 번 생성되면 커넥션이 폭증할 수 있어서
 * globalThis에 캐시하는 패턴(실무에서 흔히 쓰는 방식)으로 고정한다.
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
