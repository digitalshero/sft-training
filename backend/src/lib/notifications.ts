import { prisma } from './prisma';

export type NotificationModule = 'physical_visit' | 'prepare_cook' | 'certificate' | 'physical_visit_admin';

export async function createNotification(
  partnerId: string,
  moduleName: NotificationModule,
  bodySentence: string,
  comment?: string | null,
  referenceId?: string | null,
) {
  const trimmed = comment?.trim();
  const message = trimmed ? `${bodySentence}\n\nComment: "${trimmed}"` : bodySentence;
  await prisma.lpNotification
    .create({ data: { partnerId, moduleName, message, referenceId: referenceId ?? null } })
    .catch((e) => console.error('[notification] create failed', e));
}
