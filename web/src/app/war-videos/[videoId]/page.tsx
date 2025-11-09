import { prisma } from '@cerebro/core/services/prismaService';
import { notFound } from 'next/navigation';
import WarVideoDisplay from './WarVideoDisplay';

export default async function WarVideoPage(props: any) {
  const { params, searchParams } = props;
  // TODO: Replace this with a proper authentication mechanism
  const isAdmin = searchParams.admin === 'true';

  const { videoId } = params;

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
