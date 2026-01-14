import React from "react";
import { OrderData } from "../../types";
import { MdArrowBack } from "react-icons/md";

interface OrderDetailProps {
    order: OrderData;
    onClose: () => void;
    onPay?: (order: OrderData) => void;
    onEdit?: (order: OrderData) => void;
    onDelete?: (order: OrderData) => void;
}

const OrderDetail: React.FC<OrderDetailProps> = ({
    onClose,
    order,
    onPay,
    onEdit,
    onDelete,
}) => {
    const isPaid = order.isPaid === "1";
    const statusColor = isPaid ? "text-green-600" : "text-blue-600";
    const statusText = isPaid ? "Paid" : "Pending";
    const total = parseFloat(order.total || "0").toFixed(2);

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header Info */}
            <div className="flex h-1/5 border-b border-gray-200">
                <div className="flex-1 p-4 border-r border-gray-200 flex flex-col justify-center">
                    <div className="flex gap-2">
                        <span className="text-[#c2410c] font-medium">Order No:</span>
                        <span className="font-bold">{order.number}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-[#c2410c] font-medium">Type:</span>
                        <span>{order.service}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-[#c2410c] font-medium">Phone No:</span>
                        <span>{order.phone}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-[#c2410c] font-medium">Address:</span>
                        <span className="truncate max-w-[150px]" title={order.pickup}>
                            {order.pickup}
                        </span>
                    </div>
                </div>

                <div className="w-1/5 border-r border-gray-200 flex flex-col items-center justify-center p-2 text-center">
                    <div className="text-[#c2410c] font-bold text-lg">
                        {order.delivery ? "Scheduled" : "Soon As"}
                    </div>
                    <div className="text-green-600 font-bold">{order.delivery}</div>
                </div>

                <div className="flex-1 p-4 flex flex-col justify-center">
                    <div className={`text-xl font-bold ${statusColor} mb-2`}>
                        {statusText}: £{total}
                    </div>
                    <div className="flex gap-2 text-sm text-gray-600 mb-2">
                        <span className="text-[#c2410c]">Ordered At:</span>
                        <span>{order.ctime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex gap-2">
                                <span className="text-[#c2410c]">Total Items:</span>
                                <span>{order.row?.length || 0}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[#c2410c]">Price:</span>
                                <span>£{total}</span>
                            </div>
                        </div>
                        {!isPaid && onPay && (
                            <button
                                onClick={() => onPay(order)}
                                className="bg-red-500 text-white px-6 py-2 rounded-full font-bold text-lg hover:bg-red-600 active:scale-95 transition-all shadow-md"
                            >
                                Pay
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Grid of Items */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {order.row?.map((item, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex flex-col gap-2"
                        >
                            <div className="flex justify-between items-start">
                                <div className="font-bold text-gray-800 line-clamp-2 min-h-[3rem]">
                                    {item.itemBaseName} {item.variantName}
                                </div>
                                <div className="font-medium text-gray-900">
                                    £{parseFloat(item.itemTotal?.toString() || "0").toFixed(2)}
                                </div>
                            </div>

                            <div className="flex-1 text-sm text-gray-600 overflow-y-auto max-h-[80px]">
                                {item.rowDetail?.map((mod) => mod.modName).join(", ")}
                            </div>

                            {item.note && (
                                <div className="mt-2 text-sm border-t pt-2">
                                    <span className="text-[#c2410c] font-medium">Note: </span>
                                    <span className="text-gray-700">
                                        {item.note.includes("Remove") ? "Remove: " : ""}
                                        {item.note.replace("Remove: ", "").replace("\n", "")}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="h-auto py-4 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between px-6 gap-4">
            
            {/* --- Back Button --- */}
            <button
                onClick={onClose}
                className="
                    group relative flex items-center gap-3 px-8 py-3 rounded-full 
                    bg-gradient-to-br from-gray-600 to-gray-700 text-white 
                    font-bold text-xl shadow-lg 
                    border border-gray-600/30
                    hover:from-gray-600 hover:to-gray-700 
                    hover:shadow-gray-700/40 hover:shadow-2xl 
                    active:translate-y-0 active:scale-95 active:shadow-sm
                    transition-all duration-300 ease-out
                "
            >
                <span className="text-2xl transition-transform duration-300 group-hover:-translate-x-1">
                <MdArrowBack size={24} />
                </span>
                <span>Back</span>
                
                <div className="absolute inset-0 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>

            {/* --- Action Buttons --- */}
            <div className="flex items-center gap-4">
                {!isPaid && order.payment === "cash" && onEdit && (
                <button
                    onClick={() => onEdit(order)}
                    className="bg-red-500 text-white px-8 py-3 rounded-full font-bold text-xl hover:bg-red-600 active:scale-95 transition-all shadow-md"
                >
                    Edit Order
                </button>
                )}

                {onDelete && (
                <button
                    onClick={() => onDelete(order)}
                    className="bg-red-500 text-white px-8 py-3 rounded-full font-bold text-xl hover:bg-red-600 active:scale-95 transition-all shadow-md"
                >
                    Delete Order
                </button>
                )}
            </div>
            </div>
            {isPaid && order.row?.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                    No items in this order
                </div>
            )}
        </div>
    );
};

export default OrderDetail;
