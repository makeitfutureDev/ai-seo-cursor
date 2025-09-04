import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';
import { format } from 'date-fns';

interface PromptVisibilityChartProps {
  companyId: string;
  selectedPeriod: 'today' | '7_days' | '14_days' | '30_days';
  language: 'en' | 'ro';
}

// Define a color palette for the prompt lines
const PROMPT_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF', '#FF6B6B'
];

const PromptVisibilityChart: React.FC<PromptVisibilityChartProps> = ({
  companyId,
  selectedPeriod,
  language,
}) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<Array<{ id: string; prompt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const translations = {
    en: {
      title: 'Prompt Visibility',
      subtitle: 'Visibility of individual prompts over time',
      noData: 'No prompt visibility data available',
      loading: 'Loading prompt visibility data...'
    },
    ro: {
      title: 'Vizibilitate Prompt',
      subtitle: 'Vizibilitatea prompturilor individuale în timp',
      noData: 'Nu există date de vizibilitate pentru prompturi',
      loading: 'Se încarcă datele de vizibilitate pentru prompturi...'
    }
  };

  const t = translations[language];

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
          // Use the date of the latest response (start of that day in UTC)
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
      // 1. Get the company's own competitor ID
      const { data: companyDetails, error: companyDetailsError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single());

      if (companyDetailsError || !companyDetails) {
        throw new Error('Failed to fetch company details.');
      }

      const { data: companyAsCompetitor, error: competitorError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('competitors')
        .select('id')
        .eq('company', companyId)
        .eq('name', companyDetails.name)
        .single());

      if (competitorError || !companyAsCompetitor) {
        console.warn('Company not found as a competitor. Prompt visibility might be inaccurate.');
        // Proceed, but company_appears will likely be false for all.
      }
      const companyCompetitorId = companyAsCompetitor?.id;

      // 2. Get start date for filtering responses
      const startDate = await getStartDate(selectedPeriod, companyId);

      // 3. Fetch all prompts for the company
      const { data: promptsData, error: promptsError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('prompts')
        .select('id, prompt')
        .eq('company_id', companyId));

      if (promptsError) {
        throw new Error(`Failed to fetch prompts: ${promptsError.message}`);
      }
      setPrompts(promptsData || []);

      // Create a map for quick prompt lookup
      const promptMap = new Map(promptsData?.map(p => [p.id, p.prompt]));

      // 4. Fetch all responses for the company within the period
      const { data: responses, error: responsesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('responses')
        .select('id, created_at, prompt')
        .eq('company', companyId)
        .gte('created_at', startDate));

      if (responsesError) {
        throw new Error(`Failed to fetch responses: ${responsesError.message}`);
      }

      const responseIds = responses?.map(r => r.id) || [];

      // 5. Fetch response analysis data for the company's own visibility
      const { data: analysisData, error: analysisError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('response_analysis')
        .select('response, company_appears')
        .in('response', responseIds)
        .eq('competitor', companyCompetitorId)); // Filter for the company's own visibility

      if (analysisError) {
        throw new Error(`Failed to fetch analysis data: ${analysisError.message}`);
      }

      // Create a map of response ID to company_appears status
      const responseAnalysisMap = new Map();
      analysisData?.forEach(analysis => {
        responseAnalysisMap.set(analysis.response, analysis.company_appears);
      });

      // 6. Aggregate daily visibility for each prompt
      // Map: promptId -> date (YYYY-MM-DD) -> { totalResponses: number; companyAppears: number }
      const promptDailyData = new Map<string, Map<string, { totalResponses: number; companyAppears: number }>>();

      responses?.forEach(response => {
        const promptId = response.prompt;
        if (!promptId || !promptMap.has(promptId)) return; // Skip if prompt is not found or invalid

        const responseDate = new Date(response.created_at);
        const dateKey = format(responseDate, 'MMM dd'); // e.g., "Aug 29"

        if (!promptDailyData.has(promptId)) {
          promptDailyData.set(promptId, new Map());
        }
        const dailyStats = promptDailyData.get(promptId)!;

        if (!dailyStats.has(dateKey)) {
          dailyStats.set(dateKey, { totalResponses: 0, companyAppears: 0 });
        }

        const dayData = dailyStats.get(dateKey)!;
        dayData.totalResponses++;
        if (responseAnalysisMap.get(response.id)) { // Check if company appeared in this response
          dayData.companyAppears++;
        }
      });

      // 7. Prepare data for Recharts
      const allDates = new Set<string>();
      responses?.forEach(response => {
        const responseDate = new Date(response.created_at);
        allDates.add(format(responseDate, 'MMM dd'));
      });
      const sortedDates = Array.from(allDates).sort((a, b) => {
        // Simple sort for "MMM dd" format, assuming same year
        const dateA = new Date(`2000 ${a}`); // Use a dummy year for comparison
        const dateB = new Date(`2000 ${b}`);
        return dateA.getTime() - dateB.getTime();
      });

      const finalChartData = sortedDates.map(date => {
        const dataPoint: any = { date };
        promptsData?.forEach(prompt => {
          const stats = promptDailyData.get(prompt.id)?.get(date);
          const visibility = stats ? Math.round((stats.companyAppears / stats.totalResponses) * 100) : 0;
          dataPoint[prompt.prompt] = visibility; // Use prompt text as dataKey
        });
        return dataPoint;
      });

      setChartData(finalChartData);

    } catch (err: any) {
      console.error('Error fetching prompt visibility data:', err);
      setError(err.message || 'Failed to load prompt visibility data');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: '#fdedee' }}>
      <div className="flex items-center mb-6">
        <TrendingUp className="h-6 w-6 text-gray-900 mr-3" />
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{t.title}</h3>
          <p className="text-gray-600 text-sm">{t.subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
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
                formatter={(value, name) => [`${value}%`, name]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              {prompts.length > 0 && (
                <Legend
                  align="left"
                  verticalAlign="bottom"
                  layout="horizontal"
                  wrapperStyle={{ paddingLeft: 20, paddingTop: 10 }}
                />
              )}
              {prompts.map((prompt, index) => (
                <Line
                  key={prompt.id}
                  type="monotone"
                  dataKey={prompt.prompt} // Use prompt text as dataKey
                  name={prompt.prompt} // Use prompt text for legend
                  stroke={PROMPT_COLORS[index % PROMPT_COLORS.length]}
                  strokeWidth={2}
                  dot={{
                    fill: PROMPT_COLORS[index % PROMPT_COLORS.length],
                    strokeWidth: 2,
                    r: 4,
                  }}
                  activeDot={{
                    r: 6,
                    fill: PROMPT_COLORS[index % PROMPT_COLORS.length],
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