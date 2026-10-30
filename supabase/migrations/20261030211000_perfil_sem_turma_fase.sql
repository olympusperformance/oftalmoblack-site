-- O perfil padrão deixa de ter Turma e Fase: o Club não usa mais esses campos.
-- Publicar junto com as funções member-profile e cerebro-mcp (catálogo do código e do banco precisam bater).
update public.member_profile_catalog
set definition = jsonb_set(definition, '{fields}', (definition->'fields') - 'identidade.turma' - 'identidade.fase')
where schema_version = '2.0';
