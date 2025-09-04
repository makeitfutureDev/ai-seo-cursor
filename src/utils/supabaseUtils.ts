import { supabase } from '../lib/supabase';
import { withTimeout } from './helpers';

// Smart query executor that handles connection issues automatically
export class SupabaseQueryExecutor {
  private static lastActivityTime = Date.now();
  private static readonly STALE_THRESHOLD = 60000; // 1 minute
  private static readonly DEFAULT_QUERY_TIMEOUT = 8000; // 8 seconds
  
  // Update last activity time
  static updateActivity() {
    this.lastActivityTime = Date.now();
  }
  
  // Check if connection might be stale
  static isConnectionStale() {
    return Date.now() - this.lastActivityTime > this.STALE_THRESHOLD;
  }
  
  // Execute query with automatic connection management
  static async executeQuery<T>(queryFn: () => any, timeoutMs: number = this.DEFAULT_QUERY_TIMEOUT): Promise<{ data: T | null; error: any }> {
    try {
      // If connection might be stale, refresh it first
      if (this.isConnectionStale()) {
        console.log('🔄 Connection might be stale, refreshing...');
        
        // Try to refresh the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.log('Session refresh needed:', sessionError);
          await withTimeout(supabase.auth.refreshSession(), timeoutMs);
        }
        
        // Small delay to ensure connection is ready
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update activity time
      this.updateActivity();
      
      // Execute the actual query
      const result = await withTimeout(queryFn(), timeoutMs);
      
      // If successful, update activity time again
      this.updateActivity();
      
      return result;
    } catch (error) {
      console.error('Query execution error:', error);
      
      // Try once more with a fresh connection
      try {
        console.log('🔄 Retrying with fresh connection...');
        await withTimeout(supabase.auth.refreshSession(), timeoutMs);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const result = await withTimeout(queryFn(), timeoutMs);
        this.updateActivity();
        return result;
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        return { data: null, error: retryError };
      }
    }
  }
}