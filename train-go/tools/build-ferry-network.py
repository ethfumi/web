"""Compile port-to-port game courses from the pinned OSM ferry geometry and port labels."""
import collections
import heapq
import json
import math
import re
import zlib
from pathlib import Path
import pykakasi

ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'data/ferry-source.json').read_text('utf8'))
overrides=json.loads((ROOT/'data/ferry-overrides.json').read_text('utf8'))
def distance(a,b):
    rad=math.pi/180
    return 12742*math.asin(min(1,math.sqrt(math.sin((a[1]-b[1])*rad/2)**2+math.cos(a[1]*rad)*math.cos(b[1]*rad)*math.sin((a[0]-b[0])*rad/2)**2)))
def name(tags):
    for field in ('name:ja','name','seamark:name'):
        value=tags.get(field,'')
        if value and not re.search(r'[\u0400-\u052f\uac00-\ud7af]',value) and not re.fullmatch(r'[\d\s-]+',value):
            return value
    return ''
def coord(p):return tuple(round(x,6) for x in p)
def clean(text):
    text=re.sub(r'\s+',' ',text.replace('name=','')).strip()
    return overrides.get('portAliases',{}).get(text,text)
def exclusion(tags):
    if tags.get('access') in ('private','no'):return 'not-public-passenger'
    if any(tags.get(k) in ('yes','true') for k in ('disused','abandoned','demolished')):return 'inactive'
    title=' '.join(tags.get(k,'') for k in ('name','name:ja','from','to','operator'))
    if re.search('釜山|부산|동해|上海|基隆|Keelong|Busan|コルサコフ|Beetle|ビートル|Camellia|カメリア',title):return 'international'
    if re.search('ディズニー|Disney|スプラッシュ|ジャングルクルーズ|マークトウェイン|トムズ|セトラーズ|ヴェネツィアン|点検船|万博|廃止|いかだ渡り|海上タクシー|民宿.*送迎',title):return 'inactive-or-attraction'
    return ''

ports=source['ports']+overrides.get('ports',[])
official=source['officialPortLabels']
cells=collections.defaultdict(list)
for p in ports:
    cells[(int(p['p'][0]*100),int(p['p'][1]*100))].append(p)
def nearby(p):
    x,y=int(p[0]*100),int(p[1]*100)
    return [v for i in range(x-1,x+2) for j in range(y-1,y+2) for v in cells[(i,j)]]
def label(point,hint,leaf=False,terminal=False):
    close=sorted([(distance(point,p['p']),p) for p in nearby(point) if name(p['tags'])],key=lambda v:v[0])
    # Terminal names outrank a marina or a harbour centroid on the other side of a bay.
    for d,p in sorted(close,key=lambda v:(not v[1]['terminal'],v[0])):
        if d<(.45 if leaf or terminal else .12):return clean(name(p['tags'])),p['id'],p.get('tags',{}).get('name:ja-Hira','')
    choices=sorted([(distance(point,p['p']),p) for p in official],key=lambda v:v[0])
    for d,p in choices:
        match=len(p['name'])>=2 and p['name'] in hint
        if d < (.9 if leaf or terminal else .16) or ((leaf or terminal) and match and d<6):
            title=p['name'] if p['name'].endswith(('港','桟橋','船着場')) else p['name']+'港'
            return title,'s10a:'+p['name'],''
    return None

excluded=[];groups=[];members=set()
for r in source['relations']:
    key='r'+r['id'];members.update(r['members'])
    reason=overrides.get('exclude',{}).get(key) or exclusion(r['tags'])
    if reason:excluded.append([key,reason]);continue
    kept=[]
    for member in r['members']:
        reason=overrides.get('exclude',{}).get('w'+member)
        if reason:excluded.append(['w'+member,reason])
        else:kept.append(member)
    groups.append((key,r['tags'],kept))
named=collections.defaultdict(list)
for key,w in source['ways'].items():
    if key in members:continue
    reason=overrides.get('exclude',{}).get('w'+key) or exclusion(w['tags'])
    if reason:excluded.append(['w'+key,reason]);continue
    named[name(w['tags'])].append(key)
for title,ids in named.items():groups.append(('w'+min(ids,key=int),source['ways'][ids[0]]['tags'],ids))

courses=[];unresolved=[]
allowed={}
for _,tags,ids in groups:
    for way_id in ids:allowed[way_id]={**tags,**source['ways'][way_id]['tags']}
endpoint_set={coord(source['ways'][i]['points'][k]) for i in allowed for k in (0,-1)}
graph=collections.defaultdict(list);terminal_points=set();segments={}
for way_id in allowed:
    line=source['ways'][way_id]['points']
    if len(line)<2:continue
    stops={0,len(line)-1};nearest={}
    for i,point in enumerate(line):
        if coord(point) in endpoint_set:stops.add(i)
        for p in nearby(point):
            d=distance(point,p['p'])
            if 0<i<len(line)-1 and (not p['terminal'] or d>.005):
                before,after=line[i-1],line[i+1]
                ax,ay=(point[0]-before[0])*91,(point[1]-before[1])*111
                bx,by=(after[0]-point[0])*91,(after[1]-point[1])*111
                # Unmapped terminal nodes on out-and-back calls (e.g. Kitadaito) have a sharp reversal at the berth.
                denom=math.hypot(ax,ay)*math.hypot(bx,by)
                if not denom or (ax*bx+ay*by)/denom>-.3:continue
            threshold=.05 if p['terminal'] else .15
            if d<threshold and (p['id'] not in nearest or d<nearest[p['id']][0]):nearest[p['id']]=(d,i)
    for _,i in nearest.values():stops.add(i);terminal_points.add(coord(line[i]))
    stops=sorted(stops)
    for start,end in zip(stops,stops[1:]):
        segment=line[start:end+1];a,b=coord(segment[0]),coord(segment[-1])
        length=sum(distance(p,q) for p,q in zip(segment,segment[1:]))
        if a==b or length<.01:continue
        segment_id=f'{way_id}:{start}:{end}'
        segments[segment_id]=segment
        graph[a].append((b,length,segment,way_id,segment_id));graph[b].append((a,length,segment[::-1],way_id,segment_id))
