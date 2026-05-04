const sessionStore = new Map();

export function getUserSessionId(openId) {
  return sessionStore.get(openId);
}

export function setUserSessionId(openId, sessionId) {
  sessionStore.set(openId, sessionId);
}

export function removeUserSession(openId) {
  sessionStore.delete(openId);
}

export function getAllSessions() {
  return Object.fromEntries(sessionStore);
}
