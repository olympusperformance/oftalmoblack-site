import unittest
from model import aggregate_traffic, aggregate_sales

def sale(**kw):
    return dict(id=1,product_id=199893,status='paid',paid_at='2026-10-23T02:30:00+00:00',refunded_at=None,currency='BRL',amount=1050,total=1074,**kw)

class ModelTests(unittest.TestCase):
    def test_stories_have_own_identity_and_sales_separate_from_feed(self):
        from model import origin
        s=origin({'utm_source':'ig','utm_medium':'stories','utm_content':'direct-story-18000000000000123'})
        p=origin({'utm_source':'ig','utm_content':'direct-post-18000000000000123'})
        self.assertEqual(s['key'],'story:18000000000000123');self.assertEqual(s['story_id'],'18000000000000123');self.assertIsNone(s['media_id']);self.assertNotEqual(s['key'],p['key'])
        out=aggregate_sales([sale()],{1:{'utm_source':'ig','utm_medium':'stories','utm_content':'direct-story-18000000000000123'}},'America/Manaus')
        self.assertEqual(out[0]['attributed_sales'],1)
    def test_traffic_uses_event_url_and_keeps_posts_separate(self):
        rows=[{'date':'20261022','page_location':'https://oftalmoblack.com.br/livro/?utm_source=ig&utm_medium=social&utm_campaign=livro-presbiopia&utm_content=direct-post-18141996646620907&email=private@example.com','event':'page_view','count':3},
              {'date':'20261022','page_location':'https://oftalmoblack.com.br/livro/?utm_source=ig&utm_medium=social&utm_content=direct-post-18000000000000002','event':'begin_checkout','count':2},
              {'date':'20261022','page_location':'https://oftalmoblack.com.br/livro/obrigado/','event':'page_view','count':9}]
        out=aggregate_traffic(rows)
        self.assertEqual(sum(x['views'] for x in out),3)
        self.assertEqual(sum(x['checkout_clicks'] for x in out),2)
        self.assertEqual(len(out),2)
        self.assertNotIn('private',str(out))
        self.assertEqual(out[0]['date'],'2026-10-22')

    def test_paid_sales_exclude_refunds_and_shipping_and_deduplicate(self):
        a=sale();refund={**a,'id':2,'status':'refunded','refunded_at':'2026-10-23T03:00:00Z'}
        refused={**a,'id':3,'status':'refused'}
        other={**a,'id':4,'product_id':123}
        out=aggregate_sales([a,a,refund,refused,other],{1:{'product_id':199893,'utm_source':'ig','utm_medium':'social','utm_content':'direct-post-18141996646620907'}},'America/Manaus')
        self.assertEqual(sum(x['paid_sales'] for x in out),1)
        self.assertEqual(sum(x['revenue_cents'] for x in out),105000)
        self.assertEqual(out[0]['date'],'2026-10-22')
        self.assertEqual(out[0]['media_id'],'18141996646620907')

    def test_discount_and_unknown_origin_are_preserved(self):
        out=aggregate_sales([{**sale(),'amount':'525.00'}],{},'America/Manaus')
        self.assertEqual(out[0]['revenue_cents'],52500)
        self.assertEqual(out[0]['key'],'unattributed')
        self.assertEqual(out[0]['attributed_sales'],0)

    def test_wrong_product_mapping_cannot_attribute_sale(self):
        out=aggregate_sales([sale()],{1:{'product_id':199173,'utm_source':'ig','utm_content':'direct-post-18141996646620907'}},'America/Manaus')
        self.assertEqual(out[0]['media_id'],None)

    def test_invalid_financial_data_does_not_become_zero(self):
        for changed in [{'amount':None},{'amount':'NaN'},{'amount':-1},{'currency':'USD'},{'paid_at':'invalid'}]:
            with self.assertRaises(ValueError):aggregate_sales([{**sale(),**changed}],{},'America/Manaus')

    def test_conflicting_duplicate_fails_instead_of_counting_twice(self):
        with self.assertRaises(ValueError):aggregate_sales([sale(),{**sale(),'amount':525}],{},'America/Manaus')

    def test_unmarked_traffic_and_invalid_post_are_unattributed(self):
        rows=[{'date':'20261022','page_location':'https://oftalmoblack.com.br/livro/','event':'page_view','count':1},
              {'date':'20261022','page_location':'https://oftalmoblack.com.br/livro/?utm_content=direct-post-private@example.com','event':'begin_checkout','count':1}]
        out=aggregate_traffic(rows)
        self.assertEqual(len(out),1)
        self.assertEqual(out[0]['key'],'unattributed')

if __name__=='__main__':unittest.main()
