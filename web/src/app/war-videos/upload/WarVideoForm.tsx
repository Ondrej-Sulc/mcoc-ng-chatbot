"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { MemoizedSelect } from "@/components/MemoizedSelect";
import { FightBlock, FightData } from "@/components/FightBlock";
import { UploadCloud, Plus } from "lucide-react";
import { Champion } from "@/types/champion";
import { cn } from "@/lib/utils";
import { War, WarFight, Player as PrismaPlayer, WarNode as PrismaWarNode } from '@prisma/client';

interface WarNode extends PrismaWarNode {}
interface Player extends PrismaPlayer {}

interface PreFilledFight extends WarFight {
  war: War;
  player: Player;
  attacker: Champion;
  defender: Champion;
  node: WarNode;
  prefightChampions: Champion[];
}

interface WarVideoFormProps {
  token: string;
  initialChampions: Champion[];
  initialNodes: WarNode[];
  initialPlayers: Player[];
  initialUserId: string;
  preFilledFights: PreFilledFight[] | null;
}

export function WarVideoForm({
  token,
  initialChampions,
  initialNodes,
  initialPlayers,
  initialUserId,
  preFilledFights,
}: WarVideoFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Form state
  const [uploadMode, setUploadMode] = useState<"single" | "multiple">("single");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [fights, setFights] = useState<FightData[]>(() => {
    if (preFilledFights && preFilledFights.length > 0) {
      return preFilledFights.map(pf => ({
        id: pf.id, // Use the WarFight ID
        nodeId: String(pf.nodeId),
        attackerId: String(pf.attackerId),
        defenderId: String(pf.defenderId),
        prefightChampionIds: pf.prefightChampions.map(c => String(c.id)),
        death: pf.death,
        videoFile: null, // No video file initially
      }));
    }
    return [
      {
        id: uuidv4(),
        nodeId: "",
        attackerId: "",
        defenderId: "",
        prefightChampionIds: [],
        death: false,
        videoFile: null,
      },
    ];
  });

  const [season, setSeason] = useState<string>(() => preFilledFights?.[0]?.war?.season?.toString() || "");
  const [warNumber, setWarNumber] = useState<string>(() => preFilledFights?.[0]?.war?.warNumber?.toString() || "");
  const [warTier, setWarTier] = useState<string>(() => preFilledFights?.[0]?.war?.warTier?.toString() || "");
  const [playerInVideoId, setPlayerInVideoId] = useState<string>(() => preFilledFights?.[0]?.player?.id || initialUserId);
  const [visibility, setVisibility] = useState<"public" | "alliance">("public");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isOffseason, setIsOffseason] = useState<boolean>(() => preFilledFights?.[0]?.war?.warNumber === null || preFilledFights?.[0]?.war?.warNumber === 0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentUpload, setCurrentUpload] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Effect to update offseason state if warNumber changes
  useEffect(() => {
    setIsOffseason(warNumber === "0" || warNumber === "");
  }, [warNumber]);

  // Memoized derived data
  const prefightChampions = useMemo(() => {
    return initialChampions.filter((champ) =>
      champ.abilities?.some((link) => link.ability.name === "Pre-Fight Ability")
    );
  }, [initialChampions]);

  const warNumberOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: `War ${i + 1}`,
      })),
    []
  );

  const warTierOptions = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        value: String(i + 1),
        label: `Tier ${i + 1}`,
      })),
    []
  );

  const playerOptions = useMemo(
    () =>
      initialPlayers.map((player) => ({
        value: player.id,
        label: player.ingameName,
      })),
    [initialPlayers]
  );

  const handleFightChange = useCallback((updatedFight: FightData) => {
    setFights((prevFights) =>
      prevFights.map((fight) =>
        fight.id === updatedFight.id ? updatedFight : fight
      )
    );
  }, []);

  const handleAddFight = useCallback(() => {
    setFights((prevFights) => [
      ...prevFights,
      {
        id: uuidv4(),
        nodeId: "",
        attackerId: "",
        defenderId: "",
        prefightChampionIds: [],
        death: false,
        videoFile: null,
      },
    ]);
  }, []);

  const handleRemoveFight = useCallback((fightId: string) => {
    setFights((prevFights) =>
      prevFights.filter((fight) => fight.id !== fightId)
    );
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (uploadMode === "single" && !videoFile) {
      newErrors.videoFile = "Video file is required.";
    }
    if (!season) newErrors.season = "Season is required.";
    if (!isOffseason && !warNumber)
      newErrors.warNumber = "War number is required.";
    if (!warTier) newErrors.warTier = "War tier is required.";

    fights.forEach((fight) => {
      if (uploadMode === "multiple" && !fight.videoFile) {
        newErrors[`videoFile-${fight.id}`] =
          "Video file is required for each fight.";
      }
      if (!fight.attackerId)
        newErrors[`attackerId-${fight.id}`] = "Attacker is required.";
      if (!fight.defenderId)
        newErrors[`defenderId-${fight.id}`] = "Defender is required.";
      if (!fight.nodeId)
        newErrors[`nodeId-${fight.id}`] = "War node is required.";
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadVideo = useCallback(
    async (formData: FormData, fightIds: string[], title: string) => {
      if ('BackgroundFetchManager' in self) {
        const sw = await navigator.serviceWorker.ready;
        const fetchId = `upload-${fightIds.join('-')}-${Date.now()}`;

        const bgFetch = await sw.backgroundFetch.fetch(
          fetchId,
          ['/api/war-videos/upload'],
          {
            title: title,
            icons: [
              {
                sizes: '192x192',
                src: '/CereBro_logo_256.png',
                type: 'image/png',
              },
            ],
            downloadTotal:
              uploadMode === 'single'
                ? videoFile?.size ?? 0
                : fights.find((f) => fightIds.includes(f.id))?.videoFile?.size ?? 0,
          }
        );

        const response = await fetch('/api/war-videos/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'X-Background-Fetch-Id': bgFetch.id,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Upload failed for fights ${fightIds.join(', ')}`);
        }
        
        return response.json();

      } else {
        // Fallback to XMLHttpRequest
        return new Promise<{ videoIds: string[] }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentCompleted = Math.round(
                (event.loaded * 100) / event.total
              );
              setUploadProgress(percentCompleted);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } else {
              const errorData = JSON.parse(xhr.responseText);
              reject(
                new Error(errorData.error || `Upload failed for fights ${fightIds.join(', ')}`)
              );
            }
          };

          xhr.onerror = () => {
            reject(new Error(`Network error during upload for fights ${fightIds.join(', ')}`));
          };

          xhr.open('POST', '/api/war-videos/upload', true);
          xhr.send(formData);
        });
      }
    },
    [fights, uploadMode, videoFile]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateForm() || isSubmitting) return;
      setIsSubmitting(true);
      setUploadProgress(0);

      const useBackgroundFetch = 'BackgroundFetchManager' in self;

      const getTitle = (fight: FightData) => {
        const selectedAttacker = initialChampions.find(
          (c) => String(c.id) === fight.attackerId
        );
        const selectedDefender = initialChampions.find(
          (c) => String(c.id) === fight.defenderId
        );
        const selectedNode = initialNodes.find(
          (n) => String(n.id) === fight.nodeId
        );
        const selectedPlayer = initialPlayers.find(
          (p) => p.id === playerInVideoId
        );
        const attackerName = selectedAttacker?.name || "Unknown";
        const defenderName = selectedDefender?.name || "Unknown";
        const nodeNumber = selectedNode?.nodeNumber || "??";
        const playerName = selectedPlayer?.ingameName || "Unknown";
        return `MCOC AW: S${season} W${
          isOffseason ? "Offseason" : warNumber
        } T${warTier} - ${attackerName} vs ${defenderName} on Node ${nodeNumber} by ${playerName}`;
      };

      try {
        if (useBackgroundFetch) {
          toast({
            title: "Upload Started",
            description: "Your video(s) are now uploading in the background. You can leave this page.",
          });
        }

        if (uploadMode === "single") {
          setCurrentUpload("Uploading video...");
          const formData = new FormData();
          formData.append("token", token);
          formData.append("videoFile", videoFile!);
          formData.append("season", season);
          if (!isOffseason) formData.append("warNumber", warNumber);
          formData.append("warTier", warTier);
          formData.append("visibility", visibility);
          formData.append("description", description);
          if (playerInVideoId) formData.append("playerId", playerInVideoId);
          formData.append("fightIds", JSON.stringify(fights.map(f => f.id))); // Send all fight IDs

          const title = getTitle(fights[0]);
          formData.append("title", title); // Title for the video
          formData.append("mode", "single");

          const result = await uploadVideo(formData, fights.map(f => f.id), title);
          if (!useBackgroundFetch) {
            toast({
              title: "Success!",
              description: "All fights have been submitted.",
            });
            if (result.videoIds && result.videoIds.length > 0) {
              router.push(`/war-videos/${result.videoIds[0]}`);
            } else {
              router.push("/war-videos");
            }
          }
        } else {
          // Multiple videos mode
          const allUploadedVideoIds = [];
          for (let i = 0; i < fights.length; i++) {
            const fight = fights[i];
            setCurrentUpload(`Uploading fight ${i + 1} of ${fights.length}...`);
            setUploadProgress(0);

            const formData = new FormData();
            formData.append("token", token);
            formData.append("videoFile", fight.videoFile!);
            formData.append("season", season);
            if (!isOffseason) formData.append("warNumber", warNumber);
            formData.append("warTier", warTier);
            formData.append("visibility", visibility);
            formData.append("description", description);
            if (playerInVideoId) formData.append("playerId", playerInVideoId);
            formData.append("fightIds", JSON.stringify([fight.id])); // Send only this fight's ID

            const title = getTitle(fight);
            formData.append("title", title); // Title for the video
            formData.append("mode", "multiple");

            const result = await uploadVideo(formData, [fight.id], title);
            if (result.videoIds && result.videoIds.length > 0) {
              allUploadedVideoIds.push(result.videoIds[0]);
            }
          }
          if (!useBackgroundFetch) {
            toast({
              title: "Success!",
              description: "All videos have been uploaded.",
            });
            if (allUploadedVideoIds.length > 0) {
              router.push(`/war-videos/${allUploadedVideoIds[0]}`);
            } else {
              router.push("/war-videos");
            }
          }
        }
        if (useBackgroundFetch) {
          // For background fetch, we don't have the final video ID immediately.
          // We can redirect to a general page or just stay here.
          router.push("/war-videos");
        }
      } catch (error: any) {
        console.error("Submission error:", error);
        toast({
          title: "Upload Failed",
          description: error.message || "An unknown error occurred.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
        setCurrentUpload("");
      }
    },
    [
      token,
      videoFile,
      fights,
      season,
      warNumber,
      warTier,
      visibility,
      description,
      playerInVideoId,
      isSubmitting,
      router,
      toast,
      isOffseason,
      initialChampions,
      initialNodes,
      initialPlayers,
      uploadMode,
      uploadVideo,
    ]
  );

  const isSubmitDisabled = () => {
    if (isSubmitting || !token) return true;
    if (uploadMode === "single") return !videoFile;
    if (uploadMode === "multiple") return fights.some((f) => !f.videoFile);
    return true;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      <div>
        <Label>Upload Mode</Label>
        <RadioGroup
          value={uploadMode}
          onValueChange={(value: "single" | "multiple") => setUploadMode(value)}
          className="flex space-x-4 mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single" id="single" />
            <Label htmlFor="single">Single Video (for all fights)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="multiple" id="multiple" />
            <Label htmlFor="multiple">Separate Video (for each fight)</Label>
          </div>
        </RadioGroup>
      </div>

      {uploadMode === "single" && (
        <div>
          <Label>Video File</Label>
          <div className="flex items-center gap-4 mt-2">
            <Label htmlFor="videoFile" className="cursor-pointer">
              <div
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "flex items-center gap-2"
                )}
              >
                <UploadCloud className="h-5 w-5" />
                <span>Choose Video</span>
              </div>
            </Label>
            <Input
              id="videoFile"
              type="file"
              accept="video/*"
              onChange={(e) =>
                setVideoFile(e.target.files ? e.target.files[0] : null)
              }
              required
              className="hidden"
            />
            {videoFile && (
              <p className="text-sm text-muted-foreground">{videoFile.name}</p>
            )}
          </div>
          {errors.videoFile && (
            <p className="text-sm text-red-500 mt-1">{errors.videoFile}</p>
          )}
        </div>
      )}

      {fights.map((fight) => (
        <FightBlock
          key={fight.id}
          fight={fight}
          onFightChange={handleFightChange}
          onRemove={handleRemoveFight}
          canRemove={fights.length > 1}
          initialChampions={initialChampions}
          initialNodes={initialNodes}
          prefightChampions={prefightChampions}
          uploadMode={uploadMode}
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
            <Checkbox
              id="isOffseason"
              checked={isOffseason}
              onCheckedChange={(checked) => setIsOffseason(Boolean(checked))}
            />

            <Label htmlFor="isOffseason">Offseason</Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="season">Season</Label>

            <Input
              id="season"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              required
            />

            {errors.season && (
              <p className="text-sm text-red-500 mt-1">{errors.season}</p>
            )}
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

            {errors.warNumber && (
              <p className="text-sm text-red-500 mt-1">{errors.warNumber}</p>
            )}
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

            {errors.warTier && (
              <p className="text-sm text-red-500 mt-1">{errors.warTier}</p>
            )}
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
        <RadioGroup
          value={visibility}
          onValueChange={(value: "public" | "alliance") => setVisibility(value)}
          className="flex space-x-4 mt-2"
        >
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
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any relevant details about the fight, prefights used, etc."
        />
      </div>

      {isSubmitting && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
          <Label className="text-lg font-medium mb-4">{currentUpload}</Label>
          <Progress value={uploadProgress} className="w-1/2" />
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitDisabled()}
        className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:from-sky-600 hover:to-indigo-600"
      >
        {isSubmitting ? "Uploading..." : "Upload Video(s)"}
      </Button>
    </form>
  );
}
