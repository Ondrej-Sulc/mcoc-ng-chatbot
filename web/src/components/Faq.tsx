"use client";
import { useState } from "react";

const faqs = [
  {
    question: "Is CereBro free to use?",
    answer: "Yes, core commands (AW, AQ, champ lookup, pings) are free. Premium tiers add analytics and multi-alliance dashboards."
  },
  {
    question: "Does it support multiple alliances in one server?",
    answer: "Yes. You can name and scope alliances to specific channels and roles, and AQ/AW tasks won’t collide."
  },
  {
    question: "What permissions does CereBro need?",
    answer: "It needs Read/Send/Embed Links/Manage Messages for target channels, plus Manage Roles for role-based alerts. You can restrict later."
  },
  {
    question: "How often is champion data updated?",
    answer: "Usually within 24 hours after Kabam releases balance notes or new champs. Emergency pushes are faster."
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
        <div key={index} className={`glass rounded-lg border border-slate-800/50 faq-item ${activeIndex === index ? 'active' : ''}`}>
          <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => toggleFaq(index)}>
            <span className="text-sm text-slate-100">{faq.question}</span>
            <span className="text-xs text-slate-300">{activeIndex === index ? '-' : '+'}</span>
          </button>
          <div className="faq-content px-4 pb-3">
            <p className="text-[11px] text-slate-300">{faq.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
}