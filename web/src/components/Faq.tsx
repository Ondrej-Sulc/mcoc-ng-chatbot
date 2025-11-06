"use client";
import { useState } from "react";

const faqs = [
  {
    question: "Is CereBro free to use?",
    answer: "Yes, CereBro is completely free to use. All features, including Alliance War/Quest management, champion lookups, and automated alerts, are available to everyone at no cost."
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