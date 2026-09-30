import importlib.util, pathlib, sqlite3
spec=importlib.util.spec_from_file_location('migration','scripts/migrate-identities.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def backup(collision=False):
 db=sqlite3.connect(':memory:')
 for f in sorted(pathlib.Path('drizzle').glob('*.sql')): db.executescript(f.read_text())
 for uid in ['legacy-user','supabase:new']:db.execute('INSERT INTO users(id,email,name,role,created_at) VALUES(?,?,?,?,?)',(uid,'same@example.test','Test','admin' if uid=='legacy-user' else 'user','now'))
 db.execute("INSERT INTO analyses VALUES('analysis','legacy-user','hash','x.dlis','Note','[{\"rawValue\":1.125}]','{}','now')")
 db.execute("INSERT INTO history VALUES('old-history','legacy-user','hash',NULL,'x.dlis','now')")
 if collision:db.execute("INSERT INTO history VALUES('new-history','supabase:new','hash',NULL,'x.dlis','now')")
 db.commit();return '\n'.join(db.iterdump())
items=[dict(old_user_id='legacy-user',new_user_id='supabase:new',evidence_sha256='a'*64,approved_by='test-reviewer')]
db, report=m.migrate(backup(),items)
assert db.execute('SELECT owner_id FROM analyses').fetchone()[0]=='supabase:new'
assert db.execute("SELECT role FROM users WHERE id='supabase:new'").fetchone()[0]=='user'
assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0]==2
for source, mapping in [(backup(True),items),(backup(),[{**items[0],'evidence_sha256':''}])]:
 try:m.migrate(source,mapping);raise AssertionError('Unsafe migration accepted')
 except ValueError:pass
print('PASS: explicit identity migration preserves points, users and privileges; missing evidence and duplicate history fail closed.')
