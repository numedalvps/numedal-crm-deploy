(function initNumedalIntake(root) {
  "use strict";

  const OWN_PHONE_DIGITS = new Set(["93436855", "45632388"]);
  const OWN_EMAIL_DOMAINS = ["numedalvps.no", "isobygg.no"];
  const OWN_EMAILS = new Set(["post@numedalvps.no", "gunnar@numedalvps.no", "post.buskerud@isobygg.no"]);
  const OWN_NAMES = ["gunnar grette", "gunnar", "hubert", "anders øia", "anders oia", "numedal varmepumpeservice", "isobygg buskerud"];

  const CITY_BY_ZIP = {
    "3188": "Horten",
    "3600": "Kongsberg",
    "3610": "Kongsberg",
    "3612": "Kongsberg",
    "3620": "Flesberg",
    "3622": "Svene",
    "3623": "Lampeland",
    "3624": "Lyngdal i Numedal",
    "3626": "Rollag",
    "3628": "Veggli",
    "3630": "Rodberg",
  };

  function repairTextEncoding(value) {
    let text = String(value || "");
    if (!/[ÃÂâ]/.test(text)) return text;
    const replacements = [
      ["Ã¦", "æ"], ["Ã†", "Æ"],
      ["Ã¸", "ø"], ["Ã˜", "Ø"],
      ["Ã¥", "å"], ["Ã…", "Å"],
      ["Ã©", "é"], ["Ã¨", "è"], ["Ã¼", "ü"],
      ["Ã¶", "ö"], ["Ã¤", "ä"],
      ["Â·", "·"], ["Â ", " "], ["Â", ""],
      ["â€“", "-"], ["â€”", "-"],
      ["â€˜", "'"], ["â€™", "'"],
      ["â€œ", '"'], ["â€", '"'],
      ["â€¦", "..."], ["â€¢", "-"],
    ];
    for (const [bad, good] of replacements) {
      text = text.replaceAll(bad, good);
    }
    return text;
  }

  function normalize(value) {
    return repairTextEncoding(value)
      .toLowerCase()
      .replaceAll("æ", "ae")
      .replaceAll("ø", "o")
      .replaceAll("å", "a")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanLine(value) {
    return repairTextEncoding(value)
      .replace(/^[>\-\s]+/, "")
      .replace(/\s+/g, " ")
      .replace(/[.,;:]+$/, "")
      .trim();
  }

  function compactPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("47") && digits.length === 10) return digits.slice(2);
    return digits.length >= 8 ? digits.slice(-8) : digits;
  }

  function sourceWindow(text, index, length, radius = 44) {
    const start = Math.max(0, index - radius);
    const end = Math.min(String(text || "").length, index + length + radius);
    return cleanLine(String(text || "").slice(start, end));
  }

  function field(value, confidence, evidence, sourceIndex = 0) {
    return { value: value || null, confidence: value ? confidence : "low", evidence: evidence || null, sourceIndex };
  }

  function labelValue(text, labels) {
    const raw = String(text || "");
    const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const regex = new RegExp(`^\\s*(?:${escaped})\\s*:?\\s*([^\\n\\r]+)`, "im");
    const match = raw.match(regex);
    return match?.[1] ? cleanLine(match[1]) : "";
  }

  function numberLabelValue(text, labels) {
    const value = labelValue(text, labels);
    const match = value.match(/[\d\s.,]+/);
    return match ? cleanLine(match[0]) : "";
  }

  function isOwnEmail(email) {
    const lower = String(email || "").toLowerCase();
    return OWN_EMAILS.has(lower) || OWN_EMAIL_DOMAINS.some((domain) => lower.endsWith(`@${domain}`));
  }

  function isOwnName(name) {
    const normalized = normalize(name);
    return OWN_NAMES.some((own) => normalized === normalize(own) || normalized.includes(normalize(own)));
  }

  function extractEmails(text) {
    const raw = String(text || "");
    const matches = [];
    const regex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    let match;
    while ((match = regex.exec(raw))) {
      const email = match[0].toLowerCase();
      const lineStart = raw.lastIndexOf("\n", match.index) + 1;
      const lineEnd = raw.indexOf("\n", match.index);
      const line = cleanLine(raw.slice(lineStart, lineEnd >= 0 ? lineEnd : raw.length));
      const context = sourceWindow(raw, match.index, match[0].length);
      let role = "unknown";
      if (/^\s*fra\s*:/i.test(line)) role = "from";
      else if (/^\s*til\s*:/i.test(line)) role = "to";
      else if (/^\s*(kopi|cc)\s*:/i.test(line)) role = "cc";
      else if (/mvh|hilsen|mobil|telefon/i.test(context)) role = "signature";
      const own = isOwnEmail(email);
      matches.push({
        value: email,
        role,
        own,
        confidence: own ? "low" : role === "from" || role === "signature" ? "high" : "medium",
        evidence: line || context,
      });
    }
    const deduped = [];
    const seen = new Set();
    for (const item of matches) {
      if (seen.has(`${item.value}:${item.role}`)) continue;
      seen.add(`${item.value}:${item.role}`);
      deduped.push(item);
    }
    return deduped;
  }

  function extractPhones(text) {
    const raw = String(text || "");
    const candidates = [];
    const dateRegex = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g;
    let dateMatch;
    while ((dateMatch = dateRegex.exec(raw))) {
      const day = dateMatch[1].padStart(2, "0");
      const month = dateMatch[2].padStart(2, "0");
      const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
      candidates.push({
        value: `${day}${month}${year}`,
        original: dateMatch[0],
        rejected: true,
        reason: "Ser ut som dato/klokkeslett",
        evidence: sourceWindow(raw, dateMatch.index, dateMatch[0].length),
      });
    }
    const phoneLabelRegex = /^\s*(?:telefon|tlf\.?|mobil|mob\.?)\s*:?\s*([^\n\r]+)/gim;
    let labelMatch;
    while ((labelMatch = phoneLabelRegex.exec(raw))) {
      const originalLabelValue = cleanLine(labelMatch[1]);
      const corrected = originalLabelValue.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
      if (corrected === originalLabelValue || (corrected.match(/\d/g) || []).length < 8) continue;
      const correctedMatch = corrected.match(/(?:\+47\s*)?(?:\d[\s().-]*){8,11}/);
      if (!correctedMatch) continue;
      const compact = compactPhone(correctedMatch[0]);
      const own = OWN_PHONE_DIGITS.has(compact);
      candidates.push({
        value: compact,
        original: originalLabelValue,
        own,
        rejected: own || compact.length !== 8,
        reason: own ? "Bedriftens eget nummer" : compact.length !== 8 ? "Ikke norsk telefonnummer" : "",
        confidence: own ? "low" : "medium",
        evidence: cleanLine(labelMatch[0]),
        ocrCorrected: true,
      });
    }
    const regex = /(?:\+47\s*)?(?:\d[\s().-]*){8,11}/g;
    let match;
    while ((match = regex.exec(raw))) {
      const original = match[0];
      const digits = original.replace(/\D/g, "");
      const compact = compactPhone(original);
      const lineStart = raw.lastIndexOf("\n", match.index) + 1;
      const lineEnd = raw.indexOf("\n", match.index);
      const lineContext = cleanLine(raw.slice(lineStart, lineEnd >= 0 ? lineEnd : raw.length));
      const context = sourceWindow(raw, match.index, original.length, 54);
      const tightContext = sourceWindow(raw, match.index, original.length, 18);
      const normalizedContext = normalize(lineContext || context);
      const normalizedTightContext = normalize(tightContext);
      const badContextPattern = /\b(?:org|org nr|orgnr|organisasjonsnummer|ordre|ordrenummer|saksnr|saksnummer|faktura|kundenummer|kontonr|konto nr|kontonummer|kid|iban|mva|fodsel|fodselsnummer|fodselsnr|personnummer|fnr|belop|sum)\b/;
      const looksLikeDate = /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(original)
        || /\b(?:dato|sendt|mottatt|kl|klokken)\b/.test(normalizedContext) && /20\d{2}/.test(original);
      const badContext = badContextPattern.test(normalizedTightContext);
      const goodContext = /\b(?:telefon|tlf|mobil|mob|ring|ringes|kan naes|kan nåes|\+47)\b/.test(normalizedContext);
      const insideLongNumber = digits.length > 10 || digits.length === 9;
      if (compact.length !== 8 || looksLikeDate || badContext || insideLongNumber) {
        candidates.push({
          value: compact,
          original,
          rejected: true,
          reason: looksLikeDate ? "Ser ut som dato/klokkeslett" : badContext || insideLongNumber ? "Ser ut som ordre/org.nr/faktura" : "Ikke norsk telefonnummer",
          evidence: context,
        });
        continue;
      }
      const own = OWN_PHONE_DIGITS.has(compact);
      candidates.push({
        value: compact,
        original,
        own,
        rejected: own,
        reason: own ? "Bedriftens eget nummer" : "",
        confidence: own ? "low" : goodContext ? "high" : "medium",
        evidence: context,
      });
    }
    const deduped = [];
    const seen = new Set();
    for (const item of candidates) {
      const key = `${item.value}:${item.rejected ? item.reason : "ok"}`;
      if (!item.value || seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  }

  function emailDisplayName(line) {
    const match = String(line || "").match(/^\s*(?:fra|til)\s*:\s*([^<\n\r]+)</i);
    return cleanLine(match?.[1] || "");
  }

  function cleanNameCandidate(value) {
    return cleanLine(String(value || "")
      .replace(/\s*[.!?]\s+(?:kan|kunne|onsker|\u00f8nsker|vil|trenger|har|skal|ma|m\u00e5|er|det|jeg|vi|dere|kontakt)\b.*$/i, "")
      .replace(/\s+(?:kan dere|kan du|kunne dere|kunne du|kontakt meg|ta kontakt|ring meg)\b.*$/i, "")
      .replace(/\b(?:telefon|tlf|mobil|mob|mailadresse|mail|e-post|adresse|postnr|sted)\b.*$/i, "")
      .replace(/^(?:ny\s+)?(?:henvendelse|forespørsel|foresporsel|melding|lead)\s+(?:fra\s+)?/i, "")
      .replace(/^(?:fra\s+)?(?:nettside|webskjema|web|kontaktskjema|skjema|facebook|e-post|mail|sms)\s*[:\-]\s*/i, "")
      .split(/[;,]/)[0]);
  }

  function extractName(text, emails) {
    const raw = repairTextEncoding(text);
    const first = labelValue(raw, ["Navn", "Fornavn"]);
    const last = labelValue(raw, ["Etternavn"]);
    if (first && last && !/\d|@/.test(`${first} ${last}`) && !isOwnName(`${first} ${last}`)) {
      return field(`${first} ${last}`, "high", `${first} ${last}`);
    }
    const explicitPatterns = [
      /^\s*(?:navn|kunde)\s*:\s*([^\n\r.]+)/im,
      /^\s*(?:navn|kunde)\s+([A-ZÆØÅ][^\n\r.]+)/im,
      /henvendelse\s+fra\s+([^\n\r]+)/i,
    ];
    for (const pattern of explicitPatterns) {
      const match = raw.match(pattern);
      if (match?.[1]) {
        const name = cleanNameCandidate(match[1]);
        if (name && !/\d|@/.test(name) && !isOwnName(name)) return field(name, "high", match[0]);
      }
    }

    const fromLines = raw.split(/\r?\n/).filter((line) => /^\s*fra\s*:/i.test(line));
    for (const line of fromLines) {
      const lineEmail = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
      if (lineEmail && isOwnEmail(lineEmail)) continue;
      const fromName = emailDisplayName(line);
      if (fromName && !isOwnName(fromName)) return field(fromName, "high", line);
    }

    const signatureMatch = raw.match(/(?:mvh\.?|med vennlig hilsen|hilsen(?:\s+(?:fra|frs))?)\s*:?\s*([A-ZÆØÅ][^\n\r]{2,70})/i);
    if (signatureMatch?.[1]) {
      const name = cleanNameCandidate(signatureMatch[1]);
      if (name && !/\d|@/.test(name) && !isOwnName(name)) return field(name, "medium", signatureMatch[0]);
    }

    const lines = raw.split(/\r?\n/).map(cleanLine).filter(Boolean);
    for (let i = 0; i < Math.min(lines.length, 8); i += 1) {
      const line = lines[i];
      if (/^\d{1,2}:\d{2}$/.test(line) || /^\d/.test(line) || /@|telefon|tlf|adresse|postnr|sted|opprinnelig melding|melding|internt|notat|uten kunde/i.test(line)) continue;
      if (isOwnName(line)) continue;
      const words = line.split(/\s+/).filter(Boolean);
      if (words.length >= 2 && words.length <= 4 && words.every((word) => /^[A-ZÆØÅa-zæøå.'-]+$/.test(word))) {
        return field(line, "low", line);
      }
    }

    const externalEmail = (emails || []).find((item) => !item.own);
    if (externalEmail?.value) {
      const local = externalEmail.value.split("@")[0].replace(/[._-]+/g, " ");
      const guessed = cleanLine(local.replace(/\b\d+\b/g, ""));
      if (guessed) return field(guessed, "low", externalEmail.evidence);
    }
    return field("", "low", null);
  }

  function splitAddressParts(value) {
    const line = cleanLine(value).replace(/\s+er\s+rikt(?:ig|i)$/i, "");
    const zipMatch = line.match(/\b(\d{4})\s+([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]+)$/);
    const zip = zipMatch?.[1] || "";
    const city = cleanLine(zipMatch?.[2] || "");
    const street = cleanLine(zipMatch ? line.slice(0, zipMatch.index) : line).replace(/,+$/, "");
    return { street, zip, city: city || CITY_BY_ZIP[zip] || "" };
  }

  function cleanStreetCandidate(value) {
    const compact = cleanLine(value);
    const parts = compact.split(/[.;,\n\r]/).map(cleanLine).filter(Boolean);
    const lastPart = parts[parts.length - 1] || compact;
    return cleanLine(lastPart.replace(/^.*\b(?:til|i|på|pa)\s+(?=[A-ZÆØÅ])/i, ""));
  }

  function cleanCityCandidate(value) {
    const firstPart = cleanLine(value).split(/[.;,\n\r]/).map(cleanLine).filter(Boolean)[0] || "";
    return cleanLine(firstPart.replace(/\b(?:telefon|tlf|mobil|mob|mvh|hilsen)\b.*$/i, ""));
  }

  function extractAddress(text) {
    const raw = String(text || "");
    const explicitStreetValue = labelValue(raw, ["Adresse for oppdraget", "Adresse for oppdrag", "Oppdragsadresse", "Adresse"]);
    const explicitZipValue = numberLabelValue(raw, ["Postnummer", "Postnr", "Postnr."]);
    const explicitCityValue = labelValue(raw, ["Kommune", "Sted", "Poststed"]);
    if (explicitStreetValue) {
      const parts = splitAddressParts(explicitStreetValue);
      const zip = explicitZipValue || parts.zip;
      const city = cleanLine(explicitCityValue && !/\[.*\]/.test(explicitCityValue) ? explicitCityValue : (parts.city || CITY_BY_ZIP[zip] || ""));
      return {
        street: field(parts.street, "high", explicitStreetValue),
        postalCode: field(zip, zip ? "high" : "low", explicitZipValue || explicitStreetValue),
        city: field(city, city ? "medium" : "low", explicitCityValue || explicitStreetValue),
        propertyReference: field("", "low", null),
      };
    }

    const gnr = raw.match(/\bgnr\.?\s*(\d+)\s*(?:bnr\.?|\/)\s*(\d+)/i);
    if (gnr) {
      const cityMatch = raw.match(/\bi\s+([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]{2,30})/i);
      const city = cleanLine(cityMatch?.[1] || "").replace(/\s+gnr\b.*$/i, "");
      return {
        street: field("", "low", null),
        postalCode: field("", "low", null),
        city: field(city, city ? "medium" : "low", cityMatch?.[0] || null),
        propertyReference: field(`gnr. ${gnr[1]} bnr. ${gnr[2]}`, "high", gnr[0]),
      };
    }

    const withZip = raw.match(/([A-ZÆØÅ][A-Za-zÆØÅæøå0-9 .,'-]{2,70}?\s+\d+[A-Za-z]?)\s*,?\s+(\d{4})\s*,?\s+([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]+)/);
    if (withZip) {
      return {
        street: field(cleanStreetCandidate(withZip[1]), "high", withZip[0]),
        postalCode: field(withZip[2], "high", withZip[0]),
        city: field(cleanCityCandidate(withZip[3]), "high", withZip[0]),
        propertyReference: field("", "low", null),
      };
    }

    const streetPattern = /\b([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]*(?:veien|vegen|vei|veg|gata|gate|stien|lia|bakken|svingen|tunet|reset|jordet|berget|åsen|aasen|plassen|ringen|myra|toppen|kollen|hagan|høgda|høyda|smiuberget|tunmarcks vei|middelthunsvei)\s+\d+[A-Za-z]?)\b(?:\s*,?\s*([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]{2,35}))?/i;
    const streetMatch = raw.match(streetPattern);
    if (streetMatch) {
      let city = cleanLine(streetMatch[2] || "");
      if (/^(er riktig|er rikti|som avtalt|ref tlf|mvh|og de|hei|kan dere|trenger|onsker|ønsker)$/i.test(city)) city = "";
      const street = cleanStreetCandidate(streetMatch[1]);
      return {
        street: field(street, "medium", streetMatch[0]),
        postalCode: field("", "low", null),
        city: field(city, city ? "low" : "low", streetMatch[0]),
        propertyReference: field("", "low", null),
      };
    }

    const cabinAddress = raw.match(/\b(Blefjell|Vegglifjell|Fagerfjell|Skrim|Veggli)\s+\d+[A-Za-z]?\b/i);
    return {
      street: field(cleanLine(cabinAddress?.[0] || ""), cabinAddress ? "medium" : "low", cabinAddress?.[0] || null),
      postalCode: field("", "low", null),
      city: field("", "low", null),
      propertyReference: field("", "low", null),
    };
  }

  function inferIntent(text) {
    const n = normalize(text);
    const explicitAcceptance = /\b(?:aksepterer|akseptert|godtar|godkjent|onsker a bestille|ønsker å bestille|sett oss opp|bekreftet tilbudet)\b/.test(n);
    if (/\b(?:ignorer|slett alle|returner telefonnummeret|tidligere instruksjoner|sett status til vunnet)\b/.test(n)) {
      return { category: "general_history", confidence: "low", explicitAcceptance: false, warning: "Mulig instruksjon i kildetekst. Behandles kun som kundemelding." };
    }
    if (/\b(?:industristovsuger|stovsuger|leie|utleie|isopro)\b/.test(n)) return { category: "rental", confidence: "high", explicitAcceptance: false };
    if (/\b(?:blaseisolering|isobygg|isolering|etterisolering|supafil|stubbloft|sagflis|kutterflis|komplett pris inkl rigg|antall m2|tykkelse)\b/.test(n)) return { category: "insulation", confidence: "high", explicitAcceptance: false };
    if (explicitAcceptance) return { category: "quote_accepted", confidence: "high", explicitAcceptance: true };
    if (/\b(?:ny varmepumpe|nyinstallasjon|kjøpe varmepumpe|kjope varmepumpe|bytte varmepumpe|bytt varmepumpa|onsker tilbud|ønsker tilbud|hva koster|pris pa|pris på|komplett pris)\b/.test(n)) {
      return { category: "quote_request", confidence: "high", explicitAcceptance: false };
    }
    if (/\b(?:befaring|komme pa en befaring|på befaring)\b/.test(n)) return { category: "site_visit_request", confidence: "high", explicitAcceptance: false };
    if (/\b(?:flytte|flytting|dryppanne|dempet veggbrakett|vibrasjonsdempere|isklump|avgir vann|feilkode|reparasjon)\b/.test(n)) {
      return { category: "repair_request", confidence: "high", explicitAcceptance: false };
    }
    if (/\bservice\b/.test(n)) return { category: "service_request", confidence: "high", explicitAcceptance: false };
    if (/\b(?:montering|montere|installasjon)\b/.test(n)) return { category: "quote_question", confidence: "medium", explicitAcceptance: false };
    return { category: "unknown", confidence: "low", explicitAcceptance: false };
  }

  function actionForIntent(intent) {
    const map = {
      quote_request: "create_lead",
      quote_question: "create_lead",
      site_visit_request: "create_site_visit_draft",
      quote_accepted: "create_follow_up_task",
      service_request: "create_service_request",
      repair_request: "create_repair_request",
      insulation: "create_lead",
      rental: "create_lead",
      general_history: "manual_review",
      unknown: "manual_review",
    };
    return map[intent.category] || "manual_review";
  }

  function typeForIntent(intent) {
    if (intent.category === "insulation" || intent.category === "rental") return "blaseisolering";
    if (intent.category === "site_visit_request") return "befaring";
    if (intent.category === "quote_accepted") return "installasjon";
    if (intent.category === "service_request" || intent.category === "repair_request") return "service";
    return "lead";
  }

  function inferBrandFromModel(model) {
    const normalized = normalize(model);
    if (/\b(signature|seiya|polar|daisekai)\b/.test(normalized)) return "Toshiba";
    if (/\b(norgespumpa|extreme)\b/.test(normalized)) return "Fujitsu";
    if (/\b(hz25|hz 25|nz25|nz 25|nz35|nz 35|cz25|cz 25|z25|z 25|z35|z 35|flagship|etherea)\b/.test(normalized)) return "Panasonic";
    if (/\b(kaiteki|iguru|kirigamine|hara|gussuri)\b/.test(normalized)) return "Mitsubishi";
    if (/\b(narvik|trysil)\b/.test(normalized)) return "Wilfa";
    if (/\barctic\s*12\b/.test(normalized)) return "Cooper Hunter";
    return "";
  }

  function normalizeKnownProductModel(matchText) {
    const text = cleanLine(matchText);
    const normalized = normalize(text);
    if (/^hz\s*25/.test(normalized)) return `HZ25${(text.match(/\b(XKE|ZKE|YKE)\b/i)?.[1] || "").toUpperCase()}`;
    if (/^nz\s*25/.test(normalized)) return /etherea/.test(normalized) ? "NZ25 Etherea Eco" : `NZ25${(text.match(/\b(YKE)\b/i)?.[1] || "").toUpperCase()}`;
    if (/^nz\s*35/.test(normalized)) return `NZ35${(text.match(/\b(YKE)\b/i)?.[1] || "").toUpperCase()}`;
    if (/^cz\s*25/.test(normalized)) return `CZ25${(text.match(/\b(TKE)\b/i)?.[1] || "").toUpperCase()}`;
    if (/^z\s*25/.test(normalized)) return "Z25 Gulvmodell";
    if (/^z\s*35/.test(normalized)) return "Z35 Gulvmodell";
    return text;
  }

  function knownProductModelMatches(raw) {
    const patterns = [
      /\bHZ\s*25\s*Flagship\s*(?:Hvit|Graphite\s*Grey)?(?:\s*7[,.]5\s*kw)?\b/gi,
      /\bHZ\s*25\s*(?:XKE|ZKE|YKE)?\b/gi,
      /\bNZ\s*(?:25|35)\s*(?:YKE)?\b/gi,
      /\bNZ\s*25\s*Etherea\s*Eco(?:\s*6[,.]5\s*kw)?\b/gi,
      /\bCZ\s*25\s*(?:TKE)?\b/gi,
      /\bZ\s*(?:25|35)\s*(?:Gulvmodell)?\b/gi,
      /\bNorgespumpa\s*5[,.][79]\s*Dempet\s*Sort\b/gi,
      /\bNorgespumpa\s*6[,.]4\b/gi,
      /\bExtreme\s*Gulv\s*5[,.]5\b/gi,
      /\bSignature\s*(?:25|35)\b/gi,
      /\bSeiya\s*Nordic\s*(?:25|35)\b/gi,
      /\b(?:Polar|Daisekai)\b/gi,
      /\b(?:Narvik|Trysil)\s*(?:25|35)?\b/gi,
      /\bArctic\s*12\b/gi,
      /\b(?:Kaiteki|Iguru|Kirigamine|Hara|Gussuri)\b/gi,
    ];
    const found = [];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(String(raw || "")))) {
        const model = normalizeKnownProductModel(match[0]);
        if (!model) continue;
        found.push({
          model,
          brand: inferBrandFromModel(model),
          evidence: cleanLine(match[0]),
          index: match.index,
          end: match.index + match[0].length,
        });
      }
    }
    const selected = [];
    const usedKeys = new Set();
    for (const item of found.sort((a, b) => a.index - b.index || b.evidence.length - a.evidence.length)) {
      const overlaps = selected.some((existing) => item.index < existing.end && item.end > existing.index);
      const key = normalize(`${item.brand} ${item.model}`);
      if (overlaps || usedKeys.has(key)) continue;
      selected.push(item);
      usedKeys.add(key);
    }
    return selected;
  }

  function knownProductModelMatch(raw) {
    return knownProductModelMatches(raw)[0]?.model || "";
  }

  function extractEquipment(text) {
    const raw = String(text || "");
    const knownModels = knownProductModelMatches(raw);
    if (knownModels.length) {
      return knownModels.map((item) => ({
        brand: field(item.brand, item.brand ? "medium" : "low", item.evidence, item.index),
        model: field(item.model, "medium", item.evidence, item.index),
        serialNumber: field("", "low", null),
        errorCode: field("", "low", null),
      }));
    }
    const brandMatch = raw.match(/\b(Panasonic|Fujitsu|Mitsubishi|Toshiba|Daikin|LG|Samsung|Wilfa|Cooper\s*Hunter|Cooper&Hunter|Norgespumpa)\b/i);
    const modelMatch = raw.match(/\b(HZ\d{2}[A-Z0-9-]*|NZ\d{2}[A-Z0-9-]*|CZ\d{2}[A-Z0-9-]*|Z\d{2}[A-Z0-9-]*|Kaiteki|Iguru|Kirigamine|Hara|Gussuri|Norgespumpa\s*\d(?:[.,]\d)?|Extreme\s*(?:Gulv\s*)?\d(?:[.,]\d)?|Signature\s*(?:25|35)|Seiya\s*Nordic\s*(?:25|35)|Polar|Daisekai|Narvik\s*(?:25|35)?|Trysil|Arctic\s*12)\b/i);
    const model = cleanLine(modelMatch?.[0] || "");
    const inferredBrand = inferBrandFromModel(model) || brandMatch?.[0] || "";
    return [{
      brand: field(cleanLine(inferredBrand), inferredBrand ? "medium" : "low", brandMatch?.[0] || model || null),
      model: field(model, model ? "medium" : "low", modelMatch?.[0] || null),
      serialNumber: field("", "low", null),
      errorCode: field("", "low", null),
    }];
  }

  function extractProjectDetails(text, intent) {
    const raw = String(text || "");
    const construction = labelValue(raw, ["Konstruksjon", "Type konstruksjon", "Bygningsdel"]);
    const thickness = numberLabelValue(raw, ["Tykkelse", "Isolasjonstykkelse"]) || cleanLine(raw.match(/\b(\d+(?:[,.]\d+)?)\s*cm\b/i)?.[1] || "");
    const squareMeters = numberLabelValue(raw, ["Antall m2", "Antall m²", "m2", "m²", "Areal"]) || cleanLine(raw.match(/\b(\d+(?:[,.]\d+)?)\s*(?:m2|m²|kvm|kvadratmeter)\b/i)?.[1] || "");
    const estimate = labelValue(raw, ["Estimert kr", "Estimert pris", "Ca pris", "Pris"]);
    const customerInfo = labelValue(raw, ["Tilleggsinfo fra kunde", "Message", "Melding", "Kommentar"]);
    const buildYear = numberLabelValue(raw, ["Byggeår", "Byggeaar"]);
    const details = {
      construction: field(construction, construction ? "medium" : "low", construction),
      thicknessCm: field(thickness, thickness ? "high" : "low", thickness),
      squareMeters: field(squareMeters, squareMeters ? "high" : "low", squareMeters),
      estimate: field(estimate, estimate ? "medium" : "low", estimate),
      customerInfo: field(customerInfo, customerInfo ? "medium" : "low", customerInfo),
      buildYear: field(buildYear, buildYear ? "medium" : "low", buildYear),
    };
    const bits = [];
    if (intent.category === "insulation") {
      if (squareMeters) bits.push(`${squareMeters} m2`);
      if (thickness) bits.push(`${thickness} cm`);
      if (construction) bits.push(construction);
      if (estimate) bits.push(`estimert ${estimate}`);
    }
    if (intent.category === "rental") {
      bits.push("Utleie av industristøvsuger/Isopro1 VAC");
    }
    if (customerInfo) bits.push(customerInfo);
    return { details, summary: bits.join(" · ") };
  }

  function sensitiveFlags(text) {
    const n = normalize(text);
    const raw = String(text || "");
    const flags = [];
    if (/\b\d{11}\b/.test(raw)) flags.push("national_identity_number");
    if (/\b\d{4}[.\s-]\d{2}[.\s-]\d{5}\b/.test(raw) || /\b(?:kontonr|konto nr|kontonummer)\b/.test(n)) flags.push("bank_information");
    if (/\b(?:kode|nøkkelboks|nokkelboks|dorkode|dørkode)\b/.test(n)) flags.push("access_code");
    return flags;
  }

  function warningObjects(text, phones, emails, intent, address, sensitive) {
    const warnings = [];
    const usablePhones = phones.filter((item) => !item.rejected && !item.own);
    const usableEmails = emails.filter((item) => !item.own);
    const uniqueEmailValues = new Set(usableEmails.map((item) => item.value).filter(Boolean));
    if (usablePhones.length > 1) warnings.push({ code: "multiple_phones", message: "Flere mulige telefonnummer funnet. Velg riktig før lagring.", severity: "warning" });
    if (uniqueEmailValues.size > 1) warnings.push({ code: "multiple_emails", message: "Flere mulige e-postadresser funnet. Velg riktig før lagring.", severity: "warning" });
    if (emails.some((item) => item.own)) warnings.push({ code: "own_email_detected", message: "Bedriftens egen e-post finnes i teksten og er ikke valgt som kunde.", severity: "info" });
    if (phones.some((item) => item.own)) warnings.push({ code: "own_phone_detected", message: "Bedriftens eget telefonnummer finnes i teksten og er ikke valgt som kunde.", severity: "info" });
    if (!usablePhones.length && !usableEmails.length) warnings.push({ code: "no_contact", message: "Fant ikke sikker telefon eller e-post.", severity: "warning" });
    if (address.street.value && !address.postalCode.value) warnings.push({ code: "address_no_zip", message: "Adresse er funnet uten postnummer. Kontroller før rute/booking.", severity: "warning" });
    if (intent.warning) warnings.push({ code: "prompt_injection_possible", message: intent.warning, severity: "critical" });
    if (intent.category === "quote_question") warnings.push({ code: "mounting_not_acceptance", message: "Ordet montering er funnet, men dette er ikke tolket som vunnet salg uten tydelig aksept.", severity: "info" });
    if (sensitive.includes("access_code")) warnings.push({ code: "access_code", message: "Mulig nøkkel-/adgangskode funnet. Lagre bare i riktig felt hvis det faktisk trengs.", severity: "warning" });
    if (sensitive.includes("national_identity_number") || sensitive.includes("bank_information")) warnings.push({ code: "sensitive_data", message: "Mulig sensitiv betalings- eller ID-informasjon funnet. Ikke kopier til vanlige notatfelt.", severity: "critical" });
    return warnings;
  }

  function analyzeText(text, options = {}) {
    const raw = String(text || "").trim();
    const emails = extractEmails(raw);
    const phones = extractPhones(raw);
    const externalEmails = emails.filter((item) => !item.own);
    const usablePhones = phones.filter((item) => !item.rejected && !item.own);
    const name = extractName(raw, emails);
    const address = extractAddress(raw);
    const intent = inferIntent(raw);
    const equipment = extractEquipment(raw);
    const project = extractProjectDetails(raw, intent);
    const sensitive = sensitiveFlags(raw);
    const warnings = warningObjects(raw, phones, emails, intent, address, sensitive);
    const phone = usablePhones[0] || null;
    const email = externalEmails.find((item) => item.role === "from") || externalEmails[0] || null;
    const categoryText = {
      quote_request: "Kunden virker å spørre om pris eller tilbud.",
      quote_question: "Kunden spør om montering/tilbud, men har ikke bekreftet bestilling.",
      quote_accepted: "Teksten inneholder tydelig aksept/bestilling.",
      site_visit_request: "Kunden ønsker befaring.",
      service_request: "Kunden ønsker service.",
      repair_request: "Kunden beskriver service/reparasjon eller flytting.",
      insulation: "Henvendelsen gjelder blåseisolering.",
      rental: "Henvendelsen gjelder utleie av støvsuger/utstyr.",
      unknown: "Teksten er uklar og bør kontrolleres manuelt.",
      general_history: "Teksten bør behandles manuelt.",
    }[intent.category] || "Teksten bør kontrolleres manuelt.";
    const summaryBits = [
      name.value ? `${name.value}` : "Ukjent kontakt",
      categoryText,
      project.summary ? `Detaljer: ${project.summary}.` : "",
      address.street.value ? `Adresseforslag: ${address.street.value}${address.city.value ? `, ${address.city.value}` : ""}.` : "",
    ].filter(Boolean);
    return {
      schemaVersion: "local-1",
      parser: "simple_text_recognition",
      createdAt: options.now || new Date().toISOString(),
      source: {
        kind: /fra\s*:|til\s*:|opprinnelig melding/i.test(raw) ? "email" : /\b(sender tekstmeldinger|chat med|\d{1,2}:\d{2})\b/i.test(raw) ? "message_thread" : "pasted_text",
        direction: "unknown",
        latestExternalMessage: field(raw.slice(0, 500), raw ? "low" : "low", raw.slice(0, 120)),
        quotedThreadDetected: /opprinnelig melding|on .* wrote|^>/im.test(raw),
      },
      contacts: [{
        role: "customer",
        name,
        companyName: field("", "low", null),
        phone: field(phone?.value || "", phone?.confidence || "low", phone?.evidence || null),
        email: field(email?.value || "", email?.confidence || "low", email?.evidence || null),
      }],
      phoneCandidates: phones,
      emailCandidates: emails,
      locations: [{
        label: field("", "low", null),
        street: address.street,
        postalCode: address.postalCode,
        city: address.city,
        locationType: field(/\bhytte|hytta|blefjell|vegglifjell|fagerfjell/i.test(raw) ? "cabin" : "", "low", null),
        propertyReference: address.propertyReference,
      }],
      intent: {
        category: intent.category,
        confidence: intent.confidence,
        evidence: intent.warning || null,
        explicitAcceptance: intent.explicitAcceptance,
      },
      equipment,
      project: project.details,
      scheduling: {
        preferredDates: [],
        preferredTime: field("", "low", null),
        urgency: field(/\bhaster|snarest|fort/i.test(normalize(raw)) ? "soon" : "normal", "low", null),
        constraints: [],
        followUpRequested: /\bring|kontakt|svar/i.test(raw),
      },
      summary: summaryBits.join(" "),
      recommendedAction: actionForIntent(intent),
      warnings,
      sensitiveDataFlags: sensitive,
      rejectedPhones: phones.filter((item) => item.rejected),
    };
  }

  function matchCustomers(values, customers) {
    const phone = compactPhone(values.phone);
    const email = normalize(values.email);
    const name = normalize(values.name);
    const street = normalize(values.street);
    const city = normalize(values.city);
    return (customers || [])
      .map((customer) => {
        const reasons = [];
        let score = 0;
        const customerPhone = compactPhone(customer.phone);
        const customerEmail = normalize(customer.email);
        const customerName = normalize(customer.name || customer.display_name || "");
        const customerStreet = normalize(customer.visit_street || customer.address || "");
        const customerCity = normalize(customer.visit_city || customer.location_tag || "");
        if (phone && customerPhone && phone === customerPhone) {
          score += 120;
          reasons.push("samme telefonnummer");
        }
        if (email && customerEmail && email === customerEmail) {
          score += 120;
          reasons.push("samme e-post");
        }
        if (name && customerName === name) {
          score += 75;
          reasons.push("samme navn");
        } else if (name && customerName.includes(name)) {
          score += 40;
          reasons.push("navnet ligner");
        }
        if (street && customerStreet && (customerStreet.includes(street) || street.includes(customerStreet))) {
          score += 45;
          reasons.push("adresse ligner");
        }
        if (city && customerCity && customerCity.includes(city)) {
          score += 15;
          reasons.push("samme sted/område");
        }
        return { customer, score, reasons };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }

  const api = {
    analyzeText,
    compactPhone,
    extractPhones,
    extractEmails,
    inferIntent,
    matchCustomers,
    normalize,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NumedalIntake = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
