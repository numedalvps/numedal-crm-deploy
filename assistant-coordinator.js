(function initNumedalAssistantCoordinator(root) {
  "use strict";

  const AREA_RULES = [
    { pattern: /vegglifjell\s+nord|veggli\s*fjell\s+nord/i, key: "vegglifjell_nord", label: "Vegglifjell nord" },
    { pattern: /vegglifjell\s+s(?:ø|o)r|veggli\s*fjell\s+s(?:ø|o)r/i, key: "vegglifjell_sor", label: "Vegglifjell sør" },
    { pattern: /fagerfjell|bl(?:å|a)berg/i, key: "fagerfjell_blaberg", label: "Fagerfjell / Blåberg" },
    { pattern: /blefjell/i, key: "blefjell", label: "Blefjell" },
    { pattern: /kongsberg|\b36(?:0\d|1\d)\b/i, key: "kongsberg", label: "Kongsberg" },
    { pattern: /lampeland|\b3623\b/i, key: "lampeland", label: "Lampeland" },
    { pattern: /svene|flesberg|\b362[02]\b/i, key: "svene_flesberg", label: "Svene / Flesberg" },
    { pattern: /rollag|\b3626\b/i, key: "rollag", label: "Rollag" },
    { pattern: /veggli|\b3628\b/i, key: "veggli", label: "Veggli" },
    { pattern: /r(?:ø|o)dberg|nore\s+og\s+uvdal|\b3630\b/i, key: "rodberg_nore_uvdal", label: "Rødberg / Nore og Uvdal" },
    { pattern: /notodden/i, key: "notodden", label: "Notodden" },
  ];

  function repairTextEncoding(value) {
    let text = String(value || "");
    const replacements = [
      ["Ã¦", "æ"], ["Ã†", "Æ"], ["Ã¸", "ø"], ["Ã˜", "Ø"], ["Ã¥", "å"], ["Ã…", "Å"],
      ["Â", ""], ["â€“", "-"], ["â€”", "-"], ["â€™", "'"], ["â€œ", "\""], ["â€", "\""],
    ];
    for (const [bad, good] of replacements) text = text.replaceAll(bad, good);
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
      .replace(/[^a-z0-9@.+]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fieldValue(value) {
    if (value && typeof value === "object" && "value" in value) return String(value.value || "").trim();
    return String(value || "").trim();
  }

  function sourceText(context = {}) {
    const row = context.row || {};
    const draft = context.draft || {};
    return repairTextEncoding([
      row.source_channel,
      row.source_subject,
      row.raw_text,
      row.extracted_text,
      draft.raw,
      draft.note,
      context.text,
    ].filter(Boolean).join("\n"));
  }

  function sourceChannel(context = {}) {
    const row = context.row || {};
    const draft = context.draft || {};
    const text = normalize([row.source_channel, row.source_kind, sourceText(context)].filter(Boolean).join(" "));
    const email = String(draft.email || fieldValue(context.analysis?.contacts?.[0]?.email) || "").trim();
    const phone = String(draft.phone || fieldValue(context.analysis?.contacts?.[0]?.phone) || "").trim();
    if (/\bsms\b|google messages|tekstmelding|meldinger/.test(text)) return "sms";
    if (/e post|epost|email|gmail|mail/.test(text)) return "email";
    if (email) return "email";
    if (phone) return "sms";
    return "internal";
  }

  function firstName(value) {
    const name = String(value || "").trim().split(/\s+/)[0] || "";
    return /^[\p{L}][\p{L}'-]{1,40}$/u.test(name) ? name : "";
  }

  function cleanContactName(value) {
    return repairTextEncoding(value)
      .replace(/^\s*(?:sms|e-?post|email|melding)\s+fra\s*:?\s*/i, "")
      .replace(/^\s*(?:navn|kunde)\s*:\s*/i, "")
      .trim();
  }

  function contactValues(context = {}) {
    const draft = context.draft || {};
    const contact = context.analysis?.contacts?.[0] || {};
    const customer = context.customer || {};
    return {
      name: cleanContactName(draft.name || fieldValue(contact.name) || customer.name || customer.display_name || ""),
      phone: String(draft.phone || fieldValue(contact.phone) || customer.phone || "").trim(),
      email: String(draft.email || fieldValue(contact.email) || customer.email || "").trim(),
    };
  }

  function intentValues(context = {}) {
    const analysis = context.analysis || context.draft?.analysis || {};
    const text = normalize(sourceText(context));
    const analyzedCategory = String(analysis.intent?.category || "").trim();
    const explicitAcceptance = Boolean(analysis.intent?.explicitAcceptance)
      || /\bja takk\b|\bdet passer\b|\bkj(?:ø|o)r pa\b|\bjo fortere jo bedre\b|\bvi tar den\b|\baksepterer\b|\bbestill(?:er|ing)\b/.test(text);
    let category = analyzedCategory || "general";
    if (/service|rens|vedlikehold/.test(text)) category = "service_request";
    if (/monter|install|ny varmepumpe/.test(text)) category = "installation";
    if (/tilbud|pris|hva koster/.test(text)) category = "quote_request";
    if (/repar|feil|virker ikke|varmer ikke|kj(?:ø|o)ler ikke/.test(text)) category = "repair_request";
    if (/befaring/.test(text)) category = "inspection_request";
    return { category, explicitAcceptance };
  }

  function areaFromContext(context = {}) {
    const draft = context.draft || {};
    const customer = context.customer || {};
    const text = repairTextEncoding([
      draft.street,
      draft.zip,
      draft.city,
      draft.tags,
      customer.visit_street,
      customer.visit_zip,
      customer.visit_city,
      customer.location_tag,
      sourceText(context),
    ].filter(Boolean).join(" "));
    for (const rule of AREA_RULES.slice(0, 2)) {
      if (rule.pattern.test(text)) return { key: rule.key, label: rule.label, needsClarification: false };
    }
    if (/vegglifjell|veggli\s*fjell/i.test(text)) {
      return { key: "vegglifjell_uavklart", label: "Vegglifjell - avklar nord/sør", needsClarification: true };
    }
    for (const rule of AREA_RULES.slice(2)) {
      if (rule.pattern.test(text)) return { key: rule.key, label: rule.label, needsClarification: false };
    }
    const fallback = String(draft.city || customer.visit_city || customer.location_tag || "").trim();
    return { key: fallback ? normalize(fallback).replaceAll(" ", "_") : "uavklart", label: fallback || "Område må avklares", needsClarification: !fallback };
  }

  function bookingKind(context = {}) {
    const category = intentValues(context).category;
    const type = String(context.draft?.type || "").toLowerCase();
    if (/service/.test(type) || category === "service_request") return { type: "service", label: "Service", durationMinutes: 60, maxPerDay: 8 };
    if (/install/.test(type) || category === "installation") return { type: "installasjon", label: "Installasjon", durationMinutes: 240, maxPerDay: 2 };
    if (/befaring/.test(type) || category === "inspection_request") return { type: "befaring", label: "Befaring", durationMinutes: 60, maxPerDay: 5 };
    if (/repar|timejobb/.test(type) || category === "repair_request") return { type: "reparasjon", label: "Servicearbeid", durationMinutes: 120, maxPerDay: 4 };
    return { type: "oppfolging", label: "Oppfølging", durationMinutes: 30, maxPerDay: 8 };
  }

  function validIsoDate(value) {
    const text = String(value || "").trim();
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(text)) return "";
    const date = new Date(`${text}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : "";
  }

  function normalizedBookingDate(value) {
    const original = repairTextEncoding(value).trim();
    const isoDate = validIsoDate(original);
    if (isoDate) return isoDate;

    const numeric = original.match(/^(\d{1,2})[./-](\d{1,2})[./-](20\d{2})$/);
    if (numeric) {
      return validIsoDate(`${numeric[3]}-${String(numeric[2]).padStart(2, "0")}-${String(numeric[1]).padStart(2, "0")}`);
    }

    const monthAliases = {
      januar: 1,
      jan: 1,
      februar: 2,
      feb: 2,
      mars: 3,
      mar: 3,
      april: 4,
      apr: 4,
      mai: 5,
      juni: 6,
      jun: 6,
      juli: 7,
      jul: 7,
      august: 8,
      aug: 8,
      september: 9,
      sep: 9,
      oktober: 10,
      okt: 10,
      november: 11,
      nov: 11,
      desember: 12,
      des: 12,
    };
    const named = normalize(original).replaceAll(".", "").match(/^(\d{1,2}) ([a-z]+) (20\d{2})$/);
    const month = named ? monthAliases[named[2]] : 0;
    return named && month
      ? validIsoDate(`${named[3]}-${String(month).padStart(2, "0")}-${String(named[1]).padStart(2, "0")}`)
      : "";
  }

  function validClockTime(value) {
    const text = repairTextEncoding(value)
      .trim()
      .toLowerCase()
      .replace(/^kl(?:okka|okken)?\.?\s*/, "");
    let match = text.match(/^([01]?\d|2[0-3])$/);
    let normalizedTime = match ? `${String(match[1]).padStart(2, "0")}:00` : "";
    if (!normalizedTime) {
      match = text.match(/^([01]?\d|2[0-3])[:.]([0-5]?\d)$/);
      normalizedTime = match ? `${String(match[1]).padStart(2, "0")}:${String(match[2]).padStart(2, "0")}` : "";
    }
    if (!normalizedTime) {
      match = text.match(/^([01]\d|2[0-3])([0-5]\d)$/);
      normalizedTime = match ? `${match[1]}:${match[2]}` : "";
    }
    if (!normalizedTime) return "";
    const minuteOfDay = Number(normalizedTime.slice(0, 2)) * 60 + Number(normalizedTime.slice(3, 5));
    return minuteOfDay >= 6 * 60 && minuteOfDay < 23 * 60 ? normalizedTime : "";
  }

  function ownBooleanField(record, names) {
    for (const name of names) {
      if (!Object.prototype.hasOwnProperty.call(record, name)) continue;
      if (record[name] === true || record[name] === false) return { present: true, value: record[name] };
    }
    return { present: false, value: false };
  }

  function firstScalarField(record, names) {
    for (const name of names) {
      const value = record[name];
      if ((typeof value === "string" || typeof value === "number") && String(value).trim()) return value;
    }
    return "";
  }

  function normalizedBookingType(value) {
    const rawType = normalize(value).replaceAll(" ", "_");
    const typeAliases = {
      service: "service",
      servicejobb: "service",
      service_jobb: "service",
      varmepumpeservice: "service",
      varmepumpe_service: "service",
      vedlikehold: "service",
      reparasjon: "reparasjon",
      reparasjonsjobb: "reparasjon",
      reparasjons_jobb: "reparasjon",
      servicearbeid: "reparasjon",
      service_arbeid: "reparasjon",
      timejobb: "reparasjon",
      time_jobb: "reparasjon",
      feilretting: "reparasjon",
      repair: "reparasjon",
      befaring: "befaring",
      befaringsjobb: "befaring",
      befarings_jobb: "befaring",
      inspection: "befaring",
      installasjon: "installasjon",
      installasjonsjobb: "installasjon",
      installasjons_jobb: "installasjon",
      installering: "installasjon",
      montering: "installasjon",
      montasje: "installasjon",
      installation: "installasjon",
      blaseisolering: "blaseisolering",
      blase_isolering: "blaseisolering",
      blaaseisolering: "blaseisolering",
      blaase_isolering: "blaseisolering",
      annet: "annet",
      other: "annet",
      oppfolging: "annet",
      follow_up: "annet",
      followup: "annet",
    };
    return typeAliases[rawType] || "annet";
  }

  function normalizedDurationMinutes(raw, jobType) {
    const defaults = {
      service: 60,
      reparasjon: 120,
      befaring: 60,
      installasjon: 240,
      blaseisolering: 480,
      annet: 60,
    };
    const values = [
      ...[raw.durationMinutes, raw.duration_minutes]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => ({ value, unit: "minutes" })),
      ...[raw.durationHours, raw.duration_hours]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => ({ value, unit: "hours" })),
      ...[raw.duration]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => ({ value, unit: "unknown" })),
    ];
    let minutes = 0;
    for (const candidate of values) {
      const text = repairTextEncoding(candidate.value).trim().toLowerCase().replace(",", ".").replace(/\.$/, "");
      if (!text) continue;
      if (candidate.unit === "hours") {
        const hours = Number(text);
        if (Number.isFinite(hours) && hours > 0) minutes = hours * 60;
      } else {
        const combined = text.match(/^(\d+(?:\.\d+)?)\s*(?:t|time|timer)\s*(?:(?:og\s*)?(\d+)\s*(?:m|min|minutt|minutter))?$/);
        const minuteValue = text.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|minutt|minutter)$/);
        const number = Number(text);
        if (combined) minutes = Number(combined[1]) * 60 + Number(combined[2] || 0);
        else if (minuteValue) minutes = Number(minuteValue[1]);
        else if (Number.isFinite(number) && number > 0) minutes = candidate.unit === "hours" ? number * 60 : number;
      }
      if (Number.isFinite(minutes) && minutes > 0) break;
      minutes = 0;
    }
    return minutes > 0
      ? Math.max(15, Math.min(720, Math.round(minutes / 15) * 15))
      : defaults[jobType];
  }

  function normalizeBookingProposal(value = {}) {
    const container = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const raw = container.booking && typeof container.booking === "object" && !Array.isArray(container.booking)
      ? container.booking
      : container.planning && typeof container.planning === "object" && !Array.isArray(container.planning)
        ? container.planning
        : container;
    const jobType = normalizedBookingType(firstScalarField(raw, ["jobType", "job_type", "type"]));
    const durationMinutes = normalizedDurationMinutes(raw, jobType);
    const rawDate = firstScalarField(raw, ["scheduledDate", "scheduled_date", "date"]);
    const rawTime = firstScalarField(raw, ["scheduledTime", "scheduled_time", "time"]);
    const parsedDate = normalizedBookingDate(rawDate);
    const parsedTime = validClockTime(rawTime);
    const scheduleField = ownBooleanField(raw, ["scheduleRequested", "schedule_requested"]);
    const scheduleRequested = scheduleField.present ? scheduleField.value : Boolean(rawDate || rawTime);
    const scheduledDate = scheduleRequested ? parsedDate : "";
    const scheduledTime = scheduleRequested ? parsedTime : "";
    const title = repairTextEncoding(firstScalarField(raw, ["title", "jobTitle", "job_title"])).trim().slice(0, 300);
    const note = repairTextEncoding(firstScalarField(raw, ["note", "description"])).trim().slice(0, 8000);
    const resource = repairTextEncoding(firstScalarField(raw, [
      "resource",
      "resourceSuggestion",
      "resource_suggestion",
      "technician",
      "servicemann",
      "assignedToName",
      "assigned_to_name",
    ])).replace(/\s+/g, " ").trim().slice(0, 160);
    const acceptanceField = ownBooleanField(raw, ["customerAccepted", "customer_accepted"]);
    const rawMode = normalize(firstScalarField(raw, ["mode", "bookingMode", "booking_mode"])).replaceAll(" ", "_");
    const routeModes = ["route", "route_plan", "route_planning", "rute", "rute_plan", "ruteplan", "ruteplanlegging", "multiple", "flere"];
    return {
      jobType,
      title,
      note,
      scheduledDate,
      scheduledTime,
      durationMinutes,
      resource,
      customerAccepted: acceptanceField.present ? acceptanceField.value : false,
      scheduleRequested,
      mode: routeModes.includes(rawMode) ? "route" : "single",
      hasExactSchedule: Boolean(scheduleRequested && scheduledDate && scheduledTime),
    };
  }

  function relevantMessageText(context = {}) {
    const text = sourceText(context);
    const match = text.match(/(?:relevant\s+meldingstekst|meldingstekst)\s*:\s*([\s\S]*?)(?=\n\s*(?:handlingsforslag|koblingsforslag|statusforslag|crm-ref|kilde-id)\s*:|$)/i);
    return repairTextEncoding(match?.[1] || text).trim();
  }

  function sourceDate(context = {}) {
    const candidates = [
      context.row?.source_received_at,
      context.row?.received_at,
      sourceText(context),
      context.row?.created_at,
    ];
    for (const candidate of candidates) {
      const text = String(candidate || "");
      const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
      if (iso) {
        const value = `${iso[1]}-${iso[2]}-${iso[3]}`;
        const date = new Date(`${value}T00:00:00Z`);
        if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) return value;
      }
      const norwegian = text.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
      if (norwegian) {
        const value = `${norwegian[3]}-${String(norwegian[2]).padStart(2, "0")}-${String(norwegian[1]).padStart(2, "0")}`;
        const date = new Date(`${value}T00:00:00Z`);
        if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) return value;
      }
    }
    return "";
  }

  function coordinatesFromText(value) {
    const text = repairTextEncoding(value);
    const pattern = /(?<!\d)([5-7]\d(?:[.,]\d{4,}))\s*[,;\t ]+\s*([0-3]?\d(?:[.,]\d{4,}))(?!\d)/g;
    for (const match of text.matchAll(pattern)) {
      const latitude = Number(match[1].replace(",", "."));
      const longitude = Number(match[2].replace(",", "."));
      if (latitude >= 57 && latitude <= 72 && longitude >= 4 && longitude <= 32) {
        return `${latitude.toFixed(7).replace(/0+$/, "").replace(/\.$/, "")},${longitude.toFixed(7).replace(/0+$/, "").replace(/\.$/, "")}`;
      }
    }
    return "";
  }

  function accessEvidence(value) {
    const text = repairTextEncoding(value);
    const hasAccessInfo = /\b(adkomst|tilkomst|n(?:ø|o)kkel|n(?:ø|o)kkelboks(?:en)?|kode(?:n)?|pin|kodeboks(?:en)?|d(?:ø|o)rkode|portkode|bomkode|under\s+matta|under\s+matten|legger\s+ut\s+n(?:ø|o)kkel)\b/i.test(text);
    const containsSecret = hasAccessInfo
      && (
        /\b(?:kode(?:n)?|code|pin|n(?:ø|o)kkelboks(?:en)?|kodeboks(?:en)?|d(?:ø|o)rkode|portkode|bomkode)\b[^\n]{0,40}\b(?:\d[\s-]?){3,8}\b/i.test(text)
        || /\b(?:\d[\s-]?){3,8}\b[^\n]{0,24}\b(?:er\s+)?(?:kode(?:n)?|pin|d(?:ø|o)rkode|portkode|bomkode)\b/i.test(text)
      );
    return { hasAccessInfo, containsSecret };
  }

  function looksLikeConversationTranscript(value) {
    const text = repairTextEncoding(value).trim();
    const nonEmptyLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return nonEmptyLines.length > 1
      || /\b(?:innkommende|utgaende|utgående|incoming|outgoing|received|sent|melding\s*\d+|kunde|bedrift|avsender|mottaker)\s*:/i.test(text)
      || /\b(?:dato\/tid|kilde-id|conversation-id|message-id)\s*:/i.test(text)
      || (text.match(/\b20\d{2}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/g) || []).length > 1;
  }

  function containsProbableStandaloneAccessCode(value) {
    const scrubbed = repairTextEncoding(value)
      .replace(/\b20\d{2}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?/g, " ")
      .replace(/\b\d{1,2}[./]\d{1,2}[./]20\d{2}\b/g, " ");
    return /(^|[^\d])(?:\d[\s-]?){3,8}(?!\d)/.test(scrubbed);
  }

  function controlledAccessNote(value) {
    const original = repairTextEncoding(value).trim();
    const note = original.replace(/\s+/g, " ").trim();
    return {
      note,
      valid: Boolean(note)
        && note.length <= 320
        && accessEvidence(note).hasAccessInfo
        && !looksLikeConversationTranscript(original),
    };
  }

  function manualConfirmedAccessConfig(options = {}) {
    const setting = options.manualConfirmedAccess;
    const objectSetting = setting && typeof setting === "object" && !Array.isArray(setting) ? setting : {};
    const requested = setting === true || objectSetting.confirmed === true || objectSetting.enabled === true;
    const suppliedNote = String(
      options.accessNote
      || options.access_note
      || objectSetting.accessNote
      || objectSetting.access_note
      || "",
    ).trim();
    return { requested, suppliedNote };
  }

  function normalizedNorwegianPhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("0047")) digits = digits.slice(4);
    else if (digits.length === 10 && digits.startsWith("47")) digits = digits.slice(2);
    return /^\d{8}$/.test(digits) ? digits : "";
  }

  function historicalConversationPhones(conversation = {}) {
    const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
    const candidates = [
      conversation.participantPhone,
      conversation.participant_phone,
      conversation.contactPhone,
      conversation.contact_phone,
      conversation.phone,
      conversation.participant?.phone,
      ...participants.map((participant) => participant?.phone),
    ];
    return [...new Set(candidates.map(normalizedNorwegianPhone).filter(Boolean))];
  }

  function verifiedHistoricalAccessMatch(conversation = {}, match = {}, matchResult = {}) {
    const contactPeople = Array.isArray(match.customer?.contact_people) ? match.customer.contact_people : [];
    const customerPhones = [
      match.customerPhone,
      match.customer_phone,
      match.customer?.phone
      || "",
      match.customer?.mobile,
      ...contactPeople.map((contact) => contact?.phone),
    ].map(normalizedNorwegianPhone).filter(Boolean);
    const sourcePhones = historicalConversationPhones(conversation);
    const matchedPhone = sourcePhones.find((sourcePhone) => customerPhones.includes(sourcePhone)) || "";
    const verified = matchResult.status === "exact"
      && matchResult.method === "exact_phone"
      && Number(matchResult.confidence) >= 0.95
      && matchResult.candidateCount === 1
      && match.phoneMatchUnique === true
      && Boolean(matchedPhone);
    return { verified, matchedPhone: verified ? matchedPhone : "" };
  }

  function historicalAccessNote(messages = [], suppliedNote = "") {
    const accessMessages = messages
      .map((message, index) => ({
        ...message,
        index,
        time: Date.parse(message.timestamp || ""),
      }))
      .filter((message) => accessEvidence(message.text).hasAccessInfo)
      .sort((left, right) => {
        const leftHasTime = Number.isFinite(left.time);
        const rightHasTime = Number.isFinite(right.time);
        if (leftHasTime && rightHasTime && left.time !== right.time) return right.time - left.time;
        if (leftHasTime !== rightHasTime) return rightHasTime ? 1 : -1;
        return right.index - left.index;
      });
    // A multi-year thread can contain expired key-box codes. Without a manually
    // supplied note, only the newest access-bearing message may become a proposal.
    const sources = suppliedNote ? [suppliedNote] : accessMessages.slice(0, 1).map((message) => message.text);
    const fragments = [];
    for (const source of sources) {
      const parts = repairTextEncoding(source)
        .split(/(?:\r?\n)+|(?<=[.!?])\s+/)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      for (const part of parts) {
        if (!accessEvidence(part).hasAccessInfo || fragments.includes(part)) continue;
        fragments.push(part);
        if (fragments.length >= 3) break;
      }
      if (fragments.length >= 3) break;
    }
    const candidate = controlledAccessNote(fragments.join(" "));
    return candidate.valid ? candidate.note : "";
  }

  function stableFingerprint(value) {
    const text = String(value || "");
    let first = 2166136261;
    let second = 2246822507;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 16777619);
      second ^= code + index;
      second = Math.imul(second, 3266489909);
    }
    return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
  }

  function historicalMessageDate(value) {
    const text = String(value || "").trim();
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})(?=$|[T\s])/);
    if (iso) {
      const date = `${iso[1]}-${iso[2]}-${iso[3]}`;
      const parsed = new Date(`${date}T00:00:00Z`);
      if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) return date;
    }
    const norwegian = text.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
    if (!norwegian) return "";
    const date = `${norwegian[3]}-${String(norwegian[2]).padStart(2, "0")}-${String(norwegian[1]).padStart(2, "0")}`;
    const parsed = new Date(`${date}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
  }

  function historicalConversationMessages(conversation = {}) {
    const supplied = Array.isArray(conversation.messages) ? conversation.messages : [];
    const rows = supplied.length ? supplied : [
      {
        id: conversation.messageId || "",
        timestamp: conversation.timestamp || conversation.date || conversation.receivedAt || "",
        direction: conversation.direction || "unknown",
        text: conversation.text || conversation.body || conversation.rawText || "",
      },
    ];
    return rows.map((message, index) => ({
      id: String(message?.id || message?.messageId || index),
      timestamp: String(message?.timestamp || message?.sentAt || message?.receivedAt || message?.date || ""),
      direction: /^(?:in|incoming|received|customer)$/i.test(String(message?.direction || message?.sender || ""))
        ? "incoming"
        : /^(?:out|outgoing|sent|business)$/i.test(String(message?.direction || message?.sender || ""))
          ? "outgoing"
          : "unknown",
      text: repairTextEncoding(message?.text || message?.body || message?.content || "").trim(),
    })).filter((message) => message.text || message.timestamp || message.id);
  }

  function historicalConversationTopics(value, access = { hasAccessInfo: false }) {
    const text = normalize(value);
    const topics = [];
    const rules = [
      [/\b(?:service|rens|vedlikehold|filter)\b/, "service"],
      [/\b(?:monter\w*|install\w*|varmepumpe|innedel|utedel)\b/, "montering eller anlegg"],
      [/\b(?:time|tidspunkt|dato|passer|kommer|avtale|booking)\b/, "avtale eller tidspunkt"],
      [/\b(?:tilbud|pris|kost\w*|bestill\w*)\b/, "tilbud eller bestilling"],
      [/\b(?:betal\w*|vipps|faktura|kvittering)\b/, "betaling eller faktura"],
      [/\b(?:bilde|bilder|foto)\b/, "bilder"],
    ];
    for (const [pattern, label] of rules) {
      if (pattern.test(text)) topics.push(label);
    }
    if (access.hasAccessInfo) topics.push("adgangsinformasjon markert som sensitiv");
    return [...new Set(topics)].slice(0, 6);
  }

  function historicalConversationSummary(record = {}) {
    const messageCount = Number(record.messageCount);
    const firstMessageDate = String(record.firstMessageDate || "").trim();
    const lastMessageDate = String(record.lastMessageDate || "").trim();
    const topics = Array.isArray(record.topicLabels) ? record.topicLabels.map((topic) => String(topic || "").trim()) : [];
    const allowedTopics = new Set([
      "service",
      "montering eller anlegg",
      "avtale eller tidspunkt",
      "tilbud eller bestilling",
      "betaling eller faktura",
      "bilder",
      "adgangsinformasjon markert som sensitiv",
    ]);
    const validDate = (value) => {
      if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    if (!Number.isInteger(messageCount) || messageCount < 1) return "";
    if (topics.length > 6 || new Set(topics).size !== topics.length || topics.some((topic) => !allowedTopics.has(topic))) return "";
    if (Boolean(firstMessageDate) !== Boolean(lastMessageDate)) return "";
    if ((firstMessageDate && !validDate(firstMessageDate)) || (lastMessageDate && !validDate(lastMessageDate))) return "";
    if (firstMessageDate && firstMessageDate > lastMessageDate) return "";
    const dateSummary = firstMessageDate
      ? firstMessageDate === lastMessageDate
        ? ` den ${firstMessageDate}`
        : ` fra ${firstMessageDate} til ${lastMessageDate}`
      : "";
    const topicSummary = topics.length ? ` Temaer: ${topics.join(", ")}.` : "";
    return `Historisk Google Messages-samtale med ${messageCount} melding${messageCount === 1 ? "" : "er"}${dateSummary}.${topicSummary}`;
  }

  function historicalConversationImportBody(summary, containsSensitiveAccess, manualAccessProposal) {
    if (manualAccessProposal) {
      return `${summary} En sensitiv opplysning er lagt som kontrollforslag til kundens eget felt. Detaljene gjentas ikke i historikknotatet.`;
    }
    if (containsSensitiveAccess) {
      return `${summary} Sensitiv adgangsinformasjon finnes bare i originalkilden; ingen kode eller rå meldingstekst er kopiert.`;
    }
    return `${summary} Bare dette sammendraget lagres; rå meldingstekst kopieres ikke.`;
  }

  function legacyHistoricalEnrichmentBody(payload = {}) {
    const proposed = payload.proposedChanges && typeof payload.proposedChanges === "object" && !Array.isArray(payload.proposedChanges)
      ? payload.proposedChanges
      : {};
    const findings = new Set(Array.isArray(payload.findingTypes) ? payload.findingTypes.map(String) : []);
    const summaries = [];
    if (findings.has("service_completed_candidate")) {
      summaries.push(payload.sourceDate
        ? `SMS tyder på at service ble utført ${payload.sourceDate}.`
        : "SMS tyder på at service ble utført, men datoen mangler.");
    } else if (findings.has("service_accepted")) {
      summaries.push("Kunden takket ja til service. Dette er ikke bevis på at service ble utført.");
    } else if (findings.has("service_timing_declined")) {
      summaries.push("Foreslått tidspunkt passet ikke. Kunden bør fortsatt kunne få et nytt forslag.");
    } else if (findings.has("service_declined")) {
      summaries.push("Kunden avslo service. Ikke bruk dette som permanent kontaktreservasjon uten tydelig beskjed.");
    }
    if (findings.has("coordinates") && proposed.gpsCoordinates) {
      summaries.push("Koordinater ble funnet i SMS og må kartkontrolleres før lagring.");
    }
    if (findings.has("access_information") && proposed.accessInfoPresent) {
      summaries.push(proposed.accessSecretNotStored
        ? "Sikker tilkomstinformasjon finnes i original SMS. Selve koden er ikke kopiert til forslaget."
        : "Tilkomstinformasjon finnes i SMS og må kontrolleres før lagring.");
    }
    return summaries.join(" ");
  }

  function isSafeLegacyHistoricalSourceRef(value) {
    const sourceRef = String(value || "").trim();
    return /^intake:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceRef)
      || /^GM:[a-f0-9]{16}:20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/i.test(sourceRef);
  }

  function historicalSmsMatch(match = {}) {
    const customer = match.customer || {};
    const customerId = String(match.customerId || match.customer_id || customer.id || "").trim();
    const method = normalize(match.method || match.matchMethod || match.match_method || "unknown").replaceAll(" ", "_");
    const numericConfidence = Number(match.confidence ?? match.matchConfidence ?? match.match_confidence);
    const confidence = Number.isFinite(numericConfidence) ? Math.max(0, Math.min(1, numericConfidence)) : null;
    const candidateCount = Number(match.candidateCount ?? match.candidate_count ?? (Array.isArray(match.candidates) ? match.candidates.length : 0)) || 0;
    const ambiguous = match.ambiguous === true || candidateCount > 1;
    const exactMethods = new Set(["exact_phone", "crm_customer_id", "manual_confirmed", "customer_card"]);
    const explicitlyExact = match.exact === true || match.confirmed === true || String(match.status || match.matchStatus || "") === "exact";
    const trustedManualMethods = new Set(["crm_customer_id", "manual_confirmed", "customer_card"]);
    const exact = Boolean(customerId)
      && !ambiguous
      && exactMethods.has(method)
      && (
        (confidence !== null && confidence >= 0.95)
        || (explicitlyExact && trustedManualMethods.has(method))
      );
    return {
      customerId: exact ? customerId : null,
      customerName: String(customer.name || match.customerName || match.customer_name || "").trim(),
      method: method || "unknown",
      confidence,
      candidateCount,
      status: exact ? "exact" : "uncertain",
    };
  }

  function buildHistoricalSmsConversationImport(conversation = {}, match = {}, options = {}) {
    const messages = historicalConversationMessages(conversation);
    const rawConversationText = messages.map((message) => message.text).filter(Boolean).join("\n");
    const access = accessEvidence(rawConversationText);
    const dates = messages.map((message) => historicalMessageDate(message.timestamp)).filter(Boolean).sort();
    const firstMessageDate = dates[0] || "";
    const lastMessageDate = dates[dates.length - 1] || "";
    const topics = historicalConversationTopics(rawConversationText, access);
    const matchResult = historicalSmsMatch(match);
    const conversationId = String(
      conversation.id
      || conversation.conversationId
      || conversation.conversation_id
      || conversation.threadId
      || conversation.thread_id
      || conversation.sourceRef
      || "",
    ).trim();
    const manualAccess = manualConfirmedAccessConfig(options);
    const exactAccessMatch = verifiedHistoricalAccessMatch(conversation, match, matchResult);
    const accessNote = manualAccess.requested && exactAccessMatch.verified
      ? historicalAccessNote(messages, manualAccess.suppliedNote)
      : "";
    const manualAccessReady = manualAccess.requested
      && exactAccessMatch.verified
      && access.hasAccessInfo
      && Boolean(conversationId && lastMessageDate)
      && Boolean(accessNote);
    // The fingerprint deliberately excludes message text. A deterministic hash of
    // a short access code could otherwise be brute-forced even when the code is
    // not visible in the stored proposal.
    const canonicalMessages = messages.map((message) => [
      message.id,
      message.timestamp,
      message.direction,
    ].join("\u001f")).join("\u001e") + `\u001d${topics.join("|")}\u001d${access.hasAccessInfo ? "access" : "no-access"}`;
    const conversationFingerprint = stableFingerprint(conversationId || canonicalMessages || "missing-conversation");
    const contentFingerprint = stableFingerprint(canonicalMessages || conversationId || "empty-conversation");
    const manualAccessSuffix = manualAccessReady ? ":manual-access" : "";
    const sourceRef = `google_messages:${conversationFingerprint}:${contentFingerprint}${manualAccessSuffix}`;
    const blockers = [];

    if (!conversationId) blockers.push("Mangler stabil samtale-ID fra Google Messages");
    if (!messages.some((message) => message.text)) blockers.push("Samtalen mangler meldingstekst");
    if (!lastMessageDate) blockers.push("Mangler sikker dato i samtalen");
    if (matchResult.status !== "exact") blockers.push("Kundekoblingen er usikker og må kontrolleres");
    if (manualAccess.requested && !exactAccessMatch.verified) {
      blockers.push("Manuell adgangsimport krever verifisert eksakt telefonmatch");
    } else if (manualAccess.requested && !manualAccessReady) {
      blockers.push("Fant ikke en avgrenset adgangsbeskrivelse som kan foreslås trygt");
    } else if (access.hasAccessInfo && !manualAccessReady) {
      blockers.push(access.containsSecret
        ? "Adgangskode finnes i original SMS, men er med vilje ikke lagret"
        : "Adgangsinformasjon må kontrolleres manuelt");
    }

    const summary = historicalConversationSummary({
      messageCount: messages.length,
      firstMessageDate,
      lastMessageDate,
      topicLabels: topics,
    });
    const containsSensitiveAccess = access.hasAccessInfo;
    const hasMessageText = messages.some((message) => message.text);

    return {
      relevant: hasMessageText,
      actionType: "customer_enrichment",
      status: "needs_review",
      channel: "internal",
      title: "Historisk SMS - kundehistorikk",
      body: historicalConversationImportBody(summary, containsSensitiveAccess, manualAccessReady),
      confidence: matchResult.status === "exact" ? (containsSensitiveAccess ? 0.75 : 0.95) : 0.5,
      blockers: [...new Set(blockers)],
      payload: {
        sourceDate: lastMessageDate || null,
        proposedChanges: {
          historicalConversation: "summary_only",
          ...(manualAccessReady ? { access_note: accessNote } : {}),
        },
        historicalConversation: {
          summary,
          messageCount: messages.length,
          firstMessageDate: firstMessageDate || null,
          lastMessageDate: lastMessageDate || null,
          topicLabels: topics,
          accessInfoPresent: access.hasAccessInfo,
          accessSecretNotStored: access.containsSecret && !manualAccessReady,
          accessStoredInDedicatedField: manualAccessReady,
          sourceFingerprint: contentFingerprint,
          matchStatus: matchResult.status,
        },
        containsSensitiveAccess,
        manualConfirmedAccessRequested: manualAccess.requested,
        manualConfirmedAccess: manualAccessReady,
        ...(manualAccessReady ? {
          accessNoteTarget: "access_note",
          auditExcludesAccessSecret: true,
        } : {}),
        doNotApplyAutomatically: true,
      },
      evidence: {
        source: "historical_sms",
        provider: "google_messages",
        sourceDate: lastMessageDate || null,
        sourceRef,
        conversationFingerprint,
        contentFingerprint,
        messageCount: messages.length,
        matchMethod: matchResult.method,
        matchConfidence: matchResult.confidence,
        matchStatus: matchResult.status,
        matchedCustomerId: matchResult.customerId,
        exactPhoneVerified: manualAccessReady,
        uniquePhoneMatch: manualAccessReady,
        matchedPhone: manualAccessReady ? exactAccessMatch.matchedPhone : null,
        containsSensitiveAccess,
        accessSecretNotStored: access.containsSecret && !manualAccessReady,
        manualConfirmedAccess: manualAccessReady,
        accessNoteTarget: manualAccessReady ? "access_note" : null,
      },
      needsReview: true,
      canAttachToCustomer: matchResult.status === "exact"
        && (!containsSensitiveAccess || manualAccessReady)
        && Boolean(lastMessageDate && conversationId),
      customerId: matchResult.customerId,
      linkedCustomerId: matchResult.customerId,
      sourceKind: "historical_sms",
      sourceRef,
      idempotencyKey: `historical_sms:${conversationFingerprint}:${contentFingerprint}${manualAccessSuffix}`,
      approvalRequired: true,
    };
  }

  function historicalSmsActionSafety(action = {}) {
    const sourceKind = String(action.source_kind || action.sourceKind || "").trim();
    const payload = action.payload_json || action.payload || {};
    const evidence = action.evidence_json || action.evidence || {};
    const initialProposedChanges = payload.proposedChanges && typeof payload.proposedChanges === "object" && !Array.isArray(payload.proposedChanges)
      ? payload.proposedChanges
      : {};
    const hasHistoricalAccessMarker = Object.prototype.hasOwnProperty.call(payload, "manualConfirmedAccess")
      || Object.prototype.hasOwnProperty.call(payload, "manualConfirmedAccessRequested")
      || Object.prototype.hasOwnProperty.call(payload, "accessNoteTarget")
      || Object.prototype.hasOwnProperty.call(payload, "auditExcludesAccessSecret")
      || Object.prototype.hasOwnProperty.call(initialProposedChanges, "access_note")
      || initialProposedChanges.historicalConversation === "summary_only"
      || (payload.historicalConversation && typeof payload.historicalConversation === "object")
      || Array.isArray(payload.findingTypes)
      || Object.prototype.hasOwnProperty.call(evidence, "accessNoteTarget")
      || Object.prototype.hasOwnProperty.call(evidence, "exactPhoneVerified")
      || Object.prototype.hasOwnProperty.call(evidence, "uniquePhoneMatch")
      || Object.prototype.hasOwnProperty.call(evidence, "matchedPhone")
      || evidence.source === "historical_sms"
      || evidence.provider === "google_messages";
    if (sourceKind !== "historical_sms" && !hasHistoricalAccessMarker) return { allowed: true, blockers: [] };
    const blockers = [];
    if (sourceKind !== "historical_sms") blockers.push("Forslaget mangler historisk SMS-kilde");
    const forbiddenKeys = new Set([
      "raw",
      "rawtext",
      "rawmessage",
      "rawtranscript",
      "rawconversation",
      "extractedtext",
      "messages",
      "conversationmessages",
      "transcript",
      "messagetext",
      "messagebody",
      "conversationtext",
      "fullconversation",
      "accesscode",
      "keyboxcode",
      "doorcode",
      "portcode",
      "pin",
    ]);

    function containsForbiddenKey(value) {
      if (!value || typeof value !== "object") return false;
      if (Array.isArray(value)) return value.some(containsForbiddenKey);
      return Object.entries(value).some(([key, nested]) => (
        forbiddenKeys.has(normalize(key).replaceAll(" ", ""))
        || containsForbiddenKey(nested)
      ));
    }

    const actionType = String(action.action_type || action.actionType || "");
    const status = String(action.status || "needs_review");
    const linkedCustomerId = action.linked_customer_id || action.customerId || null;
    const actionSourceRef = String(action.source_ref || action.sourceRef || "").trim();
    const actionIdempotencyKey = String(action.idempotency_key || action.idempotencyKey || "").trim();
    const blockersValue = Array.isArray(action.blockers_json || action.blockers) ? (action.blockers_json || action.blockers) : [];
    const allowedStoredBlockers = new Set([
      "Mangler stabil samtale-ID fra Google Messages",
      "Samtalen mangler meldingstekst",
      "Mangler sikker dato i samtalen",
      "Kundekoblingen er usikker og må kontrolleres",
      "Manuell adgangsimport krever verifisert eksakt telefonmatch",
      "Fant ikke en avgrenset adgangsbeskrivelse som kan foreslås trygt",
      "Adgangskode finnes i original SMS, men er med vilje ikke lagret",
      "Adgangsinformasjon må kontrolleres manuelt",
      "Mangler entydig kundekobling",
      "Kontroller mot ferdig jobb eller faktura før siste service oppdateres",
      "Mangler sikker servicedato",
      "Velg hvilket anlegg servicen gjelder",
      "Kontroller koordinatene mot riktig anleggsadresse",
      "Åpne original SMS ved behov; adgangskoden er med vilje ikke lagret",
      "Kontroller at tilkomstinformasjonen fortsatt gjelder",
    ]);
    const proposedChanges = payload.proposedChanges && typeof payload.proposedChanges === "object" && !Array.isArray(payload.proposedChanges)
      ? payload.proposedChanges
      : {};
    const historicalConversation = payload.historicalConversation && typeof payload.historicalConversation === "object" && !Array.isArray(payload.historicalConversation)
      ? payload.historicalConversation
      : null;
    const isConversationImport = proposedChanges.historicalConversation === "summary_only" && Boolean(historicalConversation);
    const isLegacyEnrichment = !historicalConversation
      && Array.isArray(payload.findingTypes)
      && payload.proposedChanges
      && typeof payload.proposedChanges === "object"
      && !Array.isArray(payload.proposedChanges);
    const hasAccessNoteProposal = Object.prototype.hasOwnProperty.call(proposedChanges, "access_note");
    const accessNoteProposal = controlledAccessNote(proposedChanges.access_note);
    const manualAccessProposal = payload.manualConfirmedAccess === true;
    const payloadWithoutDedicatedAccess = {
      ...payload,
      proposedChanges: { ...proposedChanges },
    };
    delete payloadWithoutDedicatedAccess.proposedChanges.access_note;
    const safetyTextWithoutDedicatedAccess = [
      action.title,
      action.body,
      action.source_ref || action.sourceRef,
      JSON.stringify(payloadWithoutDedicatedAccess),
      JSON.stringify(evidence),
    ].filter(Boolean).join("\n");
    if (actionType !== "customer_enrichment") blockers.push("Historisk SMS kan bare lagres som kundedataforslag");
    if (status !== "needs_review") blockers.push("Historisk SMS må alltid innom kontrollkøen");
    if (action.approval_required === false || action.approvalRequired === false) blockers.push("Historisk SMS krever godkjenning");
    if (String(action.channel || "internal") !== "internal") blockers.push("Historisk SMS kan bare lagres i intern kontrollkø");
    if ([action.recipient, action.subject, action.not_before, action.expires_at].some((value) => String(value || "").trim())) {
      blockers.push("Historisk SMS inneholder felt som ikke hører til kontrollforslaget");
    }
    if (String(action.error_message || action.errorMessage || "").trim()) blockers.push("Nytt historisk SMS-forslag kan ikke inneholde feilfritekst");
    if (blockersValue.some((item) => typeof item !== "string" || !allowedStoredBlockers.has(item))) {
      blockers.push("Historisk SMS inneholder en ukjent eller rå kontrollsperre");
    }
    if (payload.doNotApplyAutomatically !== true) blockers.push("Historisk SMS mangler sperre mot automatisk bruk");
    if (containsForbiddenKey(payload) || containsForbiddenKey(evidence)) blockers.push("Rå SMS-tekst eller adgangskodefelt kan ikke lagres automatisk");
    if (containsProbableStandaloneAccessCode(action.title) || containsProbableStandaloneAccessCode(action.body)) {
      blockers.push("Kort tallkode kan ikke lagres utenfor kundens dedikerte adkomstforslag");
    }
    if (!isConversationImport && !isLegacyEnrichment) blockers.push("Historisk SMS har ukjent eller ufullstendig datastruktur");
    if (manualAccessProposal && !isConversationImport) blockers.push("Manuell adgangsimport krever et gyldig samtalesammendrag");
    if (isConversationImport) {
      const allowedPayloadKeys = new Set([
        "sourceDate",
        "proposedChanges",
        "historicalConversation",
        "containsSensitiveAccess",
        "manualConfirmedAccessRequested",
        "manualConfirmedAccess",
        "accessNoteTarget",
        "auditExcludesAccessSecret",
        "doNotApplyAutomatically",
      ]);
      const allowedProposedKeys = new Set(["historicalConversation", "access_note"]);
      const allowedHistoryKeys = new Set([
        "summary",
        "messageCount",
        "firstMessageDate",
        "lastMessageDate",
        "topicLabels",
        "accessInfoPresent",
        "accessSecretNotStored",
        "accessStoredInDedicatedField",
        "sourceFingerprint",
        "matchStatus",
      ]);
      const allowedEvidenceKeys = new Set([
        "source",
        "provider",
        "sourceDate",
        "sourceRef",
        "conversationFingerprint",
        "contentFingerprint",
        "messageCount",
        "matchMethod",
        "matchConfidence",
        "matchStatus",
        "matchedCustomerId",
        "exactPhoneVerified",
        "uniquePhoneMatch",
        "matchedPhone",
        "containsSensitiveAccess",
        "accessSecretNotStored",
        "manualConfirmedAccess",
        "accessNoteTarget",
      ]);
      const hasUnknownSchemaField = Object.keys(payload).some((key) => !allowedPayloadKeys.has(key))
        || Object.keys(proposedChanges).some((key) => !allowedProposedKeys.has(key))
        || Object.keys(historicalConversation).some((key) => !allowedHistoryKeys.has(key))
        || Object.keys(evidence).some((key) => !allowedEvidenceKeys.has(key));
      if (hasUnknownSchemaField) blockers.push("Samtaleimporten inneholder rå eller ukjente felt");
      const requiredPayloadBooleans = [
        payload.containsSensitiveAccess,
        payload.manualConfirmedAccessRequested,
        payload.manualConfirmedAccess,
        payload.doNotApplyAutomatically,
      ];
      const requiredHistoryBooleans = [
        historicalConversation.accessInfoPresent,
        historicalConversation.accessSecretNotStored,
        historicalConversation.accessStoredInDedicatedField,
      ];
      const requiredEvidenceBooleans = [
        evidence.exactPhoneVerified,
        evidence.uniquePhoneMatch,
        evidence.containsSensitiveAccess,
        evidence.accessSecretNotStored,
        evidence.manualConfirmedAccess,
      ];
      if ([...requiredPayloadBooleans, ...requiredHistoryBooleans, ...requiredEvidenceBooleans]
        .some((value) => typeof value !== "boolean")) {
        blockers.push("Samtaleimportens kontrollmarkeringer har ugyldig format");
      }
      if (payload.manualConfirmedAccessRequested === false && payload.manualConfirmedAccess === true) {
        blockers.push("Samtaleimporten mangler eksplisitt manuell bekreftelse");
      }
      if (!manualAccessProposal) {
        if (Object.prototype.hasOwnProperty.call(payload, "accessNoteTarget")
          || Object.prototype.hasOwnProperty.call(payload, "auditExcludesAccessSecret")) {
          blockers.push("Standardimport kan ikke inneholde felt som er reservert for manuelt adgangsforslag");
        }
        if (!Object.prototype.hasOwnProperty.call(evidence, "accessNoteTarget")
          || evidence.accessNoteTarget !== null
          || evidence.exactPhoneVerified !== false
          || evidence.uniquePhoneMatch !== false
          || evidence.matchedPhone !== null) {
          blockers.push("Standardimport kan ikke inneholde manuelle telefon- eller adgangsbevis");
        }
      }
      if (historicalConversation.accessStoredInDedicatedField !== manualAccessProposal
        || (manualAccessProposal && historicalConversation.accessSecretNotStored !== false)
        || historicalConversation.matchStatus !== evidence.matchStatus) {
        blockers.push("Samtaleimportens kontrollmarkeringer stemmer ikke med forslaget");
      }
      const accessTopicPresent = Array.isArray(historicalConversation.topicLabels)
        && historicalConversation.topicLabels.includes("adgangsinformasjon markert som sensitiv");
      if (accessTopicPresent !== (historicalConversation.accessInfoPresent === true)) {
        blockers.push("Samtaleimportens temamerking stemmer ikke med sensitivitetsmarkeringen");
      }
      if (String(action.title || "") !== "Historisk SMS - kundehistorikk") blockers.push("Samtaleimportens tittel er endret eller inneholder rå tekst");
      const expectedSummary = historicalConversationSummary(historicalConversation);
      const expectedBody = historicalConversationImportBody(expectedSummary, payload.containsSensitiveAccess === true, manualAccessProposal);
      if (!expectedSummary || historicalConversation.summary !== expectedSummary) {
        blockers.push("Samtalesammendraget følger ikke det sikre formatet");
      }
      if (String(action.body || "") !== expectedBody) blockers.push("Samtaleimportens sammendragstekst er endret eller inneholder rå tekst");
      if (payload.containsSensitiveAccess !== (historicalConversation.accessInfoPresent === true)) {
        blockers.push("Samtaleimportens sensitivitetsmarkering stemmer ikke");
      }
      if (evidence.source !== "historical_sms" || evidence.provider !== "google_messages") blockers.push("Samtaleimporten mangler fast kildeangivelse");
      if (!new Set(["exact_phone", "crm_customer_id", "manual_confirmed", "customer_card", "unknown", "fuzzy_name"]).has(String(evidence.matchMethod || ""))) {
        blockers.push("Samtaleimporten har ukjent matchmetode");
      }
      if (!new Set(["exact", "uncertain"]).has(String(evidence.matchStatus || ""))) blockers.push("Samtaleimporten har ukjent matchstatus");
      const evidenceConfidence = evidence.matchConfidence;
      if (evidenceConfidence !== null && (!Number.isFinite(Number(evidenceConfidence)) || Number(evidenceConfidence) < 0 || Number(evidenceConfidence) > 1)) {
        blockers.push("Samtaleimporten har ugyldig matchscore");
      }
      if (evidence.containsSensitiveAccess !== payload.containsSensitiveAccess
        || evidence.accessSecretNotStored !== historicalConversation.accessSecretNotStored
        || evidence.manualConfirmedAccess !== manualAccessProposal
        || String(evidence.accessNoteTarget || "") !== String(payload.accessNoteTarget || "")) {
        blockers.push("Samtaleimportens bevisfelter stemmer ikke med forslaget");
      }
      const evidenceCustomerId = String(evidence.matchedCustomerId || "");
      const evidenceCustomerIdValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidenceCustomerId);
      if ((evidence.matchStatus === "exact" && (!evidenceCustomerIdValid || evidenceCustomerId !== String(linkedCustomerId || "")))
        || (evidence.matchStatus === "uncertain" && evidence.matchedCustomerId !== null)) {
        blockers.push("Samtaleimportens kundebevis stemmer ikke med koblingen");
      }
      if (typeof evidence.exactPhoneVerified !== "boolean"
        || typeof evidence.uniquePhoneMatch !== "boolean"
        || (evidence.matchedPhone !== null && !/^\d{8}$/.test(String(evidence.matchedPhone || "")))) {
        blockers.push("Samtaleimportens telefonbevis har ugyldig format");
      }
      if (evidence.exactPhoneVerified !== evidence.uniquePhoneMatch
        || (evidence.uniquePhoneMatch === true) !== /^\d{8}$/.test(String(evidence.matchedPhone || ""))) {
        blockers.push("Samtaleimportens telefonbevis stemmer ikke med unik telefonmatch");
      }
      if (Number(evidence.messageCount) !== Number(historicalConversation.messageCount)) blockers.push("Samtaleimportens meldingstall stemmer ikke");
      if (String(payload.sourceDate || "") !== String(historicalConversation.lastMessageDate || "")
        || String(evidence.sourceDate || "") !== String(historicalConversation.lastMessageDate || "")) {
        blockers.push("Samtaleimportens kildedato stemmer ikke");
      }
      if (looksLikeConversationTranscript(action.title) || looksLikeConversationTranscript(action.body)) {
        blockers.push("Rå SMS-dialog kan ikke lagres i tittel eller sammendrag");
      }
      const expectedSourceRef = manualAccessProposal
        ? /^google_messages:([a-f0-9]{16}):([a-f0-9]{16}):manual-access$/
        : /^google_messages:([a-f0-9]{16}):([a-f0-9]{16})$/;
      const sourceRefMatch = actionSourceRef.match(expectedSourceRef);
      if (!sourceRefMatch || String(evidence.sourceRef || "") !== actionSourceRef) {
        blockers.push("Samtaleimporten mangler en gyldig generert kilde-ID");
      } else if (
        String(evidence.conversationFingerprint || "") !== sourceRefMatch[1]
        || String(evidence.contentFingerprint || "") !== sourceRefMatch[2]
        || String(historicalConversation.sourceFingerprint || "") !== sourceRefMatch[2]
      ) {
        blockers.push("Samtaleimportens kildefingeravtrykk stemmer ikke");
      }
      const expectedIdempotencyKey = actionSourceRef.replace(/^google_messages:/, "historical_sms:");
      if (actionIdempotencyKey !== expectedIdempotencyKey) {
        blockers.push("Samtaleimporten mangler en gyldig generert lagringsnøkkel");
      }
    }
    if (isLegacyEnrichment) {
      const allowedPayloadKeys = new Set(["sourceDate", "findingTypes", "proposedChanges", "containsSensitiveAccess", "doNotApplyAutomatically"]);
      const allowedProposedKeys = new Set([
        "lastServiceDate",
        "serviceEvidence",
        "serviceResponse",
        "followUpNeeded",
        "gpsCoordinates",
        "accessInfoPresent",
        "accessSecretNotStored",
      ]);
      const allowedEvidenceKeys = new Set(["source", "sourceDate", "sourceRef", "containsSensitiveAccess"]);
      const allowedFindingTypes = new Set([
        "service_completed_candidate",
        "service_accepted",
        "service_timing_declined",
        "service_declined",
        "coordinates",
        "access_information",
      ]);
      const hasUnknownLegacyField = Object.keys(payload).some((key) => !allowedPayloadKeys.has(key))
        || Object.keys(proposedChanges).some((key) => !allowedProposedKeys.has(key))
        || Object.keys(evidence).some((key) => !allowedEvidenceKeys.has(key))
        || payload.findingTypes.some((type) => !allowedFindingTypes.has(String(type || "")));
      if (hasUnknownLegacyField) blockers.push("Historisk SMS-funn inneholder rå eller ukjente felt");
      const findingTypes = payload.findingTypes.map((type) => String(type || ""));
      const findingSet = new Set(findingTypes);
      const hasOwn = (key) => Object.prototype.hasOwnProperty.call(proposedChanges, key);
      const validDate = (value) => {
        const text = String(value || "");
        if (!/^20\d{2}-\d{2}-\d{2}$/.test(text)) return false;
        const date = new Date(`${text}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
      };
      if (findingTypes.length < 1 || findingSet.size !== findingTypes.length) blockers.push("Historisk SMS-funn har ugyldig funnliste");
      if (!validDate(payload.sourceDate) || payload.doNotApplyAutomatically !== true || typeof payload.containsSensitiveAccess !== "boolean") {
        blockers.push("Historisk SMS-funn har ugyldige kontrollverdier");
      }
      const serviceFindings = findingTypes.filter((type) => type.startsWith("service_"));
      if (serviceFindings.length > 1) blockers.push("Historisk SMS-funn har motstridende serviceverdier");
      if (findingSet.has("service_completed_candidate")) {
        if (proposedChanges.serviceEvidence !== "completed_candidate"
          || proposedChanges.lastServiceDate !== payload.sourceDate
          || hasOwn("serviceResponse")
          || hasOwn("followUpNeeded")) {
          blockers.push("Historisk SMS-funn har ugyldige verdier for mulig utført service");
        }
      } else if (findingSet.has("service_accepted")) {
        if (proposedChanges.serviceResponse !== "accepted"
          || proposedChanges.followUpNeeded !== true
          || hasOwn("lastServiceDate")
          || hasOwn("serviceEvidence")) {
          blockers.push("Historisk SMS-funn har ugyldige verdier for servicesvar");
        }
      } else if (findingSet.has("service_timing_declined")) {
        if (proposedChanges.serviceResponse !== "timing_declined"
          || proposedChanges.followUpNeeded !== true
          || hasOwn("lastServiceDate")
          || hasOwn("serviceEvidence")) {
          blockers.push("Historisk SMS-funn har ugyldige verdier for servicesvar");
        }
      } else if (findingSet.has("service_declined")) {
        if (proposedChanges.serviceResponse !== "declined"
          || proposedChanges.followUpNeeded !== false
          || hasOwn("lastServiceDate")
          || hasOwn("serviceEvidence")) {
          blockers.push("Historisk SMS-funn har ugyldige verdier for servicesvar");
        }
      } else if (["lastServiceDate", "serviceEvidence", "serviceResponse", "followUpNeeded"].some(hasOwn)) {
        blockers.push("Historisk SMS-funn har serviceverdier uten servicefunn");
      }
      if (findingSet.has("coordinates")) {
        const gpsCoordinates = String(proposedChanges.gpsCoordinates || "");
        if (!gpsCoordinates || coordinatesFromText(gpsCoordinates) !== gpsCoordinates) blockers.push("Historisk SMS-funn har ugyldig koordinatverdi");
      } else if (hasOwn("gpsCoordinates")) {
        blockers.push("Historisk SMS-funn har koordinater uten koordinatfunn");
      }
      if (findingSet.has("access_information")) {
        if (proposedChanges.accessInfoPresent !== true
          || typeof proposedChanges.accessSecretNotStored !== "boolean"
          || payload.containsSensitiveAccess !== proposedChanges.accessSecretNotStored) {
          blockers.push("Historisk SMS-funn har ugyldige adgangsmarkeringer");
        }
      } else if (hasOwn("accessInfoPresent") || hasOwn("accessSecretNotStored") || payload.containsSensitiveAccess !== false) {
        blockers.push("Historisk SMS-funn har adgangsmarkering uten adgangsfunn");
      }
      if (String(action.title || "") !== "Historisk SMS - kundedatafunn") blockers.push("Historisk SMS-funn har endret eller rå tittel");
      if (String(action.body || "") !== legacyHistoricalEnrichmentBody(payload)) blockers.push("Historisk SMS-funn har endret eller rå sammendragstekst");
      if (evidence.source !== "historical_sms"
        || String(evidence.sourceDate || "") !== String(payload.sourceDate || "")
        || evidence.containsSensitiveAccess !== payload.containsSensitiveAccess) {
        blockers.push("Historisk SMS-funn har ugyldige bevisfelter");
      }
      if (!isSafeLegacyHistoricalSourceRef(actionSourceRef) || String(evidence.sourceRef || "") !== actionSourceRef) {
        blockers.push("Historisk SMS-funn mangler en trygg generert kilde-ID");
      }
      const intakeIdempotency = /^intake:[0-9a-f-]{36}$/i.test(actionSourceRef)
        && new RegExp(`^${actionSourceRef}:customer_enrichment:[A-Za-z0-9._-]{1,40}$`, "i").test(actionIdempotencyKey);
      const googleMessagesIdempotency = /^historical_sms:GM:[a-f0-9]{16}:20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:customer_enrichment:[A-Za-z0-9._-]{1,40}$/i
        .test(actionIdempotencyKey)
        && actionIdempotencyKey.startsWith(`historical_sms:${actionSourceRef}:customer_enrichment:`);
      if (!intakeIdempotency && !googleMessagesIdempotency) blockers.push("Historisk SMS-funn mangler en trygg generert lagringsnøkkel");
      if (looksLikeConversationTranscript(action.title) || looksLikeConversationTranscript(action.body)) {
        blockers.push("Rå SMS-dialog kan ikke lagres i et historisk SMS-funn");
      }
    }
    if (hasAccessNoteProposal && !manualAccessProposal) blockers.push("Adgangsnotat krever eksplisitt manuell bekreftelse");
    if (manualAccessProposal) {
      if (!/^Historisk SMS - [^\r\n]{1,120}$/.test(String(action.title || ""))
        || /\b(?:\d[\s-]?){3,8}\b/.test(String(action.title || ""))) {
        blockers.push("Adgangsforslagets tittel inneholder ugyldig eller sensitiv fritekst");
      }
      if (!hasAccessNoteProposal || !accessNoteProposal.valid) blockers.push("Adgangsforslaget er ikke et avgrenset adkomstnotat");
      if (!linkedCustomerId) blockers.push("Manuell adgangsimport mangler eksakt kundekobling");
      if (payload.manualConfirmedAccessRequested !== true || evidence.manualConfirmedAccess !== true) {
        blockers.push("Adgangsforslaget mangler eksplisitt manuell bekreftelse");
      }
      if (String(payload.historicalConversation?.matchStatus || "") !== "exact" || String(evidence.matchStatus || "") !== "exact") {
        blockers.push("Manuell adgangsimport krever eksakt kundematch");
      }
      if (evidence.matchMethod !== "exact_phone"
        || Number(evidence.matchConfidence) < 0.95
        || evidence.exactPhoneVerified !== true
        || evidence.uniquePhoneMatch !== true
        || !/^\d{8}$/.test(String(evidence.matchedPhone || ""))) {
        blockers.push("Manuell adgangsimport krever verifisert eksakt telefonmatch");
      }
      if (!linkedCustomerId || String(evidence.matchedCustomerId || "") !== String(linkedCustomerId)) {
        blockers.push("Adgangsforslaget er ikke koblet til den eksakt matchede kunden");
      }
      if (payload.historicalConversation?.accessStoredInDedicatedField !== true) {
        blockers.push("Adgangsforslaget mangler markering for dedikert adkomstfelt");
      }
      if (payload.accessNoteTarget !== "access_note" || evidence.accessNoteTarget !== "access_note") {
        blockers.push("Adgangsforslaget peker ikke på kundens dedikerte adkomstfelt");
      }
      if (payload.auditExcludesAccessSecret !== true) blockers.push("Historikknotatet må utelate adgangskoden");
      if (action.approval_required !== true && action.approvalRequired !== true) blockers.push("Manuell adgangsimport krever eksplisitt godkjenning");
    }
    const outsideDedicatedAccess = accessEvidence(safetyTextWithoutDedicatedAccess);
    if (manualAccessProposal ? outsideDedicatedAccess.hasAccessInfo : outsideDedicatedAccess.containsSecret) {
      blockers.push(manualAccessProposal
        ? "Adgangsdetaljer kan bare finnes i det dedikerte adkomstforslaget"
        : "En mulig adgangskode kan ikke lagres i SMS-importen");
    }
    const sensitiveAccessMarked = payload.containsSensitiveAccess === true
      || payload.historicalConversation?.accessInfoPresent === true
      || payload.historicalConversation?.accessSecretNotStored === true;
    if (sensitiveAccessMarked && blockersValue.length === 0 && !manualAccessProposal) blockers.push("Sensitiv adgangsinformasjon må ha kontrollsperre");
    if (String(evidence.matchStatus || "") === "uncertain" && linkedCustomerId) blockers.push("Usikker kundematch kan ikke kobles automatisk");
    return { allowed: blockers.length === 0, blockers: [...new Set(blockers)] };
  }

  function serviceEvidence(context = {}) {
    const message = normalize(relevantMessageText(context));
    const type = normalize(context.draft?.type || context.analysis?.intent?.category || "");
    const serviceContext = /\bservice|rens|vedlikehold\b/.test(message) || /service/.test(type);
    if (!serviceContext) return { kind: "none", messageDate: sourceDate(context) };
    const completed = /\bservice(?:n)?\s+(?:er\s+|ble\s+)?(?:utfort|gjennomfort|ferdig)|\btakk\s+for\s+(?:god\s+)?service|\bhar\s+vaert\s+og\s+tatt\s+service|\bservice\s+ble\s+tatt\b/.test(message);
    const timingDeclined = /\bpasser\s+ikke|\bkan\s+ikke\s+den|\bikke\s+den\s+dagen|\bikke\s+hjemme|\bma\s+flytte|\bannen\s+dag|\bsenere\s+tidspunkt/.test(message);
    const declined = /\bnei\s+takk|\bonsker\s+ikke|\bikke\s+interessert|\bikke\s+behov|\bstar\s+over/.test(message);
    const accepted = /\bja\s+takk|\bdet\s+passer|\bgjerne|\bonsker\s+service|\bkan\s+komme|\bdet\s+er\s+greit|^ja\b/.test(message);
    const kind = completed
      ? "service_completed_candidate"
      : timingDeclined
        ? "service_timing_declined"
        : declined
          ? "service_declined"
          : accepted
            ? "service_accepted"
            : "none";
    return { kind, messageDate: sourceDate(context) };
  }

  function buildHistoricalSmsEnrichment(context = {}) {
    if (sourceChannel(context) !== "sms") return { relevant: false, actionType: "customer_enrichment" };
    const message = relevantMessageText(context);
    const service = serviceEvidence(context);
    const access = accessEvidence(message);
    const coordinates = coordinatesFromText(message);
    const relevant = service.kind !== "none" || access.hasAccessInfo || Boolean(coordinates);
    if (!relevant) return { relevant: false, actionType: "customer_enrichment" };

    const customer = context.customer || {};
    const installationCount = Number(context.installationCount || 0);
    const blockers = [];
    const summaries = [];
    const proposedChanges = {};

    if (!customer.id) blockers.push("Mangler entydig kundekobling");
    if (service.kind === "service_completed_candidate") {
      summaries.push(service.messageDate
        ? `SMS tyder på at service ble utført ${service.messageDate}.`
        : "SMS tyder på at service ble utført, men datoen mangler.");
      proposedChanges.lastServiceDate = service.messageDate || null;
      proposedChanges.serviceEvidence = "completed_candidate";
      blockers.push("Kontroller mot ferdig jobb eller faktura før siste service oppdateres");
      if (!service.messageDate) blockers.push("Mangler sikker servicedato");
      if (installationCount > 1) blockers.push("Velg hvilket anlegg servicen gjelder");
    } else if (service.kind === "service_accepted") {
      summaries.push("Kunden takket ja til service. Dette er ikke bevis på at service ble utført.");
      proposedChanges.serviceResponse = "accepted";
      proposedChanges.followUpNeeded = true;
    } else if (service.kind === "service_timing_declined") {
      summaries.push("Foreslått tidspunkt passet ikke. Kunden bør fortsatt kunne få et nytt forslag.");
      proposedChanges.serviceResponse = "timing_declined";
      proposedChanges.followUpNeeded = true;
    } else if (service.kind === "service_declined") {
      summaries.push("Kunden avslo service. Ikke bruk dette som permanent kontaktreservasjon uten tydelig beskjed.");
      proposedChanges.serviceResponse = "declined";
      proposedChanges.followUpNeeded = false;
    }

    if (coordinates) {
      summaries.push("Koordinater ble funnet i SMS og må kartkontrolleres før lagring.");
      proposedChanges.gpsCoordinates = coordinates;
      blockers.push("Kontroller koordinatene mot riktig anleggsadresse");
    }
    if (access.hasAccessInfo) {
      proposedChanges.accessInfoPresent = true;
      proposedChanges.accessSecretNotStored = access.containsSecret;
      summaries.push(access.containsSecret
        ? "Sikker tilkomstinformasjon finnes i original SMS. Selve koden er ikke kopiert til forslaget."
        : "Tilkomstinformasjon finnes i SMS og må kontrolleres før lagring.");
      blockers.push(access.containsSecret
        ? "Åpne original SMS ved behov; adgangskoden er med vilje ikke lagret"
        : "Kontroller at tilkomstinformasjonen fortsatt gjelder");
    }

    const legacyPayload = {
      sourceDate: service.messageDate || sourceDate(context) || null,
      findingTypes: [service.kind, coordinates ? "coordinates" : "", access.hasAccessInfo ? "access_information" : ""].filter((item) => item && item !== "none"),
      proposedChanges,
      containsSensitiveAccess: access.containsSecret,
      doNotApplyAutomatically: true,
    };

    return {
      relevant: true,
      actionType: "customer_enrichment",
      title: "Historisk SMS - kundedatafunn",
      body: legacyHistoricalEnrichmentBody(legacyPayload),
      confidence: service.kind === "service_completed_candidate" ? 0.72 : coordinates ? 0.82 : 0.78,
      blockers,
      payload: legacyPayload,
      evidence: {
        source: "historical_sms",
        sourceDate: service.messageDate || sourceDate(context) || null,
        containsSensitiveAccess: access.containsSecret,
      },
      needsReview: true,
    };
  }

  function buildEnrichmentApproval(action = {}) {
    const payload = action.payload_json || action.payload || {};
    const actionEvidence = action.evidence_json || action.evidence || {};
    const proposed = payload.proposedChanges && typeof payload.proposedChanges === "object"
      ? payload.proposedChanges
      : {};
    const historicalConversation = payload.historicalConversation && typeof payload.historicalConversation === "object" && !Array.isArray(payload.historicalConversation)
      ? payload.historicalConversation
      : null;
    const isHistoricalConversation = proposed.historicalConversation === "summary_only" && Boolean(historicalConversation);
    const manualAccessProposal = isHistoricalConversation && payload.manualConfirmedAccess === true;
    const hasHistoricalSmsMarker = isHistoricalConversation
      || Array.isArray(payload.findingTypes)
      || Object.prototype.hasOwnProperty.call(payload, "manualConfirmedAccess")
      || Object.prototype.hasOwnProperty.call(payload, "manualConfirmedAccessRequested")
      || Object.prototype.hasOwnProperty.call(payload, "accessNoteTarget")
      || Object.prototype.hasOwnProperty.call(payload, "auditExcludesAccessSecret")
      || Object.prototype.hasOwnProperty.call(proposed, "access_note")
      || Object.prototype.hasOwnProperty.call(actionEvidence, "accessNoteTarget")
      || Object.prototype.hasOwnProperty.call(actionEvidence, "exactPhoneVerified")
      || Object.prototype.hasOwnProperty.call(actionEvidence, "uniquePhoneMatch")
      || Object.prototype.hasOwnProperty.call(actionEvidence, "matchedPhone")
      || actionEvidence.source === "historical_sms"
      || actionEvidence.provider === "google_messages";
    const accessNoteProposal = controlledAccessNote(proposed.access_note);
    const blockers = Array.isArray(action.blockers_json || action.blockers)
      ? [...(action.blockers_json || action.blockers)]
      : [];
    const serviceResponse = String(proposed.serviceResponse || "").trim();
    const sourceDateValue = String(payload.sourceDate || action.evidence_json?.sourceDate || action.evidence?.sourceDate || "").trim();
    const sourceRef = String(action.source_ref || action.sourceRef || "").trim();
    const sourceDate = /^20\d{2}-\d{2}-\d{2}$/.test(sourceDateValue)
      ? new Date(`${sourceDateValue}T00:00:00Z`)
      : null;
    const hasValidSourceDate = sourceDate
      && !Number.isNaN(sourceDate.getTime())
      && sourceDate.toISOString().slice(0, 10) === sourceDateValue;
    const specificallyBlockedFields = new Set([
      "lastServiceDate",
      "serviceEvidence",
      "gpsCoordinates",
      "accessInfoPresent",
      "accessSecretNotStored",
    ]);
    const safeFields = new Set(["serviceResponse", "followUpNeeded", "historicalConversation"]);
    if (manualAccessProposal) safeFields.add("access_note");
    const hasUnknownFields = Object.keys(proposed).some((key) => !safeFields.has(key) && !specificallyBlockedFields.has(key));
    const allowedHistoryFields = new Set([
      "summary",
      "messageCount",
      "firstMessageDate",
      "lastMessageDate",
      "topicLabels",
      "accessInfoPresent",
      "accessSecretNotStored",
      "accessStoredInDedicatedField",
      "sourceFingerprint",
      "matchStatus",
    ]);
    const hasUnknownHistoryFields = historicalConversation
      ? Object.keys(historicalConversation).some((key) => !allowedHistoryFields.has(key))
      : false;
    const historySummary = String(historicalConversation?.summary || "").trim();
    const expectedHistorySummary = historicalConversationSummary(historicalConversation || {});
    const historyMessageCount = Number(historicalConversation?.messageCount);
    const historyLastMessageDate = String(historicalConversation?.lastMessageDate || "").trim();
    const historySummaryContainsSecret = accessEvidence(JSON.stringify(historicalConversation || {})).containsSecret;
    const historyEvent = isHistoricalConversation ? {
      eventType: manualAccessProposal ? "Historisk SMS-samtale - adkomst kontrollert" : "Historisk SMS-samtale",
      note: manualAccessProposal
        ? `${historySummary} Den sensitive opplysningen ble etter kontroll lagret i kundens eget felt og er ikke gjentatt her.`
        : `${historySummary} Bare sammendrag og kilde-ID er lagret; original meldingstekst er ikke kopiert.`,
    } : null;
    const safeResponses = {
      accepted: {
        eventType: "Historisk SMS - service ja",
        note: "Kunden takket ja til service. Service er ikke registrert som utført.",
      },
      timing_declined: {
        eventType: "Historisk SMS - nytt tidspunkt",
        note: "Foreslått servicetid passet ikke. Kunden kan fortsatt få et nytt forslag.",
      },
      declined: {
        eventType: "Historisk SMS - service avslått",
        note: "Kunden avslo service. Dette er ikke registrert som permanent kontaktreservasjon.",
      },
    };

    if (String(action.action_type || action.actionType || "") !== "customer_enrichment") blockers.push("Forslaget er ikke et kundedataforslag");
    if (String(action.source_kind || action.sourceKind || "") === "historical_sms" || hasHistoricalSmsMarker) {
      const safety = historicalSmsActionSafety(action);
      blockers.push(...(safety.blockers || []));
    }
    if (!action.linked_customer_id && !action.customerId) blockers.push("Mangler entydig kundekobling");
    if (!sourceRef) blockers.push("Mangler stabil kilde-ID");
    if (!safeResponses[serviceResponse] && !isHistoricalConversation) blockers.push("Forslaget kan ikke lagres automatisk som historikk");
    if (!isHistoricalConversation && safeResponses[serviceResponse] && !isSafeLegacyHistoricalSourceRef(sourceRef)) {
      blockers.push("Historisk SMS-funn mangler en trygg generert kilde-ID");
    }
    if (!hasValidSourceDate) blockers.push("Mangler sikker kildedato");
    if (proposed.lastServiceDate) blockers.push("Siste servicedato krever manuell kontroll");
    if (proposed.gpsCoordinates) blockers.push("Koordinater krever kartkontroll");
    if ((proposed.accessInfoPresent || payload.containsSensitiveAccess) && !manualAccessProposal) blockers.push("Tilkomstinformasjon krever manuell kontroll");
    if (hasUnknownFields) blockers.push("Forslaget inneholder flere kundedata og krever manuell kontroll");
    if (isHistoricalConversation) {
      const sourceRefPattern = manualAccessProposal
        ? /^google_messages:[a-f0-9]{16}:[a-f0-9]{16}:manual-access$/
        : /^google_messages:[a-f0-9]{16}:[a-f0-9]{16}$/;
      if (historicalConversation.matchStatus !== "exact") blockers.push("Kundekoblingen er usikker og må kontrolleres");
      if (!Number.isInteger(historyMessageCount) || historyMessageCount < 1) blockers.push("Samtalesammendraget mangler gyldig meldingstall");
      if (!historySummary || historySummary.length > 600 || /[\r\n]/.test(historySummary)) blockers.push("Samtalesammendraget har ugyldig format");
      if (!expectedHistorySummary || historySummary !== expectedHistorySummary) blockers.push("Samtalesammendraget følger ikke det sikre formatet");
      if (accessEvidence(historySummary).hasAccessInfo || looksLikeConversationTranscript(historySummary)) {
        blockers.push("Samtalesammendraget kan ikke inneholde adgangsdetaljer eller rå SMS-dialog");
      }
      if (!sourceRefPattern.test(sourceRef) || String(action.evidence_json?.sourceRef || action.evidence?.sourceRef || "") !== sourceRef) {
        blockers.push("Samtaleimporten mangler en gyldig generert kilde-ID");
      }
      if (!historyLastMessageDate || historyLastMessageDate !== sourceDateValue) blockers.push("Samtaledatoen stemmer ikke med kildedatoen");
      if ((historicalConversation.accessInfoPresent || historicalConversation.accessSecretNotStored || historySummaryContainsSecret) && !manualAccessProposal) {
        blockers.push("Tilkomstinformasjon krever manuell kontroll");
      }
      if (hasUnknownHistoryFields) blockers.push("Samtaleimporten inneholder rå eller ukjente felt");
    }
    if (manualAccessProposal) {
      if (String(action.source_kind || action.sourceKind || "") !== "historical_sms") blockers.push("Adgangsforslaget mangler historisk SMS-kilde");
      if (!accessNoteProposal.valid) blockers.push("Adgangsforslaget er ikke et avgrenset adkomstnotat");
      if (payload.accessNoteTarget !== "access_note") blockers.push("Adgangsforslaget peker ikke på kundens dedikerte adkomstfelt");
      if (payload.auditExcludesAccessSecret !== true) blockers.push("Historikknotatet må utelate adgangskoden");
      if (historicalConversation.accessStoredInDedicatedField !== true) blockers.push("Adgangsforslaget mangler markering for dedikert adkomstfelt");
      if (String(action.status || "") !== "needs_review") blockers.push("Adgangsforslaget må ligge til kontroll");
      if (action.approval_required !== true && action.approvalRequired !== true) blockers.push("Adgangsforslaget krever eksplisitt godkjenning");
    }

    const uniqueBlockers = [...new Set(blockers.filter(Boolean))];
    const response = safeResponses[serviceResponse] || historyEvent;
    const allowed = uniqueBlockers.length === 0;
    return {
      allowed,
      blockers: uniqueBlockers,
      customerId: action.linked_customer_id || action.customerId || null,
      sourceRef,
      event: allowed && response ? {
        event_date: sourceDateValue,
        event_type: response.eventType,
        note: response.note,
      } : null,
      customerChanges: allowed && manualAccessProposal && accessNoteProposal.valid
        ? { access_note: accessNoteProposal.note }
        : {},
    };
  }

  function replySubject(intent) {
    if (intent.category === "quote_request") return "Oppfølging av forespørsel og tilbud";
    if (intent.category === "service_request") return "Service på varmepumpe";
    if (intent.category === "installation") return "Videre plan for varmepumpe";
    if (intent.category === "repair_request") return "Oppfølging av varmepumpe";
    if (intent.category === "inspection_request") return "Oppfølging etter befaring";
    return "Oppfølging fra Numedal Varmepumpeservice";
  }

  function replyBody(context, intent, area, booking) {
    const contact = contactValues(context);
    const greeting = firstName(contact.name) ? `Hei ${firstName(contact.name)}` : "Hei";
    let body;
    if (intent.category === "service_request" && intent.explicitAcceptance) {
      body = `${greeting}\n\nTakk for bekreftelsen. Jeg samler servicejobber i samme område for å bruke dagen effektivt. Jeg finner en ledig dag i ${area.label.toLowerCase()} og sender et konkret forslag til dag og tidsvindu før noe bookes.`;
    } else if (intent.category === "service_request") {
      body = `${greeting}\n\nTakk for meldingen. Vi kan hjelpe med service på varmepumpen. Bekreft gjerne at du ønsker service, og send merke/modell og anleggsadresse hvis dette mangler. Deretter foreslår jeg en dag når vi har flere jobber i samme område.`;
    } else if (intent.category === "installation" && intent.explicitAcceptance) {
      body = `${greeting}\n\nTakk for bekreftelsen. Jeg finner et ledig tidspunkt for montering og sender et konkret forslag før avtalen bookes. Oppgi gjerne anleggsadressen hvis den ikke allerede er avklart.`;
    } else if (intent.category === "installation") {
      body = `${greeting}\n\nTakk for henvendelsen. Jeg følger opp varmepumpen og monteringen. For å gi riktig tilbud trenger jeg anleggsadresse og gjerne bilder av ønsket plassering inne og ute dersom dette ikke allerede er sendt.`;
    } else if (intent.category === "quote_request") {
      body = `${greeting}\n\nTakk for forespørselen. Jeg lager et oversiktlig tilbud basert på valgt varmepumpe, montering og eventuelle tillegg. Send gjerne anleggsadresse og bilder av plasseringen inne og ute hvis dette mangler.`;
    } else if (intent.category === "repair_request") {
      body = `${greeting}\n\nTakk for meldingen. Send gjerne merke/modell, en kort beskrivelse av feilen og eventuelle feilkoder eller bilder. Da kan vi vurdere neste steg før vi avtaler tid.`;
    } else if (intent.category === "inspection_request") {
      body = `${greeting}\n\nTakk for oppfølgingen. Jeg går gjennom notatene fra befaringen og kommer tilbake med tilbud eller et konkret forslag til neste steg.`;
    } else {
      body = `${greeting}\n\nTakk for meldingen. Jeg har registrert den og følger opp med et konkret svar eller forslag til neste steg.`;
    }
    return `${body}\n\nMvh\nGunnar\nNumedal Varmepumpeservice\n934 36 855`;
  }

  function buildIntakeSuggestion(context = {}) {
    const analysis = context.analysis || context.draft?.analysis || context.row?.analysis_json || {};
    const expanded = { ...context, analysis };
    const channel = sourceChannel(expanded);
    const contact = contactValues(expanded);
    const intent = intentValues(expanded);
    const area = areaFromContext(expanded);
    const booking = bookingKind(expanded);
    const recipient = channel === "email" ? contact.email : channel === "sms" ? contact.phone : "";
    const blockers = [];
    if (!recipient) blockers.push("Mangler mottaker for valgt kanal");
    if (booking.type !== "oppfolging" && area.needsClarification) blockers.push("Område eller anleggsadresse må avklares");
    if (booking.type !== "oppfolging" && !intent.explicitAcceptance) blockers.push("Kunden må bekrefte før booking");
    const relevantBooking = booking.type !== "oppfolging";
    const reply = {
      actionType: channel === "sms" ? "sms_reply" : "email_reply",
      channel,
      recipient,
      subject: channel === "email" ? replySubject(intent) : "",
      body: replyBody(expanded, intent, area, booking),
      confidence: recipient ? (analysis?.warnings?.length ? 0.72 : 0.86) : 0.55,
      blockers: blockers.filter((item) => !/booking/i.test(item)),
      needsReview: true,
    };
    const planning = {
      actionType: "booking_proposal",
      relevant: relevantBooking,
      allowedToBook: relevantBooking && intent.explicitAcceptance && !area.needsClarification,
      customerAccepted: intent.explicitAcceptance,
      jobType: booking.type,
      jobLabel: booking.label,
      durationMinutes: booking.durationMinutes,
      maxPerDay: booking.maxPerDay,
      areaKey: area.key,
      areaLabel: area.label,
      resourceSuggestion: "Ledig aktiv tekniker",
      rule: booking.type === "service"
        ? "Samle opptil 8 servicer samme dag bare når adressene ligger i samme eller nærliggende område."
        : booking.type === "installasjon"
          ? "Planlegg normalt maks 2 installasjoner per dag og kontroller kjøretid."
          : "Kontroller eksisterende avtaler, kjøretid og nødvendig arbeidstid.",
      blockers,
      needsReview: true,
    };
    const enrichment = buildHistoricalSmsEnrichment(expanded);
    return {
      version: "2026-07-12-2",
      generatedAt: new Date().toISOString(),
      sourceChannel: channel,
      intent,
      reply,
      planning,
      enrichment,
    };
  }

  function buildInvoiceDraft(context = {}) {
    const customer = context.customer || {};
    const booking = context.booking || {};
    const order = context.order || {};
    const body = String(context.billingText || "").trim();
    const blockers = [];
    if (!String(customer.name || customer.display_name || "").trim()) blockers.push("Mangler kundenavn");
    if (!body || /mangler prislinjer/i.test(body)) blockers.push("Prislinjer må kontrolleres");
    return {
      version: "2026-07-12-1",
      actionType: "invoice_draft",
      channel: "internal",
      title: `Fakturautkast - ${String(customer.name || customer.display_name || "kunde").trim()}`,
      body,
      customerId: customer.id || null,
      orderId: order.id || null,
      jobId: order.job_id || order.jobId || null,
      payload: {
        createCustomerIfMissing: true,
        bookingId: booking.id || null,
        jobType: order.type || booking.type || null,
        billingStatusAfterDraft: "exported",
      },
      blockers,
      readyForApproval: blockers.length === 0,
      needsReview: true,
    };
  }

  const api = {
    areaFromContext,
    bookingKind,
    buildEnrichmentApproval,
    buildHistoricalSmsEnrichment,
    buildHistoricalSmsConversationImport,
    historicalSmsActionSafety,
    buildIntakeSuggestion,
    buildInvoiceDraft,
    contactValues,
    coordinatesFromText,
    intentValues,
    normalizeBookingProposal,
    serviceEvidence,
    sourceChannel,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NumedalAssistantCoordinator = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
