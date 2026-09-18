# Conjure UCG - Card Catalog

The card database for Conjure, a trading card game by Conjure UCG LLC.

This repository holds the published set: every card, its rules text and stats,
the keyword glossary, and web-sized art for all of it. It is generated - nothing
here is edited by hand.

Plain ASCII on purpose, so no editor can reformat it.

---

## What is in here

| File | What it is |
|---|---|
| `cards.json` | Every card. Names, costs, stats, rules text, and an image URL per card |
| `sagas.json` | Which sets ("sagas") this repository publishes, and how big each is |
| `keywords.json` | The keyword, keyterm, counter and dice glossary |
| `manifest.json` | Card and keyword counts, and where the art is served from |
| `art/` | Web-sized card art, WebP at 1600px wide |
| `card_catalog.html` | The catalog app itself - open it in a browser |

Art is served through jsDelivr:

```
https://cdn.jsdelivr.net/gh/ConjureUCG/Conjure_Card_Catalog@main/art/
```

---

## Just want to browse the cards?

Download `card_catalog.html` and open it. That is the whole install: browsing,
searching, filtering, deck building, the full rules document and a card editor,
in one file, with no account.

Card art loads straight from this repository's CDN, so the cards have pictures
the moment you open it. Nothing to set up and nothing to sync first.

---

## Following the set

The catalog already knows this address:

```
https://raw.githubusercontent.com/ConjureUCG/Conjure_Card_Catalog/main/cards.json
```

It shows up as "Official" on the Sagas page with no setup, and the link is shown
there but cannot be edited - so you can always see where your cards came from.

When new cards or a whole new saga are published here, the app tells you and you
click to take them. New cards can arrive on their own once a week; changes to
cards you already have always wait for you to approve them, because applying an
update overwrites your own edits to any field the source also sets.

Each set has its own on/off switch, and each repository has a master switch, so
you can exclude a whole source without losing which individual sets you had
turned on.

---

## Making your own set

The same app publishes anyone's cards, not just ours. You need a public GitHub
repository and a fine-grained access token limited to it, then point the Owner
Sync page at it.

Your set becomes its own group in everyone's catalog, alongside Official, with
its own on/off switch. Publishing your set does not ship a copy of the app -
that only happens for the official repository.

---

## Using the data directly

`cards.json` is plain JSON, shaped:

```json
{
  "manifest": { "name": "...", "cardCount": 1601, "artBase": "https://..." },
  "cards": [ { "name": "...", "manaCost": "...", "ruleText": "...", "imageUrl": "https://..." } ],
  "look": null,
  "marks": null
}
```

Every `imageUrl` is an absolute CDN address, so you can build against this
without cloning anything.

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
publishes the main game; Rebirth has no published set, so in Rebirth the app has
no official source, shows no Official group, and checks nothing on open.

---

## Licence

Not yet chosen. Until one is added here, all rights are reserved by
Conjure UCG LLC - please ask before redistributing the card data or the art.
