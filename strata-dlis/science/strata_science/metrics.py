"""Derived arrays only. No clipping, smoothing or changes to the original samples."""
import numpy as np

def valid_values(values):
    a=np.asarray(values,dtype=float).copy()
    a[np.isin(a,[-999.25,-9999.25,-9999,-99999,-2000])]=np.nan
    a[~np.isfinite(a)]=np.nan
    return a

def compare(reference, observed):
    """Paired finite cells in the SAME units; observed minus reference. No clipping."""
    a,b=valid_values(reference),valid_values(observed)
    if a.shape!=b.shape: raise ValueError("Comparison requires identical shapes and aligned coordinates.")
    mask=np.isfinite(a)&np.isfinite(b)
    if mask.sum()<2: raise ValueError("At least two paired cells required.")
    x,y=a[mask],b[mask];diff=y-x
    correlation=float(np.corrcoef(x,y)[0,1]) if x.std()>0 and y.std()>0 else None
    return dict(cells_compared=int(mask.sum()),bias=float(diff.mean()),mae=float(np.abs(diff).mean()),
        rmse=float(np.sqrt(np.mean(diff**2))),correlation=correlation,
        reference_mean=float(x.mean()),observed_mean=float(y.mean()))

def resample_to_grid(depth, values, top, bottom, n=100, max_distance=None):
    """Explicit nearest-neighbour DERIVED overview. Never bridges a gap or extrapolates.
    Keeps the original component count; assumes no azimuth spacing from shape alone.
    """
    depth=np.asarray(depth,dtype=float);z=valid_values(values)
    if depth.ndim!=1 or z.ndim!=2 or len(depth)!=len(z): raise ValueError("Incompatible depth and matrix shapes.")
    if not np.isfinite([top,bottom]).all() or bottom<=top or n<2: raise ValueError("Invalid grid interval.")
    order=np.argsort(depth,kind="stable");order=order[np.isfinite(depth[order])]
    d=depth[order];z=z[order]
    if len(d)<2 or np.any(np.diff(d)<=0): raise ValueError("Unique depth samples required.")
    tolerance=float(np.median(np.diff(d)))*0.55 if max_distance is None else max_distance
    if tolerance<0 or not np.isfinite(tolerance): raise ValueError("Invalid tolerance.")
    targets=np.linspace(top,bottom,n);out=np.full((n,z.shape[1]),np.nan)
    for i,t in enumerate(targets):
        k=int(np.searchsorted(d,t));candidates=[j for j in (k-1,k) if 0<=j<len(d)]
        j=min(candidates,key=lambda j:abs(d[j]-t))
        if d[0]<=t<=d[-1] and abs(d[j]-t)<=tolerance:out[i]=z[j]
    return targets,out

def vdl_measures(waveforms, time_us, casing_window, formation_window):
    """Window RMS indicators, not a validated cement-quality or wave-separation model.
    Requires explicit, verified times/windows; never manufactures a time axis.
    """
    a=valid_values(waveforms);t=np.asarray(time_us,dtype=float)
    if a.ndim!=2 or t.ndim!=1 or a.shape[1]!=len(t) or not np.isfinite(t).all() or np.any(np.diff(t)<=0):
        raise ValueError("Explicit increasing time axis in microseconds required.")
    out={}
    for name,win in (("casing_window_rms",casing_window),("formation_window_rms",formation_window)):
        if win[1]<=win[0]:raise ValueError("Invalid time window.")
        mask=(t>=win[0])&(t<win[1])
        if not mask.any():raise ValueError("Time window has no samples.")
        v=a[:,mask];count=np.isfinite(v).sum(axis=1)
        out[name]=np.sqrt(np.divide(np.nansum(v*v,axis=1),count,out=np.full(len(a),np.nan),where=count>0))
    return out
