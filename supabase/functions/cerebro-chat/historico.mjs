// Persiste apenas pares completos de pergunta e resposta final. tool_use e
// tool_result pertencem à execução atual e nunca podem ser cortados ao meio.
export function historicoSeguro(messages) {
  const pairs = [];
  let pending = null;
  for (const message of messages) {
    if (!message || !['user','assistant'].includes(message.role)) continue;
    const content = message.content;
    if (Array.isArray(content) && content.some(block=>block?.type !== 'text')) continue;
    const text = typeof content === 'string' ? content : Array.isArray(content)
      ? content.map(block=>typeof block.text === 'string' ? block.text : '').join('\n') : '';
    if (!text.trim()) continue;
    const clean = {role:message.role,content:text.slice(0,16000)};
    if (message.role === 'user') pending = clean;
    else if (pending) { pairs.push([pending,clean]); pending = null; }
  }
  return pairs.slice(-6).flat();
}
