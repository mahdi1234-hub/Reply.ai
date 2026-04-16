"use client";

import { useEffect, useState } from "react";
import {
  KnockProvider,
  KnockFeedProvider,
} from "@knocklabs/react";

import "@knocklabs/react/dist/index.css";

interface ClientProvidersProps {
  children: React.ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUserId(data.user.id);
          }
        }
      } catch {
        // Not authenticated
      }
    };
    fetchSession();
  }, []);

  const publicApiKey = process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY;
  const feedChannelId = process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID;

  if (!userId || !publicApiKey || !feedChannelId) {
    return <>{children}</>;
  }

  return (
    <KnockProvider apiKey={publicApiKey} userId={userId}>
      <KnockFeedProvider feedId={feedChannelId}>
        {children}
      </KnockFeedProvider>
    </KnockProvider>
  );
}
