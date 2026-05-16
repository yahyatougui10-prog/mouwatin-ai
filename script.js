/* =============================================
   Mouwatin AI · Script complet amélioré
   ============================================= */

// ── State ──
const state = {
  messages: [],
  loading: false,
  apiKey: localStorage.getItem('mouwatin_api_key') || '',
  provider: localStorage.getItem('mouwatin_provider') || 'openai',
  model: localStorage.getItem('mouwatin_model') || 'gpt-4o',
  theme: localStorage.getItem('mouwatin_theme') || 'light',
  lang: localStorage.getItem('mouwatin_lang') || 'fr',
  conversations: [],
  currentConversationId: null,
  streamingContent: '',
  streamActive: false,
  abortController: null,
  mediaRecorder: null,
  audioChunks: [],
  isRecording: false,
  isOnline: navigator.onLine,
}

let _messageCounter = 0
let correctionData = null

const MODELS_BY_PROVIDER = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'open-mistral-nemo'],
  ollama: ['ollama:llama3', 'ollama:mistral', 'ollama:qwen2.5', 'ollama:qwen2.5:7b'],
}

const THEMES = ['light', 'dark', 'gold', 'sand']

// ── DOM refs ──
const $ = (id) => document.getElementById(id)
const chatMessages = $('chatMessages')
const chatForm = $('chatForm')
const chatInput = $('chatInput')
const sendBtn = $('sendBtn')
const typingIndicator = $('typingIndicator')
const welcomeScreen = $('welcomeScreen')
const quickActions = $('quickActions')
const settingsBtn = $('settingsBtn')
const settingsPanel = $('settingsPanel')
const apiKeyInput = $('apiKeyInput')
const providerSelect = $('providerSelect')
const modelSelect = $('modelSelect')
const themeSelect = $('themeSelect')
const themeToggle = $('themeToggle')
const menuToggle = $('menuToggle')
const sidebar = $('sidebar')
const overlay = $('sidebarOverlay')
const newChatBtn = $('newChatBtn')
const chatHistory = $('chatHistory')
const chatTitle = $('chatTitle')
const toast = $('toast')
const langBtns = document.querySelectorAll('.lang-btn')
const searchInput = $('searchConversations')
const voiceBtn = $('voiceBtn')
const uploadBtn = $('uploadBtn')
const fileInput = $('fileInput')

// ── Init ──
apiKeyInput.value = state.apiKey
providerSelect.value = state.provider
themeSelect.value = state.theme
populateModels(state.provider)
applyTheme(state.theme)
setActiveLanguage(state.lang)
loadConversations()
loadLearningStats()
if (state.lang === 'ar') document.documentElement.dir = 'rtl'

// ── Helpers ──

function esc(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function escapeHtml(str) {
  const d = document.createElement('div')
  d.textContent = str
  return d.innerHTML
}

function formatContent(content) {
  if (!content) return ''

  let html = content

  // Preserve code blocks first
  const codeBlocks = []
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push({ lang: lang || '', code: code.trimEnd() })
    return `%%CODEBLOCK_${idx}%%`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // Headers
  html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.*?)$/gm, '<h3 class="section-title">$1</h3>')
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>')

  // Bold & italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

  // Highlight circled numbers
  html = html.replace(/(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)/g, '<span class="highlight">$1</span>')

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (line) => {
    if (line.includes('---')) return '<hr class="table-sep">'
    const cells = line.split('|').filter(c => c.trim())
    const tag = line.startsWith('||') ? 'th' : 'td'
    const cellHtml = cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')
    return `<tr>${cellHtml}</tr>`
  })
  html = html.replace(/(<tr>.*?<\/tr>\n?)+/g, '<table>$&</table>')

  // Blockquotes
  html = html.replace(/^&gt; (.*?)$/gm, '<blockquote>$1</blockquote>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>')
  html = html.replace(/^___$/gm, '<hr>')

  // Unordered lists
  html = html.replace(/^[\s]*[-*+]\s+(.*)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')

  // Ordered lists with styled numbers
  html = html.replace(/^(\d+)\.\s+(.*)$/gm, '<li value="$1"><span class="list-num">$1.</span> $2</li>')
  html = html.replace(/(<li value=".*?<\/li>\n?)+/g, '<ol>$&</ol>')

  // Line breaks
  html = html.replace(/\n/g, '<br>')

  // Restore code blocks
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (match, idx) => {
    const block = codeBlocks[parseInt(idx)]
    const langLabel = block.lang ? `<span class="code-lang">${block.lang}</span>` : ''
    const copyBtn = `<button class="code-copy" onclick="copyToClipboard(${JSON.stringify(block.code)})" title="Copier">📋</button>`
    return `<div class="code-block">${langLabel}${copyBtn}<pre><code>${escapeHtml(block.code)}</code></pre></div>`
  })

  // Clean empty paragraphs
  html = html.replace(/<br>\s*<br>/g, '<br>')

  return html
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight
  })
}

