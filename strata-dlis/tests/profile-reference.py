"""Leitura independente de um ponto do frame para cada trilha escolhida no navegador."""
import json
import sys
import numpy as np
from dlisio import dlis

requests = json.load(sys.stdin)
result = []
with dlis.load(sys.argv[1]) as logical_files:
    for request in requests:
        logical = logical_files[int(request["lf"])]
        frame = next(f for f in logical.frames if f"{f.origin}/{f.copynumber}/{f.name}" == request["frame"])
        channel = next(c for c in frame.channels if c.name == request["channel"])
        depth_channel = frame.channels[0]
        factor = {"m": 1, "ft": .3048, "in": .0254, "0.1in": .00254, "mm": .001, "cm": .01, "0.1ft": .03048}["".join(depth_channel.units.lower().split())]
        depths = np.asarray(depth_channel.curves(), dtype="float64").ravel() * factor
        values = channel.curves().reshape(len(depths), -1)[:, int(request["component"])]
        good = np.isfinite(values) & np.isfinite(depths) & ~np.isin(values, [-999.25, -9999.25, -99999, -9999, -2000])
        # O cursor em profundidades repetidas pode apontar para mais de uma linha.
        ordered = np.sort(depths)
        good &= np.searchsorted(ordered, depths, side="right") - np.searchsorted(ordered, depths, side="left") == 1
        indices = np.flatnonzero(good)
        if not len(indices):
            raise ValueError("Canal sem amostra válida com profundidade única")
        i = indices[len(indices)//2]
        result.append(dict(depth=float(depths[i]), value=float(values[i]), unit=channel.units))
print(json.dumps(result))
