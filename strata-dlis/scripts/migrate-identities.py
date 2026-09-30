#!/usr/bin/env python3
"""Validate an operator-approved identity map against a D1 SQL backup, offline.
Never connects to production. Does not infer ownership from an email address.
"""
import argparse, hashlib, json, pathlib, sqlite3, sys

def migrate(backup, mappings):
    db = sqlite3.connect(':memory:')
    db.executescript(backup)
    required = ['users', 'files', 'analyses', 'history', 'exports_log', 'uploads']
    for table in required:
        db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()
    # These references include both ownership and moderation provenance.
    refs = [('files', 'owner_id'), ('files', 'reviewer_id'), ('analyses', 'owner_id'),
            ('history', 'owner_id'), ('exports_log', 'owner_id'), ('uploads', 'owner_id')]
    before = {t: db.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] for t in required}
    protected = {t: db.execute(f'SELECT id, points, settings, hash FROM {t} ORDER BY id').fetchall() for t in ['analyses']}
    seen_old, seen_new = set(), set()
    report = []
    with db:
        db.execute('''CREATE TABLE IF NOT EXISTS identity_migrations (
            old_user_id TEXT PRIMARY KEY, new_user_id TEXT NOT NULL UNIQUE,
            evidence_sha256 TEXT NOT NULL, approved_by TEXT NOT NULL,
            migrated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )''')
        for item in mappings:
            old, new = item['old_user_id'], item['new_user_id']
            evidence, approver = item['evidence_sha256'], item['approved_by']
            if old == new or old in seen_old or new in seen_new or not new.startswith('supabase:'):
                raise ValueError('Map must be one-to-one and target an explicitly verified Supabase identity.')
            if len(evidence) != 64 or any(c not in '0123456789abcdef' for c in evidence) or not approver.strip():
                raise ValueError('Approval identity and SHA-256 of ownership evidence are required.')
            seen_old.add(old); seen_new.add(new)
            if not db.execute('SELECT 1 FROM users WHERE id=?', (old,)).fetchone():
                raise ValueError('Old identity does not exist: ' + old)
            if not db.execute('SELECT 1 FROM users WHERE id=?', (new,)).fetchone():
                raise ValueError('New confirmed identity must sign in before migration: ' + new)
            if db.execute('SELECT 1 FROM uploads WHERE owner_id IN (?,?)', (old,new)).fetchone():
                raise ValueError('Complete or cancel pending uploads before migrating identities.')
            conflict = db.execute('''SELECT a.hash FROM history a JOIN history b ON a.hash=b.hash
                WHERE a.owner_id=? AND b.owner_id=?''', (old,new)).fetchone()
            if conflict:
                raise ValueError('History collision: reconcile explicitly without deleting evidence: ' + conflict[0])
            changes = {}
            for table, column in refs:
                cur = db.execute(f'UPDATE {table} SET {column}=? WHERE {column}=?', (new,old))
                changes[table + '.' + column] = cur.rowcount
            db.execute('INSERT INTO identity_migrations(old_user_id,new_user_id,evidence_sha256,approved_by) VALUES(?,?,?,?)',
                       (old,new,evidence,approver))
            # Preserve the original user row for audit. Never transfer its privileges.
            report.append({'old_user_id':old,'new_user_id':new,'changes':changes})
        for table in required:
            assert db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] == before[table]
        assert db.execute('SELECT id, points, settings, hash FROM analyses ORDER BY id').fetchall() == protected['analyses']
        for item in mappings:
            for table, column in refs:
                assert not db.execute(f'SELECT 1 FROM {table} WHERE {column}=?',(item['old_user_id'],)).fetchone()
    return db, report

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup', required=True, type=pathlib.Path)
    parser.add_argument('--mapping', required=True, type=pathlib.Path)
    parser.add_argument('--output', type=pathlib.Path, help='Write a migrated SQL copy. Omit for validation only.')
    args = parser.parse_args()
    raw = args.backup.read_bytes()
    mappings = json.loads(args.mapping.read_text())
    if not isinstance(mappings,list) or not mappings: raise ValueError('A non-empty explicit mapping list is required.')
    db, report = migrate(raw.decode(), mappings)
    if args.output:
        # Exclusive creation protects an existing backup or prior migration result.
        with args.output.open('x',encoding='utf8') as target:
            target.write('\n'.join(db.iterdump())+'\n')
    print(json.dumps({'backup_sha256':hashlib.sha256(raw).hexdigest(),'validated':True,'written':str(args.output) if args.output else None,'migrations':report},indent=2))
    db.close()

if __name__ == '__main__':
    try: main()
    except Exception as exc:
        print('Migration refused: '+str(exc),file=sys.stderr);sys.exit(1)
