import unittest
from unittest.mock import patch
import collect

class CollectionTests(unittest.TestCase):
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
