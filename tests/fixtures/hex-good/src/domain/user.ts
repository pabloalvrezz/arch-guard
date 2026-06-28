import type { Order } from "./order";

export interface User {
  id: string;
  name: string;
  orders: Order[];
}
