// ===== STATE =====
const state = {
  messages: [],
  loading: false,
  apiKey: localStorage.getItem('mouwatin_api_key') || '',
  model: localStorage.getItem('mouwatin_model') || 'gpt-4o',
}

// ===== DOM REFS =====
const chatMessages = document.getElementById('chatMessages')
const chatForm = document.getElementById('chatForm')
const chatInput = document.getElementById('chatInput')
const sendBtn = document.getElementById('sendBtn')
const typingIndicator = document.getElementById('typingIndicator')
const settingsBtn = document.getElementById('settingsBtn')
const settingsPanel = document.getElementById('settingsPanel')
const apiKeyInput = document.getElementById('apiKeyInput')
const modelSelect = document.getElementById('modelSelect')

// ===== INIT =====
apiKeyInput.value = state.apiKey
modelSelect.value = state.model

// ===== HELPERS =====
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function formatContent(content) {
  // Bold: **text**
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  // Line breaks
  html = html.replace(/\n/g, '<br>')

  // Section titles (### text)
  html = html.replace(
    /### (.*?)<br>/g,
    '<span class="section-title">$1</span>'
  )

  // Numbered circles
  html = html.replace(
    /(①|②|③|④|⑤|⑥|⑦|⑧)/g,
    '<span class="highlight">$1</span>'
  )

  // Lists: "1. text" or "- text"
  html = html.replace(/^\d+\.\s/gm, match => `<span class="highlight">${match.trim()}</span> `)
  html = html.replace(/^-\s/gm, match => `• `)

  return html
}

function addMessage(role, content) {
  const div = document.createElement('div')
  div.className = `message ${role} fade-in`

  const bubble = document.createElement('div')
  bubble.className = 'bubble'

  const contentDiv = document.createElement('div')
  contentDiv.innerHTML = formatContent(content)
  bubble.appendChild(contentDiv)

  const footer = document.createElement('div')
  footer.className = 'bubble-footer'

  if (role === 'assistant') {
    footer.textContent = '🇲🇦 Mouwatin AI'
  } else {
    footer.textContent = 'Vous'
  }

  bubble.appendChild(footer)
  div.appendChild(bubble)

  // Insert before typing indicator
  chatMessages.insertBefore(div, typingIndicator)
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
    chatInput.style.opacity = '0.6'
    showTyping()
  } else {
    chatInput.style.opacity = '1'
    hideTyping()
  }
  chatInput.focus()
}

// ===== AUTO-RESIZE TEXTAREA =====
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto'
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'
})

// ===== SUBMIT =====
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const text = chatInput.value.trim()
  if (!text || state.loading) return

  // Save messages from the DOM for context
  const messageElements = chatMessages.querySelectorAll('.message:not(.hidden)')
  const messages = []

  messageElements.forEach((el) => {
    const role = el.classList.contains('user') ? 'user' : 'assistant'
    const textEl = el.querySelector('.bubble > div')
    if (textEl) {
      // Get text content without the footer
      const content = textEl.innerText.trim()
      if (content) messages.push({ role, content })
    }
  })

  // Add current user message
  messages.push({ role: 'user', content: text })

  // Add to UI
  addMessage('user', text)
  chatInput.value = ''
  chatInput.style.height = 'auto'
  setLoading(true)

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        apiKey: state.apiKey || undefined,
        model: state.model,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Erreur serveur')
    }

    addMessage('assistant', data.content)
  } catch (err) {
    addMessage(
      'assistant',
      `❌ **Erreur** : ${err.message}\n\nVérifie que ta clé API est configurée dans les paramètres ⚙️`
    )
  } finally {
    setLoading(false)
  }
})

// ===== CTRL+ENTER or SHIFT+ENTER = new line, ENTER = send =====
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
    e.preventDefault()
    chatForm.dispatchEvent(new Event('submit'))
  }
})

// ===== SETTINGS =====
settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden')
})

apiKeyInput.addEventListener('change', () => {
  state.apiKey = apiKeyInput.value.trim()
  localStorage.setItem('mouwatin_api_key', state.apiKey)
})

modelSelect.addEventListener('change', () => {
  state.model = modelSelect.value
  localStorage.setItem('mouwatin_model', state.model)
})

// ===== FOCUS INPUT ON LOAD =====
chatInput.focus()
