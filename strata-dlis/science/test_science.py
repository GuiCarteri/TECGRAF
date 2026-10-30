import unittest
import subprocess
import tempfile
from pathlib import Path
import numpy as np
from strata_science.metrics import compare,resample_to_grid,vdl_measures
from strata_science.classification import classify_impedance
from strata_science.reader import depth_to_m, load_aibk, load_cbl_vdl_dlis
class ScienceTests(unittest.TestCase):
 def test_original_dlis_reader(self):
  root=Path(__file__).resolve().parents[1]
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'synthetic.dlis'
   subprocess.run(['node',str(root/'tests/fixtures/dlis.mjs'),str(path)],check=True)
   a=load_aibk(path);self.assertEqual(a['values'].shape,(1201,36))
   self.assertEqual(a['depth_m'][0],1000);self.assertIsNone(a['metadata']['azimuth_axis'])
   v=load_cbl_vdl_dlis(path);self.assertEqual(v['vdl']['values'].shape,(1201,128))
   self.assertEqual(v['cbl']['values'][0],20)
 def test_metrics_unclipped(self):
  r=compare([1,2,20,-999.25],[2,1,22,0]);self.assertEqual(r['cells_compared'],3)
  self.assertAlmostEqual(r['bias'],2/3);self.assertAlmostEqual(r['mae'],4/3);self.assertAlmostEqual(r['rmse'],np.sqrt(2))
  self.assertIsNone(compare([1,1],[2,2])['correlation'])
 def test_gaps(self):
  d=np.array([0,1,10,11]);z=np.arange(8).reshape(4,2);original=z.copy()
  t,out=resample_to_grid(d,z,0,11,12);self.assertTrue(np.isnan(out[5]).all());np.testing.assert_array_equal(z,original)
  with self.assertRaises(ValueError):resample_to_grid([0,0],[[1],[2]],0,1)
 def test_missing_and_units(self):
  self.assertIsNone(classify_impedance(float('nan')));self.assertIsNone(classify_impedance(-2000))
  self.assertEqual(classify_impedance(2.6)['label'],'Ruim')
  np.testing.assert_allclose(depth_to_m([1000],'0.1 in'),[2.54])
  with self.assertRaises(ValueError):depth_to_m([1],'unknown')
 def test_time_not_guessed(self):
  with self.assertRaises(ValueError):vdl_measures([[1,2]],[],[0,1],[1,2])
  r=vdl_measures([[3,4,0,0]],[0,1,2,3],[0,2],[2,4]);self.assertAlmostEqual(r['casing_window_rms'][0],np.sqrt(12.5))
if __name__=='__main__':unittest.main()
