import React from "react";
import { OrderData } from "../../types";

interface OrderSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: OrderData[];
    onPrint?: () => void;
}

const OrderSummaryModal: React.FC<OrderSummaryModalProps> = ({
    isOpen,
    onClose,
    orders,
    onPrint,
}) => {
    if (!isOpen) return null;

    // Calculate stats
    const stats = {
        shop: { orders: 0, cash: 0, card: 0 },
        collection: { orders: 0, cash: 0, card: 0 },
        delivery: { orders: 0, cash: 0, card: 0 },
    };

    let totalCash = 0;
    let totalCard = 0;

    orders.forEach((order) => {
        const total = parseFloat(order.total || "0");
        const isPaid = order.isPaid === "1";
        const paymentType = isPaid ? "card" : "cash"; // Simplified based on Dart logic

        if (paymentType === "cash") totalCash += total;
        else totalCard += total;

        const service = (order.service || "").toLowerCase();

        if (service === "instore" || service === "shop") {
            stats.shop.orders++;
            if (paymentType === "cash") stats.shop.cash += total;
            else stats.shop.card += total;
        } else if (service === "collection") {
            stats.collection.orders++;
            if (paymentType === "cash") stats.collection.cash += total;
            else stats.collection.card += total;
        } else if (service === "delivery") {
            stats.delivery.orders++;
            if (paymentType === "cash") stats.delivery.cash += total;
            else stats.delivery.card += total;
        }
    });

    const totalOrders = orders.length;

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 overflow-y-auto">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">
                            {formatDate(new Date())}
                        </h2>
                    </div>

                    <table className="w-full mb-8">
                        <thead>
                            <tr className="text-left">
                                <th className="pb-2 text-[#c2410c] font-bold">Type</th>
                                <th className="pb-2 text-[#c2410c] font-bold text-center">
                                    Orders
                                </th>
                                <th className="pb-2 text-[#c2410c] font-bold text-right">
                                    Cash
                                </th>
                                <th className="pb-2 text-[#c2410c] font-bold text-right">
                                    Card
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="py-3 font-medium">Shop</td>
                                <td className="py-3 text-center">{stats.shop.orders}</td>
                                <td className="py-3 text-right">
                                    £{stats.shop.cash.toFixed(2)}
                                </td>
                                <td className="py-3 text-right">
                                    £{stats.shop.card.toFixed(2)}
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 font-medium">Collection</td>
                                <td className="py-3 text-center">{stats.collection.orders}</td>
                                <td className="py-3 text-right">
                                    £{stats.collection.cash.toFixed(2)}
                                </td>
                                <td className="py-3 text-right">
                                    £{stats.collection.card.toFixed(2)}
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 font-medium">Delivery</td>
                                <td className="py-3 text-center">{stats.delivery.orders}</td>
                                <td className="py-3 text-right">
                                    £{stats.delivery.cash.toFixed(2)}
                                </td>
                                <td className="py-3 text-right">
                                    £{stats.delivery.card.toFixed(2)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="space-y-2 mb-8 px-2">
                        <h3 className="text-[#c2410c] font-bold mb-2">Total</h3>
                        <div className="flex justify-between">
                            <span className="font-medium text-black">Orders:</span>
                            <span className="font-bold text-green-600">{totalOrders}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium text-black">Cash:</span>
                            <span className="font-bold text-green-600">
                                £{totalCash.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium text-black">Card:</span>
                            <span className="font-bold text-green-600">
                                £{totalCard.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={onClose}
                            className="px-8 py-3 rounded-full bg-white border-2 border-[#c2410c] text-[#c2410c] font-bold hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            Close
                        </button>
                        <button
                            onClick={onPrint}
                            className="px-8 py-3 rounded-full bg-white border-2 border-[#c2410c] text-[#c2410c] font-bold hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            Print
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderSummaryModal;
