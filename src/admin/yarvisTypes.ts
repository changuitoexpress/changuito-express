export type YarvisActionType =
  | "assign_order"
  | "change_order_status"
  | "toggle_merchant"
  | "update_merchant"
  | "update_product"
  | "upload_merchant_photo"
  | "upload_product_photo";

export interface YarvisPendingAction {
  type: YarvisActionType;
  payload: Record<string, unknown>;
  summary: string;
  confirmationToken: string;
}

export interface YarvisReply {
  reply: string;
  action: YarvisPendingAction | null;
}

export interface YarvisHistoryEntry {
  role: "user" | "assistant";
  text: string;
}

export interface YarvisContext {
  metrics: {
    pendingOrders: number;
    ordersToday: number;
    merchantsOpen: number;
    merchantsTotal: number;
  };
  orders: Array<{
    id: string;
    business: string;
    status: string;
    courierId: string | null;
  }>;
  merchants: Array<{
    id: string;
    name: string;
    category: string | null;
    isOpen: boolean;
  }>;
  couriers: Array<{ id: string; name: string }>;
  products: Array<{
    id: string;
    merchantId: string;
    merchantName: string;
    name: string;
    price: number;
    available: boolean;
  }>;
}

export type YarvisSendMessage = (
  message: string,
  history: YarvisHistoryEntry[],
  imageName: string | null,
) => Promise<YarvisReply>;

export type YarvisConfirmAction = (
  action: YarvisPendingAction,
  image: File | null,
) => Promise<string>;
