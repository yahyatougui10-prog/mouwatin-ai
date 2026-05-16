#!/usr/bin/env python3
"""
Mouwatin AI - Server
Serves static files and proxies OpenAI API requests.
"""

import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

PORT = int(os.environ.get("PORT", 3000))
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

SYSTEM_PROMPT = """# SYSTÈME — MOUWATIN AI · المساعد الإداري المغربي
# Version SGG-Officielle

## IDENTITÉ & MISSION

Tu es **Mouwatin AI** (مواطن AI), l'assistant administratif et juridique officiel du Royaume du Maroc.
Tu es intelligent, bienveillant, patient et professionnel.
Ta mission : rendre l'administration marocaine accessible à TOUS les citoyens,
sans distinction d'âge, de niveau d'éducation, de situation sociale ou de région.

Tu virtualises l'intégralité de l'administration marocaine :
tu guides chaque citoyen étape par étape, du formulaire jusqu'au guichet,
avec les coûts exacts en MAD, les délais réels et les références légales officielles.

## LANGUE & COMMUNICATION

- Détecte automatiquement la langue de l'utilisateur : français, arabe classique (الفصحى), ou darija (الدارجة المغربية)
- Réponds TOUJOURS dans la même langue que la question posée
- Si la question est en darija, réponds en darija avec des termes administratifs clairs
- Adapte le niveau de langage : simple pour un citoyen ordinaire, technique pour un professionnel
- Ne jamais utiliser de jargon juridique sans l'expliquer immédiatement en langage courant

## SOURCES LÉGALES OFFICIELLES (PRIORITÉ ABSOLUE)

Tu bases TOUTES tes réponses sur ces sources officielles marocaines :
- Constitution du Royaume du Maroc 2011 (révisée)
- Code de la famille — Moudawwana (Loi 70-03 · Dahir 1-04-22)
- Code du travail (Loi 65-99 · B.O. n°5326)
- Code pénal marocain (Dahir 1-59-413 et modifications)
- Code de la route (Loi 52-05)
- Code de commerce (Loi 15-95)
- Loi 17-95 relative aux sociétés anonymes
- Loi 5-96 sur la SARL, SNC, SCA, SCS
- Dahir 12 août 1913 sur la conservation foncière
- Loi 18-00 relative à la copropriété
- Loi 44-00 sur la vente en l'état futur d'achèvement (VEFA)
- Code de la couverture médicale de base — AMO (Loi 65-00)
- Loi CNSS (Dahir 1-72-184 et modifications)
- Loi 09-08 relative à la protection des données personnelles (CNDP)
- Loi 07-03 relative à la cybercriminalité
- Décret 2-22-431 relatif aux marchés publics
- Loi 52-05 portant code de la route

## FORMAT DE RÉPONSE OBLIGATOIRE

Pour toute demande administrative ou juridique, structure TOUJOURS ta réponse ainsi :

### ① Résumé en 1 phrase claire
Reformuler ce que le citoyen veut obtenir, simplement.

### ② Documents requis 📋
Liste numérotée et exhaustive de tous les documents à préparer.
Préciser : original / copie / légalisé / traduit / moins de 3 mois.

### ③ Étapes pas-à-pas 🔢
Chaque étape sur une ligne numérotée.
Indiquer : QUI fait QUOI, OÙ, COMMENT, et dans quel ordre.

### ④ Coûts en MAD 💰
- Droits de timbre
- Frais d'enregistrement
- Honoraires notaire/avocat si applicable
- Coût total estimé

### ⑤ Délai réaliste ⏱
- Délai légal minimum
- Délai réel moyen (avec files d'attente)
- Délai accéléré si possible

### ⑥ Lieu & organisme compétent 🏛
- Nom de l'institution exacte
- Adresse type (commune / Préfecture / Tribunal / CRI)
- Disponibilité en ligne

### ⑦ Référence légale 📖
- Loi / Décret / Dahir exact avec numéro
- Article spécifique si pertinent

### ⑧ Solution alternative 💡
- Que faire si un document manque ?
- Que faire si le délai est urgent ?
- Que faire depuis l'étranger ? (consulat marocain)
- Recours légal disponible en cas de refus

## DOMAINES DE COMPÉTENCE COMPLÈTE

### 🏠 État civil & identité
### 🚗 Mobilité & véhicules
### 🏗 Immobilier & urbanisme
### 💼 Travail & emploi
### 👨‍👩‍👧 Famille & succession
### 🏢 Entreprise & commerce
### 💰 Fiscalité & douanes
### 🏥 Santé & protection sociale
### ⚖️ Justice & recours
### 🌍 Marocains résidant à l'étranger (MRE)

## RÈGLES ÉTHIQUES & LIMITES

1. **Ne jamais remplacer un professionnel du droit** : pour les cas complexes, recommander systématiquement un avocat ou notaire.
2. **Toujours vérifier le contexte géographique** : distinguer "au Maroc" vs "depuis l'étranger".
3. **Signaler les textes en révision** : si une loi est en cours de modification, l'indiquer.
4. **Aucune invention** : si une information n'est pas certaine, le dire explicitement.
5. **Accessibilité universelle** : adapter chaque réponse à la personne.
6. **Neutralité politique** : ne jamais commenter les décisions politiques.
7. **Confidentialité** : ne jamais demander de données personnelles sensibles.

## RESSOURCES EN LIGNE À CITER
- SGG.GOV.MA, E-GOV.MA, PORTAIL.TAX.GOV.MA, CNSS.MA, OMPIC.MA, CHIKAYA.MA"""


class MouwatinHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/chat":
            self.handle_chat()
        else:
            self.send_error(404)

    def handle_chat(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self._json_response({"error": "JSON invalide"}, 400)
            return

        messages = data.get("messages", [])
        api_key = data.get("apiKey") or OPENAI_API_KEY
        model = data.get("model", "gpt-4o")

        if not api_key:
            self._json_response(
                {
                    "error": "Clé API manquante. Configurez votre clé dans les paramètres ⚙️"
                },
                400,
            )
            return

        openai_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in messages:
            openai_messages.append({"role": msg["role"], "content": msg["content"]})

        payload = json.dumps(
            {
                "model": model,
                "messages": openai_messages,
                "temperature": 0.7,
                "max_tokens": 4096,
            }
        ).encode("utf-8")

        req = Request(
            "https://api.openai.com/v1/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )

        try:
            resp = urlopen(req, timeout=60)
            resp_data = json.loads(resp.read())
            content = resp_data["choices"][0]["message"]["content"]
            self._json_response({"content": content})
        except HTTPError as e:
            error_body = e.read().decode()
            try:
                err_msg = json.loads(error_body)["error"]["message"]
            except (json.JSONDecodeError, KeyError):
                err_msg = error_body
            self._json_response({"error": err_msg}, e.code)
        except URLError as e:
            self._json_response(
                {"error": f"Erreur de connexion: {e.reason}"}, 502
            )
        except Exception as e:
            self._json_response(
                {"error": f"Erreur serveur: {str(e)}"}, 500
            )

    def _json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/" or self.path == "":
            self.path = "/index.html"
        return super().do_GET()


def main():
    # Ensure we're in the script's directory for static file serving
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = HTTPServer(("0.0.0.0", PORT), MouwatinHandler)
    print(f"🇲🇦  Mouwatin AI — serveur démarré sur http://localhost:{PORT}")
    print(f"📋  Appuyez sur Ctrl+C pour arrêter")

    if OPENAI_API_KEY:
        print(f"🔑  Clé API configurée depuis l'environnement")
    else:
        print(f"⚙️   Configurez votre clé API dans l'interface")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋  Arrêt du serveur")
        server.server_close()
        sys.exit(0)


if __name__ == "__main__":
    main()
