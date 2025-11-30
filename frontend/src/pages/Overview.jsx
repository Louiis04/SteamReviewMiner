import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config.js';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { cn } from '@/lib/utils.js';
import { useAuth } from '../hooks/useAuth.js';

const resolveStatusVariant = (status) => {
  if (status === 'OK') return 'default';
  if (!status) return 'secondary';
  return 'destructive';
};

const resolveStatusLabel = (status) => {
  if (!status) return 'Carregando';
  if (status === 'OK') return 'Operacional';
  return 'Atenção';
};

const actionLinks = [
  {
    title: 'Explorar jogos e reviews',
    description: 'Busque por AppID ou nome e veja comentários detalhados.',
    to: '/explorar',
    cta: 'Ir para Explorar',
  },
  {
    title: 'Ranking Top Jogos',
    description: 'Filtre por avaliações, paginate resultados e abra comentários.',
    to: '/top',
    cta: 'Ver Top Jogos',
  },
];

const Overview = () => {
  const [health, setHealth] = useState({ server: null, database: null, timestamp: null });
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState('');
  const [topHighlights, setTopHighlights] = useState({ games: [], total: 0 });
  const [topLoading, setTopLoading] = useState(true);
  const [topError, setTopError] = useState('');
  const [overviewMetrics, setOverviewMetrics] = useState({ stats: null, recentUpdates: [] });
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState('');
  const [jobMetrics, setJobMetrics] = useState({ summary: null, reviewQueue: [], commentQueue: [] });
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchHealth = async () => {
      try {
        setHealthLoading(true);
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) {
          throw new Error('Falha ao carregar /health');
        }
        const data = await response.json();
        if (!active) return;
        setHealth({ server: data.server, database: data.database, timestamp: data.timestamp });
        setHealthError('');
      } catch (error) {
        if (!active) return;
        setHealthError(error.message ?? 'Erro ao checar saúde.');
      } finally {
        if (active) setHealthLoading(false);
      }
    };
    fetchHealth();
    const intervalId = setInterval(fetchHealth, 60_000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchTopHighlights = async () => {
      try {
        setTopLoading(true);
        const response = await fetch(`${API_BASE_URL}/top-games?limit=4&min_reviews=200&sort=rating`);
        if (!response.ok) {
          throw new Error('Falha ao carregar destaques');
        }
        const data = await response.json();
        if (!active) return;
        setTopHighlights({ games: data.games ?? [], total: data.total ?? data.games?.length ?? 0 });
        setTopError('');
      } catch (error) {
        if (!active) return;
        setTopError(error.message ?? 'Erro ao carregar destaques.');
      } finally {
        if (active) setTopLoading(false);
      }
    };
    fetchTopHighlights();
    const intervalId = setInterval(fetchTopHighlights, 5 * 60_000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchOverviewMetrics = async () => {
      try {
        setMetricsLoading(true);
        const response = await fetch(`${API_BASE_URL}/overview-metrics`);
        if (!response.ok) {
          throw new Error('Falha ao carregar métricas');
        }
        const data = await response.json();
        if (!active) return;
        if (data.success === false) {
          throw new Error(data.error ?? 'Erro ao carregar métricas');
        }
        setOverviewMetrics({
          stats: data.stats ?? null,
          recentUpdates: data.recentUpdates ?? [],
        });
        setMetricsError('');
      } catch (error) {
        if (!active) return;
        setMetricsError(error.message ?? 'Erro ao carregar métricas.');
      } finally {
        if (active) setMetricsLoading(false);
      }
    };
    fetchOverviewMetrics();
    const intervalId = setInterval(fetchOverviewMetrics, 5 * 60_000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchJobMetrics = async () => {
      try {
        setJobsLoading(true);
        const response = await fetch(`${API_BASE_URL}/jobs/metrics`);
        if (!response.ok) {
          throw new Error('Falha ao carregar fila de jobs');
        }
        const data = await response.json();
        if (!active) return;
        if (data.success === false) {
          throw new Error(data.error ?? 'Erro ao carregar fila de jobs');
        }
        setJobMetrics({
          summary: data.summary ?? null,
          reviewQueue: data.reviewQueue ?? [],
          commentQueue: data.commentQueue ?? [],
        });
        setJobsError('');
      } catch (error) {
        if (!active) return;
        setJobsError(error.message ?? 'Erro ao carregar fila de jobs.');
      } finally {
        if (active) setJobsLoading(false);
      }
    };
    fetchJobMetrics();
    const intervalId = setInterval(fetchJobMetrics, 2 * 60_000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  const lastUpdatedLabel = useMemo(() => {
    if (!health.timestamp) return '---';
    const date = new Date(health.timestamp);
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }, [health.timestamp]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);
  const relativeTimeFormatter = useMemo(() => new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }), []);
  const statsData = overviewMetrics.stats;
  const jobSummary = jobMetrics.summary;
  const { user, favorites, openAuthDialog } = useAuth();
  const favoriteOverview = useMemo(() => favorites.slice(0, 4), [favorites]);

  const coveragePercent = useMemo(() => {
    if (!statsData?.totalGames || !statsData.totalReviewStats) return 0;
    return Math.min(100, Math.round((statsData.totalReviewStats / statsData.totalGames) * 100));
  }, [statsData]);

  const commentsDensityPercent = useMemo(() => {
    if (!statsData?.totalGames || !statsData.totalComments) return 0;
    const avgCommentsPerGame = statsData.totalComments / statsData.totalGames;
    const target = 50;
    return Math.min(100, Math.round((avgCommentsPerGame / target) * 100));
  }, [statsData]);

  const searchCachePercent = useMemo(() => {
    if (!statsData) return 0;
    const targetTerms = 120;
    return Math.min(100, Math.round(((statsData.cachedSearchTerms ?? 0) / targetTerms) * 100));
  }, [statsData]);

  const freshnessPercent = useMemo(() => {
    if (!statsData?.lastStatsSync) return 0;
    const diffMs = Date.now() - new Date(statsData.lastStatsSync).getTime();
    const diffHours = Math.max(0, diffMs / 3_600_000);
    const freshnessWindow = 24;
    return Math.max(0, Math.round((1 - Math.min(diffHours / freshnessWindow, 1)) * 100));
  }, [statsData?.lastStatsSync]);

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '---';
    const diffMs = new Date(timestamp).getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60_000);
    if (Math.abs(diffMinutes) < 60) {
      return relativeTimeFormatter.format(diffMinutes, 'minute');
    }
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 48) {
      return relativeTimeFormatter.format(diffHours, 'hour');
    }
    const diffDays = Math.round(diffHours / 24);
    return relativeTimeFormatter.format(diffDays, 'day');
  };

  const pipelineProgress = useMemo(() => {
    const progress = [];
    if (jobSummary) {
      progress.push({
        label: 'Sync de review stats',
        value: jobSummary.reviewFreshnessPercent ?? 0,
        description: `${jobSummary.staleReviewStats ?? 0} pendentes · ${jobSummary.reviewStatsLast24h ?? 0} atualizados nas últimas 24h`,
      });
      progress.push({
        label: 'Comentários atualizados',
        value: jobSummary.commentsFreshPercent ?? 0,
        description: `${jobSummary.staleCommentGames ?? 0} jogos aguardando refresh`,
      });
    }
    if (statsData) {
      progress.push({
        label: 'Cache de buscas',
        value: searchCachePercent,
        description: `${numberFormatter.format(statsData.cachedSearchTerms ?? 0)} termos diferentes no cache de busca.`,
      });
    }
    return progress;
  }, [jobSummary, statsData, searchCachePercent, numberFormatter]);

  const pipelineError = metricsError || jobsError;
  const isPipelineLoading = metricsLoading && jobsLoading;

  const statusCards = [
    {
      title: 'Backend Express',
      description: 'API Node.js que fala com a Steam e o Postgres.',
      status: health.server,
    },
    {
      title: 'Banco de Dados',
      description: 'Cluster PostgreSQL + cache de buscas e reviews.',
      status: health.database,
    },
    {
      title: 'Steam API',
      description: 'Disponibilidade com base nas últimas respostas.',
      status: health.server === 'OK' ? 'OK' : health.server,
    },
  ];

  const summaryCards = [
    {
      title: 'Jogos indexados',
      value: statsData ? numberFormatter.format(statsData.totalGames ?? 0) : '---',
      helper: statsData ? `${numberFormatter.format(statsData.totalReviewStats ?? 0)} com estatísticas` : 'Em processamento',
    },
    {
      title: 'Reviews agregadas',
      value: statsData ? numberFormatter.format(statsData.indexedReviews ?? 0) : '---',
      helper: statsData ? `${numberFormatter.format(statsData.indexedPositiveReviews ?? 0)} positivas` : 'Coletando dados',
    },
    {
      title: 'Comentários salvos',
      value: statsData ? numberFormatter.format(statsData.totalComments ?? 0) : '---',
      helper: statsData ? `${commentsDensityPercent}% da meta por jogo` : 'Calculando média',
    },
    {
      title: 'Buscas em cache',
      value: statsData ? numberFormatter.format(statsData.cachedSearchEntries ?? 0) : '---',
      helper: statsData ? `${numberFormatter.format(statsData.cachedSearchTerms ?? 0)} termos únicos` : 'Aguardando consultas',
    },
    {
      title: 'Backlog de sincronização',
      value: jobSummary ? numberFormatter.format(jobSummary.backlogEstimate ?? 0) : '---',
      helper: jobSummary ? `${jobSummary.reviewFreshnessPercent ?? 0}% de reviews atualizados` : 'Monitorando filas',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 to-slate-700 text-white p-8 shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/70">Steam Review Miner</p>
            <h1 className="mt-3 text-3xl font-bold lg:text-4xl">Visão geral e telemetria em tempo real</h1>
            <p className="mt-4 text-lg text-white/80">
              Monitore serviços, acompanhe ingestão de dados e acesse rapidamente as ferramentas de análise e ranking.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-lg">
              <Link to="/explorar">Explorar reviews</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="bg-white/15 text-white hover:bg-white/25">
              <Link to="/top">Ver Top Jogos</Link>
            </Button>
          </div>
        </div>
        <Separator className="my-6 border-white/20 bg-white/20" />
        <div className="flex flex-wrap gap-6 text-sm text-white/80">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Última verificação</p>
            <p className="mt-1 text-base font-semibold">{healthLoading ? 'Atualizando...' : lastUpdatedLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Status geral</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn('inline-flex h-2 w-2 rounded-full', healthError ? 'bg-red-400 animate-pulse' : 'bg-emerald-300')} />
              <p className="font-semibold">{healthError ? 'Instável' : 'Operacional'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Destaques carregados</p>
            <p className="mt-1 text-base font-semibold">{topLoading ? '---' : `${topHighlights.total} jogos`}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title} className="border-slate-200/80">
            <CardHeader className="pb-2">
              <CardDescription>{card.title}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">
                {metricsLoading ? '---' : card.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {metricsError ? metricsError : card.helper}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {statusCards.map((card) => (
          <Card key={card.title} className="border-slate-200/70 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                {card.title}
                <Badge variant={resolveStatusVariant(card.status)}>{resolveStatusLabel(card.status)}</Badge>
              </CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <p className="text-sm text-muted-foreground">Sincronizando...</p>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">
                  {card.status === 'OK' ? 'Sem incidentes nas últimas verificações.' : 'Monitoramento contínuo ativado.'}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Atualizações recentes</CardTitle>
            <CardDescription>Últimas sincronizações retornadas pela Steam e persistidas no cache.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metricsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando lista...</p>
            ) : metricsError ? (
              <p className="text-sm text-destructive">{metricsError}</p>
            ) : overviewMetrics.recentUpdates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum jogo foi atualizado recentemente.</p>
            ) : (
              overviewMetrics.recentUpdates.map((game) => {
                const ratio = game.total_reviews ? (game.total_positive / Math.max(game.total_reviews, 1)) * 100 : 0;
                return (
                  <div key={game.app_id} className="flex items-center justify-between rounded-xl border bg-muted/40 p-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{game.name}</p>
                      <p className="text-xs text-muted-foreground">Atualizado {formatRelativeTime(game.updated_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{ratio.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">{numberFormatter.format(game.total_reviews ?? 0)} reviews</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Destaques recentes</CardTitle>
            <CardDescription>Ranking resumido baseado nos filtros padrão da página Top Jogos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topLoading ? (
              <p className="text-sm text-muted-foreground">Carregando amostra...</p>
            ) : topError ? (
              <p className="text-sm text-destructive">{topError}</p>
            ) : (
              topHighlights.games.map((game, index) => (
                <div key={game.app_id ?? `${game.name}-${index}`} className="flex items-start justify-between rounded-lg border bg-muted/40 p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">#{index + 1} — {game.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number(game.positive_percentage ?? 0).toFixed(1)}% positivas · {new Intl.NumberFormat('pt-BR').format(game.total_reviews ?? 0)} reviews
                    </p>
                  </div>
                  <Badge variant="secondary">{game.review_score_desc ?? 'N/A'}</Badge>
                </div>
              ))
            )}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="ml-auto">
              <Link to="/top">Abrir ranking completo</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline de ingestão</CardTitle>
            <CardDescription>Progresso consolidado das etapas principais.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPipelineLoading ? (
              <p className="text-sm text-muted-foreground">Sincronizando métricas...</p>
            ) : pipelineError ? (
              <p className="text-sm text-destructive">{pipelineError}</p>
            ) : pipelineProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado disponível ainda.</p>
            ) : (
              pipelineProgress.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">{item.value}%</span>
                  </div>
                  <Progress value={item.value} className="mt-2" />
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Backlog de review stats</CardTitle>
            <CardDescription>Jogos que ainda precisam ter estatísticas sincronizadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando fila...</p>
            ) : jobsError ? (
              <p className="text-sm text-destructive">{jobsError}</p>
            ) : jobMetrics.reviewQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum jogo aguardando sync.</p>
            ) : (
              jobMetrics.reviewQueue.map((item) => (
                <div key={item.app_id} className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-sm font-semibold text-foreground">{item.name ?? `App ${item.app_id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    Última atualização {item.updated_at ? formatRelativeTime(item.updated_at) : 'indisponível'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backlog de comentários</CardTitle>
            <CardDescription>Jogos com comentários desatualizados no cache local.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando fila...</p>
            ) : jobsError ? (
              <p className="text-sm text-destructive">{jobsError}</p>
            ) : jobMetrics.commentQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todos os comentários estão em dia.</p>
            ) : (
              jobMetrics.commentQueue.map((item) => (
                <div key={item.app_id} className="rounded-xl border bg-muted/40 p-3">
                  <p className="text-sm font-semibold text-foreground">{item.name ?? `App ${item.app_id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    Último comentário {item.last_comment ? formatRelativeTime(item.last_comment) : 'não registrado'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Atalhos rápidos</CardTitle>
            <CardDescription>Vá direto às principais ferramentas do Steam Review Miner.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {actionLinks.map((action) => (
              <div key={action.title} className="flex flex-col rounded-xl border bg-muted/40 p-4">
                <div className="flex flex-1 flex-col">
                  <p className="text-base font-semibold text-foreground">{action.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
                </div>
                <Button asChild className="mt-4" variant="secondary">
                  <Link to={action.to}>{action.cta}</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{user ? 'Meus favoritos' : 'Salve jogos favoritos'}</CardTitle>
            <CardDescription>
              {user ? 'Últimos jogos marcados com estrela.' : 'Crie uma conta para acessar sua lista personalizada.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user ? (
              favoriteOverview.length ? (
                favoriteOverview.map((fav) => (
                  <div key={fav.app_id} className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{fav.name ?? `App ${fav.app_id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {numberFormatter.format(fav.total_reviews ?? 0)} reviews · {fav.review_score_desc ?? 'N/A'}
                      </p>
                    </div>
                    <Badge variant="secondary">{fav.review_score_desc ?? '—'}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum favorito ainda. Use o botão de estrela em Explorar.</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Autentique-se para salvar jogos e acompanhar o desempenho deles aqui.</p>
            )}
          </CardContent>
          <CardFooter>
            {user ? (
              <Button asChild variant="outline" className="w-full">
                <Link to="/explorar">Marcar mais jogos</Link>
              </Button>
            ) : (
              <Button className="w-full" onClick={() => openAuthDialog('register')}>
                Criar conta gratuita
              </Button>
            )}
          </CardFooter>
        </Card>
      </section>
    </div>
  );
};

export default Overview;
