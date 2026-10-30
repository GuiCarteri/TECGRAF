"""Reader adapted from the supplied SWS workflow; never assumes time or azimuth."""
import numpy as np
from dlisio import dlis

FACTORS = {"m":1.0,"ft":0.3048,"0.1ft":0.03048,"in":0.0254,"0.1in":0.00254,"cm":0.01,"mm":0.001}

def depth_to_m(depth, unit):
    unit = str(unit).lower().replace(" ", "")
    if unit not in FACTORS:
        raise ValueError(f"Unknown depth unit: {unit}")
    a = np.asarray(depth, dtype=float).copy()
    a[np.isin(a, [-999.25,-9999.25,-9999,-99999,-2000])] = np.nan
    return a * FACTORS[unit]

def inspect(path):
    with dlis.load(str(path)) as files:
        return [{"logical_file": i, "frames": [{"name": f.name, "origin": f.origin,
            "copy": f.copynumber, "index_type": f.index_type,
            "channels": [{"name": c.name, "units": c.units, "dimensions": c.dimension,
                "origin":c.origin,"copy":c.copynumber} for c in f.channels]} for f in lf.frames]}
            for i, lf in enumerate(files)]

def load_channel(path, channel, logical_file=None, frame=None):
    """Preserve order, null sentinels and raw values. Ambiguous selections fail closed."""
    with dlis.load(str(path)) as files:
        matches=[]
        for i,lf in enumerate(files):
            if logical_file is not None and logical_file != i: continue
            for f in lf.frames:
                if frame is not None and frame != f.name: continue
                for c in f.channels:
                    if c.name == channel: matches.append((i,f,c))
        if len(matches)!=1:
            raise ValueError("Choose an unambiguous logical file, frame and channel.")
        i,f,c=matches[0]
        if f.index_type not in ("BOREHOLE-DEPTH","VERTICAL-DEPTH"):
            raise ValueError("Frame does not declare a depth index.")
        idx=f.channels[0]
        if idx.dimension != [1]: raise ValueError("Depth index is not scalar.")
        values=np.array(c.curves(),dtype=float)
        raw_depth=np.array(idx.curves(),dtype=float)
        return dict(values=values, depth_m=depth_to_m(raw_depth,idx.units), raw_depth=raw_depth,
            metadata=dict(logical_file=i,frame=f.name,channel=c.name,unit=c.units,
                depth_channel=idx.name,depth_unit=idx.units,dimensions=c.dimension,
                source="original DLIS",time_axis=None,azimuth_axis=None))

def load_aibk(path, channel="AIBK", **selection):
    result=load_channel(path,channel,**selection)
    if result["values"].ndim!=2: raise ValueError("AIBK requires one component axis.")
    if result["metadata"]["unit"].lower() not in ("mrayl","mrayls","mr"):
        raise ValueError("AIBK unit is not MRayl.")
    return result

def load_cbl_vdl_dlis(path, cbl_channel="CBL", vdl_channel="VDL", **selection):
    cbl=load_channel(path,cbl_channel,**selection)
    if cbl["values"].ndim!=1 or cbl["metadata"]["unit"].lower()!="mv":
        raise ValueError("CBL requires a scalar channel in mV.")
    # Different frames are intentionally not resampled onto one depth axis.
    try: vdl=load_channel(path,vdl_channel,logical_file=selection.get("logical_file"))
    except ValueError: vdl=None
    return dict(cbl=cbl,vdl=vdl)
