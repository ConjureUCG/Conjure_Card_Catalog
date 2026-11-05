# Conjure UCG - Card Catalog

Catalog · Deck Builder · Digital Tabletop\
Conjure UCG LLC.

This repository holds the published set, and the website: playconjure.com\
Source code - `src/` & `data/`

- [What is in here](#what-is-in-here)
- [Just want to browse the cards?](#just-want-to-browse-the-cards)
- [Following a set](#following-a-set)
- [Making your own set](#making-your-own-set)
- [Looking after your set](#looking-after-your-set)
- [Using the data directly](#using-the-data-directly)
- [A note on the art](#a-note-on-the-art)
- [Two games in one file](#two-games-in-one-file)
- [Source code](#source-code)
- [Licence](#licence)

---

## Contents

| File | Details |
| --- | --- |
| `cards.json` | Card information data |
| `sagas.json` | Sagas this repository publishes - labeled "Official" on the website |
| `keywords.json` | keyword, keyterm, counter and dice glossary |
| `look.json` | "Look" settings for keyword pill styles, template pictures and watermarks |
| `colour_lists.json` | Lists the app's Statistics compares with |
| `manifest.json` | Card and keyword counts, and art source |
| `art/` | WebP - 1600px wide |
| `art-uploads/` | Pictures added from the app |
| `card_catalog.html` | The website page itself |
| `index.html` | Landing page |
| `CNAME`, `.nojekyll` | GitHub Pages to serve this repository |
| `src/` | Source code |
| `data/` | Source data, color and number icons, color values |

Art is served through jsDelivr:

```
https://cdn.jsdelivr.net/gh/ConjureUCG/Conjure_Card_Catalog@main/art/
```

---

## Browsing Cards

Open playconjure.com and press Main or Rebirth, or download `card_catalog.html` and open it. That is the whole install: browsing, searching, filtering, deck building and a card editor, in one file, with no account.

The cards are not inside the file. It reads them from this repository when it opens - so the first open needs the internet - and keeps them in your browser. Card art loads straight from this repository's CDN. Nothing to set up and nothing to press.

The Rules and Design documents are read from their Google Docs when you open them, rather than being built into the file - so they are never out of date, and they need the internet. A document you have opened before is kept, and is shown with the date on it if it cannot be reached.

---

### Mobile

Some features are not supported on Mobile. Import, Export, Play Test and Play Online, and Keywords is read-only. The Sagas page, the Editor and Owner Sync are there.

---

### To know

- **When** the app is open in two tabs it says "This app is open in another tab as well. Each tab keeps its own copy of the cards, so edits made in two tabs overwrite each other - close the other tab before editing here."
- **Copy link** in a card's window gives an address that opens that card: `card_catalog.html?card=...`, with `&game=rebirth` in Rebirth. For unofficial cards, this only works for people who follow your set. Anyone else sees "No card in this catalogue matches the link (...)."
- A Saga someone sends you on an online table (**Get from Host**) arrives as a read-only copy, in a group named "From ..." with a Table Copy tag. (When playing online with other people who are using cards you don't follow).

## Following a set

### The address to paste

Sets are followed by the address of its `cards.json`:

```
https://raw.githubusercontent.com/OWNER/REPOSITORY/BRANCH/cards.json
```

Ask the set's creator for theirs. Paste it into the box at the bottom of the "**Sagas**" page and press "**Follow**".

A github.com page address does not work there. It has to be the `raw.githubusercontent.com` address of the `cards.json` file itself.

If you try to follow a Main or Rebirth Saga in the wrong version, it will throw back an error (change versions and try again).

### List of Sagas

The official set shows up as "Official". Its address is shown there but cannot be edited - so you can always see where your cards came from.

A set you follow becomes a group of its own on the same page, named after its repository (`OWNER/REPOSITORY`). The group has:

- its address, shown but not editable;
- an **Enabled** switch for the whole group, and one on each Saga in it, so you can switch a whole source off without losing which sagas you had on;
- **Check now**, **Apply update** when an update is waiting, and **Stop following**;
- when it was last checked and last synced.

Cards you follow are read-only. The card window offers **Duplicate** in place of **Edit**. The set's keywords and the watermarks its cards wear come with it. None of them replaces an official keyword or watermark, or one of your own. Its look does not come: you see its cards in your own frames and pill styles.

Each of its Sagas brings its author, version and description. A Saga can also hold official cards. Each of those is your own official card, put in that Saga: it keeps following the official version, and in that Saga it shows the flavor text, artist, picture.

Official cards can be stored in unofficial Sagas, however only non-functions things about the card can be changed, to be unique to the unofficial Saga. Such as custom artwork and flavor text.

### Following Errors

A set that could not be read still gets a row on the Sagas page. "**Stop following**" to remove it.

| Error | Fix |
| --- | --- |
| "the server answered 404" | The address is wrong, the repository is private, or nothing has been published there yet. Check the address with its creator. |
| "could not reach it. Either the address is wrong or the machine is offline, or the server does not allow cross-origin requests ..." | Check that you are online. A github.com page address gives this too: use the raw `cards.json` address. |
| "what came back is neither a Saga .zip nor JSON." | The address is a web page, not the `cards.json` file. |
| "no cards in what came back." | The file holds no cards. Tell its creator. |

Some addresses are refused before anything is read:

| Error | Fix |
| --- | --- |
| "The catalog is open as a file, so the page is not allowed to make requests. ..." | A copy opened as a file can only read `raw.githubusercontent.com` and `cdn.jsdelivr.net` addresses. Use one of those, or use playconjure.com. |
| "The source must be a full http:// or https:// URL." | Paste the whole address, starting `https://`. |
| "This page is https and the source is http. ..." | Use the `https://` address. |

---

## Making your own set

The same app publishes anyone's cards. You make your cards in the app, and its **Publish** button writes them to a GitHub repository. Anyone can then follow your set once it's published, then it becomes its own group in their catalog.

### What you need

- A GitHub account
- A **public** repository for your set. jsDelivr, the CDN the pictures come through
- A **fine-grained access token**, with **Contents: Read and write** and nothing else
- The app open at an `http://` or `https://` address

### 1. Make the repository

On GitHub, make a new repository and set it to **Public**. It can be empty. The first Publish starts an empty repository with a short README of its own, and never touches that README again, so you can rewrite it on GitHub to describe your set.

Choose its owner and name with care. Every address the app publishes has them in it, and the app takes many additional sets to change (see [Renaming or moving the repository](#renaming-or-moving-the-repository)).

Keep all your Sagas in this one repository. A copy of the app treats only one repository as yours: the one named in its Owner Sync. Point it at another, and to that copy the first becomes someone else's set, with its cards read-only.

### 2. Create a GitHub Token

On GitHub: **Settings**, then **Developer settings**, then **Personal access tokens**, then **Fine-grained tokens**, then **Generate new token**.

- Repository access: **Only select repositories**, and pick your set's repository.
- Permissions: **Contents**, "**Read and write**" **only**.
- Expiration - Once the token is expired, you will need to create a new one.

Do not save your token in any file that might get published to your repository, delete and create a new one if you believe your token has ever become public.

### 4. Making Your Own Cards and Sagas

**Cards.** On the **Editor** tab, press "**New card**". By default cards are added to your Saga that you've filtered by, otherwise the one you last made a card in, or by default cards are under the Saga "My Cards".

You may include Official cards in your Saga. An official card's window also offers "**Add to**" and the Saga's name, beside **Copy link**.

You can use "Mass edit" (at the top of the Sagas page) to move every card in a Saga, or in the current filter results, to another Saga, change "Owner", "Revision" or "Artist".

**Pictures.** In the editor's art panel, **Upload** takes a picture from your computer. "**+** adds another look of the card": add additional artwork to that card. **Watermark** and **Color** finish the face.

Custom Keywords: On the "**Keywords**" page, "**Add entry**": open it, name it, and give it its reminder text. Typing that keyword on cards will automatically format it to your look, and you can toggle reminder text for each keyword on a card.

## Custom Looks

Frame templates, keyword pill styles, watermarks, etc. - belongs to your copy of the app, not a set. Publish writes yours to `look.json`, but no copy of the app applies a followed set's look: followers see your cards in their own frames and pill styles. However Watermarks are carried with your set.

### 5. Fill in Owner Sync

Press **Owner Sync** at the top of the Sagas page. Its lower half, **Publish to GitHub**, is where you publish from.

- Fill in your GitHub information on the "Owners Sync" page (Top right of the "Sagas" page). Leave the branch as `main` (unless you made another).
- **Access token** - paste your token Fine-grained token for your repository here. You have to type in your token each time you wish to publish anything.

Repository Codes:

| It says | Meaning |
| --- | --- |
| "OWNER/REPO: this token can push here, branch "main"." | Ready to publish. |
| "OWNER/REPO: this token cannot push here, ..." | The token can read the repository but not write to it. Needs **Contents: Read and write** access. |
| "... - the repository is empty." | First publish will populate your repository. |
| "... - no branch "X" (the default branch is "Y")." | Typo, or non-existent branch. |
| "OWNER/REPO: GitHub said 404 - no such repository, or the token cannot see it." | Check the names, and that the token was given this repository. |
| "OWNER/REPO: GitHub said 401 - the token is wrong or has expired." | Make a new token (see [The token](#the-token)). |

### 6. Preview, What changed and Publish

- "**Preview changes**" says which files would be uploaded: "Would upload: cards.json, ... Nothing else is touched." or "Already up to date - the repository matches this catalog."
- "**What changed...**" says which cards differ from the ones already published, and in which fields. Its lines are New, Changed (with the fields), Gone, and for Test cards Removed (Testing), Test New, Test Changed and No Longer Test.
- "**Publish**" writes it.

The Sagas you publish are every Saga under **Not linked** on your Sagas page - "My Cards" too, if it has cards - and the Sagas already published to this repository.

Publish adds and replaces files, but never deletes any. A file is uploaded only when something was changed.

**As it publishes:**

- An empty repository first gets its README: "Starting the empty repository with a README...".
- A branch that does not exist yet opens a window, 'There is no branch "X"'. Press 'Create "X" from "Y" and publish to it' (the new branch starts at Y's latest commit), or **Close**, which gives "Cancelled - nothing was published."
- A publish that would remove published cards stops first: "This publish removes N published card(s)", naming the first eight, and "Anyone following this set gets the removal the next time they sync." Type "REMOVE" to go on. A card you turned into a Test card is not counted.
- Then "Uploading picture 1 of N..." for each new picture, "Uploading N file(s)...", "Committing..." and "Published. Commit XXXXXXXXXX." The commit is named "Publish from the app: N file(s)". With more than 150 new pictures, each line names its part ("Uploading part 1 of 3: picture 1 of 150..."), each commit is named "Publish from the app, part 1 of 3: N file(s)", and the last line adds "The pictures went up in 3 parts."

### 7. Share the address

Hand out the address shown in your group on the Sagas page:

```
https://raw.githubusercontent.com/OWNER/REPOSITORY/BRANCH/cards.json
```

It has your username, repository and branch in it, as they are on your Repository row. People paste it into the "Follow" box. At an online table, a player who does not have your published Saga is offered **Follow** under **Sync Cards with Host**.

Your followers get your cards and Sagas, read-only, with each Saga's author, version and description, the pictures from your repository, your keywords and the watermarks your cards use. An official card in one of your Sagas joins their own official card to that Saga, with your Saga's values on it.

---

### Backups

Cards are stored in your browser, on this computer, at this address only. Another browser, another computer or another address has its own separate copy. Clearing the browser's data for the site deletes them. The app asks the browser to keep its data, but a backup file is the copy you control.

A publish is not a full backup. The repository gets web-sized copies of your pictures, and the app has no way to bring your look back from it.

- **Export** (top of the page), **Full Backup (.zip)**. **Complete backup**, every picture included. **Cards only** is the same without the pictures (Much smaller).
- **Import**, **Full Backup (.zip)**, **Restore a backup...**. A restore replaces every card. It offers to back up what you have now, then asks you to type "REPLACE".
- A backup does not hold your access token or your Owner Sync settings.

### Working on a New Computer

With a backup, which keeps your look and full-size pictures too:

1. On the old computer, publish, then make a **Complete backup**.
2. On the new one, open the app at the address you will keep using.
3. **Import**, **Full Backup (.zip)**, **Restore a backup...**, then type "REPLACE".
4. In Owner Sync, fill in the Repository row and paste your token.

Steps 3 and 4 can come in either order. Until the Repository row names your repository, that copy treats your set as someone else's, and its cards are read-only there.

Without a backup, you can start from what you published. Fill in the Repository row and paste the token, then **Follow** your own address on the Sagas page and press **Apply update** on its group. You get your published cards and Test cards back, with the web-sized pictures and the watermarks they wear. Your keywords come back for the cards to show, but not as entries you can edit on the Keywords page. Your look, the full-size pictures and anything you had not published stay on the old computer.

---

### Removing Cards and Sagas

- **Delete cards** using the editor. The next Publish asks you to type "REMOVE" before you can publish.
- If your publish removes more than 20 cards, and that is more than a tenth of what a follower has from you, their copy treats it as a broken publish and removes none of them. They can **Stop following** and **Follow** again to get a clean copy.
- **Deleting a Saga**, on its row on the Sagas page. It offers a backup first, then asks you to type "DELETE". Your next Publish takes its cards out of your repository, but followers keep the Saga, because it is no longer in your set. Once you delete a Saga, only your followers can delete their version themselves.

### Renaming or Moving Your Saga (GitHub Repository)

Choose the owner and name before your first publish, and keep them. They are in every address the app publishes: the `cards.json` address your followers use, and the address of each of your pictures. The app has no step for moving a set to a new address. A follower can only change one by pressing **Stop following** and following the new address.

### GitHub Repository Size

GitHub asks for repositories under 1 GB. Most Saga data is from images. Every publish that changes `cards.json` adds a new copy of it to the history, and a replaced picture stays in the repository too.

If the history grows too big, it can be collapsed with git, from a clone of the repository (use your branch in place of `main`):

```
git checkout --orphan fresh
git add -A
git commit -m "Catalog"
git push -f origin fresh:main
```

**WARNING - that rewrites history.** Fine for a repository of cards that nobody develops in. Never do it to one that holds code. Do not move the pictures to Git LFS: the CDN would serve LFS's pointer files instead of the pictures.

### GitHub Rate Limits

GitHub limits how many requests a token can make in an hour, and how many new files it may write: about 80 a minute and 500 an hour. A publish makes about one request for each file it uploads. If you hit the limit it says "GitHub said 403 - GitHub's rate limit was reached. Try again in ..." with how long to wait. A publish with more than about 500 new pictures can reach the limit for an hour: it stops part-way, and Publish an later to send the rest.

### When publishing goes wrong

| Error | Fix |
| --- | --- |
| "Set your GitHub username and repository first." | Fill in the Repository row in Owner Sync. |
| "Add an access token first. It needs Contents: read and write on that repository." | Paste your token in Owner Sync. |
| "Paste your access token again: it is kept only while this page is open." | The page was reloaded or opened again since you gave it. Paste it again. |
| "The catalog is open as a file, so the page is not allowed to make requests. ..." | Open the app over http or https (step 3). |
| "GitHub said 401 - the token is wrong or has expired." | Make a new token, press Forget it, and paste the new one. |
| "GitHub said 403 - the token does not have Contents: read and write on this repository." | Make a token with Contents: Read and write on this repository. |
| "GitHub said 404 - no such repository, or the token cannot see it." | Check the Repository row, and that the token was given this repository. |
| "GitHub said 403 - GitHub's rate limit was reached. Try again in ..." | Wait as long as it says. |
| "This copy holds none of the cards published there. Follow that set and let it update before publishing to it. Nothing was committed." | The repository holds a set this copy has none of: a mistyped repository, or a new computer. Check the names, or follow your set first (see [Moving to a new computer](#moving-to-a-new-computer)). |
| "Publish stopped part-way: ... Part 1 of 3, pictures only, is in the repository, but no card is published yet. Press Publish again to send the rest." | Fix what the message names, then press Publish again. It sends only what is not there yet. |
| "Publish stopped: the connection failed while the branch was being moved to part 2 of 3 (...). No card is published yet. ..." | Press Publish again: a picture already there is not sent twice. |
| "GitHub said 422 - the branch moved while this was publishing ..." | Something else published to the branch at the same moment. Press Publish again. |
| "GitHub said 502 - GitHub could not build that request. ..." | A request was too big for GitHub. The branch is untouched. Try again. |
| "GitHub said 503 - GitHub had a problem of its own. Try again in a minute." | GitHub's side. Try again in a minute. |
| "Publish may have gone through: the connection failed while the branch was being moved ..." | Press Publish again. |
| "GitHub stored a different hash for ... Refusing to build a tree from it." | Press Publish again. |
| "Could not read what is published, so the removal check could not run: ..." | Fix what the rest of the message names. Nothing was committed. |
| "Publish failed: ... Nothing was committed - the tree and commit are written last, so the branch is untouched." | Press Publish again. |
| "NOT saved - ..." | The browser refused to store a change. Make a backup at once (Export, then Cards only). A full store is usually the pictures. |
| "The picture could not be stored in this browser (...), so the card keeps its old one." | The browser has no more room for pictures. |

---

### Rebirth

The app carries **Conjure** (Main) and **Conjure Rebirth**, switched by a toggle on the header. They are separate games and share no data, other than being hosted on the same website.

Features are not "Cross Compatible", and trying to use data from the wrong version will throw back error messages (Such as trying to use a backup from the wrong version).

- To make and publish a Rebirth set with the header switched to Rebirth. The switch reloads the page, so paste the token again after it.
- Rebirth keeps its own cards, Sagas, followed sets and Owner Sync settings.
- Give it its own repository, or at least its own branch. Both games publish the same file names, so one branch cannot hold a set of each.
- To follow a Rebirth set, you have to switch to Rebirth before you try to follow the set. Trying to follow a Main or Rebirth set on the wrong page will refuse the request.

---

## Data

`cards.json` is plain JSON, shaped:

```json
{
  "manifest": { "name": "...", "cardCount": 1591, "artBase": "https://..." },
  "cards": [ { "name": "...", "manaCost": "...", "ruleText": "...", "imageUrl": "",
               "variants": [ { "id": "v1", "imageUrl": "https://..." } ] } ],
  "look": null,
  "marks": null
}
```

A card's picture is on its variants (Sagas). `imageUrl` set as an absolute address.

Each card's `cid` is its lasting id. It stays the same when the card is renamed or moves to another Saga, and `card_catalog.html?card=<cid>` opens that card in the app.

---

## Art

If you are the set's owner and have those originals in an `art/` folder beside the app, use "**I own this set**" in Owner Sync. Cards then draw from your own files instead of the CDN, and keep working with no internet.

---

## Source code

The app's source is on `main` beside the site: the code in `src/`, and the data it is built with in `data/`.

`card_catalog.html` is the files `src/BUILD_ORDER.txt` lists, joined in that order with nothing between them. The copy served here also has the code comments taken out; the files in `src/` keep theirs. `src/landing.html` is what `index.html`, the front page, is made from. It is not part of the app.

One file in that list is not here: `src/fonts.css`, which embeds Book Antiqua. That font is Monotype's, and not ours to give away. A page joined from this repository alone has no Book Antiqua of its own, so card text uses Book Antiqua if your computer has it, and Georgia if not. Cinzel and Crimson Pro are in `src/webfonts.css`.

To join it yourself, run this in the top folder of a clone of this repository:

```
grep -E '^(src|data)/[^ ]+$' src/BUILD_ORDER.txt | grep -vx 'src/fonts.css' | xargs cat > rebuilt.html
```

or, anywhere Python runs:

```
python -c "L=[l.strip() for l in open('src/BUILD_ORDER.txt')]; open('rebuilt.html','wb').write(b''.join(open(f,'rb').read() for f in L if f.startswith(('src/','data/')) and ' ' not in f and f!='src/fonts.css'))"
```

Then open `rebuilt.html` in a browser. The files only work joined: the editor's code, for one, starts in `src/editor/ed2_core.js` and ends in `src/editor/ed2_boot.js`.

The tools that build, check and publish the site, and the relay that online play runs through, are not in this repository. GitHub Pages serves every file on `main` at playconjure.com, so nothing that runs on a computer is kept here. If you need them, ask on the [Discord](https://discord.com/invite/TZec5kaVa9).

---

## License

The code in `src/` is licensed under the Apache License, Version 2.0.\
The full text is in `src/LICENSE`, and `src/NOTICE`.

The license covers only the code. It grants no rights to the rules and design documents, keywords, art and icons, card back, and the Conjure name, logo and wordmark. All of it remains all rights reserved by Conjure UCG LLC.

An unofficial set may put official cards in their Sagas with the original attribution "ConjureUCG LLC (Year Attributed)"\
To see [Making your own set](#making-your-own-set).

For anything else, please ask on the [Discord](https://discord.com/invite/TZec5kaVa9).

Third-party licenses:

- `src/jszip.html`: JSZip 3.10.1, (c) 2009-2016 Stuart Knightley, dual-licensed under the MIT license or GPLv3, and the pako library it includes, under the MIT license.
- `src/webfonts.css`: Cinzel, Copyright 2020 The Cinzel Project Authors, and Crimson Pro, Copyright 2018 The Crimson Pro Project Authors, both under the SIL Open Font License 1.1 (https://openfontlicense.org).
