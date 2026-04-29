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

export type VenueIntentType = 'thinking' | 'going';

export type VenueIntentState = {
  thinking_count: number;
  going_count: number;
  user_intent: VenueIntentType | null;
};

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
  venueIntents: Record<string, VenueIntentState>;
  getVenueIntent: (venueId: string) => VenueIntentState | null;
  refreshVenueIntent: (venueId: string) => Promise<void>;
  toggleVenueIntent: (venueId: string, intentType: VenueIntentType) => Promise<void>;
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
  const [venueIntents, setVenueIntents] = useState<Record<string, VenueIntentState>>({});

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

  const fetchVenueIntent = useCallback(
    async (venueId: string) => {
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `/api/public-venue-intents?venue_id=${encodeURIComponent(venueId)}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers,
        }
      );

      const payload = (await response.json()) as VenueIntentState & {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Request failed with status ${response.status}`);
      }

      return {
        thinking_count: payload.thinking_count ?? 0,
        going_count: payload.going_count ?? 0,
        user_intent: payload.user_intent ?? null,
      };
    },
    [session]
  );

  const refreshVenueIntent = useCallback(
    async (venueId: string) => {
      const nextIntent = await fetchVenueIntent(venueId);
      setVenueIntents((current) => ({
        ...current,
        [venueId]: nextIntent,
      }));
    },
    [fetchVenueIntent]
  );

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

  const toggleVenueIntent = useCallback(
    async (venueId: string, intentType: VenueIntentType) => {
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('AUTH_REQUIRED');
      }

      const previous = venueIntents[venueId] ?? {
        thinking_count: 0,
        going_count: 0,
        user_intent: null,
      };
      const removing = previous.user_intent === intentType;
      const nextUserIntent = removing ? null : intentType;

      const nextIntent: VenueIntentState = {
        thinking_count:
          previous.thinking_count -
          (previous.user_intent === 'thinking' ? 1 : 0) +
          (nextUserIntent === 'thinking' ? 1 : 0),
        going_count:
          previous.going_count -
          (previous.user_intent === 'going' ? 1 : 0) +
          (nextUserIntent === 'going' ? 1 : 0),
        user_intent: nextUserIntent,
      };

      setVenueIntents((current) => ({
        ...current,
        [venueId]: {
          thinking_count: Math.max(0, nextIntent.thinking_count),
          going_count: Math.max(0, nextIntent.going_count),
          user_intent: nextIntent.user_intent,
        },
      }));

      try {
        const result = await authedJsonFetch<VenueIntentState>(
          accessToken,
          '/api/public-venue-intents',
          {
            method: 'POST',
            body: JSON.stringify({ venueId, intentType }),
          }
        );

        setVenueIntents((current) => ({
          ...current,
          [venueId]: {
            thinking_count: result.thinking_count ?? 0,
            going_count: result.going_count ?? 0,
            user_intent: result.user_intent ?? null,
          },
        }));
      } catch (error) {
        setVenueIntents((current) => ({
          ...current,
          [venueId]: previous,
        }));
        throw error;
      }
    },
    [session, venueIntents]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSavedVenueIds([]);
    setVenueIntents({});
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
      venueIntents,
      getVenueIntent: (venueId: string) => venueIntents[venueId] ?? null,
      refreshVenueIntent,
      toggleVenueIntent,
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
      refreshVenueIntent,
      toggleVenueIntent,
      unsaveVenue,
      venueIntents,
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
