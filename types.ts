// API Response Types matching the Dart structure

export interface ListElement {
  id: number | string;
  name: string;
  price: number;
  disable: number | boolean;
  photo?: string;
}

export interface Modifierlist {
  id: number | string;
  name: string;
  number: string;
  group_voice?: string;
  is_multiple: number | boolean;
  limit_on_modifier: number;
  group_name: string;
  list: ListElement[];
}

export interface Variantlist {
  id: number | string;
  name: string;
  number: string;
  price: number;
  description: string;
  modifierlist: Modifierlist[];
}

export interface Itemlist {
  id: number | string;
  name: string;
  number: string;
  description: string;
  photo: string;
  image_text?: string;
  is_single_variant: number | boolean;
  variant_voice?: string;
  out_of_stock?: number | boolean;
  variantlist: Variantlist[];
}

export interface Categorylist {
  id: number | string;
  name: string;
  number: string;
  photo: string;
  show_desc: number | boolean;
  show_duration: number | boolean;
  start_time: string;
  end_time: string;
  top_selling: number | boolean;
  itemlist: Itemlist[];
}

export interface Basesound {
  click: string;
  payment: string;
  qrcode: string;
  timeframe: string;
  done: string;
  addotcart: string;
  category: string;
  note: string;
  nocard: string;
  description: string;
  proceed: string;
  proceed_no_card: string;
  oops: string;
  welcome: string;
}

export interface MainCategory {
  basesound: Basesound;
  categorylist: Categorylist[];
}

// Order Construction Types

export interface SelectedModifier {
  id: number | string;
  groupId: number | string;
  groupName: string;
  name: string;
  price: number;
  modqty: number;
}

export interface CartItem {
  cartId: string; // Internal unique ID for React keys
  id: number | string; // Item ID
  name: string;
  nameVariant: string;
  variantId: number | string;
  basePrice: number;
  price: number;
  qty: number;
  total: number;
  modifiers: SelectedModifier[];
  note?: string;
}

export interface Order {
  name?: string;
  payment?: string;
  phone?: string;
  service?: string;
  time?: string;
  total: number;
  discount?: number;
  chargeId?: string;
  address?: string;
  orderType?: string;
  genralNote?: string;
  deliveryCharge?: number;
  postCode?: string;
  totalWithDelivery?: number;
  orderServiceFee?: number;
  discountPercentage?: number;
  storeId?: string;
  deviceId?: string;
  foodHubOrderId?: string;
  discountedPrice?: number;
  listitem: CartItem[];
}

export interface OrderResult {
  qrcode?: string;
  random_id?: string;
  order_number?: number;
  checkhosturl?: string;
  update?: number | string; // Added for sync
}

// Back office / Kitchen Display Types (matching Dart AllOrders/Order models)

export interface RowDetail {
  id: number | string;
  group_id: number | string;
  group_name: string;
  name: string;
  price: number;
  modqty: number;
  modName?: string; // Dart maps this
  modPrice?: number;
}

export interface OrderRow {
  id: number | string;
  name: string;
  name_variant?: string;
  variant_id?: number | string;
  variant_desc?: string;
  base_price?: number;
  price?: number;
  qty?: number;
  total?: string | number; // Dart uses string often for money
  note?: string;
  rowDetail?: RowDetail[];
  itemBaseName?: string;
  variantName?: string;
  itemTotal?: number | string;
}

export interface OrderData {
  id: number | string;
  number: string;
  store_id?: string;
  service: string; // Instore, Delivery, Collection
  payment: string; // cash, card, terminal
  isPaid: string; // "0" or "1"
  total?: string;
  phone?: string;
  email?: string;
  name?: string;
  pickup?: string; // Address/Table
  delivery?: string; // Time
  ctime?: string; // Created time
  status?: string;
  orderType?: string; // Food, Drink, etc.
  row?: OrderRow[];
  review?: any;
}

export interface AllOrdersResponse {
  orders: OrderData[];
  update: number | string;
}

export interface OrderUpdateModel {
  action: string;
  app: string;
  id?: number | string;
  payment?: string;
  total?: number;
}

export interface OrderCancelRequest {
  action: string;
  app: string;
  id?: number | string;
  storeId?: string;
  deviceId?: string;
}