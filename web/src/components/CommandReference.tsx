"use client";
import commandData from "@/lib/data/commands.json";
import { useState, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// (Omitting the type definitions for brevity as they are the same as in CommandList.tsx)
interface CommandArgumentOption {
  type: number;
  name: string;
  description: string;
  required: boolean;
}

interface SubcommandOption {
  type: 1;
  name: string;
  description: string;
  options?: CommandArgumentOption[];
}

interface SubcommandGroupOption {
  type: 2;
  name: string;
  description: string;
  options?: SubcommandOption[];
}

interface Command {
  name: string;
  description: string;
  group: string;
  color: string;
  options?: (SubcommandOption | SubcommandGroupOption | CommandArgumentOption)[];
  subcommands: {
    [key: string]: {
      image?: string;
    } | undefined;
  };
}


const CommandReference = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);

  const commandGroups = useMemo(() => {
    const groups = ["All", ...Array.from(new Set(commandData.map((c) => c.group)))];
    return groups.sort();
  }, []);

  const filteredCommands = useMemo(() => {
    return (commandData as Command[]).filter((command) => {
      const groupMatch = selectedGroup === "All" || command.group === selectedGroup;
      const searchMatch =
        searchQuery === "" ||
        command.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        command.description.toLowerCase().includes(searchQuery.toLowerCase());
      return groupMatch && searchMatch;
    });
  }, [searchQuery, selectedGroup]);

  const formatArguments = (options: CommandArgumentOption[] | undefined) => {
    if (!options) return '';
    return options
      .filter(opt => opt.type > 2) // Filter for actual arguments
      .map(opt => opt.required ? `<${opt.name}>` : `[${opt.name}]`)
      .join(' ');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Left Column: Groups */}
      <div className="md:col-span-1">
        <div className="sticky top-24">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Categories</h3>
          <ul className="space-y-2">
            {commandGroups.map((group) => (
              <li key={group}>
                <button
                  onClick={() => setSelectedGroup(group)}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                    selectedGroup === group
                      ? "bg-cyan-500/10 text-cyan-300"
                      : "text-slate-400 hover:bg-slate-800/50"
                  }`}
                >
                  {group}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Middle Column: Commands */}
      <div className="md:col-span-1">
        <input
          type="text"
          placeholder="Search commands..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs rounded-full border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/70 focus:border-cyan-400/70 mb-4"
        />
        <div className="space-y-2">
          {filteredCommands.map((command) => (
            <button
              key={command.name}
              onClick={() => setSelectedCommand(command)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedCommand?.name === command.name
                  ? "bg-slate-800/60"
                  : "hover:bg-slate-800/30"
              }`}
            >
              <p className="font-semibold text-slate-50 text-sm">/{command.name}</p>
              <p className="text-slate-400 text-xs mt-1">{command.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column: Command Details */}
      <div className="md:col-span-2">
        <div className="sticky top-24">
          <AnimatePresence>
            {selectedCommand && (
              <motion.div
                key={selectedCommand.name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="glass rounded-xl border border-slate-800/80 p-5"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white">/{selectedCommand.name}</h3>
                    <p className="text-slate-300 text-sm mt-1">{selectedCommand.description}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full bg-${selectedCommand.color}-500/15 text-${selectedCommand.color}-300 border border-${selectedCommand.color}-400/50 text-xs`}>
                    {selectedCommand.group}
                  </span>
                </div>
                <div className="border-t border-slate-800 my-4"></div>
                <div className="space-y-5">
                  {(selectedCommand.options || []).map((option) => {
                     if (option.type === 1) { // Subcommand
                      const subCmd = option as SubcommandOption;
                      const subcommandDetails = selectedCommand.subcommands[subCmd.name as keyof typeof selectedCommand.subcommands];
                      return (
                        <div key={subCmd.name}>
                          <p className="font-mono text-sm text-cyan-300 bg-slate-900/70 px-3 py-1.5 rounded-md">
                            /{selectedCommand.name} {subCmd.name} {formatArguments(subCmd.options)}
                          </p>
                          <p className="text-slate-400 text-xs mt-1.5 ml-1">{subCmd.description}</p>
                          {subcommandDetails?.image && (
                            <div className="relative group mt-2 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/10 transition-all hover:shadow-cyan-500/20">
                              <Image src={subcommandDetails.image} alt={`${selectedCommand.name} ${subCmd.name} command preview`} width={500} height={200} className="w-full h-auto rounded-lg" />
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (option.type === 2) { // Subcommand Group
                      const subCmdGroup = option as SubcommandGroupOption;
                      return (
                        <div key={subCmdGroup.name} className="space-y-4">
                          {(subCmdGroup.options || []).map((subOption) => {
                            const subcommandDetails = selectedCommand.subcommands[subOption.name as keyof typeof selectedCommand.subcommands];
                            return (
                              <div key={subOption.name}>
                                <p className="font-mono text-sm text-cyan-300 bg-slate-900/70 px-3 py-1.5 rounded-md">
                                  /{selectedCommand.name} {subCmdGroup.name} {subOption.name} {formatArguments(subOption.options)}
                                </p>
                                <p className="text-slate-400 text-xs mt-1.5 ml-1">{subOption.description}</p>
                                {subcommandDetails?.image && (
                                  <div className="relative group mt-2 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/10 transition-all hover:shadow-cyan-500/20">
                                    <Image src={subcommandDetails.image} alt={`${selectedCommand.name} ${subOption.name} command preview`} width={500} height={200} className="w-full h-auto rounded-lg" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!selectedCommand && (
            <div className="flex flex-col items-center justify-center text-center h-full glass rounded-xl border border-slate-800/80 p-5">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                </div>
              <h3 className="text-md font-semibold text-slate-300">Select a command</h3>
              <p className="text-sm text-slate-500 mt-1">Choose a command from the list to see its details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandReference;
