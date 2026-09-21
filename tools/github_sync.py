"""
Publish the catalog to GitHub: web-sized art, card data, templates, keywords.

WHY THIS EXISTS: card art used to live on catbox, uploaded by a script that kept
an upload_cache.json keyed by CARD NAME. That cache is exactly the shape HANDOFF
s13 warns about - a comparison keyed on a field that later drifted. Names did
drift, and 25 duplicate cards hid behind a check that looked like it passed.

So this tool keeps no cache of what it uploaded. The REMOTE TREE is the source of
truth: one call returns every path and blob sha in the repo, and the diff is
computed against that. A cache can disagree with reality; the tree cannot
disagree with itself. It also means an interrupted run needs no recovery - run it
again and it recomputes.

    python tools/github_sync.py --plan       # offline: encode, hash, report
    python tools/github_sync.py --dry-run    # + read the remote tree, show the diff
    python tools/github_sync.py --publish    # upload

WHAT LANDS IN THE REPO

    art/<name>.webp     every referenced picture, re-encoded to 1600px wide
    cards.json          the catalog, art URLs rewritten to the CDN
    keywords.json       the keyword / keyterm / counter / dice table
    manifest.json       counts, timestamp, art base URL

cards.json is shaped {manifest, cards, look, marks}, which is what pkgFromJson()
in src/editor/ed2_sagas.js already accepts. A consumer pastes the raw URL into a
saga's source field and the EXISTING sync path reads it - no app change needed.

THE ART IS RE-ENCODED, THE MASTERS ARE NOT TOUCHED. art/ holds print-resolution
PNGs (1830 files, 8.05 GB, median 6.6 megapixels). That does not belong in a git
repo - GitHub asks for under 1 GB. WebP at 1600px q82 measures 3.41% of that,
about 0.27 GB, and keeps alpha. The masters stay on disk as the source of truth
and are never uploaded.

SAFETY RULES THIS SCRIPT KEEPS

  * Nothing is uploaded until every referenced picture has been encoded. A
    catalog that points at art nobody can fetch is worse than no catalog.
  * Blobs go up first; the tree and commit are written LAST. An interrupted run
    leaves the branch on its old commit - never half-updated.
  * Deletions happen by OMISSION from the new tree, so retired files disappear
    in the same commit that adds their replacements.
  * The token is read from the environment or a file, never from argv, and is
    never written anywhere.
  * --plan touches no network at all.
"""
import argparse
import base64
import hashlib
import io
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ISLANDS = os.path.join(ROOT, 'data', 'json_islands.txt')
# The keyword table is NOT in json_islands.txt with the others - it sits in the
# markup slice, which is where the Keywords page reads it from.
KWSRC = os.path.join(ROOT, 'src', 'markup_tail_a.html')
ARTDIR = os.path.join(ROOT, 'art')
STAGE = os.path.join(ROOT, 'build', 'publish')
CACHE = os.path.join(STAGE, '.encode_cache.json')
CONFIG = os.path.join(ROOT, 'publish.json')

WIDTH = 1600
QUALITY = 82
UA = 'conjure-catalog-sync/1.0'
API = 'https://api.github.com'
TIMEOUT = 60
RETRIES = 3

# Tree entries per POST /git/trees. GitHub answers 502 Server Error on a tree
# with everything in it at once - it cannot build 1833 entries inside its own
# timeout. Chunks are layered with base_tree, so this only costs extra requests.
TREE_CHUNK = 200

# GitHub asks for repos under 1 GB. Refuse well before that rather than let a
# push fail halfway through.
SIZE_CEILING = 900 * 1024 * 1024

# The only paths this tool may DELETE. Everything else in the repo - a README,
# a LICENSE, a docs/ folder, anything a human added - is left alone. Without
# this the first publish removed the LICENSE and README.md that GitHub creates
# with a new repository.
OWNED_DIRS = ('art/',)
OWNED_FILES = ('cards.json', 'keywords.json', 'manifest.json', 'sagas.json')
# ⚠ look.json is DELIBERATELY NOT OWNED. It holds the template assets, keyword
# pill styling, alignment table, art defaults and watermarks, and only the app
# can build it - those live in IndexedDB, which no local process can read.
# Owning it here would mean this tool deletes it by omission on every run,
# throwing away the look the moment anyone published art. Same reasoning as
# card_catalog.html below.

