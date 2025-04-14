import { PrismaClient } from '@prisma/client';
import { isDevelopment, isProduction } from '../config/environment';

// Add prisma to the NodeJS global type
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create a singleton PrismaClient instance
export const prisma = global.prisma || new PrismaClient({
  log: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
});

// Prevent multiple instances of Prisma Client in development
if (!isProduction) {
  global.prisma = prisma;
}
