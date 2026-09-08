import importlib.util, pathlib, time, unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('collector', pathlib.Path(__file__).parents[1]/'collect_gg.py')
collector=importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)

class CollectionFailureTests(unittest.TestCase):
    def test_first_failed_page_cancels_the_remaining_queue(self):
        started=[]
        def fetch(service, page, key, cancel=None):
            started.append(page)
            if page == 1: return 100000, [None]*1000
            if page == 2: raise RuntimeError('simulated failed page')
            if cancel.wait(1): raise RuntimeError('cancelled')
            return 100000, [None]*1000
        begin=time.monotonic()
        with patch.object(collector,'fetch_page',side_effect=fetch):
            with self.assertRaisesRegex(RuntimeError,'simulated failed page'):
                collector.collect('TEST','dummy-key')
        self.assertLess(len(started),10)
        self.assertLess(time.monotonic()-begin,2)

if __name__ == '__main__': unittest.main()