# The one repository that also carries a copy of the app itself, so people can
# download the catalog from where they already get its cards. Everyone else
# publishes their own set INTO this app and has no business shipping it.
#
# ⚠ This pair must stay in step with GH_DEFAULT_SOURCE in
# src/editor/ed2_publish.js. Two places know which repo is official; if they
# ever disagree, one uploader ships the app and the other quietly does not.
# Both games have an official repository, and they are SEPARATE repositories -
# the two share no cards, no keywords, no sagas and no art, so one repo could
# not hold both without the consumer having to know which half was which.
OFFICIAL_REPOS = (
    ('ConjureUCG', 'Conjure_Card_Catalog'),     # the main game
    ('ConjureUCG', 'Conjure_Rebirth_Catalog'),  # Rebirth
)
CATALOG_FILE = 'card_catalog.html'

# The two files that make the official repository a WEBSITE rather than a
# folder of files, published beside the app for the same reason the app is
# published: so somebody can open the catalog where they already get its cards.
#
#   index.html   the front door at the domain root. ⚠ IT IS NOT THE APP, AND
#                THAT IS THE POINT. GitHub Pages has a soft limit of 100 GB of
#                bandwidth a month; at 15 MB a visit that is about 6,500 loads,
#                and "a visit" counts every crawler and every Discord and
#                Twitter link preview. A 38 KB page means only a deliberate
#                click costs the 15 MB.
#   .nojekyll    tells Pages to serve the repository as static files. Without
#                it Pages runs Jekyll over the whole thing - 1830 art files -
#                on every build, which is slow and silently drops any path with
#                a leading underscore.
#
# ⚠ NEITHER IS OWNED, same as CATALOG_FILE and the README. Deletion in this
# tool is by omission, so owning them would mean deleting whatever index.html
# somebody else keeps in their own repository the first time they publish a
# set. What other people put in their repositories is not this tool's business.
#
# ⚠ AND THE CNAME FILE IS NOT IN HERE ON PURPOSE. GitHub writes CNAME itself
# when you set the custom domain in the repository's Pages settings, and it
# rewrites it when you change the domain. A local copy staged from here would
# push a stale domain back over a change made in the settings page and quietly
# move the site. Not staging it means it lands in `kept` and is left alone,
# which is the correct behaviour for a file this tool does not own.
#
# THE INSTALLER (session 55). sw.js is what lets an installed Conjure open with
# no internet; it must sit at the domain root, because a service worker only
# looks after pages at or below its own address. The manifest and the icons are
# built by tools/make_pwa.py. Same rules as the two above: published only to
# the website, never owned, nagged about when missing - a site with no sw.js
# still works, it just stops working offline, and nothing else would say so.
SITE_FILES = ('index.html', '.nojekyll',
              'sw.js', 'manifest.webmanifest',
              'pwa/icon-192.png', 'pwa/icon-512.png',
              'pwa/icon-maskable-512.png', 'pwa/apple-touch-icon.png')

# THE SET DISTRIBUTION KIT (session 55g). The publisher itself, published beside
# the app: the Owner Sync page hands people a zip of it (baked in by
# tools/make_setkit.py, because the app has to work off a disk), and this puts
# the same file in the repository so anybody browsing it gets the current one.
# Same rules as SITE_FILES - the website repository only, and never OWNED, so
# it is never deleted from somebody else's repo by omission.
KIT_FILES = ('tools/github_sync.py',)


# ⚠ TWO QUESTIONS, TWO FUNCTIONS. is_official() used to answer both "is this
# repository one of ours" and "is this repository the website", and both
# official repositories said yes to both - so pointing publish.json at
# Conjure_Rebirth_Catalog would have pushed the MAIN game's index.html, a 15 MB
# copy of the MAIN build and the main README into a repository whose job is
# 40 KB of Rebirth JSON. Offered from session 17 on, fixed in session 54.
#
#   is_official(cfg)   one of ours - either game
#   is_site_repo(cfg)  the one that IS playconjure.com - the main game only
#
# The app, the front door, .nojekyll and the README/LICENSE go only where
# is_site_repo() says. And the Rebirth repository is refused outright in main():
# every card and picture this tool can read is the main game's (it reads
# data/json_islands.txt and art/), so there is nothing it could put there that
# belongs there - and art/ is OWNED, so a run would have deleted Rebirth's own
# pictures by omission and replaced them with the main game's.
SITE_REPO = ('ConjureUCG', 'Conjure_Card_Catalog')


def _same_repo(cfg, pair):
    return (cfg.get('owner', '').lower() == pair[0].lower()
            and cfg.get('repo', '').lower() == pair[1].lower())


def is_official(cfg):
    return any(_same_repo(cfg, pair) for pair in OFFICIAL_REPOS)


def is_site_repo(cfg):
    return _same_repo(cfg, SITE_REPO)


