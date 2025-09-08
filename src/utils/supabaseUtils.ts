import { supabase } from '../lib/supabase';
import { withTimeout } from './helpers';

// Smart query executor that handles connection issues automatically
export class SupabaseQueryExecutor {
  private static lastActivityTime = Date.now();
  private static readonly STALE_THRESHOLD = 120000; // 2 minutes
  private static readonly DEFAULT_QUERY_TIMEOUT = 30000; // 30 seconds
  
  // Update last activity time
  static updateActivity() {
    this.lastActivityTime = Date.now();
  }
  
  // Check if connection might be stale
  static isConnectionStale() {
    return Date.now() - this.lastActivityTime > this.STALE_THRESHOLD;
  }

  // Ensure we have a fresh, valid session. Do not wrap in timeouts to avoid timer throttling issues.
  private static async ensureFreshSession() {
    const { data: { session } } = await supabase.auth.getSession();
    const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;
    const expiringSoon = !session || (expiresAtMs - Date.now() < 15000);

    if (expiringSoon) {
      await supabase.auth.refreshSession();
      await Promise.resolve();
    }
  }
  
  // Execute query with automatic connection management
  static async executeQuery<T>(queryFn: () => Promise<any>, timeoutMs: number = this.DEFAULT_QUERY_TIMEOUT): Promise<{ data: T | null; error: any }> {
    try {
      if (this.isConnectionStale()) {
        await this.ensureFreshSession();
      }
      
      this.updateActivity();
      
      // Execute the actual query with a single timeout layer
      const result = await withTimeout(queryFn(), timeoutMs);
      
      // If successful, update activity time again
      this.updateActivity();
      
      return result;
    } catch (error) {
      // Try once more after refreshing the session explicitly
      try {
        await this.ensureFreshSession();
        const result = await withTimeout(queryFn(), timeoutMs);
        this.updateActivity();
        return result;
      } catch (retryError) {
        return { data: null, error: retryError };
      }
    }
  }
}