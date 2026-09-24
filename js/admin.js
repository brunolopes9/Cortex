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
  /* Os filtros vivem aqui e vão com cada pedido: filtrar no servidor
     evita trazer milhares de visitas para o browser só para as deitar
     fora a seguir. */
  var filtro = { periodo: '7d', origem: '' };

  function carregar() {
    api({ accao: 'dados', periodo: filtro.periodo, origem: filtro.origem }).then(function (r) {
      if (r.http === 401) { location.reload(); return; }
      if (!r.dados || !r.dados.ok) return;
      estado.leads = r.dados.leads || [];
      estado.sessoes = r.dados.sessoes || [];
      estado.resumo = r.dados.resumo || null;
      estado.anterior = r.dados.resumoAnterior || null;
      mostrarErro($('#aviso'), r.dados.aviso || '');
      encherOrigens((r.dados.filtro || {}).origensExistentes || []);
      pintarLeads();
      pintarVisitas();
      pintarSessoes();
    });
  }

  /* A lista de origens vem do servidor, com o que existe mesmo. Inventá-la
     aqui daria opções que nunca devolvem nada. */
  function encherOrigens(lista) {
    var sel = $('#filtroOrigem');
    if (!sel || sel.dataset.cheio === lista.join('|')) return;
    sel.dataset.cheio = lista.join('|');
    sel.innerHTML = '<option value="">Todas</option>' + lista.map(function (o) {
      return '<option' + (o === filtro.origem ? ' selected' : '') + '>' + seguro(o) + '</option>';
    }).join('');
  }

  $$('#periodo button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#periodo button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      filtro.periodo = b.getAttribute('data-p');
      carregar();
    });
  });

  $('#filtroOrigem').addEventListener('change', function () {
    filtro.origem = this.value;
    carregar();
  });

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
  var ESTADOS = ['Novo', 'Contactado', 'Interessado', 'Cliente', 'Perdido'];

  function pintarCartoesLeads() {
    var l = estado.leads;
    var autorizados = l.filter(function (x) { return x.email && x.consentimento; }).length;
    var hoje = new Date().toDateString();
    var deHoje = l.filter(function (x) { return new Date(x.ts).toDateString() === hoje; }).length;

    $('#cardsLeads').innerHTML =
      cartao(l.length, 'Contactos') +
      cartao(deHoje, 'Hoje') +
      cartao(l.filter(function (x) { return x.estado === 'Novo'; }).length, 'Por contactar') +
      cartao(l.filter(function (x) { return x.estado === 'Cliente'; }).length, 'Clientes');

    $('#campAlvo').textContent = autorizados + (autorizados === 1 ? ' pessoa vai receber' : ' pessoas vão receber');
  }

  function pintarLeads() {
    pintarCartoesLeads();
    filtrar();
  }

  function filtrar() {
    var q = ($('#procurar').value || '').toLowerCase().trim();
    var linhas = estado.leads.filter(function (x) {
      if (!q) return true;
      return [x.nome, x.telefone, x.email, x.origem, x.estado, x.nota]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });

    $('#vazioLeads').hidden = linhas.length > 0;
    $('#tabelaLeads').hidden = linhas.length === 0;

    $('#tabelaLeads tbody').innerHTML = linhas.map(function (x) {
      var tel = String(x.telefone || '').replace(/[^\d]/g, '');
      var sel = ESTADOS.map(function (e) {
        return '<option' + (e === x.estado ? ' selected' : '') + '>' + e + '</option>';
      }).join('');
      return '<tr data-chave="' + seguro(x.chave) + '">' +
        '<td class="adm-mono">' + dataHora(x.ts) + '</td>' +
        '<td><b>' + seguro(x.nome) + '</b></td>' +
        '<td><a href="https://wa.me/' + seguro(tel) + '" target="_blank" rel="noopener">' + seguro(x.telefone) + '</a></td>' +
        '<td>' + (x.email ? '<a href="mailto:' + seguro(x.email) + '">' + seguro(x.email) + '</a>' : '<i>—</i>') + '</td>' +
        '<td><select class="adm-estado adm-estado--' + x.estado.toLowerCase() + '">' + sel + '</select></td>' +
        '<td class="adm-origem">' + seguro(x.origem || 'directa') + '</td>' +
        '<td><button class="adm-nota-btn" title="Nota">' + (x.nota ? '✎' : '+') + '</button></td>' +
        '</tr>' +
        '<tr class="adm-nota-linha" data-nota="' + seguro(x.chave) + '" hidden><td colspan="7">' +
        '<textarea rows="2" placeholder="O que ficou combinado com esta pessoa">' + seguro(x.nota) + '</textarea>' +
        '</td></tr>';
    }).join('');
  }
  $('#procurar').addEventListener('input', filtrar);

  /* O estado e a nota gravam-se sozinhos: obrigar a carregar em Guardar
     só serve para se perder o que se escreveu. */
  function gravar(chave, tr) {
    var sel = $('select', tr);
    var nota = $('textarea', $('[data-nota="' + chave.replace(/"/g, '\\"') + '"]') || document.createElement('div'));
    var item = estado.leads.filter(function (x) { return x.chave === chave; })[0];
    if (!item) return;
    item.estado = sel ? sel.value : item.estado;
    item.nota = nota ? nota.value : item.nota;
    if (sel) sel.className = 'adm-estado adm-estado--' + item.estado.toLowerCase();
    pintarCartoesLeads();
    api({ accao: 'estado', chave: chave, estado: item.estado, nota: item.nota }).catch(function () {});
  }

  $('#tabelaLeads').addEventListener('change', function (e) {
    var tr = e.target.closest('tr[data-chave]');
    if (tr && e.target.tagName === 'SELECT') gravar(tr.getAttribute('data-chave'), tr);
  });

  $('#tabelaLeads').addEventListener('click', function (e) {
    if (!e.target.classList.contains('adm-nota-btn')) return;
    var tr = e.target.closest('tr[data-chave]');
    var linha = tr.nextElementSibling;
    linha.hidden = !linha.hidden;
    if (!linha.hidden) $('textarea', linha).focus();
  });

  $('#tabelaLeads').addEventListener('blur', function (e) {
    if (e.target.tagName !== 'TEXTAREA') return;
    var chave = e.target.closest('tr').getAttribute('data-nota');
    var tr = $('tr[data-chave="' + chave.replace(/"/g, '\\"') + '"]');
    if (tr) gravar(chave, tr);
  }, true);

  /* ── CSV ───────────────────────────────────────────────────────── */
  $('#csv').addEventListener('click', function () {
    var cab = ['Data', 'Nome', 'Telemovel', 'Email', 'Campanhas', 'Estado', 'Nota', 'Origem', 'Pais'];
    var celula = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var linhas = estado.leads.map(function (x) {
      return [dataHora(x.ts), x.nome, x.telefone, x.email, x.consentimento ? 'sim' : 'nao',
        x.estado, x.nota, x.origem, x.pais].map(celula).join(',');
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

  function tabela(el, linhas, vazio) {
    el.innerHTML = linhas.length ? linhas.map(function (x) {
      return '<tr><td>' + seguro(x.nome) + '</td>' +
        (x.medium !== undefined ? '<td class="adm-origem">' + seguro(x.medium || '—') + '</td>' : '') +
        '<td class="adm-mono">' + x.visitas + '</td>' +
        '<td class="adm-mono">' + x.leads + '</td>' +
        '<td class="adm-mono' + (x.taxa >= 10 ? ' adm-sim' : '') + '">' + x.taxa + '%</td></tr>';
    }).join('') : '<tr><td colspan="5" class="adm-vaziol">' + (vazio || 'Sem dados ainda.') + '</td></tr>';
  }

  function duracao(s) {
    var m = Math.floor(s / 60);
    return (m ? m + 'm ' : '') + (s % 60) + 's';
  }

  function pintarVisitas() {
    var r = estado.resumo;
    if (!r) return;

    /* 39 visitas é bom ou mau? Sozinho não quer dizer nada. A seta diz
       como está em relação ao período anterior do mesmo tamanho. */
    var a = estado.anterior;
    function delta(agora, antes) {
      if (!a || antes == null || !antes) return '';
      var pct = Math.round((agora - antes) / antes * 100);
      if (pct === 0) return '<i class="adm-delta">igual</i>';
      return '<i class="adm-delta adm-delta--' + (pct > 0 ? 'sobe' : 'desce') + '">' +
        (pct > 0 ? '↑' : '↓') + ' ' + Math.abs(pct) + '%</i>';
    }

    $('#cardsVisitas').innerHTML =
      cartao(r.visitas + delta(r.visitas, a && a.visitas), 'Visitas') +
      cartao((r.pessoas == null ? '—' : r.pessoas) + delta(r.pessoas, a && a.pessoas), 'Pessoas') +
      cartao(duracao(r.tempoMedio) + delta(r.tempoMedio, a && a.tempoMedio), 'Tempo médio') +
      cartao(r.telemovelPct + '%', 'Em telemóvel');

    /* O funil. A largura de cada degrau é a percentagem do total, para
       a queda se ver antes de se ler o número. */
    $('#funil').innerHTML = (r.funil || []).map(function (f) {
      var p = '';
      if (f.daAnterior != null) {
        p = f.daAnterior + '%';
        if (f.daAnterior < 100) {
          p += '<span class="adm-funil__perda">−' + (100 - f.daAnterior) + '%</span>';
        }
      }
      return '<div class="adm-funil__l">' +
        '<span class="adm-funil__n">' + f.nome + '</span>' +
        '<span class="adm-funil__b"><i style="width:' + Math.max(f.doTotal, 1) + '%"></i></span>' +
        '<b>' + f.quantos + '</b>' +
        '<span class="adm-funil__p">' + p + '</span>' +
        '</div>';
    }).join('');

    /* As acções não têm ordem entre si: mostram-se como percentagem do
       total de visitas, nunca como queda em relação à anterior. */
    var barras = function (lista) {
      return (lista || []).map(function (x) {
        return '<div class="adm-funil__l">' +
          '<span class="adm-funil__n">' + seguro(x.nome) + '</span>' +
          '<span class="adm-funil__b adm-funil__b--n"><i style="width:' + Math.max(x.doTotal, 1) + '%"></i></span>' +
          '<b>' + x.quantos + '</b>' +
          '<span class="adm-funil__p">' + x.doTotal + '%</span>' +
          '</div>';
      }).join('');
    };
    $('#accoes').innerHTML = barras(r.accoes);
    $('#destinos').innerHTML = barras(r.destinos);

    tabela($('#origens'), r.origens || []);
    tabela($('#aparelhos'), r.aparelhos || []);
    tabela($('#campanhas'), r.campanhas || [], 'Nenhuma visita com etiqueta ainda.');
    $('#vazioCamp').hidden = (r.campanhas || []).length > 0;

    lista($('#saidas'), r.saidas || []);
    lista($('#seccoes'), r.seccoes || []);
    lista($('#cliques'), r.cliques || []);
    lista($('#tempoSeccao'), r.tempoSeccao || [], 's');
    lista($('#video'), r.video || []);

    /* As simulações vêm em bruto; contamo-las aqui para ver que valores
       as pessoas escolhem mais. */
    var contas = {};
    (r.simulacoes || []).forEach(function (x) { contas[x] = (contas[x] || 0) + 1; });
    lista($('#simulacoes'), Object.entries(contas)
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12));

    var max = (r.dias || []).reduce(function (m2, d) { return Math.max(m2, d[1]); }, 0) || 1;
    $('#dias').innerHTML = (r.dias || []).length ? r.dias.map(function (d) {
      return '<div class="adm-dia" title="' + d[0] + ': ' + d[1] + '">' +
        '<i style="height:' + Math.max(4, Math.round(d[1] / max * 100)) + '%"></i>' +
        '<span>' + d[0].slice(8) + '</span></div>';
    }).join('') : '<p class="adm-vaziol">Sem dados ainda.</p>';
  }

  /* ── Sessões, uma a uma ────────────────────────────────────────── */
  function aparelho(w) {
    if (!w) return '?';
    return w < 640 ? 'Telemóvel' : w < 1024 ? 'Tablet' : 'Computador';
  }

  function pintarSessoes() {
    var s = estado.sessoes || [];
    $('#vazioSess').hidden = s.length > 0;

    $('#sessoes').innerHTML = s.map(function (x) {
      var virouLead = x.lead || (x.eventos || []).some(function (e) { return e.e === 'lead'; });

      /* As visitas anteriores à actualização do rastreio não têm passos
         nem identificador. Dizê-lo é melhor do que mostrar uma lista
         vazia, que se lê como avaria. */
      var antiga = !x.eventos;

      var passos = antiga
        ? '<li class="adm-vaziol">Visita registada antes de o percurso passar a ser guardado.</li>'
        : ((x.eventos || []).map(function (e) {
            return '<li><span class="adm-mono">' + duracao(e.t) + '</span>' +
              '<b>' + seguro(e.e) + '</b>' +
              '<span>' + seguro(e.d) + '</span></li>';
          }).join('') || '<li class="adm-vaziol">Sem passos registados.</li>');

      /* Uma visita de segundos que aparece a ter descido a página toda
         não é gente: é um robô a ler o HTML de uma vez. */
      var robo = (x.duracao || 0) < 10 && (x.scroll || 0) > 90;

      var quem = virouLead ? '<b class="adm-sim">contacto</b>'
        : robo ? '<span class="adm-fraco">provável robô</span>'
        : x.novo === true ? 'primeira vez'
        : x.novo === false ? (x.visitas || 2) + '.ª visita'
        : '<span class="adm-fraco">—</span>';

      return '<details class="adm-sess__i' + (virouLead ? ' is-lead' : '') + (robo ? ' is-robo' : '') + '">' +
        '<summary>' +
        '<span class="adm-mono">' + dataHora(x.ts) + '</span>' +
        '<span>' + seguro(x.origem || 'directa') + '</span>' +
        '<span>' + aparelho(x.ecra) + (x.pais ? ' · ' + seguro(x.pais) : '') + '</span>' +
        '<span class="adm-mono">' + duracao(x.duracao || 0) + '</span>' +
        '<span class="adm-mono">' + (x.scroll || 0) + '%</span>' +
        '<span>' + quem + '</span>' +
        '</summary>' +
        '<ol class="adm-passos">' + passos + '</ol>' +
        '</details>';
    }).join('');
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


  /* ══════════════════════ Diagnóstico ══════════════════════
     Um botão que responde à pergunta mais aflitiva de todas:
     "deixei o contacto e não me chegou nada — onde é que parou?" */
  function linha(rotulo, estado, detalhe) {
    var cor = estado === true ? 'ok' : estado === false ? 'mau' : 'meio';
    var simbolo = estado === true ? '✓' : estado === false ? '✕' : '—';
    return '<li class="adm-diag__l adm-diag__l--' + cor + '">' +
      '<b>' + simbolo + '</b><span>' + rotulo + '</span>' +
      '<i>' + (detalhe == null ? '' : seguro(detalhe)) + '</i></li>';
  }

  $('#diagBtn').addEventListener('click', function () {
    var caixa = $('#diag');
    caixa.hidden = false;
    caixa.innerHTML = '<p class="adm-diag__espera">A verificar…</p>';

    api({ accao: 'diagnostico' }).then(function (r) {
      if (!r.dados || !r.dados.ok) {
        caixa.innerHTML = '<p class="adm-diag__espera">Não consegui verificar.</p>';
        return;
      }
      var d = r.dados.diag, v = d.variaveis, h = '';

      h += '<h2>Envio de email</h2><ul>';
      h += linha('Chave da Resend', d.resend.chaveValida,
        d.resend.erro || (d.resend.chaveValida ? 'aceite' : ''));
      h += linha('Remetente (MAIL_FROM)', v.MAIL_FROM ? d.resend.remetenteOk : false,
        v.MAIL_FROM || 'em falta');
      h += linha('Destinatário (MAIL_TO)', Boolean(v.MAIL_TO), v.MAIL_TO || 'em falta — vai para o email por omissão');
      if (d.resend.dominios.length) {
        h += linha('Domínios na Resend', null,
          d.resend.dominios.map(function (x) { return x.nome + ' (' + x.estado + ')'; }).join(', '));
      } else if (d.resend.chaveValida) {
        h += linha('Domínios na Resend', false, 'nenhum domínio adicionado');
      }
      h += '</ul>';

      h += '<h2>Base de dados</h2><ul>';
      h += linha('Variáveis presentes', v.KV_REST_API_URL && v.KV_REST_API_TOKEN,
        v.KV_REST_API_URL && v.KV_REST_API_TOKEN ? '' : 'faltam — ou falta um Redeploy depois de as ligar');
      h += linha('Responde', d.baseDados.leituraOk,
        d.baseDados.erro || (d.baseDados.leituraOk ? d.baseDados.contactos + ' contacto(s) guardado(s)' : ''));
      h += '</ul>';

      h += '<h2>Acesso ao painel</h2><ul>';
      h += linha('ADMIN_PASSWORD', v.ADMIN_PASSWORD, '');
      h += linha('ADMIN_SECRET', v.ADMIN_SECRET, '');
      h += '</ul>';

      /* Uma frase de conclusão, para não obrigar a ler a lista toda. */
      var culpa = '';
      if (d.resend.chaveValida === false) culpa = 'O email não sai porque a Resend está a recusar a chave. Gere uma chave nova e actualize a RESEND_API_KEY na Vercel.';
      else if (v.MAIL_FROM && d.resend.remetenteOk === false) culpa = 'O email não sai porque o domínio do remetente (' + (d.resend.remetenteDominio || '?') + ') não está verificado na Resend.';
      else if (!v.MAIL_FROM) culpa = 'Falta a MAIL_FROM. Sem remetente, a Resend recusa o envio.';
      else if (d.baseDados.leituraOk === false || !(v.KV_REST_API_URL && v.KV_REST_API_TOKEN)) culpa = 'O email sai, mas os contactos não ficam guardados aqui. Faça um Redeploy depois de ligar a base de dados.';
      else culpa = 'Está tudo ligado. Se mesmo assim não recebe, veja o spam e confirme que MAIL_TO é o seu endereço.';
      h += '<p class="adm-diag__fim">' + seguro(culpa) + '</p>';

      caixa.innerHTML = h;
    }).catch(function () {
      caixa.innerHTML = '<p class="adm-diag__espera">Sem ligação ao servidor.</p>';
    });
  });

  /* Se o cookie ainda for válido, entra directo. */
  api({ accao: 'dados' }).then(function (r) {
    if (r.http !== 401) abrirPainel();
  }).catch(function () { /* fica no ecrã de entrada */ });
})();
