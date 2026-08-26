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
    telegram:  '',                                   // ex.: 'https://t.me/cortexautomation'
    instagram: '',                                   // ex.: 'https://instagram.com/cortexautomation'
    analytics: '',                                   // ex.: 'G-XXXXXXXXXX' (Google Analytics 4)

    // Para onde vão os pedidos de relatório (nome + email).
    // Deixa vazio e o formulário passa a abrir o WhatsApp com a mensagem
    // já escrita — funciona desde o primeiro dia, sem servidor nenhum.
    // Com um endpoint (Formspree, Netlify Forms, Getform...), o contacto
    // fica gravado e podes fazer follow-up por email.
    formEndpoint: '',                                // ex.: 'https://formspree.io/f/xxxxxxxx'
    reportFile: 'assets/relatorio-performance-btc.pdf'
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

    /* A taxa é fixa: é a média mensal histórica do algoritmo.
       Não é um campo à escolha do visitante — se fosse, o simulador
       deixava de dizer alguma coisa sobre o sistema. */
    var TAXA = 0.0689;

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
      if (val === 'all') loadAnalytics();
    }
    $('#ckYes').addEventListener('click', function () { decide('all'); });
    $('#ckNo').addEventListener('click', function () { decide('essential'); });
  }


  /* ══════════════════════ 9b. Modal do relatório ══════════════════════
     A verificação no Myfxbook NUNCA é bloqueada — é a prova, e prova
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
        showDone(saved.nome, true);
      } else {
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
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nome = $('#rmName').value.trim();
      var email = $('#rmEmail').value.trim();
      var consent = $('#rmConsent').checked;

      var okNome = bad('#fName', nome.length < 2);
      var okMail = bad('#fMail', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));
      if (!okNome || !okMail) {
        $(okNome ? '#rmEmail' : '#rmName').focus();
        return;
      }

      try {
        localStorage.setItem(LEAD, JSON.stringify({ nome: nome, email: email, consent: consent, ts: Date.now() }));
      } catch (err) { /* modo privado — segue na mesma */ }

      // Sem endpoint configurado: abre o WhatsApp com tudo escrito.
      // É a solução honesta para um site estático — nada se perde.
      if (!CONFIG.formEndpoint) {
        var texto = 'Olá! Chamo-me ' + nome + ' (' + email + ') e queria receber o relatório de performance da Cortex Automation.';
        window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
        showDone(nome);
        return;
      }

      submit.setAttribute('aria-busy', 'true');
      fetch(CONFIG.formEndpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome,
          email: email,
          consentimento_followup: consent ? 'sim' : 'nao',
          origem: location.href,
          pedido: 'Relatório de performance'
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        showDone(nome);
      }).catch(function () {
        // Se o envio falhar, não se perde o contacto: passa para o WhatsApp
        var t2 = 'Olá! Chamo-me ' + nome + ' (' + email + ') e queria receber o relatório de performance da Cortex Automation.';
        window.open('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(t2), '_blank', 'noopener');
        showDone(nome);
      }).then(function () {
        submit.removeAttribute('aria-busy');
      });
    });
  }

  /* ══════════════════════ 10. Arranque ══════════════════════ */
  function init() {
    wireLinks();
    nav();
    trustLoop();
    reveals();
    counters();
    heroCanvas();
    calculator();
    faq();
    reportModal();
    cookies();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
