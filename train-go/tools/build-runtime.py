"""Pack the readable JavaScript sources for static hosting and enforce the 2 MB startup budget."""
import argparse
import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
sources = json.loads((ROOT/'runtime-sources.json').read_text('utf8'))
content = '\n;\n'.join((ROOT/name).read_text('utf8') for name in sources)
content += '\n;window.TRAIN_GO_READY = true;\n'
packed = gzip.compress(content.encode('utf8'), compresslevel=9, mtime=0)
target = ROOT/'runtime.js.gz'
assets = [s.split('?')[0] for s in re.findall(r'^  "([^"]+)",', (ROOT/'sw.js').read_text('utf8'), re.M) if s != '.']
total = sum(len(packed) if name == 'runtime.js.gz' else (ROOT/name).stat().st_size for name in set(assets))
assert total <= 2_000_000, f'Startup assets exceed 2 MB: {total:,} bytes'
if args.check:
    assert gzip.decompress(target.read_bytes()) == content.encode('utf8'), 'runtime.js.gz is stale'
else:
    target.write_bytes(packed)
print(f'Runtime: {len(packed):,} bytes; startup assets: {total:,} / 2,000,000 bytes')
