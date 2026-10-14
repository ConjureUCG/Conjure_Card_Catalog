# Conjure UCG - Card Catalog

Card database for Conjure

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

## Rules and Design Documentaion

Any Rules and Design documentation are sync with the Live Google Docs.

Main Rules
```
[[https://raw.githubusercontent.com/ConjureUCG/Conjure_Card_Catalog/main/cards.json](https://docs.google.com/document/d/1vzLQ9KgSXl2yDXYujoO-mojf5xwyCm058ErZQTnS5dk/edit?usp=sharing)](https://docs.google.com/document/d/1vzLQ9KgSXl2yDXYujoO-mojf5xwyCm058ErZQTnS5dk/edit?usp=sharing)
```

Main Design
```
[https://raw.githubusercontent.com/ConjureUCG/Conjure_Card_Catalog/main/cards.json](https://docs.google.com/document/d/1vzLQ9KgSXl2yDXYujoO-mojf5xwyCm058ErZQTnS5dk/edit?usp=sharing)
```

Rebirth Rules
```
https://docs.google.com/document/d/1LVBez910a6SfVtRwCzIbtKuB8KmYI88e/edit?usp=sharing&ouid=107803157592510169473&rtpof=true&sd=true
```

Rebirth Design
```
[[https://raw.githubusercontent.com/ConjureUCG/Conjure_Card_Catalog/main/cards.json](https://docs.google.com/document/d/1vzLQ9KgSXl2yDXYujoO-mojf5xwyCm058ErZQTnS5dk/edit?usp=sharing)](https://docs.google.com/document/d/1KMIThypVuAIer4Gqmkc8bwbZqzmEwla4/edit?usp=sharing&ouid=107803157592510169473&rtpof=true&sd=true)
```

The Rules and Design documents are read from their Google Docs when you open
them, rather than being built into the file - so they are never out of date,
and they need the internet. A document you have opened before is kept, and is
shown with the date on it if it cannot be reached.

---

## Following New Sagas

The website has the official Conjure sets built in

```
https://raw.githubusercontent.com/ConjureUCG/Conjure_Card_Catalog/main/cards.json
```

It shows up as "Official" on the Sagas page.

Each Saga has its own on/off switch, and each repository has a master switch, so
you can exclude a whole source without losing which individual sets you had
turned on.

---

## Making your own set

The same app publishes anyone's cards, not just ours. You need a public GitHub
repository and a fine-grained access token limited to it, then point the Owner
Sync page at it.

Anyone can then follow your set from the Follow row at the foot of the Sagas
page. It becomes its own group in their catalog, alongside Official, with its
own on/off switch.

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
---

## A note on the art

What is here is a web-sized copy: WebP at 1600px wide, about 0.29 GB for 1830
pictures. The print-resolution originals are roughly 8 GB and are not published.

If you are the set's owner and have those originals in an `art/` folder beside
the app, turn on **owner mode** on the Owner Sync page. Cards then draw from
your own files instead of the CDN, and keep working with no internet.

---

## Main Version and Rebirth Version

The website hosts both the main version of Conjure and **Conjure Rebirth**, which is the Table Top Role Playing Game version of Conjure.

Both versions are separate, such as cards, Sagas, rules, etc. But both versions can be hosted in the same framework, but otherwise are separate games.

---

## License - "Open Game License"

If you adhere to these terms, you are allowed to publish works based upon and/or declare compatibility with CONJURE without express permission from Conjure UCG, LLC (“Conjure,” “we,” “us,” or “our”).

You agree not to copy or reproduce any official art unless you have our explicit permission in writing.

You may use our visual designs as inspiration to create your own original illustrations or works.

You can reuse and freely reference the CONJURE text, mechanics, and game rules, including proper names, locations, and characters.

Your product cannot use the Conjure logo or Conjure UCG, LLC logo unless you have our explicit permission in writing.

You are allowed and encouraged (but not required) to use the CONJURE compatibility logo.
