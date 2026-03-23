import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Cap at 5 connections per Cloud Run instance; db-f1-micro supports ~25 total.
  // With up to 4 instances this leaves headroom for migrations and the harvester.
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
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
