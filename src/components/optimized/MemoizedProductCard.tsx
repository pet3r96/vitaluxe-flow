import { memo } from "react";
import { ProductCard } from "@/components/products/ProductCard";

/**
 * Memoized version of ProductCard to prevent unnecessary re-renders
 * Only re-renders when product data or callbacks change
 */
export const MemoizedProductCard = memo(
  ProductCard,
  (prevProps, nextProps) => {
    // Custom comparison function
    return (
      prevProps.product.id === nextProps.product.id &&
      prevProps.product.name === nextProps.product.name &&
      prevProps.product.price === nextProps.product.price &&
      prevProps.product.inventory_count === nextProps.product.inventory_count &&
      prevProps.product.image_url === nextProps.product.image_url &&
      prevProps.onAddToCart === nextProps.onAddToCart
    );
  }
);

MemoizedProductCard.displayName = "MemoizedProductCard";
