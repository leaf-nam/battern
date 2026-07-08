import '@testing-library/jest-dom'

class LocalStorageMock {
  constructor() {
    this.store = {}
  }
  getItem(key) {
    return this.store[key] ?? null
  }
  setItem(key, value) {
    this.store[key] = String(value)
  }
  removeItem(key) {
    delete this.store[key]
  }
  clear() {
    this.store = {}
  }
}

Object.defineProperty(window, 'localStorage', {
  value: new LocalStorageMock(),
})
