# Enregistreur audio avec visualisation en temps réel

Application mobile web (PWA) qui enregistre le son du micro et affiche en direct
l'amplitude ou un spectrogramme.

**Démo :** https://TON-LIEN.vercel.app

## Fonctionnalités
- Enregistrement avec Démarrer / Pause / Arrêter et chronomètre
- Visualisation en direct : amplitude (RMS en dB) ou spectrogramme (FFT)
- Sauvegarde locale des enregistrements (IndexedDB), liste, lecture, téléchargement
- Gestion du refus de permission du micro
- Installable sur l'écran d'accueil (PWA)

## Technologies
HTML, CSS, JavaScript (modules ES) — Web Audio API (`AnalyserNode`),
MediaRecorder, Canvas 2D, IndexedDB, Service Worker. Déploiement sur Vercel.

## Architecture
(tableau ou schéma des modules : recorder, visualizer, library, storage...)

## Captures d'écran
(dossier docs/ : amplitude, spectrogramme, liste)

## Lancer en local
Ouvrir le dossier avec l'extension VS Code « Live Server ».