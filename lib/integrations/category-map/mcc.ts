// Maps MCC codes to internal category keys.
// Reference: ISO 18245 + common Russian retail MCCs.

type InternalKey =
  | "groceries" | "restaurants" | "transport" | "fuel" | "atm_cash"
  | "utilities" | "telecom" | "health" | "entertainment" | "subscriptions"
  | "shopping" | "travel" | "education" | "fees" | "transfers";

const MCC_TABLE: Array<{ range: [number, number]; key: InternalKey }> = [
  { range: [5411, 5411], key: "groceries" },          // grocery stores, supermarkets
  { range: [5412, 5499], key: "groceries" },
  { range: [5811, 5814], key: "restaurants" },        // caterers, restaurants, fast food
  { range: [5541, 5542], key: "fuel" },
  { range: [4111, 4131], key: "transport" },          // local commute, taxi
  { range: [4121, 4121], key: "transport" },          // taxi
  { range: [4511, 4511], key: "travel" },             // airlines
  { range: [3000, 3350], key: "travel" },             // airlines (specific carriers)
  { range: [7011, 7011], key: "travel" },             // hotels
  { range: [4900, 4900], key: "utilities" },          // utilities
  { range: [4814, 4815], key: "telecom" },            // telecom
  { range: [4812, 4812], key: "telecom" },
  { range: [4816, 4816], key: "telecom" },            // ISPs / cable
  { range: [4899, 4899], key: "telecom" },
  { range: [8011, 8099], key: "health" },             // medical services
  { range: [5912, 5912], key: "health" },             // pharmacy
  { range: [5122, 5122], key: "health" },
  { range: [7832, 7841], key: "entertainment" },      // cinema, video rental
  { range: [7922, 7929], key: "entertainment" },      // theaters
  { range: [7991, 7999], key: "entertainment" },
  { range: [5815, 5818], key: "subscriptions" },      // digital goods, app stores
  { range: [4829, 4829], key: "transfers" },          // wire transfers
  { range: [6010, 6012], key: "atm_cash" },           // cash withdrawals
  { range: [6051, 6051], key: "atm_cash" },
  { range: [8200, 8299], key: "education" },          // schools, universities
  { range: [9311, 9399], key: "fees" },               // tax payments, government fees
  { range: [5311, 5651], key: "shopping" },           // department, clothing, retail
  { range: [5712, 5735], key: "shopping" },           // furniture, music
  { range: [5940, 5999], key: "shopping" },
];

export function mccToInternalKey(mcc: string | undefined): InternalKey | null {
  if (!mcc) return null;
  const n = Number.parseInt(String(mcc), 10);
  if (!Number.isFinite(n)) return null;
  for (const { range, key } of MCC_TABLE) {
    if (n >= range[0] && n <= range[1]) return key;
  }
  return null;
}

const KEY_NAME_PATTERNS: Record<InternalKey, RegExp> = {
  groceries: /продукт|grocer|supermarket|магазин/i,
  restaurants: /рестор|кафе|еда|food|restaurant|cafe/i,
  transport: /транспорт|такси|метро|transport|taxi/i,
  fuel: /топлив|бензин|АЗС|fuel|gas/i,
  atm_cash: /наличн|банкомат|cash|atm/i,
  utilities: /ЖКХ|коммунал|util/i,
  telecom: /связь|интернет|мобильн|telecom|internet|mobile/i,
  health: /здоров|аптек|медиц|health|pharm|medic/i,
  entertainment: /развлеч|кино|театр|entertain|cinema/i,
  subscriptions: /подписк|subscript/i,
  shopping: /шопинг|одежд|shop|cloth/i,
  travel: /путешест|отел|авиа|travel|hotel|airline/i,
  education: /образован|школ|универ|educat|school/i,
  fees: /налог|сбор|штраф|tax|fee|penalty/i,
  transfers: /перевод|transfer/i,
};

export function namePatternFor(key: InternalKey): RegExp {
  return KEY_NAME_PATTERNS[key];
}
