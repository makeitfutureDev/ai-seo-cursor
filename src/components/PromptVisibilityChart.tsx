import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

const PROMPT_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', 
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'
];

interface PromptVisibilityChartProps {
  companyId: string;
  selectedPeriod: 'today' | '7_days' | '14_days' | '30_days';
  language: 'en' | 'ro';
}

interface PromptData {
  id: string;
  prompt: string;
  description?: string;
}

interface ChartDataPoint {
  date: string;
  [promptId: string]: string | number;
}

const PromptVisibilityChart: React.FC<PromptVisibilityChartProps> = ({ 
  companyId, 
  selectedPeriod, 
  language 
}) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (companyId) {
      fetchPromptVisibilityData();
    }
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
          // Use the date of the latest response (start of that day in local timezone)
          const latestDate = new Date(latestResponse.created_at);
          const startOfLatestDay = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate(), 0, 0, 0, 0);
          return startOfLatestDay.toISOString();
        }
      } catch (err) {
        console.error('Error finding latest response date:', err);
      }
      
      // Fallback to start of today (midnight local time)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return startOfToday.toISOString();
    }
    
    const daysToSubtract = period === '7_days' ? 7 : period === '14_days' ? 14 : 30;
    // Calculate start date in local timezone
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    const localStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    return localStartDate.toISOString();
  };

  const fetchPromptVisibilityData = async () => {
    setLoading(true);
    setError('');

    try {
      // First, fetch all prompts for this company
      const { data: promptsData, error: promptsError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('prompts')
        .select('id, prompt, description')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }));

      if (promptsError) {
        throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
      }

      if (!promptsData || promptsData.length === 0) {
        setPrompts([]);
        setChartData([]);
        return;
      }

      setPrompts(promptsData);

      // Get the start date for the selected period
      const startDate = await getStartDate(selectedPeriod, companyId);

      // Fetch responses for all prompts within the date range
      const promptIds = promptsData.map(p => p.id);
      const { data: responses, error: responsesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('responses')
        .select('id, prompt, created_at')
        .eq('company', companyId)
        .in('prompt', promptIds)
        .gte('created_at', startDate));

      if (responsesError) {
        throw new Error(`Failed to fetch responses: ${responsesError.message}`);
      }

      if (!responses || responses.length === 0) {
        setChartData([]);
        return;
      }

      // Get company as competitor ID for analysis filtering
      const { data: companyData, error: companyError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single());

      if (companyError || !companyData) {
        throw new Error('Failed to fetch company data');
      }

      const { data: competitorData, error: competitorError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('competitors')
        .select('id')
        .eq('company', companyId)
        .eq('name', companyData.name)
        .single());

      let companyAsCompetitorId: number | null = null;
      if (!competitorError && competitorData) {
        companyAsCompetitorId = competitorData.id;
      }

      // Fetch analysis data for all responses
      const responseIds = responses.map(r => r.id);
      const { data: analysisData, error: analysisError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('response_analysis')
        .select('response, company_appears, competitor')
        .in('response', responseIds));

      if (analysisError) {
        throw new Error(`Failed to fetch analysis data: ${analysisError.message}`);
      }

      // Group data by prompt and date
      const promptDateData = new Map<string, Map<string, { total: number; appears: number }>>();

      responses.forEach(response => {
        const promptId = response.prompt;
        const responseDate = new Date(response.created_at);
        const dateKey = `${responseDate.getFullYear()}-${String(responseDate.getMonth() + 1).padStart(2, '0')}-${String(responseDate.getDate()).padStart(2, '0')}`;

        if (!promptDateData.has(promptId)) {
          promptDateData.set(promptId, new Map());
        }

        const promptData = promptDateData.get(promptId)!;
        if (!promptData.has(dateKey)) {
          promptData.set(dateKey, { total: 0, appears: 0 });
        }

        const dayData = promptData.get(dateKey)!;
        dayData.total++;

        // Check if company appears in this response
        if (analysisData && companyAsCompetitorId !== null) {
          const responseAnalysis = analysisData.filter(a => 
            a.response === response.id && a.competitor === companyAsCompetitorId
          );
          
          if (responseAnalysis.some(a => a.company_appears)) {
            dayData.appears++;
          }
        }
      });

      // Convert to chart data format
      const allDates = new Set<string>();
      promptDateData.forEach(promptData => {
        promptData.forEach((_, date) => {
          allDates.add(date);
        });
      });

      const sortedDates = Array.from(allDates).sort();
      const chartDataArray: ChartDataPoint[] = sortedDates.map(date => {
        const dataPoint: ChartDataPoint = {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };

        promptsData.forEach(prompt => {
          const promptData = promptDateData.get(prompt.id);
          if (promptData && promptData.has(date)) {
            const dayData = promptData.get(date)!;
            const visibility = dayData.total > 0 ? Math.round((dayData.appears / dayData.total) * 100) : 0;
            dataPoint[prompt.id] = visibility;
          } else {
            dataPoint[prompt.id] = 0;
          }
        });

        return dataPoint;
      });

      setChartData(chartDataArray);

    } catch (error) {
      console.error('Error fetching prompt visibility data:', error);
      setError('Failed to load prompt visibility data');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const getPromptDisplayName = (prompt: PromptData): string => {
    if (prompt.description && prompt.description.trim()) {
      return prompt.description.length > 30 
        ? `${prompt.description.substring(0, 30)}...`
        : prompt.description;
    }
    return prompt.prompt.length > 30 
      ? `${prompt.prompt.substring(0, 30)}...`
      : prompt.prompt;
  };

  const translations = {
    en: {
      title: 'Prompt Visibility',
      subtitle: 'Individual prompt performance over time',
      noData: 'No prompt visibility data available',
      loading: 'Loading prompt visibility data...'
    },
    ro: {
      title: 'Vizibilitate Prompt-uri',
      subtitle: 'Performanța individuală a prompt-urilor în timp',
      noData: 'Nu există date de vizibilitate pentru prompt-uri disponibile',
      loading: 'Se încarcă datele de vizibilitate pentru prompt-uri...'
    }
  };

  const t = translations[language];

  return (
    <div>
      <div className="flex items-center mb-6">
        <FileText className="h-6 w-6 text-gray-900 mr-3" />
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{t.title}</h3>
          <p className="text-gray-600 text-sm">{t.subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="mx-auto w-8 h-8 text-gray-600 animate-spin mb-4" />
          <div className="text-gray-600">{t.loading}</div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
        </div>
      ) : chartData.length === 0 || prompts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">{t.noData}</p>
        </div>
      ) : (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="90%">
            <LineChart 
              data={chartData} 
              margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
              <XAxis 
                dataKey="date" 
                stroke="rgba(0,0,0,0.7)"
                fontSize={12}
              />
              <YAxis 
                stroke="rgba(0,0,0,0.7)"
                fontSize={12}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                formatter={(value, name) => {
                  const prompt = prompts.find(p => p.id === name);
                  const displayName = prompt ? getPromptDisplayName(prompt) : name;
                  return [`${value}%`, displayName];
                }}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend 
                align="left"
                verticalAlign="bottom"
                layout="horizontal"
                wrapperStyle={{ paddingLeft: 20, paddingTop: 10 }}
                formatter={(value) => {
                  const prompt = prompts.find(p => p.id === value);
                  return prompt ? getPromptDisplayName(prompt) : value;
                }}
              />
              {prompts.map((prompt, index) => (
                <Line
                  key={prompt.id}
                  type="monotone"
                  dataKey={prompt.id}
                  name={prompt.id}
                  stroke={PROMPT_COLORS[index % PROMPT_COLORS.length]}
                  strokeWidth={2}
                  dot={{ 
                    fill: PROMPT_COLORS[index % PROMPT_COLORS.length], 
                    strokeWidth: 2, 
                    r: 4
                  }}
                  activeDot={{ 
                    r: 6, 
                    fill: PROMPT_COLORS[index % PROMPT_COLORS.length]
                  }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default PromptVisibilityChart;