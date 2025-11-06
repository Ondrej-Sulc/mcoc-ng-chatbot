import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    question: "How do I add CereBro to my Discord server?",
    answer: "You can invite CereBro to your server by clicking the 'Invite to Discord' button in the hero section. You will need to have the appropriate permissions in the server to add a bot."
  },
  {
    question: "How do I register my in-game name?",
    answer: "Use the `/register` command to link your in-game name to your Discord account. For example: `/register name:YourIGN`. This is required for most features."
  },
  {
    question: "How does the roster update work?",
    answer: "You can update your roster by using the `/roster update` command and uploading screenshots of your champion list. The bot uses OCR to read the champion information from the images."
  },
  {
    question: "Is CereBro free to use?",
    answer: "Yes, CereBro is completely free to use. However, some advanced features might require an administrator to enable them for your alliance."
  }
];

export function Faq() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq, index) => (
        <AccordionItem value={`item-${index}`} key={index}>
          <AccordionTrigger className="hover:text-blue-400">{faq.question}</AccordionTrigger>
          <AccordionContent>
            <p className="text-muted-foreground">{faq.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
