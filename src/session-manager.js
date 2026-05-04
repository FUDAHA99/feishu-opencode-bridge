const sessionStore = new Map();
const modelStore = new Map();

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

export function getUserModel(openId) {
  return modelStore.get(openId) || null;
}

export function setUserModel(openId, model) {
  modelStore.set(openId, model);
}

export function removeUserModel(openId) {
  modelStore.delete(openId);
}

const dirStore = new Map();

export function getUserDir(openId) {
  return dirStore.get(openId) || null;
}

export function setUserDir(openId, dir) {
  dirStore.set(openId, dir);
}

export function removeUserDir(openId) {
  dirStore.delete(openId);
}
