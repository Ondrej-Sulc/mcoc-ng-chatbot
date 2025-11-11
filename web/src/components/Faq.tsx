"use client";
import { useState } from "react";

const faqs = [
  {
    question: "Is CereBro free to use?",
    answer: "Yes, CereBro is completely free. All features are available at no cost. If you find the bot useful, you can support its development and hosting costs via the links in the Support section, but it is never required."
  },
  {
    question: "How does the Roster processing work?",
    answer: "You can upload a screenshot of your champion roster from the game. CereBro uses advanced image processing algorithm to read the image, identify your champions, and automatically update your personal roster associated with your Discord profile. This saves you from manually entering every champion."
  },
  {
    question: "What data does the bot store?",
    answer: "CereBro stores your Discord user ID, MCOC in-game name, and any roster/prestige data you provide. All data is stored securely and is never shared with third parties. You can request to have your data deleted at any time by contacting us on the support server."
  },
  {
    question: "How do I set up AQ scheduling?",
    answer: "Once you've registered your alliance, officers can use the /aq schedule command to configure the map, modifiers, and start times. The bot will then automatically create channels and ping relevant members when it's time to move."
  },
  {
    question: "Where does the champion and game data come from?",
    answer: "Champion ability and stat data is meticulously collected and maintained. It is typically updated within 24 hours of a new champion release or balance patch from Kabam."
  }
];

export function Faq() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="space-y-3">
      {faqs.map((faq, index) => (
        <div key={index} className={`glass rounded-xl border border-slate-800/50 overflow-hidden faq-item ${activeIndex === index ? 'active' : ''}`}>
          <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={() => toggleFaq(index)}>
            <span className="text-sm font-medium text-slate-100">{faq.question}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${activeIndex === index ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="faq-content">
            <p className="text-xs text-slate-300/90 px-5 pt-0 pb-5">
              {faq.answer}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}