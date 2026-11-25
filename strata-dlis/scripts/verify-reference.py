"""Compare every numeric sample with independent dlisio; never writes DLIS data to the repo.
Usage: python scripts/verify-reference.py /authorized/local/data-directory
Requires dlisio 1.0.4 and numpy. Output is aggregate JSON, no well metadata.
"""
import hashlib
import json
import subprocess
import argparse
from pathlib import Path
import numpy as np
from dlisio import dlis

def digest(a):
    a = np.asarray(a, dtype='<f8').copy().ravel()
    a[np.isnan(a)] = np.nan  # canonical quiet NaN
    return hashlib.sha256(a.tobytes()).hexdigest()

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
args=parser.parse_args()
if not args.directory.is_dir():parser.error('Directory does not exist')
seen, reports = set(), []
for path in sorted(args.directory.glob('*')):
    if path.suffix.lower() != '.dlis':
        continue
    fingerprint = hashlib.sha256(path.read_bytes()).hexdigest()
    if fingerprint in seen:
        continue
    seen.add(fingerprint)
    completed = subprocess.run(['node', 'scripts/reference-digest.mjs', str(path)],
        check=True, capture_output=True, text=True)
    actual = json.loads(completed.stdout)
    reference = []
    catalog = actual['catalog']
    frames = {(r['lf'],r['frame']): r for r in catalog['frames']}
    preview = catalog['thumbnail']
    valid_preview_points = 0
    with dlis.load(str(path)) as files:
        for lf, logical in enumerate(files):
            origins = [[o.well_name or '',o.field_name or '',o.creation_time.isoformat(timespec='milliseconds') if o.creation_time else None] for o in logical.origins]
            assert sorted(origins)==sorted(catalog['origins'][lf]), 'Divergência em ORIGIN'
            tools = [[t.name,t.generic_name or '',t.trademark_name or ''] for t in logical.tools]
            assert sorted(tools)==sorted(catalog['tools'][lf]), 'Divergência em TOOL'
            for frame in logical.frames:
                curves = frame.curves()
                frame_key = f'{frame.origin}/{frame.copynumber}/{frame.name}'
                v = frames[lf,frame_key]
                assert v['ok'] and v['samples']==len(curves), 'Contagem de linhas divergente'
                if v['depth']:
                    if frame.index_type in ('BOREHOLE-DEPTH','VERTICAL-DEPTH'):
                        assert v['depth']==frame.channels[0].name, 'Índice físico divergente'
                    depth = next(c for c in frame.channels if c.name==v['depth'])
                    factor={'m':1,'mm':.001,'cm':.01,'ft':.3048,'in':.0254,'0.1in':.00254,'0.1ft':.03048}[''.join(depth.units.lower().split())]
                    original = np.asarray(curves[depth.name],dtype=np.float64).reshape(-1)
                    valid=original[np.isfinite(original) & ~np.isin(original,[-999.25,-9999.25,-99999,-9999,-2000])]
                    expected_range=[valid.min()*factor, valid.max()*factor] if valid.size else None
                    assert v['depthRangeMeters']==expected_range, 'Limites físicos divergentes'
                    if preview and preview['lf']==lf and preview['frame']==frame_key:
                        signal=curves[preview['channel']].reshape(-1)
                        for point in filter(None, preview['points']):
                            assert np.any((original*factor==point[1]) & (signal==point[0])), 'Ponto de miniatura divergente'
                            valid_preview_points+=1
                for ch in frame.channels:
                    if ch.reprc not in [1, 2, 5, 6, 7, 12, 13, 14, 15, 16, 17]:
                        continue
                    a = curves[ch.name]
                    reference.append(dict(lf=lf, frame=f'{frame.origin}/{frame.copynumber}/{frame.name}',
                        channel=f'{ch.origin}/{ch.copynumber}/{ch.name}', units=ch.units,
                        dimensions=ch.dimension, rows=len(a), count=a.size, sha256=digest(a)))
    key = lambda c: (c['lf'], c['frame'], c['channel'])
    expected = {key(c): c for c in reference}
    obtained = {key(c): c for c in actual['channels']}
    assert expected == obtained, f'Reference mismatch in case {len(reports)+1}: ' + str([k for k in expected if expected[k] != obtained.get(k)])
    reports.append(dict(case=len(reports)+1, bytes=path.stat().st_size,
        frames=len(set((c['lf'], c['frame']) for c in reference)), channels=len(reference),
        samples=sum(v['samples'] for v in frames.values()),tools=sum(map(len,catalog['tools'])),
        thumbnail_points=valid_preview_points,metadata_bytes=catalog['metadata_bytes'],
        numeric_values=sum(c['count'] for c in reference), exact_match=True,
        elapsed_ms=actual['elapsed_ms'], peak_rss_mb=actual['peak_rss_mb'],
        warnings=actual['warnings']))
if not reports:parser.error('No DLIS files found')
print(json.dumps(dict(reference='dlisio 1.0.4', unique_files=len(reports), cases=reports),indent=2))
