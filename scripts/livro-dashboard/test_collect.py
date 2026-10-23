import unittest
from unittest.mock import patch
import collect
import tempfile,json,sqlite3
from pathlib import Path

class WebhookOriginsTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'origins.sqlite3'
  self.db=sqlite3.connect(self.path);self.db.execute('create table origins(sale_id integer primary key,product_id integer,metas text,received_at text)')
  self.sales=[{'id':42,'product_id':199893}]
 def tearDown(self):self.db.close();self.tmp.cleanup()
 def add(self,sid=42,pid=199893,**metas):
  self.db.execute('insert into origins values(?,?,?,?)',(sid,pid,json.dumps(metas),'2026-10-22T22:56:00Z'));self.db.commit()
 def test_webhook_automatically_syncs_only_real_book_sale_origins(self):
  self.add(utm_source='ig',utm_content='direct-post-123456',src='lp-livro',email='discard@example.test');self.add(820,199893,utm_source='native-test')
  attrs={}
  def store(path,body,method):return [{**r,'outcome':'saved'} for r in body['p_rows']]
  with patch.object(collect,'sb',side_effect=store) as sb:health=collect.sync_origins(self.sales,attrs,self.path,True)
  self.assertTrue(health['webhook_active']);self.assertEqual(attrs[42]['origin_mode'],'greenn_webhook');self.assertNotIn(820,attrs)
  payload=sb.call_args.args[1]['p_rows'];self.assertEqual(len(payload),1);self.assertNotIn('discard',str(payload));self.assertNotIn('src',payload[0])
 def test_manual_correction_committed_after_initial_read_wins_atomically(self):
  self.add(utm_source='ig',utm_content='direct-post-123456')
  current={'sale_id':42,'product_id':199893,'origin_mode':'greenn_csv','utm_source':'ig','utm_content':'direct-post-123457','outcome':'conflict'};attrs={}
  with patch.object(collect,'sb',return_value=[current]) as sb:health=collect.sync_origins(self.sales,attrs,self.path,True)
  self.assertEqual(sb.call_args.args[0],'rpc/book_merge_webhook_origins');self.assertEqual(attrs[42]['utm_content'],'direct-post-123457');self.assertEqual(health['origin_conflicts'],1)
 def test_duplicate_origin_does_not_write_again(self):
  self.add(utm_source='ig',utm_content='direct-post-123456')
  attrs={42:{'sale_id':42,'product_id':199893,'origin_mode':'greenn_webhook','utm_source':'ig','utm_medium':'','utm_campaign':'','utm_content':'direct-post-123456'}}
  with patch.object(collect,'sb') as sb:collect.sync_origins(self.sales,attrs,self.path,True)
  sb.assert_not_called()
 def test_conflicting_manual_origin_is_preserved_and_reported(self):
  self.add(utm_source='ig',utm_content='direct-post-123456')
  old={'sale_id':42,'product_id':199893,'origin_mode':'greenn_ui','utm_source':'ig','utm_content':'direct-post-123457'};attrs={42:old.copy()}
  with patch.object(collect,'sb') as sb:health=collect.sync_origins(self.sales,attrs,self.path,True)
  self.assertEqual(attrs[42],old);self.assertEqual(health['origin_conflicts'],1);sb.assert_not_called()
 def test_invalid_utm_or_product_never_gets_attributed(self):
  self.add(utm_source='ig',utm_content='private@example.test');self.add(43,199173,utm_source='ig')
  with patch.object(collect,'sb') as sb:health=collect.sync_origins(self.sales+[{'id':43,'product_id':199893}],{},self.path,True)
  sb.assert_not_called();self.assertEqual(health['origin_invalid'],2)
 def test_missing_receiver_does_not_create_storage(self):
  missing=Path(self.tmp.name)/'absent.sqlite3'
  with self.assertRaises(sqlite3.OperationalError):collect.sync_origins(self.sales,{},missing,True)
  self.assertFalse(missing.exists())

class CollectionTests(unittest.TestCase):
 def test_origin_failure_preserves_confirmed_mapping_and_financial_collection(self):
  with tempfile.TemporaryDirectory() as tmp:
   token=Path(tmp)/'pat';token.write_text('fixture')
   paid={'id':42,'product_id':199893,'status':'paid','paid_at':'2026-10-22T22:00:00Z','refunded_at':None,'amount':1050,'total':1074,'currency':'BRL'}
   attr={'sale_id':42,'product_id':199893,'utm_source':'ig','utm_content':'direct-post-123456'}
   with patch.dict(collect.os.environ,{'GREENN_PAT_FILE':str(token)}),patch.object(collect,'request',side_effect=[{'data':[],'meta':{'last_page':1}},{'data':[paid],'meta':{'last_page':1}}]),patch.object(collect,'all_rows',return_value=[attr]),patch.object(collect,'sync_origins',side_effect=sqlite3.OperationalError('fixture')):
    result=collect.greenn('America/Manaus')
   self.assertFalse(result['webhook_active']);self.assertEqual(result['rows'][0]['paid_sales'],1);self.assertEqual(result['rows'][0]['revenue_cents'],105000);self.assertEqual(result['rows'][0]['media_id'],'123456')
 def test_failure_patches_only_health_without_destroying_previous_payload(self):
  with patch.object(collect,'sb',side_effect=[[{'source':'ga4'}],None]) as sb:
   collect.snapshot('ga4',error='ga4_http_503')
  path,body,method=sb.call_args.args
  self.assertEqual(method,'PATCH');self.assertNotIn('payload',body);self.assertNotIn('last_success_at',body)
 def test_table_reads_all_pages(self):
  with patch.object(collect,'sb',side_effect=[[{'sale_id':i} for i in range(500)],[{'sale_id':501}]]) as sb:
   rows=collect.all_rows('book_sale_attributions')
  self.assertEqual(len(rows),501);self.assertIn('offset=500',sb.call_args.args[0])
 def test_failed_traffic_does_not_block_sales(self):
  import tempfile
  from pathlib import Path
  with tempfile.TemporaryDirectory() as tmp, patch.object(collect,'ROOT',Path(tmp)),patch.object(collect,'sb',return_value=[]),patch.object(collect,'ga4',side_effect=ValueError()),patch.object(collect,'greenn',return_value={'rows':[]}) as greenn,patch.object(collect,'snapshot') as snapshot,patch.object(collect,'metadata'):
   self.assertEqual(collect.run(),1)
  greenn.assert_called_once_with('America/Manaus')
  self.assertEqual(snapshot.call_args_list[0].kwargs,{'error':'ga4_ValueError'});self.assertEqual(snapshot.call_args_list[1].args,('greenn',{'rows':[]}))

if __name__=='__main__':unittest.main()
