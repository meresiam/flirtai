// W2/M1 — extrai incrementalmente o valor JSON-string de um campo nomeado
// (`assistantMessage`) a partir de um buffer JSON parcial vindo dos chunks
// do streaming em JSON mode do Gemini. Para no primeiro ponto onde o buffer
// fica ambíguo (escape incompleto, unicode incompleto, string fechou).

export function extractStringField(
  jsonBuffer: string,
  fieldName: string,
): string {
  const pattern = new RegExp(`"${escapeRegex(fieldName)}"\\s*:\\s*"`);
  const startMatch = jsonBuffer.match(pattern);
  if (!startMatch) return "";
  const valueStart = startMatch.index! + startMatch[0].length;

  let out = "";
  let i = valueStart;
  while (i < jsonBuffer.length) {
    const ch = jsonBuffer[i];
    if (ch === "\\") {
      const next = jsonBuffer[i + 1];
      if (next === undefined) return out;
      switch (next) {
        case "n":
          out += "\n";
          i += 2;
          break;
        case "t":
          out += "\t";
          i += 2;
          break;
        case "r":
          out += "\r";
          i += 2;
          break;
        case '"':
          out += '"';
          i += 2;
          break;
        case "\\":
          out += "\\";
          i += 2;
          break;
        case "/":
          out += "/";
          i += 2;
          break;
        case "b":
          out += "\b";
          i += 2;
          break;
        case "f":
          out += "\f";
          i += 2;
          break;
        case "u": {
          if (i + 6 > jsonBuffer.length) return out;
          const hex = jsonBuffer.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return out;
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          break;
        }
        default:
          return out;
      }
    } else if (ch === '"') {
      break;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
