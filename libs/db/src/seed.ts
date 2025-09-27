import { prisma } from './index.js';

async function main() {
  const org = await prisma.org.upsert({
    where: { id: 'demo-org' },
    update: {},
    create: { id: 'demo-org', name: 'Demo Org', plan: 'pro' },
  });

  const project = await prisma.project.upsert({
    where: { id: 'demo-project' },
    update: {},
    create: {
      id: 'demo-project',
      orgId: org.id,
      name: 'Demo Storefront',
      repoFullName: 'demo/storefront',
      defaultBranch: 'main',
      framework: 'nextjs',
    },
  });

  await prisma.policy.upsert({
    where: { id: 'demo-policy' },
    update: {},
    create: {
      id: 'demo-policy',
      projectId: project.id,
      minContrast: 4.5,
      failOnSeverity: 'High',
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
