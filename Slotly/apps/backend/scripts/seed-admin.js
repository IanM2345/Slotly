// CommonJS version, no path aliases
const { PrismaClient } = require("../src/generated/prisma"); // <-- relative path
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "keslolty@gmail.com";
  const raw = process.env.SEED_ADMIN_PASSWORD || "BLITH@2025";

  // hash password
  const password = await bcrypt.hash(raw, 10);

  // upsert admin (idempotent)
  const admin = await prisma.user.upsert({
    where: { email },
    update: {}, // no changes on rerun
    create: {
      email,
      password,
      role: "ADMIN",        // or "SUPER_ADMIN" if you prefer
      name: "Sudo Admin",
    },
  });

  console.log("✅ Admin seeded:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