// Show scroll-to-bottom button when not at bottom
chatMessages.addEventListener('scroll', () => {
  const btn = document.getElementById('scrollBottomBtn')
  if (!btn) return
  const threshold = 200
  const atBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < threshold
  btn.classList.toggle('visible', !atBottom)
})

function showToast(msg) {
  toast.textContent = msg
  toast.classList.add('show')
  clearTimeout(toast._hide)
  toast._hide = setTimeout(() => toast.classList.remove('show'), 3000)
}

function t(fr, ar) {
  return state.lang === 'ar' ? ar : fr
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(t('Copié !', 'تم النسخ !'))
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
    showToast(t('Copié !', 'تم النسخ !'))
  })
}

// ── Text-to-Speech ──
let speechSynth = null
let speechUtterance = null

function speakText(text) {
  if (!window.speechSynthesis) {
    showToast(t('Synthèse vocale non supportée', 'التركيب الصوتي غير مدعوم'))
    return
  }
  if (speechSynth && speechSynthesis.speaking) {
    speechSynthesis.cancel()
    return
  }
  const cleaned = text.replace(/[①-⑩*#]/g, '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return
  speechUtterance = new SpeechSynthesisUtterance(cleaned)
  speechUtterance.lang = state.lang === 'ar' ? 'ar-MA' : 'fr-FR'
  speechUtterance.rate = 0.95
  speechUtterance.pitch = 1.0
  speechUtterance.volume = 1.0
  speechSynthesis.speak(speechUtterance)
}

// ── Suggestions ──
const FOLLOWUP_SUGGESTIONS = {
  'passeport': ['Quels sont les délais pour un passeport urgent ?', 'Puis-je renouveler mon passeport à l\'étranger ?', 'Combien coûte le passeport marocain ?'],
  'cin': ['Puis-je faire ma CIN en ligne ?', 'CIN perdue que faire ?', 'Délai pour obtenir une CIN'],
  'sarl': ['Capital minimum pour une SARL', 'Statuts SARL modèle', 'SARL vs auto-entrepreneur'],
  'divorce': ['Garde des enfants au Maroc', 'Pension alimentaire Maroc', 'Divorce sans consentement'],
  'permis': ['Code de la route Maroc', 'Permis à points Maroc', 'Auto-école prix'],
  'casier': ['Bulletin n°1 n°2 n°3 différence', 'Casier judiciaire en ligne', 'Casier judiciaire prix'],
  'impôt': ['Déclaration IR en ligne', 'TVA Maroc taux', 'IS Maroc'],
  'default': ['Comment ça marche ?', 'Quels sont vos domaines ?', 'Puis-je vous faire confiance ?'],
}

function getSuggestions(userQuestion) {
  const q = userQuestion.toLowerCase()
  for (const [keyword, suggestions] of Object.entries(FOLLOWUP_SUGGESTIONS)) {
    if (q.includes(keyword)) return suggestions
  }
  return FOLLOWUP_SUGGESTIONS.default
}

function addSuggestions(userQuestion) {
  const suggestions = getSuggestions(userQuestion)
  const container = document.createElement('div')
  container.className = 'suggestions fade-in'

  const label = document.createElement('div')
  label.className = 'suggestions-label'
  label.textContent = t('Suggestions :', 'اقتراحات :')
  container.appendChild(label)

  const chips = document.createElement('div')
  chips.className = 'suggestions-chips'
  suggestions.forEach(s => {
    const chip = document.createElement('button')
    chip.className = 'suggestion-chip'
    chip.textContent = s
    chip.onclick = () => {
      chatInput.value = s
      chatInput.dispatchEvent(new Event('input'))
      chatForm.dispatchEvent(new Event('submit'))
    }
    chips.appendChild(chip)
  })
  container.appendChild(chips)
  chatMessages.insertBefore(container, typingIndicator)
  scrollToBottom()
}

// ── Learning: Feedback & Examples ──

function _getLastUserQuestion() {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].role === 'user') return state.messages[i].content
  }
  return ''
}

