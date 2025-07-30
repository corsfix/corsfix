import { config } from "@/config/constants";

export function getProductById(product_id: string) {
  return config.products.find((product) => product.id === product_id);
}
