import axios from 'axios';
import type {
  User,
  Participant,
  Template,
  TemplateSummary,
  ShoppingListResponse,
  ResetSettings,
  Ingredient,
  IngredientExclusionsResponse,
} from './types';

const SESSION_STORAGE_KEY = 'salat_session_token';
const API_BASE_URL =
  (import.meta as any)?.env?.VITE_API_BASE_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

function safeGetFromStorage(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null) {
  if (!token) {
    delete api.defaults.headers.common['x-session-token'];
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  api.defaults.headers.common['x-session-token'] = token;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function getStoredSessionToken(): string | null {
  return safeGetFromStorage(SESSION_STORAGE_KEY);
}

export async function registerUser(name: string, email: string) {
  const res = await api.post<{ user: User; token: string; expiresAt: string }>(
    '/register',
    { name, email },
  );
  return res.data;
}

export async function loginUser(email: string) {
  const res = await api.post<{ user: User; token: string; expiresAt: string }>(
    '/login',
    { email },
  );
  return res.data;
}

export async function fetchMe() {
  const res = await api.get<{ user: User }>('/me');
  return res.data.user;
}

export async function fetchParticipants() {
  const res = await api.get<{ participants: Participant[] }>('/participants');
  return res.data.participants;
}

export async function joinParticipant(payload?: {
  name?: string;
  email?: string;
}) {
  const res = await api.post<{ participant: Participant }>(
    '/participants',
    payload || {},
  );
  return res.data.participant;
}

export async function leaveSelf() {
  const res = await api.delete<{ removedId: number }>('/participants/self');
  return res.data.removedId;
}

export async function removeParticipant(id: number) {
  const res = await api.delete<{ removedId: number }>(
    `/participants/${id}`,
  );
  return res.data.removedId;
}

export async function updateParticipant(
  id: number,
  payload: { name: string; email: string },
) {
  const res = await api.put<{ participant: Participant }>(
    `/participants/${id}`,
    payload,
  );
  return res.data.participant;
}

export async function fetchShoppingList() {
  const res = await api.get<ShoppingListResponse>('/shopping-list');
  return res.data;
}

export async function fetchActiveTemplate() {
  const res = await api.get<{ template: Template | null }>('/template');
  return res.data.template;
}

export async function fetchTemplates() {
  const res = await api.get<{ templates: TemplateSummary[] }>('/templates');
  return res.data.templates;
}

export async function saveTemplate(payload: {
  id?: number;
  title: string;
  servings: number;
  ingredients: Ingredient[];
}) {
  if (payload.id) {
    const res = await api.put<{ template: Template }>(
      `/template/${payload.id}`,
      payload,
    );
    return res.data.template;
  }
  const res = await api.post<{ template: Template }>('/template', payload);
  return res.data.template;
}

export async function activateTemplate(id: number) {
  const res = await api.post<{ template: Template }>(
    `/template/${id}/activate`,
    {},
  );
  return res.data.template;
}

export async function fetchResetSettings() {
  const res = await api.get<{ settings: ResetSettings; nextReset: string }>(
    '/settings/reset',
  );
  return res.data;
}

export async function updateResetSettings(settings: ResetSettings) {
  const res = await api.put<{ settings: ResetSettings }>(
    '/settings/reset',
    settings,
  );
  return res.data.settings;
}

export async function fetchIngredientExclusions() {
  const res = await api.get<IngredientExclusionsResponse>(
    '/ingredient-exclusions',
  );
  return res.data;
}

export async function saveIngredientExclusions(exclusions: string[]) {
  const res = await api.put<IngredientExclusionsResponse>(
    '/ingredient-exclusions',
    { exclusions },
  );
  return res.data;
}
