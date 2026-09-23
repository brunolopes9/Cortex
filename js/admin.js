/* ==========================================================================
   Painel reservado — Cortex Automation
   Não guarda nada no browser. Tudo vem de /api/admin, que só responde
   com o cookie de sessão assinado.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var estado = { leads: [], resumo: null };

  function api(corpo) {
    return fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (r) {
      return r.json().then(function (j) { return { http: r.status, dados: j }; });
    });
  }

  function mostrarErro(el, texto) {
    if (!el) return;
    el.textContent = texto || '';
    el.hidden = !texto;
  }

  /* ── Entrada ───────────────────────────────────────────────────── */
  $('#gateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#gateBtn');
    btn.disabled = true;
    mostrarErro($('#gateErro'), '');
    api({ accao: 'entrar', password: $('#pw').value }).then(function (r) {
      btn.disabled = false;
      if (r.dados && r.dados.ok) { abrirPainel(); return; }
      mostrarErro($('#gateErro'), (r.dados && r.dados.erro) || 'Não consegui entrar.');
      $('#pw').select();
    }).catch(function () {
      btn.disabled = false;
      mostrarErro($('#gateErro'), 'Sem ligação ao servidor.');
    });
  });

  function abrirPainel() {
    $('#gate').hidden = true;
    $('#app').hidden = false;
    carregar();
  }

  $('#sair').addEventListener('click', function () {
    api({ accao: 'sair' }).then(function () { location.reload(); });
  });
  $('#recarregar').addEventListener('click', carregar);

  /* ── Separadores ───────────────────────────────────────────────── */
  $$('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#tabs button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      $$('.adm-aba').forEach(function (s) {
        s.classList.toggle('is-on', s.getAttribute('data-painel') === b.getAttribute('data-aba'));
      });
    });
  });

  /* ── Dados ─────────────────────────────────────────────────────── */
  function carregar() {
    api({ accao: 'dados' }).then(function (r) {
      if (r.http === 401) { location.reload(); return; }
      if (!r.dados || !r.dados.ok) return;
      estado.leads = r.dados.leads || [];
      estado.resumo = r.dados.resumo || null;
      mostrarErro($('#aviso'), r.dados.aviso || '');
      pintarLeads();
      pintarVisitas();
    });
  }

  function dataHora(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('pt-PT') + ' · ' +
      d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  function cartao(valor, rotulo) {
    return '<div class="adm-card"><b>' + valor + '</b><span>' + rotulo + '</span></div>';
  }

  function seguro(v) {
    var d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  }

  /* ── Contactos ─────────────────────────────────────────────────── */
  function pintarLeads() {
    var l = estado.leads;
    var comEmail = l.filter(function (x) { return x.email; }).length;
    var autorizados = l.filter(function (x) { return x.email && x.consentimento; }).length;
    var hoje = new Date().toDateString();
    var deHoje = l.filter(function (x) { return new Date(x.ts).toDateString() === hoje; }).length;

    $('#cardsLeads').innerHTML =
      cartao(l.length, 'Contactos') +
      cartao(deHoje, 'Hoje') +
      cartao(comEmail, 'Com email') +
      cartao(autorizados, 'Autorizaram campanhas');

    $('#campAlvo').textContent = autorizados + (autorizados === 1 ? ' pessoa vai receber' : ' pessoas vão receber');
    filtrar();
  }

  function filtrar() {
    var q = ($('#procurar').value || '').toLowerCase().trim();
    var linhas = estado.leads.filter(function (x) {
      if (!q) return true;
      return [x.nome, x.telefone, x.email, x.origem].join(' ').toLowerCase().indexOf(q) !== -1;
    });

    $('#vazioLeads').hidden = linhas.length > 0;
    $('#tabelaLeads').hidden = linhas.length === 0;

    $('#tabelaLeads tbody').innerHTML = linhas.map(function (x) {
      var tel = String(x.telefone || '').replace(/[^\d]/g, '');
      return '<tr>' +
        '<td class="adm-mono">' + dataHora(x.ts) + '</td>' +
        '<td><b>' + seguro(x.nome) + '</b></td>' +
        '<td><a href="https://wa.me/' + seguro(tel) + '" target="_blank" rel="noopener">' + seguro(x.telefone) + '</a></td>' +
        '<td>' + (x.email ? '<a href="mailto:' + seguro(x.email) + '">' + seguro(x.email) + '</a>' : '<i>—</i>') + '</td>' +
        '<td>' + (x.consentimento ? '<span class="adm-sim">sim</span>' : '<span class="adm-nao">não</span>') + '</td>' +
        '<td class="adm-origem">' + seguro(x.origem || 'directa') + '</td>' +
        '</tr>';
    }).join('');
  }
  $('#procurar').addEventListener('input', filtrar);

  /* ── CSV ───────────────────────────────────────────────────────── */
  $('#csv').addEventListener('click', function () {
    var cab = ['Data', 'Nome', 'Telemovel', 'Email', 'Campanhas', 'Origem', 'Pais'];
    var celula = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var linhas = estado.leads.map(function (x) {
      return [dataHora(x.ts), x.nome, x.telefone, x.email, x.consentimento ? 'sim' : 'nao', x.origem, x.pais]
        .map(celula).join(',');
    });
    /* BOM à frente para o Excel abrir os acentos como deve ser */
    var blob = new Blob(['﻿' + cab.map(celula).join(',') + '\n' + linhas.join('\n')],
      { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'contactos-cortex-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  /* ── Visitas ───────────────────────────────────────────────────── */
  function lista(el, pares, sufixo) {
    var max = pares.reduce(function (m, p) { return Math.max(m, p[1]); }, 0) || 1;
    el.innerHTML = pares.length ? pares.map(function (p) {
      return '<li><span class="adm-lbl">' + seguro(p[0]) + '</span>' +
        '<span class="adm-bar"><i style="width:' + Math.round(p[1] / max * 100) + '%"></i></span>' +
        '<b>' + p[1] + (sufixo || '') + '</b></li>';
    }).join('') : '<li class="adm-vaziol">Sem dados ainda.</li>';
  }

  function pintarVisitas() {
    var r = estado.resumo;
    if (!r) return;
    var m = Math.floor(r.tempoMedio / 60), s = r.tempoMedio % 60;

    $('#cardsVisitas').innerHTML =
      cartao(r.visitas, 'Visitas') +
      cartao((m ? m + 'm ' : '') + s + 's', 'Tempo médio') +
      cartao(r.scrollMedio + '%', 'Scroll médio') +
      cartao(r.telemovelPct + '%', 'Em telemóvel');

    lista($('#origens'), r.origens);
    lista($('#saidas'), r.saidas);
    lista($('#seccoes'), r.seccoes);
    lista($('#cliques'), r.cliques);

    var max = r.dias.reduce(function (m2, d) { return Math.max(m2, d[1]); }, 0) || 1;
    $('#dias').innerHTML = r.dias.length ? r.dias.map(function (d) {
      return '<div class="adm-dia" title="' + d[0] + ': ' + d[1] + '">' +
        '<i style="height:' + Math.max(4, Math.round(d[1] / max * 100)) + '%"></i>' +
        '<span>' + d[0].slice(8) + '</span></div>';
    }).join('') : '<p class="adm-vaziol">Sem dados ainda.</p>';
  }

  /* ── Campanha ──────────────────────────────────────────────────── */
  $('#campForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#campBtn');
    mostrarErro($('#campErro'), '');
    $('#campOk').hidden = true;

    var quantos = estado.leads.filter(function (x) { return x.email && x.consentimento; }).length;
    if (!confirm('Enviar esta campanha a ' + quantos + ' pessoa(s)?\n\nNão dá para recuar depois de enviar.')) return;

    btn.disabled = true;
    btn.textContent = 'A enviar…';
    api({ accao: 'campanha', assunto: $('#assunto').value, corpo: $('#corpo').value }).then(function (r) {
      btn.disabled = false;
      btn.textContent = 'Enviar';
      if (r.dados && r.dados.ok) {
        $('#campOk').hidden = false;
        $('#campOk').textContent = 'Enviado a ' + r.dados.enviados + ' de ' + r.dados.total +
          (r.dados.falhados ? ' · ' + r.dados.falhados + ' falharam' : '');
        $('#assunto').value = '';
        $('#corpo').value = '';
      } else {
        mostrarErro($('#campErro'), (r.dados && r.dados.erro) || 'Não consegui enviar.');
      }
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Enviar';
      mostrarErro($('#campErro'), 'Sem ligação ao servidor.');
    });
  });

  /* Se o cookie ainda for válido, entra directo. */
  api({ accao: 'dados' }).then(function (r) {
    if (r.http !== 401) abrirPainel();
  }).catch(function () { /* fica no ecrã de entrada */ });
})();
