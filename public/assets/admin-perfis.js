import { areas, answerLabel } from "./pre-diagnostico-model.js";
const $ = (s) => document.querySelector(s),
  C = window.Club,
  select = $("#member");
let member = null,
  loadNumber = 0;
const date = (value) =>
  new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) +
  " (Brasília)";
const types = {
  cadastro: "Cadastro",
  imersao: "Imersão",
  pesquisa: "Pesquisa pública",
  conversa: "Conversa",
  pre_diagnostico: "Pré-diagnóstico",
  auditoria: "Auditoria de conexões",
};
function el(tag, text, className) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function message(text, error = false) {
  $("#message").textContent = text;
  $("#message").className = "message" + (error ? " error" : "");
}
async function edge(body) {
  const { data, error } = await C.sb.auth.getSession();
  if (error || !data.session)
    throw Error("Sua sessão expirou. Entre novamente.");
  const r = await fetch(C.cfg.supabaseUrl + "/functions/v1/pre-diagnostico", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: C.cfg.supabaseAnonKey,
      authorization: "Bearer " + data.session.access_token,
    },
    body: JSON.stringify(body),
  });
  const out = await r.json();
  if (!r.ok) throw Error(out.error || "Não foi possível concluir.");
  return out;
}
function details(data) {
  const dl = el("dl");
  for (const [k, v] of Object.entries(data || {})) {
    dl.append(
      el("dt", k.replaceAll("_", " ")),
      el("dd", typeof v === "string" ? v : JSON.stringify(v, null, 2)),
    );
  }
  return dl;
}
function card(entry) {
  const n = el("article", null, "profile-card");
  const sourceDate =
    entry.source_precision === "day"
      ? new Date(entry.source_at).toLocaleDateString("pt-BR", {
          timeZone: "UTC",
        })
      : date(entry.source_at);
  n.append(
    el("h2", types[entry.source_type] || entry.source_type),
    el("p", entry.source_ref, "meta"),
    el(
      "p",
      "Fonte: " +
        sourceDate +
        " · Registro: " +
        date(entry.recorded_at) +
        " · " +
        entry.version,
      "meta",
    ),
    details(entry.data),
  );
  return n;
}
async function load() {
  const turn = ++loadNumber;
  const id = select.value;
  member = id;
  $("#new-link").hidden = true;
  $("#issue").disabled = true;
  $("#identity").replaceChildren();
  $("#sources").replaceChildren();
  $("#answers").replaceChildren();
  $("#links").replaceChildren();
  message("Carregando contexto…");
  try {
    const [m, entries, links] = await Promise.all([
      C.sb
        .from("members")
        .select("id,nome,email,instagram,ativo")
        .eq("id", id)
        .single(),
      C.sb
        .from("member_context_entries")
        .select("*")
        .eq("member_id", id)
        .order("source_at", { ascending: false }),
      C.sb
        .from("member_intake_links")
        .select("id,created_at,expires_at,revoked_at")
        .eq("member_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (turn !== loadNumber) return;
    for (const r of [m, entries, links]) if (r.error) throw r.error;
    const identity = el("section", null, "profile-card");
    identity.append(
      el("h2", m.data.nome),
      details({
        email: m.data.email,
        instagram: m.data.instagram || "Não registrado",
        status: m.data.ativo
          ? "Ativo"
          : "Cadastro interno, acesso ainda não ativado",
      }),
    );
    $("#identity").append(identity);
    const responses = entries.data.filter(
      (e) => e.source_type === "pre_diagnostico",
    );
    const answerSection = $("#answers");
    answerSection.append(el("h2", "Respostas do pré-diagnóstico"));
    if (!responses.length)
      answerSection.append(
        el(
          "p",
          "Aguardando preenchimento. Nenhuma resposta do formulário recebida.",
          "meta",
        ),
      );
    else {
      const current = responses
        .slice()
        .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
      const n = el("article", null, "profile-card");
      n.append(
        el(
          "p",
          "Último envio: " +
            date(current.recorded_at) +
            " · " +
            current.version,
          "meta",
        ),
      );
      areas.forEach((area) => {
        n.append(el("h2", area.name));
        const dl = el("dl");
        area.questions.forEach((q) =>
          dl.append(
            el("dt", q.label),
            el(
              "dd",
              current.data[q.id]
                ? answerLabel(q.id, current.data[q.id])
                : "Não informado",
            ),
          ),
        );
        n.append(dl);
      });
      answerSection.append(n);
      if (responses.length > 1) {
        const history = el("details", null, "profile-card");
        history.append(
          el(
            "summary",
            "Histórico: " + responses.length + " envios preservados",
          ),
        );
        responses.forEach((r) =>
          history.append(
            card({
              ...r,
              data: Object.fromEntries(
                Object.entries(r.data).map(([k, v]) => [k, answerLabel(k, v)]),
              ),
            }),
          ),
        );
        answerSection.append(history);
      }
    }
    const sources = entries.data.filter(
      (e) => e.source_type !== "pre_diagnostico",
    );
    sources.forEach((e) => $("#sources").append(card(e)));
    if (!sources.length)
      $("#sources").append(
        el(
          "p",
          "Ainda não há fontes recuperadas registradas para este mentorado.",
          "meta",
        ),
      );
    if (!links.data.length)
      $("#links").append(el("p", "Nenhum link preparado.", "meta"));
    links.data.forEach((link) => {
      const row = el("div", null, "link-row");
      const active = !link.revoked_at && new Date(link.expires_at) > new Date();
      row.append(
        el(
          "span",
          (link.revoked_at
            ? "Encerrado"
            : active
              ? "Válido até"
              : "Expirado em") +
            " " +
            date(link.expires_at),
        ),
      );
      if (active) {
        const b = el("button", "Encerrar link");
        b.type = "button";
        b.addEventListener("click", async () => {
          b.disabled = true;
          try {
            await edge({ action: "revoke", link_id: link.id });
            await load();
          } catch (e) {
            message(e.message, true);
            b.disabled = false;
          }
        });
        row.append(b);
      }
      $("#links").append(row);
    });
    message(
      entries.data.length +
        " registros de contexto · " +
        responses.length +
        " envios do formulário. O conector do Cérebro consulta estas fontes por “perfil_do_mentorado”. A busca vetorial de conversas mantém suas fontes próprias.",
    );
  } catch (e) {
    if (turn === loadNumber)
      message("Não foi possível carregar o perfil. " + e.message, true);
  } finally {
    if (turn === loadNumber) $("#issue").disabled = false;
  }
}
$("#issue").addEventListener("click", async () => {
  const id = member,
    turn = loadNumber;
  $("#issue").disabled = true;
  try {
    const data = await edge({ action: "issue", member_id: id });
    if (id !== member || turn !== loadNumber) return;
    await load();
    if (id !== member || loadNumber !== turn + 1) return;
    $("#link").value = location.origin + "/pre-diagnostico/#t=" + data.token;
    $("#new-link").hidden = false;
    message("Link preparado. Nenhuma mensagem foi enviada.");
  } catch (e) {
    if (id === member && loadNumber === turn) message(e.message, true);
  } finally {
    if (id === member && loadNumber <= turn + 1) $("#issue").disabled = false;
  }
});
$("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#link").value);
    message("Link copiado.");
  } catch {
    $("#link").select();
    message("Selecione e copie o link acima.");
  }
});
select.addEventListener("change", () => {
  history.replaceState(null, "", "?m=" + encodeURIComponent(select.value));
  load();
});
$("#reload").addEventListener("click", load);
try {
  const session = await C.auth.require("admin");
  if (session) {
    const r = await C.sb.from("members").select("id,nome").order("nome");
    if (r.error) throw r.error;
    r.data.forEach((m) => {
      const o = el("option", m.nome);
      o.value = m.id;
      select.append(o);
    });
    const requested = new URLSearchParams(location.search).get("m");
    if (r.data.some((m) => m.id === requested)) select.value = requested;
    $("#workspace").hidden = false;
    if (r.data.length) await load();
    else message("Cadastre primeiro o mentorado no Cérebro.");
  }
} catch (e) {
  message(e.message, true);
}
