import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "./generated/prisma/client.js";

// Runtime queries use DATABASE_URL.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

/** The root client or an interactive-transaction client (`tx` in prisma.$transaction). */
export type Db = PrismaClient | Prisma.TransactionClient;
