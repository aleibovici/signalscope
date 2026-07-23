import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "password123";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal", "db"]);

/**
 * The seed creates an admin account, so it refuses to run against anything that
 * isn't obviously a local database. Set SEED_ALLOW_REMOTE=1 to override — and
 * set SEED_ADMIN_PASSWORD if you do.
 */
function assertSafeTarget(url: string): void {
  if (process.env.SEED_ALLOW_REMOTE === "1") return;

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    console.error("DATABASE_URL is not a valid URL");
    process.exit(1);
  }

  if (!LOCAL_HOSTS.has(host)) {
    console.error(
      `Refusing to seed an admin user into non-local database host "${host}".\n` +
        "Set SEED_ALLOW_REMOTE=1 together with SEED_ADMIN_PASSWORD if this is intentional.",
    );
    process.exit(1);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }
  assertSafeTarget(databaseUrl);

  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
      where: { id: "user_1" },
      update: { passwordHash },
      create: {
        id: "user_1",
        // Local-only auth login id for the credentials provider (not a contact mailbox).
        email: process.env.SEED_ADMIN_EMAIL ?? "dev@localhost",
        name: "Default User",
        username: "signal_hawk_001",
        role: "admin",
        passwordHash,
      },
    });

    const shown = password === DEFAULT_PASSWORD ? ` (password: ${DEFAULT_PASSWORD})` : "";
    console.log(`Seeded local login id: ${user.email}${shown}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