def refuse_other_official(cfg):
    """The message for an official repository this tool must not write to,
    or None when it may. Split out of main() so check_cli.py can ask it."""
    if is_official(cfg) and not is_site_repo(cfg):
        return ('refusing to publish to %s/%s.\n\n'
                'That is an official repository but it is not the main game, and '
                'everything this tool publishes IS the main game: the cards in '
                'data/json_islands.txt, the pictures in art/, the app and the '
                'front page. Publishing it there would replace that repository\'s '
                'own art with the main game\'s.\n\n'
                'Rebirth publishes from the app: switch the header to Rebirth, '
                'then Help -> Owner Sync -> Publish.' % (cfg.get('owner'), cfg.get('repo')))
    return None


# ---------------------------------------------------------------- catalog read

def load_islands():
    with io.open(ISLANDS, encoding='utf-8') as fh:
        text = fh.read()
    return text


def island(text, name, where=ISLANDS):
    m = re.search(r"<script[^>]*id=['\"]" + name + r"['\"][^>]*>(.*?)</script>",
                  text, re.S)
    if not m:
        sys.exit('could not locate the %s island in %s' % (name, where))
    return json.loads(m.group(1))


def load_keywords():
    with io.open(KWSRC, encoding='utf-8') as fh:
        return island(fh.read(), 'kwdata', KWSRC)


def art_bearers(card):
    """The card plus every variant.

    Mirrors artBearers() in src/editor/ed2_sagas.js. Reading only the active
    variant would skip 93 alternate-art pictures that no one has on screen but
    every consumer still needs.
    """
    return [card] + list(card.get('variants') or [])


def referenced_art(cards):
    """{basename: [(card_name, bearer, field), ...]} for every local reference."""
    refs = {}
    for c in cards:
        for b in art_bearers(c):
            for field in ('art', 'imageUrl'):
                v = b.get(field) or ''
                if not v or v.startswith(('http', 'data:', 'blob:')):
                    continue
                name = os.path.basename(v)
                refs.setdefault(name, []).append((c.get('name', '?'), b, field))
    return refs


# ---------------------------------------------------------------- encoding

def out_name(src_name):
    """art_18.png -> art_18.webp; image980 (no extension) -> image980.webp"""
    stem = re.sub(r'\.[^.]+$', '', src_name)
    return stem + '.webp'


def load_cache():
    try:
        with io.open(CACHE, encoding='utf-8') as fh:
            return json.load(fh)
    except Exception:
        return {}


def save_cache(cache):
    tmp = CACHE + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(cache, indent=1))
    # os.replace, not remove-then-rename: one atomic rename that overwrites,
    # with no window where the cache does not exist, and it works under a
    # sandbox that permits writes but not unlink - which remove+rename does not
    # (it fails there with EPERM after a perfectly good encode). Same change
    # build.py needed for the same reason.
    os.replace(tmp, CACHE)


def encode_all(names, cache, verbose=True):
    """Re-encode every referenced picture. Returns (written, skipped, missing)."""
    from PIL import Image
    outdir = os.path.join(STAGE, 'art')
    os.makedirs(outdir, exist_ok=True)
    written, skipped, missing = [], [], []
    total = len(names)
    t0 = time.time()
    for i, src_name in enumerate(sorted(names), 1):
        src = os.path.join(ARTDIR, src_name)
        if not os.path.isfile(src):
            missing.append(src_name)
            continue
        dst_name = out_name(src_name)
        dst = os.path.join(outdir, dst_name)
        st = os.stat(src)
        key = src_name
        stamp = [int(st.st_mtime), st.st_size, WIDTH, QUALITY]
        if cache.get(key, {}).get('stamp') == stamp and os.path.isfile(dst):
            skipped.append(dst_name)
            continue
        im = Image.open(src)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'transparency' in im.info else 'RGB')
        w, h = im.size
        if w > WIDTH:
            im = im.resize((WIDTH, max(1, round(h * WIDTH / float(w)))),
                           Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=QUALITY, method=4)
        data = buf.getvalue()
        tmp = dst + '.tmp'
        with open(tmp, 'wb') as fh:
            fh.write(data)
        if os.path.exists(dst):
            os.remove(dst)
        os.rename(tmp, dst)
        cache[key] = {'stamp': stamp, 'out': dst_name, 'bytes': len(data)}
        written.append(dst_name)
        if verbose and (i % 100 == 0 or i == total):
            rate = i / max(0.001, time.time() - t0)
            print('    encoded %d/%d  (%.1f/s, %d new, %d cached)'
                  % (i, total, rate, len(written), len(skipped)))
    return written, skipped, missing


# ---------------------------------------------------------------- hashing

def blob_sha(data):
    """git's blob SHA-1: sha1("blob <len>\\0" + bytes).

    The same value GitHub reports for every entry in a tree listing, so a local
    file and a remote one can be compared without downloading anything.
    """
    h = hashlib.sha1()
    h.update(('blob %d' % len(data)).encode('ascii') + b'\x00')
    h.update(data)
    return h.hexdigest()


