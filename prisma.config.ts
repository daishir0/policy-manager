import path from "node:path";
import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export default defineConfig({
  schema: path.join(__dirname, "prisma/schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
