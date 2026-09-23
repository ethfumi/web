"""Build offline driving courses from cached OSM relation/full responses.

Use original OSM node identities for connectivity: crossing bridges are not
junctions, and disconnected islands/construction gaps remain separate courses.
Courses follow a long shortest path in each connected component, rather than
traversing every lane, ramp and spur. They are a driving game, not navigation.
"""
import argparse,gzip,heapq,json,math,re
from pathlib import Path
from collections import defaultdict
from shapely.geometry import LineString
from pykakasi import kakasi

ROOT=Path(__file__).resolve().parents[1]
converter=kakasi()
ROAD_READINGS={'環七通り':'かんななどおり','環八通り':'かんぱちどおり','山手通り':'やまてどおり','明治通り':'めいじどおり',
  '内堀通り':'うちぼりどおり','外堀通り':'そとぼりどおり','目白通り':'めじろどおり','青梅街道':'おうめかいどう',
  '新青梅街道':'しんおうめかいどう','五日市街道':'いつかいちかいどう','井の頭通り':'いのかしらどおり','東八道路':'とうはちどうろ'}
def kana(text):
    if text in ROAD_READINGS:return ROAD_READINGS[text]
    text=text.replace('竹田市会々','たけたしあいあい')
    text=text.replace('環七','かんなな').replace('環八','かんぱち').replace('ふ頭','ふとう').replace('埠頭','ふとう')
    return ''.join(x['hira'] for x in converter.convert(text)).replace('付近','ふきん')
def distance(a,b):
    return math.hypot((a[0]-b[0])*math.cos(math.radians((a[1]+b[1])/2)),a[1]-b[1])*111.32
def relation_elements(cache,id,seen=None):
    seen=set() if seen is None else seen
    if id in seen:return []
    seen.add(id)
    file=cache/f'{id}.json.gz'
    if not file.exists():raise FileNotFoundError(file)
    elements=json.loads(gzip.decompress(file.read_bytes()))['elements']
    root=next(e for e in elements if e['type']=='relation' and e['id']==id)
    for m in root.get('members',[]):
        if m['type']=='relation':elements.extend(relation_elements(cache,m['ref'],seen))
    return elements
