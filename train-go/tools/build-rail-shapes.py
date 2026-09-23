"""Match existing station courses to MLIT N02 track geometry (offline).

Requires shapely and pykakasi. Railway groups remain separate at geometrical
crossings: only source endpoints connect. Distances/stopping patterns in the
game are not changed by the map overlay.
"""
import argparse,collections,gzip,heapq,json,math,re,subprocess,unicodedata
from pathlib import Path
from functools import lru_cache
from shapely.geometry import LineString,Point
from shapely.strtree import STRtree
from pykakasi import kakasi
ROOT=Path(__file__).resolve().parents[1]
MX=111320*math.cos(math.radians(36));MY=111320
def xy(p):return (p[0]*MX,p[1]*MY)
def ll(p):return (p[0]/MX,p[1]/MY)
def normalize(text):
    text=unicodedata.normalize('NFKC',text).replace('〈','(').replace('〉',')')
    text=re.sub(r'[（(].*?[）)]|付近|駅$','',text)
    text=text.replace('モノレール浜松町','浜松町').replace('神戸三宮','三宮')
    def number(match):
        value=match[0];digits={c:i for i,c in enumerate('〇一二三四五六七八九')}
        if '十' in value:
            a,b=value.split('十');return str((digits.get(a,1))*10+digits.get(b,0))
        return ''.join(str(digits[c]) for c in value)
    text=re.sub(r'[一二三四五六七八九十]+(?=丁目|条)',number,text)
    return text.replace('ヶ','ケ').replace('ヵ','カ').replace('ッ','ツ').replace(' ','').replace('　','')
