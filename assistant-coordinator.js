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
    const hasAccessInfo = /\b(adkomst|tilkomst|n(?:ø|o)kkel|n(?:ø|o)kkelboks(?:en)?|kode|kodeboks(?:en)?|d(?:ø|o)rkode|portkode|bomkode|under\s+matta|under\s+matten|legger\s+ut\s+n(?:ø|o)kkel)\b/i.test(text);
    const containsSecret = hasAccessInfo
      && /\b(?:kode|code|pin|n(?:ø|o)kkelboks(?:en)?|kodeboks(?:en)?|d(?:ø|o)rkode|portkode|bomkode)\b[^\n]{0,40}\b(?:\d[\s-]?){3,8}\b/i.test(text);
    return { hasAccessInfo, containsSecret };
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

    return {
      relevant: true,
      actionType: "customer_enrichment",
      title: `Historisk SMS - ${cleanContactName(customer.name || context.draft?.name || "kunde")}`,
      body: summaries.join(" "),
      confidence: service.kind === "service_completed_candidate" ? 0.72 : coordinates ? 0.82 : 0.78,
      blockers,
      payload: {
        sourceDate: service.messageDate || sourceDate(context) || null,
        findingTypes: [service.kind, coordinates ? "coordinates" : "", access.hasAccessInfo ? "access_information" : ""].filter((item) => item && item !== "none"),
        proposedChanges,
        containsSensitiveAccess: access.containsSecret,
        doNotApplyAutomatically: true,
      },
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
    const proposed = payload.proposedChanges && typeof payload.proposedChanges === "object"
      ? payload.proposedChanges
      : {};
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
    const safeFields = new Set(["serviceResponse", "followUpNeeded"]);
    const hasUnknownFields = Object.keys(proposed).some((key) => !safeFields.has(key) && !specificallyBlockedFields.has(key));
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
    if (!action.linked_customer_id && !action.customerId) blockers.push("Mangler entydig kundekobling");
    if (!sourceRef) blockers.push("Mangler stabil kilde-ID");
    if (!safeResponses[serviceResponse]) blockers.push("Forslaget kan ikke lagres automatisk som historikk");
    if (!hasValidSourceDate) blockers.push("Mangler sikker kildedato");
    if (proposed.lastServiceDate) blockers.push("Siste servicedato krever manuell kontroll");
    if (proposed.gpsCoordinates) blockers.push("Koordinater krever kartkontroll");
    if (proposed.accessInfoPresent || payload.containsSensitiveAccess) blockers.push("Tilkomstinformasjon krever manuell kontroll");
    if (hasUnknownFields) blockers.push("Forslaget inneholder flere kundedata og krever manuell kontroll");

    const uniqueBlockers = [...new Set(blockers.filter(Boolean))];
    const response = safeResponses[serviceResponse] || null;
    return {
      allowed: uniqueBlockers.length === 0,
      blockers: uniqueBlockers,
      customerId: action.linked_customer_id || action.customerId || null,
      sourceRef,
      event: response ? {
        event_date: sourceDateValue,
        event_type: response.eventType,
        note: `${response.note}${sourceRef ? ` Kilde-ID: ${sourceRef}.` : ""}`,
      } : null,
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
    buildIntakeSuggestion,
    buildInvoiceDraft,
    contactValues,
    coordinatesFromText,
    intentValues,
    serviceEvidence,
    sourceChannel,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NumedalAssistantCoordinator = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
