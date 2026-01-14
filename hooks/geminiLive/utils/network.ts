// Network utility functions

export const checkInternet = async (timeoutMs = 2000) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `/ping.txt?ts=${Date.now()}`;
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
};
