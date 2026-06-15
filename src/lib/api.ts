import { supabase } from './supabase';

export async function authorizedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      const { data: { session: refreshed } } = await supabase.auth.refreshSession();
      if (!refreshed) throw new Error("Session expired");
      const retryHeaders = { ...headers, 'Authorization': `Bearer ${refreshed.access_token}` };
      return fetch(url, { ...options, headers: retryHeaders });
    }

    return response;
  } catch (error: any) {
    throw error;
  }
}
