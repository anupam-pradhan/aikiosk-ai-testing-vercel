import React from "react";
import { OrderData } from "../../types";

interface OrderListProps {
    orders: OrderData[];
    selectedOrderId: string | number | null;
    onSelectOrder: (order: OrderData) => void;
}

const OrderList: React.FC<OrderListProps> = ({
    orders,
    selectedOrderId,
    onSelectOrder,
}) => {
    if (!orders || orders.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400 text-xl font-medium">
                No Orders
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            {orders.map((order) => {
                const isSelected = selectedOrderId === order.number;
                const total = parseFloat(order.total || "0").toFixed(2);
                const isPaid = order.isPaid === "1";

                return (
                    <div
                        key={order.id}
                        onClick={() => onSelectOrder(order)}
                        className={`
              flex items-stretch min-h-[5rem] border-b border-gray-100 cursor-pointer transition-colors
              ${isSelected ? "bg-green-50" : "hover:bg-gray-50"}
            `}
                    >
                        {/* ID Tab */}
                        <div className="w-16 bg-red-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                            {order.number}
                        </div>

                        {/* Content */}
                        <div
                            className={`flex-1 p-3 flex flex-col justify-between ${isSelected ? "bg-[#4ade80]" : "bg-white"
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-1">
                                        <span
                                            className={`font-semibold text-sm ${isSelected ? "text-white" : "text-black"
                                                }`}
                                        >
                                            {order.service}:
                                        </span>
                                        <span
                                            className={`text-sm font-bold ${isSelected ? "text-white" : "text-red-500"
                                                }`}
                                        >
                                            {order.orderType}
                                        </span>
                                    </div>
                                    <div
                                        className={`font-medium line-clamp-1 ${isSelected ? "text-white" : "text-black"
                                            }`}
                                    >
                                        {order.name ? `${order.name}, ` : ""}
                                        {order.pickup}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div
                                        className={`font-bold text-lg ${isSelected ? "text-white" : "text-red-500"
                                            }`}
                                    >
                                        £{total}
                                    </div>
                                    <div
                                        className={`
                      inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2
                      ${isPaid
                                                ? "bg-green-500 border-white text-white"
                                                : "bg-red-500 border-white text-white"
                                            }
                    `}
                                    >
                                        {isPaid ? "Card" : "Cash"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default OrderList;
