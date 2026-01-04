"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CommentsDialog } from "@/components/comments-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

type SearchResult = {
  appid: string;
  name: string;
  header_image?: string;
};

type ReviewSummary = {
  total_reviews: number;
  total_positive: number;
  total_negative: number;
  review_score_desc?: string;
};

type GameSummary = {
  appId: string;
  name: string;
  reviewsData: ReviewSummary;
};

type KeywordGame = {
  app_id: string;
  name: string;
  header_image?: string;
  positive_percentage?: number;
  total_reviews?: number;
  comment_matches?: number;
  short_description?: string;
  relevance_score?: number;
};

type Feedback = {
  type: "success" | "warning" | "error" | "info";
  text: string;
} | null;

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywordResults, setKeywordResults] = useState<KeywordGame[]>([]);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInfo, setDialogInfo] = useState<{ appId: string; name: string; keywords?: string[] } | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTerm.trim().length < 2 || /^\d+$/.test(searchTerm.trim())) {
      setSearchResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(() => {
      void fetchSuggestions(searchTerm.trim());
    }, 250);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchTerm]);

  const gamesList = useMemo(() => games, [games]);

  async function fetchSuggestions(term: string) {
    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(term)}`);
      const data = await response.json();
      if (data.success && data.games) {
        setSearchResults(data.games);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  async function addGame(appIdParam?: string) {
    const appId = appIdParam || selectedAppId || searchTerm.trim();

    if (!/^\d+$/.test(appId)) {
      setFeedback({ type: "warning", text: "Selecione um jogo da lista ou digite um AppID válido." });
      return;
    }

    if (games.find((g) => g.appId === appId)) {
      setFeedback({ type: "info", text: "Este jogo já foi adicionado." });
      setSearchTerm("");
      setSelectedAppId(null);
      return;
    }

    setIsAdding(true);
    setFeedback(null);

    try {
      const reviewsResponse = await fetch(`${API_BASE_URL}/game/reviews/${appId}?num_per_page=0`);
      const reviewsData = await reviewsResponse.json();
      if (!reviewsData.success) throw new Error("Jogo não encontrado ou sem avaliações");

      const detailsResponse = await fetch(`${API_BASE_URL}/game/details/${appId}`);
      const detailsData = await detailsResponse.json();

      const gameName = detailsData[appId]?.data?.name || `Jogo ${appId}`;

      const summary: GameSummary = {
        appId,
        name: gameName,
        reviewsData: {
          total_reviews: reviewsData.query_summary?.total_reviews || 0,
          total_positive: reviewsData.query_summary?.total_positive || 0,
          total_negative: reviewsData.query_summary?.total_negative || 0,
          review_score_desc: reviewsData.query_summary?.review_score_desc,
        },
      };

      setGames((prev) => [...prev, summary]);
      setSearchTerm("");
      setSelectedAppId(null);
      setSearchResults([]);
      setFeedback({ type: "success", text: `Jogo "${gameName}" adicionado com sucesso!` });
    } catch (error) {
      setFeedback({ type: "error", text: "Erro ao buscar informações do jogo. Verifique o AppID." });
    } finally {
      setIsAdding(false);
    }
  }

  function removeGame(appId: string) {
    setGames((prev) => prev.filter((g) => g.appId !== appId));
  }

  function openComments(appId: string, name: string, keywords?: string[]) {
    setDialogInfo({ appId, name, keywords });
    setDialogOpen(true);
  }

  async function searchByKeywords() {
    if (keywordInput.trim().length < 2) {
      setFeedback({ type: "warning", text: "Digite ao menos uma palavra-chave." });
      return;
    }

    setKeywordLoading(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/search/keywords?keywords=${encodeURIComponent(keywordInput.trim())}`
      );
      const data = await response.json();
      if (data.success) {
        setKeywordResults(data.games || []);
      } else {
        setKeywordResults([]);
        setFeedback({ type: "error", text: data.message || "Erro ao buscar por palavras-chave." });
      }
    } catch (error) {
      setFeedback({ type: "error", text: "Erro ao buscar por palavras-chave." });
    } finally {
      setKeywordLoading(false);
    }
  }

  const feedbackClass = useMemo(() => {
    if (!feedback) return "";
    if (feedback.type === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (feedback.type === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
    if (feedback.type === "info") return "border-blue-200 bg-blue-50 text-blue-800";
    return "border-red-200 bg-red-50 text-red-700";
  }, [feedback]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Steam Game Reviews</h1>
        <p className="text-muted-foreground">Busque jogos, analise comentários e encontre títulos populares.</p>
      </div>

      {feedback ? (
        <div className={cn("rounded-md border px-4 py-3 text-sm", feedbackClass)}>{feedback.text}</div>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader className="gap-2">
          <CardTitle>Buscar jogo da Steam</CardTitle>
          <CardDescription>Digite o nome ou AppID do jogo para adicionar à lista.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative w-full">
              <Input
                placeholder="Ex: Counter-Strike, 730"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedAppId(null);
                }}
              />
              {searchTerm.length >= 2 && searchResults.length > 0 ? (
                <div className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-background shadow">
                  {isSearching ? (
                    <div className="p-3 text-sm text-muted-foreground">Buscando...</div>
                  ) : null}
                  {searchResults.map((result) => (
                    <button
                      key={result.appid}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                      onClick={() => {
                        setSearchTerm(result.name);
                        setSelectedAppId(result.appid);
                      }}
                    >
                      <img
                        src={result.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${result.appid}/capsule_184x69.jpg`}
                        alt={result.name}
                        className="h-12 w-24 rounded-md object-cover"
                      />
                      <div className="flex-1">
                        <div className="font-medium leading-tight">{result.name}</div>
                        <div className="text-xs text-muted-foreground">AppID: {result.appid}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Button className="md:w-40" onClick={() => addGame()} disabled={isAdding}>
              {isAdding ? "Adicionando..." : "Buscar jogo"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Dica: digite o nome do jogo ou o AppID numérico.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="gap-2">
          <CardTitle>Buscar por palavras-chave nos comentários</CardTitle>
          <CardDescription>Encontre jogos cujos comentários contêm os termos informados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              placeholder="Ex: terror, cooperativo, engraçado"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
            />
            <Button className="md:w-48" variant="secondary" onClick={searchByKeywords} disabled={keywordLoading}>
              {keywordLoading ? "Buscando..." : "Buscar comentários"}
            </Button>
          </div>

          {keywordResults.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{keywordResults.length} jogo(s) encontrado(s)</div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {keywordResults.map((game, idx) => (
                  <Card key={game.app_id} className="h-full">
                    <CardHeader className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>#{idx + 1}</span>
                        <span>AppID: {game.app_id}</span>
                      </div>
                      <CardTitle className="text-base leading-tight">{game.name}</CardTitle>
                      {game.short_description ? (
                        <CardDescription className="line-clamp-2">{game.short_description}</CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <img
                        src={
                          game.header_image ||
                          `https://cdn.akamai.steamstatic.com/steam/apps/${game.app_id}/header.jpg`
                        }
                        alt={game.name}
                        className="h-32 w-full rounded-md object-cover"
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline">{game.positive_percentage || 0}% positivas</Badge>
                        <Badge variant="secondary">{new Intl.NumberFormat("pt-BR").format(game.total_reviews || 0)} reviews</Badge>
                        <Badge>{game.comment_matches || 0} comentários</Badge>
                      </div>
                      <div className="grid gap-2 text-sm">
                        <Button size="sm" onClick={() => addGame(game.app_id)}>Adicionar à lista</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openComments(game.app_id, game.name)}
                        >
                          Ver todos os comentários
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openComments(game.app_id, game.name, keywordInput.split(/[,;\s]+/).filter(Boolean))}
                        >
                          Ver relevantes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Jogos adicionados</h2>
          <span className="text-sm text-muted-foreground">{gamesList.length} jogo(s)</span>
        </div>

        {gamesList.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
            Nenhum jogo adicionado ainda. Use a busca acima para começar.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {gamesList.map((game) => {
              const total = game.reviewsData.total_reviews || 0;
              const positive = game.reviewsData.total_positive || 0;
              const percentage = total > 0 ? ((positive / total) * 100).toFixed(1) : "0";
              return (
                <Card key={game.appId} className="relative overflow-hidden">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-lg">{game.name}</CardTitle>
                    <CardDescription>AppID: {game.appId}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Badge variant="secondary" className="text-base font-semibold">
                        {percentage}%
                      </Badge>
                      <span className="text-muted-foreground">{game.reviewsData.review_score_desc || "N/A"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-muted/60 px-3 py-2">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="font-semibold">
                          {new Intl.NumberFormat("pt-BR").format(total)}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/60 px-3 py-2">
                        <div className="text-xs text-muted-foreground">Positivas</div>
                        <div className="font-semibold text-emerald-600">
                          {new Intl.NumberFormat("pt-BR").format(game.reviewsData.total_positive)}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/60 px-3 py-2">
                        <div className="text-xs text-muted-foreground">Negativas</div>
                        <div className="font-semibold text-red-500">
                          {new Intl.NumberFormat("pt-BR").format(game.reviewsData.total_negative)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => openComments(game.appId, game.name)}>
                        Ver comentários
                      </Button>
                      <Button variant="outline" onClick={() => removeGame(game.appId)}>
                        Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CommentsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appId={dialogInfo?.appId || null}
        gameName={dialogInfo?.name || ""}
        presetKeywords={dialogInfo?.keywords}
      />
    </div>
  );
}
