import React, { useMemo, useState } from "react";
import { useVendor } from "./VendorContext";
import { getVendorById } from "./vendorApi";

const SetupVendorPage: React.FC = () => {
  const { setVendor } = useVendor();
  const [vendorId, setVendorId] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  const vendorIdTrimmed = useMemo(() => vendorId.trim(), [vendorId]);
  const canSubmit = !loading && vendorIdTrimmed.length > 0;

  const onSetup = async () => {
    if (!canSubmit) return;

    setErrorText("");
    setLoading(true);

    try {
      const res = await getVendorById(vendorIdTrimmed);

      if (!res) {
        setErrorText("Vendor doesn't exist. Please check the Vendor ID and try again.");
        return;
      }

      setVendor(res);

      // Flutter does Phoenix.rebirth.
      // In React this is enough because state updates re-render.
      // If you want a hard reset:
      // window.location.reload();

    } catch {
      setErrorText("Failed to setup vendor. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // ✅ stops page refresh
    await onSetup();    // ✅ Enter key triggers this
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-2xl font-black text-gray-800 mb-2">Setup Vendor</h1>
        <p className="text-gray-500 mb-6">Enter your Vendor ID to start the kiosk.</p>

        {/* ✅ Form makes Enter key submit by default */}
        <form onSubmit={onSubmit}>
          <input
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            placeholder="Enter Vendor Id"
            autoFocus
            inputMode="text"
            className="w-full border-2 border-orange-500 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-orange-300"
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-5 w-full bg-[#c2410c] text-white py-3 rounded-full font-bold text-lg shadow-lg hover:bg-[#a1360a] transition-all disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Setup Vendor"}
          </button>
        </form>

        {errorText && (
          <div className="mt-4 text-red-600 font-semibold">{errorText}</div>
        )}
      </div>
    </div>
  );
};

export default SetupVendorPage;
