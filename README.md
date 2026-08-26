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
  telegram:  '',        // ex.: 'https://t.me/cortexautomation'
  instagram: '',        // ex.: 'https://instagram.com/cortexautomation'
  analytics: '',        // ex.: 'G-XXXXXXXXXX'
  formEndpoint: ''      // ex.: 'https://formspree.io/f/xxxxxxxx'
};
```

Campos vazios escondem automaticamente os elementos correspondentes.

## Antes de publicar num domínio próprio

Substituir `https://www.cortexautomation.pt` pelo domínio real em `index.html`,
`privacidade.html`, `termos.html`, `robots.txt` e `sitemap.xml` — é o endereço
usado nas tags canónicas e de partilha.

## Aviso

A informação apresentada tem carácter informativo e não constitui aconselhamento
financeiro. A negociação em mercados financeiros envolve risco significativo de
perda de capital.
