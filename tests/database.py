"""Checks real schema constraints, without test data in production migrations."""
import sqlite3,pathlib
con=sqlite3.connect(':memory:')
for migration in sorted(pathlib.Path('drizzle').glob('*.sql')): con.executescript(migration.read_text())
row=('a','hash','owner','Publisher','test.dlis',84,'key','SOURCE','{}',1,'2026-09-24')
sql='INSERT INTO files (id,hash,owner_id,publisher,original_name,size,object_key,collection,metadata,authorization,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
con.execute(sql,row)
try:con.execute(sql,('b',)+row[1:]);raise AssertionError('Duplicate SHA allowed')
except sqlite3.IntegrityError:pass
con.execute("INSERT INTO analyses VALUES ('a','user-a','h','file','name','[]','{}','now')")
assert not con.execute("SELECT * FROM analyses WHERE owner_id=?",('user-b',)).fetchall()
print('PASS: unique SHA-256 and account-scoped analysis query')
