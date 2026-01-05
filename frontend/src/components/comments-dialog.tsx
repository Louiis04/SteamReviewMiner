"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ReviewComment = {
  recommendationid?: string;
  review?: string;
  votes_up?: number;
  votes_down?: number;
  voted_up?: boolean;
  author?: {
    steamid?: string;
    playtime_forever?: number;
    playtime_at_review_time?: number;
  };
  timestamp_created?: number;
  utilityScore?: number;
  score?: number;
};

export type CommentFilters = {
  sentiment: string;
  dateOrder: string;
  minPlaytime: string;
  minVotesUp: string;
  minTextLength: string;
  minUtilityScore: string;
  minBM25: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string | null;
  gameName: string;
  summary?: {
    totalReviews?: number;
    positive?: number;
    scoreDesc?: string;
  };
  presetKeywords?: string[];
};

type CommentResponse = {
  success?: boolean;
  reviews?: ReviewComment[];
  comments?: ReviewComment[];
  cursor?: string;
  total?: number;
};

const defaultFilters: CommentFilters = {
  sentiment: "all",
  dateOrder: "relevance",
  minPlaytime: "",
  minVotesUp: "",
  minTextLength: "",
  minUtilityScore: "",
  minBM25: "",
};

export function CommentsDialog({
  open,
  onOpenChange,
  appId,
  gameName,
  summary,
  presetKeywords,
}: Props) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [cursor, setCursor] = useState<string>("*");
  const [isLoading, setIsLoading] = useState(false);
  const [bm25Query, setBm25Query] = useState("");
  const [keywordQuery, setKeywordQuery] = useState("");
  const [filters, setFilters] = useState<CommentFilters>(defaultFilters);
  const [mode, setMode] = useState<"default" | "keywords" | "bm25">(
    presetKeywords && presetKeywords.length > 0 ? "keywords" : "default"
  );
  const [activeTab, setActiveTab] = useState<"default" | "bm25" | "keywords">(
    presetKeywords && presetKeywords.length > 0 ? "keywords" : "default"
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && appId) {
      setComments([]);
      setCursor("*");
      setFilters(defaultFilters);
      const preset = presetKeywords?.join(", ") || "";
      setKeywordQuery(preset);
      setBm25Query(presetKeywords?.join(" ") || "");
      const nextMode = presetKeywords && presetKeywords.length > 0 ? "keywords" : "default";
      setMode(nextMode);
      setActiveTab(nextMode);
      setShowAdvanced(false);
      if (presetKeywords && presetKeywords.length > 0) {
        fetchKeywordComments(presetKeywords);
      } else {
        fetchComments("*");
      }
    }
  }, [open, appId, presetKeywords]);

  const orderedComments = useMemo(() => {
    let data = [...comments];
    if (filters.dateOrder === "newest") {
      data.sort((a, b) => (b.timestamp_created || 0) - (a.timestamp_created || 0));
    } else if (filters.dateOrder === "oldest") {
      data.sort((a, b) => (a.timestamp_created || 0) - (b.timestamp_created || 0));
    }
    return data;
  }, [comments, filters.dateOrder]);

  async function fetchComments(nextCursor: string) {
    if (!appId) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE_URL}/game/comments/${appId}`);
      url.searchParams.set("num_per_page", "10");
      url.searchParams.set("cursor", nextCursor);
      if (filters.sentiment) url.searchParams.set("sentiment", filters.sentiment);
      if (filters.dateOrder && filters.dateOrder !== "relevance")
        url.searchParams.set("dateOrder", filters.dateOrder);
      if (filters.minPlaytime) url.searchParams.set("minPlaytime", filters.minPlaytime);
      if (filters.minVotesUp) url.searchParams.set("minVotesUp", filters.minVotesUp);
      if (filters.minTextLength) url.searchParams.set("minTextLength", filters.minTextLength);
      if (filters.minUtilityScore)
        url.searchParams.set("minUtilityScore", filters.minUtilityScore);

      const response = await fetch(url.toString());
      const data: CommentResponse = await response.json();

      const received = data.reviews || data.comments || [];
      const filtered = applyLocalFilters(received);

      setComments((prev) => (nextCursor === "*" ? filtered : [...prev, ...filtered]));
      setCursor(data.cursor || "");
      setMode("default");
      setActiveTab("default");
    } catch (err) {
      setError("Erro ao carregar comentários.");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchKeywordComments(keywords: string[]) {
    if (!appId || keywords.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE_URL}/game/comments/keywords/${appId}`);
      url.searchParams.set("keywords", keywords.join(","));
      url.searchParams.set("limit", "20");
      const response = await fetch(url.toString());
      const data: CommentResponse = await response.json();
      const received = data.comments || [];
      setComments(applyLocalFilters(received));
      setCursor("");
      setMode("keywords");
      setActiveTab("keywords");
    } catch (err) {
      setError("Erro ao buscar comentários relevantes.");
    } finally {
      setIsLoading(false);
    }
  }

  function applyLocalFilters(raw: ReviewComment[]) {
    return raw.filter((c) => {
      if (filters.sentiment === "positive" && !c.voted_up) return false;
      if (filters.sentiment === "negative" && c.voted_up) return false;
      if (filters.minPlaytime && ((c.author?.playtime_forever || 0) / 60 < Number(filters.minPlaytime))) return false;
      if (filters.minVotesUp && (c.votes_up || 0) < Number(filters.minVotesUp)) return false;
      if (filters.minTextLength && (c.review || "").length < Number(filters.minTextLength)) return false;
      if (filters.minUtilityScore && (c.utilityScore || 0) < Number(filters.minUtilityScore)) return false;
      if (mode === "bm25" && filters.minBM25 && (c.score || 0) < Number(filters.minBM25)) return false;
      return true;
    });
  }

  async function handleBm25Search() {
    if (!appId || !bm25Query.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}/reviews/search?appId=${appId}&query=${encodeURIComponent(
        bm25Query.trim()
      )}`;
      const response = await fetch(url);
      const data: ReviewComment[] = await response.json();
      const filtered = applyLocalFilters(data);
      setComments(filtered);
      setCursor("");
      setMode("bm25");
      setActiveTab("bm25");
    } catch (err) {
      setError("Erro ao buscar por BM25.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleKeywordSearch() {
    const keywords = keywordQuery.split(/[,;]+|\s+/).map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) return;
    await fetchKeywordComments(keywords);
  }

  function handleTabChange(value: string) {
    const tab = value as "default" | "bm25" | "keywords";
    setActiveTab(tab);
    setMode(tab);
    setError(null);
    setComments([]);
    if (tab === "default") {
      setCursor("*");
      void fetchComments("*");
    }
    if (tab === "keywords") {
      setCursor("");
      const keywords = keywordQuery.split(/[,;]+|\s+/).map((k) => k.trim()).filter(Boolean);
      if (keywords.length > 0) {
        void fetchKeywordComments(keywords);
      }
    }
    if (tab === "bm25") {
      setCursor("");
    }
  }

  function renderComment(comment: ReviewComment) {
    const date = comment.timestamp_created
      ? new Date(comment.timestamp_created * 1000).toLocaleDateString("pt-BR")
      : "";
    const voteLabel = comment.voted_up ? "Positiva" : "Negativa";
    const voteColor = comment.voted_up ? "text-emerald-600" : "text-red-500";
    const utility = comment.utilityScore ?? 0;
    const scoreBadge =
      utility >= 8 ? "bg-emerald-100 text-emerald-800" : utility >= 5 ? "bg-blue-100 text-blue-800" : "bg-muted";

    return (
      <div
        key={comment.recommendationid || `${comment.timestamp_created}-${comment.review?.slice(0, 20)}`}
        className="space-y-2 rounded-lg border p-4"
      >
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {comment.author?.steamid || "Usuário Steam"}
          </span>
          <span>{date}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge className={cn("font-semibold", scoreBadge)}>
            Score de Utilidade: {utility.toFixed(1)} / 10
          </Badge>
          {mode === "bm25" && comment.score ? (
            <Badge variant="outline">Relevância BM25: {comment.score.toFixed(4)}</Badge>
          ) : null}
          <span className={cn("flex items-center gap-1 font-semibold", voteColor)}>
            {voteLabel}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {comment.review || "Sem texto de comentário."}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>
            👍 {new Intl.NumberFormat("pt-BR").format(comment.votes_up || 0)} úteis
          </span>
          <span>👎 {new Intl.NumberFormat("pt-BR").format(comment.votes_down || 0)}</span>
          {comment.author?.playtime_forever ? (
            <span>
              ⏱ {(comment.author.playtime_forever / 60).toFixed(1)}h jogadas
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <DialogTitle>Comentários - {gameName}</DialogTitle>
              <DialogDescription>
                Filtre, pesquise por BM25 ou veja comentários relevantes.
              </DialogDescription>
              {summary ? (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {summary.totalReviews ? `${Math.round(((summary.positive || 0) / (summary.totalReviews || 1)) * 100)}% positivas` : "Sem dados"}
                  </Badge>
                  {summary.totalReviews ? (
                    <span>{new Intl.NumberFormat("pt-BR").format(summary.totalReviews)} reviews</span>
                  ) : null}
                  {summary.scoreDesc ? <span>• {summary.scoreDesc}</span> : null}
                </div>
              ) : null}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  aria-label="Entenda os scores"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="left" align="start" className="max-w-xs text-xs leading-relaxed">
                <p className="font-semibold">Score de Utilidade</p>
                <p className="text-muted-foreground">
                  Considera likes, tempo de jogo e tamanho do texto para medir a qualidade do comentário.
                </p>
                <div className="mt-2 h-px w-full bg-muted" />
                <p className="font-semibold">Score de Relevância (BM25)</p>
                <p className="text-muted-foreground">
                  Indica o quanto o comentário combina com sua busca ou palavras-chave.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="default">Todos</TabsTrigger>
              <TabsTrigger value="bm25">Relevantes (BM25)</TabsTrigger>
              <TabsTrigger value="keywords">Palavras-chave</TabsTrigger>
            </TabsList>

            <TabsContent value="default">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sentimento</label>
                  <Select
                    value={filters.sentiment}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, sentiment: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="positive">Positivos</SelectItem>
                      <SelectItem value="negative">Negativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ordenação</label>
                  <Select
                    value={filters.dateOrder}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, dateOrder: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Relevância" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevância</SelectItem>
                      <SelectItem value="newest">Mais recentes</SelectItem>
                      <SelectItem value="oldest">Mais antigas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                  <Button variant="secondary" onClick={() => fetchComments("*")}>Atualizar comentários</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilters(defaultFilters);
                      setShowAdvanced(false);
                    }}
                  >
                    Resetar filtros
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvanced((prev) => !prev)}
                  >
                    {showAdvanced ? "Ocultar filtros avançados" : "Filtros avançados"}
                  </Button>
                </div>
                {showAdvanced ? (
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2 md:col-span-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Min. horas jogadas</label>
                      <Input
                        type="number"
                        value={filters.minPlaytime}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minPlaytime: e.target.value }))}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Min. votos úteis</label>
                      <Input
                        type="number"
                        value={filters.minVotesUp}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minVotesUp: e.target.value }))}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Min. tamanho texto</label>
                      <Input
                        type="number"
                        value={filters.minTextLength}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minTextLength: e.target.value }))}
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Min. score utilidade</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={filters.minUtilityScore}
                        onChange={(e) => setFilters((prev) => ({ ...prev, minUtilityScore: e.target.value }))}
                        placeholder="0"
                        min={0}
                        max={10}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="bm25">
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar comentários que contenham…</label>
                  <Input
                    value={bm25Query}
                    onChange={(e) => setBm25Query(e.target.value)}
                    placeholder="Ex: terror, ação, ótimo"
                  />
                  <p className="text-xs text-muted-foreground">Usa BM25 para ordenar por relevância ao termo buscado.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min. relevância BM25</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={filters.minBM25}
                      onChange={(e) => setFilters((prev) => ({ ...prev, minBM25: e.target.value }))}
                      placeholder="1.0"
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min. score utilidade</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={filters.minUtilityScore}
                      onChange={(e) => setFilters((prev) => ({ ...prev, minUtilityScore: e.target.value }))}
                      placeholder="0-10"
                      min={0}
                      max={10}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={handleBm25Search} disabled={!bm25Query.trim()}>
                    Buscar por BM25
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setFilters(defaultFilters)}>
                    Limpar filtros
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="keywords">
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Palavras-chave (separe por vírgula)</label>
                  <Input
                    value={keywordQuery}
                    onChange={(e) => setKeywordQuery(e.target.value)}
                    placeholder="terror, cooperativo, história"
                  />
                  <p className="text-xs text-muted-foreground">Usa busca direta por palavras-chave armazenadas nos comentários.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={handleKeywordSearch} disabled={!keywordQuery.trim()}>
                    Buscar relevantes
                  </Button>
                  {presetKeywords ? (
                    <Badge variant="outline" className="text-xs">
                      Sugestão inicial: {presetKeywords.join(", ")}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="h-[60vh] space-y-3 overflow-y-auto pr-4">
            {isLoading && comments.length === 0 ? (
              <div className="flex justify-center py-6 text-sm text-muted-foreground">Carregando comentários...</div>
            ) : null}

            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {!isLoading && comments.length === 0 && !error ? (
              <div className="text-center text-sm text-muted-foreground">
                Nenhum comentário encontrado com os filtros atuais.
              </div>
            ) : null}

            <div className="space-y-3">
              {orderedComments.map((comment) => renderComment(comment))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {mode === "keywords"
              ? "Exibindo comentários relevantes para as palavras-chave."
              : mode === "bm25"
              ? "Resultados ordenados por relevância BM25."
              : "Resultados padrão paginados."}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {cursor ? (
              <Button onClick={() => fetchComments(cursor)} disabled={isLoading}>
                Carregar mais
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
