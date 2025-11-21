import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChampionCombobox } from '@/components/ChampionCombobox';
import { MultiChampionCombobox } from '@/components/MultiChampionCombobox';
import { NodeCombobox } from '@/components/NodeCombobox';
import { Swords, Shield, Skull, Diamond, X, UploadCloud, Link } from 'lucide-react';
import { getChampionImageUrl } from '@/lib/championHelper';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { WarNode } from '@prisma/client';
import { getChampionClassColors } from '@/lib/championClassHelper';
import { Champion } from '@/types/champion';
import { Input } from './ui/input';

export interface FightData {
  id: string;
  nodeId: string;
  attackerId: string;
  defenderId: string;
  prefightChampionIds: string[];
  death: boolean;
  videoFile?: File | null;
  videoUrl?: string;
  battlegroup?: number;
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
  sourceMode: 'upload' | 'link';
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
  sourceMode,
}: FightBlockProps) {
  const [nodeId, setNodeId] = useState(fight.nodeId);
  const [attackerId, setAttackerId] = useState(fight.attackerId);
  const [defenderId, setDefenderId] = useState(fight.defenderId);
  const [prefightChampionIds, setPrefightChampionIds] = useState(fight.prefightChampionIds);
  const [death, setDeath] = useState(fight.death);
  const [videoFile, setVideoFile] = useState<File | null>(fight.videoFile || null);
  const [videoUrl, setVideoUrl] = useState<string>(fight.videoUrl || '');

  useEffect(() => {
    onFightChange({
      id: fight.id,
      battlegroup: fight.battlegroup,
      nodeId,
      attackerId,
      defenderId,
      prefightChampionIds,
      death,
      videoFile,
      videoUrl,
    });
  }, [nodeId, attackerId, defenderId, prefightChampionIds, death, videoFile, videoUrl, fight.id, fight.battlegroup, onFightChange]);

  const selectedAttacker = useMemo(() => initialChampions.find(c => String(c.id) === attackerId), [initialChampions, attackerId]);
  const selectedDefender = useMemo(() => initialChampions.find(c => String(c.id) === defenderId), [initialChampions, defenderId]);

  return (
    <div className={cn(
      "glass rounded-xl border border-slate-800/50 p-3 sm:p-6 relative transition-all hover:border-slate-700/50",
      death && "border-red-500/30 bg-red-500/5"
    )}>
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          onClick={() => onRemove(fight.id)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Remove fight</span>
        </Button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Label htmlFor={`node-${fight.id}`} className="text-base font-semibold text-white">Node</Label>
          <NodeCombobox
            nodes={initialNodes}
            value={nodeId}
            onSelect={setNodeId}
            placeholder="Select..."
          />
          {fight.battlegroup && (
            <span className="bg-sky-500/10 text-sky-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-sky-500/20">
              BG {fight.battlegroup}
            </span>
          )}
        </div>

        {uploadMode === 'multiple' && (
          <div className="flex items-center gap-2">
            {sourceMode === 'upload' ? (
              <>
                <Label htmlFor={`videoFile-${fight.id}`} className="cursor-pointer flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                  <UploadCloud className="h-5 w-5" />
                  <span>{videoFile ? videoFile.name : 'Choose Video'}</span>
                </Label>
                <Input id={`videoFile-${fight.id}`} type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files ? e.target.files[0] : null)} required className="hidden" />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5 text-slate-400" />
                <Input
                  id={`videoUrl-${fight.id}`}
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="max-w-xs bg-slate-900/50 border-slate-700/50"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Checkbox id={`death-${fight.id}`} checked={death} onCheckedChange={(checked) => setDeath(Boolean(checked))} />
          <div className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-red-400" />
            <Label htmlFor={`death-${fight.id}`} className="text-sm text-slate-300">Attacker Died?</Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[65%,35%] gap-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 p-4 rounded-xl bg-slate-900/30 border border-slate-800/50">
          <div className="flex flex-col items-center gap-3 w-full min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <Swords className="h-5 w-5 text-sky-400" />
              <h3>Attacker</h3>
            </div>
            <div className="flex items-center gap-3 w-full">
              {selectedAttacker && <Image src={getChampionImageUrl(selectedAttacker.images, '128', 'primary')} alt={selectedAttacker.name} width={50} height={50} className={cn("rounded-full", getChampionClassColors(selectedAttacker?.class).border)} />}
              <ChampionCombobox champions={initialChampions} value={attackerId} onSelect={setAttackerId} placeholder="Select attacker..." className={getChampionClassColors(selectedAttacker?.class).text} />
            </div>
          </div>
          <div className="font-bold text-2xl text-slate-600 hidden md:block">VS</div>
          <hr className="w-full md:hidden border-slate-700/50" />
          <div className="flex flex-col items-center gap-3 w-full min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <Shield className="h-5 w-5 text-indigo-400" />
              <h3>Defender</h3>
            </div>
            <div className="flex items-center gap-3 w-full">
              {selectedDefender && <Image src={getChampionImageUrl(selectedDefender.images, '128', 'primary')} alt={selectedDefender.name} width={50} height={50} className={cn("rounded-full", getChampionClassColors(selectedDefender?.class).border)} />}
              <ChampionCombobox champions={initialChampions} value={defenderId} onSelect={setDefenderId} placeholder="Select defender..." className={getChampionClassColors(selectedDefender?.class).text} />
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/50">
          <div className="flex items-center gap-2 mb-3">
            <Diamond className="h-5 w-5 text-pink-400" />
            <h3 className="text-sm font-semibold text-white">Prefight Champions</h3>
          </div>
          <MultiChampionCombobox
            champions={prefightChampions}
            selectedIds={prefightChampionIds}
            onSelectionChange={setPrefightChampionIds}
            placeholder="Select active prefights..."
          />
        </div>
      </div>
    </div>
  );
}