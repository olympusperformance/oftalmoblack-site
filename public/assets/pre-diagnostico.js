import { areas, VERSION } from "./pre-diagnostico-model.js";
const form = document.querySelector("#intake"),
  notice = document.querySelector("#notice"),
  button = document.querySelector("#submit");
const token = new URLSearchParams(location.hash.slice(1)).get("t") || "";
function message(text, type = "error") {
  notice.textContent = text;
  notice.className = type;
  notice.focus();
}
async function api(body) {
  const cfg = window.CLUB_CONFIG;
  const r = await fetch(cfg.supabaseUrl + "/functions/v1/pre-diagnostico", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: cfg.supabaseAnonKey,
    },
    body: JSON.stringify({ ...body, token }),
  });
  const data = await r.json();
  if (!r.ok)
    throw Error(
      data.error || "Não foi possível carregar agora. Tente novamente.",
    );
  return data;
}
function render(answers) {
  const target = document.querySelector("#areas");
  areas.forEach((area, index) => {
    const section = document.createElement("section");
    section.className = "area";
    const heading = document.createElement("div");
    heading.className = "area-heading";
    const number = document.createElement("span");
    number.className = "area-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("h2");
    title.textContent = area.name;
    heading.append(number, title);
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = area.hint;
    section.append(heading, hint);
    area.questions.forEach((q) => {
      const group = document.createElement(q.choices ? "fieldset" : "div");
      group.className = "question";
      const label = document.createElement(q.choices ? "legend" : "label");
      label.textContent = q.label;
      if (!q.choices) label.htmlFor = q.id;
      group.append(label);
      if (q.optional) {
        const optional = document.createElement("span");
        optional.className = "optional";
        optional.textContent = "Opcional";
        label.append(optional);
      }
      if (q.choices) {
        const choices = document.createElement("div");
        choices.className = "choices";
        q.choices.forEach(([value, text]) => {
          const l = document.createElement("label");
          l.className = "choice";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = q.id;
          input.value = value;
          input.checked = answers[q.id] === value;
          const span = document.createElement("span");
          span.textContent = text;
          l.append(input, span);
          choices.append(l);
        });
        group.append(choices);
      } else {
        const input = document.createElement("textarea");
        input.id = q.id;
        input.name = q.id;
        input.maxLength = 3000;
        input.rows = 2;
        input.value = answers[q.id] || "";
        group.append(input);
      }
      section.append(group);
    });
    target.append(section);
  });
}
let pendingId = null,
  pendingBody = null;
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const answers = {};
  for (const [key, value] of new FormData(form))
    if (String(value).trim()) answers[key] = String(value).trim();
  if (!Object.keys(answers).length) {
    message(
      "Responda ao menos uma pergunta para salvar. Estimativas são suficientes.",
    );
    return;
  }
  const serialized = JSON.stringify(answers);
  if (serialized !== pendingBody) {
    pendingId = crypto.randomUUID();
    pendingBody = serialized;
  }
  button.disabled = true;
  button.textContent = "Salvando…";
  try {
    await api({
      action: "submit",
      submission_id: pendingId,
      version: VERSION,
      answers,
    });
    message(
      "Respostas salvas. Obrigado! A equipe vai usá-las para preparar seu diagnóstico. Você pode complementar por este mesmo link.",
      "success",
    );
    button.textContent = "Salvar complemento →";
    pendingId = null;
    pendingBody = null;
  } catch (error) {
    message(error.message);
    button.textContent = "Tentar salvar novamente →";
  } finally {
    button.disabled = false;
  }
});
try {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw Error(
      "Abra o link individual enviado pela equipe para responder ao pré-diagnóstico.",
    );
  const data = await api({ action: "load" });
  if (data.version !== VERSION)
    throw Error("Este formulário foi atualizado. Peça um novo link à equipe.");
  const first = data.nome.replace(/^(Dr\.?|Dra\.?)\s+/i, "").split(" ")[0];
  const title = /^Dra\.?\s+/i.test(data.nome) ? "Dra." : "Dr.";
  document.querySelector("#intro").textContent =
    `${title} ${first}, queremos entender como o negócio funciona hoje para preparar nossa conversa de diagnóstico. Responda de forma geral, com estimativas.`;
  render(data.answers || {});
  form.hidden = false;
} catch (error) {
  document.querySelector("#intro").textContent = "Pré-diagnóstico do negócio";
  message(error.message);
}
