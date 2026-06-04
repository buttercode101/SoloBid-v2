import { auth } from './firebase';

export async function authorizedFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    
    const token = await user.getIdToken(true); // Force refresh
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    const response = await fetch(url, { ...options, headers });
    
    // Handle 401 - token might be invalid
    if (response.status === 401) {
      // Try to refresh and retry once
      const newToken = await user.getIdToken(true);
      const retryHeaders = {
        ...headers,
        'Authorization': `Bearer ${newToken}`
      };
      return fetch(url, { ...options, headers: retryHeaders });
    }
    
    return response;
  } catch (error: any) {
    if (error.code === 'auth/network-request-failed') {
      throw new Error("Network error - check your connection");
    }
    throw error;
  }
}
