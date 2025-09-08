import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';

const COMPANY_COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

interface VisibilityChartProps {
  companyId: string;
  selectedPeriod: 'today' | '7_days' | '14_days' | '30_days';
  language: 'en' | 'ro';
  allCompaniesDailyVisibility: { name: string; isYou: boolean; data: { date: string; visibility: number }[] }[];
  hoveredCompanyChartKey?: string | null;
}

const VisibilityChart: React.FC<VisibilityChartProps> = ({ 
  companyId, 
  selectedPeriod, 
  language,
  allCompaniesDailyVisibility,
  hoveredCompanyChartKey = null
}) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (allCompaniesDailyVisibility && allCompaniesDailyVisibility.length > 0) {
      // Filter out companies with all zero visibility values
      const filteredChartLines = allCompaniesDailyVisibility.filter(company => 
        company.data.some(dataPoint => dataPoint.visibility > 0)
      );
      
      // Sort companies to ensure current company (isYou: true) appears first in legend
      filteredChartLines.sort((a, b) => {
        if (a.isYou && !b.isYou) return -1;
        if (!a.isYou && b.isYou) return 1;
        return 0;
      });
      
      // Merge all company data into a single dataset to avoid duplicate dates
      if (filteredChartLines.length > 0) {
        // Get all unique dates from all companies
        const allDates = new Set<string>();
        filteredChartLines.forEach(company => {
          company.data.forEach(dataPoint => {
            allDates.add(dataPoint.date);
          });
        });

        // Create merged dataset where each date appears only once
        const mergedData = Array.from(allDates).sort((a, b) => {
          const dateA = new Date(a + ', 2024');
          const dateB = new Date(b + ', 2024');
          return dateA.getTime() - dateB.getTime();
        }).map(date => {
          const dataPoint: any = { date };
          
          // Add each company's visibility for this date
          filteredChartLines.forEach(company => {
            const companyDataForDate = company.data.find(d => d.date === date);
            const key = company.isYou ? `${company.name} (You)` : company.name;
            dataPoint[key] = companyDataForDate ? companyDataForDate.visibility : null;
          });
          
          return dataPoint;
        });

        setChartData(mergedData);
        setFilteredCompanies(filteredChartLines);
      } else {
        setChartData([]);
        setFilteredCompanies([]);
      }
      setLoading(false);
    } else {
      fetchVisibilityData();
    }
  }, [companyId, selectedPeriod, allCompaniesDailyVisibility]);

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

  const fetchVisibilityData = async () => {
    setLoading(true);
    try {
      if (!companyId) {
        setLoading(false);
        return;
      }

      const startDate = await getStartDate(selectedPeriod, companyId);

      // Fetch responses for the period
      const { data: responses, error: responsesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('responses')
        .select('id, created_at')
        .eq('company', companyId)
        .gte('created_at', startDate));

      if (responsesError) {
        throw new Error(`Failed to fetch responses: ${responsesError.message}`);
      }

      // Fetch response analysis data
      const responseIds = responses?.map(r => r.id) || [];
      const { data: analysisData, error: analysisError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('response_analysis')
        .select('response, company_appears')
        .in('response', responseIds));

      if (analysisError) {
        throw new Error(`Failed to fetch analysis data: ${analysisError.message}`);
      }

      // Create a map of response ID to company_appears
      const responseAnalysisMap = new Map();
      analysisData?.forEach(analysis => {
        responseAnalysisMap.set(analysis.response, analysis.company_appears);
      });

      // Group responses by date and calculate daily visibility
      const dailyData = new Map<string, { total: number; appears: number }>();

      responses?.forEach(response => {
        // Extract date using local timezone components
        const responseDate = new Date(response.created_at);
        const year = responseDate.getFullYear();
        const month = String(responseDate.getMonth() + 1).padStart(2, '0');
        const day = String(responseDate.getDate()).padStart(2, '0');
        const date = `${year}-${month}-${day}`; // Get YYYY-MM-DD in local timezone
        const companyAppears = responseAnalysisMap.get(response.id) || false;

        if (!dailyData.has(date)) {
          dailyData.set(date, { total: 0, appears: 0 });
        }

        const dayData = dailyData.get(date)!;
        dayData.total++;
        if (companyAppears) {
          dayData.appears++;
        }
      });

      // Create final array for chart
      const chartDataArray: any[] = [];
      dailyData.forEach((value, date) => {
        const visibility = value.total > 0 ? Math.round((value.appears / value.total) * 100) : 0;
        chartDataArray.push({ date, visibility });
      });

      // Sort dates chronologically
      chartDataArray.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setChartData(chartDataArray);
      setFilteredCompanies([{ name: 'You', isYou: true, data: chartDataArray }] as any);
    } catch (err) {
      console.error('Error fetching visibility data:', err);
      setChartData([]);
      setFilteredCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const translations = {
    en: {
      title: 'Visibility',
      subtitle: 'Percentage of chats mentioning your brand',
      noData: 'No visibility data available',
      loading: 'Loading visibility data...'
    },
    ro: {
      title: 'Vizibilitate',
      subtitle: 'Procentul de conversații care menționează brandul tău',
      noData: 'Nu există date de vizibilitate disponibile',
      loading: 'Se încarcă datele de vizibilitate...'
    }
  };

  const t = translations[language];

  return (
    <div>
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
      ) : chartData.length === 0 ? (
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
              {filteredCompanies.length > 0 && (
                <Legend 
                  align="left"
                  verticalAlign="bottom"
                  layout="horizontal"
                  wrapperStyle={{ paddingLeft: 20, paddingTop: 10 }}
                />
              )}
              {filteredCompanies.map((company, index) => {
                const dataKey = company.isYou ? `${company.name} (You)` : company.name;
                const isHovered = hoveredCompanyChartKey === null || hoveredCompanyChartKey === dataKey;
                const opacity = isHovered ? 1 : 0.2;
                return (
                <Line
                  key={company.name}
                  type="monotone"
                  dataKey={dataKey}
                  name={dataKey}
                  stroke={COMPANY_COLORS[index % COMPANY_COLORS.length]}
                  strokeOpacity={opacity}
                  strokeWidth={company.isYou ? 3 : 2}
                  dot={{ 
                    fill: COMPANY_COLORS[index % COMPANY_COLORS.length], 
                    strokeWidth: 2, 
                    r: company.isYou ? 5 : 4,
                    fillOpacity: opacity
                  }}
                  activeDot={{ 
                    r: company.isYou ? 7 : 6, 
                    fill: COMPANY_COLORS[index % COMPANY_COLORS.length],
                    fillOpacity: opacity
                  }}
                  connectNulls={false}
                />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default VisibilityChart;