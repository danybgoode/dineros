"""Descarga las fuentes oficiales a data/raw/ y escribe data/raw/manifiesto.json.

Debe correr desde una conexión en México: varios portales de Hacienda rechazan
tráfico extranjero.  Uso:  python3 pipeline/descargar.py [--forzar]
"""
import hashlib
import json
import pathlib
import sys
import time
import subprocess
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fuentes import FUENTES  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
RAW = RAIZ / "data" / "raw"
UA = "dineros-pipeline/1.0 (+https://github.com/danybgoode/dineros)"


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    forzar = "--forzar" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    man_p = RAW / "manifiesto.json"
    man = json.loads(man_p.read_text()) if man_p.exists() else {}
    for f in FUENTES:
        dest = RAW / f["archivo"]
        if dest.exists() and not forzar and f["id"] in man:
            print(f"· {f['id']}: ya existe")
            continue
        t = time.time()
        subprocess.run(["curl", "-sS", "-L", "--fail", "--max-time", "900", "-A", UA,
                        "-o", str(dest), f["url"]], check=True)
        man[f["id"]] = {
            "url": f["url"],
            "archivo": f["archivo"],
            "descargado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "bytes": dest.stat().st_size,
            "sha256": sha256(dest),
            "segundos": round(time.time() - t, 1),
        }
        print(f"✓ {f['id']}: {dest.stat().st_size/1e6:.1f} MB en {man[f['id']]['segundos']} s")
        man_p.write_text(json.dumps(man, indent=2, ensure_ascii=False))
    man_p.write_text(json.dumps(man, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