async function sendFeedback(msgIdx, rating, userQuestion, aiResponse, groupEl) {
  if (!state.currentConversationId) {
    showToast(t('Sauvegardez d\'abord la conversation', 'احفظ المحادثة أولاً'))
    return
  }

  // Disable buttons after feedback
  groupEl.querySelectorAll('.feedback-btn').forEach(b => b.classList.add('done'))
  if (rating === 1) {
    groupEl.querySelector('.up').classList.add('active')
  }

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: state.currentConversationId,
        message_idx: msgIdx,
        user_question: userQuestion,
        ai_response: aiResponse,
        rating,
        correction: '',
      }),
    })
    if (res.ok) {
      const data = await res.json()
      showToast(data.message || t('Merci ! 🙏', 'شكراً! 🙏'))
      loadLearningStats()
    }
  } catch { /* ignore */ }
}

function openCorrectionModal(msgIdx, userQuestion, aiResponse) {
  correctionData = { msgIdx, userQuestion, aiResponse }
  document.getElementById('correctionQuestion').textContent =
    t('Question : ', 'السؤال : ') + userQuestion
  document.getElementById('correctionInput').value =
    t('--- Correction pour :\n', '--- تصحيح لـ :\n') + aiResponse + '\n\n'
  document.getElementById('correctionModal').classList.remove('hidden')
}

function closeCorrectionModal() {
  document.getElementById('correctionModal').classList.add('hidden')
  correctionData = null
}

// ── Help Modal ──
function showHelp() {
  document.getElementById('helpModal').classList.remove('hidden')
}
function closeHelp() {
  document.getElementById('helpModal').classList.add('hidden')
}

async function submitCorrection() {
  if (!correctionData || !state.currentConversationId) return
  const correction = document.getElementById('correctionInput').value.trim()
  if (!correction) return

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: state.currentConversationId,
        message_idx: correctionData.msgIdx,
        user_question: correctionData.userQuestion,
        ai_response: correctionData.aiResponse,
        rating: -1,
        correction,
      }),
    })
    if (res.ok) {
      showToast(t('Merci pour votre correction ! 📚', 'شكرا على تصحيحك! 📚'))
      loadLearningStats()
    }
  } catch { /* ignore */ }

  closeCorrectionModal()
}

async function loadLearningStats() {
  try {
    const res = await fetch('/api/learning/stats')
    if (res.ok) {
      const stats = await res.json()
      _renderLearningSidebar(stats)
    }
  } catch { /* ignore */ }
}

function _renderLearningSidebar(stats) {
  let el = document.getElementById('learningStats')
  if (!el) return
  el.innerHTML = `
    <div class="learning-stats">
      <div class="stat-item">
        <span class="stat-value">${stats.total_examples}</span>
        <span class="stat-label">${t('Exemples appris', 'أمثلة مكتسبة')}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.total_feedback}</span>
        <span class="stat-label">${t('Retours', 'ملاحظات')}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value ${stats.total_up >= stats.total_down ? 'stat-good' : 'stat-bad'}">${stats.total_up}👍</span>
        <span class="stat-label">${t('Utiles', 'مفيد')}</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.total_down}👎</span>
        <span class="stat-label">${t('Corrections', 'تصحيحات')}</span>
      </div>
    </div>
    ${stats.total_examples > 0 ? `
      <details class="learning-details">
        <summary>${t('Voir les exemples', 'عرض الأمثلة')}</summary>
        <div class="example-list" id="exampleList"></div>
      </details>
    ` : `
      <p class="learning-empty">${t('Aucun exemple appris pour le moment. Les réponses utiles (👍) deviennent automatiquement des exemples après 3 retours positifs.', 'لا توجد أمثلة مكتسبة بعد. الإجابات المفيدة (👍) تصبح تلقائياً أمثلة بعد 3 تقييمات إيجابية.')}</p>
    `}
  `

  if (stats.total_examples > 0) {
    loadExamplesList()
  }
}

async function loadExamplesList() {
  try {
    const res = await fetch('/api/learning/examples')
    if (!res.ok) return
    const examples = await res.json()
    const list = document.getElementById('exampleList')
    if (!list) return
    list.innerHTML = examples.map(ex =>
      `<div class="example-item">
        <div class="example-q">${esc(ex.question.slice(0, 80))}</div>
        <div class="example-meta">⭐ ${ex.quality_score.toFixed(1)} · ${t('Utilisé', 'استخدم')} ${ex.usage_count}x · ${ex.source}</div>
      </div>`
    ).join('') || '<p class="learning-empty">' + t('Aucun exemple', 'لا توجد أمثلة') + '</p>'
  } catch { /* ignore */ }
}

