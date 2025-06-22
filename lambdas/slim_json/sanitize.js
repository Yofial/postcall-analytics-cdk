// --- simple Hebrew word→digit map (זכר/נקבה) ----------
const WORD2DIGIT = {
  'אפס': '0',
  'אחת': '1', 'אחד': '1',
  'שתיים': '2', 'שתים': '2',
  'שלוש': '3', 'שלושה': '3',
  'ארבע': '4', 'ארבעה': '4',
  'חמש': '5', 'חמישה': '5',
  'שש': '6',  'שישה': '6',
  'שבע': '7', 'שבעה': '7',
  'שמונה': '8',
  'תשע': '9', 'תשעה': '9'
};

const CONNECTORS = new Set(['-', '–', 'קו', 'דש', 'מקף']);

export function normalizeText(line) {
  const tokens = line.split(/\s+/);
  const out = [];
  let buf = [];

  const flush = () => {
    if (buf.length) {
      const digits = buf.map((w) => WORD2DIGIT[w]).join('');
      out.push(digits);
      buf = [];
    }
  };

  for (const t of tokens) {
    if (WORD2DIGIT[t]) {
      buf.push(t);
    } else if (CONNECTORS.has(t)) {
      continue; // skip connector
    } else {
      flush();
      out.push(t);
    }
  }
  flush();
  return out.join(' ');
}

// --- Luhn check ----------
function luhnOk(num) {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// --- masking PAN + CVV ----------
export function maskPanAndCvv(text) {
  // 1) PAN 13-19 digits
  text = text.replace(/(\d[ \-]?){13,19}/g, (m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhnOk(digits)) {
      return `[REDACTED_PAN_${digits.slice(-4)}]`;
    }
    return m;
  });

  // 2) CVV after 'cvv' or Hebrew keywords
  text = text.replace(
    /(cvv|קוד(?:\s+אימות)?)[^\d]{0,6}(\d{3,4})/i,
    (_, prefix) => `${prefix} ***`
  );
  return text;
}

