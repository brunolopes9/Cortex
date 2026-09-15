# Cortex Automation — site

Site institucional de uma página, em HTML, CSS e JavaScript.
Sem build, sem dependências obrigatórias e sem framework: abre com duplo clique
no `index.html` ou serve-se estaticamente a partir de qualquer alojamento.

## Estrutura

```
index.html            página principal
privacidade.html      política de privacidade (RGPD)
termos.html           termos, condições e aviso de risco
404.html              página de erro
robots.txt            sitemap.xml
css/style.css
js/main.js            funcionalidade base — zero dependências externas
js/enhance.js         three.js · GSAP · Lenis · Rive · Taxi.js (progressivo)
assets/               logótipo, favicons, imagens de performance e relatório
```

## Duas camadas de JavaScript

**`main.js`** é a base. Não carrega nada de fora. Trata da navegação, das
revelações ao scroll, do gráfico do hero, do simulador de juro composto, das
perguntas frequentes, do formulário de contacto e do banner de cookies.
Se um CDN estiver em baixo ou a ligação for má, **o site funciona por inteiro**.

**`enhance.js`** é o acabamento opcional: three.js, GSAP, Lenis e Taxi.js.
Está **desligado por defeito** — o site publicado fica igual ao que se vê ao abrir
o `index.html` directamente, sem a rede 3D no hero nem scroll com inércia.

Para o experimentar, acrescentar `?fx` ao endereço. Para o ligar de forma
permanente, trocar a condição no fim do `index.html` por `true`.

### Interruptores

| Endereço | Efeito |
|---|---|
| `?fx` | liga a camada de animação |
| `?fx&nothree` | liga tudo menos o 3D do hero |
| `?fx&nogsap` | liga tudo menos as animações de scroll |
| `?fx&nolenis` | liga tudo menos o scroll suave |

## Configuração

Tudo o que é contacto está no topo de `js/main.js`:

```js
var CONFIG = {
  whatsapp:  '351933938716',
  telegram:  'https://t.me/+QadwFS41SooxYTBk',
  instagram: '',        // ex.: 'https://instagram.com/cortexautomation'
  analytics: '',        // ex.: 'G-XXXXXXXXXX'
  formEndpoint: ''      // ex.: 'https://formspree.io/f/xxxxxxxx'
};
```

Campos vazios escondem automaticamente os elementos correspondentes.

## Publicação

O site está publicado na Vercel a partir deste repositório. Não há build:
os ficheiros são servidos tal como estão, com `index.html` na raiz.
Preset **Other**, sem comando de build e sem output directory.

O `vercel.json` só acrescenta cabeçalhos: HSTS, `nosniff`, `X-Frame-Options`,
`Referrer-Policy` e `Permissions-Policy`, mais um dia de cache (com uma semana
de `stale-while-revalidate`) para o que está em `assets/`.

O DNS está na Cloudflare, mas os registos do site ficam em **DNS only**
(nuvem cinzenta): quem trata do TLS é a Vercel. Com a nuvem laranja há dois
CDNs em cima um do outro e a emissão do certificado da Vercel falha.

## Domínio

O endereço canónico é `https://cortexautomationai.com`, usado nas tags canónicas,
no `robots.txt` e no `sitemap.xml`. Se algum dia mudar, é um find-and-replace
em `index.html`, `privacidade.html`, `termos.html`, `robots.txt` e `sitemap.xml`.

## Vídeo de apresentação (VSL)

O vídeo abre o site, logo no primeiro ecrã, e é entregue pela **CDN da Cloudinary**
— o MP4 não está no repositório. O URL traz `q_auto` e `f_auto`, para a Cloudinary
escolher a qualidade e o formato conforme o navegador:

```
https://res.cloudinary.com/mzqx3xbc/video/upload/q_auto/f_auto/v1789233073/vsl-720.mp4
```

O player é o do site — um `<video>` normal com uma camada de play por cima.
Não usamos o player nem o iframe da Cloudinary.

Fica em `preload="metadata"`: ao abrir a página só se lê o cabeçalho do ficheiro,
não os 4,3 MB. Até o visitante carregar em play vê-se `assets/vsl-poster.jpg`.

Para trocar o vídeo: carregar o novo ficheiro na Cloudinary e actualizar o `src`
do `<source>` no `index.html` (e o link da alternativa, logo por baixo).

## Aviso

A informação apresentada tem carácter informativo e não constitui aconselhamento
financeiro. A negociação em mercados financeiros envolve risco significativo de
perda de capital.
