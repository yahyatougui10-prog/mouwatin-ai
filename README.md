# Mouwatin AI - المساعد الإداري المغربي

Assistant administratif et juridique officiel du Royaume du Maroc.

## 🇲🇦 À propos

**Mouwatin AI** (مواطن AI) virtualise l'intégralité de l'administration marocaine : guide chaque citoyen étape par étape, du formulaire jusqu'au guichet, avec les coûts exacts en MAD, les délais réels et les références légales officielles.

Basé sur :
- Constitution du Maroc 2011
- Code de la famille — Moudawwana (+ réforme 2024)
- Code du travail, Code pénal, Code de la route
- Code de commerce, droit des sociétés
- Législation immobilière, fiscale, sociale, numérique
- Plus de 40 textes de loi officiels

## 🚀 Lancement

### Python direct
```bash
python3 server.py
```

### Docker
```bash
docker-compose up
```

### Configurer la clé API
```bash
# Dans le fichier .env
OPENAI_API_KEY=sk-...
# Ou en variable d'environnement
OPENAI_API_KEY=sk-... python3 server.py
```

Ouvrir **http://localhost:3000**

## ⚙️ Configuration

Le fichier `.env` supporte :
- `AI_PROVIDER` : `openai`, `anthropic`, `mistral`, ou `ollama`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`
- `OLLAMA_BASE_URL` (défaut: `http://localhost:11434`)
- `PORT` (défaut: 3000)

Les clés API peuvent aussi être saisies dans l'interface (⚙️).

## 🏗 Structure

```
mouwatin-ai/
├── index.html       # Interface de chat complète
├── style.css        # Styles (4 thèmes : clair, sombre, doré, sable)
├── script.js        # Frontend avec streaming, voix, upload, export
├── server.py        # Backend Python (multi-provider, SQLite, SSE)
├── start.sh         # Script de démarrage
├── .env             # Configuration complète
├── Dockerfile       # Container Docker
├── docker-compose.yml
├── vercel.json      # Déploiement Vercel
└── .github/workflows/ci.yml
```

## 📋 Fonctionnalités

- **Multi-provider AI** : OpenAI, Anthropic Claude, Mistral, Ollama (local)
- **Multilingue** : français, arabe, darija — détection automatique
- **8 sections de réponse** structurées (documents, étapes, coûts, délais...)
- **Streaming** en temps réel des réponses
- **Entrée vocale** 🎤 (Web Speech API)
- **Upload de fichiers** 📎 (drag & drop ou bouton)
- **Export PDF** 📄 (Ctrl+Shift+E)
- **4 thèmes** : clair, sombre, doré 🇲🇦, sable
- **Historique** persistant (SQLite) avec recherche
- **Design responsive** mobile-first
- **Aucune dépendance Python** — seulement la lib standard
