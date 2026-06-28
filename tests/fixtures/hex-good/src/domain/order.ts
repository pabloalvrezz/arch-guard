export interface Order {
  id: string;
  amount: number;
}

export function createOrder(amount: number): Order {
  return { id: crypto.randomUUID(), amount };
}
