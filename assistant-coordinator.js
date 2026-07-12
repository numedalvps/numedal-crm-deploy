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
    return {
      version: "2026-07-12-1",
      generatedAt: new Date().toISOString(),
      sourceChannel: channel,
      intent,
      reply,
      planning,
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
    buildIntakeSuggestion,
    buildInvoiceDraft,
    contactValues,
    intentValues,
    sourceChannel,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NumedalAssistantCoordinator = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
