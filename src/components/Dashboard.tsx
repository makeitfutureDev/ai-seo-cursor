```typescript
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { SupabaseQueryExecutor } from '../utils/supabaseUtils';
import CountdownTimer from './CountdownTimer';
import VisibilityChart from './VisibilityChart';
import PromptVisibilityChart from './PromptVisibilityChart'; // Ensure this import is present
import ResponsesDisplay from './ResponsesDisplay';
import SourcesPreview from './SourcesPreview';
import CompetitorAnalysis from './CompetitorAnalysis';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  TrendingUp,
  MessageSquare,
  Eye,
  Award,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Database,
  Loader2,
  Globe,
} from 'lucide-react';

interface DashboardProps {
  language: 'en' | 'ro';
  onLanguageChange: (lang: 'en' | 'ro') => void;
  onShowProfile: () => void;
  appTitle: string;
  companyData: any;
  setCurrentView: (view: 'dashboard' | 'prompts' | 'competitors' | 'sources' | 'profile') => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  language,
  onLanguageChange,
  onShowProfile,
  appTitle,
  companyData,
  setCurrentView,
}) => {
  const companyId = companyData?.id;
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7_days' | '14_days' | '30_days'>('30_days');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [totalResponses, setTotalResponses] = useState(0);
  const [visibilityRate, setVisibilityRate] = useState(0);
  const [industryRank, setIndustryRank] = useState(0);
  const [competitorsTracked, setCompetitorsTracked] = useState(0);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingIndustryRank, setLoadingIndustryRank] = useState(true);
  const [industryRankData, setIndustryRankData] = useState<any[]>([]);
  const [allCompaniesDailyVisibility, setAllCompaniesDailyVisibility] = useState<any[]>([]);
  const [hoveredCompanyChartKey, setHoveredCompanyChartKey] = useState<string | null>(null);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [recentPrompts, setRecentPrompts] = useState<any[]>([]);

  const translations = {
    en: {
      dashboardTitle: 'Overview',
      dashboardSubtitle: 'AI Visibility Analytics',
      totalResponses: 'Total Responses',
      visibilityRate: 'Visibility Rate',
      industryRank: 'Industry Rank',
      competitorsTracked: 'Competitors Tracked',
      periodOptions: {
        today: 'Last 24 Hours',
        '7_days': 'Last 7 Days',
        '14_days': 'Last 14 Days',
        '30_days': 'Last 30 Days',
      },
      visibility: {
        title: 'Visibility',
        subtitle: 'Percentage of chats mentioning your brand',
        noData: 'No visibility data available',
        loading: 'Loading visibility data...',
      },
      industryRanking: {
        title: 'Industry Ranking',
        subtitle: 'Brands with the highest visibility',
        averageSearchRank: 'Average search rank',
        positive: 'Positive',
        neutral: 'Neutral',
        negative: 'Negative',
        noData: 'No industry ranking data available',
        loading: 'Loading industry ranking data...',
      },
      recentPrompts: {
        title: 'Recent Prompts',
        subtitle: 'Your latest monitored prompts',
        viewAll: 'View All',
        noPrompts: 'No recent prompts found',
        loading: 'Loading recent prompts...',
      },
    },
    ro: {
      dashboardTitle: 'Prezentare Generală',
      dashboardSubtitle: 'Analiză Vizibilitate AI',
      totalResponses: 'Răspunsuri Totale',
      visibilityRate: 'Rata de Vizibilitate',
      industryRank: 'Clasament Industrie',
      competitorsTracked: 'Competitori Urmăriți',
      periodOptions: {
        today: 'Ultimele 24 de Ore',
        '7_days': 'Ultimele 7 Zile',
        '14_days': 'Ultimele 14 Zile',
        '30_days': 'Ultimele 30 de Zile',
      },
      visibility: {
        title: 'Vizibilitate',
        subtitle: 'Procentul de conversații care menționează brandul tău',
        noData: 'Nu există date de vizibilitate disponibile',
        loading: 'Se încarcă datele de vizibilitate...',
      },
      industryRanking: {
        title: 'Clasament Industrie',
        subtitle: 'Brandurile cu cea mai mare vizibilitate',
        averageSearchRank: 'Poziție medie în căutări',
        positive: 'Pozitiv',
        neutral: 'Neutru',
        negative: 'Negativ',
        noData: 'Nu există date de clasament în industrie disponibile',
        loading: 'Se încarcă datele de clasament în industrie...',
      },
      recentPrompts: {
        title: 'Prompturi Recente',
        subtitle: 'Ultimele tale prompturi monitorizate',
        viewAll: 'Vezi Toate',
        noPrompts: 'Nu s-au găsit prompturi recente',
        loading: 'Se încarcă prompturile recente...',
      },
    },
  };

  const t = translations[language];

  // Effect to handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && companyId) {
        console.log('📱 Tab became visible, checking if refresh needed...');
        if (SupabaseQueryExecutor.isConnectionStale()) {
          console.log('🔄 Connection is stale, refreshing data in background...');
          fetchDashboardData(true);
        }
        SupabaseQueryExecutor.updateActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [companyId, selectedPeriod]);

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

  const getStartDate = useCallback(async (period: 'today' | '7_days' | '14_days' | '30_days', currentCompanyId: string): Promise<string> => {
    const now = new Date();
    if (period === 'today') {
      try {
        const { data: latestResponse, error } = await SupabaseQueryExecutor.executeQuery(() => supabase
          .from('responses')
          .select('created_at')
          .eq('company', currentCompanyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single());
        if (!error && latestResponse) {
          const latestDate = new Date(latestResponse.created_at);
          const startOfLatestDay = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate(), 0, 0, 0, 0);
          return startOfLatestDay.toISOString();
        }
      } catch (err) {
        console.error('Error finding latest response date:', err);
      }
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return startOfToday.toISOString();
    }
    const daysToSubtract = period === '7_days' ? 7 : period === '14_days' ? 14 : 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    const localStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    return localStartDate.toISOString();
  }, []);

  const fetchDashboardData = useCallback(async (isBackgroundRefresh = false) => {
    if (!companyId) return;

    if (!isBackgroundRefresh) {
      setLoadingMetrics(true);
      setLoadingIndustryRank(true);
      setLoadingPrompts(true);
    }

    try {
      const startDate = await getStartDate(selectedPeriod, companyId);

      // Fetch total responses
      const { count: responsesCount, error: responsesCountError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('responses')
        .select('*', { count: 'exact' })
        .eq('company', companyId)
        .gte('created_at', startDate));

      if (!responsesCountError) {
        setTotalResponses(responsesCount || 0);
      }

      // Fetch competitors tracked
      const { count: competitorsCount, error: competitorsCountError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('competitors')
        .select('*', { count: 'exact' })
        .eq('company', companyId)
        .eq('approved', true));

      if (!competitorsCountError) {
        setCompetitorsTracked(competitorsCount || 0);
      }

      // Fetch all responses and analysis for visibility and industry rank
      const { data: responses, error: responsesError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('responses')
        .select(`
          id,
          created_at,
          prompt,
          company,
          response_analysis (
            competitor,
            company_appears,
            sentiment,
            position
          ),
          prompts (
            prompt,
            country
          )
        `)
        .eq('company', companyId)
        .gte('created_at', startDate));

      if (responsesError) {
        console.error('Error fetching responses for dashboard:', responsesError);
        return;
      }

      // Fetch company details to identify self
      const { data: currentCompanyDetails, error: companyDetailsError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single());

      if (companyDetailsError) {
        console.error('Error fetching current company details:', companyDetailsError);
        return;
      }

      // Fetch all approved competitors for the company
      const { data: allApprovedCompetitors, error: allApprovedCompetitorsError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('competitors')
        .select('id, name')
        .eq('company', companyId)
        .eq('approved', true));

      if (allApprovedCompetitorsError) {
        console.error('Error fetching approved competitors:', allApprovedCompetitorsError);
        return;
      }

      const companyAsCompetitor = allApprovedCompetitors?.find(comp => comp.name === currentCompanyDetails?.name);
      const totalApprovedCompetitorsCount = allApprovedCompetitors?.length || 0;

      // Calculate Visibility Rate and Industry Rank
      let totalCompanyAppearances = 0;
      const dailyVisibility: { [key: string]: { total: number; appears: number } } = {};
      const companyVisibilityData: { [key: string]: { date: string; visibility: number }[] } = {};
      const competitorMetrics: { [key: string]: { totalVisibility: number; totalSentiment: number; sentimentCount: number; totalPosition: number; positionCount: number; isYou: boolean; name: string; dailyData: { date: string; visibility: number }[] } } = {};

      allApprovedCompetitors?.forEach(comp => {
        const key = comp.name;
        competitorMetrics[key] = {
          totalVisibility: 0,
          totalSentiment: 0,
          sentimentCount: 0,
          totalPosition: 0,
          positionCount: 0,
          isYou: comp.id === companyAsCompetitor?.id,
          name: comp.name,
          dailyData: [],
        };
        companyVisibilityData[key] = [];
      });

      responses?.forEach(response => {
        const responseDate = new Date(response.created_at);
        const dateKey = \`${responseDate.getFullYear()}-${String(responseDate.getMonth() + 1).padStart(2, '0')}-${String(responseDate.getDate()).padStart(2, '0')}`;

        if (!dailyVisibility[dateKey]) {
          dailyVisibility[dateKey] = { total: 0, appears: 0 };
        }
        dailyVisibility[dateKey].total++;

        response.response_analysis.forEach((analysis: any) => {
          const competitorName = allApprovedCompetitors?.find(comp => comp.id === analysis.competitor)?.name;
          if (competitorName) {
            if (!competitorMetrics[competitorName]) {
              competitorMetrics[competitorName] = {
                totalVisibility: 0,
                totalSentiment: 0,
                sentimentCount: 0,
                totalPosition: 0,
                positionCount: 0,
                isYou: analysis.competitor === companyAsCompetitor?.id,
                name: competitorName,
                dailyData: [],
              };
              companyVisibilityData[competitorName] = [];
            }

            if (analysis.company_appears) {
              competitorMetrics[competitorName].totalVisibility++;
              if (analysis.competitor === companyAsCompetitor?.id) {
                totalCompanyAppearances++;
                dailyVisibility[dateKey].appears++;
              }
            }

            if (analysis.sentiment !== null && analysis.sentiment !== undefined) {
              competitorMetrics[competitorName].totalSentiment += analysis.sentiment;
              competitorMetrics[competitorName].sentimentCount++;
            }

            let position = analysis.position;
            if (position === 0 || position === null || position === undefined) {
              position = totalApprovedCompetitorsCount + 1;
            }
            competitorMetrics[competitorName].totalPosition += position;
            competitorMetrics[competitorName].positionCount++;
          }
        });
      });

      // Populate daily data for each company
      const sortedDates = Object.keys(dailyVisibility).sort();
      sortedDates.forEach(date => {
        allApprovedCompetitors?.forEach(comp => {
          const compName = comp.name;
          const dailyCompResponses = responses?.filter(r => {
            const rDate = new Date(r.created_at);
            const rDateKey = \`${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}`;
            return rDateKey === date;
          }) || [];

          let compAppearsCount = 0;
          let totalCompResponses = 0;

          dailyCompResponses.forEach(r => {
            r.response_analysis.forEach((analysis: any) => {
              if (analysis.competitor === comp.id) {
                totalCompResponses++;
                if (analysis.company_appears) {
                  compAppearsCount++;
                }
              }
            });
          });

          const visibility = totalCompResponses > 0 ? Math.round((compAppearsCount / totalCompResponses) * 100) : 0;
          companyVisibilityData[compName].push({ date, visibility });
        });
      });

      const allCompaniesDailyVisibilityFormatted = Object.values(competitorMetrics).map(comp => ({
        name: comp.name,
        isYou: comp.isYou,
        data: companyVisibilityData[comp.name] || [],
      }));
      setAllCompaniesDailyVisibility(allCompaniesDailyVisibilityFormatted);

      const totalResponsesForVisibility = responses?.length || 0;
      const calculatedVisibilityRate = totalResponsesForVisibility > 0
        ? Math.round((totalCompanyAppearances / totalResponsesForVisibility) * 100)
        : 0;
      setVisibilityRate(calculatedVisibilityRate);

      const industryRankArray = Object.values(competitorMetrics).map(comp => {
        const averagePosition = comp.positionCount > 0 ? Math.round(comp.totalPosition / comp.positionCount) : totalApprovedCompetitorsCount + 1;
        const averageSentiment = comp.sentimentCount > 0 ? Math.round(comp.totalSentiment / comp.sentimentCount) : 50; // Default to neutral
        const visibility = comp.totalVisibility > 0 ? Math.round((comp.totalVisibility / totalResponsesForVisibility) * 100) : 0;

        let sentimentCategory: 'positive' | 'neutral' | 'negative';
        if (averageSentiment >= 67) sentimentCategory = 'positive';
        else if (averageSentiment >= 34) sentimentCategory = 'neutral';
        else sentimentCategory = 'negative';

        return {
          name: comp.name,
          average_position: averagePosition,
          sentiment: sentimentCategory,
          visibility: visibility,
          isYou: comp.isYou,
        };
      }).sort((a, b) => {
        // Sort by visibility (desc), then by average position (asc)
        if (b.visibility !== a.visibility) {
          return b.visibility - a.visibility;
        }
        return a.average_position - b.average_position;
      });

      setIndustryRankData(industryRankArray);
      const yourRank = industryRankArray.findIndex(comp => comp.isYou) + 1;
      setIndustryRank(yourRank > 0 ? yourRank : 0);

      // Fetch recent prompts
      const { data: promptsData, error: promptsError } = await SupabaseQueryExecutor.executeQuery(() => supabase
        .from('prompts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5));

      if (!promptsError) {
        setRecentPrompts(promptsData || []);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      if (!isBackgroundRefresh) {
        setLoadingMetrics(false);
        setLoadingIndustryRank(false);
        setLoadingPrompts(false);
      }
    }
  }, [companyId, selectedPeriod, getStartDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handlePromptClick = (promptId: string) => {
    // This would typically open a modal or navigate to a detailed prompt view
    console.log('Prompt clicked:', promptId);
    // For now, we can just log or add a placeholder for future functionality
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 flex flex-col">
      {/* Main content area */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Dashboard Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {t.dashboardTitle}
              </h1>
              <p className="text-white/90 text-lg">{t.dashboardSubtitle}</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Period Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                  className="bg-white/20 text-white px-4 py-2 rounded-full flex items-center space-x-2 hover:bg-white/30 transition-colors"
                >
                  <span>{t.periodOptions[selectedPeriod]}</span>
                  {showPeriodDropdown ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {showPeriodDropdown && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg z-10">
                    {Object.entries(t.periodOptions).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedPeriod(key as any);
                          setShowPeriodDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <CountdownTimer language={language} />
            </div>
          </div>

          {/* Top Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Responses Card */}
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 flex items-center justify-between">
              <div className="text-white">
                <p className="text-sm opacity-80">{t.totalResponses}</p>
                {loadingMetrics ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin mt-2" />
                ) : (
                  <p className="text-3xl font-bold mt-1">{totalResponses}</p>
                )}
              </div>
              <MessageSquare className="h-10 w-10 text-white opacity-50" />
            </div>

            {/* Visibility Rate Card */}
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 flex items-center justify-between">
              <div className="text-white">
                <p className="text-sm opacity-80">{t.visibilityRate}</p>
                {loadingMetrics ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin mt-2" />
                ) : (
                  <p className="text-3xl font-bold mt-1">{visibilityRate}%</p>
                )}
              </div>
              <Eye className="h-10 w-10 text-white opacity-50" />
            </div>

            {/* Industry Rank Card */}
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 flex items-center justify-between">
              <div className="text-white">
                <p className="text-sm opacity-80">{t.industryRank}</p>
                {loadingMetrics ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin mt-2" />
                ) : (
                  <p className="text-3xl font-bold mt-1">#{industryRank}</p>
                )}
              </div>
              <Award className="h-10 w-10 text-white opacity-50" />
            </div>

            {/* Competitors Tracked Card */}
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 flex items-center justify-between">
              <div className="text-white">
                <p className="text-sm opacity-80">{t.competitorsTracked}</p>
                {loadingMetrics ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin mt-2" />
                ) : (
                  <p className="text-3xl font-bold mt-1">{competitorsTracked}</p>
                )}
              </div>
              <Users className="h-10 w-10 text-white opacity-50" />
            </div>
          </div>

          {/* Main Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Visibility Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <VisibilityChart
                companyId={companyId}
                selectedPeriod={selectedPeriod}
                language={language}
                allCompaniesDailyVisibility={allCompaniesDailyVisibility}
                hoveredCompanyChartKey={hoveredCompanyChartKey}
              />
            </div>

            {/* Industry Ranking Chart/List */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="flex items-center mb-6">
                <TrendingUp className="h-6 w-6 text-gray-900 mr-3" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {t.industryRanking.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {t.industryRanking.subtitle}
                  </p>
                </div>
              </div>
              {loadingIndustryRank ? (
                <div className="text-center py-12">
                  <Loader2 className="mx-auto w-8 h-8 text-gray-600 animate-spin mb-4" />
                  <div className="text-gray-600">
                    {t.industryRanking.loading}
                  </div>
                </div>
              ) : industryRankData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">
                    {t.industryRanking.noData}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {industryRankData.map((company, index) => (
                    <div
                      key={company.name}
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                      onMouseEnter={() =>
                        setHoveredCompanyChartKey(
                          company.isYou ? `${company.name} (You)` : company.name
                        )
                      }
                      onMouseLeave={() => setHoveredCompanyChartKey(null)}
                    >
                      <div className="flex items-center space-x-3">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                            index === 0
                              ? 'bg-yellow-500'
                              : index === 1
                              ? 'bg-gray-500'
                              : index === 2
                              ? 'bg-amber-700'
                              : 'bg-gray-400'
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">
                            {company.name}
                            {company.isYou && (
                              <span className="text-xs text-gray-500 ml-1">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">
                            {t.industryRanking.averageSearchRank}{' '}
                            #{company.average_position}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            company.sentiment === 'positive'
                              ? 'bg-green-500'
                              : company.sentiment === 'neutral'
                              ? 'bg-gray-400'
                              : 'bg-red-500'
                          }`}
                        ></span>
                        <span className="text-gray-700 text-sm">
                          {company.sentiment === 'positive'
                            ? t.industryRanking.positive
                            : company.sentiment === 'neutral'
                            ? t.industryRanking.neutral
                            : t.industryRanking.negative}
                        </span>
                        <span className="font-bold text-gray-900">
                          {company.visibility}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* NEW CHART SECTION: Prompt Visibility Chart */}
          <div className="mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <PromptVisibilityChart
                companyId={companyId}
                language={language}
                selectedPeriod={selectedPeriod}
              />
            </div>
          </div>

          {/* Recent Prompts and Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Recent Prompts */}
            <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <FileText className="h-6 w-6 text-white mr-3" />
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      {t.recentPrompts.title}
                    </h3>
                    <p className="text-white/70 text-sm">
                      {t.recentPrompts.subtitle}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentView('prompts')}
                  className="text-white/80 hover:text-white font-medium"
                >
                  {t.recentPrompts.viewAll}
                </button>
              </div>
              {loadingPrompts ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                  <div className="text-white/70">
                    {t.recentPrompts.loading}
                  </div>
                </div>
              ) : recentPrompts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/70">
                    {t.recentPrompts.noPrompts}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 cursor-pointer hover:bg-white/20 transition-colors"
                      onClick={() => handlePromptClick(prompt.id)}
                    >
                      <p className="text-white font-medium mb-1">
                        {prompt.prompt}
                      </p>
                      <p className="text-white/70 text-sm">
                        {prompt.description}
                      </p>
                      <div className="flex items-center text-white/60 text-xs mt-2">
                        <Globe className="h-3 w-3 mr-1" />
                        <span>{prompt.country}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sources Preview */}
            <SourcesPreview
              companyId={companyId}
              language={language}
              setCurrentView={setCurrentView}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
```