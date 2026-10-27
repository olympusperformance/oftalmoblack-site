// Sugestões de comportamento, não fatos sobre o médico ou sua clínica.
export const sugestoes = {
  posse_conversa: 'Quando alguém da equipe assumir a conversa, a assistente deve parar. A retomada só acontece quando a equipe liberar novamente. Os horários e responsáveis precisam ser definidos pela clínica.',
  tom: 'Conversar de forma acolhedora, clara e objetiva. Fazer uma pergunta por vez, respeitar o ritmo da pessoa e não prometer resultados. Evitar gírias, pressão e termos técnicos desnecessários.',
  perguntas_frequentes: 'Como funciona a avaliação? A equipe explica o que está incluído e o médico avalia o caso na consulta.\nQuanto custa? Informar somente os valores confirmados pela clínica.\nAceita meu convênio? Consultar as regras atualizadas da clínica e confirmar com a equipe quando houver dúvida.\nPosso fazer uma cirurgia? A indicação depende da avaliação do médico.',
  limites_humano: 'Acionar a equipe quando a pessoa pedir atendimento humano, houver reclamação, urgência, dúvida clínica que não possa ser respondida com as informações aprovadas, solicitação fora do escopo ou dúvida sobre agenda, pagamento ou cobertura. A assistente não diagnostica nem promete resultado.',
  followup_regras: 'Seguir o padrão da Íris: registrar a conversa e retomar no horário combinado. Quando configurado e fizer sentido, realizar um contato após 2 horas sem resposta, respeitando os horários autorizados. Não insistir se a pessoa pediu para não receber contato, já agendou ou disse que não pode continuar agora. Outros lembretes ou cadências precisam ser conferidos antes do piloto.',
  cenarios: 'Testar atendimento de um novo contato, valor e horários da consulta, particular e convênio, ausência de vaga, solicitação de uma pessoa da equipe, pausa quando alguém assumir e retomada autorizada. Testar áudio recebido com resposta em texto, imagens e documentos, além de acompanhar o retorno de quem ainda não agendou.',
};

export function usarSugestao(campo, atual) {
  if (typeof atual !== 'string' || atual.trim() || !Object.hasOwn(sugestoes, campo)) return atual;
  return sugestoes[campo];
}

export function irParaCampo(event, elemento) {
  event.preventDefault();
  elemento.scrollIntoView({behavior: 'smooth'});
}
