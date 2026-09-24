/* ==========================================================================
   CORTEX AUTOMATION — main.js
   Zero dependências. Nada é carregado de fora, por isso a página abre
   instantaneamente e continua a funcionar sem internet ou com CDNs em baixo.
   ========================================================================== */
(function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────────────────
     CONFIGURAÇÃO — é aqui que se muda tudo o que é contacto.
     Preencher telegram/instagram faz os links aparecerem automaticamente
     no rodapé (estão escondidos enquanto estiverem vazios).
     ──────────────────────────────────────────────────────────────────────── */
  var CONFIG = {
    whatsapp:  '351933938716',                       // indicativo + número, sem espaços nem "+"
    waMessage: 'Olá! Vi o site da Cortex Automation e queria saber mais sobre o sistema.',
    telegram:  'https://t.me/+QadwFS41SooxYTBk',      // canal VIP Club
    instagram: 'https://instagram.com/brunolopes_36', // acompanhamento diário: resultados e novidades
    analytics: '',                                   // ex.: 'G-XXXXXXXXXX' (Google Analytics 4)

    // Os pedidos de relatório vão para /api/lead, que corre no servidor
    // da Vercel. É lá que vive a chave da Resend — nunca aqui, que este
    // ficheiro é público. Se a função falhar, o formulário cai para o
    // WhatsApp e o contacto não se perde.
    reportFile: 'assets/relatorio-performance.pdf'
  };

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ══════════════════════ 1. Links de contacto ══════════════════════ */
  function wireLinks() {
    $$('[data-wa]').forEach(function (el) {
      var msg = el.getAttribute('data-wa-msg') || CONFIG.waMessage;
      el.href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg);
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    });

    // O bloco da comunidade só faz sentido com um link de Telegram a sério
    $$('[data-tg-block]').forEach(function (el) { el.hidden = !CONFIG.telegram; });
    $$('[data-ig-block]').forEach(function (el) { el.hidden = !CONFIG.instagram; });

    [['[data-tg]', CONFIG.telegram], ['[data-ig]', CONFIG.instagram]].forEach(function (pair) {
      $$(pair[0]).forEach(function (el) {
        if (pair[1]) {
          el.href = pair[1];
          el.target = '_blank';
          el.rel = 'noopener noreferrer';
          el.hidden = false;
        } else {
          el.hidden = true;
        }
      });
    });

    var yr = $('#yr');
    if (yr) yr.textContent = new Date().getFullYear();
  }

  /* ══════════════════════ 2. Navegação ══════════════════════ */
  function nav() {
    var bar = $('#nav');
    var burger = $('#burger');
    var panel = $('#mnav');
    var mcta = $('#mcta');
    var links = $$('#navlinks a');
    var progress = $('#progress');

    function close() {
      if (!panel) return;
      panel.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Abrir menu');
      document.body.style.overflow = '';
    }

    if (burger && panel) {
      burger.addEventListener('click', function () {
        var open = panel.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
        document.body.style.overflow = open ? 'hidden' : '';
      });
      $$('a', panel).forEach(function (a) { a.addEventListener('click', close); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }

    // Secções observadas para marcar o link activo
    var sections = links.map(function (a) {
      return document.getElementById(a.getAttribute('href').slice(1));
    }).filter(Boolean);

    /* As posições são medidas UMA vez e guardadas em cache.
       Ler offsetTop/scrollHeight a cada frame força o browser a recalcular
       o layout no meio das escritas de transform — com scroll suave isso
       degrada tudo até a página deixar de responder. Medir só no resize
       (e depois de tudo carregar) resolve. */
    var offsets = [];
    var maxScroll = 0;
    var vh = window.innerHeight;

    function measure() {
      vh = window.innerHeight;
      maxScroll = document.documentElement.scrollHeight - vh;
      offsets = sections.map(function (s) {
        return s.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
      });
    }

    var lastActive = null;
    var lastStuck = null;
    var lastMcta = null;
    var ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || window.pageYOffset;

        // classList.toggle só quando o estado muda de facto
        var stuck = y > 24;
        if (stuck !== lastStuck) { if (bar) bar.classList.toggle('is-stuck', stuck); lastStuck = stuck; }

        var showCta = y > 620;
        if (showCta !== lastMcta) { if (mcta) mcta.classList.toggle('is-on', showCta); lastMcta = showCta; }

        if (progress) {
          progress.style.transform = 'scaleX(' + (maxScroll > 0 ? Math.min(y / maxScroll, 1) : 0) + ')';
        }

        var mid = y + vh * 0.34;
        var active = null;
        for (var i = 0; i < offsets.length; i++) {
          if (offsets[i] <= mid) active = sections[i].id;
        }
        if (active !== lastActive) {
          links.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + active);
          });
          lastActive = active;
        }

        ticking = false;
      });
    }

    var mt;
    window.addEventListener('resize', function () {
      clearTimeout(mt);
      mt = setTimeout(function () { measure(); onScroll(); }, 180);
    }, { passive: true });

    window.addEventListener('scroll', onScroll, { passive: true });

    measure();
    onScroll();
    // Fontes e imagens mudam a altura da página: volta a medir quando assentar
    window.addEventListener('load', function () { setTimeout(measure, 220); }, { once: true });
    document.addEventListener('cortex:remount', measure);
  }

  /* ══════════════════════ 3. Revelações ao scroll ══════════════════════ */
  function reveals() {
    var items = $$('.reveal, .reveal-l, .bars, .dd, .algo__viz');
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.12 });

    items.forEach(function (el, i) {
      // Escalona automaticamente irmãos que não tenham delay explícito
      if (!el.style.getPropertyValue('--rd')) {
        var prev = el.previousElementSibling;
        if (prev && prev.className === el.className) {
          el.style.setProperty('--rd', Math.min(i % 4, 3) * 0.08 + 's');
        }
      }
      io.observe(el);
    });
  }

  /* ══════════════════════ 4. Contadores ══════════════════════ */
  function counters() {
    var els = $$('[data-count]');
    if (!els.length) return;
    if (reduced || !('IntersectionObserver' in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target;
        var to = parseFloat(el.getAttribute('data-count'));
        var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
        var pre = el.getAttribute('data-prefix') || '';
        var suf = el.getAttribute('data-suffix') || '';
        var t0 = null;
        var dur = 1500;

        function tick(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = pre + (to * eased).toFixed(dec).replace('.', ',') + suf;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ══════════════════════ 5. Canvas do hero ══════════════════════ */
  function heroCanvas() {
    var cv = $('#heroCanvas');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, pts = [];

    // Gerador determinístico — o mesmo desenho em todas as visitas
    function rnd(seed) {
      var s = seed;
      return function () {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
    }

    function build() {
      var r = rnd(20260824);
      var n = 190;
      pts = [];
      var v = 0.16;
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        var trend = Math.pow(t, 1.12) * 0.62;               // subida composta
        var wave = Math.sin(t * 8.2) * 0.035 + Math.sin(t * 21) * 0.014;
        var dd = t > 0.42 && t < 0.55 ? -0.075 * Math.sin((t - 0.42) / 0.13 * Math.PI) : 0;
        var dd2 = t > 0.72 && t < 0.82 ? -0.055 * Math.sin((t - 0.72) / 0.10 * Math.PI) : 0;
        v = 0.16 + trend + wave + dd + dd2 + (r() - 0.5) * 0.012;
        pts.push({ x: t, y: Math.max(0.05, Math.min(0.95, v)) });
      }
    }

    function resize() {
      var rect = cv.getBoundingClientRect();
      W = Math.max(rect.width, 1);
      H = Math.max(rect.height, 1);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var progress = 0;
    var raf = null;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Grelha
      ctx.strokeStyle = 'rgba(237,234,227,.045)';
      ctx.lineWidth = 1;
      for (var g = 1; g < 6; g++) {
        var gy = Math.round((H / 6) * g) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
      for (var c = 1; c < 9; c++) {
        var gx = Math.round((W / 9) * c) + 0.5;
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }

      var last = Math.floor(pts.length * progress);
      if (last < 2) return;

      function px(p) { return p.x * W; }
      function py(p) { return H - p.y * H * 0.86 - H * 0.07; }

      // Área
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(224,166,74,.20)');
      grad.addColorStop(1, 'rgba(224,166,74,0)');
      ctx.beginPath();
      ctx.moveTo(px(pts[0]), H);
      for (var i = 0; i < last; i++) ctx.lineTo(px(pts[i]), py(pts[i]));
      ctx.lineTo(px(pts[last - 1]), H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Linha
      ctx.beginPath();
      ctx.moveTo(px(pts[0]), py(pts[0]));
      for (var j = 1; j < last; j++) ctx.lineTo(px(pts[j]), py(pts[j]));
      ctx.strokeStyle = 'rgba(224,166,74,.85)';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(224,166,74,.55)';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Cabeça
      var head = pts[last - 1];
      ctx.beginPath();
      ctx.arc(px(head), py(head), 3.4, 0, Math.PI * 2);
      ctx.fillStyle = '#F2C179';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px(head), py(head), 9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(242,193,121,.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function animate() {
      progress = Math.min(progress + 0.006, 1);
      draw();
      if (progress < 1) raf = requestAnimationFrame(animate);
    }

    build();
    resize();

    if (reduced) {
      progress = 1;
      draw();
    } else {
      animate();
    }

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        resize();
        draw();
      }, 160);
    }, { passive: true });

    // Poupa bateria quando o hero sai do ecrã
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        if (!e[0].isIntersecting && raf) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      }, { threshold: 0 }).observe(cv);
    }
  }

  /* ══════════════════════ 6. Faixa de confiança ══════════════════════ */
  function trustLoop() {
    var track = $('#trustTrack');
    if (!track || track.dataset.cloned) return;
    track.innerHTML += track.innerHTML;   // duplica para o loop ser contínuo
    track.dataset.cloned = '1';
  }

  /* ══════════════════════ 7. Simulador de juro composto ══════════════════════ */
  function calculator() {
    var cap = $('#cCap'), mon = $('#cMon');
    if (!cap || !mon) return;

    /* A taxa é fixa: é a média mensal COMPOSTA dos 32 meses fechados
       entre Janeiro de 2024 e Agosto de 2026, à escala de 1% de risco
       por operação (+285,13% no total).
         (1 + 2,8513) ^ (1/32) − 1 = 0,04297…
       Até Janeiro de 2026 são resultados de teste sobre dados históricos;
       a partir de Fevereiro de 2026, conta real.
       Não é um campo à escolha do visitante — se fosse, o simulador
       deixava de dizer alguma coisa sobre o sistema. */
    var TAXA = 0.0438;

    var oCap = $('#oCap'), oMon = $('#oMon');
    var oFinal = $('#oFinal'), oGain = $('#oGain');
    var oAxisMid = $('#oAxisMid'), oAxisEnd = $('#oAxisEnd');
    var line = $('#calcLine'), area = $('#calcArea'), dot = $('#calcDot'), grid = $('#calcGrid');

    var eur0 = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    var pct = function (v) { return v.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; };

    function fill(el) {
      var p = (el.value - el.min) / (el.max - el.min) * 100;
      el.style.setProperty('--fill', p + '%');
    }

    if (grid && !grid.childNodes.length) {
      for (var g = 1; g < 4; g++) {
        var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        var y = (200 / 4) * g;
        l.setAttribute('x1', 0); l.setAttribute('x2', 600);
        l.setAttribute('y1', y); l.setAttribute('y2', y);
        grid.appendChild(l);
      }
    }

    /* Ruído determinístico: a mesma curva em todas as visitas.
       Sem isto a linha era um arco perfeito — e mercado nenhum sobe assim. */
    function ruido(i) {
      var s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return (s - Math.floor(s)) * 2 - 1;   // -1 a 1
    }

    function render() {
      var c0 = +cap.value;
      var n = +mon.value;

      /* Duas séries: a linha lisa da composição pura (referência) e a
         linha oscilada, que reparte o mesmo retorno de forma irregular —
         meses fortes, meses fracos e recuos — para representar o caminho
         real. Ambas terminam exactamente no mesmo valor. */
      var liso = [c0];
      var v = c0;
      for (var i = 1; i <= n; i++) { v = v * (1 + TAXA); liso.push(v); }

      var osc = [c0];
      var acc = c0;
      for (var k = 1; k <= n; k++) {
        var desvio = ruido(k) * 0.085 + Math.sin(k * 0.9) * 0.03;   // ±11% em torno da média
        acc = acc * (1 + TAXA + desvio);
        osc.push(acc);
      }
      // Reancorar a série oscilada para fechar no mesmo total do juro composto
      var escala = liso[n] / osc[n];
      for (var m = 1; m <= n; m++) {
        var peso = m / n;
        osc[m] = osc[m] * (1 + (escala - 1) * peso);
      }

      var fin = liso[n];
      var ganho = fin - c0;
      var ganhoPct = c0 > 0 ? (ganho / c0) * 100 : 0;

      oCap.textContent = eur0.format(c0);
      oMon.textContent = n + (n === 1 ? ' mês' : ' meses');
      oFinal.textContent = eur0.format(fin);
      oGain.textContent = '+' + eur0.format(ganho) + ' · +' + pct(ganhoPct);
      oAxisMid.textContent = 'Mês ' + Math.round(n / 2);
      oAxisEnd.textContent = 'Mês ' + n;

      var W = 600, H = 200, pad = 8;
      var min = Math.min.apply(null, osc.concat([c0]));
      var max = Math.max.apply(null, osc.concat([liso[n]]));
      var span = Math.max(max - min, 1);

      var d = '', lastX = 0, lastY = 0;
      for (var q = 0; q <= n; q++) {
        var x = (q / n) * W;
        var y = H - pad - ((osc[q] - min) / span) * (H - pad * 2);
        d += (q === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
        lastX = x; lastY = y;
      }

      line.setAttribute('d', d.trim());
      area.setAttribute('d', (d + 'L' + W + ' ' + H + ' L0 ' + H + ' Z').trim());
      dot.setAttribute('cx', lastX.toFixed(1));
      dot.setAttribute('cy', lastY.toFixed(1));

      [cap, mon].forEach(fill);
    }

    [cap, mon].forEach(function (el) { el.addEventListener('input', render); });
    render();

    /* Só se regista quando a pessoa larga o cursor, e não a cada pixel
       que arrasta: o que interessa é o valor em que parou. */
    [cap, mon].forEach(function (el) {
      el.addEventListener('change', function () {
        marcar('simulador', cap.value + '€ · ' + mon.value + ' meses');
      });
    });
  }

  /* ══════════════════════ 8. FAQ ══════════════════════ */
  function faq() {
    $$('.faq__q').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        // Acordeão: fecha os restantes
        $$('.faq__q').forEach(function (b) {
          if (b !== btn) b.setAttribute('aria-expanded', 'false');
        });
        btn.setAttribute('aria-expanded', String(!open));
      });
    });
  }

  /* ══════════════════════ 9. Cookies ══════════════════════ */
  var KEY = 'cortex.cookies.v1';

  function loadAnalytics() {
    if (!CONFIG.analytics) return;
    if (document.getElementById('ga-src')) return;
    var s = document.createElement('script');
    s.id = 'ga-src';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CONFIG.analytics;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CONFIG.analytics, { anonymize_ip: true });
  }

  function cookies() {
    var box = $('#cookies');
    if (!box) return;
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* modo privado */ }

    if (saved === 'all') { loadAnalytics(); return; }
    if (saved === 'essential') return;

    setTimeout(function () { box.classList.add('is-on'); }, 1400);

    function decide(val) {
      try { localStorage.setItem(KEY, val); } catch (e) { /* ignora */ }
      box.classList.remove('is-on');
      if (val !== 'all') return;
      loadAnalytics();
      /* Quem aceita a meio da visita passa a contar a partir daqui: o
         identificador é criado agora e vale já para esta visita. */
      var novo = visitante();
      visita.vid = novo.id;
      visita.visitas = novo.visitas;
      visita.novo = novo.novo;
    }
    $('#ckYes').addEventListener('click', function () { decide('all'); });
    $('#ckNo').addEventListener('click', function () { decide('essential'); });
  }


  /* ══════════════════════ 9b. Modal do relatório ══════════════════════
     Os números estão todos na página, à vista e sem formulário — prova
     atrás de formulário lê-se como prova escondida. O que se pede em
     troca do contacto é o relatório em PDF, que é documento nosso.     */
  var LEAD = 'cortex.lead.v1';

  function reportModal() {
    var box = $('#reportModal');
    if (!box) return;

    var form = $('#rmFormEl');
    var stForm = $('#rmForm');
    var stDone = $('#rmDone');
    var submit = $('#rmSubmit');
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Quem já pediu não volta a preencher: vai direito ao resultado
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(LEAD) || 'null'); } catch (e) { saved = null; }
      if (saved && saved.nome) {
        marcar('form', 'já tinha pedido');
        showDone(saved.nome, true);
      } else {
        marcar('form', 'aberto');
        setTimeout(function () { var n = $('#rmName'); if (n) n.focus(); }, 340);
      }
    }

    function close() {
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    }

    function showDone(nome, again) {
      stForm.classList.remove('is-on');
      stDone.classList.add('is-on');
      var who = $('#rmWho');
      if (who) who.textContent = nome ? nome.split(' ')[0] : 'obrigado';
      if (again) {
        var msg = $('#rmMsg');
        if (msg) msg.textContent = 'Já nos tinha deixado o contacto. O relatório está aqui sempre que precisar.';
      }
    }

    $$('[data-open-report]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
    $$('[data-close-report]').forEach(function (b) {
      b.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('is-open')) close();
    });

    // Mantém o foco dentro do modal enquanto estiver aberto
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])', box)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    function bad(id, is) {
      var f = $(id);
      if (f) f.classList.toggle('is-bad', is);
      var input = $('input', f);
      if (input) input.setAttribute('aria-invalid', String(is));
      return !is;
    }

    if (!form) return;

    /* Abrir o formulário e começar a escrevê-lo são coisas diferentes.
       Quem abre e não escreve nada estava só curioso; quem escreve o
       nome e desiste a meio encontrou algum obstáculo — e é essa
       distinção que diz se o problema é de interesse ou de desenho. */
    var comecou = false;
    form.addEventListener('input', function () {
      if (comecou) return;
      comecou = true;
      marcar('form', 'começou a preencher');
    }, { once: false });

    var estado = $('#rmEstado');

    function dizer(texto, tipo) {
      if (!estado) return;
      estado.hidden = !texto;
      estado.textContent = texto || '';
      estado.className = 'f-estado' + (texto ? ' f-estado--' + tipo : '');
    }

    /* Deixar usar outro contacto: sem isto, quem já pediu uma vez fica
       preso ao ecrã de sucesso e não consegue voltar ao formulário. */
    var outro = $('#rmOutro');
    if (outro) {
      outro.addEventListener('click', function () {
        try { localStorage.removeItem(LEAD); } catch (err) { /* nada */ }
        stDone.classList.remove('is-on');
        stForm.classList.add('is-on');
        dizer('', '');
        form.reset();
        setTimeout(function () { var n = $('#rmName'); if (n) n.focus(); }, 120);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nome = $('#rmName').value.trim();
      var tel = $('#rmTel').value.trim();
      var email = $('#rmEmail').value.trim();
      var consent = $('#rmConsent').checked;
      var hp = ($('#rmWebsite') || {}).value || '';

      var soDigitos = tel.replace(/[^\d]/g, '');
      var okNome = bad('#fName', nome.length < 2);
      var okTel = bad('#fTel', soDigitos.length < 9 || soDigitos.length > 15);
      var okMail = bad('#fMail', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));

      if (!okNome || !okTel || !okMail) {
        marcar('form', 'erro de validação');
        dizer('Falta preencher alguma coisa. Veja os campos assinalados.', 'erro');
        $(!okNome ? '#rmName' : !okTel ? '#rmTel' : '#rmEmail').focus();
        return;
      }

      /* De onde veio a visita, para sabermos o que está a dar resultado. */
      var origem = location.href;
      try {
        var utm = new URLSearchParams(location.search);
        var campanha = utm.get('utm_source') || utm.get('utm_campaign');
        if (campanha) origem = campanha + ' · ' + origem;
        else if (document.referrer) origem = document.referrer + ' → ' + origem;
      } catch (err) { /* nada */ }

      marcar('form', 'enviado');
      dizer('A enviar…', 'ok');
      submit.setAttribute('aria-busy', 'true');
      submit.disabled = true;

      /* Um limite de tempo próprio: sem isto, se o servidor ficar calado,
         a roda gira para sempre e a pessoa não sabe o que fazer. */
      var abortou = false;
      var relogio = setTimeout(function () { abortou = true; }, 15000);

      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome, telefone: tel, email: email,
          consentimento: consent, origem: origem, website: hp
        })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          return { http: r.status, dados: j };
        });
      }).then(function (r) {
        if (abortou) return;
        clearTimeout(relogio);

        if (r.http === 200 && r.dados.ok) {
          try {
            localStorage.setItem(LEAD, JSON.stringify({
              nome: nome, tel: tel, email: email, consent: consent, ts: Date.now()
            }));
          } catch (err) { /* modo privado — segue na mesma */ }
          marcar('lead', 'relatórios pedidos');
          dizer('', '');
          showDone(nome);
          return;
        }

        /* Validação recusada pelo servidor: dizemos qual campo, em vez
           de mandar a pessoa para o WhatsApp sem perceber porquê. */
        if (r.http === 400 && r.dados.campos) {
          var nomes = { nome: 'o nome', telefone: 'o telemóvel', email: 'o email' };
          var quais = r.dados.campos.map(function (c) { return nomes[c] || c; }).join(' e ');
          r.dados.campos.forEach(function (c) {
            bad(c === 'nome' ? '#fName' : c === 'telefone' ? '#fTel' : '#fMail', true);
          });
          marcar('form', 'recusado pelo servidor');
          dizer('Verifique ' + quais + '.', 'erro');
          submit.removeAttribute('aria-busy');
          submit.disabled = false;
          return;
        }

        throw new Error('HTTP ' + r.http);
      }).catch(function () {
        clearTimeout(relogio);
        /* Última linha de defesa: o contacto não se perde, vai para o
           WhatsApp já escrito. Mas dizemos à pessoa o que aconteceu. */
        marcar('form', 'falhou o envio');
        dizer('Não consegui enviar daqui. Abri o WhatsApp com a mensagem escrita — é só carregar em enviar.', 'erro');
        var t = 'Olá! Chamo-me ' + nome + ' (' + tel + ', ' + email + ') e queria receber os relatórios da Cortex Automation.';
        window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
        submit.removeAttribute('aria-busy');
        submit.disabled = false;
      });
    });
  }
  /* ══════════════════════ 10. Arranque ══════════════════════ */
  /* ─────────────────────────────────────────────────────────────
     VÍDEO DE APRESENTAÇÃO (VSL)

     O vídeo é entregue pela CDN da Cloudinary, com q_auto e f_auto.
     Fica em preload="metadata": ao abrir a página o browser lê só o
     cabeçalho do ficheiro, não os 4,3 MB — vê-se o poster, com uma
     camada por cima a fazer de botão. Quando o vídeo arranca, a
     camada desaparece e os controlos nativos ficam a comandar.
     ───────────────────────────────────────────────────────────── */
  function vsl() {
    var v = $('#vslVideo'), btn = $('#vslPlay'), box = $('#vslBox');
    if (!v || !btn || !box) return;

    var fb = $('#vslFallback'), cap = $('.vsl__cap i', box);
    var stall = null, started = false, desistiu = false;

    /* Sem JavaScript os controlos nativos ficam visíveis — é a única forma
       de dar play. Com JavaScript, escondemo-los até o vídeo arrancar,
       para o poster ficar limpo por baixo do botão. */
    v.removeAttribute('controls');

    /* A duração escrita à mão só é substituída quando o ficheiro está
       mesmo lido de ponta a ponta. Um ficheiro ainda a ser gerado na
       CDN reporta durações absurdas que vão crescendo — e não queremos
       isso a piscar no ecrã. */
    v.addEventListener('durationchange', function () {
      if (!cap || !isFinite(v.duration) || v.duration < 5) return;
      if (v.readyState < 1) return;
      var t = Math.round(v.duration);
      cap.textContent = Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
    });

    function limparEspera() {
      clearTimeout(stall);
      box.classList.remove('is-loading');
    }

    function desistir() {
      if (desistiu) return;
      desistiu = true;
      if (fb) fb.hidden = false;
      v.setAttribute('controls', '');
      box.classList.remove('is-loading');
      box.classList.remove('is-playing');
      started = false;
    }

    /* Só desistimos se nada estiver a acontecer. Enquanto chegarem bytes
       ou o tempo avançar, o relógio é reposto: um ficheiro grande numa
       ligação lenta não é um erro, é só lento. */
    function armarRelogio() {
      clearTimeout(stall);
      stall = setTimeout(function () {
        if (v.readyState === 0 && !v.currentTime) desistir();
      }, 25000);
    }

    function houveProgresso() {
      if (desistiu) return;
      armarRelogio();
      if (v.readyState >= 3 || v.currentTime > 0) limparEspera();
    }

    function start() {
      if (started && !v.paused) return;
      if (!started) marcar('video', 'inicio');
      started = true;
      desistiu = false;
      if (fb) fb.hidden = true;
      box.classList.add('is-playing');
      if (v.readyState < 3) box.classList.add('is-loading');
      v.setAttribute('controls', '');
      v.setAttribute('preload', 'auto');
      armarRelogio();

      var p = v.play();
      if (p && p.catch) {
        p.catch(function () {
          /* Reprodução recusada (sem gesto válido, poupança de energia…).
             Devolvemos o poster e o botão, com os controlos nativos à vista
             para a pessoa poder carregar em play ela própria. */
          clearTimeout(stall);
          box.classList.remove('is-loading');
          box.classList.remove('is-playing');
          started = false;
        });
      }
    }

    ['progress', 'loadeddata', 'canplay', 'playing', 'timeupdate'].forEach(function (ev) {
      v.addEventListener(ev, houveProgresso);
    });
    v.addEventListener('waiting', function () {
      if (!v.paused && !desistiu) { box.classList.add('is-loading'); armarRelogio(); }
    });

    /* O browser só dispara 'error' no <video> depois de esgotar TODAS as
       <source>. Se chegámos aqui, nem a local nem a da CDN serviram. */
    v.addEventListener('error', desistir);

    btn.addEventListener('click', start);
    v.addEventListener('play', function () { box.classList.add('is-playing'); });

    /* Quanto do vídeo chegou a ser visto. Quem desiste aos vinte
       segundos e quem vê até ao fim são duas pessoas diferentes, e o
       painel não tem outra maneira de as distinguir. */
    var marcos = [25, 50, 75, 100], vistos = {};
    v.addEventListener('timeupdate', function () {
      if (!v.duration) return;
      var pct = Math.round(v.currentTime / v.duration * 100);
      for (var i = 0; i < marcos.length; i++) {
        if (pct >= marcos[i] && !vistos[marcos[i]]) {
          vistos[marcos[i]] = true;
          marcar('video', marcos[i] + '%');
        }
      }
    });

    v.addEventListener('pause', function () {
      /* Só voltamos ao poster se o vídeo estiver mesmo no início —
         uma pausa a meio deve continuar a mostrar o fotograma. */
      if (v.currentTime === 0) { box.classList.remove('is-playing'); started = false; }
    });
    v.addEventListener('ended', function () {
      v.currentTime = 0;
      v.removeAttribute('controls');
      limparEspera();
      box.classList.remove('is-playing');
      started = false;
    });
  }

  /* ─────────────────────────────────────────────────────────────
     NEWSLETTER
     Vai para o mesmo /api/lead dos relatórios. É a mesma coisa —
     um contacto que autorizou ser contactado — e assim aparece na
     mesma lista, sem duas tabelas para manter sincronizadas.
     ───────────────────────────────────────────────────────────── */
  function newsletter() {
    var form = $('#newsForm');
    if (!form) return;
    var btn = $('#nsBtn'), ok = $('#nsOk'), nota = $('#nsNota');

    function marcar(sel, mau) {
      var el = $(sel);
      if (el) el.classList.toggle('is-bad', mau);
      return !mau;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nome = $('#nsNome').value.trim();
      var tel = $('#nsTel').value.trim();
      var mail = $('#nsMail').value.trim();
      var digitos = tel.replace(/[^\d]/g, '');

      var okN = marcar('#nsName', nome.length < 2);
      var okT = marcar('#nsTelF', digitos.length < 9 || digitos.length > 15);
      var okM = marcar('#nsMailF', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail));
      if (!okN) { $('#nsNome').focus(); return; }
      if (!okT) { $('#nsTel').focus(); return; }
      if (!okM) { $('#nsMail').focus(); return; }

      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');

      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome, telefone: tel, email: mail,
          consentimento: true,
          origem: 'newsletter · ' + (visita.origem || 'directa'),
          website: ($('#nsWeb') || {}).value || ''
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        form.querySelectorAll('.f-field, #nsBtn').forEach(function (el) { el.hidden = true; });
        if (nota) nota.hidden = true;
        ok.hidden = false;
        ok.className = 'news__ok';
        ok.textContent = 'Pronto, ' + nome.split(/\s+/)[0] + '. Está na lista.';
        marcar('lead', 'newsletter');
      }).catch(function () {
        /* Dizer o que aconteceu, em vez de abrir o WhatsApp sem explicação
           e deixar a pessoa sem saber se ficou ou não inscrita. */
        if (ok) {
          ok.hidden = false;
          ok.className = 'news__ok news__ok--erro';
          ok.textContent = 'Não consegui inscrever daqui. Abri o WhatsApp com a mensagem escrita — é só carregar em enviar.';
        }
        var t = 'Olá! Chamo-me ' + nome + ' e queria subscrever a newsletter da Cortex Automation.';
        window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
      }).then(function () {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────
     RASTREIO DE VISITA

     Mede o que interessa para perceber o que funciona: de onde veio,
     quanto tempo ficou, até onde desceu, em que secção estava quando
     saiu, por onde passou e que botões carregou.

     Não usa cookies nem guarda identificadores. Não há forma de ligar
     duas visitas à mesma pessoa, nem esta visita a outro site. O
     resumo só é enviado quando a pessoa sai — um pedido por visita.
     ───────────────────────────────────────────────────────────── */
  /* ─────────────────────────────────────────────────────────────
     O QUE SE REGISTA DE CADA VISITA

     Duas perguntas, e só duas: de onde veio esta pessoa, e onde é que
     a perdemos. Tudo o que está aqui serve uma delas.

     O identificador é um número ao acaso guardado no browser dela.
     Serve para distinguir sete visitas de sete pessoas de sete visitas
     da mesma pessoa — que é uma diferença que muda tudo na leitura dos
     números. Não diz quem é, não atravessa para outros sites e não se
     cruza com o email de ninguém: é um número e mais nada.
     ───────────────────────────────────────────────────────────── */
  var VID = 'cortex.vid.v1';

  /* O consentimento não é pedido para contarmos a visita — é pedido para
     escrevermos no aparelho de quem nos visita. É essa a distinção que a
     lei faz, e é a que respeitamos aqui:

       sem consentimento   o resumo da visita segue na mesma, sem nada
                           gravado no browser. Não se sabe se é a mesma
                           pessoa a voltar, sabe-se tudo o resto.

       com consentimento   guardamos um número ao acaso, que só serve
                           para separar visitas repetidas de pessoas
                           diferentes. Nada mais. */
  function autorizou() {
    try { return localStorage.getItem(KEY) === 'all'; } catch (e) { return false; }
  }

  function visitante() {
    var v = { id: '', visitas: 1, novo: null };
    if (!autorizou()) return v;
    try {
      var g = JSON.parse(localStorage.getItem(VID) || 'null');
      if (g && g.id) {
        v.id = g.id;
        v.visitas = (Number(g.visitas) || 1) + 1;
        v.novo = false;
      } else {
        v.id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
        v.novo = true;
      }
      localStorage.setItem(VID, JSON.stringify({ id: v.id, visitas: v.visitas }));
    } catch (e) {
      /* Modo privado ou armazenamento bloqueado: perde-se a distinção,
         não se perde a visita. */
      v.id = '';
      v.novo = null;
    }
    return v;
  }

  var quem = visitante();

  var visita = {
    inicio: Date.now(),
    origem: '',
    utm: {},
    scroll: 0,
    seccoes: [],
    tempos: {},          /* segundos passados em cada secção */
    cliques: [],
    eventos: [],         /* o percurso, por ordem e com a hora */
    enviado: false,
    vid: quem.id,
    visitas: quem.visitas,
    novo: quem.novo
  };

  /* O registo de um momento do percurso. O tempo é relativo ao início
     da visita: é o que permite reconstruir a sequência depois. */
  function marcar(evento, detalhe) {
    if (visita.eventos.length >= 60) return;
    visita.eventos.push({
      t: Math.round((Date.now() - visita.inicio) / 1000),
      e: String(evento).slice(0, 40),
      d: detalhe == null ? '' : String(detalhe).slice(0, 60)
    });
  }

  function rastrear() {
    /* ── De onde veio ──────────────────────────────────────────────
       As etiquetas de campanha mandam sobre tudo o resto: são as
       únicas que dizem qual anúncio trouxe a pessoa, e não apenas
       qual site. Sem etiquetas, fica o site de origem. Sem nada,
       é tráfego directo. */
    try {
      var q = new URLSearchParams(location.search);
      var campos = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      for (var i = 0; i < campos.length; i++) {
        var v = q.get(campos[i]);
        if (v) visita.utm[campos[i].replace('utm_', '')] = v.slice(0, 60);
      }
      visita.origem = visita.utm.source || q.get('ref') ||
        (document.referrer && document.referrer.indexOf(location.host) === -1
          ? document.referrer.replace(/^https?:\/\//, '').split('/')[0]
          : 'directa');
    } catch (e) { visita.origem = 'directa'; }

    marcar('entrada', visita.origem);

    /* ── Onde está a ler, e durante quanto tempo ───────────────────
       Saber que alguém passou pela secção do risco diz pouco. Saber
       que lá ficou quarenta segundos diz que a leu. */
    var seccoes = $$('section[id]');
    var atual = 'topo';

    /* ── Tempo a sério, não tempo de relógio ──────────────────────

       Media-se o tempo com atenção, não o tempo com o separador aberto.
       A diferença não é académica: bastou uma visita esquecida no fundo
       da página para a newsletter aparecer com 234 segundos de média,
       mais do que a visita inteira, que era de 141. Todo o tempo morto
       caía na última secção vista.

       Conta-se um segundo de cada vez, e só se a página estiver à vista
       e tiver havido sinal de vida há menos de trinta segundos. Quem
       vai fazer café deixa de contar, e volta a contar quando regressa. */
    var PARADO = 30000;
    var ultimoSinal = Date.now();
    var activo = 0;

    ['scroll', 'mousemove', 'keydown', 'touchstart', 'click', 'wheel'].forEach(function (ev) {
      window.addEventListener(ev, function () { ultimoSinal = Date.now(); }, { passive: true });
    });

    setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - ultimoSinal > PARADO) return;
      activo++;
      visita.tempos[atual] = (visita.tempos[atual] || 0) + 1;
    }, 1000);


    function medir() {
      var h = document.documentElement;
      var total = h.scrollHeight - h.clientHeight;
      var pct = total > 0 ? Math.round((h.scrollTop || window.scrollY) / total * 100) : 100;
      if (pct > visita.scroll) visita.scroll = Math.min(pct, 100);

      /* A secção que ocupa o terço superior do ecrã é a que a pessoa
         está a ler. É também a que fica registada como saída. */
      for (var i = 0; i < seccoes.length; i++) {
        var r = seccoes[i].getBoundingClientRect();
        if (r.top <= h.clientHeight * 0.34 && r.bottom > h.clientHeight * 0.34) {
          if (seccoes[i].id !== atual) {
            atual = seccoes[i].id;
            if (visita.seccoes.indexOf(atual) === -1) {
              visita.seccoes.push(atual);
              marcar('seccao', atual);
            }
          }
          break;
        }
      }
    }

    var pendente = false;
    window.addEventListener('scroll', function () {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(function () { medir(); pendente = false; });
    }, { passive: true });
    medir();

    /* ── Que botões carregam ───────────────────────────────────────
       Pelo atributo quando existe, pelo texto quando não existe: assim
       continua a fazer sentido depois de o site mudar de palavras. */
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a, button');
      if (!a) return;

      /* O banner de cookies e o menu não são escolhas sobre o produto.
         Contá-los punha "Aceitar todos" no topo da lista dos botões mais
         carregados, a empurrar para baixo os que interessam. */
      if (a.closest('#cookies, #mnav, #burger, [data-close-report]')) return;

      var etiqueta =
        a.hasAttribute('data-wa') ? 'WhatsApp' :
        a.hasAttribute('data-tg') ? 'Telegram' :
        a.hasAttribute('data-ig') ? 'Instagram' :
        a.hasAttribute('data-open-report') ? 'Pedir relatórios' :
        a.hasAttribute('data-doc') ? 'Descarregar · ' + a.getAttribute('data-doc') :
        a.id === 'vslPlay' ? 'Ver vídeo' :
        /myfxbook/i.test(a.href || '') ? 'MyFxBook' :
        (a.textContent || '').trim().slice(0, 40);
      if (!etiqueta) return;
      if (visita.cliques.length < 30) visita.cliques.push(etiqueta);
      marcar('clique', etiqueta);
    }, true);

    /* ── Fechar as contas e enviar ─────────────────────────────────
       O ecrã é enviado em largura e altura: é o que permite separar
       telemóvel de tablet de computador, e depois comparar a conversão
       de cada um. Não vai nada que identifique o aparelho. */
    function enviar() {
      if (visita.enviado) return;
      visita.enviado = true;
      marcar('saida', atual);

      var corpo = JSON.stringify({
        vid: visita.vid,
        visitas: visita.visitas,
        novo: visita.novo,
        origem: visita.origem,
        utm: visita.utm,
        entrada: location.pathname + location.search,
        duracao: activo,
        scroll: visita.scroll,
        saida: atual,
        seccoes: visita.seccoes,
        tempos: visita.tempos,
        cliques: visita.cliques,
        eventos: visita.eventos,
        ecra: window.innerWidth,
        altura: window.innerHeight,
        lead: visita.eventos.some(function (x) { return x.e === 'lead'; })
      });

      /* sendBeacon sobrevive ao fecho da aba; o fetch é a alternativa
         para os browsers que não o tenham. */
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/track', new Blob([corpo], { type: 'application/json' }));
          return;
        }
      } catch (e) { /* segue para o fetch */ }
      fetch('/api/track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: corpo, keepalive: true
      }).catch(function () {});
    }

    /* visibilitychange é o único evento fiável em telemóvel — o
       beforeunload não dispara quando se muda de aplicação. */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') enviar();
    });
    window.addEventListener('pagehide', enviar);
  }

  function init() {
    wireLinks();
    nav();
    trustLoop();
    reveals();
    counters();
    heroCanvas();
    vsl();
    calculator();
    faq();
    reportModal();
    newsletter();
    rastrear();
    cookies();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
