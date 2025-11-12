'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
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
        // Fetch initial form data (champions, nodes, players, user)
        const formDataResponse = await fetch(`/api/form-data?token=${urlToken}`);
        if (!formDataResponse.ok) {
          const errorData = await formDataResponse.json();
          throw new Error(errorData.error || 'Failed to fetch form data');
        }
        const formData: InitialFormData = await formDataResponse.json();
        setInitialFormData(formData);
        setToken(urlToken); // Set the token for form submission

        // If a session token is present, fetch pre-filled fight data
        if (sessionToken) {
          const sessionDataResponse = await fetch(`/api/upload-session/${sessionToken}`);
          if (!sessionDataResponse.ok) {
            const errorData = await sessionDataResponse.json();
            throw new Error(errorData.error || 'Failed to fetch session data');
          }
          const sessionFights: PreFilledFight[] = await sessionDataResponse.json();
          setPreFilledFights(sessionFights);
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

  const renderContent = () => {
    switch (pageStatus) {
      case 'loading':
        return <p className="text-center text-muted-foreground">Loading form data...</p>;
      case 'error':
        return (
          <div className="text-center text-destructive">
            <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
            <h2 className="text-xl font-bold mb-2">Link Invalid or Expired</h2>
            <p className="mb-4">{errorMessage}</p>
            <p>Please request a new upload link from the CereBro bot in Discord.</p>
          </div>
        );
      case 'ready':
        if (!initialFormData || !token) return null;
        return (
          <WarVideoForm
            token={token}
            initialChampions={initialFormData.champions}
            initialNodes={initialFormData.nodes}
            initialPlayers={initialFormData.players}
            initialUserId={initialFormData.user.id}
            preFilledFights={preFilledFights}
          />
        );
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Upload Alliance War Video</CardTitle>
          <CardDescription>Submit your MCOC Alliance War video and details.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