def hash_tree(root):
    """{repo-relative path: (sha, size, abspath)} for everything under root."""
    out = {}
    for base, _dirs, files in os.walk(root):
        for fn in files:
            # Dotfiles are this tool's own bookkeeping. A .tmp is the debris of
            # an interrupted write and must never reach the repo.
            if fn.startswith('.') or fn.endswith('.tmp'):
                continue
            ab = os.path.join(base, fn)
            rel = os.path.relpath(ab, root).replace(os.sep, '/')
            with open(ab, 'rb') as fh:
                data = fh.read()
            out[rel] = (blob_sha(data), len(data), ab)
    return out


# ---------------------------------------------------------------- payload

def cdn_base(cfg):
    return 'https://cdn.jsdelivr.net/gh/%s/%s@%s' % (
        cfg['owner'], cfg['repo'], cfg.get('branch', 'main'))


def build_payload(cards, cfg, art_present, write_data=True):
    """Write cards.json / keywords.json / manifest.json into the stage.

    Art URLs are rewritten to absolute CDN URLs. They have to be absolute: a
    consumer resolving a relative art/ path would resolve it against their OWN
    folder, which does not have these files. That is the whole point of
    publishing.
    """
    base = cdn_base(cfg)
    rewritten = 0
    dropped = 0
    out_cards = []
    for c in cards:
        o = json.loads(json.dumps(c))       # deep copy, no shared substructure
        for b in art_bearers(o):
            for field in ('art', 'imageUrl'):
                v = b.get(field) or ''
                if not v or v.startswith(('http', 'data:', 'blob:')):
                    continue
                nm = out_name(os.path.basename(v))
                if nm not in art_present:
                    b[field] = ''
                    dropped += 1
                    continue
                if field == 'imageUrl':
                    b[field] = base + '/art/' + nm
                    rewritten += 1
                else:
                    # `art` is an IndexedDB key on the reader's machine, not a
                    # path. Blank it so their ART[] lookup cannot shadow the URL.
                    b[field] = ''
        out_cards.append(o)

    kw = load_keywords()
    # NOTHING here is a clock reading, deliberately. cards.json is ~2 MB and a
    # timestamp would make it a NEW blob on every single run even when not one
    # card had changed - and git keeps every superseded blob forever, so a
    # weekly publish would have added ~100 MB/year of pure noise to history.
    #
    # The whole payload is therefore a pure function of the catalog: identical
    # input gives identical bytes, so publishing twice really is a no-op and
    # "already up to date" means what it says. When the publish happened is
    # already recorded, exactly once, by the commit itself.
    manifest = {
        'name': cfg.get('name', 'Conjure UCG'),
        'format': 2,
        'cardCount': len(out_cards),
        'keywordCount': len(kw),
        'artBase': base + '/art/',
        'artFiles': len(art_present),
        'artEncoding': 'webp q%d, %dpx wide' % (QUALITY, WIDTH),
    }

    os.makedirs(STAGE, exist_ok=True)
    # ⚠ NOT WRITTEN unless the caller asked for the data files. They used to be
    # written unconditionally and deleted again afterwards, which needs unlink
    # permission for no reason and leaves a moment where a half-formed payload
    # is on disk. `look` and `marks` stay null here on purpose: only the app can
    # build them - they live in IndexedDB - and it publishes them as look.json,
    # which this tool deliberately does not own (see OWNED_FILES).
    if write_data:
        write_json(os.path.join(STAGE, 'cards.json'),
                   {'manifest': manifest, 'cards': out_cards, 'look': None, 'marks': None})
        write_json(os.path.join(STAGE, 'keywords.json'), kw)
        write_json(os.path.join(STAGE, 'manifest.json'), manifest)
        write_json(os.path.join(STAGE, 'sagas.json'), saga_index(out_cards))
    return manifest, rewritten, dropped


def saga_index(cards):
    """The sagas this repo publishes, so a reader can list them before it has
    downloaded 2 MB of cards.

    ⚠ `sagaId` is null on every baked card - identity falls back to the saga
    NAME, exactly as sagaIdOf() does in the app. Both sides have to agree on
    that or the groups will not line up.

    ⚠ Author, version and description are NOT here. They live in the editor's
    IndexedDB and this script cannot see them, so it publishes what it can
    derive and the in-app publisher overwrites with the richer copy. The
    derived fields are identical either way, so the two cannot disagree about
    which sagas exist - only about how much is said about them.
    """
    order, counts = [], {}
    for c in cards:
        sid = c.get('sagaId') or c.get('saga') or ''
        if not sid:
            continue
        if sid not in counts:
            order.append(sid)
        counts[sid] = counts.get(sid, 0) + 1
    return [{'id': sid, 'name': sid, 'cardCount': counts[sid], 'derived': True}
            for sid in order]


