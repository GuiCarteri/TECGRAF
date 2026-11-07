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
    reference = []
    with dlis.load(str(path)) as files:
        for lf, logical in enumerate(files):
            for frame in logical.frames:
                curves = frame.curves()
                for ch in frame.channels:
                    if ch.reprc not in [1, 2, 5, 6, 7, 12, 13, 14, 15, 16, 17]:
                        continue
                    a = curves[ch.name]
                    reference.append(dict(lf=lf, frame=f'{frame.origin}/{frame.copynumber}/{frame.name}',
                        channel=f'{ch.origin}/{ch.copynumber}/{ch.name}', units=ch.units,
                        dimensions=ch.dimension, rows=len(a), count=a.size, sha256=digest(a)))
    completed = subprocess.run(['node', 'scripts/reference-digest.mjs', str(path)],
        check=True, capture_output=True, text=True)
    actual = json.loads(completed.stdout)
    key = lambda c: (c['lf'], c['frame'], c['channel'])
    expected = {key(c): c for c in reference}
    obtained = {key(c): c for c in actual['channels']}
    assert expected == obtained, f'Reference mismatch in case {len(reports)+1}: ' + str([k for k in expected if expected[k] != obtained.get(k)])
    reports.append(dict(case=len(reports)+1, bytes=path.stat().st_size,
        frames=len(set((c['lf'], c['frame']) for c in reference)), channels=len(reference),
        numeric_values=sum(c['count'] for c in reference), exact_match=True,
        elapsed_ms=actual['elapsed_ms'], peak_rss_mb=actual['peak_rss_mb'],
        warnings=actual['warnings']))
if not reports:parser.error('No DLIS files found')
print(json.dumps(dict(reference='dlisio 1.0.4', unique_files=len(reports), cases=reports),indent=2))
