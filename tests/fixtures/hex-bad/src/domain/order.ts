import { query } from "../infra/db";

export interface Order {
  id: string;
  amount: number;
}

export function getOrder(id: string): Order | null {
  const rows = query(`SELECT * FROM orders WHERE id = '${id}'`);
  return (rows[0] as Order) ?? null;
}
