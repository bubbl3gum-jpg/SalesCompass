// Price resolution service implementing the business logic
export interface PriceResolutionParams {
  serialNumber?: string;
  kodeItem?: string;
  kelompok?: string;
  family?: string;
  deskripsiMaterial?: string;
  kodeMotif?: string;
  discountId?: string;
  discByAmount?: number;
}

export interface PriceQuote {
  normal_price: number;
  unit_price: number;
  discount_amount: number;
  final_price: number;
  source: 'serial' | 'item' | 'best' | 'generic' | 'not_found';
}

export async function getPriceQuote(params: PriceResolutionParams): Promise<PriceQuote> {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)])
  ).toString();

  const response = await fetch(`/api/price/quote?${queryString}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Price quote failed: ${response.statusText}`);
  }

  return response.json();
}

export async function checkStockAvailability(
  kodeGudang: string, 
  kodeItem?: string,
  serialNumber?: string
): Promise<{ available: boolean; qty: number }> {
  const params = new URLSearchParams({
    kode_gudang: kodeGudang,
    ...(kodeItem && { kode_item: kodeItem }),
    ...(serialNumber && { serial_number: serialNumber })
  });

  const response = await fetch(`/api/stock/onhand?${params}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Stock check failed: ${response.statusText}`);
  }

  const stockItems = await response.json();
  
  if (serialNumber) {
    // Check specific serial availability
    const serialStock = stockItems.find((item: any) => item.serialNumber === serialNumber);
    return {
      available: serialStock ? serialStock.qty > 0 : false,
      qty: serialStock?.qty || 0
    };
  } else if (kodeItem) {
    // Check item availability (sum of all serials for this item)
    const itemStock = stockItems
      .filter((item: any) => item.kodeItem === kodeItem)
      .reduce((sum: number, item: any) => sum + item.qty, 0);
    
    return {
      available: itemStock > 0,
      qty: itemStock
    };
  }

  return { available: false, qty: 0 };
}
