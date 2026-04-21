'use client';

import { getSupabaseBrowserClientResult } from '@/lib/supabase-browser';
import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type PublicUserContextValue = {
  supabaseReady: boolean;
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  savedVenueIds: string[];
  savedVenueIdsSet: Set<string>;
  savedVenuesLoading: boolean;
  isSavedVenue: (venueId: string) => boolean;
  refreshSavedVenues: () => Promise<void>;
  saveVenue: (venueId: string) => Promise<void>;
  unsaveVenue: (venueId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const PublicUserContext = createContext<PublicUserContextValue | null>(null);

async function authedJsonFetch<T>(
  accessToken: string,
  input: string,
  init?: RequestInit
) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

export function PublicUserProvider({ children }: { children: ReactNode }) {
  const supabaseResult = useMemo(() => getSupabaseBrowserClientResult(), []);
  const supabase = supabaseResult.client;
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [savedVenueIds, setSavedVenueIds] = useState<string[]>([]);
  const [savedVenuesLoading, setSavedVenuesLoading] = useState(false);

  const hydrateSavedVenues = useCallback(
    async (nextSession: Session | null) => {
      if (!supabase || !nextSession?.access_token) {
        setSavedVenueIds([]);
        setSavedVenuesLoading(false);
        return;
      }

      setSavedVenuesLoading(true);

      try {
        await authedJsonFetch(nextSession.access_token, '/api/public-profile', {
          method: 'POST',
        });

        const result = await authedJsonFetch<{
          savedVenueIds?: string[];
        }>(nextSession.access_token, '/api/public-saved-venues', {
          method: 'GET',
          cache: 'no-store',
        });

        setSavedVenueIds(result.savedVenueIds ?? []);
      } catch {
        setSavedVenueIds([]);
      } finally {
        setSavedVenuesLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setAuthLoading(false);
        void hydrateSavedVenues(data.session ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setAuthLoading(false);
        setSavedVenueIds([]);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setAuthLoading(false);
      void hydrateSavedVenues(nextSession ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrateSavedVenues, supabase]);

  const refreshSavedVenues = useCallback(async () => {
    await hydrateSavedVenues(session);
  }, [hydrateSavedVenues, session]);

  const saveVenue = useCallback(
    async (venueId: string) => {
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('AUTH_REQUIRED');
      }

      setSavedVenueIds((current) =>
        current.includes(venueId) ? current : [venueId, ...current]
      );

      try {
        await authedJsonFetch(accessToken, '/api/public-saved-venues', {
          method: 'POST',
          body: JSON.stringify({ venueId }),
        });
      } catch (error) {
        setSavedVenueIds((current) => current.filter((id) => id !== venueId));
        throw error;
      }
    },
    [session]
  );

  const unsaveVenue = useCallback(
    async (venueId: string) => {
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('AUTH_REQUIRED');
      }

      const previous = savedVenueIds;
      setSavedVenueIds((current) => current.filter((id) => id !== venueId));

      try {
        await authedJsonFetch(accessToken, '/api/public-saved-venues', {
          method: 'DELETE',
          body: JSON.stringify({ venueId }),
        });
      } catch (error) {
        setSavedVenueIds(previous);
        throw error;
      }
    },
    [savedVenueIds, session]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSavedVenueIds([]);
  }, [supabase]);

  const value = useMemo<PublicUserContextValue>(
    () => ({
      supabaseReady: Boolean(supabase),
      session,
      user: session?.user ?? null,
      authLoading,
      savedVenueIds,
      savedVenueIdsSet: new Set(savedVenueIds),
      savedVenuesLoading,
      isSavedVenue: (venueId: string) => savedVenueIds.includes(venueId),
      refreshSavedVenues,
      saveVenue,
      unsaveVenue,
      signOut,
    }),
    [
      authLoading,
      refreshSavedVenues,
      saveVenue,
      savedVenueIds,
      savedVenuesLoading,
      session,
      signOut,
      supabase,
      unsaveVenue,
    ]
  );

  return <PublicUserContext.Provider value={value}>{children}</PublicUserContext.Provider>;
}

export function usePublicUser() {
  const context = useContext(PublicUserContext);
  if (!context) {
    throw new Error('usePublicUser must be used within PublicUserProvider.');
  }
  return context;
}
