export async function getAddressList(q: string) {
  const apiKey = (import.meta as any).env?.VITE_IDEAL_POSTCODES_KEY; // move key to env
  const res = await fetch(
    `https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses?api_key=${apiKey}&q=${encodeURIComponent(q)}`
  );
  if (!res.ok) throw new Error("ADDRESS_LIST_FAILED");
  const json = await res.json();
  // json.result.hits: [{ suggestion, url, ... }]
  return (json?.result?.hits ?? []) as Array<{ suggestion: string; url: string }>;
}

// export async function getAddressDesc(urlPath: string) {
//   const apiKey = (import.meta as any).env?.VITE_IDEAL_POSTCODES_KEY;
//   const res = await fetch(`https://api.ideal-postcodes.co.uk${urlPath}?api_key=${apiKey}`);
//   if (!res.ok) throw new Error("ADDRESS_DESC_FAILED");
//   const json = await res.json();
//   return json?.result;
// }