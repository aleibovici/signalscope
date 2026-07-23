import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Connections per app instance. The default suits a small Postgres server
 * shared by a few instances plus migrations and the harvester. Raise it via
 * DATABASE_POOL_MAX when your database allows more concurrent connections.
 */
const DEFAULT_POOL_MAX = 5;

function poolMax(): number {
  const parsed = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POOL_MAX;
}

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: poolMax() });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Creates a separate PrismaClient connected to DATABASE_URL_DEV.
 * Returns null if the env var isn't set. Used by the harvester to
 * mirror writes to the local dev database.
 */
export function createDevPrismaClient(): PrismaClient | null {
  const devUrl = process.env.DATABASE_URL_DEV;
  if (!devUrl) return null;

  const pool = new pg.Pool({ connectionString: devUrl });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);
  return new PrismaClient({ adapter });
}
