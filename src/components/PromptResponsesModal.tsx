import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Globe, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DatePicker from 'react-datepicker';
import { format, parseISO, addDays, subDays, isSameDay, isBefore } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import { withTimeout } from '../utils/helpers';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

interface PromptResponsesModalProps {
  promptId: string;
  companyId: string;
  language: 'en' | 'ro';
  onClose: () => void;
}

interface Response {
  id: string;
  created_at: string;
  result: string;
  sources?: (number | string)[];
  source?: number;
  analysis?: Array<{
    company_appears: boolean;
    sentiment: number;
    position: number;
  }>;
  aggregatedMetrics?: {
    visibility: number;
    position: number | null;
    sentiment: number | null;
  };
  prompt?: {
    prompt: string;
    country: string;
  };
}

const PromptResponsesModal: React.FC<PromptResponsesModalProps> = ({
  promptId,
  companyId,
  language,
  onClose
}) => {
  const [currentDate, setCurrentDate] = useState<string>('');
  const [responsesForDay, setResponsesForDay] = useState<Response[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [error, setError] = useState('');
  const [sourcesMap, setSourcesMap] = useState<Map<number, string>>(new Map());
  const [promptDetails, setPromptDetails] = useState<{ prompt: string; country: string } | null>(null);
  const [isCurrentDateToday, setIsCurrentDateToday] = useState(false);
  const [todayDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [companyAsCompetitorId, setCompanyAsCompetitorId] = useState<number | null>(null);
  const [totalApprovedCompetitorsCount, setTotalApprovedCompetitorsCount] = useState<number>(0);

  const translations = {
    en: {
      title: 'Prompt Responses',
      loadingResponse: 'Loading responses...',
      noResponses: 'No responses found for this date',
      source: 'Source',
      unavailable: 'unavailable',
      close: 'Close',
      prompt: 'Prompt',
      response: 'Response',
      sources: 'Sources',
      todayIsLatest: 'Today is the latest available date',
      position: 'Position',
      sentiment: 'Sentiment',
      visibility: 'Visibility',
      positive: 'Positive',
      neutral: 'Neutral',
      negative: 'Negative'
    },
    ro: {
      title: 'Răspunsuri Prompt',
      loadingResponse: 'Se încarcă răspunsurile...',
      noResponses: 'Nu s-au găsit răspunsuri pentru această dată',
      source: 'Sursă',
      unavailable: 'indisponibil',
      close: 'Închide',
      prompt: 'Prompt',
      response: 'Răspuns',
      sources: 'Surse',
      todayIsLatest: 'Astăzi este cea mai recentă dată disponibilă',
      position: 'Poziție',
      sentiment: 'Sentiment',
      visibility: 'Vizibilitate',
      positive: 'Pozitiv',
      neutral: 'Neutru',
      negative: 'Negativ'
    }
  };

  const t = translations[language];

  // Helper function to get sentiment display
  const getSentimentDisplay = (sentimentValue: number | null | undefined) => {
    if (sentimentValue === null || sentimentValue === undefined) {
      return { label: '—', colorClass: 'bg-gray-300' };
    }
    
    // Handle 0-100 sentiment scale: 0-33 negative, 34-66 neutral, 67-100 positive
    if (sentimentValue >= 67) {
      return { label: t.positive, colorClass: 'bg-green-500' };
    } else if (sentimentValue >= 34) {
      return { label: t.neutral, colorClass: 'bg-gray-400' };
    } else {
      return { label: t.negative, colorClass: 'bg-red-500' };
    }
  };

  // Helper function to get day bounds in UTC
  const getDayBounds = (dateString: string) => {
    // Parse the local date string (YYYY-MM-DD) and create local Date objects
    const [year, month, day] = dateString.split('-').map(Number);
    
    // Create start of local day (00:00:00 local time)
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    
    // Create end of local day (23:59:59.999 local time)
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    return {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString()
    };
  };

  // Helper function to extract domain from URL
  const getDomainFromUrl = (url: string): string => {
    if (!url) return '';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Helper function to format response text with proper markdown parsing
  const formatResponseText = (text: string): string => {
    if (!text) return '';
    
    // First, handle inline formatting
    let formatted = text
      // Convert **bold** to <strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert *italic* to <em>
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Split into lines for processing
    const lines = formatted.split('\n');
    const result = [];
    let currentList = null;
    let currentListType = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for numbered list items
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        if (currentListType !== 'ol') {
          if (currentList) {
            result.push(`</${currentListType}>`);
          }
          result.push('<ol class="list-decimal list-inside ml-4 mb-4 space-y-1">');
          currentList = [];
          currentListType = 'ol';
        }
        result.push(`<li class="text-gray-900">${numberedMatch[2]}</li>`);
        continue;
      }
      
      // Check for bullet list items
      const bulletMatch = line.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        if (currentListType !== 'ul') {
          if (currentList) {
            result.push(`</${currentListType}>`);
          }
          result.push('<ul class="list-disc list-inside ml-4 mb-4 space-y-1">');
          currentList = [];
          currentListType = 'ul';
        }
        result.push(`<li class="text-gray-900">${bulletMatch[1]}</li>`);
        continue;
      }
      
      // If we were in a list and this line doesn't match, close the list
      if (currentList) {
        result.push(`</${currentListType}>`);
        currentList = null;
        currentListType = null;
      }
      
      // Handle regular paragraphs
      if (line) {
        result.push(`<p class="mb-4 text-gray-900">${line}</p>`);
      } else {
        // Empty line - add spacing
        result.push('<div class="mb-2"></div>');
      }
    }
    
    // Close any remaining list
    if (currentList) {
      result.push(`</${currentListType}>`);
    }
    
    return result.join('');
  };

  // Fetch available dates for navigation
  const fetchAvailableDates = async () => {
    try {
      const { data: responses, error } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('responses')
        .select('created_at')
        .eq('prompt', promptId)
        .eq('company', companyId)
        .order('created_at', { ascending: false }));

      if (error) {
        console.error('Error fetching available dates:', error);
        return [];
      }

      if (!responses || responses.length === 0) {
        return [];
      }

      // Extract unique dates and sort them
      const uniqueDates = Array.from(
        new Set(
          responses.map(response => 
            format(new Date(response.created_at), 'yyyy-MM-dd')
          )
        )
      ).sort();

      return uniqueDates;
    } catch (err) {
      console.error('Error fetching available dates:', err);
      return [];
    }
  };

  // Initial data fetching - find most recent date with responses and fetch available dates
  useEffect(() => {
    const initializeModal = async () => {
      setLoadingResponses(true);
      setError('');

      try {
        // First, fetch the company's name and find its competitor ID
        const { data: companyData, error: companyError } = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('companies')
          .select('name')
          .eq('id', companyId)
          .single());

        if (companyError || !companyData) {
          console.error('Error fetching company data:', companyError);
          setError('Failed to load company information');
          return;
        }

        // Find the competitor ID that represents this company
        const { data: competitorData, error: competitorError } = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('competitors')
          .select('id')
          .eq('company', companyId)
          .eq('name', companyData.name)
          .single());

        if (competitorError || !competitorData) {
          console.error('Error fetching company as competitor:', competitorError);
          // Don't fail completely, but log this issue
          console.warn('Company not found in competitors table, analysis data may not display correctly');
        } else {
          setCompanyAsCompetitorId(competitorData.id);
          console.log('Found company as competitor with ID:', competitorData.id);
          
          // Fetch total approved competitors count
          const { data: allCompetitors, error: allCompetitorsError } = await SupabaseQueryExecutor.executeQuery(() => supabase
            .from('competitors')
            .select('id')
            .eq('company', companyId)
            .eq('approved', true));

          if (allCompetitorsError) {
            console.error('Error fetching total competitors count:', allCompetitorsError);
          } else {
            let count = allCompetitors?.length || 0;
            // Check if the company itself is counted as a competitor and exclude it
            if (competitorData.id && allCompetitors?.some(comp => comp.id === competitorData.id)) {
              count--;
            }
            setTotalApprovedCompetitorsCount(count);
            console.log('Total approved competitors count:', count);
          }
        }

        // First, fetch all available dates
        const dates = await fetchAvailableDates();
        setAvailableDates(dates);

        if (dates.length === 0) {
          setError('No responses found for this prompt');
          return;
        }

        // First, try to get responses for today
        const today = new Date().toISOString().split('T')[0];
        
        if (dates.includes(today)) {
          // Found responses for today
          setCurrentDate(today);
          setIsCurrentDateToday(true);
        } else {
          // No responses for today, use the most recent date
          const mostRecentDate = dates[dates.length - 1]; // dates are sorted, so last is most recent
          setCurrentDate(mostRecentDate);
          setIsCurrentDateToday(mostRecentDate === today);
        }
      } catch (err) {
        console.error('Error initializing modal:', err);
        setError('Failed to load responses');
      } finally {
        setLoadingResponses(false);
      }
    };

    initializeModal();
  }, [promptId, companyId]);

  // Fetch responses when currentDate changes
  useEffect(() => {
    if (!currentDate || companyAsCompetitorId === null) return;

    // Update isCurrentDateToday when currentDate changes
    const today = format(new Date(), 'yyyy-MM-dd');
    setIsCurrentDateToday(currentDate === today);

    const fetchResponses = async () => {
      setLoadingResponses(true);
      setError('');

      try {
        const dayBounds = getDayBounds(currentDate);

        const { data: responses, error: responsesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('responses')
          .select(`
            *,
            analysis:response_analysis(*),
            prompt:prompts(prompt, country)
          `)
          .eq('prompt', promptId)
          .eq('company', companyId)
          .gte('created_at', dayBounds.start)
          .lte('created_at', dayBounds.end)
          .order('created_at', { ascending: false }));

        if (responsesError) {
          console.error('Error fetching responses:', responsesError);
          setError('Failed to load responses');
          return;
        }

        setResponsesForDay(responses || []);
        
        // Set prompt details from first response
        if (responses && responses.length > 0 && responses[0]?.prompt) {
          setPromptDetails(responses[0].prompt);
        }

        // Aggregate analysis data for the current company
        if (responses && companyAsCompetitorId !== null && totalApprovedCompetitorsCount > 0) {
          responses.forEach(response => {
            if (response.analysis && Array.isArray(response.analysis)) {
              // Filter to get all analysis entries for the current company
              const companyAnalysis = response.analysis.filter(analysis => 
                analysis.competitor === companyAsCompetitorId
              );
              
              console.log(`Response ${response.id}: Found ${companyAnalysis.length} analysis entries for company`);
              
              if (companyAnalysis.length > 0) {
                // Calculate aggregated visibility
                const appearsCount = companyAnalysis.filter(analysis => analysis.company_appears).length;
                const visibility = Math.round((appearsCount / companyAnalysis.length) * 100);
                
                // Calculate aggregated position
                let positionSum = 0;
                let validPositions = 0;
                
                companyAnalysis.forEach(analysis => {
                  let position = analysis.position;
                  // If position is 0, null, or undefined, replace with total competitors count
                  if (position === 0 || position === null || position === undefined) {
                    position = totalApprovedCompetitorsCount + 1;
                  }
                  positionSum += position;
                  validPositions++;
                });
                
                const avgPosition = validPositions > 0 ? Math.round(positionSum / validPositions) : null;
                
                // Calculate aggregated sentiment
                const validSentiments = companyAnalysis
                  .map(analysis => analysis.sentiment)
                  .filter(sentiment => sentiment !== null && sentiment !== undefined);
                
                const avgSentiment = validSentiments.length > 0 
                  ? validSentiments.reduce((sum, sentiment) => sum + sentiment, 0) / validSentiments.length
                  : null;
                
                // Store aggregated metrics
                response.aggregatedMetrics = {
                  visibility,
                  position: avgPosition,
                  sentiment: avgSentiment
                };
                
                console.log(`Response ${response.id} aggregated metrics:`, response.aggregatedMetrics);
              } else {
                response.aggregatedMetrics = {
                  visibility: 0,
                  position: null,
                  sentiment: null
                };
              }
            }
          });
        }

        // Fetch sources for these responses
        await fetchSources(responses || []);

      } catch (err) {
        console.error('Error fetching responses:', err);
        setError('Failed to load responses');
      } finally {
        setLoadingResponses(false);
      }
    };

    fetchResponses();
  }, [currentDate, promptId, companyId, companyAsCompetitorId, totalApprovedCompetitorsCount]);

  // Fetch sources for responses
  const fetchSources = async (responses: Response[]) => {
    const allSourceIds = new Set<number>();

    responses.forEach(response => {
      // Handle sources array
      if (response.sources && Array.isArray(response.sources)) {
        response.sources.forEach(sourceId => {
          const numId = typeof sourceId === 'string' ? parseInt(sourceId, 10) : sourceId;
          if (typeof numId === 'number' && !isNaN(numId)) {
            allSourceIds.add(numId);
          }
        });
      }
      // Handle single source
      else if (response.source) {
        const numId = typeof response.source === 'string' ? parseInt(response.source, 10) : response.source;
        if (typeof numId === 'number' && !isNaN(numId)) {
          allSourceIds.add(numId);
        }
      }
    });

    if (allSourceIds.size > 0) {
      const { data: sourcesData, error: sourcesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('sources')
        .select('id, link')
        .in('id', Array.from(allSourceIds)));

      if (!sourcesError && sourcesData) {
        const newSourcesMap = new Map<number, string>();
        sourcesData.forEach(source => {
          newSourcesMap.set(source.id, source.link);
        });
        setSourcesMap(newSourcesMap);
      }
    }
  };

  // Navigate to previous day
  const navigateToPreviousDay = () => {
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex > 0) {
      setCurrentDate(availableDates[currentIndex - 1]);
    }
  };

  // Navigate to next day
  const navigateToNextDay = () => {
    const currentIndex = availableDates.indexOf(currentDate);
    if (currentIndex < availableDates.length - 1 && !isCurrentDateToday) {
      setCurrentDate(availableDates[currentIndex + 1]);
    }
  };

  // Handle date input change
  const handleDateChange = (date: Date | null) => {
    if (!date) return;
    
    const selectedDate = format(date, 'yyyy-MM-dd');
    // Only allow navigation to dates that have responses
    if (availableDates.includes(selectedDate)) {
      setCurrentDate(selectedDate);
    }
  };

  // Custom input component for DatePicker
  const CustomInput = React.forwardRef<HTMLInputElement, any>(({ value, onClick }, ref) => (
    <div className="relative cursor-pointer" onClick={onClick}>
      <input
        ref={ref}
        type="text"
        value={value}
        readOnly
        className="px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer hover:bg-gray-50 transition-colors"
      />
      <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl transform transition-all border border-purple-200">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{t.title}</h3>
            
            {/* Date Navigation Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={navigateToPreviousDay}
                disabled={availableDates.indexOf(currentDate) <= 0}
                className="p-2 rounded-lg hover:bg-purple-100 transition-colors"
                title="Previous day"
              >
                <ChevronLeft className={`h-5 w-5 ${
                  availableDates.indexOf(currentDate) <= 0 ? 'text-gray-300' : 'text-purple-600'
                }`} />
              </button>
              
              <DatePicker
                selected={currentDate ? parseISO(currentDate) : null}
                onChange={handleDateChange}
                dateFormat="MMM dd, yyyy"
                maxDate={new Date()}
                customInput={<CustomInput />}
                popperPlacement="bottom-end"
                filterDate={(date) => {
                  const dateString = format(date, 'yyyy-MM-dd');
                  return availableDates.includes(dateString);
                }}
                />
              
              <button
                onClick={navigateToNextDay}
                disabled={availableDates.indexOf(currentDate) >= availableDates.length - 1 || isCurrentDateToday}
                className={`p-2 rounded-lg transition-colors ${
                  (availableDates.indexOf(currentDate) >= availableDates.length - 1 || isCurrentDateToday)
                    ? 'cursor-not-allowed opacity-50' 
                    : 'hover:bg-purple-100 cursor-pointer'
                }`}
                title={(availableDates.indexOf(currentDate) >= availableDates.length - 1 || isCurrentDateToday) ? t.todayIsLatest : 'Next day'}
              >
                <ChevronRight className={`h-5 w-5 ${
                  (availableDates.indexOf(currentDate) >= availableDates.length - 1 || isCurrentDateToday) ? 'text-gray-300' : 'text-purple-600'
                }`} />
              </button>
            </div>
          </div>
            <div className="relative">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loadingResponses ? (
          <div className="text-center py-12">
            <Loader2 className="mx-auto w-8 h-8 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-600">{t.loadingResponse}</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
          </div>
        ) : responsesForDay.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">{t.noResponses}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Prompt Details - Show once at the top */}
            {promptDetails && (
              <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-purple-700">{t.prompt}:</h4>
                  <div className="flex items-center space-x-2 text-blue-600 text-sm">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <span>{promptDetails.country}</span>
                  </div>
                </div>
                <p className="text-gray-700 text-sm">
                  {promptDetails.prompt}
                </p>
              </div>
            )}

            {/* Responses */}
            {responsesForDay.map((response, index) => (
              <div key={response.id} className="bg-white/80 backdrop-blur-sm border border-purple-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all">
                {/* Response Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2 text-purple-600 text-sm">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span>
                      {new Date(response.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'ro-RO', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <span className="text-sm text-blue-500 font-medium">Response {index + 1}</span>
                </div>

                {/* Analysis Data */}
                {response.aggregatedMetrics && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
                    <div className="grid grid-cols-3 gap-4">
                      {/* Position */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">{t.position}</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-700">
                          {/* DEBUG LOGS START */}
                          {console.log('DEBUG: totalApprovedCompetitorsCount:', totalApprovedCompetitorsCount)}
                          {console.log('DEBUG: response.aggregatedMetrics.position:', response.aggregatedMetrics.position)}
                          {console.log('DEBUG: totalApprovedCompetitorsCount + 1:', totalApprovedCompetitorsCount + 1)}
                          {console.log('DEBUG: Comparison result (position === totalApprovedCompetitorsCount + 1):', response.aggregatedMetrics.position === (totalApprovedCompetitorsCount + 1))}
                          {/* DEBUG LOGS END */}
                          {response.aggregatedMetrics.position === null || response.aggregatedMetrics.position === (totalApprovedCompetitorsCount + 1)
                            ? '—'
                            : response.aggregatedMetrics.position
                          }
                        </div>
                      </div>

                      {/* Sentiment */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">{t.sentiment}</span>
                        </div>
                        <div className="flex items-center justify-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getSentimentDisplay(response.aggregatedMetrics.sentiment).colorClass}`}></div>
                          <span className="text-sm font-medium text-purple-700">
                            {getSentimentDisplay(response.aggregatedMetrics.sentiment).label}
                          </span>
                        </div>
                      </div>

                      {/* Visibility */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <span className="text-xs font-medium text-green-600 uppercase tracking-wide">{t.visibility}</span>
                        </div>
                        <div className="text-2xl font-bold text-green-700">
                          {response.aggregatedMetrics.visibility}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Response Content */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-indigo-700 mb-2">{t.response}:</h4>
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                    <div 
                      className="text-gray-800 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: formatResponseText(response.result || t.noResponses)
                      }}
                    />
                  </div>
                </div>

                {/* Sources */}
                {((response.sources && response.sources.length > 0) || response.source) && (
                  <div>
                    <h4 className="text-sm font-medium text-orange-700 mb-2">
                      {t.sources} ({response.sources ? response.sources.length : 1}):
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(response.sources && response.sources.length > 0 ? response.sources : [response.source]).map((sourceId, sourceIndex) => {
                        if (sourceId === null || sourceId === undefined) return null;
                        
                        const sourceLink = sourcesMap.get(
                          typeof sourceId === 'string' ? parseInt(sourceId, 10) : sourceId
                        );
                        
                        if (!sourceLink) {
                          return (
                            <span 
                              key={`${sourceId}-${sourceIndex}`}
                              className="inline-flex items-center space-x-1 bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs"
                            >
                              <span>{t.source} {sourceId} ({t.unavailable})</span>
                            </span>
                          );
                        }

                        const domain = getDomainFromUrl(sourceLink);

                        return (
                          <a
                            key={`${sourceId}-${sourceIndex}`}
                            href={sourceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 bg-gradient-to-r from-orange-100 to-pink-100 hover:from-orange-200 hover:to-pink-200 text-orange-800 hover:text-orange-900 px-3 py-1 rounded-full text-xs transition-all border border-orange-200 hover:border-orange-300"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>{domain}</span>
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

        {/* Footer */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl font-medium hover:from-gray-200 hover:to-gray-300 transition-all shadow-md hover:shadow-lg"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptResponsesModal;