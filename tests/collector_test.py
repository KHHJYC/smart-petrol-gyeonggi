import importlib.util, pathlib, time, unittest
import sys
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('collector', pathlib.Path(__file__).parents[1]/'collect_gg.py')
collector=importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
pet_spec=importlib.util.spec_from_file_location('pet_collector', pathlib.Path(__file__).parents[1]/'collect_pet_cumulative.py')
pet_collector=importlib.util.module_from_spec(pet_spec)
pet_spec.loader.exec_module(pet_collector)
sys.path.insert(0,str(pathlib.Path(__file__).parents[1]/'scripts'))
from check_data_quality import check_counts
from restore_published_snapshot import validate

class CollectionFailureTests(unittest.TestCase):
    def test_cumulative_pet_collection_groups_species_without_inventing_current_population(self):
        rows=[
            {'SGG':'양주시','LVSTCK_KND':'개','CNT':10},
            {'SGG':'양주시','LVSTCK_KND':'고양이','CNT':2},
            {'SGG':'양주시','LVSTCK_KND':'기타','CNT':1},
        ]
        with patch.object(pet_collector,'fetch_page',return_value=(3,rows)):
            result=pet_collector.collect('dummy-key')
        self.assertEqual(result['cities']['양주시'],{'dogs':10,'cats':2,'other':1,'total':13})
        self.assertTrue(result['includesDeceased'])
    def test_published_fallback_requires_complete_current_quality_data(self):
        baseline={'sources':{'cctv':{'mapped':100},'lights':{'mapped':100}}}
        payloads={
            pathlib.Path('manifest.json'): b'{"checkedAt":"same","sources":{"cctv":{"mapped":100},"lights":{"mapped":100}}}',
            pathlib.Path('inspection.json'): b'{"checkedAt":"same"}',
        }
        for index in range(32):
            payloads[pathlib.Path(f'regions/{index}.json')]=b'{}'
        self.assertEqual(validate(payloads,baseline)['checkedAt'],'same')
        payloads[pathlib.Path('manifest.json')]=b'{"checkedAt":"same","sources":{"cctv":{"mapped":89},"lights":{"mapped":100}}}'
        with self.assertRaisesRegex(RuntimeError,'below the repository baseline'):
            validate(payloads,baseline)

    def test_official_coordinate_loss_blocks_publication(self):
        with self.assertRaisesRegex(RuntimeError,'Previous public map retained'):
            check_counts('cctv',2606,80546)
        check_counts('cctv',80546,80546)

    def test_complete_collection_preserves_the_partial_last_page(self):
        def fetch(service, page, key, cancel=None):
            return 5, list(range(5))[(page-1)*2:page*2]
        with patch.object(collector,'PAGE_SIZE',2), patch.object(collector,'fetch_page',side_effect=fetch):
            self.assertEqual(collector.collect('TEST','dummy-key'),list(range(5)))

    def test_first_failed_page_cancels_the_remaining_queue(self):
        started=[]
        def fetch(service, page, key, cancel=None):
            started.append(page)
            if page == 1: return 100000, [None]*collector.PAGE_SIZE
            if page == 2: raise RuntimeError('simulated failed page')
            if cancel.wait(1): raise RuntimeError('cancelled')
            return 100000, [None]*collector.PAGE_SIZE
        begin=time.monotonic()
        with patch.object(collector,'fetch_page',side_effect=fetch):
            with self.assertRaisesRegex(RuntimeError,'simulated failed page'):
                collector.collect('TEST','dummy-key')
        self.assertLess(len(started),10)
        self.assertLess(time.monotonic()-begin,2)

if __name__ == '__main__': unittest.main()
