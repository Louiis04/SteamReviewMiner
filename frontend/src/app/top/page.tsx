"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { CommentsDialog } from "@/components/comments-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { API_BASE_URL } from "@/lib/api";

const GAMES_PER_PAGE = 10;

type TopGame = {
  app_id: string;
  name: string;
  header_image?: string;
  short_description?: string;
  total_reviews: number;
  total_positive: number;
  total_negative: number;
  review_score_desc?: string;
  positive_percentage?: number;
  developers?: string;
};

type Feedback = { type: "success" | "warning" | "error" | "info"; text: string } | null;

export default function TopPage() {
  const { resolvedTheme } = useTheme();
  const [sort, setSort] = useState("rating");
  const [minReviews, setMinReviews] = useState("100");
  const [limit, setLimit] = useState("50");
  const [games, setGames] = useState<TopGame[]>([]);
  const [allGames, setAllGames] = useState<TopGame[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInfo, setDialogInfo] = useState<{ appId: string; name: string } | null>(null);

  const steamIcon = resolvedTheme === "dark" ? "/steam-3.svg" : "/steam-4.svg";

  const paginatedGames = useMemo(() => {
    if (limit !== "all") return games;
    const start = (page - 1) * GAMES_PER_PAGE;
    return allGames.slice(start, start + GAMES_PER_PAGE);
  }, [games, allGames, limit, page]);

  const totalPages = useMemo(() => {
    if (limit !== "all") return 1;
    return Math.max(1, Math.ceil(allGames.length / GAMES_PER_PAGE));
  }, [limit, allGames]);

  useEffect(() => {
    void loadTopGames();
  }, []);

  async function loadTopGames(options?: { limit?: string; sort?: string; minReviews?: string }) {
    setIsLoading(true);
    setFeedback(null);
    try {
      const nextLimit = options?.limit ?? limit;
      const nextSort = options?.sort ?? sort;
      const nextMinReviews = options?.minReviews ?? minReviews;
      const fetchLimit = nextLimit === "all" ? "10000" : nextLimit;
      const url = `${API_BASE_URL}/top-games?sort=${nextSort}&min_reviews=${nextMinReviews}&limit=${fetchLimit}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success && data.games) {
        if (nextLimit === "all") {
          setAllGames(data.games);
          setPage(1);
        }
        setGames(data.games);
        if (options?.limit) setLimit(options.limit);
        if (options?.sort) setSort(options.sort);
        if (options?.minReviews) setMinReviews(options.minReviews);
      } else {
        setGames([]);
        setAllGames([]);
        setFeedback({ type: "warning", text: data.error || "Nenhum jogo encontrado." });
      }
    } catch (error) {
      setFeedback({ type: "error", text: "Erro ao carregar os jogos." });
    } finally {
      setIsLoading(false);
    }
  }

  async function triggerPreload() {
    setFeedback(null);
    try {
      const response = await fetch(`${API_BASE_URL}/preload?limit=100`);
      const data = await response.json();
      if (data.success) {
        setFeedback({
          type: "info",
          text: `Pré-carregamento iniciado para ${data.total} jogos. Aguarde alguns minutos e atualize a lista.`,
        });
      } else {
        setFeedback({ type: "error", text: "Erro ao iniciar pré-carregamento." });
      }
    } catch (error) {
      setFeedback({ type: "error", text: "Erro ao iniciar pré-carregamento." });
    }
  }

  function openComments(appId: string, name: string) {
    setDialogInfo({ appId, name });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Jogos melhores avaliados</h1>
        <p className="text-muted-foreground">Filtre e visualize os jogos com mais avaliações positivas.</p>
      </div>

      <Card className="border-dashed bg-muted/40 shadow-none">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Como usar esta página</CardTitle>
            <CardDescription>
              1) Ajuste filtros • 2) Clique em Atualizar • 3) Abra comentários para detalhes.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setLimit("20");
                void loadTopGames({ limit: "20" });
              }}
            >
              Ver Top 20 agora
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href="/">Voltar para busca</a>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Escolha ordenação, quantidade mínima de avaliações e limite.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Ordenar por</Label>
            <Select value={sort} onValueChange={(value) => setSort(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Melhor avaliação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Melhor avaliação</SelectItem>
                <SelectItem value="reviews">Mais avaliações</SelectItem>
                <SelectItem value="recent">Mais recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mínimo de avaliações</Label>
            <Select value={minReviews} onValueChange={(value) => setMinReviews(value)}>
              <SelectTrigger>
                <SelectValue placeholder="100+" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10+</SelectItem>
                <SelectItem value="50">50+</SelectItem>
                <SelectItem value="100">100+</SelectItem>
                <SelectItem value="500">500+</SelectItem>
                <SelectItem value="1000">1000+</SelectItem>
                <SelectItem value="5000">5000+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Select value={limit} onValueChange={(value) => setLimit(value)}>
              <SelectTrigger>
                <SelectValue placeholder="50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                void loadTopGames();
              }}
              disabled={isLoading}
            >
              {isLoading ? "Carregando..." : "Atualizar"}
            </Button>
            <Button variant="outline" onClick={triggerPreload}>
              Pré-carregar 100
            </Button>
          </div>
        </CardContent>
      </Card>

      {feedback ? (
        <div
          className={
            feedback.type === "error"
              ? "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              : feedback.type === "warning"
              ? "rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              : "rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          }
        >
          {feedback.text}
        </div>
      ) : null}

      <Separator />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Exibindo {limit === "all" ? allGames.length : games.length} jogo(s){" "}
          {limit === "all" ? "paginação local em 10 por página" : ""}
        </span>
        <span>
          Filtro: {sort === "rating" ? "Melhor avaliação" : sort === "reviews" ? "Mais avaliações" : "Mais recentes"}
          {" • "}Mínimo: {minReviews}+ avaliações
        </span>
      </div>

      {paginatedGames.length === 0 && !isLoading ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 p-6 text-center text-muted-foreground">
            <div className="text-lg font-semibold text-foreground">Nenhum jogo encontrado.</div>
            <p>Use a página inicial para buscar jogos ou execute o pré-carregamento.</p>
            <Button variant="outline" onClick={triggerPreload}>Iniciar pré-carregamento</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedGames.map((game, index) => {
            const rank = limit === "all" ? (page - 1) * GAMES_PER_PAGE + index + 1 : index + 1;
            const percentage = game.positive_percentage || 0;
            const badgeTone =
              percentage >= 90 ? "bg-emerald-100 text-emerald-800" : percentage >= 75 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800";
            return (
              <Card key={game.app_id} className="flex h-full flex-col">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>#{rank}</span>
                    <span>AppID: {game.app_id}</span>
                  </div>
                  <CardTitle className="text-base leading-tight">{game.name}</CardTitle>
                  {game.short_description ? (
                    <CardDescription className="line-clamp-2">{game.short_description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <img
                    src={
                      game.header_image ||
                      `https://cdn.akamai.steamstatic.com/steam/apps/${game.app_id}/header.jpg`
                    }
                    alt={game.name}
                    className="h-32 w-full rounded-md object-cover"
                  />
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className={badgeTone}>{percentage}% positivas</Badge>
                    <span className="text-muted-foreground">{game.review_score_desc || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-muted/60 px-3 py-2">
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="font-semibold">{new Intl.NumberFormat("pt-BR").format(game.total_reviews)}</div>
                    </div>
                    <div className="rounded-md bg-muted/60 px-3 py-2">
                      <div className="text-xs text-muted-foreground">Positivas</div>
                      <div className="font-semibold text-emerald-600">
                        {new Intl.NumberFormat("pt-BR").format(game.total_positive)}
                      </div>
                    </div>
                    <div className="rounded-md bg-muted/60 px-3 py-2">
                      <div className="text-xs text-muted-foreground">Negativas</div>
                      <div className="font-semibold text-red-500">
                        {new Intl.NumberFormat("pt-BR").format(game.total_negative)}
                      </div>
                    </div>
                  </div>
                  {game.developers ? (
                    <div className="text-xs text-muted-foreground">{game.developers}</div>
                  ) : null}
                  <div className="mt-auto flex gap-2">
                    <Button className="flex-1" size="sm" onClick={() => openComments(game.app_id, game.name)}>
                      Ver comentários
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`https://store.steampowered.com/app/${game.app_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center"
                        aria-label="Abrir na Steam"
                      >
                        <img src={steamIcon} alt="Steam" className="h-12 w-12" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Anterior
          </Button>
          <div className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </Button>
        </div>
      ) : null}

      <CommentsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appId={dialogInfo?.appId || null}
        gameName={dialogInfo?.name || ""}
      />
    </div>
  );
}
