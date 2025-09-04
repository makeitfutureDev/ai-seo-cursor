import React, { useState, useEffect } from 'react';
import { ExternalLink, Calendar, Building, Globe, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/helpers';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

interface ResponsesDisplayProps {
  companyId: string;
  language: 'en' | 'ro';
  selectedPeriod?: 'today' | '7_days' | '14_days' | '30_days';
}

interface Response {
  id: string;
  created_at: string;
  result: string;
  sources?: (number | string)[]; // Allow for array of numbers or strings
  source?: number; // Add singular source field for fallback
  prompt: {
    prompt: string;
    country: string;
  };
}

interface Source {
  id: number;
  link: string;
}

const ResponsesDisplay: React.FC<ResponsesDisplayProps> = ({ 
  companyId, 
  language, 
  selectedPeriod = '30_days' 
}) => {
  const [responses, setResponses] = useState<Response[]>([]);
  const [sources, setSources] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResponsesData();
  }, [companyId, selectedPeriod]);

  const getStartDate = async (period: 'today' | '7_days' | '14_days' | '30_days', companyId: string): Promise<string> => {
    const now = new Date();
    
    if (period === 'today') {
      try {
        // Find the most recent response for this company
        const { data: latestResponse, error } = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('responses')
          .select('created_at')
          .eq('company', companyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single());

        if (!error && latestResponse) {
          // Use the date of the latest response (start of that day in UTC)
          const latestDate = new Date(latestResponse.created_at);
          const startOfLatestDay = new Date(latestDate);
          startOfLatestDay.setUTCHours(0, 0, 0, 0);
          return startOfLatestDay.toISOString();
        }
      } catch (err) {
        console.error('Error finding latest response date:', err);
      }
      
      // Fallback to start of today (midnight UTC)
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      return startOfToday.toISOString();
    }
    
    const daysToSubtract = period === '7_days' ? 7 : period === '14_days' ? 14 : 30;
    const startDate = new Date(now.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
    return startDate.toISOString();
  };

  const fetchResponsesData = async () => {
    setLoading(true);
    setError('');

    try {
      const startDate = await getStartDate(selectedPeriod, companyId);

      // Fetch all response data including both source columns and prompt details
      const { data: responsesData, error: responsesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('responses')
        .select('*, prompt:prompts(prompt, country)')
        .eq('company', companyId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false }));

      console.log('Fetched responsesData:', responsesData);
      console.log('Error fetching responses:', responsesError);

      if (responsesError) {
        console.error('Error fetching responses:', responsesError);
        setError('Failed to load responses');
        return;
      }

      if (!responsesData || responsesData.length === 0) {
        setResponses([]);
        setSources(new Map());
        return;
      }

      // Collect all unique source IDs from all responses
      const allSourceIds = new Set<number>();
      responsesData.forEach(response => {
        // Prioritize the 'sources' array column
        if (response.sources && Array.isArray(response.sources)) {
          response.sources.forEach(sourceId => {
            // Convert to number if it's a string, then add to set
            const numId = typeof sourceId === 'string' ? parseInt(sourceId, 10) : sourceId;
            if (typeof numId === 'number' && !isNaN(numId)) {
              allSourceIds.add(numId);
            }
          });
        } else if (response.source) {
          // Fallback to singular 'source' if 'sources' array is not present
          const singleSourceId = typeof response.source === 'string' ? parseInt(response.source, 10) : response.source;
          if (typeof singleSourceId === 'number' && !isNaN(singleSourceId)) {
            allSourceIds.add(singleSourceId);
          }
        }
      });

      console.log('Collected allSourceIds:', Array.from(allSourceIds));

      // Fetch source details for all unique source IDs
      if (allSourceIds.size > 0) {
        const { data: sourcesData, error: sourcesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('sources')
          .select('id, link')
          .in('id', Array.from(allSourceIds)));

        console.log('Fetched sourcesData from sources table:', sourcesData);
        console.log('Error fetching sourcesData:', sourcesError);

        if (sourcesError) {
          console.error('Error fetching sources:', sourcesError);
          setError('Failed to load source details');
          return;
        }

        // Create a map of source ID to source link
        const sourcesMap = new Map<number, string>();
        if (sourcesData) {
          sourcesData.forEach(source => {
            sourcesMap.set(source.id, source.link);
          });
        }
        setSources(sourcesMap);
      }

      setResponses(responsesData as Response[]);

    } catch (err) {
      console.error('Error in fetchResponsesData:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'en' ? 'en-US' : 'ro-RO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const translations = {
    en: {
      title: 'AI Responses',
      subtitle: 'Recent responses from AI analysis',
      noResponses: 'No responses found for the selected period',
      loading: 'Loading responses...',
      sources: 'Sources',
      prompt: 'Prompt',
      country: 'Country',
      response: 'Response',
      date: 'Date'
    },
    ro: {
      title: 'Răspunsuri AI',
      subtitle: 'Răspunsuri recente din analiza AI',
      noResponses: 'Nu s-au găsit răspunsuri pentru perioada selectată',
      loading: 'Se încarcă răspunsurile...',
      sources: 'Surse',
      prompt: 'Prompt',
      country: 'Țară',
      response: 'Răspuns',
      date: 'Data'
    }
  };

  const t = translations[language];

  if (loading) {
    return (
      <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8">
        <div className="text-center">
          <Loader2 className="mx-auto w-8 h-8 text-white animate-spin mb-4" />
          <p className="text-white/70">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8">
        <div className="text-center">
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{t.title}</h3>
        <p className="text-white/70">{t.subtitle}</p>
      </div>

      {responses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/70">{t.noResponses}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {responses.map((response) => (
            <div key={response.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              {response.id === '112' && console.log('Processing response 112:', response)}
              {/* Response Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2 text-white/70 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(response.created_at)}</span>
                </div>
                {response.prompt && (
                  <div className="flex items-center space-x-2 text-white/70 text-sm">
                    <Globe className="h-4 w-4" />
                    <span>{response.prompt.country}</span>
                  </div>
                )}
              </div>

              {/* Prompt */}
              {response.prompt && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-white/90 mb-2">{t.prompt}:</h4>
                  <p className="text-white/80 text-sm bg-white/5 rounded-lg p-3">
                    {response.prompt.prompt}
                  </p>
                </div>
              )}

              {/* Response Content */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-white/90 mb-2">{t.response}:</h4>
                <div className="text-white/80 text-sm bg-white/5 rounded-lg p-3">
                  {response.result}
                </div>
              </div>

              {/* Sources */}
              {((response.sources && response.sources.length > 0) || response.source) && (
                <div>
                  <h4 className="text-sm font-medium text-white/90 mb-2">
                    {t.sources} ({response.sources ? response.sources.length : 1}):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(response.sources && response.sources.length > 0 ? response.sources : [response.source]).map((sourceId, index) => {
                      if (sourceId === null || sourceId === undefined) return null;
                      
                      const sourceLink = sources.get(
                        typeof sourceId === 'string' ? parseInt(sourceId, 10) : sourceId
                      );
                      
                      {response.id === '112' && console.log(`  Source ID ${sourceId}: link found?`, !!sourceLink, 'Link:', sourceLink)}
                      
                      if (!sourceLink) {
                        return (
                          <span 
                            key={`${sourceId}-${index}`}
                            className="inline-flex items-center space-x-1 bg-white/10 text-white/70 px-3 py-1 rounded-full text-xs"
                          >
                            <span>Source {sourceId} (unavailable)</span>
                          </span>
                        );
                      }

                      return (
                        <a
                          key={`${sourceId}-${index}`}
                          href={sourceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 bg-white/10 hover:bg-white/20 text-white/90 hover:text-white px-3 py-1 rounded-full text-xs transition-all"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Source {index + 1}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResponsesDisplay;