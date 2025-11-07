"use client";
import commandData from "@/lib/data/commands.json";
import { useState, useEffect } from "react";
import Image from "next/image";

export function CommandList() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleCommand = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  useEffect(() => {
    const searchInput = document.getElementById('commandSearch') as HTMLInputElement;
    const categorySelect = document.getElementById('commandCategory') as HTMLSelectElement;
    const commandCards = Array.from(document.querySelectorAll('#commandList > div')) as HTMLDivElement[];
    const emptyState = document.getElementById('commandsEmpty') as HTMLParagraphElement;

    function filterCommands() {
      const query = searchInput.value.toLowerCase().trim();
      const category = categorySelect.value;
      let visibleCount = 0;

      commandCards.forEach(card => {
        const text = card.textContent?.toLowerCase() || '';
        const cardCategory = card.dataset.category;
        const matchesCategory = category === 'all' || cardCategory === category;
        const matchesQuery = !query || text.includes(query);
        const visible = matchesCategory && matchesQuery;
        card.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
      });

      emptyState.style.display = visibleCount > 0 ? 'none' : 'block';
    }

    searchInput.addEventListener('input', filterCommands);
    categorySelect.addEventListener('change', filterCommands);

    return () => {
      searchInput.removeEventListener('input', filterCommands);
      categorySelect.removeEventListener('change', filterCommands);
    };
  }, []);

  const formatArguments = (options: any[] | undefined) => {
    if (!options) return '';
    return options
      .filter(opt => opt.type > 2) // Filter for actual arguments
      .map(opt => opt.required ? `<${opt.name}>` : `[${opt.name}]`)
      .join(' ');
  };

  return (
    <>
      {commandData.map((command, index) => (
        <div
          key={command.name}
          className={`command-item glass rounded-xl border border-slate-800/80 overflow-hidden transition-all duration-500 ease-in-out hover:border-slate-700 hover:-translate-y-px ${activeIndex === index ? 'active border-cyan-400/50 sm:col-span-2' : ''}`}
          data-category={command.group?.toLowerCase()}
        >
          <button
            className="w-full px-4 py-3 text-left"
            onClick={() => toggleCommand(index)}
          >
            <div className="flex justify-between items-center gap-2">
              <span className="font-semibold text-slate-50">/{command.name}</span>
              <span className={`px-2 py-0.5 rounded-full bg-${command.color}-500/15 text-${command.color}-300 border border-${command.color}-400/50 text-[10px]`}>{command.group}</span>
            </div>
            <p className="text-slate-300 text-xs mt-1">{command.description}</p>
          </button>
          <div className="command-content">
            <div className="pt-0 pb-4 px-4 grid sm:grid-cols-2 gap-x-6 gap-y-4">
              {(command.options || []).map((option) => {
                // Type 1: Subcommand
                if (option.type === 1) {
                  return (
                    <div key={option.name} className="text-xs">
                      <p className="font-mono text-cyan-300">
                        /{command.name} {option.name} {formatArguments(option.options)}
                      </p>
                      <p className="text-slate-400 text-[11px] mt-0.5">{option.description}</p>
                      {command.subcommands[option.name as keyof typeof command.subcommands]?.image && (
                        <div className="relative group mt-2 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/10 transition-all hover:shadow-cyan-500/20">
                          <Image src={command.subcommands[option.name as keyof typeof command.subcommands].image!} alt={`${command.name} ${option.name} command preview`} width={500} height={200} className="w-full h-auto rounded-lg" />
                          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/60 rounded-lg"></div>
                        </div>
                      )}
                    </div>
                  );
                }
                // Type 2: Subcommand Group
                if (option.type === 2) {
                  return (
                    <div key={option.name} className="space-y-4">
                      {(option.options || []).map((subOption) => (
                        <div key={subOption.name} className="text-xs">
                          <p className="font-mono text-cyan-300">
                            /{command.name} {option.name} {subOption.name} {formatArguments(subOption.options)}
                          </p>
                          <p className="text-slate-400 text-[11px] mt-0.5">{subOption.description}</p>
                          {command.subcommands[subOption.name as keyof typeof command.subcommands]?.image && (
                            <div className="relative group mt-2 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/10 transition-all hover:shadow-cyan-500/20">
                              <Image src={command.subcommands[subOption.name as keyof typeof command.subcommands].image!} alt={`${command.name} ${subOption.name} command preview`} width={500} height={200} className="w-full h-auto rounded-lg" />
                              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/60 rounded-lg"></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
