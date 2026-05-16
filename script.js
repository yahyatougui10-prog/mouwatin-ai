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
}

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
if (state.lang === 'ar') document.documentElement.dir = 'rtl'

// ── Helpers ──

function esc(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function formatContent(content) {
  let html = esc(content)
    .replace(/### (.*?)(?:\n|$)/g, '<div class="section-title">$1</div>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/(①|②|③|④|⑤|⑥|⑦|⑧)/g, '<span class="highlight">$1</span>')

  // Convert numbered lists
  html = html.replace(/(\d+)\. /g, '<span style="color:var(--green);font-weight:600;">$1.</span> ')

  return html
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight
  })
}

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
    // Fallback
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
    showToast(t('Copié !', 'تم النسخ !'))
  })
}

// ── Models ──

function populateModels(provider) {
  const models = MODELS_BY_PROVIDER[provider] || MODELS_BY_PROVIDER.openai
  modelSelect.innerHTML = models.map(m =>
    `<option value="${m}"${m === state.model ? ' selected' : ''}>${m}</option>`
  ).join('')
}

// ── Message rendering ──

function addMessage(role, content, isStreaming = false) {
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

    // Copy button for assistant messages
    if (role === 'assistant') {
      const copyBtn = document.createElement('button')
      copyBtn.className = 'copy-btn'
      copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      copyBtn.title = t('Copier', 'نسخ')
      copyBtn.onclick = () => copyToClipboard(content)
      footer.appendChild(copyBtn)
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
  if (isLoading) {
    showTyping()
  } else {
    hideTyping()
  }
  if (!isLoading) chatInput.focus()
}

// ── Chat logic ──

async function sendMessage(text) {
  if (!text.trim() || state.loading) return

  const msg = { role: 'user', content: text.trim() }
  state.messages.push(msg)
  addMessage('user', text.trim())

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
    finalizeStreamingMessage(state.streamingContent)
    state.messages.push({ role: 'assistant', content: state.streamingContent })
    state.streamingContent = ''
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
      addMessage(msg.role, msg.content)
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

// Search conversations
searchInput.addEventListener('input', renderHistory)

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
    chatForm.dispatchEvent(new Event('submit'))
  }
  // Escape to close settings
  if (e.key === 'Escape') {
    settingsPanel.classList.add('hidden')
    sidebar.classList.remove('open')
    overlay.classList.remove('open')
  }
  // Ctrl+Shift+E to export
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault()
    exportPDF()
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

// ── Focus input on load ──
chatInput.focus()

console.log('🇲🇦 Mouwatin AI loaded')