def write_json(path, obj):
    tmp = path + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(obj, ensure_ascii=False, indent=1))
    # os.replace: one atomic rename that overwrites. See save_cache() - this is
    # the same remove-then-rename that leaves a window with no file at all and
    # fails outright where unlink is not permitted.
    os.replace(tmp, path)


# ---------------------------------------------------------------- github api

class Api(object):
    def __init__(self, token, owner, repo):
        self.token = token
        self.owner = owner
        self.repo = repo
        try:
            import certifi
            self.ctx = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            self.ctx = ssl.create_default_context()
        self.remaining = None

    def call(self, method, path, body=None):
        url = path if path.startswith('http') else (
            '%s/repos/%s/%s%s' % (API, self.owner, self.repo, path))
        data = None
        headers = {
            'User-Agent': UA,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Authorization': 'Bearer ' + self.token,
        }
        if body is not None:
            data = json.dumps(body).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        last = None
        for attempt in range(RETRIES):
            req = urllib.request.Request(url, data=data, headers=headers,
                                         method=method)
            try:
                with urllib.request.urlopen(req, timeout=TIMEOUT,
                                            context=self.ctx) as r:
                    self.remaining = r.headers.get('x-ratelimit-remaining')
                    raw = r.read()
                    return json.loads(raw) if raw else {}
            except urllib.error.HTTPError as err:
                detail = ''
                try:
                    detail = err.read().decode('utf-8', 'replace')[:400]
                except Exception:
                    pass
                # 4xx other than rate-limiting is a real fault; do not retry it
                if err.code in (401, 403, 404, 422) and 'rate limit' not in detail:
                    raise SystemExit('GitHub said %d for %s %s\n%s'
                                     % (err.code, method, url, detail))
                last = SystemExit('GitHub said %d for %s %s\n%s'
                                  % (err.code, method, url, detail))
            except Exception as err:        # noqa: BLE001 - reported, not swallowed
                last = err
            if attempt + 1 < RETRIES:
                time.sleep(2.0 * (attempt + 1))
        raise last

    def budget_ok(self, need):
        if self.remaining is None:
            return True
        try:
            return int(self.remaining) > need + 50
        except ValueError:
            return True


def remote_tree(api, branch):
    """({path: sha}, head commit sha, head tree sha).

    All three are None/empty when the branch does not exist yet. The tree sha
    is needed as a base_tree so an update only has to send what changed.
    """
    try:
        ref = api.call('GET', '/git/ref/heads/' + branch)
    except SystemExit:
        return {}, None, None
    head = ref['object']['sha']
    commit = api.call('GET', '/git/commits/' + head)
    base_tree = commit['tree']['sha']
    tree = api.call('GET', '/git/trees/%s?recursive=1' % base_tree)
    if tree.get('truncated'):
        sys.exit('the remote tree came back truncated - too many files to diff '
                 'in one call. This tool needs a different strategy for a repo '
                 'that large.')
    out = {}
    for e in tree.get('tree', []):
        if e.get('type') == 'blob':
            out[e['path']] = e['sha']
    return out, head, base_tree


