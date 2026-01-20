export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Participant {
  id: number;
  name: string;
  email: string;
  userId?: number | null;
  createdByUserId?: number | null;
  createdAt?: string;
}

export interface Ingredient {
  id?: number;
  name: string;
  quantity: number;
  unit: string;
}

export interface Template {
  id: number;
  title: string;
  servings: number;
  updatedAt?: string;
  ingredients: Ingredient[];
}

export interface TemplateSummary {
  id: number;
  title: string;
  servings: number;
  updatedAt?: string;
}

export interface ShoppingListItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface ShoppingListResponse {
  participantCount: number;
  template: {
    id: number;
    title: string;
    servings: number;
  } | null;
  items: ShoppingListItem[];
}

export interface ResetSettings {
  resetDayOfWeek: number;
  resetHour: number;
  resetMinute: number;
  lastReset?: string | null;
  activeTemplateId?: number | null;
}
