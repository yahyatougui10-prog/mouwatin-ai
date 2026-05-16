#!/usr/bin/env python3
"""
Mouwatin AI — المساعد الإداري المغربي
Backend serveur : multi-provider AI (OpenAI, Anthropic, Mistral, Ollama),
stockage SQLite, streaming SSE, upload fichiers, export PDF.
"""

import json, os, sys, time, sqlite3, hashlib, re, io, uuid
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from datetime import datetime, timezone
from html import escape as html_escape

PORT = int(os.environ.get("PORT", 3000))
PROVIDER = os.environ.get("AI_PROVIDER", "openai").lower()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "mouwatin.db"))

SYSTEM_PROMPT = """# SYSTÈME — MOUWATIN AI · المساعد الإداري المغربي

Tu es Mouwatin AI (مواطن AI), l'assistant administratif et juridique officiel du Royaume du Maroc.
Tu es intelligent, bienveillant, patient et professionnel.
Tu rends l'administration marocaine accessible à TOUS les citoyens.

## LANGUE & COMMUNICATION
- Détecte automatiquement la langue : français, arabe (الفصحى), ou darija (الدارجة)
- Réponds TOUJOURS dans la même langue que la question
- Adapte le niveau de langage au citoyen (simple, clair, sans jargon)
- Pour la darija : utilise l'alphabet latin (ex: "kifach", "chno", "ash")

## SOURCES LÉGALES (base obligatoire)
🇲🇦 **Constitution** : Constitution du Maroc 2011
👨‍👩‍👧 **Famille** : Code de la famille Moudawwana (Loi 70-03), Loi 33-22 (réforme 2024)
💼 **Travail** : Code du travail (Loi 65-99), Loi 29-93 (CNSS), Loi 98-15 (AMO)
⚖️ **Pénal** : Code pénal (Dahir 1-59-413), Code de procédure pénale (Loi 22-01)
🚗 **Route** : Code de la route (Loi 52-05), Loi 116-14 (permis à points)
🏢 **Commerce** : Code de commerce (Loi 15-95), Loi 17-95 (SA), Loi 5-96 (SARL), Loi 20-19 (auto-entrepreneur)
🏗 **Immobilier** : Dahir 12 août 1913 (conservation foncière), Loi 18-00 (copropriété), Loi 44-00 (VEFA), Loi 46-08 (ADL)
💰 **Fiscal** : CGI (Code général des impôts), Loi 43-20 (loi de finances), Loi 69-19 (IS)
🏥 **Santé** : AMO (Loi 65-00), CNSS (Dahir 1-72-184), RAMED (Loi 03-22)
🛡 **Numérique** : Loi 09-08 (données personnelles), Loi 07-03 (cybercriminalité), Loi 53-05 (e-commerce)
📜 **Administratif** : Décret 2-22-431 (marchés publics), Loi 01-03 (fonction publique), Charte communale (Loi 113-14)
🌍 **MRE** : Loi 02-03 (entrée/séjour étrangers), Code de la nationalité (Dahir 1-58-250)

## FORMAT DE RÉPONSE OBLIGATOIRE (8 sections)
① **Résumé** — 1 phrase claire
② **Documents requis 📋** — original/copie/légalisé/traduit/délai de validité
③ **Étapes pas-à-pas 🔢** — QUI, QUOI, OÙ, COMMENT, adresse précise
④ **Coûts en MAD 💰** — timbre, enregistrement, notaire, traduction, total
⑤ **Délai ⏱** — légal vs réel vs accéléré (avec ou sans bakchich)
⑥ **Lieu & organisme 🏛** — institution, adresse, horaires, site web, guichet
⑦ **Référence légale 📖** — loi, décret, article exact
⑧ **Alternative 💡** — document manquant, urgence, étranger, recours, contact avocat/notaire

## DOMAINES
🏠 État civil | 🚗 Mobilité | 🏗 Immobilier | 💼 Travail
👨‍👩‍👧 Famille | 🏢 Entreprise | 💰 Fiscalité | 🏥 Santé
⚖️ Justice | 🌍 MRE | 🎓 Éducation | 🌾 Agriculture

## RÈGLES STRICTES
1. Ne remplace jamais un avocat/notaire/adoul pour les cas complexes
2. Distingue TOUJOURS "au Maroc" vs "depuis l'étranger"
3. Cite les textes de loi avec articles précis quand possible
4. Signale les textes en révision (ex: Moudawwana 2024)
5. N'invente JAMAIS un texte de loi — si incertain, oriente vers le guichet
6. Adapte le langage au niveau du citoyen (pas de jargon juridique inutile)
7. Neutre politiquement et religieusement
8. Ne demande JAMAIS de données sensibles (numéro CIN complet, IBAN, mot de passe)
9. Pour les coûts : donne une fourchette (min-max) quand le prix varie

## RESSOURCES OFFICIELLES
SGG.GOV.MA | E-GOV.MA | PORTAIL.TAX.GOV.MA | CNSS.MA | OMPIC.MA
CHIKAYA.MA | BARID.MA | MAHAKIM.MA | ANAPEC.MA | ONCF.MA
FARMATOUR.MA | TIQQI.MA | ALWATANIA.MA | CNOPS.MA"""

