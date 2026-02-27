import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
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
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}
