type TransactionCallback<T> = (tx: typeof prisma) => Promise<T>;

export const prisma = {
  guidelineChunk: {
    findMany: async () => [] as unknown[],
    deleteMany: async () => {},
    create: async () => {},
  },
  $transaction: async <T>(callback: TransactionCallback<T>) => {
    return callback(prisma);
  },
};
