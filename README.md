# Brawl Shorts

Site cu shorturile creatorilor de Brawl Stars. Se actualizează singur în fiecare oră prin GitHub Actions și e găzduit gratuit pe GitHub Pages.

## Punere în funcțiune (o singură dată, ~5 minute)

1. **Creează repo-ul.** Pe github.com apasă **New repository**, dă-i numele `brawl-shorts`, alege **Public** și apasă **Create repository**.
2. **Urcă fișierele.** Pe pagina repo-ului apasă **uploading an existing file** și trage înăuntru tot conținutul arhivei (fișierele și folderele), apoi **Commit changes**.
   - Folderul `.github` începe cu punct, deci poate fi ascuns pe calculator. Dacă nu apare în repo după upload, apasă **Add file → Create new file**, scrie numele `.github/workflows/update.yml`, lipește conținutul fișierului și apasă **Commit**.
3. **Pornește Pages.** Mergi la **Settings → Pages** și, la **Source**, alege **GitHub Actions**.
4. **Prima rulare.** Mergi la **Actions**. Dacă apare un buton de activare, apasă-l. Alege **Actualizează shorturile → Run workflow**.
5. **Gata.** După 1–2 minute site-ul e la `https://NUMELE-TĂU.github.io/brawl-shorts/`.

De aici, scriptul verifică din oră în oră shorturile noi și republică site-ul singur.

## Adaugă un creator

Editează `channels.json` (creionul din GitHub) și adaugă un bloc nou:

```json
{ "key": "numeunic", "name": "Numele afișat", "handle": "@HandleDeYouTube" }
```

`key` e un nume scurt, fără spații. ID-ul canalului se completează singur la următoarea rulare. După salvare, site-ul se actualizează în câteva minute.

## Opțional: toate shorturile, nu doar cele noi

Fără cheie, scriptul citește feedul RSS al YouTube, care arată doar ultimele ~15 shorturi ale fiecărui canal. Shorturile se adună în timp, deci nu se pierde nimic de acum înainte, dar shorturile vechi nu sunt aduse.

Ca să aduci tot istoricul (până la 500 de shorturi pe canal, cu durata fiecăruia), fă o cheie gratuită **YouTube Data API v3** din Google Cloud Console. Pune-o apoi în repo la **Settings → Secrets and variables → Actions → New repository secret**, cu numele `YOUTUBE_API_KEY`. Scriptul o folosește automat.

## Fișiere

- `index.html`: site-ul.
- `channels.json`: lista creatorilor.
- `data/shorts.json`: shorturile, actualizate automat.
- `scripts/update.mjs`: scriptul care ia shorturile noi.
- `.github/workflows/update.yml`: programarea orară.
