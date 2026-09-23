"""Pack the readable JavaScript sources for static hosting and enforce the startup size limit."""
import argparse
import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
parser.add_argument('--optimize', action='store_true', help='Use optional zopfli for a smaller compatible gzip')
args = parser.parse_args()
sources = json.loads((ROOT/'runtime-sources.json').read_text('utf8'))
content = '\n;\n'.join((ROOT/name).read_text('utf8') for name in sources)
content += '\n;window.TRAIN_GO_READY = true;\n'
target = ROOT/'runtime.js.gz'
if args.check:
    packed = target.read_bytes()
    assert gzip.decompress(packed) == content.encode('utf8'), 'runtime.js.gz is stale'
elif args.optimize:
    import zopfli.gzip
    packed = zopfli.gzip.compress(content.encode('utf8'), numiterations=5)
else:
    packed = gzip.compress(content.encode('utf8'), compresslevel=9, mtime=0)
assets = [s.split('?')[0] for s in re.findall(r'^  "([^"]+)",', (ROOT/'sw.js').read_text('utf8'), re.M) if s != '.']
total = sum(len(packed) if name == 'runtime.js.gz' else (ROOT/name).stat().st_size for name in set(assets))
assert total <= 3_200_000, f'Startup assets exceed 3.2 MB: {total:,} bytes'
if not args.check:
    target.write_bytes(packed)
print(f'Runtime: {len(packed):,} bytes; startup assets: {total:,} / 3,200,000 bytes')
