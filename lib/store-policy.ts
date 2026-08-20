import "server-only";

export type StorePolicy = {
  shippingFee: number | null;
  freeShippingThreshold: number | null;
  averageDispatchTime: string | null;
  shippingMethod: string | null;
  remoteAreaFee: number | null;
  returnExchangeWindow: string | null;
  returnShippingFee: number | null;
  exchangeShippingFee: number | null;
  customerService: string | null;
};

type StorePolicyRow = {
  shipping_fee: number | null;
  free_shipping_threshold: number | null;
  average_dispatch_time: string | null;
  shipping_method: string | null;
  remote_area_fee: number | null;
  return_exchange_window: string | null;
  return_shipping_fee: number | null;
  exchange_shipping_fee: number | null;
  customer_service: string | null;
};

type SupabaseLike = {
  from: (table: string) => any;
};

const EMPTY_POLICY: StorePolicy = {
  shippingFee: null,
  freeShippingThreshold: null,
  averageDispatchTime: null,
  shippingMethod: null,
  remoteAreaFee: null,
  returnExchangeWindow: null,
  returnShippingFee: null,
  exchangeShippingFee: null,
  customerService: null,
};

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function rowToStorePolicy(row: StorePolicyRow | null | undefined): StorePolicy {
  if (!row) return { ...EMPTY_POLICY };

  return {
    shippingFee: row.shipping_fee,
    freeShippingThreshold: row.free_shipping_threshold,
    averageDispatchTime: cleanText(row.average_dispatch_time),
    shippingMethod: cleanText(row.shipping_method),
    remoteAreaFee: row.remote_area_fee,
    returnExchangeWindow: cleanText(row.return_exchange_window),
    returnShippingFee: row.return_shipping_fee,
    exchangeShippingFee: row.exchange_shipping_fee,
    customerService: cleanText(row.customer_service),
  };
}

export function hasStorePolicy(policy: StorePolicy | null | undefined) {
  if (!policy) return false;
  return Object.values(policy).some(
    (value) => value !== null && value !== undefined && value !== ""
  );
}

export function mergeStorePolicy(
  defaults: StorePolicy,
  override: StorePolicy | null
): StorePolicy {
  if (!override) return defaults;

  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => {
      const overrideValue = override[key as keyof StorePolicy];
      return [key, overrideValue ?? defaultValue];
    })
  ) as StorePolicy;
}

export async function loadEffectiveStorePolicy(
  supabase: SupabaseLike,
  workspaceId: string,
  productId?: string | null
): Promise<StorePolicy | null> {
  const [profileResult, overrideResult] = await Promise.all([
    supabase
      .from("store_profiles")
      .select(
        "shipping_fee, free_shipping_threshold, average_dispatch_time, shipping_method, remote_area_fee, return_exchange_window, return_shipping_fee, exchange_shipping_fee, customer_service"
      )
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    productId
      ? supabase
          .from("product_store_overrides")
          .select(
            "shipping_fee, free_shipping_threshold, average_dispatch_time, shipping_method, remote_area_fee, return_exchange_window, return_shipping_fee, exchange_shipping_fee, customer_service"
          )
          .eq("workspace_id", workspaceId)
          .eq("product_id", productId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (overrideResult.error) throw overrideResult.error;

  const defaults = rowToStorePolicy(profileResult.data as StorePolicyRow | null);
  const override = overrideResult.data
    ? rowToStorePolicy(overrideResult.data as StorePolicyRow)
    : null;
  const effective = mergeStorePolicy(defaults, override);
  return hasStorePolicy(effective) ? effective : null;
}