// ── Models ──

function populateModels(provider) {
  const models = MODELS_BY_PROVIDER[provider] || MODELS_BY_PROVIDER.openai
  modelSelect.innerHTML = models.map(m =>
    `<option value="${m}"${m === state.model ? ' selected' : ''}>${m}</option>`
  ).join('')
}

// ── Message rendering ──

function formatTimestamp(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString(state.lang === 'ar' ? 'ar-MA' : 'fr-MA', { hour: '2-digit', minute: '2-digit' })
}

function addMessage(role, content, isStreaming = false, timestamp = null) {
  welcomeScreen.classList.add('hidden')

  const div = document.createElement('div')
  div.className = `message ${role} fade-in`

  const bubble = document.createElement('div')
  bubble.className = 'bubble'

  const contentDiv = document.createElement('div')
  contentDiv.innerHTML = formatContent(content)
  bubble.appendChild(contentDiv)

  if (!isStreaming) {
    const footer = document.createElement('div')
    footer.className = 'bubble-footer'
    const label = role === 'assistant' ? '🇲🇦 Mouwatin AI' : t('Vous', 'أنت')
    footer.textContent = label

    // Timestamp
    if (timestamp) {
      const ts = document.createElement('span')
      ts.className = 'msg-timestamp'
      ts.textContent = formatTimestamp(timestamp)
      footer.appendChild(ts)
    }

    if (role === 'assistant') {
      const msgIdx = _messageCounter++

      const copyBtn = document.createElement('button')
      copyBtn.className = 'copy-btn'
      copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      copyBtn.title = t('Copier', 'نسخ')
      copyBtn.onclick = () => copyToClipboard(content)
      footer.appendChild(copyBtn)

      // Feedback buttons
      const feedbackGroup = document.createElement('span')
      feedbackGroup.className = 'feedback-group'
      feedbackGroup.dataset.msgIdx = msgIdx

      const userMsg = _getLastUserQuestion()
      feedbackGroup.dataset.userQ = userMsg

      const upBtn = document.createElement('button')
      upBtn.className = 'feedback-btn up'
      upBtn.innerHTML = '👍'
      upBtn.title = t('Utile', 'مفيد')
      upBtn.onclick = () => sendFeedback(msgIdx, 1, userMsg, content, feedbackGroup)

      const downBtn = document.createElement('button')
      downBtn.className = 'feedback-btn down'
      downBtn.innerHTML = '👎'
      downBtn.title = t('À améliorer', 'بحاجة للتحسين')
      downBtn.onclick = () => openCorrectionModal(msgIdx, userMsg, content)

      feedbackGroup.appendChild(upBtn)
      feedbackGroup.appendChild(downBtn)
      footer.appendChild(feedbackGroup)

      // TTS button
      const ttsBtn = document.createElement('button')
      ttsBtn.className = 'tts-btn'
      ttsBtn.innerHTML = '🔊'
      ttsBtn.title = t('Lire à voix haute', 'قراءة بصوت عال')
      ttsBtn.onclick = () => speakText(content)
      footer.appendChild(ttsBtn)
    }

    bubble.appendChild(footer)
  }

  div.appendChild(bubble)
  chatMessages.insertBefore(div, typingIndicator)
  scrollToBottom()
  return div
}

function updateStreamingMessage(fullContent) {
  let streamEl = document.querySelector('.message.assistant.streaming')
  if (!streamEl) {
    streamEl = addMessage('assistant', '', true)
    streamEl.classList.add('streaming')
    const cursor = document.createElement('span')
    cursor.className = 'stream-cursor'
    streamEl.querySelector('.bubble > div').after(cursor)
  }

  const contentDiv = streamEl.querySelector('.bubble > div')
  if (contentDiv) {
    contentDiv.innerHTML = formatContent(fullContent)
  }
  scrollToBottom()
}

function finalizeStreamingMessage(fullContent) {
  const streamEl = document.querySelector('.message.assistant.streaming')
  if (!streamEl) return

  streamEl.classList.remove('streaming')
  const cursor = streamEl.querySelector('.stream-cursor')
  if (cursor) cursor.remove()

  const bubble = streamEl.querySelector('.bubble')
  if (!bubble.querySelector('.bubble-footer')) {
    const footer = document.createElement('div')
    footer.className = 'bubble-footer'
    footer.textContent = '🇲🇦 Mouwatin AI'

    const copyBtn = document.createElement('button')
    copyBtn.className = 'copy-btn'
    copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
    copyBtn.title = t('Copier', 'نسخ')
    copyBtn.onclick = () => copyToClipboard(fullContent)
    footer.appendChild(copyBtn)

    bubble.appendChild(footer)
  }

  const contentDiv = streamEl.querySelector('.bubble > div')
  if (contentDiv) {
    contentDiv.innerHTML = formatContent(fullContent)
  }
  scrollToBottom()
}

