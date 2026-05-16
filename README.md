# Mouwatin AI v2 - المساعد الإداري المغربي

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

## 🚀 Lancement rapide

```bash
# Python direct
python3 server.py

# Ou avec Docker
docker-compose up

# Ou avec le script
./start.sh
```

Ouvrir **http://localhost:3000**

## ⚙️ Configuration

Le fichier `.env` supporte :
| Variable | Description | Défaut |
|----------|-------------|--------|
| `AI_PROVIDER` | Fournisseur AI (`openai`, `anthropic`, `mistral`, `ollama`) | `openai` |
| `OPENAI_API_KEY` | Clé API OpenAI | — |
| `ANTHROPIC_API_KEY` | Clé API Anthropic | — |
| `MISTRAL_API_KEY` | Clé API Mistral | — |
| `OLLAMA_BASE_URL` | URL du serveur Ollama | `http://localhost:11434` |
| `PORT` | Port du serveur | `3000` |
| `RATE_LIMIT` | Requêtes max/min par IP | `30` |

Les clés API peuvent aussi être saisies dans l'interface (⚙️).

## 🏗 Structure

```
mouwatin-ai/
├── index.html          # Interface de chat complète
├── style.css           # Styles (4 thèmes + offline/stop)
├── script.js           # Frontend (streaming, voix, upload, export)
├── server.py           # Backend Python (multi-provider, SQLite, SSE)
├── start.sh            # Script de démarrage
├── .env                # Configuration
├── Dockerfile          # Container Docker avec healthcheck
├── docker-compose.yml  # Orchestration complète
├── vercel.json         # Déploiement Vercel
├── .dockerignore       # Ignorer fichiers inutiles dans Docker
├── .github/workflows/ci.yml  # CI GitHub Actions
└── README.md
```

## 📋 Fonctionnalités

- **Multi-provider AI** : OpenAI, Anthropic Claude, Mistral, Ollama (local)
- **Multilingue** : français, arabe, darija — détection automatique
- **8 sections de réponse** structurées (documents, étapes, coûts, délais...)
- **Streaming** en temps réel avec bouton **Arrêter** ⏹
- **Entrée vocale** 🎤 (Web Speech API)
- **Upload de fichiers** 📎 (drag & drop, PDF → texte)
- **Export HTML** 📄 (raccourci Ctrl+Shift+E ou bouton)
- **Système d'apprentissage** : feedback 👍/👎, corrections, exemples appris
- **4 thèmes** : clair, sombre, doré 🇲🇦, sable
- **Historique** persistant (SQLite) avec recherche
- **Rate limiting** intégré (30 req/min/IP)
- **Healthcheck endpoint** : `GET /api/health`
- **Horodatage** des messages
- **Détection hors-ligne** ⚠️
- **Design responsive** mobile-first
- **Aucune dépendance Python** — seulement la lib standard

## 🛡️ API Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/health` | Healthcheck |
| `GET` | `/api/providers` | Liste des providers |
| `POST` | `/api/chat` | Chat synchrone |
| `POST` | `/api/chat/stream` | Chat SSE streaming |
| `POST` | `/api/conversations` | Sauvegarder conversation |
| `GET` | `/api/conversations` | Lister conversations |
| `GET` | `/api/conversations/:id` | Détail conversation |
| `DELETE` | `/api/conversations/:id` | Supprimer conversation |
| `POST` | `/api/feedback` | Envoyer feedback |
| `GET` | `/api/learning/stats` | Stats apprentissage |
| `GET` | `/api/learning/examples` | Exemples appris |
| `POST` | `/api/upload` | Upload fichier |
| `GET` | `/api/pdf` | Export conversation en HTML |

## 🤝 Contribution

1. Fork le projet
2. Crée une branche : `git checkout -b feature/ma-feature`
3. Commit : `git commit -m '🇲🇦 Ajout de ma feature'`
4. Push : `git push origin feature/ma-feature`
5. Ouvre une Pull Request
