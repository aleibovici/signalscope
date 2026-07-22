import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { id: "user_1" },
    update: { passwordHash },
    create: {
      id: "user_1",
      // Local-only auth login id for the credentials provider (not a contact mailbox).
      email: "dev@localhost",
      name: "Default User",
      username: "signal_hawk_001",
      role: "admin",
      passwordHash,
    },
  });

  console.log("Seeded local login id:", user.email, "(password: password123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
