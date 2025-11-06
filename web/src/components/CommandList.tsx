import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { commandData, CommandInfo } from "@/lib/data/commands";

export function CommandList() {
  const groupedCommands: { [key: string]: CommandInfo[] } = {};
  commandData.forEach(command => {
    const group = command.group || 'Other';
    if (!groupedCommands[group]) {
      groupedCommands[group] = [];
    }
    groupedCommands[group].push(command);
  });

  return (
    <div className="w-full">
      {Object.entries(groupedCommands).map(([group, commands]) => (
        <div key={group} className="mb-8">
          <h3 className="text-2xl font-bold mb-4 text-purple-400">{group}</h3>
          <Accordion type="single" collapsible className="w-full">
            {commands.map(command => (
              <AccordionItem value={command.name} key={command.name}>
                <AccordionTrigger className="hover:text-blue-400">/{command.name}</AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground mb-4">{command.description}</p>
                  {command.subcommands.map((sub, index) => (
                    <div key={index} className="border-l-2 border-purple-400 pl-4 mb-2">
                      <p className="font-mono text-sm bg-muted p-2 rounded-md">{sub.usage}</p>
                      <p className="text-sm text-muted-foreground mt-1">{sub.description}</p>
                      {sub.examples && (
                        <div className="mt-2">
                          <h4 className="text-xs font-semibold text-purple-400">Examples:</h4>
                          <ul className="list-disc list-inside text-xs text-muted-foreground">
                            {sub.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
}
