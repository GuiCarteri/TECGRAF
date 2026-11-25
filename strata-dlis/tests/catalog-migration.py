"""Confere a projeção do catálogo anterior sem modificar o conteúdo publicado."""
import json
import sqlite3
from pathlib import Path

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
for file in sorted(Path("drizzle").glob("000[01]*.sql")):
    db.executescript(file.read_text())
legacy = {"logicalFiles": [{"origin": {"wellName":"A", "fieldName":"B"},
    "frames":[{"channels":[{"name":"GR","units":"gAPI"}]}]}],
    "validation":[{"ok":True,"lf":0,"frame":"1/0/F","depthRangeMeters":[10,22],"samples":13}]}
for file_id, data in [("old",json.dumps(legacy)), ("empty","{}"), ("damaged","incomplete")]:
    db.execute("""INSERT INTO files(id,hash,owner_id,publisher,original_name,size,object_key,collection,metadata,authorization,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)""",(file_id,file_id,"owner","owner","test.dlis",99,file_id,"QA",data,1,"2026-01-01"))
original = db.execute("SELECT * FROM files ORDER BY id").fetchall()
db.executescript(Path("drizzle/0002_auth_catalog.sql").read_text())
def summary(file_id):
    row = db.execute("SELECT summary FROM catalog_index WHERE file_id=?",(file_id,)).fetchone()
    return json.loads(row[0])
assert db.execute("SELECT * FROM files ORDER BY id").fetchall() == original
assert summary("old")["fields"] == ["B"]
assert summary("old")["channels"] == [{"name":"GR","unit":"gAPI"}]
assert summary("old")["ranges"] == [[10,22]] and summary("old")["samples"] == 13
assert summary("old")["thumbnail"] is None
assert summary("damaged")["ranges"] == [] and summary("empty")["samples"] is None
db.execute("UPDATE files SET metadata=? WHERE id='empty'",(json.dumps(legacy),))
assert summary("empty") == summary("old")
db.execute("DELETE FROM files WHERE id='old'")
assert db.execute("SELECT count(*) FROM catalog_index WHERE file_id='old'").fetchone()[0] == 0
assert not db.execute("PRAGMA foreign_key_check").fetchall()
print("PASS migração do índice, registros legados, metadados ausentes, atualização e exclusão.")
