"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid gap-8 rounded-2xl border bg-gradient-to-br from-background to-muted/60 p-8 md:grid-cols-2">
        <div className="space-y-4">
          <Badge variant="secondary" className="text-xs">Novo</Badge>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">Steam Review Miner: entenda jogos pelo que os jogadores dizem</h1>
            <p className="text-lg text-muted-foreground">Busque jogos, veja as melhores avaliações e filtre comentários relevantes com BM25 e palavras-chave.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/explore">Começar agora</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/top">Ver top jogos</Link>
            </Button>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">• Adicione jogos pelo nome ou AppID</div>
            <div className="flex items-center gap-2">• Filtre comentários úteis primeiro</div>
            <div className="flex items-center gap-2">• Compare jogos pelo sentimento dos reviews</div>
          </div>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Exemplo rápido</CardTitle>
            <CardDescription>Como ficaria uma busca por “Stardew Valley”.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <img
              src="https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg"
              alt="Stardew Valley"
              className="h-40 w-full rounded-md object-cover"
            />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="text-base font-semibold">97% positivas</Badge>
              <Badge variant="outline">500k+ reviews</Badge>
              <Badge variant="outline">Sentimento: Overwhelmingly Positive</Badge>
            </div>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/explore">Ver comentários</Link>
              </Button>
              <Button asChild variant="ghost" className="gap-2">
                <a href="https://store.steampowered.com/app/413150" target="_blank" rel="noreferrer">
                  <span className="inline-flex items-center gap-2">
                    <img src="/steam-logo.svg" alt="Steam" className="h-4 w-4" />
                    Abrir na Steam
                  </span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>1) Buscar e adicionar</CardTitle>
            <CardDescription>Use nome ou AppID, veja sugestões e construa sua lista.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Selecione um jogo sugerido para evitar erros de AppID e siga para os comentários.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>2) Filtrar comentários</CardTitle>
            <CardDescription>Tags: Todos, Relevantes (BM25) e Palavras-chave.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Priorize os mais úteis, aplique BM25 e revele os pontos que mais importam.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>3) Descobrir tops</CardTitle>
            <CardDescription>Abra a página de Top Jogos já pronta para exploração.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Veja notas agregadas, sentimento e vá direto para os comentários do ranking.</CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Exploração guiada</CardTitle>
            <CardDescription>Comece na página de exploração para adicionar e comparar jogos.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Fluxo completo: busca, filtros, BM25, palavras-chave e comentários úteis.</div>
            <Button asChild>
              <Link href="/explore">Ir para explorar</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Top jogos</CardTitle>
            <CardDescription>Ranking já pronto com filtros de avaliações.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Ordene por melhor avaliação, mais reviews ou mais recentes e abra os comentários.</div>
            <Button asChild variant="secondary">
              <Link href="/top">Ver ranking</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Benefício imediato</CardTitle>
            <CardDescription>Economize tempo lendo só o que importa.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">BM25 + filtro de utilidade destacam comentários com mais sinal, não apenas volume.</CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Para quem é</CardTitle>
            <CardDescription>Curadores, devs, jogadores indecisos.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Ajuda a validar percepção do público, priorizar backlog ou decidir compra.</CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Tema e acessibilidade</CardTitle>
            <CardDescription>Light/Dark com foco visível e badges legíveis.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Use o toggle no topo; contrastes e foco seguem padrões do shadcn UI.</CardContent>
        </Card>
      </section>
    </div>
  );
}
