import { defineConfig } from "prisma/config";

const dbUrl =
  process.env.DATABASE_URL ||
  "postgresql://cyberedu:cyberedu_secret_pass_2026@127.0.0.1:5433/cyberedu?schema=public";

const shadowDbUrl =
  process.env.SHADOW_DATABASE_URL ||
  "postgresql://cyberedu:cyberedu_secret_pass_2026@127.0.0.1:5433/cyberedu_shadow?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: dbUrl,
    shadowDatabaseUrl: shadowDbUrl,
  },
});
