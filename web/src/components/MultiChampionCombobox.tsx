"use client"

import * as React from "react"
import Image from "next/image"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Virtuoso } from "react-virtuoso";

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ChampionImages } from "@/types/champion"
import { getChampionImageUrl } from "@/lib/championHelper"

interface Champion {
  id: number;
  name: string;
  images: ChampionImages;
}

interface MultiChampionComboboxProps {
  champions: Champion[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const MultiChampionCombobox = React.memo(function MultiChampionCombobox({
  champions,
  selectedIds,
  onSelectionChange,
  placeholder = "Select champions...",
  className,
}: MultiChampionComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("");

  const handleSelect = (championId: string) => {
    const newSelectedIds = selectedIds.includes(championId)
      ? selectedIds.filter(id => id !== championId)
      : [...selectedIds, championId];
    onSelectionChange(newSelectedIds);
  };

  const selectedChampions = selectedIds.map(id => champions.find(c => String(c.id) === id)).filter(Boolean) as Champion[];

  const filteredChampions = React.useMemo(() =>
    champions.filter(champion =>
      champion.name.toLowerCase().includes(search.toLowerCase())
    ), [champions, search]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
                placeholder="Search champion..."
                value={search}
                onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No champion found.</CommandEmpty>
              <CommandGroup>
                {open && (
                    <Virtuoso
                        style={{ height: "288px" }}
                        data={filteredChampions}
                        itemContent={(index, champion) => (
                            <CommandItem
                                key={champion.id}
                                value={champion.name}
                                onSelect={() => {
                                    handleSelect(String(champion.id));
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedIds.includes(String(champion.id)) ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {champion.name}
                            </CommandItem>
                        )}
                    />
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap gap-2">
        {selectedChampions.map(champion => (
          <Badge key={champion.id} variant="secondary" className="flex items-center gap-2">
            <Image
              src={getChampionImageUrl(champion.images, '32', 'primary')}
              alt={champion.name}
              width={20}
              height={20}
              className="rounded-full"
            />
            {champion.name}
            <button
              type="button"
              onClick={() => handleSelect(String(champion.id))}
              className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label={`Remove ${champion.name}`}
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  )
});