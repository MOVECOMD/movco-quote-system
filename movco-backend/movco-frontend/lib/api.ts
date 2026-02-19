import axios from "axios";

/**
 * Backend base URL
 * Must be prefixed with NEXT_PUBLIC_ so it is available in the browser
 *
 * Example in .env.local:
 * NEXT_PUBLIC_MOVCO_API=http://127.0.0.1:8000
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_MOVCO_API ?? "http://127.0.0.1:8000";

export const movcoApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 20000,          // prevent hanging requests
  withCredentials: false, // explicit (avoids CORS confusion)
});
/**
 * Call MOVCO backend /analyze endpoint
 */
export async function analyzeMove(data: {
  starting_address: string;
  ending_address: string;
  photo_urls: string[];
}) {
  try {
    const res = await movcoApi.post("/analyze", data);
    return res.data;
  } catch (err: any) {
    console.error("[MOVCO API] analyzeMove failed:", err);
    throw err;
  }
}

