'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { ChampionCombobox } from '@/components/ChampionCombobox';
import { MultiChampionCombobox } from '@/components/MultiChampionCombobox';
import { MemoizedSelect } from '@/components/MemoizedSelect';
import { Swords, Shield, Skull, UploadCloud } from 'lucide-react';
import { ChampionImages } from '@/types/champion';
import { getChampionImageUrl } from '@/lib/championHelper';
import { cn } from '@/lib/utils';

// Define types for props
interface Champion {
  id: number;
  name: string;
  images: ChampionImages;
  abilities: { ability: { name: string } }[];
}

interface WarNode {
  id: number;
  nodeNumber: number;
  description?: string;
}

interface Player {
  id: string;
  ingameName: string;
}

interface WarVideoFormProps {
  token: string;
  initialChampions: Champion[];
  initialNodes: WarNode[];
  initialPlayers: Player[];
  initialUserId: string;
}

export function WarVideoForm({
  token,
  initialChampions,
  initialNodes,
  initialPlayers,
  initialUserId,
}: WarVideoFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Form state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [attackerId, setAttackerId] = useState<string>('');
  const [defenderId, setDefenderId] = useState<string>('');
  const [nodeId, setNodeId] = useState<string>('');
  const [prefightChampionIds, setPrefightChampionIds] = useState<string[]>([]);
  const [season, setSeason] = useState<string>('');
  const [warNumber, setWarNumber] = useState<string>('');
  const [warTier, setWarTier] = useState<string>('');
  const [death, setDeath] = useState<boolean>(false);
  const [playerInVideoId, setPlayerInVideoId] = useState<string>(initialUserId);
  const [visibility, setVisibility] = useState<"public" | "alliance">('public');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Memoized derived data
  const prefightChampions = useMemo(() => {
    return initialChampions.filter((champ) =>
      champ.abilities?.some((link) => link.ability.name === 'Pre-Fight Ability')
    );
  }, [initialChampions]);

  const selectedAttacker = useMemo(() => initialChampions.find(c => String(c.id) === attackerId), [initialChampions, attackerId]);
  const selectedDefender = useMemo(() => initialChampions.find(c => String(c.id) === defenderId), [initialChampions, defenderId]);

  const nodeOptions = useMemo(() => initialNodes.map(node => ({
    value: String(node.id),
    label: `Node ${node.nodeNumber} ${node.description ? `(${node.description})` : ''}`
  })), [initialNodes]);

  const warNumberOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `War ${i + 1}`
  })), []);

  const warTierOptions = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    value: String(i + 1),
    label: `Tier ${i + 1}`
  })), []);

  const playerOptions = useMemo(() => initialPlayers.map(player => ({
    value: player.id,
    label: player.ingameName
  })), [initialPlayers]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !videoFile || !selectedAttacker || !selectedDefender || isSubmitting) return;
    setIsSubmitting(true);

    const autoTitle = `MCOC AW: S${season} W${warNumber} T${warTier} - ${selectedAttacker.name} vs ${selectedDefender.name}`;

    const formData = new FormData();
    formData.append('token', token);
    formData.append('videoFile', videoFile);
    formData.append('attackerId', attackerId);
    formData.append('defenderId', defenderId);
    formData.append('nodeId', nodeId);
    formData.append('season', season);
    formData.append('warNumber', warNumber);
    formData.append('warTier', warTier);
    formData.append('death', String(death));
    formData.append('visibility', visibility);
    formData.append('title', autoTitle);
    formData.append('description', description);
    if (playerInVideoId) formData.append('playerId', playerInVideoId);
    prefightChampionIds.forEach(id => formData.append('prefightChampionIds[]', id));

    try {
      const response = await fetch('/api/war-videos/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success!',
          description: result.message,
        });
        router.push(`/war-videos/${result.videoId}`);
      } else {
        const errorData = await response.json();
        toast({
          title: 'Upload Failed',
          description: errorData.error || 'An unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: 'Error',
        description: 'Network error or server unreachable.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [token, videoFile, selectedAttacker, selectedDefender, season, warNumber, warTier, death, visibility, description, playerInVideoId, prefightChampionIds, isSubmitting, router, toast]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label>Video File</Label>
        <div className="flex items-center gap-4 mt-2">
          <Label htmlFor="videoFile" className="cursor-pointer">
            <div className={cn(buttonVariants({ variant: "outline" }), "flex items-center gap-2")}>
              <UploadCloud className="h-5 w-5" />
              <span>Choose Video</span>
            </div>
          </Label>
          <Input id="videoFile" type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files ? e.target.files[0] : null)} required className="hidden" />
          {videoFile && <p className="text-sm text-muted-foreground">{videoFile.name}</p>}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 p-4 border rounded-lg bg-muted/20">
        <div className="flex flex-col items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-lg font-semibold text-red-500">
            <Swords className="h-6 w-6" />
            <h3>Attacker</h3>
          </div>
          <div className="flex items-center gap-2">
            {selectedAttacker && <Image src={getChampionImageUrl(selectedAttacker.images, '128', 'primary')} alt={selectedAttacker.name} width={50} height={50} className="rounded-full" />}
            <ChampionCombobox champions={initialChampions} value={attackerId} onSelect={setAttackerId} placeholder="Select attacker..." />
          </div>
        </div>
        <div className="font-bold text-2xl text-muted-foreground hidden md:block">VS</div>
        <hr className="w-full md:hidden" />
        <div className="flex flex-col items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-lg font-semibold text-blue-500">
            <Shield className="h-6 w-6" />
            <h3>Defender</h3>
          </div>
          <div className="flex items-center gap-2">
            {selectedDefender && <Image src={getChampionImageUrl(selectedDefender.images, '128', 'primary')} alt={selectedDefender.name} width={50} height={50} className="rounded-full" />}
            <ChampionCombobox champions={initialChampions} value={defenderId} onSelect={setDefenderId} placeholder="Select defender..." />
          </div>
        </div>
      </div>

      <div>
        <Label>Prefight Champions</Label>
        <MultiChampionCombobox
          champions={prefightChampions}
          selectedIds={prefightChampionIds}
          onSelectionChange={setPrefightChampionIds}
          placeholder="Select prefight champions..."
        />
      </div>

      <div>
        <Label htmlFor="node">War Node</Label>
        <MemoizedSelect
          value={nodeId}
          onValueChange={setNodeId}
          placeholder="Select war node"
          options={nodeOptions}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="season">Season</Label>
          <Input id="season" type="text" inputMode="numeric" pattern="[0-9]*" value={season} onChange={(e) => setSeason(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="warNumber">War Number</Label>
          <MemoizedSelect
            value={warNumber}
            onValueChange={setWarNumber}
            placeholder="Select number..."
            options={warNumberOptions}
            required
          />
        </div>
        <div>
          <Label htmlFor="warTier">War Tier</Label>
          <MemoizedSelect
            value={warTier}
            onValueChange={setWarTier}
            placeholder="Select tier..."
            options={warTierOptions}
            required
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="death" checked={death} onCheckedChange={(checked) => setDeath(Boolean(checked))} />
        <div className="flex items-center gap-2">
          <Skull className="h-5 w-5 text-muted-foreground" />
          <Label htmlFor="death">Attacker Died?</Label>
        </div>
      </div>

      <div>
        <Label htmlFor="playerInVideo">Player in Video</Label>
        <MemoizedSelect
          value={playerInVideoId}
          onValueChange={setPlayerInVideoId}
          placeholder="Select player..."
          options={playerOptions}
        />
      </div>

      <div>
        <Label>Visibility</Label>
        <RadioGroup value={visibility} onValueChange={(value: "public" | "alliance") => setVisibility(value)} className="flex space-x-4 mt-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="public" id="public" />
            <Label htmlFor="public">Public</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="alliance" id="alliance" />
            <Label htmlFor="alliance">Alliance Only</Label>
          </div>
        </RadioGroup>
      </div>

      <div>
        <Label htmlFor="description">Video Description (Optional)</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add any relevant details about the fight, prefights used, etc." />
      </div>

      <Button type="submit" disabled={isSubmitting || !token || !videoFile}>
        {isSubmitting ? 'Uploading...' : 'Upload Video'}
      </Button>
    </form>
  );
}
