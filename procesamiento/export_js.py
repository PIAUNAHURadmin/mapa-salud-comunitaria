#!/usr/bin/env python3
"""Genera los archivos `data/*.js` a partir de los JSON normalizados, de modo que
el panel funcione abriendo `index.html` directamente (sin servidor HTTP)."""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "..", "data")

def export(nombre, var):
    path = os.path.join(DATA, nombre + ".json")
    if not os.path.exists(path):
        print("falta", path)
        return
    obj = json.load(open(path, encoding="utf-8"))
    js = "window.%s = %s;\n" % (var, json.dumps(obj, ensure_ascii=False))
    open(os.path.join(DATA, nombre + ".js"), "w", encoding="utf-8").write(js)
    print("ok", nombre + ".js", f"({len(obj)} elementos)")

export("efectores", "EFECTORES")
export("municipios", "MUNICIPIOS")
export("taxonomia", "TAXONOMIA")
export("resumen", "RESUMEN")
export("colectivos", "COLECTIVOS")

