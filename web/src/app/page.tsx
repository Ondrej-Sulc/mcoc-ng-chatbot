"use client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Search, Users, Star, Shield, Swords } from 'lucide-react';
import { CommandList } from "@/components/CommandList";
import { Faq } from "@/components/Faq";

export default function Home() {
  const features = [
    {
      title: "Champion Encyclopedia",
      description: "Get detailed information about any champion, including abilities, attacks, and immunities.",
      icon: <BookOpen className="w-8 h-8 text-purple-400" />
    },
    {
      title: "Powerful Search",
      description: "Find champions based on a wide range of criteria like abilities, tags, and classes.",
      icon: <Search className="w-8 h-8 text-purple-400" />
    },
    {
      title: "Roster Management",
      description: "Keep track of your personal champion roster, including ranks and awakened status.",
      icon: <Users className="w-8 h-8 text-purple-400" />
    },
    {
      title: "Prestige OCR",
      description: "Automatically update your prestige by uploading a screenshot of your profile.",
      icon: <Star className="w-8 h-8 text-purple-400" />
    },
    {
      title: "Alliance Tools",
      description: "Advanced tools for Alliance Quest (AQ) and Alliance War (AW) coordination.",
      icon: <Shield className="w-8 h-8 text-purple-400" />
    },
    {
      title: "Duel Targets",
      description: "Find the best duel targets for any champion to practice your skills.",
      icon: <Swords className="w-8 h-8 text-purple-400" />
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex items-center">
            <Image
              src="/CereBro_logo_256.png"
              alt="CereBro Logo"
              width={32}
              height={32}
              className="animate-glow rounded-full"
            />
            <span className="ml-2 font-bold text-lg">CereBro</span>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <nav className="flex items-center">
              <Button variant="ghost" className="hover:text-purple-400 text-base">Home</Button>
              <Button variant="ghost" className="hover:text-purple-400 text-base">Features</Button>
              <Button variant="ghost" className="hover:text-purple-400 text-base">Commands</Button>
              <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white animate-glow text-base">
                <a href="#">Get Started</a>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 md:py-24 lg:py-32 xl:py-48 bg-gradient-to-br from-gray-900 to-purple-900">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold tracking-tighter sm:text-6xl xl:text-7xl/none bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
                    Unleash the Power of CereBro
                  </h1>
                  <p className="max-w-[600px] text-gray-300 md:text-xl">
                    Your ultimate companion for Marvel Contest of Champions. Explore champions, manage your roster, and dominate the game.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white animate-glow">Invite to Discord</Button>
                  <Button size="lg" variant="outline" className="hover:bg-purple-900/50 hover:text-white">Learn More</Button>
                </div>
              </div>
              <Image
                src="/CereBro_logo_1024.png"
                alt="Hero"
                width="550"
                height="550"
                className="mx-auto aspect-square overflow-hidden rounded-xl object-cover sm:w-full lg:order-last animate-glow"
              />
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">Key Features</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Everything You Need to Succeed</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  CereBro is packed with features to help you and your alliance reach new heights.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
              {features.map((feature, index) => (
                <Card key={index} className="transform transition-transform duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{feature.title}</CardTitle>
                    {feature.icon}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="commands" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">Commands</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Full Command List</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Explore the full range of commands CereBro has to offer.
                </p>
              </div>
            </div>
            <div className="mx-auto max-w-5xl py-12">
              <CommandList />
            </div>
          </div>
        </section>

        <section id="faq" className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">FAQ</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Frequently Asked Questions</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Have questions? We have answers.
                </p>
              </div>
            </div>
            <div className="mx-auto max-w-5xl py-12">
              <Faq />
            </div>
          </div>
        </section>
      </main>

      <footer className="flex items-center justify-center py-6 md:py-8 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-muted-foreground">
            © 2025 CereBro. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy Policy</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

