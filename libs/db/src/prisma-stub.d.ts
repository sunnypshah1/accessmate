// Minimal Prisma Client stub so TypeScript succeeds before prisma generate runs.
declare module '@prisma/client' {
  export class PrismaClient {
    constructor(...args: any[]);
    $disconnect(): Promise<void>;
    $connect(): Promise<void>;
    [model: string]: any;
  }
}
