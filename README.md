# Conjure UCG - Card Catalog

The card database for Conjure, a trading card game by Conjure UCG LLC.

This repository holds the published set: every card, its rules text and stats,
the keyword glossary, and web-sized art for all of it. It is generated - nothing
here is edited by hand. It is also the website: playconjure.com is served from
here.

Plain ASCII on purpose, so no editor can reformat it.

---

## What is in here

| File | What it is |
|---|---|
| `cards.json` | Every card. Names, costs, stats, rules text, and the art of each printing |
| `sagas.json` | Which sets ("sagas") this repository publishes, and how big each is |
| `keywords.json` | The keyword, keyterm, counter and dice glossary |
| `look.json` | The official look (keyword pill styles, template pictures) and the watermarks |
| `testing.json` | Cards still being tested. The app does not show them to anyone using it normally |
| `manifest.json` | Card and keyword counts, and where the art is served from |
| `art/` | Web-sized card art, WebP at 1600px wide |
| `art-uploads/` | Pictures added from inside the app, WebP at most 1600px wide |
| `card_catalog.html` | The catalog app itself - open it in a browser |
| `index.html` | The front page of playconjure.com |
| `cards.html` | Every card as a plain page that search engines can read; each name opens that card in the app |
| `sitemap.xml`, `robots.txt` | What search engines should read |

Art is served through jsDelivr:

```
https://cdn.jsdelivr.net/gh/ConjureUCG/Conjure_Card_Catalog@main/art/
```

---

## Just want to browse the cards?

Open playconjure.com, or download `card_catalog.html` and open it. That is the
whole install: browsing, searching, filtering, deck building and a card editor,
in one file, with no account.

The cards are not inside the file. It reads them from this repository when it
opens - so the first open needs the internet - and keeps them in your browser.
Card art loads straight from this repository's CDN. Nothing to set up and
nothing to press.

The Rules and Design documents are read from their Google Docs when you open
them, rather than being built into the file - so they are never out of date,
and they need the internet. A document you have opened before is kept, and is
shown with the date on it if it cannot be reached.

---

## Following the set

The catalog already knows this address:

```
https://raw.githubusercontent.com/ConjureUCG/Conjure_Card_Catalog/main/cards.json
```

It shows up as "Official" on the Sagas page with no setup, and the link is shown
there but cannot be edited - so you can always see where your cards came from.

When new cards or a whole new saga are published here, the app takes them as it
opens - there is nothing to press. Cards removed here are removed from your copy
too. It stops and asks first in one case only: when the update would overwrite a
card **you** are allowed to edit, because applying it replaces your own work in
any field the source also sets. On an ordinary copy the official cards are
read-only, so that never comes up.

You can switch this off on the Owner Sync page ("Enable Automatic Updates on
Open"), and it never runs by itself in owner mode.

Each set has its own on/off switch, and each repository has a master switch, so
you can exclude a whole source without losing which individual sets you had
turned on.

---

## Making your own set

The same app publishes anyone's cards, not just ours. You need a public GitHub
repository and a fine-grained access token limited to it, then point the Owner
Sync page at it.

Anyone can then follow your set from the Follow row at the foot of the Sagas
page. It becomes its own group in their catalog, alongside Official, with its
own on/off switch. Publishing your set does not ship a copy of the app - that
only happens for the official repository.

---

## Using the data directly

`cards.json` is plain JSON, shaped:

```json
{
  "manifest": { "name": "...", "cardCount": 1592, "artBase": "https://..." },
  "cards": [ { "name": "...", "manaCost": "...", "ruleText": "...", "imageUrl": "",
               "variants": [ { "id": "v1", "imageUrl": "https://..." } ] } ],
  "look": null,
  "marks": null
}
```

A card's picture is on its variants (its printings). Every `imageUrl` that is
set is an absolute CDN address, so you can build against this without cloning
anything.

---

## A note on the art

What is here is a web-sized copy: WebP at 1600px wide, about 0.29 GB for 1830
pictures. The print-resolution originals are roughly 8 GB and are not published.

If you are the set's owner and have those originals in an `art/` folder beside
the app, turn on **owner mode** on the Owner Sync page. Cards then draw from
your own files instead of the CDN, and keep working with no internet.

---

## Two games in one file

The app carries **Conjure** and **Conjure Rebirth**, switched by a toggle in the
header. They are separate games and share no data at all: separate card
databases, separate saved decks, separate sets.

A saga belongs to exactly one of them and never crosses over. This repository
publishes the main game. Rebirth's official set comes from its own repository,
ConjureUCG/Conjure_Rebirth_Catalog, which the app follows the same way when it
is in Rebirth.

---

## Licence

Not yet chosen. Until one is added here, all rights are reserved by
Conjure UCG LLC - please ask before redistributing the card data or the art.
