import { registerPlugin } from "@capacitor/core";

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  person: string;
  initial: string;
}

export interface LiveActivityStartOptions {
  runId: string;
  storeNames: string;
  items: ShoppingItem[];
  checkedIds: string[];
}

export interface LiveActivityUpdateOptions {
  items: ShoppingItem[];
  checkedIds: string[];
  isDone?: boolean;
}

export interface LiveActivityPlugin {
  start(options: LiveActivityStartOptions): Promise<{ activityId: string }>;
  update(options: LiveActivityUpdateOptions): Promise<void>;
  end(options: LiveActivityUpdateOptions): Promise<void>;
}

export const LiveActivity = registerPlugin<LiveActivityPlugin>("LiveActivity");