def publish(api, cfg, local, remote, head, base_tree, upload, delete):
    branch = cfg.get('branch', 'main')
    print('\nuploading %d blob(s)...' % len(upload))
    shas = {}
    for i, path in enumerate(sorted(upload), 1):
        sha, size, ab = local[path]
        with open(ab, 'rb') as fh:
            data = fh.read()
        if not api.budget_ok(len(upload) - i):
            sys.exit('stopping: GitHub rate limit is nearly exhausted (%s left). '
                     'Nothing has been committed - the tree is written last, so '
                     'the branch is untouched. Re-run in an hour.'
                     % api.remaining)
        res = api.call('POST', '/git/blobs', {
            'content': base64.b64encode(data).decode('ascii'),
            'encoding': 'base64'})
        got = res['sha']
        if got != sha:
            sys.exit('blob sha disagreement for %s: computed %s, GitHub stored '
                     '%s. Refusing to build a tree from a hash this tool cannot '
                     'reproduce.' % (path, sha, got))
        shas[path] = got
        if i % 25 == 0 or i == len(upload):
            print('    %d/%d  (%s)' % (i, len(upload), path))

    # The tree is built in CHUNKS, each layered onto the last with base_tree.
    #
    # This used to send the whole desired file list in ONE request and let
    # anything absent from it be deleted. That is elegant and it does not work:
    # 1833 entries is more than GitHub will process in one call, and it answers
    # 502 Server Error every time. Deletion is now explicit instead - with a
    # base_tree, a null sha removes the path - so each request stays small and
    # only what actually changed is ever sent.
    entries = []
    for path in sorted(upload):
        entries.append({'path': path, 'mode': '100644', 'type': 'blob',
                        'sha': shas[path]})
    for path in sorted(delete):
        entries.append({'path': path, 'mode': '100644', 'type': 'blob',
                        'sha': None})

    print('\nwriting tree: %d change(s) in %d request(s)...'
          % (len(entries), (len(entries) + TREE_CHUNK - 1) // TREE_CHUNK))
    base = base_tree
    for i in range(0, len(entries), TREE_CHUNK):
        body = {'tree': entries[i:i + TREE_CHUNK]}
        if base:
            body['base_tree'] = base
        base = api.call('POST', '/git/trees', body)['sha']
        print('    %d/%d entries' % (min(i + TREE_CHUNK, len(entries)), len(entries)))
    tree = {'sha': base}

    msg = ('Publish catalog: %d art, %d changed, %d removed'
           % (sum(1 for p in local if p.startswith('art/')), len(upload), len(delete)))
    commit_body = {'message': msg, 'tree': tree['sha']}
    if head:
        commit_body['parents'] = [head]
    commit = api.call('POST', '/git/commits', commit_body)

    if head:
        api.call('PATCH', '/git/refs/heads/' + branch, {'sha': commit['sha']})
    else:
        api.call('POST', '/git/refs', {'ref': 'refs/heads/' + branch,
                                       'sha': commit['sha']})
    print('\ncommitted %s to %s' % (commit['sha'][:10], branch))
    return commit['sha']


# ---------------------------------------------------------------- config

def load_config():
    if not os.path.isfile(CONFIG):
        sys.exit(
            'no publish.json found at %s\n\n'
            'Create it (it holds no secrets, only where to publish):\n\n'
            '{\n'
            '  "owner":  "your-github-username",\n'
            '  "repo":   "conjure-catalog",\n'
            '  "branch": "main",\n'
            '  "name":   "Conjure UCG"\n'
            '}\n' % CONFIG)
    with io.open(CONFIG, encoding='utf-8') as fh:
        cfg = json.load(fh)
    for k in ('owner', 'repo'):
        if not cfg.get(k):
            sys.exit('publish.json is missing "%s"' % k)
    return cfg


def load_token(args):
    """Environment or file. Never argv - that lands in shell history."""
    if args.token_file:
        with io.open(args.token_file, encoding='utf-8') as fh:
            return fh.read().strip()
    tok = os.environ.get('GITHUB_TOKEN', '').strip()
    if not tok:
        sys.exit('no token. Set GITHUB_TOKEN in the environment, or pass '
                 '--token-file <path>.\n\n'
                 'Use a fine-grained personal access token scoped to the one '
                 'repo, with Contents: read and write. Nothing else.')
    return tok


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--plan', action='store_true',
                      help='offline: encode and hash, report, touch no network')
    mode.add_argument('--dry-run', action='store_true',
                      help='read the remote tree and show the diff; upload nothing')
    mode.add_argument('--publish', action='store_true', help='upload')
    ap.add_argument('--token-file', help='file holding the PAT')
    ap.add_argument('--data', action='store_true',
                    help='ALSO publish cards.json / keywords.json / sagas.json '
                         'from the BUILT-IN island. Off by default: the island '
                         'has none of the edits stored in the app, so writing '
                         'it over what the in-app Publish button uploaded loses '
                         'every per-card art framing, fit, holo and watermark. '
                         'Use it to seed a brand-new repository, then publish '
                         'card data from the app.')
    args = ap.parse_args()

    # A full encode is minutes long. Unbuffered so progress arrives as it
    # happens, including when the output is piped to a file or a log.
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    cfg = load_config()
    print('target      : %s/%s @ %s' % (cfg['owner'], cfg['repo'],
                                        cfg.get('branch', 'main')))
    # Before anything is read, encoded or fetched - see is_site_repo().
    why = refuse_other_official(cfg)
    if why:
        sys.exit(why)
    print('art source  : %s' % ARTDIR)
    print('stage       : %s\n' % STAGE)

    text = load_islands()
    cards = island(text, 'jdata')
    refs = referenced_art(cards)
    print('cards       : %d' % len(cards))
    print('art referenced by the catalog: %d distinct file(s)' % len(refs))

    print('\n[1/4] encoding art to webp %dpx q%d' % (WIDTH, QUALITY))
    cache = load_cache()
    os.makedirs(STAGE, exist_ok=True)
    written, skipped, missing = encode_all(refs.keys(), cache)
    save_cache(cache)
    print('    %d encoded, %d already current, %d MISSING'
          % (len(written), len(skipped), len(missing)))
    if missing:
        for nm in missing[:10]:
            who = refs[nm][0][0]
            print('      missing %-22s (first referenced by %s)' % (nm, who))
        if len(missing) > 10:
            print('      ...and %d more' % (len(missing) - 10))
        sys.exit('\nrefusing to publish: %d referenced picture(s) are not in art/. '
                 'Publishing now would ship a catalog pointing at art nobody can '
                 'fetch. Restore them first (tools/restore_art.py).' % len(missing))

    art_present = set(os.listdir(os.path.join(STAGE, 'art')))
    print('\n[2/4] building payload')
    manifest, rewritten, dropped = build_payload(cards, cfg, art_present,
                                                 write_data=args.data)
    print('    cards.json     %d cards, %d art URL(s) pointed at the CDN'
          % (manifest['cardCount'], rewritten))
    print('    keywords.json  %d entries' % manifest['keywordCount'])
    if dropped:
        print('    %d art reference(s) blanked - no encoded file' % dropped)

    # ⚠ THE CARD DATA IS NOT UPLOADED UNLESS --data SAYS SO.
    #
    # This tool reads the cards out of data/json_islands.txt - the BUILT-IN
    # island. Everything the author has done in the app since - per-card art
    # framing, fit, holo, watermarks, alternate arts, the frame and rules-split
    # settings - lives in IndexedDB, which no local process can read. So the
    # island's copy of a card is the card WITHOUT any of its framing.
    #
    # Both publishers were writing cards.json, and whichever ran last won. The
    # in-app Publish button uploads the live catalog with all of it; this tool
    # then overwrote that with the bare island, which is why published art never
    # matched what the cards are supposed to look like.
    #
    # The division is the one section 16.6 already states: the button does card
    # data, this tool does art. --data is the escape hatch for seeding a new
    # repository before there is anything in it to lose.
    if not args.data:
        print('    card data NOT staged - art only.')
        print('    Publish cards from the app (Help -> Owner Sync -> Publish):')
        print('    this tool reads the built-in island and cannot see the '
              'per-card art')
        print('    framing, fit, holo or watermarks stored in the app.')
        print('    Pass --data to seed a new repository from the island anyway.')

    print('\n[3/4] hashing the stage')
    local = hash_tree(STAGE)

    # ⚠ A PREVIOUS --data RUN LEAVES ITS FILES IN THE STAGE.
    # hash_tree reports whatever is on disk, so an art-only run would happily
    # upload a cards.json staged weeks ago - reintroducing the very clobber this
    # mode exists to prevent, a stale copy of the built-in island written over
    # what the app published. The stage is not scrubbed (that needs unlink
    # permission this tool does not always have); the files are simply dropped
    # from the payload, which is what "art only" has to mean.
    if not args.data:
        stale = [f for f in OWNED_FILES if f in local]
        for f in stale:
            local.pop(f, None)
        if stale:
            print('    ignoring %d stale data file(s) left in the stage by an '
                  'earlier --data run: %s' % (len(stale), ', '.join(stale)))

    # The official repo also carries the app itself, so someone can get the
    # catalog from the same place they get its cards. Added by ABSOLUTE PATH
    # rather than copied into the stage: it is 58 MB and copying it every run
    # would cost more than the upload.
    #
    # It is deliberately NOT in OWNED_FILES. Owning it would mean deleting any
    # card_catalog.html found in someone else's repo, and what other people keep
    # in their own repositories is not this tool's business.
    #
    # ⚠ is_site_repo, NOT is_official. Both official repositories are "ours";
    # only the main one is the website. See the note above is_site_repo().
    if is_site_repo(cfg):
        cat = os.path.join(ROOT, CATALOG_FILE)
        if os.path.isfile(cat):
            with open(cat, 'rb') as fh:
                data = fh.read()
            local[CATALOG_FILE] = (blob_sha(data), len(data), cat)
            print('    + %s (%.1f MB) - this is the official repository'
                  % (CATALOG_FILE, len(data) / 1048576.0))
        else:
            print('    ! %s not found - run build.py first' % CATALOG_FILE)

        # ⚠ THESE TWO ARE NAGGED ABOUT AND THE README IS NOT, WHICH IS THE
        # DIFFERENCE BETWEEN UNTIDY AND BROKEN. A repository with no README is
        # merely unexplained. A published site with no index.html answers 404
        # at its own domain root, and one with no .nojekyll hands 1830 art
        # files to Jekyll. Both are silent from here - you find out by opening
        # the site - so they say so rather than skipping quietly.
        for site in SITE_FILES + KIT_FILES:
            sp = os.path.join(ROOT, site)
            if os.path.isfile(sp):
                with open(sp, 'rb') as fh:
                    sd = fh.read()
                local[site] = (blob_sha(sd), len(sd), sp)
                print('    + %s (%.1f KB)' % (site, len(sd) / 1024.0))
            else:
                print('    ! %s not found - the published site needs it '
                      '(see PUBLISHING.md 1.2)' % site)

        # A published repository that explains nothing about itself is a poor
        # front door. These are carried up if they exist locally, and are NOT in
        # OWNED_FILES - so a repo that has its own README keeps it, and one that
        # has none is not nagged about it.
        for extra in ('README.md', 'LICENSE', 'LICENSE.md', 'LICENSE.txt'):
            ep = os.path.join(ROOT, extra)
            if os.path.isfile(ep):
                with open(ep, 'rb') as fh:
                    ed = fh.read()
                local[extra] = (blob_sha(ed), len(ed), ep)
                print('    + %s (%.1f KB)' % (extra, len(ed) / 1024.0))

    total = sum(sz for _sha, sz, _ab in local.values())
    print('    %d file(s), %.2f GB' % (len(local), total / 1024.0 ** 3))
    if total > SIZE_CEILING:
        sys.exit('refusing to publish: the payload is %.2f GB, past the %.2f GB '
                 'ceiling this tool enforces. GitHub asks for repos under 1 GB.'
                 % (total / 1024.0 ** 3, SIZE_CEILING / 1024.0 ** 3))

    if args.plan:
        print('\n[4/4] plan only - no network touched')
        art_bytes = sum(sz for p, (_s, sz, _a) in local.items()
                        if p.startswith('art/'))
        print('    art      %6d file(s)  %.2f GB' % (
            sum(1 for p in local if p.startswith('art/')),
            art_bytes / 1024.0 ** 3))
        print('    data     %6d file(s)  %.2f MB' % (
            sum(1 for p in local if not p.startswith('art/')),
            sum(sz for p, (_s, sz, _a) in local.items()
                if not p.startswith('art/')) / 1024.0 ** 2))
        print('\nrun --dry-run to compare this against the repo.')
        return

    token = load_token(args)
    api = Api(token, cfg['owner'], cfg['repo'])
    branch = cfg.get('branch', 'main')

    print('\n[4/4] comparing against %s/%s @ %s' % (cfg['owner'], cfg['repo'], branch))
    remote, head, base_tree = remote_tree(api, branch)
    print('    remote holds %d file(s)%s'
          % (len(remote), '' if head else ' (branch does not exist yet)'))

    upload = sorted(p for p in local if remote.get(p) != local[p][0])
    # Delete only what this tool OWNS. It used to delete everything in the repo
    # that was not in its payload, which ate the LICENSE and README.md GitHub
    # creates with a new repository - see the first publish's commit message,
    # "1830 art, 1833 changed, 2 removed". Anything a human puts in the repo
    # alongside the payload is none of this tool's business.
    #
    # ⚠⚠ WITHOUT --data THIS TOOL OWNS NO DATA FILE.
    # Deletion is by OMISSION: anything owned and not staged is removed from the
    # repository. An art-only run stages no cards.json, so leaving OWNED_FILES
    # in this test would have deleted the published catalog, its keywords and its
    # saga index on the first art upload - the exact failure the LICENSE/README
    # note above records, aimed at the payload this time. A file can only be
    # deleted by the run that is also able to write it.
    owned_files = OWNED_FILES if args.data else ()
    delete = sorted(p for p in remote
                    if p not in local
                    and (p.startswith(OWNED_DIRS) or p in owned_files))
    kept = sorted(p for p in remote if p not in local and p not in delete)
    same = len(local) - len(upload)

    print('\n    upload    %d' % len(upload))
    print('    delete    %d' % len(delete))
    print('    unchanged %d' % same)
    if kept:
        print('    left alone %d (not this tool\'s files): %s'
              % (len(kept), ', '.join(kept[:6]) + (' ...' if len(kept) > 6 else '')))
    for p in upload[:8]:
        print('      + %s' % p)
    if len(upload) > 8:
        print('      ...and %d more' % (len(upload) - 8))
    for p in delete[:8]:
        print('      - %s' % p)
    if len(delete) > 8:
        print('      ...and %d more' % (len(delete) - 8))

    if args.dry_run:
        print('\ndry run - nothing uploaded')
        return

    if not upload and not delete:
        print('\nalready up to date - nothing to do')
        return

    up_bytes = sum(local[p][1] for p in upload)
    print('\nabout to upload %.2f GB in %d request(s), then one commit.'
          % (up_bytes / 1024.0 ** 3, len(upload) + 3))
    publish(api, cfg, local, remote, head, base_tree, upload, delete)
    print('\nart is served from %s' % manifest['artBase'])
    print('point a saga source field at:')
    print('  https://raw.githubusercontent.com/%s/%s/%s/cards.json'
          % (cfg['owner'], cfg['repo'], branch))


if __name__ == '__main__':
    main()
