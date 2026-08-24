# Teens Fashion - Gestion (Inventaire &amp; Caisse)

Logiciel de gestion de stock et de caisse (POS) pour **Teens Fashion by Di** (mikata.mg).
Fonctionne **entierement hors-ligne** sur Windows 10 : toutes les donnees (articles, photos,
stock, ventes) sont stockees localement sur l'ordinateur de la boutique, aucune connexion
internet n'est necessaire au quotidien.

## Fonctionnalites

- **Inventaire** : articles avec photo, categorie, couleurs, tailles (variantes), prix
  d'achat/vente, seuils d'alerte de stock bas.
- **Reception de stock** : mise a jour rapide des quantites quand vous recevez de nouveaux
  articles. Cette page fonctionne aussi depuis une **tablette** connectee au Wi-Fi de la
  boutique (aucune installation sur la tablette, juste un navigateur).
- **Caisse (POS)** : enregistrement des ventes en temps reel, panier, remise (montant ou
  pourcentage), plusieurs moyens de paiement (especes, Mvola, Orange Money, Airtel Money,
  carte, **achat en ligne**), rendu de monnaie, ticket imprimable.
- **Historique des ventes** : recherche et filtre par date / moyen de paiement, detail d'une
  vente, annulation (remet le stock a jour), reimpression de ticket.
- **Tableau de bord & Rapports** : chiffre d'affaires **et benefices** (jour / semaine / mois /
  annee), evolution du CA et du benefice, articles les plus vendus / les moins vendus (avec
  benefice), ventes par heure de la journee, tailles qui se vendent le mieux, repartition
  boutique vs vente en ligne, repartition par categorie et par moyen de paiement.
- **Export comptable Excel (.xlsx)** : un classeur pret a l'emploi avec plusieurs feuilles
  (Resume, Ventes, Detail articles, Produits, CA par jour, Paiements), directement
  exploitable sans reformatage.
- **Alertes de stock bas** et valeur totale du stock.
- **Sauvegarde** de la base de donnees en un clic.
- 100% hors-ligne, toutes les donnees restent sur votre ordinateur.

## Installation sur Windows 10

Un installateur Windows (`.exe`) est genere automatiquement a chaque mise a jour du projet
via GitHub Actions :

1. Allez dans l'onglet **Actions** du depot GitHub, ouvrez le dernier workflow
   **"Build Windows installer"** termine avec succes.
2. Telechargez l'artefact **teens-fashion-gestion-windows-installer** (fichier `.zip`
   contenant le `.exe`).
3. Dezippez puis lancez le fichier `.exe` : suivez l'installateur (vous pouvez choisir le
   dossier d'installation).
4. Un raccourci **"Teens Fashion - Gestion"** est cree sur le Bureau et dans le menu Demarrer.

Vous pouvez aussi generer l'installateur vous-meme (voir section Developpement ci-dessous).

## Connecter la tablette (reception de stock)

1. Ouvrez l'ordinateur de la boutique et connectez-le au Wi-Fi/routeur local de la boutique
   (une simple box sans acces internet fonctionne tres bien).
2. Connectez la tablette au **meme reseau Wi-Fi**.
3. Dans le logiciel, allez dans **Parametres** : l'adresse a saisir sur la tablette est
   affichee (ex: `http://192.168.1.10:4173`).
4. Sur la tablette, ouvrez un navigateur et saisissez cette adresse.
5. Allez sur **Reception stock** pour rechercher un article et ajouter les quantites recues.
   Vous pouvez aussi ajouter un nouvel article avec sa photo directement depuis la page
   **Inventaire** de la tablette.

Tout se fait en temps reel sur le reseau local : pas besoin d'envoyer de fichier, pas
besoin d'internet.

## Sauvegarde des donnees

Dans **Parametres**, cliquez sur **"Creer une sauvegarde maintenant"**. Une copie complete
de la base de donnees est enregistree dans le dossier de donnees de l'application
(sous-dossier `backups`). Pensez a copier ce dossier de temps en temps sur une cle USB ou un
disque externe pour plus de securite.

Emplacement des donnees sur Windows :
`%APPDATA%\teens-fashion-gestion\data\teensfashion.db`

## Developpement

Prerequis : [Node.js](https://nodejs.org) 20 LTS.

```bash
npm install        # installe les dependances
npm run dev         # lance l'application en mode developpement (Electron + rechargement)
npm run dist         # genere l'installateur Windows (.exe) dans le dossier release/
```

`npm run dist` doit etre execute sur Windows (ou via GitHub Actions, deja configure dans
`.github/workflows/build-windows.yml`) pour produire un installateur natif Windows.

## Architecture technique

- **Electron** : conteneur applicatif Windows, ouvre une fenetre pointant vers un serveur
  local.
- **Express** (Node.js) : serveur HTTP local (port `4173`), expose une API REST et sert
  l'application web (React) et les photos des articles. Ecoute sur toutes les interfaces
  reseau (`0.0.0.0`) pour etre accessible depuis la tablette via le Wi-Fi local.
- **SQLite** (`better-sqlite3`) : base de donnees locale unique, aucune installation de
  serveur de base de donnees requise.
- **React + Vite** : interface utilisateur.

Aucune donnee ne transite par internet : le serveur n'est accessible que sur le reseau
local de la boutique.
