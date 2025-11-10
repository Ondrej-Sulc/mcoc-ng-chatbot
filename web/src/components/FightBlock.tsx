import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChampionCombobox } from '@/components/ChampionCombobox';
import { MultiChampionCombobox } from '@/components/MultiChampionCombobox';
import { NodeCombobox } from '@/components/NodeCombobox';
import { Swords, Shield, Skull, Diamond, X, UploadCloud } from 'lucide-react';
import { getChampionImageUrl } from '@/lib/championHelper';
import { Button, buttonVariants } from './ui/button';
import { cn } from '@/lib/utils';
import { ChampionClass } from '@prisma/client';
import { getChampionClassColors } from '@/lib/championClassHelper';
import { Champion, ChampionImages } from '@/types/champion';
import { Input } from './ui/input';

interface WarNode {
  id: number;
  nodeNumber: number;
  description?: string;
}

export interface FightData {
  id: string;
  nodeId: string;
  attackerId: string;
  defenderId: string;
  prefightChampionIds: string[];
  death: boolean;
  videoFile?: File | null;
}

interface FightBlockProps {
  fight: FightData;
  onFightChange: (fight: FightData) => void;
  onRemove: (fightId: string) => void;
  canRemove: boolean;
  initialChampions: Champion[];
  initialNodes: WarNode[];
  prefightChampions: Champion[];
  uploadMode: 'single' | 'multiple';
}

export function FightBlock({
  fight,
  onFightChange,
  onRemove,
  canRemove,
  initialChampions,
  initialNodes,
  prefightChampions,
  uploadMode,
}: FightBlockProps) {
  const [nodeId, setNodeId] = useState(fight.nodeId);
  const [attackerId, setAttackerId] = useState(fight.attackerId);
  const [defenderId, setDefenderId] = useState(fight.defenderId);
  const [prefightChampionIds, setPrefightChampionIds] = useState(fight.prefightChampionIds);
  const [death, setDeath] = useState(fight.death);
  const [videoFile, setVideoFile] = useState<File | null>(fight.videoFile || null);

  useEffect(() => {
    onFightChange({
      id: fight.id,
      nodeId,
      attackerId,
      defenderId,
      prefightChampionIds,
      death,
      videoFile,
    });
  }, [nodeId, attackerId, defenderId, prefightChampionIds, death, videoFile, fight.id, onFightChange]);

  const selectedAttacker = useMemo(() => initialChampions.find(c => String(c.id) === attackerId), [initialChampions, attackerId]);
  const selectedDefender = useMemo(() => initialChampions.find(c => String(c.id) === defenderId), [initialChampions, defenderId]);

  return (
    <Card className={cn(
      "bg-muted/50 relative transition-colors",
      death && "border-red-500/75"
    )}>
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 z-10"
          onClick={() => onRemove(fight.id)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove fight</span>
        </Button>
      )}
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`node-${fight.id}`} className="text-lg font-semibold">Node</Label>
          <NodeCombobox
            nodes={initialNodes}
            value={nodeId}
            onSelect={setNodeId}
            placeholder="Select..."
          />
        </div>
        {uploadMode === 'multiple' && (
          <div className="flex items-center gap-2">
            <Label htmlFor={`videoFile-${fight.id}`} className="cursor-pointer flex items-center gap-2 text-sm font-medium">
              <UploadCloud className="h-5 w-5" />
              <span>{videoFile ? videoFile.name : 'Choose Video'}</span>
            </Label>
            <Input id={`videoFile-${fight.id}`} type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files ? e.target.files[0] : null)} required className="hidden" />
          </div>
        )}
        <div className="flex items-center space-x-2 justify-end">
          <Checkbox id={`death-${fight.id}`} checked={death} onCheckedChange={(checked) => setDeath(Boolean(checked))} />
          <div className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-muted-foreground" />
            <Label htmlFor={`death-${fight.id}`}>Attacker Died?</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <div className="grid grid-cols-1 lg:grid-cols-[65%,35%] gap-3">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-4 p-3 border rounded-lg bg-background">
            <div className="flex flex-col items-center gap-3 w-full min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Swords className="h-6 w-6" />
                <h3>Attacker</h3>
              </div>
              <div className="flex items-center gap-2 w-full">
                {selectedAttacker && <Image src={getChampionImageUrl(selectedAttacker.images, '128', 'primary')} alt={selectedAttacker.name} width={50} height={50} className={cn("rounded-full", getChampionClassColors(selectedAttacker?.class).border)} />}
                <ChampionCombobox champions={initialChampions} value={attackerId} onSelect={setAttackerId} placeholder="Select attacker..." className={getChampionClassColors(selectedAttacker?.class).text} />
              </div>
            </div>
            <div className="font-bold text-2xl text-muted-foreground hidden md:block">VS</div>
            <hr className="w-full md:hidden" />
            <div className="flex flex-col items-center gap-3 w-full min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold text-blue-500">
                <Shield className="h-6 w-6" />
                <h3>Defender</h3>
              </div>
              <div className="flex items-center gap-2 w-full">
                {selectedDefender && <Image src={getChampionImageUrl(selectedDefender.images, '128', 'primary')} alt={selectedDefender.name} width={50} height={50} className={cn("rounded-full", getChampionClassColors(selectedDefender?.class).border)} />}
                <ChampionCombobox champions={initialChampions} value={defenderId} onSelect={setDefenderId} placeholder="Select defender..." className={getChampionClassColors(selectedDefender?.class).text} />
              </div>
            </div>
          </div>
          <div className="p-3 border rounded-lg bg-background">
            <div className="flex items-center gap-2 mb-2">
              <Diamond className="h-5 w-5 text-muted-foreground" />
              <h3>Prefight Champions</h3>
            </div>
            <MultiChampionCombobox
              champions={prefightChampions}
              selectedIds={prefightChampionIds}
              onSelectionChange={setPrefightChampionIds}
              placeholder="Select active prefights..."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}