# ── Database ──────────────────────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            provider TEXT DEFAULT 'openai',
            model TEXT DEFAULT 'gpt-4o',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            message_idx INTEGER NOT NULL,
            user_question TEXT NOT NULL,
            ai_response TEXT NOT NULL,
            rating INTEGER NOT NULL,
            correction_text TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS learned_examples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            tags TEXT DEFAULT '',
            source TEXT DEFAULT 'user',
            usage_count INTEGER DEFAULT 0,
            quality_score REAL DEFAULT 1.0,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
        CREATE INDEX IF NOT EXISTS idx_feedback_conv ON feedback(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_examples_quality ON learned_examples(quality_score DESC);
    """)
    conn.commit()
    conn.close()

def db_get_conversations(limit=50):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, title, provider, model, created_at, updated_at "
        "FROM conversations ORDER BY updated_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def db_get_conversation(conv_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
    if not c:
        conn.close()
        return None
    msgs = conn.execute(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id",
        (conv_id,)
    ).fetchall()
    conn.close()
    return {**dict(c), "messages": [dict(m) for m in msgs]}

def db_save_conversation(conv_id, title, provider, model, messages):
    now = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT OR REPLACE INTO conversations (id, title, provider, model, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM conversations WHERE id=?), ?), ?)",
        (conv_id, title[:200], provider, model, conv_id, now, now)
    )
    conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
    for m in messages:
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (conv_id, m["role"], m["content"], now)
        )
    conn.commit()
    conn.close()

def db_delete_conversation(conv_id):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    conn.commit()
    conn.close()

# ── Learning: Feedback & Examples ──────────────────────────────────────────

def db_save_feedback(conv_id, message_idx, user_question, ai_response, rating, correction=""):
    now = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO feedback (conversation_id, message_idx, user_question, ai_response, rating, correction_text, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (conv_id, message_idx, user_question, ai_response, rating, correction, now)
    )
    conn.commit()
    # Auto-promote: if rating is 1 (thumbs up), increment quality. If it reaches 3, promote
    if rating == 1:
        c = conn.execute(
            "SELECT COUNT(*) FROM feedback WHERE ai_response = ? AND rating = 1",
            (ai_response,)
        ).fetchone()
        up_count = c[0]
        if up_count >= 3:
            existing = conn.execute(
                "SELECT id FROM learned_examples WHERE question = ?",
                (user_question,)
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO learned_examples (question, answer, tags, source, quality_score, created_at) "
                    "VALUES (?, ?, ?, 'auto', 3.0, ?)",
                    (user_question, ai_response, now)
                )
                conn.commit()
    conn.close()

def db_get_learning_stats():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    total_feedback = conn.execute("SELECT COUNT(*) as c FROM feedback").fetchone()["c"]
    total_up = conn.execute("SELECT COUNT(*) as c FROM feedback WHERE rating = 1").fetchone()["c"]
    total_down = conn.execute("SELECT COUNT(*) as c FROM feedback WHERE rating = -1").fetchone()["c"]
    total_examples = conn.execute("SELECT COUNT(*) as c FROM learned_examples").fetchone()["c"]
    recent_feedback = conn.execute(
        "SELECT f.*, c.title as conv_title FROM feedback f "
        "LEFT JOIN conversations c ON c.id = f.conversation_id "
        "ORDER BY f.created_at DESC LIMIT 20"
    ).fetchall()
    conn.close()
    return {
        "total_feedback": total_feedback,
        "total_up": total_up,
        "total_down": total_down,
        "total_examples": total_examples,
        "recent_feedback": [dict(r) for r in recent_feedback],
    }

def db_get_examples(limit=20):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM learned_examples ORDER BY quality_score DESC, created_at DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def db_promote_to_example(feedback_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    fb = conn.execute("SELECT * FROM feedback WHERE id = ?", (feedback_id,)).fetchone()
    if not fb:
        conn.close()
        return None
    existing = conn.execute(
        "SELECT id FROM learned_examples WHERE question = ?", (fb["user_question"],)
    ).fetchone()
    if existing:
        conn.close()
        return {"id": existing["id"], "existing": True}
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT INTO learned_examples (question, answer, tags, source, quality_score, created_at) "
        "VALUES (?, ?, '', 'curated', 5.0, ?)",
        (fb["user_question"], fb["ai_response"], now)
    )
    conn.commit()
    conn.close()
    return {"id": conn.execute("SELECT last_insert_rowid()").fetchone()[0], "existing": False}

def db_delete_example(example_id):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM learned_examples WHERE id = ?", (example_id,))
    conn.commit()
    conn.close()

def db_get_relevant_examples(query, max_examples=3):
    """Find relevant learned examples based on simple keyword matching."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT question, answer, usage_count FROM learned_examples ORDER BY quality_score DESC, usage_count DESC LIMIT 50"
    ).fetchall()
    conn.close()

    if not rows:
        return []

    # Simple relevance scoring: count keyword overlaps
    query_words = set(query.lower().split())
    scored = []
    for r in rows:
        q_words = set((r["question"] or "").lower().split())
        overlap = len(query_words & q_words)
        if overlap > 0:
            scored.append((overlap * 2 + r["usage_count"] * 0.1, r["question"], r["answer"]))

    scored.sort(key=lambda x: -x[0])
    best = scored[:max_examples]
    # Increment usage_count for matched examples
    if best:
        conn = sqlite3.connect(DB_PATH)
        for _, q, _ in best:
            conn.execute("UPDATE learned_examples SET usage_count = usage_count + 1 WHERE question = ?", (q,))
        conn.commit()
        conn.close()
    return [{"question": q, "answer": a} for _, q, a in best]