labels={}
for point,edges in graph.items():
    leaf=len({e[0] for e in edges})==1
    ids=sorted({e[3] for e in edges},key=int)
    hint=' '.join(' '.join([name(allowed[i]),allowed[i].get('from',''),allowed[i].get('to','')]) for i in ids)
    result=label(point,hint,leaf,point in terminal_points) if leaf or point in terminal_points else None
    if result:labels[point]=result
    elif leaf:unresolved.append({'group':'w'+ids[0],'name':name(allowed[ids[0]]),'point':point,'sourceWays':ids})
for origin in labels:
    queue=[(0,origin,[list(origin)],[])];visited=set()
    while queue:
        km,point,path,used=heapq.heappop(queue)
        if point in visited:continue
        visited.add(point)
        if point!=origin and point in labels and labels[origin][0]!=labels[point][0]:
            if origin<point and km>.05:
                ids=sorted({s.split(':')[0] for s in used},key=int)
                titles=list(dict.fromkeys(name(allowed[i]) for i in ids if name(allowed[i])))
                courses.append({'source':'w'+ids[0],'sourceWays':ids,'segments':used,'name':' / '.join(titles),
                                'start':labels[origin],'end':labels[point],'points':path,'km':km})
            continue
        for nxt,length,segment,way_id,segment_id in graph[point]:
            if nxt not in visited:heapq.heappush(queue,(km+length,nxt,path+segment[1:],used+[segment_id]))

# Opposite directions and parallel services become one geographic course, preserving the shortest source geometry.
unique={}
def port_key(title,p):return (title,round(p[0],2),round(p[1],2))
for c in courses:
    key=tuple(sorted([port_key(c['start'][0],c['points'][0]),port_key(c['end'][0],c['points'][-1])]))
    if key not in unique or c['km']<unique[key]['km']:unique[key]=c
courses=list(unique.values())

converter=pykakasi.kakasi()
def reading(title,provided=''):
    return overrides.get('readings',{}).get(title) or provided or ''.join(t['hira'] for t in converter.convert(title))
def simplify(points,tolerance=.035):
    if len(points)<=2:return points
    a,b=points[0],points[-1];dx=(b[0]-a[0])*91;dy=(b[1]-a[1])*111;den=dx*dx+dy*dy
    values=[]
    for p in points[1:-1]:
        px=(p[0]-a[0])*91;py=(p[1]-a[1])*111;t=max(0,min(1,(px*dx+py*dy)/den)) if den else 0
        values.append(math.hypot(px-dx*t,py-dy*t))
    peak=max(values,default=0)
    if peak<=tolerance:return [a,b]
    i=values.index(peak)+1
    return simplify(points[:i+1],tolerance)[:-1]+simplify(points[i:],tolerance)

def encode(points):
    encoded=[];x=y=0
    for point in simplify(points):
        lon,lat=round(point[0]*100000),round(point[1]*100000)
        encoded.extend([lon-x,lat-y]);x,y=lon,lat
    return encoded

output_ports=[];port_lookup={};output_routes=[]
for c in sorted(courses,key=lambda c:(c['source'],c['start'][0],c['end'][0])):
    ends=[]
    for data,point in [(c['start'],c['points'][0]),(c['end'],c['points'][-1])]:
        key=port_key(data[0],point)
        if key not in port_lookup:
            port_lookup[key]=len(output_ports)
            output_ports.append([data[0],reading(data[0],data[2]),round(point[0],5),round(point[1],5)])
        ends.append(port_lookup[key])
    encoded=encode(c['points'])
    identity=str(sorted([port_key(c['start'][0],c['points'][0]),port_key(c['end'][0],c['points'][-1])]))
    key=c['source']+'_'+format(zlib.crc32(identity.encode('utf8')),'08x')
    output_routes.append([key,*ends,round(c['km'],3),encoded,c['name']])
covered={segment for c in courses for segment in c['segments']}
context=[[key,encode(points)] for key,points in segments.items() if key not in covered]
payload={'ports':output_ports,'routes':output_routes,'context':context}
(ROOT/'data/ferry-network.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
runtime=(ROOT/'tools/ferry-network-runtime.js').read_text('utf8')
(ROOT/'all-ferry-route-data.js').write_text('// Generated by tools/build-ferry-network.py. Sources: data/transport-network.md\n'
    +'(() => {\n const {ports,routes,context} = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n'+runtime+'\n})();\n',encoding='utf8',newline='\n')
coverage={'sourceWays':len(source['ways']),'sourceRelations':len(source['relations']),'courses':len(courses),'ports':len(output_ports),
          'referenceSegments':len(context),'excluded':excluded,'unresolvedEndpoints':unresolved,'provenance':[{'key':r[0],'source':c['source'],'ways':c['sourceWays']} for r,c in zip(output_routes,sorted(courses,key=lambda c:(c['source'],c['start'][0],c['end'][0])))]}
(ROOT/'data/ferry-coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print('courses',len(courses),'ports',len(output_ports),'unresolved endpoints',len(unresolved),'excluded',len(excluded))
