import Image from "next/image";
import Link from "next/link";
import { CommandList } from "@/components/CommandList";
import { Faq } from "@/components/Faq";

export default function Home() {
  return (
    <div className="min-h-screen hero-bg">


      <main>
        <section className="pt-10 lg:pt-16 pb-12">
          <div className="max-w-6xl mx-auto px-4 lg:px-6 grid gap-10 lg:grid-cols-2 hero-grid">
            <div className="relative flex flex-col justify-center">
              <span className="inline-flex items-center gap-2 text-xs bg-slate-900/50 border border-slate-700/50 rounded-full px-3 py-1 w-fit mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Online and serving thousands of MCOC players
              </span>
              <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-5 leading-tight">
                CereBro:
                <span className="gradient-text">The MCOC Discord Brain</span>
              </h1>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-6">
                Keep your alliance organized with automated AW/AQ boards, champion intel, roster sync, activity tracking, and raid-ready alerts. Designed for Contest of Champions communities.
              </p>
              <div className="flex flex-wrap gap-4 mb-6">
                <Link href="https://discord.com/oauth2/authorize" target="_blank" className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-sky-500/30">
                  Invite to Discord
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M7 17 17 7m0 0H8m9 0v9" />
                  </svg>
                </Link>
                <Link href="#commands" className="inline-flex items-center gap-1 px-4 py-2.5 text-sm rounded-lg border border-slate-600/50 hover:bg-slate-800/50 transition">
                  View Commands
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="m9 5 7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="flex gap-6 items-center">
                <div>
                  <p className="text-lg font-bold text-white leading-none">2.4K+</p>
                  <p className="text-xs text-slate-400">Guilds using CereBro</p>
                </div>
                <div className="h-8 w-px bg-slate-700/70"></div>
                <div>
                  <p className="text-lg font-bold text-white leading-none">99.9%</p>
                  <p className="text-xs text-slate-400">Uptime</p>
                </div>
                <div className="h-8 w-px bg-slate-700/70"></div>
                <div>
                  <p className="text-lg font-bold text-white leading-none">90K+</p>
                  <p className="text-xs text-slate-400">Daily Commands</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <Image src="/CereBro_logo_1024.png" alt="CereBro Logo" width={512} height={512} className="mx-auto edge-blur" />
            </div>
          </div>
        </section>

        <section id="features" className="section-offset py-10 lg:py-14">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-400/80 mb-1">Core Capabilities</p>
                <h2 className="text-2xl font-semibold text-white">What CereBro does for your MCOC server</h2>
                <p className="text-slate-300 text-sm mt-1">Built to replace spreadsheets, ping chaos, and manual MCOC coordination.</p>
              </div>
              <Link href="https://discord.com/oauth2/authorize" target="_blank" className="hidden md:inline-flex items-center gap-1 text-xs text-sky-200 hover:text-white">
                Add bot
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" d="m9 5 7 7-7 7"/>
                </svg>
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-sky-500/40 transition card-tilt">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center mb-4 text-sky-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="m3.75 4.5 7.5 4.5 7.5-4.5m-15 0h15m-15 0v10.5l7.5 4.5 7.5-4.5v-10.5" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Strategic Alliance War Tools</h3>
                <p className="text-xs text-slate-300 mb-3">Plan your attack and defense with interactive maps, assign defenders, and track enemy placements for a competitive edge.</p>
              </div>
              <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-indigo-500/40 transition card-tilt">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="m10.5 6 7 7-1.5 1.5-5.5-5.5L6.5 12 5 10.5 10.5 6ZM4 19h16" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Seamless AQ Coordination</h3>
                <p className="text-xs text-slate-300 mb-3">Manage AQ assignments, track path progress in real-time, and get automated reminders to ensure smooth clears.</p>
              </div>
              <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-pink-500/40 transition card-tilt">
                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4 text-pink-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M16.5 4.5 21 9l-4.5 4.5M8.25 9H21m-4.5 6-4.5 4.5L7.5 15M15.75 15H3" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Roster & Prestige Management</h3>
                <p className="text-xs text-slate-300 mb-3">Members can easily upload and manage their champion rosters. Automatically calculates and tracks alliance prestige.</p>
              </div>
              <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-sky-500/40 transition card-tilt">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center mb-4 text-sky-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="m3.75 4.5 7.5 4.5 7.5-4.5m-15 0h15m-15 0v10.5l7.5 4.5 7.5-4.5v-10.5" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Expansive Champion Database</h3>
                <p className="text-xs text-slate-300 mb-3">Access detailed information on every champion, including abilities, stats, immunities, and synergies. Always up-to-date.</p>
              </div>
              <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-indigo-500/40 transition card-tilt">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-300">
                  <svg xmlns="http://www.w3..org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="m10.5 6 7 7-1.5 1.5-5.5-5.5L6.5 12 5 10.5 10.5 6ZM4 19h16" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Intelligent Event Scheduling</h3>
                <p className="text-xs text-slate-300 mb-3">Schedule reminders for important events like AQ/AW start times, item expirations, and custom alliance events.</p>
              </div>
              <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-pink-500/40 transition card-tilt">
                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center mb-4 text-pink-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M16.5 4.5 21 9l-4.5 4.5M8.25 9H21m-4.5 6-4.5 4.5L7.5 15M15.75 15H3" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Powerful Admin Controls</h3>
                <p className="text-xs text-slate-300 mb-3">Fine-tune the bot to your alliance's needs with role-based permissions, custom commands, and detailed logging.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="commands" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 sm:mt-20 fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-300/80">Command reference</p>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-50 mt-1">Slash commands your officers will love</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                Search, filter, and copy commands directly into Discord. CereBro is fully slash-based and permission-aware.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input id="commandSearch" type="text" placeholder="Search commands…" className="w-40 sm:w-56 text-xs rounded-full border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/70 focus:border-cyan-400/70" />
              <select id="commandCategory" className="text-xs rounded-full border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400/70 focus:border-cyan-400/70">
                <option value="all">All</option>
                <option value="aw">Alliance War</option>
                <option value="aq">Alliance Quest</option>
                <option value="roster">Roster</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>

          <div id="commandList" className="grid sm:grid-cols-2 gap-3 sm:gap-4 text-[11px]">
            <CommandList />
          </div>

          <p id="commandsEmpty" className="mt-3 text-[11px] text-slate-500 hidden">No commands match your search. Try a different keyword or category.</p>
        </section>

        <section id="howitworks" className="section-offset py-10 lg:py-14">
          <div className="max-w-6xl mx-auto px-4 lg:px-6 grid gap-7 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-sky-400/80 mb-1">How it works</p>
              <h2 className="text-2xl font-semibold text-white mb-3">Simple to set up, powerful when configured</h2>
              <p className="text-sm text-slate-300 mb-4">CereBro guides your officers through initial setup, then automates daily operations.</p>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-100 flex items-center justify-center text-[11px] border border-sky-500/20">1</span>
                  <div>
                    <p className="text-slate-100 text-sm">Invite the bot</p>
                    <p className="text-xs text-slate-400">Grant required perms for channels and roles.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-100 flex items-center justify-center text-[11px] border border-sky-500/20">2</span>
                  <div>
                    <p className="text-slate-100 text-sm">Run setup wizard</p>
                    <p className="text-xs text-slate-400">/cerebro setup asks about alliance size, AW/AQ preferences.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-100 flex items-center justify-center text-[11px] border border-sky-500/20">3</span>
                  <div>
                    <p className="text-slate-100 text-sm">Enable smart alerts</p>
                    <p className="text-xs text-slate-400">Members get pinged only when they are relevant.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-100 flex items-center justify-center text-[11px] border border-sky-500/20">4</span>
                  <div>
                    <p className="text-slate-100 text-sm">Review dashboards</p>
                    <p className="text-xs text-slate-400">Use web or Discord embeds to monitor progress.</p>
                  </div>
                </li>
              </ul>
              <div className="mt-5 flex gap-3">
                <Link href="https://discord.com/oauth2/authorize" className="inline-flex items-center gap-1.5 text-xs bg-sky-500/90 text-white rounded-md px-3 py-1.5 hover:bg-sky-400/90">
                  Start setup
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m9 5 7 7-7 7"/>
                  </svg>
                </Link>
                <Link href="#faq" className="inline-flex items-center gap-1.5 text-xs text-slate-200 hover:text-white">
                  Read FAQs
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="glass rounded-2xl border border-slate-800/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-200">Latest Alliance Activity</p>
                  <p className="text-[10px] text-slate-500">Live Feed</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1"></span>
                    <div className="flex-1">
                      <p className="text-xs text-slate-100">AQ Map 8 completed</p>
                      <p className="text-[10px] text-slate-500">by DragonSlayer • 1m ago</p>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-200 px-2 py-0.5 rounded-md border border-emerald-400/10">AQ</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1"></span>
                    <div className="flex-1">
                      <p className="text-xs text-slate-100">War placement missing: 2 members</p>
                      <p className="text-[10px] text-slate-500">CereBro reminder queued • 3m ago</p>
                    </div>
                    <span className="text-[10px] bg-amber-500/10 text-amber-100 px-2 py-0.5 rounded-md border border-amber-400/10">AW</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1"></span>
                    <div className="flex-1">
                      <p className="text-xs text-slate-100">Raid window starts in 25 minutes</p>
                      <p className="text-[10px] text-slate-500">pings scheduled for @RaidTeam</p>
                    </div>
                    <span className="text-[10px] bg-sky-500/10 text-sky-100 px-2 py-0.5 rounded-md border border-sky-400/10">Raid</span>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-slate-500/5 border border-slate-500/10 flex items-center justify-center spin-slow">
                <div className="w-5 h-5 rounded-full bg-sky-500/70"></div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="section-offset py-10 lg:py-14">
          <div className="max-w-4xl mx-auto px-4 lg:px-6">
            <p className="text-xs uppercase tracking-wide text-sky-400/80 mb-1 text-center">Questions</p>
            <h2 className="text-2xl font-semibold text-white mb-5 text-center">CereBro FAQ</h2>
            <div className="space-y-3">
              <Faq />
            </div>
          </div>
        </section>

        <section id="get" className="py-10 pb-16">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="glass rounded-xl border border-slate-800/50 px-6 py-6 md:py-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Ready to give your MCOC server a brain?</h3>
                <p className="text-sm text-slate-300">Invite CereBro now and run /cerebro setup in your #officers channel.</p>
              </div>
              <div className="flex gap-3 items-center">
                <Link href="https://discord.com/oauth2/authorize" target="_blank" className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-lg shadow-lg shadow-sky-500/25">
                  Invite to Discord
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M7 17 17 7m0 0H8m9 0v9" />
                  </svg>
                </Link>
                <Link href="https://discord.gg" target="_blank" className="inline-flex items-center gap-1 text-xs text-slate-200 hover:text-white">
                  Join support server
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-6 border-t border-slate-800/30">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} CereBro Bot. Not affiliated with Kabam or Marvel Contest of Champions.</p>
          <div className="flex gap-3 text-xs text-slate-400">
            <Link href="#features" className="hover:text-slate-100">Features</Link>
            <Link href="#faq" className="hover:text-slate-100">FAQ</Link>
            <Link href="https://discord.com" target="_blank" className="hover:text-slate-100">Discord</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}