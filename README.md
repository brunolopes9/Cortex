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

**`enhance.js`** é o acabamento. Carrega as bibliotecas de animação de forma
assíncrona e só depois do primeiro render, cada uma no seu bloco de segurança.
É esta separação que permite ter 3D no hero sem comprometer o tempo de carregamento.

### Interruptores de diagnóstico

Acrescentar ao endereço para desligar partes sem tocar no código:

| Endereço | Efeito |
|---|---|
| `?nofx` | desliga toda a camada de enriquecimento |
| `?nothree` | desliga o 3D do hero |
| `?nogsap` | desliga as animações de scroll |
| `?nolenis` | desliga o scroll suave |
| `?notaxi` | desliga as transições entre páginas |

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
