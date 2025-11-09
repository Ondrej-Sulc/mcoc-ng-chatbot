'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getChampionImageUrl } from '@/lib/championHelper';
import { Champion, WarNode, Player } from '@prisma/client';
import { Check, Trash } from 'lucide-react';

interface WarVideo {
  id: string;
  youtubeUrl: string;
  status: string;
  visibility: string;
  season: number;
  warTier: number;
  death: boolean;
  attacker: Champion;
  defender: Champion;
  node: WarNode;
  player: Player | null;
  submittedBy: Player;
  createdAt: Date;
}

interface WarVideoDisplayProps {
  warVideo: WarVideo;
  isAdmin: boolean;
}

function getYouTubeVideoId(url: string): string | null {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('v');
}

export default function WarVideoDisplay({ warVideo, isAdmin }: WarVideoDisplayProps) {
  const router = useRouter();
  const { toast } = useToast();
  const videoId = getYouTubeVideoId(warVideo.youtubeUrl);

  const handleApprove = async () => {
    const response = await fetch('/api/admin/war-videos/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: warVideo.id }),
    });

    if (response.ok) {
      toast({ title: 'Video Approved' });
      router.refresh();
    } else {
      const { error } = await response.json();
      toast({ title: 'Error', description: error, variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    const response = await fetch('/api/admin/war-videos/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: warVideo.id }),
    });

    if (response.ok) {
      toast({ title: 'Video Rejected' });
      router.push('/'); // Redirect to home after rejection
    } else {
      const { error } = await response.json();
      toast({ title: 'Error', description: error, variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{`MCOC AW: S${warVideo.season} W? T${warVideo.warTier} - ${warVideo.attacker.name} vs ${warVideo.defender.name}`}</CardTitle>
          <CardDescription>
            Submitted by {warVideo.submittedBy.ingameName} on {new Date(warVideo.createdAt).toISOString().split('T')[0]}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isAdmin && warVideo.status === 'PENDING' && (
            <div className="flex gap-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 text-white">
                <Check className="mr-2 h-4 w-4" /> Approve
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                <Trash className="mr-2 h-4 w-4" /> Reject
              </Button>
            </div>
          )}

          {videoId && (
            <div className="aspect-video">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-lg"
              ></iframe>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 p-4 border rounded-lg bg-muted/20">
            <div className="flex flex-col items-center gap-3">
              <h3 className="text-lg font-semibold text-red-500">Attacker</h3>
              <div className="flex items-center gap-2">
                <Image src={getChampionImageUrl(warVideo.attacker.images as any, '128', 'primary')} alt={warVideo.attacker.name} width={50} height={50} className="rounded-full" />
                <span>{warVideo.attacker.name}</span>
              </div>
            </div>
            <div className="font-bold text-2xl text-muted-foreground">VS</div>
            <div className="flex flex-col items-center gap-3">
              <h3 className="text-lg font-semibold text-blue-500">Defender</h3>
              <div className="flex items-center gap-2">
                <Image src={getChampionImageUrl(warVideo.defender.images as any, '128', 'primary')} alt={warVideo.defender.name} width={50} height={50} className="rounded-full" />
                <span>{warVideo.defender.name}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Season</p>
              <p className="font-semibold">{warVideo.season}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">War Tier</p>
              <p className="font-semibold">{warVideo.warTier}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Node</p>
              <p className="font-semibold">{warVideo.node.nodeNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Attacker Died?</p>
              <p className="font-semibold">{warVideo.death ? 'Yes' : 'No'}</p>
            </div>
          </div>

          <div className="flex justify-center gap-2">
            <Badge variant={warVideo.status === 'APPROVED' ? 'default' : 'secondary'}>{warVideo.status}</Badge>
            <Badge variant="outline">{warVideo.visibility}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