# ── Helpers ───────────────────────────────────────────────────────────────

def json_resp(handler, data, status=200):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)

def build_messages(messages):
    # Inject relevant learned examples as few-shot context
    examples_text = ""
    if messages:
        last_user_msg = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            ""
        )
        if last_user_msg:
            examples = db_get_relevant_examples(last_user_msg)
            if examples:
                examples_text = "\n\n## EXEMPLES APPRIS DE CONVERSATIONS PRÉCÉDENTES\n"
                examples_text += "Voici des exemples de réponses qui ont eu du succès pour des questions similaires. Inspire-toi de leur qualité et de leur structure :\n\n"
                for i, ex in enumerate(examples, 1):
                    examples_text += f"### Exemple {i} — Question : {ex['question']}\n"
                    examples_text += f"Réponse : {ex['answer']}\n\n"

    system_content = SYSTEM_PROMPT
    if examples_text:
        system_content += examples_text

    return [{"role": "system", "content": system_content}] + [
        {"role": m["role"], "content": m["content"]} for m in messages
    ]

# ── AI Providers ──────────────────────────────────────────────────────────

def call_openai(messages, model, stream=False):
    msgs = build_messages(messages)
    payload = json.dumps({
        "model": model,
        "messages": msgs,
        "temperature": 0.7,
        "max_tokens": 8192,
        "stream": stream,
    }).encode("utf-8")
    req = Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
    )
    return urlopen(req, timeout=180)

def call_anthropic(messages, model, stream=False):
    msgs = build_messages(messages)
    payload = json.dumps({
        "model": model,
        "max_tokens": 8192,
        "messages": [m for m in msgs if m["role"] != "system"],
        "system": next((m["content"] for m in msgs if m["role"] == "system"), SYSTEM_PROMPT),
        "stream": stream,
    }).encode("utf-8")
    req = Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
    )
    return urlopen(req, timeout=180)

def call_mistral(messages, model, stream=False):
    msgs = build_messages(messages)
    payload = json.dumps({
        "model": model,
        "messages": msgs,
        "temperature": 0.7,
        "max_tokens": 8192,
        "stream": stream,
    }).encode("utf-8")
    req = Request(
        "https://api.mistral.ai/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {MISTRAL_API_KEY}",
        },
    )
    return urlopen(req, timeout=180)

