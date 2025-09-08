import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, Loader2, Database, ChevronLeft, ChevronRight, Info, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

// Interface defining the props this component expects
interface SourcesListProps {
  companyId: string; // The unique identifier for the company
  language: 'en' | 'ro'; // Language selection for UI translations
}

// Interface defining the structure of a source object
interface Source {
  id: number; // Will be 0 for grouped sources (since we group by URL)
  link: string; // The URL of the source
  usage_count?: number; // How many times this source was used
  usage_percentage?: number; // Percentage of total usage
}

const SourcesList: React.FC<SourcesListProps> = ({ companyId, language }) => {
  // State for storing the list of sources
  const [sources, setSources] = useState<Source[]>([]);
  // State for tracking loading status (only for initial load)
  const [loading, setLoading] = useState(true);
  // State for tracking refresh status (background refresh)
  const [isRefreshing, setIsRefreshing] = useState(false);
  // State for storing error messages
  const [error, setError] = useState('');
  // State for pagination - current page number
  const [currentPage, setCurrentPage] = useState(1);
  // Ref to track if component is mounted (prevents state updates after unmount)
  const isMounted = useRef(true);
  // Ref to store visibility state handler
  const handleVisibilityChange = useRef<() => void>();
  
  // Number of items to show per page
  const ITEMS_PER_PAGE = 10;

  // Effect hook to cleanup on unmount
  useEffect(() => {
    // Mark component as mounted
    isMounted.current = true;
    
    // Cleanup function runs when component unmounts
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Main function to fetch sources data
  const fetchSources = useCallback(async (isBackgroundRefresh = false) => {
    console.log('🔍 SourcesList fetchSources called for companyId:', companyId);
    
    // Set appropriate loading state
    if (!isBackgroundRefresh) {
      setLoading(true);
      setError('');
    } else {
      setIsRefreshing(true);
    }

    try {
      console.log('💬 Fetching responses for company...');
      
      // STEP 1: Fetch all responses for this company using smart executor
      const { data: responses, error: responsesError } = await SupabaseQueryExecutor.executeQuery<any[]>(
        () => supabase
          .from('responses')
          .select('sources, source')
          .eq('company', companyId)
      );

      console.log('💬 Responses fetch result:', { 
        count: responses?.length || 0, 
        error: responsesError 
      });

      // Handle errors from responses query
      if (responsesError) {
        console.error('Error fetching responses:', responsesError);
        if (isMounted.current && !isBackgroundRefresh) {
          setError('Failed to load sources. Please try again.');
        }
        return false;
      }

      // Handle case where no responses exist
      if (!responses || responses.length === 0) {
        console.log('⚠️ No responses found for company');
        if (isMounted.current) {
          setSources([]);
        }
        return true;
      }

      // STEP 2: Process responses to collect source IDs
      console.log('🔄 Processing source IDs from responses...');
      
      // Map to count how many times each source ID is used
      const sourceIdCounts = new Map<number, number>();
      let totalSources = 0; // Total count for percentage calculation

      // Iterate through each response to extract source IDs
      responses.forEach(response => {
        // Handle array of sources (multiple sources per response)
        if (response.sources && Array.isArray(response.sources)) {
          response.sources.forEach(sourceId => {
            // Convert to number if it's a string
            const numId = typeof sourceId === 'string' ? parseInt(sourceId, 10) : sourceId;
            if (typeof numId === 'number' && !isNaN(numId)) {
              sourceIdCounts.set(numId, (sourceIdCounts.get(numId) || 0) + 1);
              totalSources++;
            }
          });
        }
        // Handle single source (backward compatibility)
        else if (response.source) {
          const numId = typeof response.source === 'string' ? parseInt(response.source, 10) : response.source;
          if (typeof numId === 'number' && !isNaN(numId)) {
            sourceIdCounts.set(numId, (sourceIdCounts.get(numId) || 0) + 1);
            totalSources++;
          }
        }
      });

      console.log('📊 Source processing result:', {
        uniqueSourceIds: sourceIdCounts.size,
        totalSources
      });

      // Handle case where no sources were found in responses
      if (sourceIdCounts.size === 0) {
        console.log('⚠️ No sources found in responses');
        if (isMounted.current) {
          setSources([]);
        }
        return true;
      }

      // STEP 3: Fetch source details (URLs) from sources table
      console.log('🔗 Fetching source details from sources table...');
      
      const { data: sourcesData, error: sourcesError } = await SupabaseQueryExecutor.executeQuery<any[]>(
        () => supabase
          .from('sources')
          .select('id, link')
          .in('id', Array.from(sourceIdCounts.keys()))
      );

      console.log('🔗 Sources details fetch result:', {
        count: sourcesData?.length || 0, 
        error: sourcesError
      });

      // Handle errors from sources query
      if (sourcesError) {
        console.error('Error fetching sources:', sourcesError);
        if (isMounted.current && !isBackgroundRefresh) {
          setError('Failed to load source details. Please try again.');
        }
        return false;
      }

      // Handle case where source details weren't found
      if (!sourcesData || sourcesData.length === 0) {
        console.log('⚠️ No source details found in sources table');
        if (isMounted.current) {
          setSources([]);
        }
        return true;
      }

      // STEP 4: Group sources by URL (multiple IDs might have same URL)
      console.log('🔄 Grouping sources by URL...');
      
      // Map to aggregate counts by URL
      const urlCounts = new Map<string, number>();
      
      sourcesData.forEach(source => {
        // Get the count for this source ID
        const count = sourceIdCounts.get(source.id) || 0;
        // Add to existing count for this URL or set initial count
        if (urlCounts.has(source.link)) {
          urlCounts.set(source.link, urlCounts.get(source.link)! + count);
        } else {
          urlCounts.set(source.link, count);
        }
      });

      // STEP 5: Convert to array and calculate percentages
      console.log('🔄 Converting to sources array...');
      
      const sourcesWithStats = Array.from(urlCounts.entries()).map(([link, usage_count]) => ({
        id: 0, // Using 0 as dummy ID since we're grouping by URL
        link, // The URL
        usage_count, // Number of times this URL was used
        usage_percentage: totalSources > 0 ? Math.round((usage_count / totalSources) * 100) : 0 // Percentage
      }));

      // STEP 6: Sort by usage count (most used first)
      console.log('📊 Sorting sources by usage...');
      sourcesWithStats.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));

      console.log('✅ Final sources processed:', sourcesWithStats.length);
      
      // Update state only if component is still mounted
      if (isMounted.current) {
        setSources(sourcesWithStats);
      }
      
      return true;

    } catch (err) {
      // Catch any unexpected errors
      console.error('Error in fetchSources:', err);
      if (isMounted.current && !isBackgroundRefresh) {
        setError('An unexpected error occurred. Please try again.');
        setSources([]);
      }
      return false;
    } finally {
      // Always hide loading indicators
      if (isMounted.current) {
        if (!isBackgroundRefresh) {
          setLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
      console.log('🔄 SourcesList fetchSources completed');
    }
  }, [companyId]);

  // Effect to fetch sources when component mounts or companyId changes
  useEffect(() => {
    if (companyId) {
      fetchSources(false);
    }
  }, [companyId, fetchSources]);

  // Effect to handle tab visibility changes
  useEffect(() => {
    // Create visibility change handler
    handleVisibilityChange.current = () => {
      if (document.visibilityState === 'visible' && companyId) {
        // Always refresh on visibility; executor will self-refresh session
        fetchSources(true);
        // Update Supabase activity
        SupabaseQueryExecutor.updateActivity();
      }
    };

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange.current);

    // Cleanup
    return () => {
      if (handleVisibilityChange.current) {
        document.removeEventListener('visibilitychange', handleVisibilityChange.current);
      }
    };
  }, [companyId, fetchSources]);

  // Effect to handle page focus (additional safety)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🎯 Window focused, updating activity...');
      SupabaseQueryExecutor.updateActivity();
    };

    const handleBlur = () => {
      console.log('😴 Window blurred...');
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Function to extract domain from a URL
  const getDomainFromUrl = (url: string): string => {
    if (!url) return '';
    try {
      // Parse the URL, adding https:// if not present
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      // Return hostname without www
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  // Function to get first letter of domain for avatar
  const getInitialFromDomain = (domain: string): string => {
    return domain.charAt(0).toUpperCase();
  };

  // Translation strings for internationalization
  const translations = {
    en: {
      title: 'Sources',
      subtitle: 'All sources across active models',
      allSources: 'All Sources',
      description: 'Complete list of sources used in AI responses',
      sourcesFound: 'sources found',
      noSources: 'No sources found',
      loading: 'Loading sources...',
      responses: 'responses',
      response: 'response',
      page: 'Page',
      of: 'of',
      previous: 'Previous',
      next: 'Next',
      usagePercentageTooltip: 'Percentage of chats using this source',
      error: 'Failed to load sources. Please try again.',
      retry: 'Retry',
    },
    ro: {
      title: 'Surse',
      subtitle: 'Toate sursele din modelele active',
      allSources: 'Toate Sursele',
      description: 'Lista completă de surse folosite în răspunsurile AI',
      sourcesFound: 'surse găsite',
      noSources: 'Nu s-au găsit surse',
      loading: 'Se încarcă sursele...',
      responses: 'răspunsuri',
      response: 'răspuns',
      page: 'Pagina',
      of: 'din',
      previous: 'Anterior',
      next: 'Următorul',
      usagePercentageTooltip: 'Procentul de conversații care folosesc această sursă',
      error: 'Eroare la încărcarea surselor. Vă rugăm încercați din nou.',
      retry: 'Reîncearcă',
    }
  };

  // Get translations for current language
  const t = translations[language];

  // Calculate pagination values
  const totalPages = Math.ceil(sources.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSources = sources.slice(startIndex, endIndex);

  // Handler for previous page button
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  // Handler for next page button
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  // Handler for retry button
  const handleRetry = () => {
    setError('');
    fetchSources(false);
  };

  // Render loading state (only for initial load)
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-white/90 text-lg">{t.subtitle}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8">
            <div className="text-center">
              <Loader2 className="mx-auto w-8 h-8 text-white animate-spin mb-4" />
              <p className="text-white/70">{t.loading}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-white/90 text-lg">{t.subtitle}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8">
            <div className="text-center">
              <p className="text-red-300 mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-white text-red-500 rounded-lg hover:bg-white/90 transition-colors"
              >
                {t.retry}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render main content
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-white/90 text-lg">{t.subtitle}</p>
        </div>

        <div className="rounded-2xl p-8 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                <span className="text-gray-700 text-sm">✓</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{t.allSources}</h3>
                <p className="text-gray-700 text-sm">{t.description}</p>
              </div>
            </div>
            <div>
              <div className="text-gray-900 font-medium">
                {sources.length} {t.sourcesFound}
                {sources.length > ITEMS_PER_PAGE && (
                  <span className="text-gray-600 text-sm ml-2">
                    ({t.page} {currentPage} {t.of} {totalPages})
                  </span>
                )}
              </div>
            </div>
          </div>

          {currentSources.length === 0 ? (
            // Render empty state
            <div className="text-center py-12">
              <Database className="mx-auto w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">{t.noSources}</p>
            </div>
          ) : (
            // Render sources list with optional refresh overlay
            <div className="relative">
              {/* Subtle overlay when refreshing in background */}
              {isRefreshing && (
                <div className="absolute inset-0 bg-white/50 z-10 pointer-events-none" />
              )}
              
              <div className="space-y-3">
                {currentSources.map((source) => {
                  const domain = getDomainFromUrl(source.link);
                  const initial = getInitialFromDomain(domain);
                  
                  return (
                    <div key={source.link} className="rounded-xl p-6 hover:opacity-80 transition-all" style={{ backgroundColor: '#fdedee' }}>
                      <div className="flex items-center">
                        {/* Avatar with domain initial */}
                        <div className="flex-shrink-0 h-12 w-12">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-white text-lg font-medium">{initial}</span>
                          </div>
                        </div>
                        
                        {/* Domain and URL */}
                        <div className="ml-4 flex-1">
                          <div className="text-gray-900 font-medium text-lg mb-1">{domain}</div>
                          <a 
                            href={source.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:text-gray-800 text-sm underline break-all"
                          >
                            {source.link}
                          </a>
                        </div>
                        
                        {/* Usage statistics */}
                        <div className="text-right">
                          <div className="flex items-center justify-end">
                            <div className="text-gray-900 font-bold text-2xl">{source.usage_percentage}%</div>
                            <div className="relative group ml-1">
                              <Info className="h-4 w-4 text-gray-500 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white p-2 rounded-md text-xs whitespace-nowrap opacity-0 pointer-events-none transition-opacity duration-300 group-hover:opacity-100 z-10">
                                {t.usagePercentageTooltip}
                              </div>
                            </div>
                          </div>
                          <div className="text-gray-600 text-sm">
                            {source.usage_count} {source.usage_count === 1 ? t.response : t.responses}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {sources.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{t.previous}</span>
              </button>
              
              <div className="flex items-center space-x-2">
                <span className="text-gray-700 text-sm">
                  {t.page} {currentPage} {t.of} {totalPages}
                </span>
              </div>
              
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span>{t.next}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SourcesList;