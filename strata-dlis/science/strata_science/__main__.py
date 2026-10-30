import argparse,json
from pathlib import Path
import numpy as np
from .reader import inspect, load_channel
p=argparse.ArgumentParser(description="Local STRATA reader; does not make network requests.")
p.add_argument("file",type=Path);p.add_argument("--channel");p.add_argument("--logical-file",type=int);p.add_argument("--frame");p.add_argument("--output",type=Path)
a=p.parse_args()
if not a.channel: print(json.dumps(inspect(a.file),ensure_ascii=False,indent=2))
else:
    if not a.output: p.error("--output is required for channel extraction")
    if a.output.exists(): p.error("Output already exists; choose a new path")
    result=load_channel(a.file,a.channel,logical_file=a.logical_file,frame=a.frame)
    with a.output.open("xb") as f:
        np.savez_compressed(f,values=result["values"],depth_m=result["depth_m"],raw_depth=result["raw_depth"],metadata=json.dumps(result["metadata"]))
