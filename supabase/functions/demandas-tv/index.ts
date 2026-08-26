/* ============================================================================
   demandas-tv — o quadro de demandas numa TV, destrancado por senha

   Por que existe uma função no meio do caminho, se o resto do site fala direto
   com o Supabase: as tabelas `demands`, `demand_steps` e `staff` não têm
   nenhuma política de leitura fora do administrador, e abrir uma para `anon`
   entregaria o quadro inteiro a quem tem a chave publishable — que é pública
   por definição e vive no /config.js. A senha também não pode viver no
   navegador: quem lê a tela lê a senha.

   Então a senha mora aqui, como variável de ambiente do lado do servidor
   (DEMANDAS_SENHA, definida por `supabase secrets set`), e é esta função —
   com a chave service_role, que nunca sai daqui — quem lê o banco. O RLS
   continua fechado como estava; nada foi aberto para `anon`.

   Duas variáveis mandam no portão, e uma delas precisa existir:

     DEMANDAS_PUBLICO=1   quadro aberto, sem senha (é o modo de hoje)
     DEMANDAS_SENHA=...   quadro trancado por esta senha

   Trocar de um para o outro é mexer nas variáveis do projeto e reimplantar a
   função — a tela descobre sozinha se precisa pedir senha, e não há nada a
   mudar no site. Sem nenhuma das duas a função não responde o quadro: um
   segredo esquecido não vira porta aberta por acidente.

   Só leitura. Não há caminho de escrita nesta função: quem descobrir a senha
   vê o quadro e não muda uma linha dele.
   ========================================================================= */

/* A senha é o portão, e CORS não é portão nenhum — um curl ignora Origin. Daí
   liberar qualquer origem: a TV pode estar num host que nem conhecemos. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

/* Comparação de tempo constante. Comparar com === deixaria o tempo de resposta
   contar quantos caracteres iniciais estão certos. */
function igual(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return dif === 0;
}

/* Freio de tentativa por IP. Mora na memória da instância, que é efêmera e não
   é única — então isto atrasa quem fica chutando, não impede. O que sustenta a
   senha é ela ser longa, não este contador. */
const JANELA = 5 * 60 * 1000;
const TETO_ERROS = 12;
const erros = new Map<string, { n: number; desde: number }>();

function travado(ip: string) {
  const e = erros.get(ip);
  if (!e) return false;
  if (Date.now() - e.desde > JANELA) { erros.delete(ip); return false; }
  return e.n >= TETO_ERROS;
}

function errou(ip: string) {
  const e = erros.get(ip);
  if (!e || Date.now() - e.desde > JANELA) erros.set(ip, { n: 1, desde: Date.now() });
  else e.n++;
}

const URL_BASE = Deno.env.get('SUPABASE_URL')!;
/* O runtime injeta a chave de serviço sozinho, mas o nome mudou quando o
   projeto passou a usar as chaves publishable/secret. Tenta os dois nomes antes
   de desistir, e aceita uma DEMANDAS_SERVICE_KEY posta à mão como último
   recurso. */
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  ?? Deno.env.get('SUPABASE_SECRET_KEY')
  ?? Deno.env.get('DEMANDAS_SERVICE_KEY');

/* Cada tabela com as colunas que a TV desenha, e só elas: o que não é exibido
   não precisa atravessar a internet. */
const CONSULTAS: Record<string, string> = {
  demands: 'id,titulo,descricao,status,prioridade,responsaveis,member_id,origem,vence_em',
  demand_steps: 'id,demand_id,titulo,ordem,feito,status',
  staff: 'id,nome,apelido',
  members: 'id,nome,iniciais'
};

async function ler(tabela: string) {
  if (!SERVICE) throw new Error('sem chave de serviço no ambiente da função');
  const r = await fetch(
    `${URL_BASE}/rest/v1/${tabela}?select=${CONSULTAS[tabela]}`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
  );
  if (!r.ok) throw new Error(`${tabela}: ${r.status} ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);

  const publico = /^(1|true|sim)$/i.test(Deno.env.get('DEMANDAS_PUBLICO') ?? '');
  const esperada = Deno.env.get('DEMANDAS_SENHA');

  if (!publico && !esperada) {
    /* Sem senha definida e sem liberação explícita, ficaria de portão aberto
       por descuido. Melhor não responder nada do que responder o quadro. */
    return json({ erro: 'O quadro da TV não foi configurado no servidor.' }, 503);
  }

  if (publico) return await quadro();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'desconhecido';
  if (travado(ip)) {
    return json({ erro: 'Muitas tentativas. Espere alguns minutos.' }, 429);
  }

  let senha = '';
  try {
    const body = await req.json();
    senha = String(body?.senha ?? '');
  } catch {
    return json({ erro: 'Corpo inválido.' }, 400);
  }

  if (!igual(senha, esperada!)) {
    errou(ip);
    /* Meio segundo de espera não incomoda quem digitou errado uma vez e
       estraga o ritmo de quem está chutando em série. */
    await new Promise((r) => setTimeout(r, 500));
    /* precisaSenha diz à tela para desenhar o portão: é assim que ela
       descobre que este projeto está no modo trancado. */
    return json({ erro: senha ? 'Senha incorreta.' : 'Esta tela pede senha.',
                  precisaSenha: true }, 401);
  }

  return await quadro();
});

async function quadro() {
  try {
    const [demandas, etapas, equipe, mentorados] = await Promise.all([
      ler('demands'), ler('demand_steps'), ler('staff'), ler('members')
    ]);
    return json({ demandas, etapas, equipe, mentorados, em: new Date().toISOString() });
  } catch (e) {
    console.error('[demandas-tv]', e);
    /* Falta de chave é erro de instalação, não de banco: dizer isso poupa uma
       caça ao fantasma. Não há segredo nesta frase. */
    const msg = String((e as Error)?.message || '');
    if (msg.includes('sem chave de serviço')) {
      return json({ erro: 'A função não tem a chave de serviço no ambiente.' }, 503);
    }
    return json({ erro: 'Não foi possível ler o quadro agora.' }, 502);
  }
}
