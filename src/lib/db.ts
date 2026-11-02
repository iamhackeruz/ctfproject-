import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertEnvSecrets } from "./security/env-validator";

assertEnvSecrets();

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://cyberedu:cyberedu_secret_pass_2026@127.0.0.1:5433/cyberedu?schema=public";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
