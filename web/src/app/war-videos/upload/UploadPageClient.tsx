'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { WarVideoForm } from './WarVideoForm';
import { Champion } from '@/types/champion';

// Define types for fetched data
interface WarNode {
  id: number;
  nodeNumber: number;
  description?: string;
}

interface Player {
  id: string;
  ingameName: string;
}

interface FormData {
  champions: Champion[];
  nodes: WarNode[];
  players: Player[];
  user: { id: string };
}

type PageStatus = 'loading' | 'ready' | 'error';

export default function UploadWarVideoPage() {
  const searchParams = useSearchParams();
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);

  const urlToken = searchParams.get('token');

  useEffect(() => {
    if (!urlToken) {
      setErrorMessage('No upload token found in URL.');
      setPageStatus('error');
      return;
    }
    setToken(urlToken);

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/form-data?token=${urlToken}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch form data');
        }
        const data: FormData = await response.json();
        setFormData(data);
        setPageStatus('ready');
      } catch (error: any) {
        console.error('Failed to fetch form data:', error);
        setErrorMessage(error.message || 'An unknown error occurred.');
        setPageStatus('error');
      }
    };
    fetchData();
  }, [urlToken]);

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
        if (!formData || !token) return null;
        return (
          <WarVideoForm
            token={token}
            initialChampions={formData.champions}
            initialNodes={formData.nodes}
            initialPlayers={formData.players}
            initialUserId={formData.user.id}
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
