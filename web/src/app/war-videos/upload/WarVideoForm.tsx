'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { MemoizedSelect } from '@/components/MemoizedSelect';
import { FightBlock, FightData } from '@/components/FightBlock';
import { UploadCloud, Plus } from 'lucide-react';
import { ChampionImages } from '@/types/champion';
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
  const [fights, setFights] = useState<FightData[]>([
    { id: uuidv4(), nodeId: '', attackerId: '', defenderId: '', prefightChampionIds: [], death: false },
  ]);
  const [season, setSeason] = useState<string>('');
  const [warNumber, setWarNumber] = useState<string>('');
  const [warTier, setWarTier] = useState<string>('');
  const [playerInVideoId, setPlayerInVideoId] = useState<string>(initialUserId);
  const [visibility, setVisibility] = useState<"public" | "alliance">('public');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isOffseason, setIsOffseason] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Memoized derived data
  const prefightChampions = useMemo(() => {
    return initialChampions.filter((champ) =>
      champ.abilities?.some((link) => link.ability.name === 'Pre-Fight Ability')
    );
  }, [initialChampions]);

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

  const handleFightChange = useCallback((updatedFight: FightData) => {
    setFights(prevFights =>
      prevFights.map(fight => (fight.id === updatedFight.id ? updatedFight : fight))
    );
  }, []);

  const handleAddFight = useCallback(() => {
    setFights(prevFights => [
      ...prevFights,
      { id: uuidv4(), nodeId: '', attackerId: '', defenderId: '', prefightChampionIds: [], death: false },
    ]);
  }, []);

  const handleRemoveFight = useCallback((fightId: string) => {
    setFights(prevFights => prevFights.filter(fight => fight.id !== fightId));
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!videoFile) newErrors.videoFile = 'Video file is required.';
    if (!season) newErrors.season = 'Season is required.';
    if (!isOffseason && !warNumber) newErrors.warNumber = 'War number is required.';
    if (!warTier) newErrors.warTier = 'War tier is required.';

    fights.forEach(fight => {
      if (!fight.attackerId) newErrors[`attackerId-${fight.id}`] = 'Attacker is required.';
      if (!fight.defenderId) newErrors[`defenderId-${fight.id}`] = 'Defender is required.';
      if (!fight.nodeId) newErrors[`nodeId-${fight.id}`] = 'War node is required.';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;
    setIsSubmitting(true);
    setUploadProgress(0);

    const fight = fights[0];
    const selectedAttacker = initialChampions.find(c => String(c.id) === fight.attackerId);
    const selectedDefender = initialChampions.find(c => String(c.id) === fight.defenderId);

    const autoTitle = `MCOC AW: S${season} W${isOffseason ? 'Offseason' : warNumber} T${warTier} - ${fights[0].attackerId} vs ${fights[0].defenderId}`;

    const formData = new FormData();
    formData.append('token', token);
    formData.append('videoFile', videoFile!);
    formData.append('season', season);
    if (!isOffseason) formData.append('warNumber', warNumber);
    formData.append('warTier', warTier);
    formData.append('visibility', visibility);
    formData.append('title', autoTitle);
    formData.append('description', description);
    if (playerInVideoId) formData.append('playerId', playerInVideoId);
    formData.append('fights', JSON.stringify(fights));

    try {
      const response = await axios.post('/api/war-videos/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total ?? 1));
          setUploadProgress(percentCompleted);
        },
      });

      if (response.status === 200) {
        const result = response.data;
        toast({
          title: 'Success!',
          description: result.message,
        });
        // Redirect to the first uploaded video
        if (result.videoIds && result.videoIds.length > 0) {
          router.push(`/war-videos/${result.videoIds[0]}`);
        } else {
          router.push('/war-videos');
        }
      } else {
        const errorData = response.data;
        toast({
          title: 'Upload Failed',
          description: errorData.error || 'An unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorDescription = error.response?.data?.error || 'Network error or server unreachable.';
      toast({
        title: 'Error',
        description: errorDescription,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [token, videoFile, fights, season, warNumber, warTier, visibility, description, playerInVideoId, isSubmitting, router, toast, isOffseason, initialChampions]);

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
        {errors.videoFile && <p className="text-sm text-red-500 mt-1">{errors.videoFile}</p>}
      </div>

      {fights.map((fight, index) => (
        <FightBlock
          key={fight.id}
          fight={fight}
          onFightChange={handleFightChange}
          onRemove={handleRemoveFight}
          canRemove={fights.length > 1}
          initialChampions={initialChampions}
          initialNodes={initialNodes}
          prefightChampions={prefightChampions}
        />
      ))}

      <Button type="button" variant="outline" onClick={handleAddFight}>
        <Plus className="mr-2 h-4 w-4" />
        Add Another Fight
      </Button>

            <div className="space-y-4 border rounded-lg p-4">

              <div className="flex justify-between items-center">

                <h3 className="text-lg font-medium">War Details</h3>

                <div className="flex items-center space-x-2">

                  <Checkbox id="isOffseason" checked={isOffseason} onCheckedChange={(checked) => setIsOffseason(Boolean(checked))} />

                  <Label htmlFor="isOffseason">Offseason</Label>

                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div>

                  <Label htmlFor="season">Season</Label>

                  <Input id="season" type="text" inputMode="numeric" pattern="[0-9]*" value={season} onChange={(e) => setSeason(e.target.value)} required />

                  {errors.season && <p className="text-sm text-red-500 mt-1">{errors.season}</p>}

                </div>

                <div>

                  <Label htmlFor="warNumber">War Number</Label>

                  <MemoizedSelect

                    value={warNumber}

                    onValueChange={setWarNumber}

                    placeholder="Select number..."

                    options={warNumberOptions}

                    required={!isOffseason}

                    disabled={isOffseason}

                    contentClassName="max-h-60 overflow-y-auto"

                  />

                  {errors.warNumber && <p className="text-sm text-red-500 mt-1">{errors.warNumber}</p>}

                </div>

                <div>

                  <Label htmlFor="warTier">War Tier</Label>

                  <MemoizedSelect

                    value={warTier}

                    onValueChange={setWarTier}

                    placeholder="Select tier..."

                    options={warTierOptions}

                    required

                    contentClassName="max-h-60 overflow-y-auto"

                  />

                  {errors.warTier && <p className="text-sm text-red-500 mt-1">{errors.warTier}</p>}

                </div>

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

      {isSubmitting && (
        <div className="space-y-2">
          <Label>Uploading...</Label>
          <Progress value={uploadProgress} />
        </div>
      )}

      <Button type="submit" disabled={isSubmitting || !token || !videoFile}>
        {isSubmitting ? 'Uploading...' : 'Upload Video'}
      </Button>
    </form>
  );
}