function showTyping() {
  typingIndicator.classList.remove('hidden')
  scrollToBottom()
}

function hideTyping() {
  typingIndicator.classList.add('hidden')
}

function setLoading(isLoading) {
  state.loading = isLoading
  sendBtn.disabled = isLoading
  chatInput.disabled = isLoading
  // Show/hide stop button
  let stopBtn = document.getElementById('stopBtn')
  if (isLoading) {
    showTyping()
    if (!stopBtn) {
      stopBtn = document.createElement('button')
      stopBtn.id = 'stopBtn'
      stopBtn.className = 'stop-btn'
      stopBtn.innerHTML = '⏹ ' + t('Arrêter', 'إيقاف')
      stopBtn.title = t('Arrêter la génération (Escape)', 'إيقاف التوليد (Escape)')
      stopBtn.onclick = stopStreaming
      sendBtn.parentNode.insertBefore(stopBtn, sendBtn.nextSibling)
    }
    stopBtn.style.display = 'flex'
  } else {
    hideTyping()
    if (stopBtn) stopBtn.style.display = 'none'
  }
  if (!isLoading) chatInput.focus()
}

function stopStreaming() {
  if (state.abortController) {
    state.abortController.abort()
    state.abortController = null
  }
  if (state.streamingContent) {
    finalizeStreamingMessage(state.streamingContent)
    state.messages.push({ role: 'assistant', content: state.streamingContent })
    state.streamingContent = ''
  }
  state.streamActive = false
  setLoading(false)
  showToast(t('Génération arrêtée', 'تم إيقاف التوليد'))
}

// ── Chat logic ──

async function sendMessage(text) {
  if (!text.trim() || state.loading) return
  if (!state.isOnline) {
    showToast(t('⚠️ Vous êtes hors ligne', '⚠️ أنت غير متصل'))
    return
  }

  const ts = new Date().toISOString()
  const msg = { role: 'user', content: text.trim(), timestamp: ts }
  state.messages.push(msg)
  addMessage('user', text.trim(), false, ts)

  chatInput.value = ''
  chatInput.style.height = 'auto'
  setLoading(true)

  if (state.abortController) {
    state.abortController.abort()
  }
  state.abortController = new AbortController()

  try {
    await sendStreamingRequest(msg)
    saveConversation()
  } catch (err) {
    if (err.name === 'AbortError') return
    addMessage(
      'assistant',
      `❌ **${t('Erreur', 'خطأ')}** : ${err.message}\n\n${t(
        'Vérifie que ta clé API est configurée dans les paramètres ⚙️',
        'تأكد من ضبط مفتاح API في الإعدادات ⚙️'
      )}`
    )
  } finally {
    setLoading(false)
    state.streamActive = false
    state.abortController = null
  }
}

async function sendStreamingRequest(msg) {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: state.messages,
      apiKey: state.apiKey || undefined,
      provider: state.provider,
      model: state.model,
    }),
    signal: state.abortController?.signal,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Erreur ${res.status}`)
  }

  state.streamActive = true
  state.streamingContent = ''

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let pos
    while ((pos = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, pos)
      buffer = buffer.slice(pos + 2)

      const eventMatch = block.match(/^event: (.+)$/m)
      const dataMatch = block.match(/^data: (.+)$/m)

      const event = eventMatch ? eventMatch[1] : 'message'
      const dataStr = dataMatch ? dataMatch[1] : block

      if (event === 'token') {
        try {
          const token = JSON.parse(dataStr)
          state.streamingContent += token
          updateStreamingMessage(state.streamingContent)
        } catch { /* skip */ }
      } else if (event === 'done') {
        // done
      }
    }
  }

  if (state.streamingContent) {
    const ts = new Date().toISOString()
    finalizeStreamingMessage(state.streamingContent)
    state.messages.push({ role: 'assistant', content: state.streamingContent, timestamp: ts })
    state.streamingContent = ''
    // Add suggestions based on last user question
    const lastUser = _getLastUserQuestion()
    if (lastUser) addSuggestions(lastUser)
  }
}

// ── Conversation persistence (server-side) ──

async function saveConversation() {
  if (state.messages.length === 0) return

  const firstMsg = state.messages.find(m => m.role === 'user')
  const title = firstMsg
    ? firstMsg.content.slice(0, 50) + (firstMsg.content.length > 50 ? '…' : '')
    : `${t('Conversation', 'محادثة')} ${new Date().toLocaleDateString()}`

  const convId = state.currentConversationId || crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString()

  try {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: convId,
        title,
        provider: state.provider,
        model: state.model,
        messages: state.messages,
      }),
    })
    if (res.ok) {
      state.currentConversationId = convId
      await loadConversations()
    }
  } catch {
    // Silently fail — server might not be available
  }
}

async function loadConversations() {
  try {
    const res = await fetch('/api/conversations')
    if (res.ok) {
      state.conversations = await res.json()
      renderHistory()
    }
  } catch {
    // Server might not be available
  }
}

async function searchConversations(query) {
  if (!query) return loadConversations()
  try {
    const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(query)}`)
    if (res.ok) {
      state.conversations = await res.json()
      renderHistory()
    }
  } catch { /* ignore */ }
}

