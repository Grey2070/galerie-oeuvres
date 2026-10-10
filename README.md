# Galerie d’œuvres — site Netlify

Site de galerie d’art sans nom affiché :

- `/` : la galerie, avec toutes les œuvres exposées (photo, cartel, description, prix).
- `/oeuvre/<titre>-<référence>` : la page d’une œuvre seule. C’est là qu’arrive le visiteur qui scanne son QR code.
- `/o/<référence>` : le lien court imprimé dans chaque QR code. Il mène toujours à la bonne page, même si le titre change.
- `/admin/` : l’espace exposant, protégé par mot de passe. On y ajoute une œuvre (photo prise au téléphone ou choisie dans la photothèque), on la modifie, on la marque vendue, on la retire, et on télécharge ou imprime les QR codes.

Les photos et les fiches sont stockées dans Netlify Blobs. Aucune base de données ni service externe n’est nécessaire.

## Mise en ligne

Le projet Netlify est déjà créé : **galerie-oeuvres-exposees**.

1. Mettez ce dossier dans un dépôt GitHub.
2. Dans Netlify, ouvrez le projet, puis *Project configuration › Build & deploy › Link repository*, et choisissez ce dépôt. Aucun réglage de build n’est nécessaire, car `netlify.toml` s’en charge.

Autre méthode, depuis un ordinateur :

```
npx netlify-cli deploy --prod --site dc34e6d1-a08f-4c37-a341-2eefb8525492
```

## Réglages (variables d’environnement Netlify)

| Variable | Rôle |
|---|---|
| `ADMIN_PASSWORD` | Mot de passe de l’espace exposant (obligatoire, déjà défini). |
| `SITE_TITLE` | Facultatif : nom affiché dans l’onglet du navigateur et dans les résultats de recherche (« Galerie d’art » par défaut). |
| `SITE_DESCRIPTION` | Facultatif : description de la galerie dans les résultats de recherche. |

Après avoir modifié une variable, redéployez le site pour qu’elle soit prise en compte.

## Moteurs de recherche

Chaque page est générée côté serveur : titre, description, image de partage, données structurées schema.org `VisualArtwork`. Le site fournit aussi `/sitemap.xml` (avec les images) et `/robots.txt`. L’espace exposant et l’API sont exclus de l’indexation.

Une fois le site en ligne, soumettez `https://<votre-adresse>/sitemap.xml` à deux endroits :

- Google Search Console ;
- Bing Webmaster Tools, qui alimente aussi DuckDuckGo, Yahoo, Ecosia et Qwant.
