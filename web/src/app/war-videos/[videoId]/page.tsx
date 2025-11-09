import { prisma } from '@cerebro/core/services/prismaService';
import { notFound } from 'next/navigation';
import WarVideoDisplay from './WarVideoDisplay';

export const dynamic = 'force-dynamic';

export default async function WarVideoPage({
  params,
  searchParams,
}: {
  params: { videoId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // TODO: Replace this with a proper authentication mechanism
  const resolvedSearchParams = await (searchParams as any);
  const isAdmin = resolvedSearchParams.admin === 'true';

  const resolvedParams = await (params as any);
  const { videoId } = resolvedParams;

  if (!videoId) {
    notFound();
  }

  const warVideo = await prisma.warVideo.findUnique({
    where: { id: videoId },
    include: {
      attacker: true,
      defender: true,
      node: true,
      player: true,
      submittedBy: true,
    },
  });

  if (!warVideo) {
    notFound();
  }

  return <WarVideoDisplay warVideo={warVideo} isAdmin={isAdmin} />;
}
