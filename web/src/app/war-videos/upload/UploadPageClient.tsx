'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader } from 'lucide-react';
import { WarVideoForm } from './WarVideoForm';
import { Champion } from '@/types/champion';
import { War, WarFight, Player as PrismaPlayer, WarNode as PrismaWarNode } from '@prisma/client';

// Define types for fetched data
interface WarNode extends PrismaWarNode {}
interface Player extends PrismaPlayer {}

interface InitialFormData {
  champions: Champion[];
  nodes: WarNode[];
  players: Player[];
  user: { id: string };
}

interface PreFilledFight extends WarFight {
  war: War;
  player: Player;
  attacker: Champion;
  defender: Champion;
  node: WarNode;
  prefightChampions: Champion[];
}

type PageStatus = 'loading' | 'ready' | 'error';

export default function UploadWarVideoPage() {
  const searchParams = useSearchParams();
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [initialFormData, setInitialFormData] = useState<InitialFormData | null>(null);
  const [preFilledFights, setPreFilledFights] = useState<PreFilledFight[] | null>(null);

  const urlToken = searchParams.get('token');
  const sessionToken = searchParams.get('session_token');

  useEffect(() => {
    if (!urlToken && !sessionToken) {
      setErrorMessage('No upload token or session token found in URL.');
      setPageStatus('error');
      return;
    }

    const fetchData = async () => {
      try {
        if (sessionToken) {
          // New flow: session_token provides everything in one go.
          const response = await fetch(`/api/upload-session/${sessionToken}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch session data');
          }
          const data = await response.json();

          setInitialFormData({
            champions: data.champions,
            nodes: data.nodes,
            players: data.players,
            user: data.user,
          });
          setPreFilledFights(data.fights);
          setToken(data.token);
        } else if (urlToken) {
          // Old flow: token provides form data, no pre-filled fights.
          const response = await fetch(`/api/form-data?token=${urlToken}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch form data');
          }
          const formData: InitialFormData = await response.json();
          setInitialFormData(formData);
          setToken(urlToken);
          setPreFilledFights(null); // No pre-filled fights in this flow
        }
        setPageStatus('ready');
      } catch (error: any) {
        console.error('Failed to fetch data:', error);
        setErrorMessage(error.message || 'An unknown error occurred.');
        setPageStatus('error');
      }
    };

    fetchData();
  }, [urlToken, sessionToken]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  if (pageStatus === 'loading') {
    return (
      <div className="flex flex-grow items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading fight data...</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'error') {
    return (
      <div className="container mx-auto p-4 max-w-4xl flex flex-grow items-center justify-center">
        <div className="text-center text-destructive">
          <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
          <h2 className="text-xl font-bold mb-2">Link Invalid or Expired</h2>
          <p className="mb-4">{errorMessage}</p>
          <p>Please request a new upload link from the CereBro bot in Discord.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Upload Alliance War Video</CardTitle>
          <CardDescription>Submit your MCOC Alliance War video and details.</CardDescription>
        </CardHeader>
        <CardContent>
          {initialFormData && token && (
            <WarVideoForm
              token={token}
              initialChampions={initialFormData.champions}
              initialNodes={initialFormData.nodes}
              initialPlayers={initialFormData.players}
              initialUserId={initialFormData.user.id}
              preFilledFights={preFilledFights}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
