"""PROVISIONAL thresholds from supplied SWS tool; expert validation required."""
import math
BINS=((2.6,"Péssimo"),(3.5,"Ruim"),(4.5,"Médio"),(5.5,"Bom"),(math.inf,"Excelente"))
def classify_impedance(value_mrayl):
    if not math.isfinite(value_mrayl) or value_mrayl<0: return None
    return {"label": next(label for upper,label in BINS if value_mrayl<upper),
        "status":"provisional","unit":"MRayl","criterion":"SWS supplied thresholds"}
