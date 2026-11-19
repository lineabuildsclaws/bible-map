import sys,json,hashlib
if len(sys.argv) != 3:
 raise SystemExit('Usage: python3 scripts/build-walking-grid.py ne_50m_land.geojson ne_50m_lakes.geojson (requires shapely)')
from shapely.geometry import shape,Point,LineString
from shapely.ops import unary_union
from shapely.prepared import prep
land=unary_union([shape(f['geometry']) for f in json.load(open(sys.argv[1]))['features']])
lakes=unary_union([shape(f['geometry']) for f in json.load(open(sys.argv[2]))['features']])
land=land.difference(lakes);p=prep(land)
# 0.1 degree raster: conservative edges are tested separately below.
west,south,step,width,height=-20,0,.1,850,600
rows=[]
for y in range(height):
 rows.append(''.join('1' if p.covers(Point(west+x*step,south+y*step)) else '0' for x in range(width)))
# Store 8-way adjacency only for segments covered by land, preventing corners
# across narrow bays, lakes and peninsulas even when both cells are on land.
directions=[(1,0),(1,1),(0,1),(-1,1)]
edges=[]
for y,row in enumerate(rows):
 out=[]
 for x,c in enumerate(row):
  bits=0
  if c=='1':
   for i,(dx,dy) in enumerate(directions):
    xx,yy=x+dx,y+dy
    if 0<=xx<width and yy<height and rows[yy][xx]=='1' and p.covers(LineString([(west+x*step,south+y*step),(west+xx*step,south+yy*step)])):bits|=1<<i
  out.append(format(bits,'x'))
 edges.append(''.join(out))
json.dump(dict(west=west,south=south,step=step,width=width,height=height,rows=rows,edges=edges,sourceLandSha256=hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest(),sourceLakesSha256=hashlib.sha256(open(sys.argv[2],'rb').read()).hexdigest(),source='Natural Earth 1:50m land and lakes; public domain; retrieved 2026-10-24'),open('public/data/walking-grid.json','w'),separators=(',',':'))