def longest_courses(elements):
    nodes={e['id']:e for e in elements if e['type']=='node'}
    coords={id:(n['lon'],n['lat']) for id,n in nodes.items()}
    graph=defaultdict(dict)
    excluded={'footway','path','steps','cycleway','pedestrian','construction','proposed','bridleway','track','service'}
    for e in {e['id']:e for e in elements if e['type']=='way'}.values():
        t=e.get('tags',{})
        if not t.get('highway') or t['highway'] in excluded or t.get('route')=='ferry':continue
        if t.get('access') in ('no','private') or t.get('motor_vehicle')=='no' or t.get('motorcar')=='no':continue
        for a,b in zip(e['nodes'],e['nodes'][1:]):
            if a not in coords or b not in coords or a==b:continue
            w=distance(coords[a],coords[b])
            if w==0:continue
            graph[a][b]=w;graph[b][a]=w
    def farthest(start):
        distances={start:0};previous={};queue=[(0,start)]
        while queue:
            d,u=heapq.heappop(queue)
            if d!=distances[u]:continue
            for v,w in graph[u].items():
                nd=d+w
                if nd<distances.get(v,float('inf')):
                    distances[v]=nd;previous[v]=u;heapq.heappush(queue,(nd,v))
        end=max(distances,key=distances.get)
        return end,distances,previous
    remaining=set(graph);courses=[]
    while remaining:
        start,visited,_=farthest(min(remaining));remaining.difference_update(visited)
        end,lengths,previous=farthest(start)
        path=[end]
        while path[-1]!=start:path.append(previous[path[-1]])
        path.reverse()
        if len(path)>1:courses.append((lengths[end],path))
    courses.sort(reverse=True)
    if not courses:return []
    # Tiny detached fragments of ramps are not useful selectable courses.
    minimum=min(.5,courses[0][0]*.03)
    result=[];accepted=[]
    for km,path in courses:
        if km<minimum:continue
        points=[coords[n] for n in path]
        if points[0]>points[-1]:points.reverse();path.reverse()
        mx=111320*math.cos(math.radians(sum(p[1] for p in points)/len(points)))
        simple=LineString([(p[0]*mx,p[1]*111320) for p in points]).simplify(35,preserve_topology=False)
        geographic=LineString([(x/mx,y/111320) for x,y in simple.coords])
        # Separate carriageways of the same road need only one reversible course.
        # This removes duplicate choices; it never joins disconnected geometry.
        if any(min(km,other_km)/max(km,other_km)>.9 and geographic.hausdorff_distance(other)<.0012 for other_km,other in accepted):continue
        accepted.append((km,geographic))
        delta=[];last=(0,0)
        for x,y in simple.coords:
            p=(round(x/mx*10000),round(y/111320*10000))
            if p==last:continue
            delta.extend((p[0]-last[0],p[1]-last[1]));last=p
        if len(delta)<4:continue
        named=[(coords[n],nodes[n].get('tags',{}).get('name')) for n in path if nodes[n].get('tags',{}).get('name')]
        result.append((km,points[0],points[-1],delta,named))
    return result
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--cache',type=Path);parser.add_argument('--inventory',type=Path);parser.add_argument('--partial',action='store_true');args=parser.parse_args()
    if not args.cache:
        roads=json.loads((ROOT/'data/road-network.json').read_text('utf8'))['roads']
        template=(ROOT/'tools/road-runtime.js').read_text('utf8')
        (ROOT/'road-route-data.js').write_text(template.replace('/* ROAD_RECORDS */',json.dumps(roads,ensure_ascii=False,separators=(',',':'))),encoding='utf8',newline='\n')
        print('Regenerated',len(roads),'roads from the offline snapshot');return
    if not args.inventory:parser.error('--inventory is required with --cache')
    selected=json.loads(args.inventory.read_text('utf8'))
    stations=json.loads((ROOT/'data/station-database.json').read_text('utf8'))['stations'].values()
    station_cells=defaultdict(list)
    for station in stations:
        if not station[5]:station_cells[(round(station[2]*10),round(station[3]*10))].append(station)
    # Collapse duplicate route relations and opposite carriageways by road name.
    groups={}
    for row in selected:
        # The discovery bounding box also intersects northeastern China.
        if row['id'] in {6616578,19725778,19725828}:continue
        name=re.sub(r'[（(]?(上り|下り|北行き|南行き|東行き|西行き)[）)]?','',row['name']).strip()
        if row['category']=='tokyo' and re.search('旧道|支線',name):continue
        key=(row['category'],name)
        groups.setdefault(key,[]).append(row)
    roads=[];failures=[]
    for (category,title),rows in groups.items():
        try:
            elements=[]
            for id in sorted(set(r['id'] for r in rows)):elements.extend(relation_elements(args.cache,id))
            courses=longest_courses(elements)
            packed=[]
            for km,start,end,delta,named in courses:
                labels=[]
                for p,side in [(start,'西側'),(end,'東側')]:
                    if abs(end[1]-start[1])>abs(end[0]-start[0]):side='南側' if p[1]<((start[1]+end[1])/2) else '北側'
                    nearest=min(named,key=lambda v:distance(p,v[0]),default=None)
                    if nearest and distance(p,nearest[0])<1:
                        label=nearest[1]+'付近';reading=kana(nearest[1])+'ふきん'
                    else:
                        x,y=round(p[0]*10),round(p[1]*10)
                        candidates=[s for dx in [-1,0,1] for dy in [-1,0,1] for s in station_cells[(x+dx,y+dy)]]
                        station=min(candidates,key=lambda s:distance(p,s[2:4]),default=None)
                        if station and distance(p,station[2:4])<3:
                            label=station[0]+'駅付近';reading=station[1]+'えきふきん'
                        else:label=side;reading=kana(side)
                    labels.extend((label,reading))
                if labels[0]==labels[2]:labels=['西側','にしがわ','東側','ひがしがわ']
                packed.append(labels+[delta])
            if packed:roads.append([rows[0]['id'],category,title,kana(title),packed,sorted(set(r['id'] for r in rows)),sorted({r.get('ref','') for r in rows if r.get('ref')})])
            else:failures.append([title,'no drivable geometry'])
        except FileNotFoundError as e:failures.append([title,str(e)])
    if failures and not args.partial:raise RuntimeError(f'{len(failures)} missing roads: {failures[:10]}')
    payload={'source':'OpenStreetMap contributors, ODbL 1.0','simplificationMeters':35,'roads':roads}
    target=ROOT/'data/road-network.json';target.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    template=(ROOT/'tools/road-runtime.js').read_text('utf8')
    (ROOT/'road-route-data.js').write_text(template.replace('/* ROAD_RECORDS */',json.dumps(roads,ensure_ascii=False,separators=(',',':'))),encoding='utf8',newline='\n')
    print(json.dumps({'roads':len(roads),'courses':sum(len(r[4]) for r in roads),'categories':{c:sum(r[1]==c for r in roads) for c in ['national','expressway','tokyo','regional']},'missing':failures},ensure_ascii=False))
if __name__=='__main__':main()
