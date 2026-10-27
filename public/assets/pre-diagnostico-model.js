export const VERSION = "pre-diagnostico-v1";
const roles = [
  ["dedicada", "Sim, uma pessoa dedicada a isso"],
  ["acumula", "Sim, alguém acumula essa função"],
  ["eu", "Eu mesmo faço"],
  ["sem_responsavel", "Não há alguém responsável por isso"],
  ["nao_sei", "Não sei informar"],
];
const teams = [
  ["interna", "Sim, equipe interna"],
  ["externa", "Sim, agência ou profissional externo"],
  ["eu", "Eu mesmo cuido"],
  ["nao", "Não"],
  ["nao_sei", "Não sei informar"],
];
export const areas = [
  {
    name: "Médias mensais",
    hint: "Estimativas são suficientes. Pode escrever “não sei”.",
    questions: [
      { id: "consultas", label: "Qual é a média de consultas por mês?" },
      {
        id: "cirurgias_indicadas",
        label: "Qual é a média de cirurgias indicadas por mês?",
      },
      {
        id: "cirurgias_realizadas",
        label: "Qual é a média de cirurgias realizadas por mês?",
      },
    ],
  },
  {
    name: "Estrutura comercial",
    hint: "Queremos entender quem participa do atendimento e do fechamento.",
    questions: [
      {
        id: "sdr",
        label:
          "Hoje, existe alguém que faz o papel de SDR, atendendo os interessados em consulta e conduzindo o agendamento?",
        choices: roles,
      },
      {
        id: "closer",
        label:
          "Hoje, existe alguém que faz o papel de closer, acompanhando os pacientes com indicação cirúrgica até o fechamento da cirurgia?",
        choices: roles,
      },
      {
        id: "outras_pessoas",
        label:
          "Além das pessoas já citadas, há outras pessoas que participam da jornada do paciente dentro da clínica? Se houver, conte quais funções elas exercem.",
        optional: true,
      },
    ],
  },
  {
    name: "Sistemas e equipes",
    hint: "Conte como o trabalho está organizado hoje.",
    questions: [
      {
        id: "agenda",
        label: "Como está organizada sua agenda ao longo da semana?",
      },
      {
        id: "sistemas",
        label:
          "Quais sistemas vocês usam para agenda, prontuário e acompanhamento comercial?",
      },
      {
        id: "trafego",
        label:
          "Vocês têm uma equipe ou profissional responsável pelo tráfego pago, cuidando dos anúncios do negócio?",
        choices: teams,
      },
      {
        id: "social_media",
        label:
          "Vocês têm uma equipe ou profissional de social media, responsável pelas redes sociais e pela produção de conteúdo?",
        choices: teams,
      },
    ],
  },
];
export function answerLabel(key, value) {
  const q = areas.flatMap((a) => a.questions).find((q) => q.id === key);
  return q?.choices?.find((c) => c[0] === value)?.[1] || value;
}
