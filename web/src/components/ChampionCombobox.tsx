"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Virtuoso } from "react-virtuoso";

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Champion } from "@/types/champion"

interface ChampionComboboxProps {
  champions: Champion[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const ChampionCombobox = React.memo(function ChampionCombobox({
  champions,
  value,
  onSelect,
  placeholder = "Select a champion...",
  className,
}: ChampionComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const handleSelect = React.useCallback((championId: string) => {
    onSelect(championId);
    setOpen(false);
  }, [onSelect]);

  const filteredChampions = React.useMemo(() =>
    champions.filter(champion =>
      champion.name.toLowerCase().includes(search.toLowerCase())
    ), [champions, search]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">
            {value ? champions.find((c) => String(c.id) === value)?.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent sideOffset={4} className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder="Search champion..."
            value={search}
            onValueChange={setSearch}
          />
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
                            onSelect={() => handleSelect(String(champion.id))}
                        >
                            <Check
                                className={cn(
                                    "mr-2 h-4 w-4",
                                    value === String(champion.id) ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {champion.name}
                        </CommandItem>
                    )}
                />
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
});