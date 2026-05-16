# Mouwatin AI - المساعد الإداري المغربي

Assistant administratif et juridique officiel du Royaume du Maroc.

## 🇲🇦 À propos

**Mouwatin AI** (مواطن AI) virtualise l'intégralité de l'administration marocaine : guide chaque citoyen étape par étape, du formulaire jusqu'au guichet, avec les coûts exacts en MAD, les délais réels et les références légales officielles.

Basé sur :
- Constitution du Maroc 2011
- Code de la famille — Moudawwana
- Code du travail, Code pénal, Code de la route
- Code de commerce, droit des sociétés
- Législation immobilière, fiscale, sociale, numérique
- Et plus de 40 textes de loi officiels

## 🚀 Lancement

```bash
# Cloner
git clone https://github.com/votre-username/mouwatin-ai.git
cd mouwatin-ai

# Lancer le serveur
python3 server.py

# Ou avec une clé API
OPENAI_API_KEY=sk-... python3 server.py
```

Ouvrir **http://localhost:3000**

## ⚙️ Configuration

La clé API OpenAI peut être définie :
1. Dans l'interface (⚙️ en haut à droite)
2. Via le fichier `.env` : `OPENAI_API_KEY=sk-...`
3. Via la variable d'environnement

## 🏗 Structure

```
mouwatin-ai/
├── index.html      # Interface de chat
├── style.css       # Styles marocains
├── script.js       # Logique front-end
├── server.py       # Backend Python (sans dépendances)
├── start.sh        # Script de démarrage
├── .env            # Configuration
└── .gitignore
```

## 📋 Fonctionnalités

- **Multilingue** : français, arabe, darija — détection automatique
- **8 sections de réponse** structurées (documents, étapes, coûts, délais...)
- **Prompt système complet** avec toutes les références légales marocaines
- **Aucune dépendance** — uniquement Python 3 standard
- **Design responsive** aux couleurs du Maroc
