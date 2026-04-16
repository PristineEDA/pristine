type MonacoRegistrationStoreGlobal = typeof globalThis & {
  __pristineMonacoRegistrationStores?: Map<string, WeakSet<object>>
}

function getMonacoRegistrationStores() {
  const monacoRegistrationGlobal = globalThis as MonacoRegistrationStoreGlobal

  if (!monacoRegistrationGlobal.__pristineMonacoRegistrationStores) {
    monacoRegistrationGlobal.__pristineMonacoRegistrationStores = new Map()
  }

  return monacoRegistrationGlobal.__pristineMonacoRegistrationStores
}

function isTrackableMonacoInstance(monaco: unknown): monaco is object {
  return (typeof monaco === 'object' && monaco !== null) || typeof monaco === 'function'
}

// Keep registration state outside Monaco's sealed ESM namespace and stable across HMR.
export function claimMonacoRegistration(registrationKey: string, monaco: unknown): boolean {
  if (!isTrackableMonacoInstance(monaco)) {
    return false
  }

  const monacoRegistrationStores = getMonacoRegistrationStores()
  const registeredMonacoInstances = monacoRegistrationStores.get(registrationKey) ?? new WeakSet<object>()

  if (!monacoRegistrationStores.has(registrationKey)) {
    monacoRegistrationStores.set(registrationKey, registeredMonacoInstances)
  }

  if (registeredMonacoInstances.has(monaco)) {
    return false
  }

  registeredMonacoInstances.add(monaco)
  return true
}

export function resetMonacoRegistrationForTests(registrationKey: string): void {
  getMonacoRegistrationStores().set(registrationKey, new WeakSet<object>())
}