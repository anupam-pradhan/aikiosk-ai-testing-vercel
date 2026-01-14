import React from "react";
import { useOrder } from "../context/OrderContext";
import ProductGrid from "./ProductGrid";
import VariantSelector from "./VariantSelector";
import ModifierSelector from "./ModifierSelector";

const ItemGrid: React.FC = () => {
  const { wizardStep } = useOrder();

  switch (wizardStep) {
    case "VARIANT":
      return <VariantSelector />;
    case "MODIFIER":
      return <ModifierSelector />;
    case "BROWSE":
    default:
      return <ProductGrid />;
  }
};

export default ItemGrid;