converter=kakasi()
@lru_cache(None)
def reading(text):return normalize(''.join(v['hira'] for v in converter.convert(text)))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path);parser.add_argument('--output',type=Path,default=ROOT/'data/rail-shapes.json');args=parser.parse_args()
    if not args.source:
        payload=json.loads(args.output.read_text('utf8'));template=(ROOT/'tools/rail-shape-runtime.js').read_text('utf8')
        (ROOT/'rail-shape-data.js').write_text(template.replace('/* RAIL_SHAPES */',json.dumps(payload,separators=(',',':'))),encoding='utf8',newline='\n')
        print('Regenerated rail shapes from the offline snapshot');return
    supplements={(v['route'],v['segment']):v for v in json.loads((ROOT/'data/rail-shape-supplements.json').read_text('utf8'))}
    station_overrides=json.loads((ROOT/'data/rail-shape-station-overrides.json').read_text('utf8'))
    inputs=json.loads(subprocess.check_output(['node',str(ROOT/'tools/rail-shape-input.cjs')]))
    sections=json.loads((args.source/'N02-25_RailroadSection.geojson').read_text('utf8'))['features']
    stations=json.loads((args.source/'N02-25_Station.geojson').read_text('utf8'))['features']
    groups=[];group_ids={};edges=[];group_edges=collections.defaultdict(list);graph=collections.defaultdict(list)
    def group(properties):
        key=(properties['N02_004'],properties['N02_003'])
        if key not in group_ids:group_ids[key]=len(groups);groups.append(key)
        return group_ids[key]
    def vertex(point):return tuple(round(v,6) for v in point)
    endpoints={vertex(p) for f in sections for p in [f['geometry']['coordinates'][0],f['geometry']['coordinates'][-1]]}
    for f in sections:
        gid=group(f['properties']);coords=f['geometry']['coordinates']
        splits=[0,*[i for i in range(1,len(coords)-1) if vertex(coords[i]) in endpoints],len(coords)-1]
        for first,last in zip(splits,splits[1:]):
            line=LineString([xy(p) for p in coords[first:last+1]])
            if line.length==0:continue
            a,b=vertex(coords[first]),vertex(coords[last]);eid=len(edges)
            edges.append((a,b,line,gid));group_edges[gid].append(eid)
            graph[a].append((b,eid,line.length));graph[b].append((a,eid,line.length))
    # Some adjacent source sections differ by centimetres after digitisation.
    # Repair only paired dangling endpoints within the same railway, below the
    # display simplification tolerance; never node arbitrary line crossings.
    repairs=[]
    for gid,ids in list(group_edges.items()):
        neighbors=collections.defaultdict(set)
        for eid in ids:
            a,b,_,_=edges[eid];neighbors[a].add(b);neighbors[b].add(a)
        ends=[n for n,others in neighbors.items() if len(others)==1]
        tree=STRtree([Point(xy(n)) for n in ends]);pairs=[]
        for i,node in enumerate(ends):
            point=Point(xy(node))
            for j in tree.query(point.buffer(15)):
                if j<=i:continue
                dist=point.distance(tree.geometries[j])
                if dist<=15 and ends[j] not in neighbors[node]:pairs.append((dist,node,ends[j]))
        used=set()
        for dist,a,b in sorted(pairs):
            if a in used or b in used:continue
            used.update([a,b]);line=LineString([xy(a),xy(b)]);eid=len(edges)
            edges.append((a,b,line,gid));group_edges[gid].append(eid)
            graph[a].append((b,eid,dist));graph[b].append((a,eid,dist));repairs.append([groups[gid],a,b,round(dist,3)])
    trees={gid:STRtree([edges[e][2] for e in ids]) for gid,ids in group_edges.items()}
    station_index=collections.defaultdict(list)
    for f in stations:
        p=f['properties'];gid=group(p)
        if gid not in trees:continue
        line=LineString([xy(v) for v in f['geometry']['coordinates']]);point=line.interpolate(.5,normalized=True)
        local=int(trees[gid].nearest(point));eid=group_edges[gid][local];edge=edges[eid][2]
        offset=edge.project(point);snapped=edge.interpolate(offset)
        record=(gid,eid,offset,(snapped.x,snapped.y),p['N02_005'])
        for name in {normalize(p['N02_005']),reading(p['N02_005'])}:station_index[name].append(record)
    def candidates(point,shinkansen,hint=None):
        names={normalize(point[4]),normalize(point[0]),reading(point[4])}
        records={ (r[0],r[1]):r for name in names for r in station_index.get(name,[]) }
        position=xy(hint or point[2:4]);result=[]
        for record in records.values():
            dist=math.dist(position,record[3])
            if dist>8000:continue
            if ('新幹線' in groups[record[0]][1])!=shinkansen:continue
            result.append((dist,record))
        return result
    @lru_cache(maxsize=None)
    def connect(start,end,allowed):
        sg,se,so,sp,_=start;tg,te,to,tp,_=end
        if se==te:
            line=edges[se][2];coords=list(line.coords)
            from shapely.ops import substring
            return list(substring(line,so,to).coords)
        a,b,line,_=edges[se];c,d,target,_=edges[te]
        goals={c:to,d:target.length-to};dist={a:so,b:line.length-so};previous={};queue=[(v,k) for k,v in dist.items()];heapq.heapify(queue)
        found=None;best=float('inf');limit=max(math.dist(sp,tp)*6,3000)
        while queue:
            cost,node=heapq.heappop(queue)
            if cost!=dist[node]:continue
            if cost>min(best,limit):break
            if node in goals and cost+goals[node]<best:found=node;best=cost+goals[node]
            for nxt,eid,weight in graph[node]:
                if edges[eid][3] not in allowed:continue
                candidate=cost+weight
                if candidate<dist.get(nxt,float('inf')):
                    dist[nxt]=candidate;previous[nxt]=(node,eid);heapq.heappush(queue,(candidate,nxt))
        if found is None:return None
        chain=[];node=found
        while node in previous:
            old,eid=previous[node];chain.append((old,node,eid));node=old
        from shapely.ops import substring
        path=list(substring(line,so,0 if node==a else line.length).coords)
        for old,nxt,eid in reversed(chain):
            u,v,edge,_=edges[eid];coords=list(edge.coords)
            if old!=u:coords.reverse()
            path.extend(coords[1:])
        tail=list(substring(target,0 if found==c else target.length,to).coords);path.extend(tail[1:])
        return path
    bank=[];bank_index={};routes={};report={};missing=[];total=matched=0
    def encode(coords):
        line=LineString(coords).simplify(30,preserve_topology=False)
        values=[]
        for x,y in line.coords:
            point=(round(x/MX*10000),round(y/MY*10000))
            if not values or point!=values[-1]:values.append(point)
        if len(values)<2:return None
        values=tuple(values);reverse=values>tuple(reversed(values));canonical=tuple(reversed(values)) if reverse else values
        if canonical not in bank_index:
            bank_index[canonical]=len(bank)+1;packed=[];last=(0,0)
            for x,y in canonical:packed.extend([x-last[0],y-last[1]]);last=(x,y)
            bank.append(packed)
        return -bank_index[canonical] if reverse else bank_index[canonical]
    for key,route in inputs.items():
        points=route['points'];shinkansen='新幹線' in route['title'] and key not in {'akita','yamagata','railLine1006'}
        hints=station_overrides.get(key,{})
        choices=[candidates(point,shinkansen,hints.get(point[0],{}).get('position')) for point in points]
        counts=collections.Counter(g for records in choices for g in {r[1][0] for r in records})
        allowed=frozenset(g for g,count in counts.items() if count>=max(1,max(counts.values(),default=0)*.12))
        # New stations can postdate the shape snapshot; project their existing
        # surveyed coordinates onto the same railway group, never a remote line.
        for i,records in enumerate(choices):
            if records:continue
            point=Point(xy(points[i][2:4]));near=[]
            for gid in allowed or trees.keys():
                if ('新幹線' in groups[gid][1])!=shinkansen:continue
                eid=group_edges[gid][int(trees[gid].nearest(point))];line=edges[eid][2]
                offset=line.project(point);snapped=line.interpolate(offset);dist=point.distance(snapped)
                if dist<400:near.append((dist,(gid,eid,offset,(snapped.x,snapped.y),points[i][4])))
            choices[i]=near
        # The strongest route-wide group match resolves shared station names.
        selected=[min(records,key=lambda r:r[0]+(max(counts.values(),default=0)-counts[r[1][0]])*120)[1] if records else None for records in choices]
        refs=[];failures=[];shapes=[]
        for i,(start,end) in enumerate(zip(selected,selected[1:])):
            shape=None
            if start and end:
                shape=connect(start,end,allowed|{start[0],end[0]})
                if not shape:
                    pairs=sorted(((a[0]+b[0],a[1],b[1]) for a in choices[i] for b in choices[i+1]),key=lambda v:v[0])
                    for _,other_start,other_end in pairs:
                        shape=connect(other_start,other_end,allowed|{other_start[0],other_end[0]})
                        if shape:break
            if (key,i) in supplements:shape=[xy(p) for p in supplements[(key,i)]['points']]
            shapes.append(shape)
        # Resolve platform alternatives together if independently routed legs
        # would jump across a large station (e.g. Tokyo surface vs underground).
        if any(a and b and math.dist(a[-1],b[0])>25 for a,b in zip(shapes,shapes[1:])):
            states={record:(distance*3,[]) for distance,record in choices[0]}
            for i in range(1,len(choices)):
                next_states={}
                for distance,record in choices[i]:
                    options=[]
                    for previous_record,(cost,previous_shapes) in states.items():
                        shape=connect(previous_record,record,allowed|{previous_record[0],record[0]})
                        if shape and len(shape)>1:options.append((cost+LineString(shape).length+distance*3,previous_shapes+[shape]))
                    if options:next_states[record]=min(options,key=lambda v:v[0])
                states=next_states
            if states:shapes=min(states.values(),key=lambda v:v[0])[1]
        for i,shape in enumerate(shapes):
            total+=1
            ref=encode(shape) if shape and len(shape)>1 else None
            refs.append(ref or 0)
            if ref:matched+=1
            else:
                failures.append([i,points[i][0],points[i+1][0], 'station' if not selected[i] or not selected[i+1] else 'connection'])
        routes[key]=refs;report[key]={'title':route['title'],'matched':len(refs)-len(failures),'total':len(refs),'missing':failures}
        missing.extend([key,*failure] for failure in failures)
    payload={'precision':10000,'segments':bank,'routes':routes}
    args.output.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
    (args.output.parent/'rail-shape-coverage.json').write_text(json.dumps({'matched':matched,'total':total,'endpointRepairs':repairs,'routes':report},ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
    template=(ROOT/'tools/rail-shape-runtime.js').read_text('utf8')
    (ROOT/'rail-shape-data.js').write_text(template.replace('/* RAIL_SHAPES */',json.dumps(payload,separators=(',',':'))),encoding='utf8',newline='\n')
    print('matched',matched,'/',total,'segments',len(bank),'gzip',len(gzip.compress(json.dumps(payload,separators=(',',':')).encode(),mtime=0)))
    print('missing',json.dumps(missing[:40],ensure_ascii=False))
if __name__=='__main__':main()
