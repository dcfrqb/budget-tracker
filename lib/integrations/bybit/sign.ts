import { createHmac } from "node:crypto";

/**
 * Produces the four BAPI auth headers required by Bybit V5 API.
 *
 * String-to-sign for POST with JSON body (per Bybit V5 docs):
 *   timestamp + apiKey + recvWindow + bodyJson
 * (plain concatenation, no separators)
 *
 * @example
 * signV5({
 *   apiKey: "TESTAPIKEY",
 *   apiSecret: "TESTSECRET",
 *   timestamp: 1700000000000,
 *   recvWindow: 20000,
 *   bodyJson: '{"a":1}',
 * })
 * // => {
 * //   'X-BAPI-API-KEY': 'TESTAPIKEY',
 * //   'X-BAPI-TIMESTAMP': '1700000000000',
 * //   'X-BAPI-RECV-WINDOW': '20000',
 * //   'X-BAPI-SIGN': '<lowercase hex hmac-sha256>',
 * // }
 */
export function signV5(input: {
  apiKey: string;
  apiSecret: string;
  timestamp: number;
  recvWindow: number;
  bodyJson: string;
}): {
  "X-BAPI-API-KEY": string;
  "X-BAPI-TIMESTAMP": string;
  "X-BAPI-RECV-WINDOW": string;
  "X-BAPI-SIGN": string;
} {
  const { apiKey, apiSecret, timestamp, recvWindow, bodyJson } = input;
  const payload = `${timestamp}${apiKey}${recvWindow}${bodyJson}`;
  const sign = createHmac("sha256", apiSecret)
    .update(payload)
    .digest("hex");

  return {
    "X-BAPI-API-KEY": apiKey,
    "X-BAPI-TIMESTAMP": String(timestamp),
    "X-BAPI-RECV-WINDOW": String(recvWindow),
    "X-BAPI-SIGN": sign,
  };
}
