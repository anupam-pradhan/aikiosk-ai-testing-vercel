import {
  MainCategory,
  Order,
  OrderResult,
  AllOrdersResponse,
  OrderCancelRequest,
  OrderUpdateModel,
  OrderData,
} from "../types";

export const fetchMenu = async (baseurl?: string): Promise<MainCategory> => {
  try {
    const response = await fetch(`https://${baseurl}/api/fetch`);
    if (!response.ok) {
      throw new Error(`Failed to fetch menu: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    // console.error("API Error fetching menu:", error);
    throw error;
  }
};

export const sendOrder = async (
  order: Order,
  baseUrl?: string
): Promise<OrderResult> => {
  try {
    const payload = {
      name: order.name || "",
      payment: "cash",
      phone: order.phone || "",
      service: "collection",
      time: order.time || "",
      total: order.total,
      chargeId: order.chargeId || "",
      address: order.address || "",
      order_type: "kiosk",
      genral_note: order.genralNote || "",
      delivery_charge: order.deliveryCharge || 0,
      post_code: order.postCode || "",
      total_with_delivery: order.totalWithDelivery || order.total,
      order_service_fee: order.orderServiceFee || 0,
      discount_percentage: order.discountPercentage || 0,
      discount_price: order.discountedPrice || 0,
      storeId: order.storeId || "12345",
      deviceId: order.deviceId || "KIOSK-01",
      foodHubOrderId: order.foodHubOrderId || "",
      listitem: order.listitem.map((item) => ({
        id: item.id,
        name: item.name,
        name_variant: item.nameVariant,
        variant_id: item.variantId,
        variant_desc: "",
        base_price: item.basePrice,
        price: item.price,
        qty: item.qty,
        total: item.total,
        note: item.note || "",

        modifier: item.modifiers
          ? item.modifiers.map((mod) => ({
              id: mod.id,
              group_id: mod.groupId,
              group_name: mod.groupName,
              name: mod.name,
              price: mod.price,
              modqty: mod.modqty,
            }))
          : [],
      })),
    };

    // console.log("Sending Order Payload:", JSON.stringify(payload));

    const response = await fetch(`https://${baseUrl}/api/order/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      // console.error("API Error Response:", text);
      throw new Error(
        `Failed to place order: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    // console.log("Order Result:", data);
    return data;
  } catch (error) {
    // console.error("API Error sending order:", error);
    throw error;
  }
};

export const sendOrderUpdate = async (
  order: any,
  baseUrl?: string
): Promise<OrderResult> => {
  try {
    const payload = {
      id: order.id,
      name: order.name || "",
      payment: order.payment || "cash",
      phone: order.phone || "",
      service: order.service || "collection",
      time: order.time || "",
      total: order.total,
      chargeId: order.chargeId || "",
      address: order.address || "",
      order_type: "kiosk",
      genral_note: order.genralNote || "",
      delivery_charge: order.deliveryCharge || 0,
      post_code: order.postCode || "",
      total_with_delivery: order.totalWithDelivery || order.total,
      order_service_fee: order.orderServiceFee || 0,
      discount_percentage: order.discountPercentage || 0,
      discount_price: order.discountedPrice || 0,
      storeId: order.storeId || "12345",
      deviceId: order.deviceId || "KIOSK-01",
      foodHubOrderId: order.foodHubOrderId || "",
      listitem: order.listitem.map((item: any) => ({
        id: item.id,
        name: item.name,
        name_variant: item.nameVariant,
        variant_id: item.variantId,
        variant_desc: "",
        base_price: item.basePrice,
        price: item.price,
        qty: item.qty,
        total: item.total,
        note: item.note || "",

        modifier: item.modifiers
          ? item.modifiers.map((mod: any) => ({
              id: mod.id,
              group_id: mod.groupId,
              group_name: mod.groupName,
              name: mod.name,
              price: mod.price,
              modqty: mod.modqty,
            }))
          : [],
      })),
    };

    // console.log("Sending Order Update Payload:", JSON.stringify(payload));

    const response = await fetch(`https://${baseUrl}/api/order/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      // console.error("API Error Response:", text);
      throw new Error(
        `Failed to update order: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    // console.log("Order Update Result:", data);
    return data;
  } catch (error) {
    // console.error("API Error updating order:", error);
    throw error;
  }
};

export const getOrders = async (
  baseUrl: string,
  totalOrders: number
): Promise<AllOrdersResponse | null> => {
  try {
    const payload = {
      action: "check_orders",
      app: "pos",
      total: totalOrders,
    };

    const response = await fetch(`https://${baseUrl}/api/back/get-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Handle non-200 responses
      return null;
    }

    const rawData = await response.json();

    // Map snake_case to camelCase
    const orders: OrderData[] = (rawData.orders || []).map((o: any) => ({
      id: o.id,
      number: o.number,
      store_id: o.store_id || o.storeId,
      service: o.service,
      payment: o.payment,
      isPaid: o.isPaid || o.is_paid, // Assuming potential snake_case
      total: o.total,
      phone: o.phone,
      email: o.email,
      name: o.name,
      pickup: o.pickup || o.pick_up || o.address, // Fallback to address
      delivery: o.delivery || o.time, // Fallback to time if delivery specific field missing
      ctime: o.ctime || o.created_at,
      status: o.status,
      orderType: o.orderType || o.order_type,
      row: (o.row || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        name_variant: r.name_variant || r.nameVariant,
        variant_id: r.variant_id || r.variantId,
        variant_desc: r.variant_desc,
        base_price: r.base_price || r.basePrice,
        price: r.price,
        qty: r.qty,
        total: r.total,
        note: r.note,
        itemBaseName: r.itemBaseName || r.item_base_name,
        variantName: r.variantName || r.variant_name,
        itemTotal: r.itemTotal || r.item_total,
        rowDetail: (r.rowDetail || r.row_detail || []).map((d: any) => ({
          id: d.id,
          group_id: d.group_id,
          group_name: d.group_name,
          name: d.name,
          price: d.price,
          modqty: d.modqty,
          modName: d.modName || d.mod_name || d.name, // Fallback
          modPrice: d.modPrice || d.mod_price || d.price,
        })),
      })),
      review: o.review,
    }));

    return {
      orders,
      update: rawData.update,
    };
  } catch (error) {
    // console.error("Error fetching orders:", error);
    return null;
  }
};

export const updateOrder = async (
  baseUrl: string,
  updateData: OrderUpdateModel
): Promise<any> => {
  try {
    // According to Dart: {"action": "order_update", ...}
    // But Dart code uses OrderUpdateModel which likely has toJson().
    // We'll construct payload from updateData, ensuring action is set if not already.
    const payload = {
      action: "order_update", // Default action if not in model
      ...updateData,
    };

    const response = await fetch(`https://${baseUrl}/api/back/get-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

    return await response.json();
  } catch (error) {
    console.error("Error updating order:", error);
    throw error;
  }
};

export const cancelOrder = async (
  baseUrl: string,
  cancelData: OrderCancelRequest
): Promise<any> => {
  try {
    const payload = {
      ...cancelData,
      // Ensure we still send app: pos in case backend needs it for logic
      app: cancelData.app || "pos",
    };

    // console.log("Cancelling Order Payload:", JSON.stringify(payload));

    const response = await fetch(`https://${baseUrl}/api/order/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

    // Handle string responses (Dart returns res.body string) or JSON
    const text = await response.text();
    // console.log("Cancel Order Response:", text);

    if (!response.ok) {
      throw new Error(`Cancel request failed: ${response.status} ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      // If response is just a string (e.g. "Order Cancelled"), return it wrapped
      return { message: text, status: "success" };
    }
  } catch (error) {
    // console.error("Error canceling order:", error);
    throw error;
  }
};
