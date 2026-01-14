import React, { useEffect, useRef, useState } from "react";
import {
    AllOrdersResponse,
    OrderCancelRequest,
    OrderData,
    OrderUpdateModel,
} from "../../types";
import { cancelOrder, getOrders, updateOrder } from "../../services/api";
import { useVendor } from "../../vendor/VendorContext"; // Assuming we can get baseUrl from here
import { useOrder } from "../../context/OrderContext";
import OrderList from "./OrderList";
import OrderDetail from "./OrderDetail";
import OrderSummaryModal from "./OrderSummaryModal";
import PaymentDialog from "./PaymentDialog";

interface OrdersModalProps {
    isOpen: boolean;
    onClose: () => void;
}


const OrdersModal: React.FC<OrdersModalProps> = ({ isOpen, onClose }) => {
    const { vendor } = useVendor();
    const { loadOrderIntoCart } = useOrder();
    const baseUrl = vendor?.apiUrl || "programmer.megaposonline.net";

    const [orders, setOrders] = useState<OrderData[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
    const [totalOrdersCount, setTotalOrdersCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    // Payment State
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [paymentOrder, setPaymentOrder] = useState<OrderData | null>(null);

    // Poll timer
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchOrdersData = async (forceTotal?: number) => {
        // Determine the total count to send.
        // Dart code sends: totalOrders + orderUpdates + forceGetOrders
        // Here we'll just track the latest update count from the server response.
        try {
            const data = await getOrders(baseUrl, totalOrdersCount);
            if (data) {
                setOrders(data.orders);
                // data.update is sync counter
                const updateCount = parseInt(data.update?.toString() || "0");
                setTotalOrdersCount(data.orders.length + updateCount);

                // Auto select first if none selected
                if (!selectedOrder && data.orders.length > 0) {
                    setSelectedOrder(data.orders[0]);
                } else if (selectedOrder) {
                    // Update selected order reference to keep it fresh
                    const fresh = data.orders.find(o => o.number === selectedOrder.number);
                    if (fresh) setSelectedOrder(fresh);
                }
            }
        } catch (e) {
            console.error("Error fetching orders", e);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchOrdersData().finally(() => setLoading(false));

            timerRef.current = setInterval(() => {
                fetchOrdersData();
            }, 10000); // 10s poll
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isOpen]);

    const handlePay = async (order: OrderData) => {
        setPaymentOrder(order);
        setShowPaymentDialog(true);
    };

    const handleDelete = async (order: OrderData) => {
        if (!confirm(`Are you sure you want to delete Order ${order.number}?`)) return;

        console.log("Attempting to delete order:", { id: order.id, number: order.number, storeId: order.store_id });

        try {
            const result = await cancelOrder(baseUrl, {
                action: "order_cancel",
                app: "pos",
                id: order.id,
                storeId: order.store_id || "12345",
                deviceId: "KIOSK-01"
            });

            console.log("Delete Order Result:", result);

            // Check for success status (handling string/number inconsistencies)
            const statusStr = String(result?.status).toLowerCase();
            const isSuccess = statusStr === "success" || statusStr === "successful" || statusStr === "1";

            if (isSuccess) {
                console.log("Order deleted successfully");
                fetchOrdersData(); // force refresh
            } else {
                // Show specific error from backend
                const msg = result?.message || result?.error || "Unknown error occurred";
                console.error("Order deletion failed with message:", msg);
                alert(`Failed to delete order:\n${msg}`);
            }
        } catch (error: any) {
            console.error("Order deletion exception:", error);
            alert(`Error deleting order:\n${error.message || error}`);
        }
    };

    const handleEdit = (order: OrderData) => {
        if (confirm(`Edit Order ${order.number}? This will replace your current cart.`)) {
            loadOrderIntoCart(order);
            onClose();
        }
    };

    const handlePaymentSuccess = (amount: number) => {
        // Refresh orders to reflect payment status
        setTimeout(() => {
            fetchOrdersData();
        }, 1000); // Small delay to allow backend update
    };

    const getTotalPrice = () => {
        return orders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
            {/* Header */}
            <div className="h-[8vh] bg-[#c2410c] flex items-center justify-between px-4 shrink-0 shadow-md">
                <div className="w-1/3 flex items-center gap-4 text-white">
                    <span className="text-xl font-medium">Orders Today</span>
                    <button
                        onClick={() => { }} // "Orders" button in Dart (refresh?)
                        className="bg-red-700/50 px-4 py-1.5 rounded-full border border-white/30 text-sm font-semibold hover:bg-red-700 transition"
                    >
                        Orders
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-transparent px-4 py-1.5 rounded-full border border-white/30 text-sm font-semibold hover:bg-white/10 transition"
                    >
                        POS
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => { }}
                        className="bg-transparent px-4 py-1.5 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition"
                    >
                        Print
                    </button>
                    <button
                        onClick={() => setShowSummary(true)}
                        className="bg-transparent px-4 py-1.5 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition"
                    >
                        Sales
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-transparent px-4 py-1.5 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition"
                    >
                        Done
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Side: Order List */}
                <div className="w-[30%] border-r border-gray-200 flex flex-col bg-gray-50">
                    <div className="flex-1 overflow-hidden relative">
                        <OrderList
                            orders={orders}
                            selectedOrderId={selectedOrder?.number ?? null}
                            onSelectOrder={setSelectedOrder}
                        />
                    </div>
                    {/* Bottom Summary Small */}
                    <div className="h-24 bg-white border-t border-gray-200 p-2 flex flex-col justify-center gap-2">
                        <div className="flex justify-between px-4 py-1 border border-gray-200 rounded-full bg-gray-50">
                            <span className="text-[#c2410c] font-bold">Orders:</span>
                            <span className="font-bold">{orders.length}</span>
                        </div>
                        <div className="flex justify-between px-4 py-1 border border-gray-200 rounded-full bg-gray-50">
                            <span className="text-[#c2410c] font-bold">Price:</span>
                            <span className="font-bold">£{getTotalPrice().toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Order Detail */}
                <div className="flex-1 bg-white">
                    {selectedOrder ? (
                        <OrderDetail
                            order={selectedOrder}
                            onPay={handlePay}
                            onDelete={handleDelete}
                            onEdit={handleEdit}
                            onClose={onClose}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">Select an order</div>
                    )}
                </div>
            </div>

            <OrderSummaryModal
                isOpen={showSummary}
                onClose={() => setShowSummary(false)}
                orders={orders}
                onPrint={() => { }}
            />

            {showPaymentDialog && paymentOrder && (
                <PaymentDialog
                    isOpen={showPaymentDialog}
                    onClose={() => setShowPaymentDialog(false)}
                    order={paymentOrder}
                    onPaymentSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    );
};

export default OrdersModal;
