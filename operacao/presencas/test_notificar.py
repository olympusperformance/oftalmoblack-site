import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('notify',Path(__file__).with_name('notificar.py'));n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
n.time.sleep=lambda _:None
class Notifications(unittest.TestCase):
 def test_manual_presence_never_invents_arrival_time(self):
  message=n.text({'nome':'Nome','dia':'2026-10-22','registrada_em':'2026-10-22T14:00:00Z','manual':True})
  self.assertIn('incluída manualmente',message);self.assertIn('Horário de chegada não informado',message);self.assertNotIn('11h00',message);self.assertNotIn('feita pelo participante',message)
 def test_postgres_fractional_timestamp_on_python310(self):
  row={'nome':'Nome','dia':'2026-10-22','registrada_em':'2026-10-22T11:31:11.46823+00:00'}
  self.assertIn('08h31',n.text(row))
 def test_backfill_dedup_and_unknown_outcome(self):
  with tempfile.TemporaryDirectory() as folder:
   db=n.connect(Path(folder)/'state.sqlite');row={'id':'real-id','nome':'Nome exemplo','dia':'2026-10-22','registrada_em':'2026-10-22T12:05:00Z'}
   n.enqueue(db,[row,row]);self.assertEqual(db.execute('select count(*) from notifications').fetchone()[0],2)
   sent=[];messages=[]
   def evo(path,body):
    if 'sendText' in path:
     item={'key':{'id':'mid-'+str(len(sent)),'fromMe':True,'remoteJid':body['number']},'message':{'conversation':body['text']}};messages.append(item);sent.append(body)
     if len(sent)==1:raise TimeoutError() # Delivered, ACK lost.
     return item
    return {'messages':{'records':messages}}
   self.assertEqual(n.process(db,evo),{'verified':2});self.assertEqual(len(sent),2)
   n.enqueue(db,[row]);n.process(db,evo);self.assertEqual(len(sent),2)
   self.assertIn('09h05, horário de Brasília',sent[0]['text']);self.assertNotIn('real-id',sent[0]['text']);db.close()
 def test_uncertain_without_readback_is_never_resent(self):
  with tempfile.TemporaryDirectory() as folder:
   db=n.connect(Path(folder)/'state.sqlite');n.enqueue(db,[{'id':'id','nome':'Nome','dia':'2026-10-22','registrada_em':'2026-10-22T12:00:00Z'}]);attempts=[]
   def evo(path,body):
    if 'sendText' in path:attempts.append(body);raise TimeoutError()
    return {'records':[]}
   n.process(db,evo);n.process(db,evo);self.assertEqual(len(attempts),2);self.assertEqual(db.execute('select count(*) from notifications where state="attempting"').fetchone()[0],2);db.close()
 def test_uncertain_backlog_does_not_block_new_notifications(self):
  with tempfile.TemporaryDirectory() as folder:
   db=n.connect(Path(folder)/'state.sqlite')
   for i in range(40):db.execute('insert into notifications(presence_id,destination,content,state) values(?,?,?,?)',(str(i),'9750','old','attempting'))
   db.commit();n.enqueue(db,[{'id':'new','nome':'Nome','dia':'2026-10-22','registrada_em':'2026-10-22T12:00:00Z'}]);attempts=[]
   def evo(path,body):
    if 'sendText' in path:attempts.append(body);raise TimeoutError()
    return {'records':[]}
   n.process(db,evo);self.assertEqual(len(attempts),2)
   for _ in range(4):n.process(db,evo)
   self.assertEqual(db.execute('select count(*) from notifications where last_checked_at is not null').fetchone()[0],42);db.close()
if __name__=='__main__':unittest.main()
