/* ============================================================================
   Club OftalmoBlack — camada de dados (Supabase / Postgres)

   Interface única consumida por /admin/ e /membros/:

     Club.data.members.list()             → Promise<Array>
     Club.data.tasks.list({memberId})     → Promise<Array>
     Club.data.events.list({memberId})    → Promise<Array>
     Club.data.artifacts.list({memberId}) → Promise<Array>
     ...save(registro) / ...remove(id)    → Promise

   O filtro por membro é uma conveniência da pré-visualização do admin. Para o
   mentorado ele é irrelevante: o Row Level Security já corta as linhas no banco
   antes de qualquer coisa sair de lá. Nenhuma segurança depende deste arquivo.
   ========================================================================= */
(function () {
  'use strict';

  var C = window.Club = window.Club || {};

  /* Colunas de verdade de cada tabela. Os formulários carregam campos que só
     existem na tela (o seletor de vários membros, por exemplo); mandar um deles
     para o PostgREST devolve erro de coluna inexistente. */
  var COLUNAS = {
    members:   ['nome', 'email', 'iniciais', 'turma', 'fase', 'tier', 'instagram', 'ativo'],
    tasks:     ['member_id', 'titulo', 'descricao', 'categoria', 'cadencia', 'vence_em',
                'progresso_atual', 'progresso_total', 'status'],
    events:    ['member_id', 'titulo', 'mentor', 'inicia_em', 'formato', 'link'],
    artifacts: ['member_id', 'nome', 'subtitulo', 'icone', 'status', 'meta', 'url'],
    materials: ['titulo', 'descricao', 'categoria', 'visivel_para', 'arquivo_path',
                'arquivo_nome', 'arquivo_tipo', 'arquivo_bytes', 'publicado_em']
  };

  /* Campo de data ou de chave estrangeira vazio precisa virar null; string
     vazia o Postgres recusa. */
  var NULAVEIS = ['vence_em', 'inicia_em', 'member_id', 'publicado_em'];

  function limpa(tabela, obj) {
    var out = {};
    COLUNAS[tabela].forEach(function (k) {
      if (!(k in obj)) return;
      var v = obj[k];
      if (NULAVEIS.indexOf(k) !== -1 && (v === '' || v === undefined)) v = null;
      /* Lista de destinatários vazia quer dizer "turma inteira", que no banco
         é nulo — um array vazio não casaria com ninguém. */
      if (Array.isArray(v) && v.length === 0) v = null;
      out[k] = v;
    });
    return out;
  }

  /* O PostgREST devolve { data, error } em vez de rejeitar a promessa. */
  function ok(res) {
    if (res.error) throw new Error(res.error.message || 'Erro ao falar com o banco.');
    return res.data;
  }
  function lista(res) { return ok(res) || []; }

  function sb() {
    if (C.configError) throw new Error(C.configError);
    return C.sb;
  }

  /* ── ordenações ───────────────────────────────────────────────────────── */

  function byName(a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); }

  function byDue(a, b) {
    /* Pendentes primeiro, depois por vencimento; sem prazo vai para o fim. */
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
    return String(a.vence_em || '9999').localeCompare(String(b.vence_em || '9999'));
  }

  function byStart(a, b) {
    return String(a.inicia_em || '').localeCompare(String(b.inicia_em || ''));
  }

  function opt(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }

  /* Itens de member_id nulo valem para a turma inteira. */
  function doMembro(query, memberId) {
    if (memberId === undefined) return query;
    return query.or('member_id.is.null,member_id.eq.' + memberId);
  }

  function grava(tabela, reg) {
    var linha = limpa(tabela, reg);
    var q = reg.id
      ? sb().from(tabela).update(linha).eq('id', reg.id)
      : sb().from(tabela).insert(linha);
    return q.select().single().then(ok);
  }

  function apaga(tabela, id) {
    return sb().from(tabela).delete().eq('id', id).then(function (res) { ok(res); });
  }

  /* ── interface ────────────────────────────────────────────────────────── */

  C.data = {
    members: {
      list: function () {
        return sb().from('members').select('*').then(lista)
          .then(function (r) { return r.sort(byName); });
      },
      get: function (id) {
        return sb().from('members').select('*').eq('id', id).maybeSingle().then(ok);
      },
      save: function (m) { return grava('members', m); },
      remove: function (id) {
        /* As tarefas e os artefatos só dele saem junto por ON DELETE CASCADE,
           declarado no schema.sql. */
        return apaga('members', id);
      }
    },

    tasks: {
      list: function (o) {
        var q = sb().from('tasks').select('*');
        var m = opt(o, 'memberId');
        if (m !== undefined) q = q.eq('member_id', m);
        return q.then(lista).then(function (r) { return r.sort(byDue); });
      },
      save: function (t) { return grava('tasks', t); },
      remove: function (id) { return apaga('tasks', id); },
      toggle: function (id) {
        /* Função no banco: o mentorado não tem UPDATE nas tarefas, só o direito
           de virar o próprio status. Ver toggle_task no schema.sql. */
        return sb().rpc('toggle_task', { p_task_id: id }).then(ok);
      }
    },

    events: {
      list: function (o) {
        return doMembro(sb().from('events').select('*'), opt(o, 'memberId'))
          .then(lista).then(function (r) { return r.sort(byStart); });
      },
      save: function (e) { return grava('events', e); },
      remove: function (id) { return apaga('events', id); }
    },

    artifacts: {
      list: function (o) {
        return doMembro(sb().from('artifacts').select('*'), opt(o, 'memberId'))
          .then(lista);
      },
      save: function (a) { return grava('artifacts', a); },
      remove: function (id) { return apaga('artifacts', id); }
    },

    /* Acervo: cresce sem parar e cada item carrega um arquivo de verdade. */
    materials: {
      list: function (o) {
        return sb().from('materials').select('*').then(function (res) {
          /* Enquanto supabase/materiais.sql não tiver sido rodado a tabela não
             existe. Derrubar a área inteira por causa de uma aba seria pior do
             que mostrar o acervo vazio com o aviso. */
          if (res.error && /does not exist|schema cache/i.test(res.error.message || '')) {
            C.acervoIndisponivel = 'O acervo ainda não foi criado no banco. ' +
              'Rode supabase/materiais.sql no SQL Editor do Supabase.';
            return [];
          }
          return lista(res);
        }).then(function (rows) {
          var m = opt(o, 'memberId');
          /* visivel_para é um array, então o filtro do PostgREST não serve
             para "nulo OU contém"; sai mais simples e legível aqui. O RLS já
             fez o corte de verdade — isto é só a pré-visualização do admin. */
          if (m !== undefined) {
            rows = rows.filter(function (r) {
              return !r.visivel_para || r.visivel_para.indexOf(m) !== -1;
            });
          }
          return rows.sort(byPublicado);
        });
      },

      save: function (m) { return grava('materials', m); },

      remove: function (id) {
        /* Apagar só a linha deixaria o arquivo ocupando espaço para sempre. */
        return sb().from('materials').select('arquivo_path').eq('id', id).maybeSingle()
          .then(ok)
          .then(function (row) {
            return apaga('materials', id).then(function () {
              if (row && row.arquivo_path) return removerArquivo(row.arquivo_path);
            });
          });
      },

      /* Manda o arquivo para o bucket e devolve o caminho gravado. */
      upload: function (file) {
        var path = caminhoDe(file.name);
        return sb().storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream'
        }).then(function (res) {
          if (res.error) throw new Error(traduzUpload(res.error));
          return path;
        });
      },

      removerArquivo: removerArquivo,

      /* URL assinada de vida curta. O bucket é privado: sem isto o arquivo não
         sai de lá, e o link não sobrevive para ser repassado adiante. */
      link: function (path, nomeParaBaixar) {
        var opcoes = nomeParaBaixar ? { download: nomeParaBaixar } : {};
        return sb().storage.from(BUCKET).createSignedUrl(path, 120, opcoes)
          .then(function (res) {
            if (res.error) throw new Error(res.error.message || 'Arquivo indisponível.');
            return res.data.signedUrl;
          });
      }
    }
  };

  /* ── arquivo ──────────────────────────────────────────────────────────── */

  var BUCKET = 'materiais';

  function byPublicado(a, b) {
    return String(b.publicado_em || '').localeCompare(String(a.publicado_em || ''));
  }

  /* Pasta aleatória por arquivo: dois uploads com o mesmo nome não colidem e
     o caminho não é adivinhável. O nome original fica guardado na linha. */
  function caminhoDe(nome) {
    var limpo = String(nome || 'arquivo')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(-80);
    var id = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(36).slice(2);
    return id + '/' + limpo;
  }

  function removerArquivo(path) {
    return sb().storage.from(BUCKET).remove([path]).then(function (res) {
      if (res.error) throw new Error(res.error.message || 'Não foi possível apagar o arquivo.');
    });
  }

  function traduzUpload(err) {
    var m = String(err.message || '');
    if (/exceeded the maximum allowed size|payload too large/i.test(m)) {
      return 'Arquivo grande demais. O limite é 50 MB.';
    }
    if (/bucket not found/i.test(m)) {
      return 'O acervo ainda não foi criado no Supabase. Rode supabase/materiais.sql.';
    }
    if (/new row violates row-level security|unauthorized/i.test(m)) {
      return 'Sem permissão para subir arquivo.';
    }
    return m || 'Não foi possível enviar o arquivo.';
  }
})();