def call_ollama(messages, model, stream=False):
    msgs = build_messages(messages)
    # Remove provider prefix if present (e.g., "ollama:llama3" -> "llama3")
    model_name = model.split(":")[-1] if ":" in model else model
    payload = json.dumps({
        "model": model_name,
        "messages": msgs,
        "stream": stream,
        "options": {"temperature": 0.7, "num_predict": 8192},
    }).encode("utf-8")
    req = Request(
        f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    return urlopen(req, timeout=300)

PROVIDER_MAP = {
    "openai": {"call": call_openai, "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]},
    "anthropic": {"call": call_anthropic, "models": ["claude-sonnet-4-20250514", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"]},
    "mistral": {"call": call_mistral, "models": ["mistral-large-latest", "mistral-medium-latest", "open-mistral-nemo"]},
    "ollama": {"call": call_ollama, "models": ["ollama:llama3", "ollama:mistral", "ollama:qwen2.5", "ollama:qwen2.5:7b"]},
}

def get_provider(provider_name=None):
    name = (provider_name or PROVIDER).lower()
    if name not in PROVIDER_MAP:
        name = "openai"
    return name, PROVIDER_MAP[name]

# ── Streaming helpers ─────────────────────────────────────────────────────

def parse_openai_stream(resp, sse_callback):
    buffer = ""
    for chunk_bytes in iter(lambda: resp.read(4096), b""):
        buffer += chunk_bytes.decode("utf-8")
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            line = line.strip()
            if line.startswith("data:"):
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    sse_callback("done", "")
                    return
                try:
                    delta = json.loads(data_str)
                    content = delta.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if content:
                        sse_callback("token", content)
                except json.JSONDecodeError:
                    pass
    sse_callback("done", "")

def parse_anthropic_stream(resp, sse_callback):
    buffer = ""
    for chunk_bytes in iter(lambda: resp.read(4096), b""):
        buffer += chunk_bytes.decode("utf-8")
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            line = line.strip()
            if line.startswith("data:"):
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    sse_callback("done", "")
                    return
                try:
                    evt = json.loads(data_str)
                    if evt.get("type") == "content_block_delta":
                        delta = evt.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text = delta.get("text", "")
                            if text:
                                sse_callback("token", text)
                except json.JSONDecodeError:
                    pass
    sse_callback("done", "")

def parse_mistral_stream(resp, sse_callback):
    return parse_openai_stream(resp, sse_callback)

def parse_ollama_stream(resp, sse_callback):
    buffer = ""
    for chunk_bytes in iter(lambda: resp.read(4096), b""):
        buffer += chunk_bytes.decode("utf-8")
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            line = line.strip()
            if line:
                try:
                    chunk = json.loads(line)
                    content = chunk.get("message", {}).get("content", "")
                    if content:
                        sse_callback("token", content)
                    if chunk.get("done"):
                        sse_callback("done", "")
                        return
                except json.JSONDecodeError:
                    pass
    sse_callback("done", "")

STREAM_PARSERS = {
    "openai": parse_openai_stream,
    "anthropic": parse_anthropic_stream,
    "mistral": parse_mistral_stream,
    "ollama": parse_ollama_stream,
}

# ── Generate PDF ──────────────────────────────────────────────────────────

def generate_pdf_html(conversation):
    title = conversation.get("title", "Conversation")
    msgs = conversation.get("messages", [])
    lines = [
        '<!DOCTYPE html><html><head><meta charset="utf-8">',
        f'<title>{html_escape(title)}</title>',
        '<style>',
        'body{font-family:"Inter",sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1f2937;}',
        'h1{color:#006233;font-size:24px;border-bottom:2px solid #006233;padding-bottom:8px;}',
        '.msg{margin:16px 0;padding:12px 16px;border-radius:8px;line-height:1.6;}',
        '.user{background:#e8f5e9;border-left:3px solid #006233;}',
        '.assistant{background:#f3f4f6;border-left:3px solid #D4A843;}',
        '.label{font-size:11px;font-weight:600;text-transform:uppercase;color:#6b7280;margin-bottom:4px;}',
        '.footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;}',
        '</style></head><body>',
        f'<h1>🇲🇦 {html_escape(title)}</h1>',
    ]
    for m in msgs:
        role = m["role"]
        label = "Vous" if role == "user" else "Mouwatin AI"
        lines.append(f'<div class="msg {role}">')
        lines.append(f'<div class="label">{label}</div>')
        lines.append(f'<p>{html_escape(m["content"]).replace(chr(10), "<br>")}</p>')
        lines.append('</div>')
    lines.append(f'<div class="footer">Généré par Mouwatin AI — {datetime.now().strftime("%d/%m/%Y %H:%M")}</div>')
    lines.append('</body></html>')
    return "\n".join(lines)


# ── Request Handler ──────────────────────────────────────────────────────

class MouwatinHandler(SimpleHTTPRequestHandler):

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/conversations":
            return json_resp(self, db_get_conversations())
        elif path.startswith("/api/conversations/"):
            conv_id = path.split("/")[-1]
            if conv_id:
                conv = db_get_conversation(conv_id)
                if conv:
                    return json_resp(self, conv)
                return json_resp(self, {"error": "Not found"}, 404)
        elif path == "/api/providers":
            return json_resp(self, {
                name: info["models"]
                for name, info in PROVIDER_MAP.items()
            })
        elif path == "/api/learning/stats":
            return json_resp(self, db_get_learning_stats())
        elif path == "/api/learning/examples":
            return json_resp(self, db_get_examples())
        elif path == "/api/learning/examples/promote" and parsed.query:
            params = parse_qs(parsed.query)
            fb_id = params.get("feedback_id", [None])[0]
            if fb_id:
                result = db_promote_to_example(int(fb_id))
                if result:
                    return json_resp(self, result)
                return json_resp(self, {"error": "Feedback not found"}, 404)
        elif path.startswith("/api/learning/examples/") and path.endswith("/delete"):
            example_id = path.split("/")[-2]
            db_delete_example(int(example_id))
            return json_resp(self, {"ok": True})
        elif path == "/api/pdf" and parsed.query:
            params = parse_qs(parsed.query)
            conv_id = params.get("id", [None])[0]
            if conv_id:
                conv = db_get_conversation(conv_id)
                if conv:
                    pdf_html = generate_pdf_html(conv)
                    body = pdf_html.encode("utf-8")
                    handler = self
                    handler.send_response(200)
                    handler.send_header("Content-Type", "text/html; charset=utf-8")
                    handler.send_header("Content-Disposition", f'attachment; filename="mouwatin-{conv_id[:8]}.html"')
                    handler.send_header("Content-Length", str(len(body)))
                    handler.end_headers()
                    handler.wfile.write(body)
                    return
                return json_resp(self, {"error": "Not found"}, 404)

        if path in ("", "/"):
            self.path = "/index.html"
        return super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/conversations/"):
            conv_id = parsed.path.split("/")[-1]
            db_delete_conversation(conv_id)
            return json_resp(self, {"ok": True})

    def do_POST(self):
        route = urlparse(self.path).path
        if route == "/api/chat":
            self._handle_chat(stream=False)
        elif route == "/api/chat/stream":
            self._handle_chat(stream=True)
        elif route == "/api/conversations":
            self._handle_save_conversation()
        elif route == "/api/upload":
            self._handle_upload()
        elif route == "/api/feedback":
            self._handle_feedback()
        else:
            json_resp(self, {"error": "Not found"}, 404)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def _handle_chat(self, stream=False):
        try:
            data = self._read_body()
        except json.JSONDecodeError:
            return json_resp(self, {"error": "JSON invalide"}, 400)

        messages = data.get("messages", [])
        provider_name = data.get("provider", PROVIDER)
        model = data.get("model", "gpt-4o")

        # Resolve provider
        pname, pconfig = get_provider(provider_name)
        api_key_checks = {
            "openai": OPENAI_API_KEY,
            "anthropic": ANTHROPIC_API_KEY,
            "mistral": MISTRAL_API_KEY,
            "ollama": "local",
        }
        if pname != "ollama" and not api_key_checks.get(pname):
            return json_resp(self, {
                "error": f"Clé API {pname.title()} manquante. Configurez-la dans le fichier .env"
            }, 400)

        try:
            call_fn = pconfig["call"]
            payload = call_fn(messages, model, stream=stream)

            if stream:
                self._handle_streaming_response(payload, pname)
            else:
                self._handle_sync_response(payload, pname)

        except HTTPError as e:
            err = e.read().decode()
            try:
                msg = json.loads(err).get("error", {}).get("message", err)
            except Exception:
                msg = err
            json_resp(self, {"error": msg}, e.code)
        except URLError as e:
            json_resp(self, {"error": f"Connexion impossible : {e.reason}"}, 502)
        except Exception as e:
            json_resp(self, {"error": f"Erreur : {str(e)}"}, 500)

    def _handle_sync_response(self, resp, provider_name):
        data = json.loads(resp.read())
        if provider_name == "anthropic":
            content = data.get("content", [{}])[0].get("text", "")
        else:
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        json_resp(self, {"content": content})

    def _handle_streaming_response(self, resp, provider_name):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        parser = STREAM_PARSERS.get(provider_name, parse_openai_stream)
        parser(resp, self._sse_send)

    def _sse_send(self, event, data):
        try:
            self.wfile.write(f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8"))
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _handle_save_conversation(self):
        try:
            data = self._read_body()
        except json.JSONDecodeError:
            return json_resp(self, {"error": "JSON invalide"}, 400)
        conv_id = data.get("id", str(uuid.uuid4()))
        title = data.get("title", "Conversation")
        provider = data.get("provider", PROVIDER)
        model = data.get("model", "gpt-4o")
        messages = data.get("messages", [])
        db_save_conversation(conv_id, title, provider, model, messages)
        json_resp(self, {"ok": True, "id": conv_id})

    def _handle_upload(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        boundary = self.headers.get("Content-Type", "").split("boundary=", 1)[-1].strip()
        if not boundary:
            return json_resp(self, {"error": "No boundary"}, 400)

        # Parse multipart
        boundary = boundary.encode("utf-8")
        parts = raw.split(b"--" + boundary)
        text_content = ""
        for part in parts:
            if b"Content-Disposition" in part and b"filename=" in part:
                header_end = part.find(b"\r\n\r\n")
                if header_end != -1:
                    file_data = part[header_end + 4:]
                    file_data = file_data.rstrip(b"\r\n--")
                    # Try to extract text
                    try:
                        text_content += file_data.decode("utf-8", errors="replace")
                    except Exception:
                        text_content += f"[Fichier binaire: {len(file_data)} octets]\n"

        # If it looks like a document, provide it as context
        if text_content.strip():
            msg = json.dumps({"text": text_content.strip()[:10000]})
        else:
            msg = json.dumps({"text": "[Fichier reçu mais non lisible]"})

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(msg.encode("utf-8"))


    def _handle_feedback(self):
        try:
            data = self._read_body()
        except json.JSONDecodeError:
            return json_resp(self, {"error": "JSON invalide"}, 400)
        conv_id = data.get("conversation_id", "")
        msg_idx = data.get("message_idx", 0)
        user_q = data.get("user_question", "")
        ai_resp = data.get("ai_response", "")
        rating = data.get("rating", 0)
        correction = data.get("correction", "")
        if not conv_id or rating == 0:
            return json_resp(self, {"error": "conversation_id et rating requis"}, 400)
        db_save_feedback(conv_id, msg_idx, user_q, ai_resp, rating, correction)
        msg = "Merci pour votre retour ! 🙏" if rating == 1 else "Merci pour votre correction, ça m'aide à apprendre ! 📚"
        json_resp(self, {"ok": True, "message": msg})


# ── Entry point ──────────────────────────────────────────────────────────

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    init_db()

    banner = """
    ╔══════════════════════════════════════════════════════╗
    ║     🇲🇦  Mouwatin AI  ·  مواطن AI                    ║
    ║     المساعد الإداري المغربي                           ║
    ║     Assistant Administratif Marocain                 ║
    ╚══════════════════════════════════════════════════════╝
    """
    print(banner)
    print(f"  🚀  Serveur : http://localhost:{PORT}")
    print(f"  🗄️   Base : {DB_PATH}")
    print(f"  🤖  Provider : {PROVIDER}")
    print(f"  📋  Streaming : activé")
    print(f"  ⌨️   Ctrl+C pour arrêter\n")

    server = HTTPServer(("0.0.0.0", PORT), MouwatinHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋  Arrêt du serveur.")
        server.server_close()
        sys.exit(0)

if __name__ == "__main__":
    main()