async function clearAllConversations() {
  if (!confirm(t('Supprimer toutes les conversations ?', 'حذف جميع المحادثات؟'))) return
  try {
    const res = await fetch('/api/conversations', { method: 'DELETE' })
    if (res.ok) {
      state.conversations = []
      state.currentConversationId = null
      state.messages = []
      document.querySelectorAll('.message').forEach(el => el.remove())
      welcomeScreen.classList.remove('hidden')
      chatTitle.textContent = state.lang === 'ar' ? 'مواطن AI' : 'Mouwatin AI'
      renderHistory()
      showToast(t('Toutes les conversations supprimées', 'تم حذف جميع المحادثات'))
    }
  } catch {
    showToast(t('Erreur lors de la suppression', 'خطأ في الحذف'))
  }
}

async function loadConversation(id) {
  try {
    const res = await fetch(`/api/conversations/${id}`)
    if (!res.ok) return
    const conv = await res.json()

    state.currentConversationId = id
    state.messages = conv.messages || []

    document.querySelectorAll('.message').forEach(el => el.remove())
    welcomeScreen.classList.add('hidden')

    state.messages.forEach(msg => {
      addMessage(msg.role, msg.content, false, msg.timestamp || msg.created_at)
    })

    chatTitle.textContent = conv.title
    renderHistory()
    scrollToBottom()
  } catch { /* ignore */ }
}

async function deleteConversation(id, e) {
  e.stopPropagation()
  try {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    state.conversations = state.conversations.filter(c => c.id !== id)
    if (state.currentConversationId === id) {
      newConversation()
    } else {
      renderHistory()
    }
  } catch { /* ignore */ }
}

function newConversation() {
  state.messages = []
  state.currentConversationId = null
  state.streamingContent = ''

  document.querySelectorAll('.message').forEach(el => el.remove())
  welcomeScreen.classList.remove('hidden')
  chatTitle.textContent = state.lang === 'ar' ? 'مواطن AI' : 'Mouwatin AI'
  renderHistory()
}

