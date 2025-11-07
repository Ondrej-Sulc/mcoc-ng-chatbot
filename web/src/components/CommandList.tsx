"use client";
import commandData from "@/lib/data/commands.json";
import { useEffect } from "react";

export function CommandList() {
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

  return (
    <>
      {commandData.map(command => (
        <div key={command.name} className="command-pill rounded-xl border border-slate-800/80 glass px-3 py-2.5 flex flex-col gap-1.5" data-category={command.group?.toLowerCase()}>
          <div className="flex justify-between items-center gap-2">
            <span className="font-semibold text-slate-50">/{command.name}</span>
            <span className={`px-2 py-0.5 rounded-full bg-${command.color}-500/15 text-${command.color}-300 border border-${command.color}-400/50 text-[10px]`}>{command.group}</span>
          </div>
          <p className="text-slate-300">{command.description}</p>
          {command.options.filter(opt => opt.type === 1 || opt.type === 2) /* SUB_COMMAND or SUB_COMMAND_GROUP */
            .map((sub, index) => (
            <p key={index} className="text-slate-500 text-[10px]">
              <span className="font-semibold text-slate-400">/{command.name} {sub.name}</span> - {sub.description}
            </p>
          ))}
        </div>
      ))}
    </>
  );
}
