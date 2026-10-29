-- New Leads refer to actual CRM commits. Preserve truthful legacy evidence.
alter table public.hogz_capi_outbox add column capture_confirmed boolean not null default false;
alter table public.hogz_capi_outbox add column capture_store text check(capture_store in ('crm','sheet_legacy'));
alter table public.hogz_capi_outbox add column capture_status text check(capture_status in ('applied','review'));
update public.hogz_capi_outbox set capture_confirmed=sheet_confirmed,
 capture_store=case when sheet_confirmed then 'sheet_legacy' end;
alter table public.hogz_capi_outbox drop constraint hogz_capi_outbox_check;
alter table public.hogz_capi_outbox add constraint hogz_lead_has_capture check(event_name<>'Lead' or capture_confirmed);