function renderHistory() {
  const query = (searchInput.value || '').toLowerCase()
  let filtered = state.conversations
  if (query) {
    filtered = state.conversations.filter(c =>
      c.title.toLowerCase().includes(query)
    )
  }

  chatHistory.innerHTML = ''
  if (filtered.length === 0) {
    chatHistory.innerHTML = `<div class="history-empty">${
      query
        ? t('Aucun résultat', 'لا توجد نتائج')
        : t('Aucune conversation', 'لا توجد محادثات بعد')
    }</div>`
    return
  }

  // Group by date
  const groups = {}
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now - 864e5).toDateString()

  filtered.forEach(conv => {
    const d = new Date(conv.updated_at || conv.created_at)
    const key = d.toDateString() === today ? t("Aujourd'hui", 'اليوم')
      : d.toDateString() === yesterday ? t('Hier', 'أمس')
      : d.toLocaleDateString(state.lang === 'ar' ? 'ar-MA' : 'fr-MA', { month: 'short', day: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(conv)
  })

  for (const [groupName, convs] of Object.entries(groups)) {
    const groupHeader = document.createElement('div')
    groupHeader.className = 'history-group'
    groupHeader.textContent = groupName
    chatHistory.appendChild(groupHeader)

    convs.forEach(conv => {
      const div = document.createElement('div')
      div.className = `history-item${conv.id === state.currentConversationId ? ' active' : ''}`
      div.textContent = conv.title

      const del = document.createElement('span')
      del.textContent = ' ✕'
      del.className = 'history-del'
      del.onclick = (e) => deleteConversation(conv.id, e)

      div.appendChild(del)
      div.onmouseenter = () => del.style.opacity = '0.5'
      div.onmouseleave = () => del.style.opacity = '0'
      div.onclick = () => loadConversation(conv.id)

      chatHistory.appendChild(div)
    })
  }
}

// ── Export PDF ──

async function exportPDF() {
  if (!state.currentConversationId) {
    showToast(t('Aucune conversation à exporter', 'لا توجد محادثة للتصدير'))
    return
  }
  try {
    const res = await fetch(`/api/pdf?id=${state.currentConversationId}`)
    if (!res.ok) throw new Error('Erreur')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mouwatin-${state.currentConversationId.slice(0, 8)}.html`
    a.click()
    URL.revokeObjectURL(url)
    showToast(t('Conversation exportée ✓', 'تم تصدير المحادثة ✓'))
  } catch {
    showToast(t("Erreur d'export", 'خطأ في التصدير'))
  }
}

// ── Voice input ──

async function toggleVoice() {
  if (state.isRecording) {
    stopRecording()
    return
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast(t('Entrée vocale non supportée', 'الإدخال الصوتي غير مدعوم'))
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    state.mediaRecorder = new MediaRecorder(stream)
    state.audioChunks = []
    state.isRecording = true
    voiceBtn.classList.add('recording')

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data)
    }

    state.mediaRecorder.onstop = async () => {
      voiceBtn.classList.remove('recording')
      stream.getTracks().forEach(t => t.stop())

      // Use Web Speech API for recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.lang = state.lang === 'ar' ? 'ar-MA' : 'fr-FR'
        recognition.continuous = false
        recognition.interimResults = false

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          chatInput.value += transcript
          chatInput.style.height = 'auto'
          chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'
          chatInput.focus()
        }

        recognition.onerror = () => {
          showToast(t('Reconnaissance vocale échouée', 'فشل التعرف على الصوت'))
        }

        recognition.start()
      } else {
        showToast(t('Reconnaissance vocale non disponible', 'التعرف على الصوت غير متاح'))
      }
    }

    state.mediaRecorder.start()
    showToast(t('Enregistrement... Parlez', 'التسجيل... تحدث'))
  } catch {
    showToast(t('Microphone non accessible', 'الميكروفون غير متاح'))
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop()
    state.isRecording = false
  }
}

// ── File upload ──

async function handleFileUpload(files) {
  if (!files || files.length === 0) return

  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
    if (res.ok) {
      const data = await res.json()
      if (data.text) {
        chatInput.value = (chatInput.value + '\n' + data.text).trim()
        chatInput.style.height = 'auto'
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'
        chatInput.focus()
        showToast(t('Fichier joint ✓', 'تم إرفاق الملف ✓'))
      }
    }
  } catch {
    showToast(t("Erreur d'upload", 'خطأ في الرفع'))
  }
}

// ── Theme ──

function applyTheme(theme) {
  state.theme = theme
  document.documentElement.setAttribute('data-theme', theme)
  themeSelect.value = theme
  const icons = { light: '☀️', dark: '🌙', gold: '🌟', sand: '🏜️' }
  themeToggle.textContent = icons[theme] || '🎨'
  themeToggle.querySelector('.tooltip').textContent =
    theme === 'light' ? t('Mode clair', 'الوضع النهاري')
    : theme === 'dark' ? t('Mode sombre', 'الوضع الليلي')
    : theme === 'gold' ? t('Thème doré', 'السمة الذهبية')
    : t('Thème sable', 'السمة الرملية')
  localStorage.setItem('mouwatin_theme', theme)
}

function cycleTheme() {
  const idx = THEMES.indexOf(state.theme)
  applyTheme(THEMES[(idx + 1) % THEMES.length])
}

// ── Language ──

function setActiveLanguage(lang) {
  state.lang = lang
  localStorage.setItem('mouwatin_lang', lang)
  langBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang)
  })

  if (lang === 'ar') {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    chatInput.placeholder = 'اطرح سؤالك الإداري...'
    sendBtn.title = 'إرسال'
    chatTitle.textContent = state.currentConversationId ? chatTitle.textContent : 'مواطن AI'
    document.title = 'مواطن AI — المساعد الإداري المغربي'
  } else {
    document.documentElement.dir = 'ltr'
    document.documentElement.lang = 'fr'
    chatInput.placeholder = 'Posez votre question administrative...'
    sendBtn.title = 'Envoyer'
    chatTitle.textContent = state.currentConversationId ? chatTitle.textContent : 'Mouwatin AI'
    document.title = 'Mouwatin AI — المساعد الإداري المغربي'
  }

  renderHistory()
}

// ── Event handlers ──

// Form submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const text = chatInput.value.trim()
  if (text && !state.loading) {
    sendMessage(text)
  }
})

// Enter to send, Shift+Enter for newline
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    chatForm.dispatchEvent(new Event('submit'))
  }
})

// Auto-resize
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto'
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'
})

// Quick actions
quickActions.addEventListener('click', (e) => {
  const btn = e.target.closest('.quick-action')
  if (btn && btn.dataset.query) {
    chatInput.value = btn.dataset.query
    chatInput.style.height = 'auto'
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'
    chatForm.dispatchEvent(new Event('submit'))
  }
})

// Settings
settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden')
})

apiKeyInput.addEventListener('change', () => {
  state.apiKey = apiKeyInput.value.trim()
  localStorage.setItem('mouwatin_api_key', state.apiKey)
})

providerSelect.addEventListener('change', () => {
  state.provider = providerSelect.value
  localStorage.setItem('mouwatin_provider', state.provider)
  populateModels(state.provider)
})

modelSelect.addEventListener('change', () => {
  state.model = modelSelect.value
  localStorage.setItem('mouwatin_model', state.model)
})

themeSelect.addEventListener('change', () => {
  applyTheme(themeSelect.value)
})

// Theme toggle
themeToggle.addEventListener('click', cycleTheme)

// Menu toggle (mobile)
menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open')
  overlay.classList.toggle('open')
})

overlay.addEventListener('click', () => {
  sidebar.classList.remove('open')
  overlay.classList.remove('open')
})

// New chat
newChatBtn.addEventListener('click', newConversation)

// Language switcher
langBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveLanguage(btn.dataset.lang)
  })
})

// Search conversations (debounced)
searchInput.addEventListener('input', (() => {
  let timer
  return () => {
    clearTimeout(timer)
    timer = setTimeout(() => searchConversations(searchInput.value.trim()), 300)
  }
})())

// Voice input
voiceBtn.addEventListener('click', toggleVoice)

// File upload
uploadBtn.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  handleFileUpload(fileInput.files)
  fileInput.value = ''
})

// Export PDF - keyboard shortcut
// We'll add it to the header via keyboard shortcut

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+Enter to send
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault()
    if (!state.loading) chatForm.dispatchEvent(new Event('submit'))
  }
  // Escape
  if (e.key === 'Escape') {
    if (state.loading) { stopStreaming(); return }
    settingsPanel.classList.add('hidden')
    document.getElementById('helpModal').classList.add('hidden')
    document.getElementById('correctionModal').classList.add('hidden')
    sidebar.classList.remove('open')
    overlay.classList.remove('open')
  }
  // Ctrl+Shift+E to export
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault()
    exportPDF()
  }
  // Ctrl+N new conversation
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault()
    newConversation()
  }
  // Ctrl+, settings
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault()
    settingsPanel.classList.toggle('hidden')
  }
  // Ctrl+/ help
  if (e.ctrlKey && e.key === '/') {
    e.preventDefault()
    showHelp()
  }
})

// Drag & drop files
document.addEventListener('dragover', (e) => {
  e.preventDefault()
  document.body.classList.add('drag-over')
})

document.addEventListener('dragleave', (e) => {
  if (!e.target.closest('#app')) {
    document.body.classList.remove('drag-over')
  }
})

document.addEventListener('drop', (e) => {
  e.preventDefault()
  document.body.classList.remove('drag-over')
  handleFileUpload(e.dataTransfer.files)
})

// ── Network status ──
window.addEventListener('online', () => {
  state.isOnline = true
  document.body.classList.remove('offline')
  showToast(t('Connexion rétablie ✓', 'تمت استعادة الاتصال ✓'))
})
window.addEventListener('offline', () => {
  state.isOnline = false
  document.body.classList.add('offline')
  showToast(t('⚠️ Connexion perdue', '⚠️ تم فقدان الاتصال'))
})

// ── Register Service Worker (PWA) ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

// ── Focus input on load ──
chatInput.focus()

console.log('🇲🇦 Mouwatin AI v2 loaded')
