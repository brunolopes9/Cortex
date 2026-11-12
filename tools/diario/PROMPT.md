Hoje é {{DATA}}. Vais escrever UM artigo novo para o blog da Cortex Automation (https://www.cortexautomationai.com), em quatro línguas (pt, en, fr, es), para trazer visitas do Google e do Bing.

## 1. Lê primeiro
- `/site/tools/diario/existentes.txt`: todos os artigos que já existem (id | palavra-chave | título). NÃO repitas nem canibalizes nenhuma destas palavras-chave.
- `/site/tools/diario/historico.txt`: os últimos artigos automáticos, com o tipo (noticia/guia).

## 2. Escolhe o tema
Alterna o tipo em relação ao último do histórico:
- **noticia**: uma notícia de mercados ou economia das últimas 24–72 h com impacto em Portugal ou na Europa (Euribor e prestação da casa, BCE, inflação, combustíveis, bolsa, a bitcoin, ouro, impostos sobre investimentos, poupança). Pesquisa na web. Só factos confirmados em pelo menos 2 fontes de referência (Lusa, ECO, Expresso, Público, Jornal de Negócios, Reuters, Bloomberg, BCE, Banco de Portugal, INE). Rumor diz-se rumor. Se não houver nada confirmado e relevante, escreve um **guia**.
- **guia**: um tema educativo de trading/investimento com intenção de pesquisa real ("o que é…", "como…", "vale a pena…", "X ou Y", "quanto…"), que ainda não exista.
O artigo tem de responder logo à pergunta de quem pesquisa e explicar com um exemplo simples, com números redondos e claramente hipotéticos (exceto factos da notícia, que têm fonte).

## 3. Regras (obrigatórias)
- Português de Portugal natural (nunca brasileiro). Escreve cada língua de raiz, não traduzas palavra a palavra.
- Em português: "a bitcoin" (feminino). Nunca "Fed": diz "Reserva Federal (o banco central dos EUA)". "BCE (Banco Central Europeu)".
- Tom calmo e educativo, sem medo nem sensacionalismo, sem promessas, sem "ficar rico", sem estatísticas ou citações inventadas.
- Cada artigo deixa claros os riscos e termina com uma nota curta: informação geral, não é aconselhamento financeiro; rentabilidade passada não garante resultados futuros.
- A Cortex Automation pode aparecer no máximo UMA vez, de forma sóbria e só onde fizer sentido, usando apenas estes factos: software de trading automático; o dinheiro fica na conta de corretora do próprio cliente; sem mensalidade nem taxa de adesão, só partilha de lucro; histórico publicado com os meses maus, em que jan/2024–jan/2026 é teste sobre dados históricos e desde fev/2026 é conta real. NUNCA números de rentabilidade da Cortex.
- SEO: palavra-chave principal no h1, nas primeiras 100 palavras e em pelo menos um h2; h2/h3 com as perguntas que as pessoas pesquisam; parágrafos curtos; uma tabela quando ajudar.
- Nas notícias, o último parágrafo do corpo é `<p><em>Fontes: …</em></p>` com os nomes das fontes e as datas (sem links).

## 4. Escreve UM só ficheiro
Usa a ferramenta Write para criar `/site/tools/blog-dados/<id>.json` (id em minúsculas, com hífenes, sem acentos, em português, ex.: `euribor-novembro-2026`). Nada mais: não alteres nenhum outro ficheiro.

Estrutura exata (JSON válido, UTF-8):
```
{
 "id": "<id>",
 "data": "{{DATA}}",
 "auto": true,
 "tipo": "noticia" | "guia",
 "lang": {
  "pt": {
   "slug": "<slug na língua, minúsculas, hífenes, sem acentos, 3–7 palavras>",
   "titulo": "<title SEO 45–60 caracteres, palavra-chave primeiro>",
   "descricao": "<meta description 140–158 caracteres>",
   "h1": "...",
   "lead": "<2–3 frases que respondem logo à pesquisa>",
   "palavra_chave": "...",
   "corpo": "<HTML só com h2, h3, p, ul, ol, li, strong, em, table, thead, tbody, tr, th, td. Sem h1, sem links, sem imagens. 900–1400 palavras>",
   "faq": [{"q": "...", "a": "..."}, ... 4 a 5],
   "tempo_leitura": <minutos>
  },
  "en": { ...igual... },
  "fr": { ...igual... },
  "es": { ...igual... }
 }
}
```
Quando acabares, responde só com o id e o título em português.
