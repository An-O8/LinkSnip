//  API Base URL 
const API = 'http://localhost:5000/api'

//  Token helpers 
const getToken = () => localStorage.getItem('token')
const getUser  = () => JSON.parse(localStorage.getItem('user') || 'null')
const setAuth  = (token, user) => {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}
const clearAuth = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

//  Auth guard - redirect to login if not logged in 
const requireAuth = () => {
  if (!getToken()) {
    window.location.href = '/pages/login.html'
    return false
  }
  return true
}

//  Fetch wrapper - automatically adds Authorization header 
const apiFetch = async (path, options = {}) => {
  const token = getToken()
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const data = await res.json()

  if (res.status === 401) {
    clearAuth()
    window.location.href = '/pages/login.html'
  }

  return { ok: res.ok, status: res.status, data }
}

//  Show/hide alert messages 
const showAlert = (elementId, message, type = 'error') => {
  const el = document.getElementById(elementId)
  if (!el) return
  el.textContent = message
  el.className = `alert alert-${type}`
  el.classList.remove('hidden')
  if (type === 'success') {
    setTimeout(() => el.classList.add('hidden'), 3000)
  }
}

//  Copy to clipboard helper 
const copyToClipboard = async (text, btnEl) => {
  await navigator.clipboard.writeText(text)
  const original = btnEl.textContent
  btnEl.textContent = 'Copied!'
  setTimeout(() => btnEl.textContent = original, 1500)
}

//  Toast notifications —replaces alert() with a non-blocking message 
const toast = (message, type = 'success') => {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    document.body.appendChild(container)
  }
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.textContent = message
  container.appendChild(el)

  setTimeout(() => {
    el.classList.add('toast-fade-out')
    setTimeout(() => el.remove(), 200)
  }, 3000)
}

//  Dark mode - persisted in localStorage, applied before paint where possible 
const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}
const initTheme = () => {
  applyTheme(localStorage.getItem('theme') || 'light')
}
const toggleTheme = () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light'
  applyTheme(current === 'dark' ? 'light' : 'dark')
}

//  Download a file from an authenticated endpoint (ex- CSV export) 
const apiDownload = async (path, filename) => {
  const res = await fetch(API + path, {
    headers: { Authorization: `Bearer ${getToken()}` }
  })
  if (!res.ok) {
    toast('Download failed.', 'error')
    return
  }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

//  Format numbers nicely: 1234 - "1,234" 
const formatNumber = (n) => n.toLocaleString()

//  Format date nicely 
const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}
