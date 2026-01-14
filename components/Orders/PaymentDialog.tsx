import React, { useEffect, useState, useRef } from "react";
import { OrderData } from "../../types";
import { useVendor } from "../../vendor/VendorContext";
import {
    calcDeductFeesPence,
    toPenceString,
    useOrder,
    PAYMENT_BASE_URL,
} from "../../context/OrderContext";

interface PaymentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    order: OrderData;
    onPaymentSuccess: (amount: number) => void;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
    isOpen,
    onClose,
    order,
    onPaymentSuccess,
}) => {
    const { vendor } = useVendor();
    const { config } = useOrder();

    const [status, setStatus] = useState<string>("Payment Processing...");
    const [pinRequired, setPinRequired] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isFailed, setIsFailed] = useState(false);

    const eventSourceRef = useRef<EventSource | null>(null);

    // Calculate fees and amount
    const total = parseFloat(order.total || "0");
    const finalPricePence = toPenceString(total);
    const deductFees = calcDeductFeesPence(
        total,
        config?.stripeFeesPents,
        config?.stripeFeesPercent
    );

    useEffect(() => {
        if (isOpen) {
            startPaymentFlow();
        } else {
            stopPaymentFlow();
        }
        return () => stopPaymentFlow();
    }, [isOpen]);

    const stopPaymentFlow = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    };

    const startPaymentFlow = async () => {
        setStatus("Payment Processing...");
        setIsSuccess(false);
        setIsFailed(false);
        setPinRequired(false);

        const terminal2 = vendor?.terminal;
        const apiUrl = vendor?.apiUrl;
        const vendorId = config?.vendorId;

        if (!terminal2 || !apiUrl || !vendorId) {
            setStatus("Error: Missing Vendor Configuration");
            setIsFailed(true);
            return;
        }

        // Exact payload mapping as per Dart / OrderContext
        const orderPayload = {
            name: order.name || "",
            payment: "terminal",
            phone: order.phone || "",
            service: order.service || "collection",
            time: order.delivery || order.time || "",
            total: total,
            chargeId: order.chargeId || "",
            address: order.pickup || order.address || "",
            order_type: "kiosk",
            genral_note: order.review || order.genral_note || "",
            delivery_charge: parseFloat(order.deliveryCharge || "0"),
            post_code: order.postCode || "",
            total_with_delivery: parseFloat(order.totalWithDelivery || String(total)),
            order_service_fee: parseFloat(order.orderServiceFee || "0"),
            discount_percentage: parseFloat(order.discountPercentage || "0"),
            discount_price: parseFloat(order.discountedPrice || "0"),
            storeId: order.store_id || order.storeId || "12345",
            deviceId: "KIOSK-01",
            foodHubOrderId: order.foodHubOrderId || "",

            listitem: order.row?.map((r) => ({
                id: r.id,
                name: r.name,
                name_variant: r.name_variant || r.variantName || "",
                variant_id: r.variant_id || "0",
                variant_desc: r.variant_desc || "",
                base_price: r.base_price || 0,
                price: r.price,
                qty: r.qty,
                total: r.total,
                note: r.note || "",

                modifier: r.rowDetail?.map((mod) => ({
                    id: mod.id,
                    group_id: mod.group_id,
                    group_name: mod.group_name,
                    name: mod.modName || mod.name,
                    price: mod.modPrice || 0,
                    modqty: mod.modqty
                })) || []
            })) || [],
        };

        const deductFees = calcDeductFeesPence(
            total,
            config?.stripeFeesPents,
            config?.stripeFeesPercent
        );

        const bodyData = {
            amount: finalPricePence,
            terminal: terminal2,
            apiUrl: apiUrl,
            merchantId: vendorId,
            order: JSON.stringify(orderPayload),
            deducted_amount: deductFees,
        };

        console.log("Starting Payment Flow (SSE Update)", bodyData);

        try {
            // Use payment_update_flow_stream for existing orders
            const url = `${PAYMENT_BASE_URL}/payment_update_flow_stream`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=UTF-8",
                    "Accept": "text/event-stream",
                },
                body: JSON.stringify(bodyData),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Connection failed: ${response.statusText} - ${text}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error("No response body");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data:")) {
                        const data = line.replace("data:", "").trim();
                        console.log("PAYMENT SSE:", data);

                        if (data.includes("succeeded")) {
                            setStatus("Payment Completed!");
                            setIsSuccess(true);
                            stopPaymentFlow();
                        } else if (data.includes("failed") || data.includes("card_declined")) {
                            setStatus("Payment Failed!");
                            setIsFailed(true);
                            stopPaymentFlow();
                        } else if (data.includes("offline_pin_required")) {
                            setStatus("Insert Card!");
                            setPinRequired(true);
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error("Payment SSE Error:", e);
            setStatus(`Payment Error: ${e.message || "Unknown"}`);
            setIsFailed(true);
        }
    };

    const handleCancel = () => {
        // Ideally verify if we can cancel
        stopPaymentFlow();
        onClose();
    };

    const handleDone = () => {
        onPaymentSuccess(total);
        onClose();
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col items-center p-6 bg-clip-padding border border-gray-200">
                {/* Close Header */}
                <div className="w-full flex justify-end mb-4">
                    <button onClick={onClose} className="bg-gray-200 p-2 rounded-full hover:bg-gray-300 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="text-xl font-bold mb-6 text-center">{status}</div>

                {/* Visual Indicator */}
                <div className="mb-8">
                    {isSuccess ? (
                        <div className="bg-black rounded-full w-40 h-40 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    ) : pinRequired ? (
                        <div className="bg-[url('/lib/assets/images/insertcard-bg.png')] w-40 h-40 bg-contain bg-no-repeat bg-center">
                            {/* Placeholder for insert card image */}
                            <div className="w-40 h-40 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400">
                                Insert Card
                            </div>
                        </div>
                    ) : isFailed ? (
                        <div className="rounded-full w-40 h-40 flex items-center justify-center bg-red-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                    ) : (
                        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#c2410c]"></div>
                    )}
                </div>

                <div className="text-3xl font-bold text-blue-600 mb-8">
                    £{total.toFixed(2)}
                </div>

                {/* Actions */}
                <div className="w-full">
                    {isSuccess ? (
                        <button
                            onClick={handleDone}
                            className="w-full bg-[#c2410c] text-white font-bold py-4 rounded-full text-xl hover:bg-[#a93c10] transition-colors"
                        >
                            Done
                        </button>
                    ) : (
                        <button
                            onClick={handleCancel}
                            className="w-full bg-[#c2410c] text-white font-bold py-4 rounded-full text-xl hover:bg-[#a93c10] transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentDialog;
