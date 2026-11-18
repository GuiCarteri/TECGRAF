"""Exercise the additive migration against actual legacy rows, with FK enforcement."""
import json, pathlib, sqlite3
con=sqlite3.connect(':memory:')
con.execute('PRAGMA foreign_keys=ON')
con.executescript(pathlib.Path('drizzle/0000_fuzzy_prism.sql').read_text())
insert='INSERT INTO files (id,hash,owner_id,publisher,original_name,size,object_key,well,collection,metadata,authorization,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
for id,owner in [('first','owner'),('second','owner'),('private','other')]:
 con.execute(insert,(id,id+'hash',owner,'name','original.dlis',123,'r2/'+id,'Same name','Source','{"original":true}',1,'2026-01-01'))
con.execute("INSERT INTO analyses VALUES ('a','owner','firsthash','original.dlis','Saved','[{\"rawValue\":1.125}]','{\"regions\":[]}','now')")
original=con.execute('SELECT * FROM files ORDER BY id').fetchall()
analysis=con.execute('SELECT * FROM analyses').fetchall()
con.commit()
con.executescript(pathlib.Path('drizzle/0001_data_model.sql').read_text())
assert con.execute('SELECT * FROM files ORDER BY id').fetchall()==original
assert con.execute('SELECT * FROM analyses').fetchall()==analysis
assert con.execute('SELECT COUNT(DISTINCT well_id) FROM file_wells').fetchone()[0]==3
assert con.execute("SELECT origin FROM wells WHERE id='publication:first'").fetchone()[0]=='publication'
con.execute(insert,('new','newhash','owner','name','new.dlis',123,'r2/new',None,'Source','{}',1,'now'))
assert con.execute("SELECT well_id FROM file_wells WHERE file_id='new'").fetchone()[0]=='publication:new'
con.execute("UPDATE file_wells SET well_id='publication:first' WHERE file_id='second'")
assert con.execute("SELECT COUNT(*) FROM file_wells WHERE well_id='publication:first'").fetchone()[0]==2
try:
 con.execute("UPDATE file_wells SET well_id='missing' WHERE file_id='new'")
 raise AssertionError('Missing well accepted')
except sqlite3.IntegrityError: pass
snapshot=json.dumps({'hash':'firsthash','points':[{'rawValue':1.125}]})
con.execute("INSERT INTO reports(id,owner_id,file_id,well_id,analysis_id,source_hash,title,content,source_snapshot,created_at) VALUES ('r','owner','first','publication:first','a','firsthash','Report','{}',?,'now')",(snapshot,))
con.execute("DELETE FROM files WHERE id='first'")
assert not con.execute("SELECT * FROM file_wells WHERE file_id='first'").fetchall()
assert con.execute("SELECT file_id,source_snapshot FROM reports WHERE id='r'").fetchone()==(None,snapshot)
assert con.execute('SELECT * FROM analyses').fetchall()==analysis
con.execute("DELETE FROM analyses WHERE id='a'")
assert con.execute("SELECT analysis_id,source_snapshot FROM reports WHERE id='r'").fetchone()==(None,snapshot)
assert not con.execute('PRAGMA foreign_key_check').fetchall()
print('PASS: additive legacy migration, distinct wells, new publications, relationships, deletion and immutable report provenance')
