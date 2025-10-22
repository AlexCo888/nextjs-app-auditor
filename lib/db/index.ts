import { prisma } from './prisma';

export async function upsertRepo(owner: string, name: string, ref?: string) {
  const existing = await prisma.repo.findFirst({ where: { owner, name, ref } });
  if (existing) return existing;
  return prisma.repo.create({ data: { owner, name, ref } });
}

export async function createScan(repoId: string, stats: any) {
  return prisma.scan.create({ data: { repoId, startedAt: new Date(), finishedAt: new Date(), stats } });
}
