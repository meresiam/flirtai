import { describe, expect, it } from "vitest";

import { extractStringField } from "./partial-json";

describe("extractStringField", () => {
  it("retorna vazio quando o campo nao apareceu no buffer", () => {
    expect(extractStringField("{", "assistantMessage")).toBe("");
    expect(extractStringField('{"foo":"bar"', "assistantMessage")).toBe("");
  });

  it("retorna o prefixo enquanto a string ainda nao fechou", () => {
    expect(
      extractStringField('{"assistantMessage":"oi mundo', "assistantMessage"),
    ).toBe("oi mundo");
  });

  it("para no fechamento da string sem incluir os outros campos", () => {
    expect(
      extractStringField(
        '{"assistantMessage":"primeira parte","suggestions":[',
        "assistantMessage",
      ),
    ).toBe("primeira parte");
  });

  it("decodifica escapes basicos", () => {
    expect(
      extractStringField('{"assistantMessage":"linha1\\nlinha2', "assistantMessage"),
    ).toBe("linha1\nlinha2");
    expect(
      extractStringField('{"assistantMessage":"aspas \\"dentro', "assistantMessage"),
    ).toBe('aspas "dentro');
    expect(
      extractStringField('{"assistantMessage":"a\\\\b', "assistantMessage"),
    ).toBe("a\\b");
  });

  it("trata escape unicode completo", () => {
    expect(
      extractStringField('{"assistantMessage":"\\u00e1gua', "assistantMessage"),
    ).toBe("água");
  });

  it("para de forma segura em escape incompleto (1 char)", () => {
    expect(
      extractStringField('{"assistantMessage":"texto\\', "assistantMessage"),
    ).toBe("texto");
  });

  it("para de forma segura em unicode incompleto", () => {
    expect(
      extractStringField('{"assistantMessage":"a\\u00e', "assistantMessage"),
    ).toBe("a");
  });

  it("ignora espacos entre chave e valor", () => {
    expect(
      extractStringField('{ "assistantMessage" : "ola', "assistantMessage"),
    ).toBe("ola");
  });
});
