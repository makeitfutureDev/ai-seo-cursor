import React, { useState, useEffect } from 'react';
import { Database, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/helpers';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

interface SourcesPreviewProps {
  companyId: string;
  language: 'en' | 'ro';
  setCurrentView?: (view: 'dashboard' | 'prompts' | 'competitors' | 'sources') => void;
  setCurrentView: (view: 'dashboard' | 'prompts' | 'competitors' | 'sources') => void;
}

interface Source {
  id: number; // Will be 0 for grouped sources
  link: string;
  usage_count?: number;
  usage_percentage?: number;
}

const SourcesPreview: React.FC<SourcesPreviewProps> = ({ companyId, language, setCurrentView }) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (companyId) {
      fetchSources();
    }
  }, [companyId]);

  const fetchSources = async () => {
    setLoading(true);
    setError('');

    try {
      // Get all responses for this company
      const { data: responses, error: responsesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('responses')
        .select('sources, source')
        .eq('company', companyId));

      if (responsesError || !responses) {
        setSources([]);
        setLoading(false);
        return false;
      }

      // Collect all unique source IDs
      const sourceIdCounts = new Map<number, number>();
      let totalSources = 0;

      responses.forEach(response => {
        // Handle sources array
        if (response.sources && Array.isArray(response.sources)) {
          response.sources.forEach(sourceId => {
            const numId = typeof sourceId === 'string' ? parseInt(sourceId, 10) : sourceId;
            if (typeof numId === 'number' && !isNaN(numId)) {
              sourceIdCounts.set(numId, (sourceIdCounts.get(numId) || 0) + 1);
              totalSources++;
            }
          });
        }
        // Handle single source
        else if (response.source) {
          const numId = typeof response.source === 'string' ? parseInt(response.source, 10) : response.source;
          if (typeof numId === 'number' && !isNaN(numId)) {
            sourceIdCounts.set(numId, (sourceIdCounts.get(numId) || 0) + 1);
            totalSources++;
          }
        }
      });

      if (sourceIdCounts.size === 0) {
        setSources([]);
        setLoading(false);
        return false;
      }

      // Fetch source details for all sources
      const { data: sourcesData, error: sourcesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('sources')
        .select('id, link')
        .in('id', Array.from(sourceIdCounts.keys())));

      if (sourcesError || !sourcesData) {
        setSources([]);
        setLoading(false);
        return false;
      }

      // Group by unique domain and aggregate counts
      const domainCounts = new Map<string, number>();
      
      sourcesData.forEach(source => {
        const count = sourceIdCounts.get(source.id) || 0;
        const domain = getDomainFromUrl(source.link);
        if (domainCounts.has(domain)) {
          domainCounts.set(domain, domainCounts.get(domain)! + count);
        } else {
          domainCounts.set(domain, count);
        }
      });

      // Convert to sources array with aggregated domain data
      const sourcesWithStats = Array.from(domainCounts.entries()).map(([domain, usage_count]) => ({
        id: 0, // Dummy ID since we're grouping by URL
        link: domain, // Store the domain as the link
        usage_count,
        usage_percentage: totalSources > 0 ? Math.round((usage_count / totalSources) * 100) : 0
      }));

      // Sort by usage count (descending)
      sourcesWithStats.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));

      // Limit to top 8 sources for preview
      setSources(sourcesWithStats.slice(0, 8));

    } catch (err) {
      console.error('Error in fetchSources:', err);
      setError('Failed to load sources');
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  const getDomainFromUrl = (url: string): string => {
    if (!url) {
      return '';
    }
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  const getInitialFromDomain = (domain: string): string => {
    return domain.charAt(0).toUpperCase();
  };

  const translations = {
    en: {
      title: 'Sources',
      subtitle: 'Sources across active models',
      allSources: 'All Sources',
      viewAll: 'View All'
    },
    ro: {
      title: 'Surse',
      subtitle: 'Surse din modelele active',
      allSources: 'Toate Sursele',
      viewAll: 'Vezi Toate'
    }
  };

  const t = translations[language];

  return (
    <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Database className="h-6 w-6 text-gray-900 mr-3" />
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{t.title}</h3>
            <p className="text-gray-600 text-sm">{t.subtitle}</p>
          </div>
        </div>
        <button
          onClick={() => setCurrentView('sources')}
          className="text-blue-500 hover:text-blue-600 font-medium"
        >
          {t.viewAll}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-600">Loading sources...</div>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-8">
          <Database className="mx-auto w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-600">No sources found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => {
            const domain = getDomainFromUrl(source.link);
            const initial = getInitialFromDomain(domain);
            
            return (
              <div key={source.link} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div className="flex items-center">
                <div className="flex-shrink-0 h-8 w-8">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{initial}</span>
                  </div>
                </div>
                
                <div className="ml-3 flex-1">
                  <div className="text-gray-900 font-medium text-sm">{source.link}</div>
                </div>
                
                <div className="text-right">
                  <div className="text-gray-900 font-bold text-lg">{source.usage_percentage}%</div>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SourcesPreview;