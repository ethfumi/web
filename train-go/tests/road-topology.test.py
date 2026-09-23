"""Offline checks for the road importer; run with Python unittest."""
import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('roads',Path(__file__).resolve().parents[1]/'tools/build-roads.py')
roads=importlib.util.module_from_spec(spec);spec.loader.exec_module(roads)
def node(id,x,y):return {'type':'node','id':id,'lon':x,'lat':y}
def way(id,nodes,**tags):return {'type':'way','id':id,'nodes':nodes,'tags':{'highway':'trunk',**tags}}
class TopologyTests(unittest.TestCase):
    def test_sea_gap_and_steps_never_join_driveable_sections(self):
        elements=[node(1,139,35),node(2,139.1,35),node(3,139.2,35),node(4,139.3,35),
          way(1,[1,2]),way(2,[3,4]),way(3,[2,3],highway='steps'),way(4,[2,3],route='ferry')]
        self.assertEqual(len(roads.longest_courses(elements)),2)
    def test_bridge_crossing_is_not_a_junction_without_a_shared_node(self):
        elements=[node(1,139,35),node(2,139.2,35),node(3,139.1,34.9),node(4,139.1,35.1),way(1,[1,2]),way(2,[3,4])]
        self.assertEqual(len(roads.longest_courses(elements)),2)
    def test_connected_road_is_preserved_and_private_spur_excluded(self):
        elements=[node(1,139,35),node(2,139.1,35.02),node(3,139.2,35),node(4,139.1,36),
          way(1,[1,2]),way(2,[2,3]),way(3,[2,4],access='private')]
        courses=roads.longest_courses(elements)
        self.assertEqual(len(courses),1)
        self.assertLess(courses[0][0],20)
        self.assertEqual({courses[0][1],courses[0][2]},{(139,35),(139.2,35)})
    def test_parallel_carriageways_do_not_create_duplicate_choices(self):
        elements=[node(1,139,35),node(2,139.1,35),node(3,139,35.0002),node(4,139.1,35.0002),way(1,[1,2]),way(2,[3,4])]
        self.assertEqual(len(roads.longest_courses(elements)),1)
if __name__=='__main__':unittest.main()
