/**
 * A product is low on stock when it has a minimum and the stock is at or below it.
 * One rule for the product list, the overview and the low-stock notifications.
 */
export function isLowStock(p: { stock: number; min_stock: number }): boolean {
    return p.min_stock > 0 && p.stock <= p.min_stock;
}
