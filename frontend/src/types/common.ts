export type Theme = 'dark' | 'light';

export interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;
  icon?: string;
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
