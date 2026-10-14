# Conjure UCG - Card Catalog

Catalog · Deck Builder · Digital Tabletop

## Rules and Design Documentaion

Any Rules and Design documentation are sync with the Live Google Docs

Main Rules
```
https://docs.google.com/document/d/1vzLQ9KgSXl2yDXYujoO-mojf5xwyCm058ErZQTnS5dk/edit?usp=sharing)
```

Main Design
```
https://docs.google.com/document/d/1vzLQ9KgSXl2yDXYujoO-mojf5xwyCm058ErZQTnS5dk/edit?usp=sharing)
```

Rebirth Rules
```
https://docs.google.com/document/d/1LVBez910a6SfVtRwCzIbtKuB8KmYI88e/edit?usp=sharing&ouid=107803157592510169473&rtpof=true&sd=true
```

Rebirth Design
```
https://docs.google.com/document/d/1KMIThypVuAIer4Gqmkc8bwbZqzmEwla4/edit?usp=sharing&ouid=107803157592510169473&rtpof=true&sd=true
```

---

## File Contents

| Filename | Definition |
|---|---|
| `cards.json` | name, cost, stat, rules text, art |
| `sagas.json` | Sagas - Sets of cards |
| `keywords.json` | keyword, keyterm, counter glossary |
| `look.json` | Default looks - pill styles, templates, watermarks |
| `manifest.json` | Card and keyword counts, where the art is sourced |
| `art/` | Web-sized card art, WebP at 1600px wide |
| `art-uploads/` | WebP - 1600px wide |
| `card_catalog.html` | Website File |
| `index.html` | Homepage |
| `cards.html` | Cards in plain text - Used for searches |
| `sitemap.xml`, `robots.txt` | What search engines read |

Art is served through jsDelivr:
```
https://cdn.jsdelivr.net/gh/ConjureUCG/Conjure_Card_Catalog@main/art/
```
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

You can use the website to self publish cards, user other people's cards, and curate your own sets

To publish and host your own set, you need to set up a public GitHub repo, using a fine-grained access token as access to editing and updating your set. Then use that GitHub repo as the link for others to use to be able to use and play with your Cards and Sagas.

---

## Using the data directly

`cards.json` format:

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
