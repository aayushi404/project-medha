import { API_BASE_URL, extractErrorMessage } from "@/lib/api";

/**
 * Fetch an authenticated file endpoint and save the response as a download.
 * A plain <a href> / <a download> can't send the bearer header, so we fetch
 * the bytes, wrap them in an object URL, and click a throwaway anchor -- the
 * same blob-download shape as the attendance CSV export.
 *
 * `path` may be an absolute URL (e.g. from `modulePptUrl`) or a "/..." path.
 */
export async function downloadFile(
  path: string,
  token: string | null,
  filename: string,
): Promise<void> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractErrorMessage(res));

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
