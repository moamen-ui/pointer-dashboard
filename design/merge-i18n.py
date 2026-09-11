#!/usr/bin/env python3
"""Build the canonical i18n files (design/i18n/{en,ar}.json) from the three apps and sync them back.

The three apps had drifted (different keys and different wording for the same key). Parity rule:
one canonical set of strings for every app. Merge policy: union of all keys; where the same key has
different values, the canonical design/i18n file wins, then React, then Vue, then Angular.
Run:  python3 design/merge-i18n.py          # writes design/i18n/*.json and copies into every app
      python3 design/merge-i18n.py --check  # only reports drift, writes nothing
"""
import json, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
APPS = ['react', 'vue', 'angular']
check = '--check' in sys.argv

def flat(d, p=''):
    out = {}
    for k, v in d.items():
        kk = f'{p}.{k}' if p else k
        if isinstance(v, dict): out.update(flat(v, kk))
        else: out[kk] = v
    return out

def unflat(f):
    out = {}
    for k, v in f.items():
        cur = out
        parts = k.split('.')
        for part in parts[:-1]:
            if not isinstance(cur.get(part), dict): cur[part] = {}
            cur = cur[part]
        cur[parts[-1]] = v
    return out

for lang in ['en', 'ar']:
    flats = {a: flat(json.load(open(ROOT / a / 'public/assets/i18n' / f'{lang}.json'))) for a in APPS}
    # The canonical file itself is the highest-priority source, so edits made there survive a re-merge.
    canonical_path = ROOT / 'design/i18n' / f'{lang}.json'
    canonical = flat(json.load(open(canonical_path))) if canonical_path.exists() else {}
    keys = set(canonical).union(*[set(f) for f in flats.values()])
    merged, conflicts = {}, 0
    for k in sorted(keys):
        vals = ([canonical[k]] if k in canonical else []) + [flats[a][k] for a in APPS if k in flats[a]]
        if len(set(map(str, vals))) > 1: conflicts += 1
        merged[k] = vals[0]  # priority order = APPS order
    # A leaf in one app can be an object in another (e.g. `foo` vs `foo.bar`); drop the leaf then.
    for k in list(merged):
        if any(o.startswith(k + '.') for o in merged):
            del merged[k]
    print(f'{lang}: {len(keys)} keys, {conflicts} wording conflicts resolved, missing per app: '
          + ', '.join(f'{a}={len(keys - set(flats[a]))}' for a in APPS))
    if check: continue
    out = ROOT / 'design/i18n' / f'{lang}.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(unflat(merged), ensure_ascii=False, indent=2) + '\n'
    out.write_text(text)
    for a in APPS:
        (ROOT / a / 'public/assets/i18n' / f'{lang}.json').write_text(text)
    print(f'  wrote {out.relative_to(ROOT)} and synced to {len(APPS)} apps')
