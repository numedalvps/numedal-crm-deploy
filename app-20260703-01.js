(function () {
  const rawData = window.CRM_DATA || { customers: [], invoices: [] };
  const limeEnrichment = window.CRM_LIME_ENRICHMENT || { records: [] };
  const limeInstallations = window.CRM_LIME_INSTALLATIONS || { records: [] };
  const store = window.NumedalStore || { isConfigured: false };
  const runtimeConfig = window.NUMEDAL_SUPABASE || {};
  const appEnv = runtimeConfig.appEnv || runtimeConfig.APP_ENV || "production";
  const demoEnabled = appEnv === "development" && (runtimeConfig.enableDemo === true || runtimeConfig.ENABLE_DEMO === true);
  const browserImportEnabled = appEnv === "development" && runtimeConfig.enableBrowserImport === true;
  const databaseUnavailableMessage = "CRM-et fikk ikke kontakt med databasen. Ingen endringer er lagret. Prøv igjen eller kontakt administrator.";
  const appPublicBaseUrl = "https://app.numedalvps.no/";
  const eaccountingDashboardUrl = "https://eaccounting.vismaonline.com/#/dashboard";

  function appPublicUrl(path = "/") {
    return new URL(path || "/", appPublicBaseUrl).href;
  }

  const users = {
    admin: { name: "Gunnar", role: "Admin", view: "dashboard", key: "admin", language: "nb", extraHelp: false, active: true },
    tech: { name: "Hubert", role: "Tekniker", view: "technician", key: "tech", language: "pl", extraHelp: true, active: false },
  };
  const supportedProfileLanguages = {
    nb: "Norsk",
    pl: "Polski",
  };
  const technicianCopy = {
    nb: {
      viewTitle: "Min dag",
      viewSubtitle: "Jobbene dine på mobil.",
      navDay: "Min dag",
      routeButton: "Åpne dagsrute",
      routeTitle: "Åpner dagens jobber som kjørerute i Google Maps.",
      intro: "Mobilvisning med ring, kart og ferdig-knapp.",
      heading: (name) => `${name || "Min"} sin dagsplan`,
      empty: (name) => `Ingen jobber for ${name || "deg"} denne dagen.`,
      helpTitle: "Slik bruker du jobbflyten",
      helpSteps: [
        "Start med Ring, Kart eller kundeinfo hvis du må sjekke adresse og adkomst.",
        "Når jobben er gjort, trykk Marker ferdig. Gunnar tar faktura og videre oppfølging.",
        "Legg inn kort notat eller bilder ved fullføring hvis noe må huskes.",
        "Hvis du ikke kommer inn eller jobben må avtales på nytt, trykk Må flyttes.",
      ],
      markDone: "Marker ferdig",
      done: "Utført",
      needsMove: "Må flyttes",
      doneTitle: "Jobben er markert utført. Kontakt admin hvis dette må angres.",
      moveTitle: "Marker at jobben må flyttes fordi kunden ikke var tilgjengelig eller dere ikke kom inn.",
      completionTitle: "Fullfør",
      completionHelp: "Sjekk at datoen stemmer, legg inn notat eller bilder hvis det trengs, og trykk Fullfør. Gunnar kontrollerer faktura og videre oppfølging.",
      noNextStep: "Ingen neste steg nå",
      cancel: "Avbryt",
      complete: "Fullfør",
    },
    pl: {
      viewTitle: "Mój dzień",
      viewSubtitle: "Twoje zlecenia na telefonie.",
      navDay: "Mój dzień",
      routeButton: "Otwórz trasę dnia",
      routeTitle: "Otwiera dzisiejsze zlecenia jako trasę w Google Maps.",
      intro: "Widok mobilny z telefonem, mapą i przyciskiem zakończenia.",
      heading: (name) => `Plan dnia - ${name || "technik"}`,
      empty: (name) => `Brak zleceń dla ${name || "Ciebie"} tego dnia.`,
      helpTitle: "Jak pracować ze zleceniem",
      helpSteps: [
        "Najpierw sprawdź adres, notatkę i dostęp. Użyj Ring, Kart lub otwórz kartę klienta.",
        "Po zakończeniu pracy naciśnij Gotowe. Gunnar zajmie się fakturą i dalszą obsługą.",
        "Dodaj krótką notatkę lub zdjęcia przy zakończeniu, jeśli coś jest ważne.",
        "Jeśli nie ma dostępu albo termin trzeba zmienić, naciśnij Przenieść.",
      ],
      markDone: "Gotowe",
      done: "Wykonane",
      needsMove: "Przenieść",
      doneTitle: "Zlecenie jest oznaczone jako wykonane. Skontaktuj się z Gunnarem, jeśli trzeba cofnąć.",
      moveTitle: "Użyj, jeśli klienta nie było, nie było dostępu albo trzeba ustalić nowy termin.",
      completionTitle: "Zakończ",
      completionHelp: "Sprawdź datę, dodaj krótką notatkę lub zdjęcia, jeśli trzeba, i naciśnij Zakończ. Gunnar sprawdzi fakturę i dalsze kroki.",
      noNextStep: "Bez kolejnego kroku teraz",
      cancel: "Anuluj",
      complete: "Zakończ",
    },
  };
  const hiddenDuplicateLimeIds = new Set(["2396394"]);
  const ignoredDuplicateEmails = new Set([
    "gunnarruthol@gmail.com",
    "numedalvps@gmail.com",
    "post@numedalvps.no",
    "gunnar@numedalvps.no",
  ]);
  const storage = {
    user: "numedalWebUser",
    bookings: "numedalWebBookings",
    orders: "numedalWebOrders",
    insulationCalc: "numedalWebInsulationCalc",
    crmSettings: "numedalWebCrmSettings",
    rememberLogin: "numedalRememberLogin",
    websiteSubmissionVisibleOverrides: "numedalWebsiteSubmissionVisibleOverrides",
    edits: "numedalWebCustomerEdits",
    leads: "numedalWebLeads",
    deleted: "numedalWebDeletedCustomers",
    doneJobs: "numedalWebDoneJobs",
  };
  const moreNavigationViews = ["routeplanner", "technician", "insulation", "settings"];
  const defaultRouteOrigin = {
    label: "Svene, 3622, Norge",
    point: { lat: 59.8, lon: 9.583 },
  };
  const knownPlacePoints = new Map([
    ["svene", defaultRouteOrigin.point],
    ["3622", defaultRouteOrigin.point],
    ["lampeland", { lat: 59.834, lon: 9.582 }],
    ["3623", { lat: 59.834, lon: 9.582 }],
    ["flesberg", { lat: 59.866, lon: 9.43 }],
    ["kongsberg", { lat: 59.668, lon: 9.65 }],
    ["blefjell", { lat: 59.84, lon: 9.28 }],
    ["veggli", { lat: 60.045, lon: 9.154 }],
    ["vegglifjell nord", { lat: 60.08, lon: 9.04 }],
    ["vegglifjell", { lat: 60.08, lon: 9.04 }],
    ["rodberg", { lat: 60.267, lon: 8.947 }],
    ["rødberg", { lat: 60.267, lon: 8.947 }],
    ["rollag", { lat: 59.984, lon: 9.294 }],
    ["fagerfjell", { lat: 59.77, lon: 9.25 }],
    ["skrim", { lat: 59.55, lon: 9.55 }],
  ]);
  const insulationDocuments = [
    {
      title: "Standard leveringsbetingelser",
      href: "./documents/isobygg/Standard leveringsbetingelser.pdf",
      note: "Vilkår, rigg, adkomst, strøm, HMS og fakturering.",
    },
    {
      title: "Produktdatablad Supafil Frame",
      href: "./documents/isobygg/Produktdatablad Supafil Frame.pdf",
      note: "Produktdata for Supafil Frame blåseisolering.",
    },
    {
      title: "SINTEF godkjennelse Supafil 33",
      href: "./documents/isobygg/Sintef godkjennelse for Supafil 33.pdf",
      note: "Teknisk godkjenning og egenskaper.",
    },
    {
      title: "Leiebetingelser industristøvsuger 15 hk",
      href: "./documents/isobygg/Leiebetingelser industristovsuger 15hk.pdf",
      note: "Egne vilkår og info for utleie av støvsuger, henger, slanger og ramper.",
    },
  ];
  const priceListDocument = {
    id: "price_list",
    title: "Prisoversikt Numedal Varmepumpeservice",
    href: "./documents/priser/Prisliste_Numedal_Varmepumpeservice.pdf",
    note: "Veiledende prisgrunnlag for standard montering og tilleggstjenester. Sist oppdatert 29. juni 2026.",
  };
  const offerDocuments = [priceListDocument];
  const heatPumpOfferItems = [
    { id: "panasonic_hz25_flagship_white", articleNo: "9101", brand: "Panasonic", label: "HZ25 Flagship Hvit 7.5kw", unit: "stk", price: 23990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "panasonic_hz25_flagship_graphite", articleNo: "9102", brand: "Panasonic", label: "HZ25 Flagship Graphite Grey 7.5kw", unit: "stk", price: 25590, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "panasonic_nz25_etherea_eco", articleNo: "9103", brand: "Panasonic", label: "NZ25 Etherea Eco 6.5kw", unit: "stk", price: 19990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "panasonic_z25_floor", articleNo: "9104", brand: "Panasonic", label: "Z25 Gulvmodell", unit: "stk", price: 24990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "fujitsu_norgespumpa_57_black", articleNo: "9105", brand: "Fujitsu", label: "Norgespumpa 5.7 Dempet Sort", unit: "stk", price: 23990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "fujitsu_norgespumpa_59_black_25990", articleNo: "9106", brand: "Fujitsu", label: "Norgespumpa 5.9 Dempet Sort", articleName: "Fujitsu Norgespumpa 5.9 Dempet Sort 25 990", unit: "stk", price: 25990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "fujitsu_norgespumpa_59_black_29990", articleNo: "9107", brand: "Fujitsu", label: "Norgespumpa 5.9 Dempet Sort", articleName: "Fujitsu Norgespumpa 5.9 Dempet Sort 29 990", unit: "stk", price: 29990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "fujitsu_extreme_floor_55", articleNo: "9108", brand: "Fujitsu", label: "Extreme Gulv 5.5", unit: "stk", price: 24990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "toshiba_signature_25", articleNo: "9109", brand: "Toshiba", label: "Signature 25", unit: "stk", price: 26990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "toshiba_signature_35", articleNo: "9110", brand: "Toshiba", label: "Signature 35", unit: "stk", price: 29490, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "toshiba_seiya_nordic_25", articleNo: "9111", brand: "Toshiba", label: "Seiya Nordic 25", unit: "stk", price: 16990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "toshiba_seiya_nordic_35", articleNo: "9112", brand: "Toshiba", label: "Seiya Nordic 35", unit: "stk", price: 17990, defaultQty: 1, kind: "heatpump", eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
  ];
  const jobPriceItems = [
    { id: "standard_installation", articleNo: "9201", label: "Standard montering", unit: "stk", price: 7490, defaultQty: 1, eaccountingType: "services", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "technician_hour", articleNo: "9202", label: "Timepris arbeid", unit: "time", price: 1150, defaultQty: 1, eaccountingType: "services", eaccountingUnit: "tim", eaccountingGroup: "CRM" },
    { id: "old_pump_removal", articleNo: "9203", label: "Demontering gammel pumpe inkl. gasstømming", unit: "stk", price: 1990, defaultQty: 1, eaccountingType: "services", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "no_show", articleNo: "9204", label: "Bomtur / avbrutt installasjon", unit: "stk", price: 1600, defaultQty: 1, eaccountingType: "services", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "wall_drill_simple", articleNo: "9205", label: "Enkel murboring", unit: "stk", price: 990, defaultQty: 1, eaccountingType: "services", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "trollflex", articleNo: "9301", label: "Trollflex rørgjennomføring", unit: "stk", price: 800, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "extra_pipe", articleNo: "9302", label: "Ekstra rør og signal-/strømkabel", unit: "m", price: 650, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "m", eaccountingGroup: "CRM" },
    { id: "connection_3m", articleNo: "9303", label: "Tilslutningskabel 3 meter", unit: "stk", price: 295, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "connection_7m", articleNo: "9304", label: "Tilslutningskabel 7 meter", unit: "stk", price: 495, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "connection_10m", articleNo: "9305", label: "Tilslutningskabel 10 meter", unit: "stk", price: 790, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "signal_cable_joint", articleNo: "9306", label: "Signalkabel skjøt", unit: "stk", price: 300, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "gas_pipe_joint", articleNo: "9307", label: "Gassrør skjøt 1/4-3/8 komplett", unit: "stk", price: 550, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "blind_sleeves", articleNo: "9308", label: "Blindehylser 1/4-3/8", unit: "stk", price: 300, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "extra_channel", articleNo: "9309", label: "PVC kanaler", unit: "m", price: 300, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "m", eaccountingGroup: "CRM" },
    { id: "pvc_bend", articleNo: "9310", label: "PVC 90° bend", unit: "stk", price: 180, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "pvc_wall_cap", articleNo: "9311", label: "PVC vegglokk", unit: "stk", price: 150, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "pvc_flex", articleNo: "9312", label: "PVC flexrør 600 mm", unit: "stk", price: 300, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "rubber_dampers", articleNo: "9313", label: "4 stk. standard gummidempere", unit: "sett", price: 500, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "masonry_brackets", articleNo: "9314", label: "Murbraketter 2 stk. vinkler", unit: "sett", price: 700, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "spring_dampers", articleNo: "9315", label: "4 stk. fjærdempere", unit: "sett", price: 990, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "damped_wall_stand", articleNo: "9316", label: "Dempet veggstativ", unit: "stk", price: 750, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "wood_wall_bracket", articleNo: "9317", label: "Dempet veggbrakett med fjærer for trevegg", unit: "stk", price: 1750, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "ground_stand", articleNo: "9318", label: "Markkonsoll", unit: "stk", price: 1870, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "low_wall_bracket", articleNo: "9319", label: "Spesialbrakett lav murvegg", unit: "stk", price: 990, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "stone_slabs", articleNo: "9320", label: "4 stk. steinheller til bakkestativ", unit: "sett", price: 990, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "heatpump_roof_white", articleNo: "9321", label: "Varmepumpetak hvit", unit: "stk", price: 1990, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "heatpump_roof_black", articleNo: "9322", label: "Varmepumpetak sort", unit: "stk", price: 1990, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "drip_pan_heated", articleNo: "9323", label: "Dryppanne komplett kit inkl. varmekabel", unit: "stk", price: 3990, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "heatpump_house_white", articleNo: "9324", label: "VPS90 hvit varmepumpehus", unit: "stk", price: 3990, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "heatpump_house_black", articleNo: "9325", label: "VPS90-K sort varmepumpehus", unit: "stk", price: 4290, defaultQty: 1, eaccountingType: "goods", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
    { id: "r32_refrigerant", articleNo: "9326", label: "Ekstra kjølemedium R32", unit: "g", price: 6, defaultQty: 100, eaccountingType: "goods", eaccountingUnit: "gr", eaccountingGroup: "CRM" },
    { id: "r410a_refrigerant", articleNo: "9327", label: "Ekstra kjølemedium R410A", unit: "g", price: 7.5, defaultQty: 100, eaccountingType: "goods", eaccountingUnit: "gr", eaccountingGroup: "CRM" },
    { id: "driving_km", articleNo: "9401", label: "Kjøretillegg", unit: "km", price: 15, defaultQty: 1, eaccountingType: "services", eaccountingUnit: "km", eaccountingGroup: "CRM" },
    { id: "service_heatpump", articleNo: "9402", label: "Service varmepumpe", unit: "stk", price: 2490, defaultQty: 1, eaccountingType: "services", eaccountingUnit: "stk", eaccountingGroup: "CRM" },
  ];
  const offerLinePresets = [
    { id: "heatpump_custom", label: "Varmepumpe/modell - skriv selv", unit: "stk", price: 0, defaultQty: 1 },
    ...heatPumpOfferItems,
    ...jobPriceItems,
  ];
  const rentalImages = [
    { title: "Industristøvsuger 15 hk", href: "./documents/isobygg/vac/industristovsuger-15hk.jpg" },
    { title: "Front", href: "./documents/isobygg/vac/industristovsuger-front.jpg" },
    { title: "Støvsuger med slange", href: "./documents/isobygg/vac/industristovsuger-med-slange.jpg" },
    { title: "152 mm sugeslange 20 m", href: "./documents/isobygg/vac/sugeslange-152mm-20m.jpg" },
    { title: "Aluminium lasterampe", href: "./documents/isobygg/vac/aluminium-lasterampe.jpg" },
  ];
  const rentalRates = {
    startup: 3000,
    perDay: 1800,
    vat: 0.25,
    equipmentValue: 160000,
  };
  const insulationCatalog = [
    { id: "wall-10", group: "Vegger", name: "Vegg nybygg 10 cm", unit: "m2", price: 110, thickness: 0.10, density: 26 },
    { id: "wall-15", group: "Vegger", name: "Vegg nybygg 15 cm", unit: "m2", price: 146, thickness: 0.15, density: 26 },
    { id: "wall-20", group: "Vegger", name: "Vegg nybygg 20 cm", unit: "m2", price: 166, thickness: 0.20, density: 26 },
    { id: "wall-25", group: "Vegger", name: "Vegg nybygg 25 cm", unit: "m2", price: 192, thickness: 0.25, density: 26 },
    { id: "wall-30", group: "Vegger", name: "Vegg nybygg 30 cm", unit: "m2", price: 245, thickness: 0.30, density: 30 },
    { id: "wall-35", group: "Vegger", name: "Vegg nybygg 35 cm", unit: "m2", price: 240, thickness: 0.35, density: 26 },
    { id: "loft-15", group: "Kaldloft", name: "Kaldloft 15 cm (innblåst 18 cm)", unit: "m2", price: 140, thickness: 0.15, density: 14.5 },
    { id: "loft-20", group: "Kaldloft", name: "Kaldloft 20 cm (innblåst 24 cm)", unit: "m2", price: 140, thickness: 0.20, density: 14.5 },
    { id: "loft-25", group: "Kaldloft", name: "Kaldloft 25 cm (innblåst 30 cm)", unit: "m2", price: 150, thickness: 0.25, density: 14.5 },
    { id: "loft-30", group: "Kaldloft", name: "Kaldloft 30 cm (innblåst 36 cm)", unit: "m2", price: 160, thickness: 0.30, density: 14.5 },
    { id: "loft-35", group: "Kaldloft", name: "Kaldloft 35 cm (innblåst 42 cm)", unit: "m2", price: 175, thickness: 0.35, density: 14.5 },
    { id: "loft-40", group: "Kaldloft", name: "Kaldloft 40 cm (innblåst 48 cm)", unit: "m2", price: 195, thickness: 0.40, density: 14.5 },
    { id: "loft-45", group: "Kaldloft", name: "Kaldloft 45 cm", unit: "m2", price: 215, thickness: 0.45, density: 14.5 },
    { id: "sloped-15", group: "Skråhimling", name: "Skråhimling 15 cm", unit: "m2", price: 156, thickness: 0.15, density: 26 },
    { id: "sloped-20", group: "Skråhimling", name: "Skråhimling 20 cm", unit: "m2", price: 177, thickness: 0.20, density: 26 },
    { id: "sloped-25", group: "Skråhimling", name: "Skråhimling 25 cm", unit: "m2", price: 198, thickness: 0.25, density: 26 },
    { id: "sloped-30", group: "Skråhimling", name: "Skråhimling 30 cm", unit: "m2", price: 213, thickness: 0.30, density: 26 },
    { id: "sloped-35", group: "Skråhimling", name: "Skråhimling 35 cm", unit: "m2", price: 265, thickness: 0.35, density: 26 },
    { id: "sloped-40", group: "Skråhimling", name: "Skråhimling 40 cm", unit: "m2", price: 280, thickness: 0.40, density: 26 },
    { id: "sloped-45", group: "Skråhimling", name: "Skråhimling 45 cm", unit: "m2", price: 312, thickness: 0.45, density: 26 },
    { id: "floor-15", group: "Etasjeskiller", name: "Etasjeskiller 15 cm", unit: "m2", price: 146, thickness: 0.15, density: 26 },
    { id: "floor-20", group: "Etasjeskiller", name: "Etasjeskiller 20 cm", unit: "m2", price: 166, thickness: 0.20, density: 26 },
    { id: "floor-25", group: "Etasjeskiller", name: "Etasjeskiller 25 cm", unit: "m2", price: 182, thickness: 0.25, density: 26 },
    { id: "floor-30", group: "Etasjeskiller", name: "Etasjeskiller 30 cm", unit: "m2", price: 192, thickness: 0.30, density: 26 },
    { id: "floor-35", group: "Etasjeskiller", name: "Etasjeskiller 35 cm", unit: "m2", price: 213, thickness: 0.35, density: 26 },
    { id: "floor-40", group: "Etasjeskiller", name: "Etasjeskiller 40 cm", unit: "m2", price: 250, thickness: 0.40, density: 23 },
    { id: "floor-45", group: "Etasjeskiller", name: "Etasjeskiller 45 cm", unit: "m2", price: 280, thickness: 0.45, density: 26 },
    { id: "concrete-15", group: "Påforing betong", name: "Påforing betong 15 cm", unit: "m2", price: 177, thickness: 0.15, density: 26 },
    { id: "concrete-20", group: "Påforing betong", name: "Påforing betong 20 cm", unit: "m2", price: 198, thickness: 0.20, density: 26 },
    { id: "retrofit-5-15", group: "Etterisolering", name: "Etterisolering inkl. hullboring 5-15 cm", unit: "m2", price: 260, thickness: 0.15, density: 26 },
    { id: "retrofit-15-25", group: "Etterisolering", name: "Etterisolering inkl. hullboring 15-25 cm", unit: "m2", price: 280, thickness: 0.25, density: 26 },
    { id: "kneewall", group: "Diverse", name: "Knevegg", unit: "m3", price: 615, density: 23 },
    { id: "gable", group: "Diverse", name: "Mønespisser", unit: "m3", price: 615, density: 23 },
    { id: "edge", group: "Diverse", name: "Dekkeforkanter", unit: "lm", price: 85 },
    { id: "fabric", group: "Annet", name: "Fiberduk", unit: "m2", price: 13.5, material: "fabric" },
    { id: "fabric-install", group: "Annet", name: "Fiberduk montering", unit: "m2", price: 25 },
  ];
  const insulationRates = {
    packageCost: 266,
    fabricCost: 8,
    indirectPercent: 26,
    manHour: 500,
    km: 35,
    toll: 500,
    rigPrep: 1500,
    rigExtra: 2000,
    rigLarge: 3000,
    packageWeight: 15.5,
    vat: 0.25,
  };

  let currentUser = null;
  let currentView = "dashboard";
  let selectedCustomerId = "";
  let currentCustomerFilter = "all";
  let currentSearch = "";
  let currentLeadFilter = "inbox_tab";
  let currentLeadInboxTab = "new";
  let currentLeadSearch = "";
  let selectedLeadId = "";
  let selectedWebsiteSubmissionId = "";
  let currentOrderFilter = "all";
  let currentOrderSearch = "";
  let selectedOrderId = "";
  let selectedOrderIds = new Set();
  let currentInsulationSearch = "";
  let currentInsulationCustomerId = "";
  let weekStart = startOfWeek(new Date());
  let planningMode = "week";
  let planningMonthCursor = new Date();
  let planningResourceFilter = "all";
  let editingCustomerId = "";
  let editingBookingId = "";
  let customers = [];
  let bookings = {};
  let orders = {};
  let leads = [];
  let activities = [];
  let jobs = [];
  let appointments = [];
  let websiteSubmissions = [];
  let websiteSubmissionVisibleOverrides = new Set();
  let intakeItems = [];
  let crmAttachments = [];
  let profiles = [];
  let crmSettings = {};
  let customerLocationsByCustomer = new Map();
  let customerLocationById = new Map();
  let invoicesByCustomer = new Map();
  let serviceEventsByCustomer = new Map();
  let installationsByCustomer = new Map();
  let accessNotesByCustomer = new Map();
  let crmAttachmentsByCustomer = new Map();
  let crmAttachmentsByLead = new Map();
  let crmAttachmentsByInstallation = new Map();
  let crmAttachmentsByJob = new Map();
  let crmAttachmentsByIntake = new Map();
  let bookingSelectedCustomerId = "";
  let bookingPendingOrderId = "";
  let editingOrderId = "";
  let orderDialogCustomerId = "";
  let orderTitleManuallyEdited = false;
  let completingBookingId = "";
  let completionFollowupBooking = null;
  let completionAttachmentContext = null;
  let billingDialogBookingId = "";
  let billingDialogPurpose = "billing";
  let reminderDialogCustomerId = "";
  let moveDialogBookingId = "";
  let deleteBookingDialogBookingId = "";
  let deleteBookingCloseBookingDialog = false;
  let deleteOrdersDialogIds = [];
  let confirmDialogResolver = null;
  let customerEdits = {};
  let deletedCustomers = new Set();
  let doneJobs = new Set();
  let routePlannerRows = [];
  let routeSelectedCustomerIds = new Set();
  let insulationCalcLines = [];
  let insulationMode = "insulation";
  let currentInsulationWorkspaceTab = "offer";
  let aiRegistrationDraft = null;
  let aiRegistrationSelectedCustomerId = "";
  let aiRegistrationAttachments = [];
  let passwordRecoveryActive = false;
  let editingInstallationCustomerId = "";
  let editingInstallationId = "";
  let globalSearchQuery = "";
  let leadStatusDialogState = null;
  let pendingLeadOrderKeys = new Set();
  let pendingLeadCreateKeys = new Set();
  const globalSearchResultCache = new Map();

  const el = {
    loginView: document.getElementById("loginView"),
    appView: document.getElementById("appView"),
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginRemember: document.getElementById("loginRemember"),
    loginMessage: document.getElementById("loginMessage"),
    loginIntro: document.getElementById("loginIntro"),
    forgotPasswordButton: document.getElementById("forgotPasswordButton"),
    passwordResetDialog: document.getElementById("passwordResetDialog"),
    passwordResetForm: document.getElementById("passwordResetForm"),
    passwordResetMessage: document.getElementById("passwordResetMessage"),
    passwordResetNew: document.getElementById("passwordResetNew"),
    passwordResetConfirm: document.getElementById("passwordResetConfirm"),
    closePasswordResetDialog: document.getElementById("closePasswordResetDialog"),
    cancelPasswordResetButton: document.getElementById("cancelPasswordResetButton"),
    currentUserName: document.getElementById("currentUserName"),
    currentUserRole: document.getElementById("currentUserRole"),
    dataModePill: document.getElementById("dataModePill"),
    syncStatus: document.getElementById("syncStatus"),
    logoutButton: document.getElementById("logoutButton"),
    viewTitle: document.getElementById("viewTitle"),
    viewSubtitle: document.getElementById("viewSubtitle"),
    importSeedButton: document.getElementById("importSeedButton"),
    moreMenuButton: document.getElementById("moreMenuButton"),
    moreMenu: document.getElementById("moreMenu"),
    mobileBottomNav: document.getElementById("mobileBottomNav"),
    mobileMoreButton: document.getElementById("mobileMoreButton"),
    mobileMoreMenu: document.getElementById("mobileMoreMenu"),
    mobileLogoutButton: document.getElementById("mobileLogoutButton"),
    newActionButton: document.getElementById("newActionButton"),
    newActionMenu: document.getElementById("newActionMenu"),
    newCustomerButton: document.getElementById("newCustomerButton"),
    newBookingButton: document.getElementById("newBookingButton"),
    redMetric: document.getElementById("redMetric"),
    yellowMetric: document.getElementById("yellowMetric"),
    greenMetric: document.getElementById("greenMetric"),
    bookedMetric: document.getElementById("bookedMetric"),
    globalSearchInput: document.getElementById("globalSearchInput"),
    globalSearchResults: document.getElementById("globalSearchResults"),
    dashboardServiceCount: document.getElementById("dashboardServiceCount"),
    dashboardLeadCount: document.getElementById("dashboardLeadCount"),
    dashboardBookingCount: document.getElementById("dashboardBookingCount"),
    dashboardMoveCount: document.getElementById("dashboardMoveCount"),
    dashboardBillingCount: document.getElementById("dashboardBillingCount"),
    dashboardReminderCount: document.getElementById("dashboardReminderCount"),
    startWorklist: document.getElementById("startWorklist"),
    nextJobs: document.getElementById("nextJobs"),
    moveQueue: document.getElementById("moveQueue"),
    reminderQueue: document.getElementById("reminderQueue"),
    dueCustomers: document.getElementById("dueCustomers"),
    billingQueue: document.getElementById("billingQueue"),
    dataQualityList: document.getElementById("dataQualityList"),
    recentActivity: document.getElementById("recentActivity"),
    aiRegistrationInput: document.getElementById("aiRegistrationInput"),
    aiRegistrationPasteZone: document.getElementById("aiRegistrationPasteZone"),
    aiRegistrationAttachments: document.getElementById("aiRegistrationAttachments"),
    aiRegistrationFileButton: document.getElementById("aiRegistrationFileButton"),
    aiRegistrationCameraButton: document.getElementById("aiRegistrationCameraButton"),
    aiRegistrationFileInput: document.getElementById("aiRegistrationFileInput"),
    aiRegistrationCameraInput: document.getElementById("aiRegistrationCameraInput"),
    aiRegistrationParseButton: document.getElementById("aiRegistrationParseButton"),
    aiRegistrationClearButton: document.getElementById("aiRegistrationClearButton"),
    aiRegistrationDraft: document.getElementById("aiRegistrationDraft"),
    customerSearch: document.getElementById("customerSearch"),
    statusFilter: document.getElementById("statusFilter"),
    customerList: document.getElementById("customerList"),
    customerDetail: document.getElementById("customerDetail"),
    leadSearch: document.getElementById("leadSearch"),
    leadStatusFilter: document.getElementById("leadStatusFilter"),
    leadList: document.getElementById("leadList"),
    leadDetail: document.getElementById("leadDetail"),
    websiteSubmissionInbox: document.getElementById("websiteSubmissionInbox"),
    intakeInbox: document.getElementById("intakeInbox"),
    leadFollowupMetric: document.getElementById("leadFollowupMetric"),
    leadEmailMetric: document.getElementById("leadEmailMetric"),
    leadWebsiteMetric: document.getElementById("leadWebsiteMetric"),
    leadNeedsOfferMetric: document.getElementById("leadNeedsOfferMetric"),
    leadOfferSentMetric: document.getElementById("leadOfferSentMetric"),
    leadLostMetric: document.getElementById("leadLostMetric"),
    orderSearch: document.getElementById("orderSearch"),
    orderStatusFilter: document.getElementById("orderStatusFilter"),
    orderList: document.getElementById("orderList"),
    orderDetail: document.getElementById("orderDetail"),
    orderUnscheduledMetric: document.getElementById("orderUnscheduledMetric"),
    orderScheduledMetric: document.getElementById("orderScheduledMetric"),
    orderBillingMetric: document.getElementById("orderBillingMetric"),
    orderCompletedMetric: document.getElementById("orderCompletedMetric"),
    orderMissingJobMetric: document.getElementById("orderMissingJobMetric"),
    orderSelectAll: document.getElementById("orderSelectAll"),
    deleteSelectedOrdersButton: document.getElementById("deleteSelectedOrdersButton"),
    orderSelectionSummary: document.getElementById("orderSelectionSummary"),
    deleteOrdersDialog: document.getElementById("deleteOrdersDialog"),
    deleteOrdersForm: document.getElementById("deleteOrdersForm"),
    deleteOrdersSummary: document.getElementById("deleteOrdersSummary"),
    deleteOrdersDialogMessage: document.getElementById("deleteOrdersDialogMessage"),
    deleteOrdersKeepBookings: document.getElementById("deleteOrdersKeepBookings"),
    deleteOrdersCancelBookings: document.getElementById("deleteOrdersCancelBookings"),
    deleteOrdersBookingOptions: document.getElementById("deleteOrdersBookingOptions"),
    closeDeleteOrdersDialog: document.getElementById("closeDeleteOrdersDialog"),
    cancelDeleteOrdersButton: document.getElementById("cancelDeleteOrdersButton"),
    insulationCustomerSelect: document.getElementById("insulationCustomerSelect"),
    insulationSelectedCustomer: document.getElementById("insulationSelectedCustomer"),
    insulationModeButtons: document.querySelectorAll("[data-insulation-mode]"),
    insulationModePanels: document.querySelectorAll("[data-insulation-panel]"),
    insulationModeActions: document.querySelectorAll("[data-insulation-action-mode]"),
    rentalCreateOfferButton: document.getElementById("rentalCreateOfferButton"),
    rentalDays: document.getElementById("rentalDays"),
    rentalDeliveryFee: document.getElementById("rentalDeliveryFee"),
    rentalImages: document.getElementById("rentalImages"),
    insulationLineType: document.getElementById("insulationLineType"),
    insulationQuantity: document.getElementById("insulationQuantity"),
    insulationDiscount: document.getElementById("insulationDiscount"),
    insulationAddLineButton: document.getElementById("insulationAddLineButton"),
    insulationKm: document.getElementById("insulationKm"),
    insulationToll: document.getElementById("insulationToll"),
    insulationRigPrep: document.getElementById("insulationRigPrep"),
    insulationRigExtra: document.getElementById("insulationRigExtra"),
    insulationRigLarge: document.getElementById("insulationRigLarge"),
    insulationLines: document.getElementById("insulationLines"),
    insulationSummary: document.getElementById("insulationSummary"),
    insulationCreateOfferButton: document.getElementById("insulationCreateOfferButton"),
    insulationCopyOfferButton: document.getElementById("insulationCopyOfferButton"),
    insulationCopyOfferTextButton: document.getElementById("insulationCopyOfferTextButton"),
    insulationOfferDraft: document.getElementById("insulationOfferDraft"),
    insulationClearButton: document.getElementById("insulationClearButton"),
    insulationDocuments: document.getElementById("insulationDocuments"),
    insulationCustomerSearch: document.getElementById("insulationCustomerSearch"),
    insulationCustomers: document.getElementById("insulationCustomers"),
    insulationLayout: document.querySelector(".insulation-layout"),
    insulationWorkspaceTabs: document.querySelectorAll("[data-insulation-workspace-tab]"),
    insulationWorkspacePanels: document.querySelectorAll("[data-insulation-workspace-panel]"),
    insulationNewCustomerButton: document.getElementById("insulationNewCustomerButton"),
    previousWeekButton: document.getElementById("previousWeekButton"),
    nextWeekButton: document.getElementById("nextWeekButton"),
    planningWeekModeButton: document.getElementById("planningWeekModeButton"),
    planningMonthModeButton: document.getElementById("planningMonthModeButton"),
    planningResourceFilter: document.getElementById("planningResourceFilter"),
    planningMonthOverview: document.getElementById("planningMonthOverview"),
    planningMonthLabel: document.getElementById("planningMonthLabel"),
    planningMonthSummary: document.getElementById("planningMonthSummary"),
    planningMonthGrid: document.getElementById("planningMonthGrid"),
    todayButton: document.getElementById("todayButton"),
    copyDayPlanButton: document.getElementById("copyDayPlanButton"),
    downloadDayPlanButton: document.getElementById("downloadDayPlanButton"),
    weekLabel: document.getElementById("weekLabel"),
    planningBoard: document.getElementById("planningBoard"),
    routeArea: document.getElementById("routeArea"),
    routeAreaOptions: document.getElementById("routeAreaOptions"),
    routeStatus: document.getElementById("routeStatus"),
    routeReplyFilter: document.getElementById("routeReplyFilter"),
    routeStarredOnly: document.getElementById("routeStarredOnly"),
    routeMaxJobs: document.getElementById("routeMaxJobs"),
    routeOrigin: document.getElementById("routeOrigin"),
    routeBookingDate: document.getElementById("routeBookingDate"),
    routeStartTime: document.getElementById("routeStartTime"),
    routeEndTime: document.getElementById("routeEndTime"),
    routeDuration: document.getElementById("routeDuration"),
    routeResource: document.getElementById("routeResource"),
    routeRequireLocation: document.getElementById("routeRequireLocation"),
    routeMonthPrev: document.getElementById("routeMonthPrev"),
    routeMonthNext: document.getElementById("routeMonthNext"),
    routeMonthLabel: document.getElementById("routeMonthLabel"),
    routeMonthGrid: document.getElementById("routeMonthGrid"),
    routeRefreshButton: document.getElementById("routeRefreshButton"),
    routeOpenMapsButton: document.getElementById("routeOpenMapsButton"),
    routeBookDraftButton: document.getElementById("routeBookDraftButton"),
    routeCampaignButton: document.getElementById("routeCampaignButton"),
    routeSummary: document.getElementById("routeSummary"),
    routeResults: document.getElementById("routeResults"),
    routeMissing: document.getElementById("routeMissing"),
    routeCustomerSearch: document.getElementById("routeCustomerSearch"),
    routeCustomerResults: document.getElementById("routeCustomerResults"),
    routeSelectedCustomers: document.getElementById("routeSelectedCustomers"),
    routeClearSelectionButton: document.getElementById("routeClearSelectionButton"),
    technicianDate: document.getElementById("technicianDate"),
    technicianHeading: document.getElementById("technicianHeading"),
    technicianIntro: document.getElementById("technicianIntro"),
    technicianRouteButton: document.getElementById("technicianRouteButton"),
    technicianHelp: document.getElementById("technicianHelp"),
    technicianJobs: document.getElementById("technicianJobs"),
    settingsAccessSummary: document.getElementById("settingsAccessSummary"),
    offerTemplateSettings: document.getElementById("offerTemplateSettings"),
    eaccountingCatalogSettings: document.getElementById("eaccountingCatalogSettings"),
    tagSettings: document.getElementById("tagSettings"),
    refreshProfilesButton: document.getElementById("refreshProfilesButton"),
    profileList: document.getElementById("profileList"),
    customerDialog: document.getElementById("customerDialog"),
    customerForm: document.getElementById("customerForm"),
    customerDialogTitle: document.getElementById("customerDialogTitle"),
    customerDialogMessage: document.getElementById("customerDialogMessage"),
    closeCustomerDialog: document.getElementById("closeCustomerDialog"),
    deleteCustomerButton: document.getElementById("deleteCustomerButton"),
    formName: document.getElementById("formName"),
    formPhone: document.getElementById("formPhone"),
    formEmail: document.getElementById("formEmail"),
    formOrg: document.getElementById("formOrg"),
    formStreet: document.getElementById("formStreet"),
    formZip: document.getElementById("formZip"),
    formCity: document.getElementById("formCity"),
    formTag: document.getElementById("formTag"),
    formDifferentPostal: document.getElementById("formDifferentPostal"),
    formPostalStreet: document.getElementById("formPostalStreet"),
    formPostalZip: document.getElementById("formPostalZip"),
    formPostalCity: document.getElementById("formPostalCity"),
    formGps: document.getElementById("formGps"),
    formGoogleMaps: document.getElementById("formGoogleMaps"),
    formBrand: document.getElementById("formBrand"),
    formModel: document.getElementById("formModel"),
    formInstallDate: document.getElementById("formInstallDate"),
    formLastService: document.getElementById("formLastService"),
    formNextService: document.getElementById("formNextService"),
    formAccess: document.getElementById("formAccess"),
    formIsCustomer: document.getElementById("formIsCustomer"),
    formPaysCash: document.getElementById("formPaysCash"),
    formInsulation: document.getElementById("formInsulation"),
    formServiceDates: document.getElementById("formServiceDates"),
    formTags: document.getElementById("formTags"),
    formTagCatalog: document.getElementById("formTagCatalog"),
    formNote: document.getElementById("formNote"),
    installationDialog: document.getElementById("installationDialog"),
    installationForm: document.getElementById("installationForm"),
    installationDialogTitle: document.getElementById("installationDialogTitle"),
    installationDialogMessage: document.getElementById("installationDialogMessage"),
    closeInstallationDialog: document.getElementById("closeInstallationDialog"),
    cancelInstallationDialog: document.getElementById("cancelInstallationDialog"),
    installationCustomerName: document.getElementById("installationCustomerName"),
    installationLabel: document.getElementById("installationLabel"),
    installationLocationSelect: document.getElementById("installationLocationSelect"),
    installationLocationName: document.getElementById("installationLocationName"),
    installationAddress: document.getElementById("installationAddress"),
    installationZip: document.getElementById("installationZip"),
    installationCity: document.getElementById("installationCity"),
    installationServiceInterval: document.getElementById("installationServiceInterval"),
    installationBrand: document.getElementById("installationBrand"),
    installationModel: document.getElementById("installationModel"),
    installationSerial: document.getElementById("installationSerial"),
    installationInstalledAt: document.getElementById("installationInstalledAt"),
    installationLastServiceAt: document.getElementById("installationLastServiceAt"),
    installationNextServiceDue: document.getElementById("installationNextServiceDue"),
    installationActive: document.getElementById("installationActive"),
    installationNotes: document.getElementById("installationNotes"),
    orderDialog: document.getElementById("orderDialog"),
    orderForm: document.getElementById("orderForm"),
    orderDialogTitle: document.getElementById("orderDialogTitle"),
    closeOrderDialog: document.getElementById("closeOrderDialog"),
    cancelOrderDialog: document.getElementById("cancelOrderDialog"),
    orderDialogMessage: document.getElementById("orderDialogMessage"),
    orderCustomerName: document.getElementById("orderCustomerName"),
    orderType: document.getElementById("orderType"),
    orderInstallationSelect: document.getElementById("orderInstallationSelect"),
    orderTitleInput: document.getElementById("orderTitleInput"),
    orderBookNow: document.getElementById("orderBookNow"),
    orderNoteInput: document.getElementById("orderNoteInput"),
    orderPriceDetails: document.getElementById("orderPriceDetails"),
    orderPriceSearch: document.getElementById("orderPriceSearch"),
    orderPricePreset: document.getElementById("orderPricePreset"),
    orderPriceQuantity: document.getElementById("orderPriceQuantity"),
    orderAddPriceLine: document.getElementById("orderAddPriceLine"),
    orderStandardInstallationWrap: document.getElementById("orderStandardInstallationWrap"),
    orderIncludeStandardInstallation: document.getElementById("orderIncludeStandardInstallation"),
    orderPriceLines: document.getElementById("orderPriceLines"),
    orderPriceTotal: document.getElementById("orderPriceTotal"),
    leadStatusDialog: document.getElementById("leadStatusDialog"),
    leadStatusForm: document.getElementById("leadStatusForm"),
    leadStatusDialogTitle: document.getElementById("leadStatusDialogTitle"),
    closeLeadStatusDialog: document.getElementById("closeLeadStatusDialog"),
    cancelLeadStatusDialog: document.getElementById("cancelLeadStatusDialog"),
    leadStatusDialogMessage: document.getElementById("leadStatusDialogMessage"),
    leadStatusCustomerName: document.getElementById("leadStatusCustomerName"),
    leadStatusLabelText: document.getElementById("leadStatusLabelText"),
    leadStatusProduct: document.getElementById("leadStatusProduct"),
    leadStatusAccessories: document.getElementById("leadStatusAccessories"),
    leadStatusInstallation: document.getElementById("leadStatusInstallation"),
    leadStatusOrderFields: document.getElementById("leadStatusOrderFields"),
    leadStatusCreateOrder: document.getElementById("leadStatusCreateOrder"),
    leadStatusBookAfter: document.getElementById("leadStatusBookAfter"),
    leadStatusNote: document.getElementById("leadStatusNote"),
    saveLeadStatusButton: document.getElementById("saveLeadStatusButton"),
    bookingDialog: document.getElementById("bookingDialog"),
    bookingForm: document.getElementById("bookingForm"),
    closeBookingDialog: document.getElementById("closeBookingDialog"),
    deleteBookingButton: document.getElementById("deleteBookingButton"),
    customerQuickDialog: document.getElementById("customerQuickDialog"),
    closeCustomerQuickDialog: document.getElementById("closeCustomerQuickDialog"),
    customerQuickContent: document.getElementById("customerQuickContent"),
    bookingCustomerSearch: document.getElementById("bookingCustomerSearch"),
    bookingCustomerResults: document.getElementById("bookingCustomerResults"),
    bookingCustomer: document.getElementById("bookingCustomer"),
    bookingDialogMessage: document.getElementById("bookingDialogMessage"),
    bookingDate: document.getElementById("bookingDate"),
    bookingTime: document.getElementById("bookingTime"),
    bookingType: document.getElementById("bookingType"),
    bookingInstallationSelect: document.getElementById("bookingInstallationSelect"),
    bookingDuration: document.getElementById("bookingDuration"),
    bookingResource: document.getElementById("bookingResource"),
    bookingMonthPrev: document.getElementById("bookingMonthPrev"),
    bookingMonthNext: document.getElementById("bookingMonthNext"),
    bookingMonthLabel: document.getElementById("bookingMonthLabel"),
    bookingMonthGrid: document.getElementById("bookingMonthGrid"),
    bookingDayAgenda: document.getElementById("bookingDayAgenda"),
    bookingNote: document.getElementById("bookingNote"),
    completionDialog: document.getElementById("completionDialog"),
    completionForm: document.getElementById("completionForm"),
    completionTitle: document.getElementById("completionTitle"),
    completionSummary: document.getElementById("completionSummary"),
    completionInstallationLabel: document.getElementById("completionInstallationLabel"),
    completionInstallation: document.getElementById("completionInstallation"),
    closeCompletionDialog: document.getElementById("closeCompletionDialog"),
    cancelCompletionButton: document.getElementById("cancelCompletionButton"),
    completionSubmitButton: document.getElementById("completionSubmitButton"),
    completionDoneDate: document.getElementById("completionDoneDate"),
    completionNextAction: document.getElementById("completionNextAction"),
    completionInterval: document.getElementById("completionInterval"),
    completionIntervalLabel: document.getElementById("completionIntervalLabel"),
    completionNextDate: document.getElementById("completionNextDate"),
    completionNextDateLabel: document.getElementById("completionNextDateLabel"),
    completionPaymentDoneLabel: document.getElementById("completionPaymentDoneLabel"),
    completionPaymentDone: document.getElementById("completionPaymentDone"),
    completionPaymentHint: document.getElementById("completionPaymentHint"),
    completionPriceDetails: document.getElementById("completionPriceDetails"),
    completionPriceSearch: document.getElementById("completionPriceSearch"),
    completionPricePreset: document.getElementById("completionPricePreset"),
    completionPriceQuantity: document.getElementById("completionPriceQuantity"),
    completionAddPriceLine: document.getElementById("completionAddPriceLine"),
    completionPriceLines: document.getElementById("completionPriceLines"),
    completionPriceTotal: document.getElementById("completionPriceTotal"),
    completionAttachmentSection: document.getElementById("completionAttachmentSection"),
    completionAttachments: document.getElementById("completionAttachments"),
    completionAttachmentList: document.getElementById("completionAttachmentList"),
    completionNote: document.getElementById("completionNote"),
    billingDialog: document.getElementById("billingDialog"),
    billingForm: document.getElementById("billingForm"),
    billingTitle: document.getElementById("billingTitle"),
    billingSummary: document.getElementById("billingSummary"),
    billingDialogMessage: document.getElementById("billingDialogMessage"),
    closeBillingDialog: document.getElementById("closeBillingDialog"),
    cancelBillingButton: document.getElementById("cancelBillingButton"),
    billingDateLabel: document.getElementById("billingDateLabel"),
    billingDate: document.getElementById("billingDate"),
    billingModeLabel: document.getElementById("billingModeLabel"),
    billingMode: document.getElementById("billingMode"),
    billingHint: document.getElementById("billingHint"),
    billingPriceBasis: document.getElementById("billingPriceBasis"),
    billingPriceTotal: document.getElementById("billingPriceTotal"),
    copyBillingDraftButton: document.getElementById("copyBillingDraftButton"),
    openEaccountingButton: document.getElementById("openEaccountingButton"),
    billingNote: document.getElementById("billingNote"),
    saveBillingButton: document.getElementById("saveBillingButton"),
    reminderDialog: document.getElementById("reminderDialog"),
    reminderForm: document.getElementById("reminderForm"),
    reminderTitle: document.getElementById("reminderTitle"),
    closeReminderDialog: document.getElementById("closeReminderDialog"),
    cancelReminderButton: document.getElementById("cancelReminderButton"),
    reminderDialogMessage: document.getElementById("reminderDialogMessage"),
    reminderText: document.getElementById("reminderText"),
    reminderDueDate: document.getElementById("reminderDueDate"),
    reminderDueTime: document.getElementById("reminderDueTime"),
    reminderCustomerSearch: document.getElementById("reminderCustomerSearch"),
    reminderCustomer: document.getElementById("reminderCustomer"),
    reminderCustomerHint: document.getElementById("reminderCustomerHint"),
    saveReminderButton: document.getElementById("saveReminderButton"),
    deleteBookingDialog: document.getElementById("deleteBookingDialog"),
    deleteBookingForm: document.getElementById("deleteBookingForm"),
    deleteBookingSummary: document.getElementById("deleteBookingSummary"),
    deleteBookingDialogMessage: document.getElementById("deleteBookingDialogMessage"),
    deleteBookingOrderOptions: document.getElementById("deleteBookingOrderOptions"),
    deleteBookingKeepOrder: document.getElementById("deleteBookingKeepOrder"),
    deleteBookingDeleteOrder: document.getElementById("deleteBookingDeleteOrder"),
    closeDeleteBookingDialog: document.getElementById("closeDeleteBookingDialog"),
    cancelDeleteBookingButton: document.getElementById("cancelDeleteBookingButton"),
    confirmDialog: document.getElementById("confirmDialog"),
    confirmForm: document.getElementById("confirmForm"),
    confirmTitle: document.getElementById("confirmTitle"),
    confirmText: document.getElementById("confirmText"),
    confirmOkButton: document.getElementById("confirmOkButton"),
    confirmCancelButton: document.getElementById("confirmCancelButton"),
    closeConfirmDialog: document.getElementById("closeConfirmDialog"),
    moveDialog: document.getElementById("moveDialog"),
    moveForm: document.getElementById("moveForm"),
    moveSummary: document.getElementById("moveSummary"),
    moveDialogMessage: document.getElementById("moveDialogMessage"),
    closeMoveDialog: document.getElementById("closeMoveDialog"),
    cancelMoveButton: document.getElementById("cancelMoveButton"),
    moveReasonPreset: document.getElementById("moveReasonPreset"),
    moveReasonNote: document.getElementById("moveReasonNote"),
  };

  function formatDate(value) {
    if (!value) return "Ikke satt";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function weekdayDate(value, options = {}) {
    if (!value) return "Ikke satt";
    const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    const weekday = new Intl.DateTimeFormat("nb-NO", { weekday: options.long ? "long" : "short" }).format(date);
    return `${weekday} ${formatDate(isoDate(date))}`;
  }

  function isTodayIso(value) {
    return Boolean(value) && String(value).slice(0, 10) === isoDate(new Date());
  }

  function isoWeekNumber(date) {
    const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    return Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
  }

  function isoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfWeek(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    const day = next.getDay() || 7;
    next.setDate(next.getDate() - day + 1);
    return next;
  }

  function shiftDate(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function addYearsIso(value, years) {
    const date = new Date(`${value || isoDate(new Date())}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setFullYear(date.getFullYear() + Number(years || 2));
    return isoDate(date);
  }

  function customerKey(customer) {
    return customer?.id || customer?.lime_id || "";
  }

  function repairTextEncoding(value) {
    let text = String(value ?? "");
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

  function normalizeMatch(value) {
    return repairTextEncoding(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .replace(/ã¦/g, "ae")
      .replace(/ã¸/g, "o")
      .replace(/ã¥/g, "a")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function escapeRegex(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function applyLimeEnrichmentToCustomers(list) {
    if (!limeEnrichment.records?.length) return list;
    const byName = new Map();
    const byEaccountingNumber = new Map();
    for (const customer of list) {
      byName.set(normalizeMatch(customer.name), customer);
      if (customer.original_lime_name) byName.set(normalizeMatch(customer.original_lime_name), customer);
      if (customer.matched_eaccounting_customer_number) byEaccountingNumber.set(String(customer.matched_eaccounting_customer_number), customer);
    }
    for (const invoice of rawData.invoices || []) {
      if (!invoice.customer_number || !invoice.lime_id) continue;
      const customer = list.find((item) => item.lime_id === invoice.lime_id || item.legacy_lime_id === invoice.lime_id);
      if (customer) byEaccountingNumber.set(String(invoice.customer_number), customer);
    }
    for (const record of limeEnrichment.records) {
      let customer = (record.limeId && list.find((item) => item.lime_id === record.limeId || item.legacy_lime_id === record.limeId))
        || (record.eaccountingCustomerNumber && byEaccountingNumber.get(String(record.eaccountingCustomerNumber)))
        || byName.get(normalizeMatch(record.matchName));
      if (!customer && record.eaccountingCustomerNumber && /eAccounting kundeeksport/i.test(record.source || "")) {
        customer = {
          lime_id: `eaccounting-${record.eaccountingCustomerNumber}`,
          source: "eAccounting kundeeksport",
          name: record.matchName || "Uten navn",
          tags: "eAccounting kundeeksport",
          service_status: "Ukjent",
          latest_deal_status: "eAccounting",
          customer_type: "Kunde",
        };
        list.push(customer);
        byName.set(normalizeMatch(customer.name), customer);
        byEaccountingNumber.set(String(record.eaccountingCustomerNumber), customer);
      }
      if (!customer) continue;
      for (const [key, value] of Object.entries(record.fields || {})) {
        if (!value) continue;
        if (key === "next_service_due") {
          const today = isoDate(new Date());
          if (!customer[key] || customer[key] < today || value < customer[key]) customer[key] = value;
        } else if (key === "last_service_date") {
          if (!customer[key] || value > customer[key]) customer[key] = value;
        } else if (key === "service_dates") {
          const dates = new Set(String(customer[key] || "").split(";").map((item) => item.trim()).filter(Boolean));
          dates.add(value);
          customer[key] = [...dates].sort().join("; ");
        } else if (key === "first_install_date") {
          if (!customer[key] || value < customer[key]) customer[key] = value;
        } else if (key === "last_install_date") {
          if (!customer[key] || value > customer[key]) customer[key] = value;
        } else if (key === "pays_cash") {
          customer[key] = Boolean(value);
        } else if (key === "access_note" && customer[key] && !String(customer[key]).includes(value)) {
          customer[key] = `${customer[key]}\n${value}`;
      } else if (!customer[key]) {
          customer[key] = value;
        }
      }
      if (record.history?.length) {
        const historyText = record.history
          .map((entry) => `${entry.title || ""} ${entry.description || ""}`)
          .join(" ");
        applyModelDictionary(customer, historyText);
      }
    }
    for (const customer of list) applyModelDictionary(customer);
    return list;
  }

  function applyKnownCustomerCorrections(list) {
    return list;
  }

  function applyModelDictionary(customer, extraText = "") {
    const text = `${customer.tags || ""} ${customer.brand || ""} ${customer.model_or_note || ""} ${extraText}`.toLowerCase();
    if (!customer.brand) {
      if (/\b(hz\d{0,2}|nz\d{0,2}|cz\d{0,2}|z25|z35|gulvmodell|floor)\b/.test(text)) customer.brand = "Panasonic";
      else if (/(kaiteki|hara|iguru)/.test(text)) customer.brand = "Mitsubishi";
      else if (/(narvik|wilfa)/.test(text)) customer.brand = "Wilfa";
      else if (/(vindfree|samsung)/.test(text)) customer.brand = "Samsung";
      else if (/(norgespumpa|fujitsu)/.test(text)) customer.brand = "Fujitsu";
    }
    if (!customer.model_or_note) {
      if (/\bnz25(yke)?\b/.test(text)) customer.model_or_note = "NZ25YKE";
      else if (/\bhz25(xke|zke|yke)?\b/.test(text)) customer.model_or_note = "HZ25";
      else if (/\bnz35(yke)?\b/.test(text)) customer.model_or_note = "NZ35YKE";
      else if (/\bz25\b/.test(text)) customer.model_or_note = "Z25 gulvmodell";
    }
  }

  function hasConfirmedServiceAfterInstall(customer) {
    const dates = [
      customer.last_service_date,
      ...(String(customer.service_dates || "").match(/\d{4}-\d{2}-\d{2}/g) || []),
    ].filter(Boolean);
    if (dates.length) {
      if (!customer.first_install_date) return true;
      if (dates.some((date) => date > customer.first_install_date)) return true;
    }
    return hasFourYearServiceReminder(customer);
  }

  function hasFourYearServiceReminder(customer) {
    if (!customer.first_install_date || !customer.next_service_due) return false;
    const install = new Date(`${customer.first_install_date}T00:00:00`);
    const next = new Date(`${customer.next_service_due}T00:00:00`);
    if (Number.isNaN(install.getTime()) || Number.isNaN(next.getTime())) return false;
    const intervalYears = /årlig service|arlig service/i.test(`${customer.tags || ""} ${customer.service_interval || ""}`) ? 1 : 2;
    const expected = new Date(install);
    expected.setFullYear(expected.getFullYear() + intervalYears);
    const movedMonths = (next.getFullYear() - expected.getFullYear()) * 12 + next.getMonth() - expected.getMonth();
    return movedMonths >= 18;
  }

  function cleanDisplayName(customer) {
    return repairTextEncoding(customer?.name || "Uten navn").replace(/^★\s*/, "");
  }

  function isManualStarred(customer) {
    return /\bgullkunde\b|\bstjerne\b|\bfavoritt\b/i.test(String(customer?.tags || ""));
  }

  function isStarSuppressed(customer) {
    return /\bikke stjerne\b|\bikke gullkunde\b|\bskjul stjerne\b/i.test(String(customer?.tags || ""));
  }

  function isAutoStarredCustomer(customer) {
    return hasConfirmedServiceAfterInstall(customer);
  }

  function isStarredCustomer(customer) {
    return !isStarSuppressed(customer) && (isManualStarred(customer) || isAutoStarredCustomer(customer));
  }

  function customerStarTitle(customer) {
    if (isStarSuppressed(customer)) return "Stjerne er manuelt slått av for denne kunden.";
    if (isManualStarred(customer)) return "Prioritert servicekunde: svarer ofte ja, ønsker jevnlig service eller er aktuell når du fyller servicedag.";
    if (isAutoStarredCustomer(customer)) return "Prioritert servicekunde: kunden har hatt service etter installasjon, eller servicepåminnelse ligger cirka 4 år etter installasjon.";
    return "Bruk stjerne på kunder som ofte svarer ja, ønsker jevnlig service eller er spesielt aktuelle for servicedag.";
  }

  function customerStarHtml(customer, options = {}) {
    if (!isStarredCustomer(customer) && !options.showEmpty) return "";
    const title = customerStarTitle(customer);
    const active = isStarredCustomer(customer);
    return `<span class="customer-star ${active ? "active" : "empty"}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">&#9733;</span>`;
  }

  function customerCashBadgeHtml(customer) {
    if (!customer?.pays_cash) return "";
    return `<span class="cash-badge" title="Betaling på stedet: kunden er merket for betaling uten vanlig faktura." aria-label="Betaling på stedet">$</span>`;
  }

  function isCustomerMarkerTag(tag) {
    return /^(kunde|er kunde|ikke kunde|er ikke kunde)$/i.test(normalizeMatch(tag));
  }

  function customerManualStatus(customer) {
    const markers = splitTags(customer?.tags).filter(isCustomerMarkerTag).map(tagIdentity);
    if (markers.includes("ikke kunde")) return false;
    if (markers.includes("kunde")) return true;
    return null;
  }

  function customerIsMarkedCustomer(customer) {
    const manual = customerManualStatus(customer);
    if (manual !== null) return manual;
    if (normalizeMatch(customer?.customer_type) === "kunde") return true;
    if (customerOrders(customer).length) return true;
    if ((installationsForCustomer(customer) || []).some((installation) => installation.active !== false)) return true;
    if (customer?.first_install_date || customer?.last_service_date || customer?.service_dates) return true;
    return false;
  }

  function nextTagsWithCustomerMarker(value, shouldMark) {
    const kept = splitTags(value).filter((tag) => !isCustomerMarkerTag(tag));
    kept.unshift(shouldMark ? "Kunde" : "Ikke kunde");
    return uniqueTags(kept);
  }

  function customerStatusMarkerHtml(customer, interactive = false) {
    const key = customerKey(customer);
    const active = customerIsMarkedCustomer(customer);
    const title = active
      ? "Er kunde. Trykk for å markere som ikke kunde."
      : "Er ikke kunde. Trykk når personen faktisk er kunde.";
    const attrs = interactive
      ? `data-toggle-customer-status="${escapeHtml(key)}"`
      : "disabled";
    return `
      <button class="customer-status-toggle ${active ? "active" : ""}" ${attrs} type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(active ? "Er kunde" : "Er ikke kunde")}">
        <span aria-hidden="true">${active ? "&#9829;" : "&#9825;"}</span>
        <em>${escapeHtml(active ? "Er kunde" : "Er ikke kunde")}</em>
      </button>
    `;
  }

  const leadStatuses = {
    followup: {
      label: "Må kontaktes",
      help: "Ny melding eller gammel oppfølging som bør avklares før den blir tilbud, jobb eller arkiveres.",
    },
    needs_offer: {
      label: "Tilbud må sendes",
      help: "Befaring eller dialog er gjort, og kunden venter på tilbud.",
    },
    offer_sent: {
      label: "Tilbud sendt / venter svar",
      help: "Tilbud er sendt eller muntlig gitt. Følg opp hvis kunden ikke svarer.",
    },
    won: {
      label: "Vunnet - planlegg jobb",
      help: "Kunden har takket ja. Neste steg er installasjon eller jobb i planning.",
    },
    lost: {
      label: "Tapt / ikke kjøpt",
      help: "Saken er avsluttet uten salg. Beholdes for historikk og eventuell senere serviceforespørsel.",
    },
  };

  const aiRegistrationTypes = {
    lead: {
      label: "Oppfølging / tilbud",
      eventType: "Hurtigregistrering - oppfølging",
      tags: ["Lead", "Leadstatus: Må kontaktes"],
    },
    history: {
      label: "Kun historikk",
      eventType: "Hurtigregistrering - historikk",
      tags: [],
    },
    service: {
      label: "Service / jobb",
      eventType: "Hurtigregistrering - service",
      tags: ["Service"],
    },
    befaring: {
      label: "Befaring",
      eventType: "Hurtigregistrering - befaring",
      tags: ["Lead", "Befaring", "Leadstatus: Må kontaktes"],
    },
    installasjon: {
      label: "Installasjon / montering",
      eventType: "Hurtigregistrering - installasjon",
      tags: ["Lead", "Leadstatus: Vunnet - planlegg jobb"],
    },
    blaseisolering: {
      label: "Blåseisolering",
      eventType: "Hurtigregistrering - blåseisolering",
      tags: ["Blåseisolering", "Lead", "Leadstatus: Må kontaktes"],
    },
  };

  const postalCityByZip = {
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
    "3630": "Rødberg",
  };

  const orderStatuses = {
    unscheduled: {
      label: "Ikke planlagt",
      help: "Jobben er avtalt eller vunnet, men ikke lagt i kalender ennå.",
    },
    scheduled: {
      label: "Planlagt",
      help: "Jobben har minst en avtale i kalenderen.",
    },
    completed: {
      label: "Utført",
      help: "Jobben er markert utført. Service/installasjon bør normalt faktureres.",
    },
    cancelled: {
      label: "Avsluttet",
      help: "Jobben er lukket uten videre arbeid.",
    },
  };

  const billingStatuses = {
    not_ready: "Ikke klar",
    ready: "Må faktureres",
    sent: "Fakturert",
    paid: "Betalt",
  };

  const jobWorkStatuses = {
    draft: {
      label: "Jobbkladd",
      help: "Jobbspeilet finnes, men er ikke booket ennå.",
    },
    planned: {
      label: "Jobb planlagt",
      help: "Jobben finnes i jobs-tabellen og er planlagt.",
    },
    in_progress: {
      label: "Jobb pågår",
      help: "Jobben finnes i jobs-tabellen og er markert pågående.",
    },
    completed: {
      label: "Jobb utført",
      help: "Jobben finnes i jobs-tabellen og er markert utført.",
    },
    cancelled: {
      label: "Jobb avsluttet",
      help: "Jobben er avsluttet i jobs-tabellen.",
    },
  };

  const jobBillingStatuses = {
    not_ready: "Ikke klar",
    ready_for_invoice: "Klar til faktura",
    exported: "Eksportert",
    invoiced: "Fakturert",
    credit_needed: "Kredit må sjekkes",
  };

  const leadTemplates = {
    heatpump_info_request: {
      title: "Spør om bilder/info",
      subject: "Info før tilbud på varmepumpe",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "For å gi et riktig tilbud trenger jeg gjerne litt mer info.",
          "",
          "Kan du sende bilder av hvor varmepumpen skal stå inne og ute, ca. hvor mange m2 som skal varmes opp, og om du ønsker hvit eller sort innedel?",
          "",
          customerOfferAddress(customer) ? `Jeg har notert adressen som: ${customerOfferAddress(customer)}.` : "Send gjerne også adressen anlegget skal monteres på.",
          "",
          "Bare ring hvis det er enklere å ta det muntlig.",
          "",
          "Mvh",
          "Gunnar",
          "Numedal Varmepumpeservice",
          "93436855",
        ].join("\n");
      },
    },
    heatpump_standard_offer: {
      title: "Tilbud varmepumpe",
      subject: "Tilbud på varmepumpe ferdig montert",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "Her er forslag til varmepumpe ferdig montert:",
          "",
          "Varmepumpe: [modell]",
          "Pris ferdig montert: [pris],- inkl. mva",
          "",
          "Prisen forutsetter standard montering med normal rørføring/kanal slik vi har snakket om. Eventuelle tillegg som ekstra rør, ekstra kanal, dryppanne, tak, varmepumpehus eller spesielle stativer avklares før montering.",
          "",
          offerPriceTermsText(),
          "",
          "Gi gjerne beskjed hvis du ønsker å gå videre, så finner vi en monteringsdato som passer.",
          "",
          "Mvh",
          "Gunnar",
          "Numedal Varmepumpeservice",
          "93436855",
        ].join("\n");
      },
    },
    general_price_offer: {
      title: "Generelt pristilbud",
      get subject() {
        return offerSettings().generalOfferSubject;
      },
      body(customer) {
        return renderOfferTextTemplate(offerSettings().generalOfferBody, customer);
      },
    },
    fujitsu_floor: {
      title: "Tilbud gulvmodell",
      subject: "Tilbud på gulvmodell varmepumpe",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "Takk for hyggelig befaring.",
          "",
          "Jeg foreslår Fujitsu Extreme 5.5 gulvmodell som en god løsning hos dere.",
          "",
          "Pris ferdig montert: [pris],- inkl. mva.",
          "",
          "Tilbudet gjelder standard montering. Gi gjerne beskjed hvis du ønsker at jeg skal justere tilbudet med ekstra kanal, stativ, dryppanne/tak eller andre detaljer.",
          "",
          "Mvh",
          "Gunnar",
          "Numedal Varmepumpeservice",
          "93436855",
        ].join("\n");
      },
    },
    norgespumpa_black: {
      title: "Tilbud Norgespumpa sort",
      subject: "Tilbud på Norgespumpa 5.9 sort",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "Som avtalt sender jeg informasjon om Norgespumpa 5.9 sort.",
          "",
          "Muntlig pris var 25 000,- ferdig montert, forutsatt standard montering slik vi snakket om.",
          "",
          "Gi gjerne beskjed om du ønsker at vi setter opp en monteringsdato, eller om du har spørsmål til plassering, rørføring eller strøm.",
          "",
          "Mvh",
          "Gunnar",
          "Numedal Varmepumpeservice",
          "93436855",
        ].join("\n");
      },
    },
    heatpump_accept_next: {
      title: "Aksept / neste steg",
      subject: "Montering av varmepumpe",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "Takk for bekreftelsen.",
          "",
          "Da setter vi opp montering av varmepumpen. Før vi avtaler endelig tidspunkt vil jeg bare kontrollere adresse, adkomst og plassering:",
          "",
          customerOfferAddress(customer) ? `Adresse: ${customerOfferAddress(customer)}` : "Adresse: [legg inn adresse]",
          "Adkomst/nøkkel: [legg inn hvis aktuelt]",
          "Ønsket tidspunkt/uke: [legg inn]",
          "",
          "Hvis du har bilder av inne- og utedel-plassering kan du gjerne sende dem i samme tråd.",
          "",
          "Mvh",
          "Gunnar",
          "Numedal Varmepumpeservice",
          "93436855",
        ].join("\n");
      },
    },
    insulation_info_request: {
      title: "Blåseisolering info",
      subject: "Info før tilbud på blåseisolering",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "For å gi et best mulig tilbud på blåseisolering trenger vi gjerne litt mer info.",
          "",
          "Send gjerne bilder av loft/konstruksjon, adkomst og eventuelle utfordringer. Fint om du også skriver ca. areal, ønsket tykkelse, byggeår, om det er plast/dampsperre mot loftet, og hvordan luftingen er ved gesims/raft.",
          "",
          customerOfferAddress(customer) ? `Jeg har notert oppdragsadressen som: ${customerOfferAddress(customer)}.` : "Send gjerne også oppdragsadressen.",
          "",
          "Da ser vi om vi kan prise direkte eller om befaring er nødvendig.",
          "",
          "Mvh",
          "Gunnar",
          "Isobygg Buskerud",
          "93436855",
        ].join("\n");
      },
    },
    insulation_offer: {
      title: "Tilbud blåseisolering",
      subject: "Tilbud på blåseisolering",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "Her er tilbud på blåseisolering:",
          "",
          "Oppdragsadresse: " + (customerOfferAddress(customer) || "[adresse]"),
          "Konstruksjon: [loft/vegg/gulv]",
          "Areal: [m2] m2",
          "Tykkelse: [cm] cm",
          "Pris: [pris],- inkl. mva",
          "",
          "Tilbudet forutsetter normal adkomst og at nødvendige forberedelser er gjort før vi kommer. Eventuell raftepapp, ekstra rigg, riving/fjerning av gammel isolasjon eller andre tillegg avklares før utførelse.",
          "",
          "Gi gjerne beskjed hvis du ønsker å gå videre, så finner vi tidspunkt.",
          "",
          "Mvh",
          "Gunnar",
          "Isobygg Buskerud",
          "93436855",
        ].join("\n");
      },
    },
    vac_rental_offer: {
      title: "Tilbud støvsugerleie",
      subject: "Tilbud på leie av industristøvsuger",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "Her er forslag til leie av industristøvsuger 15 hk for utsuging av gammel blåseisolasjon, stubbloftsleire, sagflis eller kutterflis.",
          "",
          "Engangsleie: 3 000,- eks. mva",
          "Døgnleie etter første døgn: 1 800,- eks. mva per døgn",
          "",
          "Maskinen hentes og leveres i Svene etter avtale, med full tank 98 oktan bensin ved retur. Det følger med ca. 20 m sugeslange, kortere utblåsslange, slangeklemmer, kjørelemmer og lukket skaphenger.",
          "",
          "Kunde er ansvarlig for utstyr og henger i leieperioden. Verdi på utstyret er ca. 160 000,-.",
          "",
          "Mvh",
          "Gunnar",
          "Numedal Varmepumpeservice",
          "93436855",
        ].join("\n");
      },
    },
    followup_offer: {
      title: "Oppfølging tilbud",
      subject: "Oppfølging av tilbud",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "Jeg følger bare opp tilbudet jeg sendte.",
          "",
          "Har du fått sett på det, eller er det noe du lurer på før du bestemmer deg?",
          "",
          "Mvh",
          "Gunnar",
          "Numedal Varmepumpeservice",
          "93436855",
        ].join("\n");
      },
    },
    service_probe: {
      title: "Serviceforespørsel",
      subject: "Service på varmepumpe",
      body(customer) {
        return [
          `Hei ${firstName(customer)}!`,
          "",
          "Vi utfører service på varmepumper i området ditt.",
          "",
          "Hvis varmepumpen din ikke har hatt service på en stund kan vi gjerne sette deg opp når vi samler flere jobber i området. Det gjør det enklere å holde reisekostnaden nede.",
          "",
          "Ønsker du at vi tar kontakt når vi planlegger service i området?",
          "",
          "Mvh",
          "Gunnar",
          "Numedal Varmepumpeservice",
          "93436855",
        ].join("\n");
      },
    },
  };

  function firstName(customer) {
    const name = cleanDisplayName(customer).split(/\s+/).filter(Boolean)[0];
    return name || "";
  }

  function customerOfferAddress(customer) {
    return addressFor(customer) || [customer?.visit_zip, customer?.visit_city || customer?.location_tag].filter(Boolean).join(" ");
  }

  function defaultOfferPriceTermsText() {
    return [
      "Standard montering inkluderer:",
      "- Rør, deksel og kabel inntil 4 meter mellom utedel og innedel",
      "- Plassering av utedel på vegg inntil 1,5 meter over bakkenivå",
      "- Boring i trevegg",
      "",
      "NB! Montering på trevegg krever annet veggfeste og fjærdempere. Dette avviker fra standard installasjon.",
      "",
      "Tilleggsarbeid:",
      "- Elektrisk strømtilførsel til varmepumpen er ikke inkludert i prisen. Dette må utføres av autorisert installatør.",
      "- Standard montering, inntil 4 m rør og kanal: 7 490,-",
      "- Demontering av gammel pumpe inkl. gasstømming: 1 990,-",
      "- Bomtur / avbrutt installasjon: 1 600,-",
      "- Timepris arbeid: 1 150,-",
      "- Enkel murboring: 990,-",
      "- Kjerneboring: pris på forespørsel, ca. 1 000-4 000,- avhengig av murtykkelse og tidsforbruk",
      "- Trollflex rørgjennomføring: 800,-",
      "- Ekstra rør og signal-/strømkabel per meter utover standard: 650,-",
      "- Tilslutningskabel 3 meter: 295,-",
      "- Tilslutningskabel 7 meter: 495,-",
      "- Tilslutningskabel 10 meter: 790,-",
      "- Signalkabel skjøt: 300,-",
      "- Gassrør skjøt 1/4-3/8 komplett m/rørisolasjon: 550,-",
      "- Blindehylser 1/4-3/8: 300,-",
      "- PVC kanaler per meter: 300,-",
      "- PVC 90° bend: 180,-",
      "- PVC vegglokk: 150,-",
      "- PVC flexrør 600 mm: 300,-",
      "- 4 stk. standard gummidempere: 500,-",
      "- Murbraketter 2 stk. vinkler, kun mur: 700,-",
      "- 4 stk. fjærdempere: 990,-",
      "- Dempet veggstativ: 750,-",
      "- Dempet veggbrakett med fjærer for trevegg: 1 750,-",
      "- Markkonsoll: 1 870,-",
      "- Spesialbrakett for lav murvegg: 990,-",
      "- 4 stk. steinheller til bakkestativ: 990,-",
      "- Varmepumpetak hvit/sort: 1 990,-",
      "- Montering av varmepumpetak: på timepris / pris på forespørsel",
      "- Dryppanne komplett kit inkl. varmekabel og termostat: 3 990,-",
      "- Ekstra varmekabel m/termostat 1,5 m 75W: pris på forespørsel",
      "- VPS90 hvit varmepumpehus i vedlikeholdsfri lakkert metall m/servicedør: 3 990,-",
      "- VPS90-K sort varmepumpehus i vedlikeholdsfri lakkert metall m/servicedør: 4 290,-",
      "- Montering av varmepumpehus: på timepris / pris på forespørsel",
      "- Ekstra kjølemedium R32 per gram: 6,-",
      "- Ekstra kjølemedium R410A per gram: 7,50,-",
      "- Kjøretillegg per km: 15,-",
      "- Service varmepumpe: 2 490,- inkl. kjøring inntil 30 km total",
      "",
      "Alle priser er inkl. mva. og gjelder som tillegg til standard installasjon. Prisoversikten er sist oppdatert 29. juni 2026.",
    ].join("\n");
  }

  function normalizeOfferPriceTermsText(text) {
    return String(text || "")
      .replace(
        "- Standard montering for kundens/brukt varmepumpe, inntil 4 m rør og kanal: 6 990,-",
        "- Standard montering, inntil 4 m rør og kanal: 7 490,-",
      )
      .replace(
        "- Standard montering for kundens/brukt varmepumpe, inntil 4 m rør og kanal: 6990,-",
        "- Standard montering, inntil 4 m rør og kanal: 7 490,-",
      );
  }

  function defaultGeneralOfferBody() {
    return [
      "Hei {fornavn}!",
      "",
      "Her er et foreløpig pristilbud basert på informasjonen vi har nå.",
      "",
      "Aktuelle varmepumper/modeller:",
      "- [modell 1]: [pris] ferdig montert",
      "- [modell 2]: [pris] ferdig montert",
      "",
      "Aktuelle tillegg:",
      "- Varmepumpehus/trehus: [ja/nei/pris]",
      "- Ekstra rør/kanal/stativ/dryppanne: [legg inn hvis aktuelt]",
      "",
      "Anleggsadresse: {adresse}",
      "",
      "{prisgrunnlag}",
      "",
      "Hvis du ønsker å gå videre, finner vi en monteringsdato som passer.",
      "",
      "Mvh",
      "Gunnar",
      "Numedal Varmepumpeservice",
      "93436855",
    ].join("\n");
  }

  function offerSettings() {
    const saved = crmSettings.offer_settings && typeof crmSettings.offer_settings === "object"
      ? crmSettings.offer_settings
      : {};
    const templateOverrides = saved.templateOverrides && typeof saved.templateOverrides === "object"
      ? { ...saved.templateOverrides }
      : {};
    if (!templateOverrides.general_price_offer && (saved.generalOfferSubject || saved.generalOfferBody)) {
      templateOverrides.general_price_offer = {
        subject: saved.generalOfferSubject || "Pristilbud på varmepumpe og tilleggsarbeid",
        body: saved.generalOfferBody || defaultGeneralOfferBody(),
      };
    }
    return {
      generalOfferSubject: String(saved.generalOfferSubject || "Pristilbud på varmepumpe og tilleggsarbeid"),
      generalOfferBody: String(saved.generalOfferBody || defaultGeneralOfferBody()),
      priceTermsText: normalizeOfferPriceTermsText(saved.priceTermsText || defaultOfferPriceTermsText()),
      autoEmailEnabled: Boolean(saved.autoEmailEnabled),
      templateOverrides,
    };
  }

  function offerPriceTermsText() {
    return offerSettings().priceTermsText;
  }

  function offerAutoEmailEnabled() {
    return Boolean(offerSettings().autoEmailEnabled && store.isConfigured && store.sendOfferEmail);
  }

  function renderOfferTextTemplate(templateText, customer) {
    const first = firstName(customer) || "";
    return String(templateText || "")
      .replaceAll("{fornavn}", first)
      .replaceAll("{navn}", cleanDisplayName(customer) || "")
      .replaceAll("{adresse}", customerOfferAddress(customer) || "[adresse]")
      .replaceAll("{prisgrunnlag}", offerPriceTermsText());
  }

  function offerTemplatePlaceholderCustomer() {
    return {
      name: "{fornavn} {navn}",
      visit_street: "{adresse}",
      visit_zip: "",
      visit_city: "",
      location_tag: "",
    };
  }

  function defaultLeadTemplateSubject(templateId) {
    if (templateId === "general_price_offer") return "Pristilbud på varmepumpe og tilleggsarbeid";
    return String(leadTemplates[templateId]?.subject || "");
  }

  function defaultLeadTemplateBodyForSettings(templateId) {
    if (templateId === "general_price_offer") return defaultGeneralOfferBody();
    const template = leadTemplates[templateId];
    if (!template) return "";
    const body = String(template.body(offerTemplatePlaceholderCustomer()) || "");
    const priceTerms = offerPriceTermsText();
    return priceTerms ? body.replace(priceTerms, "{prisgrunnlag}") : body;
  }

  function offerTemplateOverride(templateId) {
    const override = offerSettings().templateOverrides?.[templateId];
    return override && typeof override === "object" ? override : {};
  }

  function offerTemplateSubject(templateId) {
    const override = offerTemplateOverride(templateId);
    const subject = String(override.subject || "").trim();
    return subject || defaultLeadTemplateSubject(templateId);
  }

  function offerTemplateBody(templateId, customer) {
    const override = offerTemplateOverride(templateId);
    const body = String(override.body || "").trim();
    if (body) return renderOfferTextTemplate(override.body, customer);
    const template = leadTemplates[templateId];
    return template ? template.body(customer) : "";
  }

  function leadStatusLabel(status) {
    return leadStatuses[status]?.label || "Oppfølging";
  }

  function leadStatusHelp(status) {
    return leadStatuses[status]?.help || "Potensiell kunde som ikke er ordinær servicekunde ennå.";
  }

  function customerHasDocumentedWork(customer) {
    const key = customerKey(customer);
    const invoices = invoicesByCustomer.get(key) || invoicesByCustomer.get(customer?.lime_id) || [];
    const installations = installationsByCustomer.get(key) || installationsByCustomer.get(customer?.lime_id) || [];
    const serviceEvents = serviceEventsByCustomer.get(key) || serviceEventsByCustomer.get(customer?.lime_id) || [];
    return Boolean(
      invoices.length
      || installations.length
      || customer?.last_service_date
      || customer?.service_dates
      || customer?.first_install_date
      || customer?.last_install_date
      || serviceEvents.some((event) => /service utført|fullført|faktura|installasjon/i.test(`${event.event_type || ""} ${event.note || ""}`)),
    );
  }

  function leadStatusFromTags(customer) {
    const text = `${customer?.tags || ""} ${customer?.local_note || ""}`.toLowerCase();
    if (/\bleadstatus\s*:\s*(tilbud må sendes|tilbud ma sendes|needs_offer)\b/.test(text)) return "needs_offer";
    if (/\bleadstatus\s*:\s*(tilbud sendt|venter svar|offer_sent)\b/.test(text)) return "offer_sent";
    if (/\bleadstatus\s*:\s*(vunnet|won)\b/.test(text)) return "won";
    if (/\bleadstatus\s*:\s*(tapt|lost|ikke kjøpt|ikke kjopt)\b/.test(text)) return "lost";
    if (/\bleadstatus\s*:\s*(må følges opp|ma folges opp|må kontaktes|ma kontaktes|followup)\b/.test(text)) return "followup";
    return "";
  }

  function leadStatusFromFollowupText(text) {
    const noteText = String(text || "");
    if (/skal ha tilbud|trenger tilbud|venter på tilbud|venter pa tilbud|tilbud må sendes|tilbud ma sendes|send tilbud|lage tilbud|må sende tilbud|ma sende tilbud/i.test(noteText)) return "needs_offer";
    if (/tilbud sendt|venter svar|muntlig pris|fått tilbud|fatt tilbud/i.test(noteText)) return "offer_sent";
    return "";
  }

  function leadPreset(customer) {
    return null;
  }

  function isManualLead(customer) {
    return /\bleadstatus\s*:/i.test(`${customer?.tags || ""} ${customer?.local_note || ""}`);
  }

  function isAutoLead(customer) {
    return false;
  }

  function isLeadCustomer(customer) {
    if (!customer) return false;
    if (leadForCustomer(customer)) return true;
    const status = leadStatusFromTags(customer);
    if (status) return true;
    return isManualLead(customer) || Boolean(leadPreset(customer)) || isAutoLead(customer);
  }

  function leadStatusFromDb(status) {
    const normalized = String(status || "").toLowerCase();
    const map = {
      followup: "followup",
      needs_offer: "needs_offer",
      offer_sent: "offer_sent",
      new: "followup",
      contacted: "followup",
      qualified: "followup",
      site_visit_booked: "followup",
      follow_up: "followup",
      quote_needed: "needs_offer",
      quote_sent: "offer_sent",
      won: "won",
      lost: "lost",
    };
    return map[normalized] || "";
  }

  function leadCustomerId(lead) {
    return lead?.existing_customer_id || lead?.converted_customer_id || "";
  }

  function leadForCustomer(customer) {
    const key = customerKey(customer);
    if (!key) return null;
    return leads.find((lead) => leadCustomerId(lead) === key) || null;
  }

  function latestActivityForLead(lead) {
    if (!lead?.id) return null;
    return activities.find((activity) => activity.lead_id === lead.id) || null;
  }

  function latestNoteActivityForLead(lead) {
    if (!lead?.id) return null;
    return activities.find((activity) => (
      activity.lead_id === lead.id
      && !["status_change", "lead_status"].includes(String(activity.activity_type || "").toLowerCase())
    )) || null;
  }

  function leadNoteFromDb(lead) {
    if (!lead) return "";
    const activity = latestNoteActivityForLead(lead);
    if (String(activity?.activity_type || "").toLowerCase() === "note") return String(activity.body || "").trim();
    return String(activity?.body || lead.note || lead.product_interest || lead.source_detail || "").trim();
  }

  function leadStatusForCustomer(customer) {
    const dbLead = leadForCustomer(customer);
    const dbStatus = leadStatusFromDb(dbLead?.status);
    const tagged = leadStatusFromTags(customer);
    if (tagged && tagged !== "followup") return tagged;
    if (dbStatus && dbStatus !== "followup") return dbStatus;
    const preset = leadPreset(customer);
    if (preset?.status) return preset.status;
    if (/tapt/i.test(String(customer?.latest_deal_status || ""))) return "lost";
    const noteText = `${customer?.local_note || ""} ${customer?.latest_deal_name || ""}`;
    const noteStatus = leadStatusFromFollowupText(noteText);
    if (noteStatus) return noteStatus;
    if (tagged) return tagged;
    if (dbStatus) return dbStatus;
    return "followup";
  }

  function leadNoteForCustomer(customer) {
    const dbNote = leadNoteFromDb(leadForCustomer(customer));
    if (dbNote) return dbNote;
    const preset = leadPreset(customer);
    return String(customer?.local_note || preset?.note || customer?.latest_deal_name || "").trim();
  }

  function leadBadgeHtml(customer) {
    if (!isLeadCustomer(customer)) return "";
    const status = leadStatusForCustomer(customer);
    return leadBadgeForStatus(status);
  }

  function leadBadgeForStatus(status) {
    return `<span class="lead-badge ${escapeHtml(status)}" title="${escapeHtml(leadStatusHelp(status))}">${escapeHtml(leadStatusLabel(status))}</span>`;
  }

  function nextTagsWithLeadStatus(customer, status) {
    const kept = splitTags(customer?.tags).filter((tag) => !/^lead(status)?\s*:/i.test(tag) && !/^lead$/i.test(tag));
    if (status) {
      kept.unshift(`Leadstatus: ${leadStatusLabel(status)}`);
      kept.unshift("Lead");
    }
    return uniqueTags(kept);
  }

  async function syncLeadRecord(customer, status, note) {
    if (!store.isConfigured || !store.saveLeadFromCustomer || !customer) return;
    const saved = await store.saveLeadFromCustomer(customer, status || leadStatusForCustomer(customer), note || leadNoteForCustomer(customer));
    if (!saved) return;
    const index = leads.findIndex((lead) => lead.id === saved.id);
    if (index >= 0) leads[index] = saved;
    else leads.unshift(saved);
    return saved;
  }

  function leadStatusDetailLines(status, details = {}) {
    const lines = [`Status satt til: ${leadStatusLabel(status)}.`];
    const product = String(details.productInterest || details.product || "").trim();
    const accessories = String(details.accessories || "").trim();
    const note = String(details.note || "").trim();
    if (product) lines.push(`Varmepumpe/produkt: ${product}`);
    if (accessories) lines.push(`Tilbehør/tillegg: ${accessories}`);
    if (details.installationLabel) lines.push(`Gjelder anlegg: ${details.installationLabel}`);
    if (note) lines.push(`Notat: ${note}`);
    return lines;
  }

  function leadStatusDetailBody(status, details = {}) {
    return leadStatusDetailLines(status, details).join("\n");
  }

  function leadStatusPatch(status, details = {}) {
    const patch = { status };
    const product = String(details.productInterest || details.product || "").trim();
    if (product) patch.product_interest = product;
    return patch;
  }

  async function setLeadStatus(customerId, status, details = {}) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const dbLead = leadForCustomer(customer);
    const statusBody = leadStatusDetailBody(status, details);
    if (dbLead?.id && store.updateLead) {
      const updatedLead = updateLeadInMemory(await store.updateLead(dbLead.id, leadStatusPatch(status, details)));
      await saveLeadStatusActivity(updatedLead, status, customer, details);
      await saveServiceEvent(customer, {
        event_date: isoDate(new Date()),
        event_type: "Oppfølgingsstatus",
        note: statusBody,
      });
      selectedLeadId = `lead:${updatedLead.id}`;
      focusLeadQueueForStatus(status);
      renderAll();
      setView("leads");
      setSyncStatus(`Sak satt til: ${leadStatusLabel(status)}.`, "ok");
      return;
    }
    const saved = await saveCustomerInline(customer, { tags: nextTagsWithLeadStatus(customer, status) }, "");
    const syncedLead = await syncLeadRecord(saved || customer, status, statusBody);
    await saveServiceEvent(customer, {
      event_date: isoDate(new Date()),
      event_type: "Oppfølgingsstatus",
      note: statusBody,
    });
    selectedLeadId = syncedLead?.id ? `lead:${syncedLead.id}` : customerKey(saved || customer) || customerId;
    focusLeadQueueForStatus(status || leadStatusForCustomer(saved || customer));
    renderAll();
    setView("leads");
    setSyncStatus(status ? `Sak satt til: ${leadStatusLabel(status)}.` : "Oppfølgingsstatus fjernet.", "ok");
  }

  function updateLeadInMemory(lead) {
    if (!lead?.id) return lead;
    const index = leads.findIndex((item) => item.id === lead.id);
    if (index >= 0) leads[index] = lead;
    else leads.unshift(lead);
    return lead;
  }

  async function saveLeadStatusActivity(lead, status, customer = null, details = {}) {
    await saveActivityRecord({
      customer_id: (customer ? customerKey(customer) : leadCustomerId(lead)) || null,
      lead_id: lead.id,
      activity_type: "status_change",
      summary: `Oppfølging: ${leadStatusLabel(status)}`,
      body: leadStatusDetailBody(status, details),
      metadata: {
        source: "lead_detail",
        product_interest: String(details.productInterest || details.product || "").trim() || null,
        accessories: String(details.accessories || "").trim() || null,
        installation_id: details.installationId || null,
      },
    });
  }

  function leadEntryForTarget(target) {
    return allLeadEntries().find((entry) => leadEntryKey(entry) === target || leadEntryCustomerKey(entry) === target) || null;
  }

  async function setLeadRecordStatus(entryKey, status, details = {}) {
    const entry = leadEntryForTarget(entryKey);
    if (!entry?.lead?.id) throw new Error("Fant ikke henvendelsen.");
    let updatedLead = null;
    const realCustomer = entry.customer ? findCustomer(leadEntryCustomerKey(entry)) : null;
    if (store.isConfigured && store.updateLead) {
      updatedLead = updateLeadInMemory(await store.updateLead(entry.lead.id, leadStatusPatch(status, details)));
      await saveLeadStatusActivity(updatedLead, status, realCustomer, details);
    } else {
      updatedLead = updateLeadInMemory(saveLocalLeadPatch(entry.lead.id, leadStatusPatch(status, details)));
    }
    if (realCustomer) {
      await saveCustomerInline(realCustomer, { tags: nextTagsWithLeadStatus(realCustomer, status) }, "");
      await saveServiceEvent(realCustomer, {
        event_date: isoDate(new Date()),
        event_type: "Oppfølgingsstatus",
        note: leadStatusDetailBody(status, details),
      });
    }
    selectedLeadId = `lead:${updatedLead.id}`;
    focusLeadQueueForStatus(status || "followup");
    renderAll();
    setView("leads");
    setSyncStatus(`Sak satt til: ${leadStatusLabel(status)}.`, "ok");
  }

  async function setLeadStatusTarget(target, status, details = {}) {
    if (String(target || "").startsWith("lead:")) return setLeadRecordStatus(target, status, details);
    return setLeadStatus(target, status, details);
  }

  async function saveLeadNote(customerId, note) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const tags = isLeadCustomer(customer) ? customer.tags : nextTagsWithLeadStatus(customer, "followup");
    const saved = await saveCustomerInline(customer, { local_note: note.trim(), tags }, "");
    await syncLeadRecord(saved || customer, leadStatusForCustomer(saved || customer), note.trim());
    await saveServiceEvent(customer, {
      event_date: isoDate(new Date()),
      event_type: "Leadnotat",
      note: note.trim() || "Leadnotat ryddet.",
    });
    selectedLeadId = customerId;
    setSyncStatus("Leadnotat lagret.", "ok");
  }

  async function saveLeadRecordNote(entryKey, note) {
    const entry = leadEntryForTarget(entryKey);
    if (!entry?.lead?.id) throw new Error("Fant ikke henvendelsen.");
    const customerId = leadCustomerId(entry.lead) || "";
    if (store.isConfigured) {
      await saveActivityRecord({
        customer_id: customerId || null,
        lead_id: entry.lead.id,
        activity_type: "note",
        summary: note.trim() ? "Leadnotat" : "Leadnotat ryddet",
        body: note.trim() || null,
        metadata: { source: "lead_detail" },
      });
    } else {
      saveLocalLeadPatch(entry.lead.id, { note: note.trim() });
    }
    selectedLeadId = `lead:${entry.lead.id}`;
    renderAll();
    setView("leads");
    setSyncStatus("Leadnotat lagret.", "ok");
  }

  async function saveLeadNoteTarget(target, note) {
    if (String(target || "").startsWith("lead:")) return saveLeadRecordNote(target, note);
    return saveLeadNote(target, note);
  }

  function leadNoteTimestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${formatDate(isoDate(now))} kl. ${hh}:${mm}`;
  }

  async function appendLeadNoteTarget(target, note) {
    const clean = String(note || "").trim();
    if (!clean) throw new Error("Skriv et kort notat først.");
    const entry = leadEntryForTarget(target);
    const existing = leadNoteForEntry(entry).trim();
    const next = [`${leadNoteTimestamp()}: ${clean}`, existing].filter(Boolean).join("\n\n");
    return saveLeadNoteTarget(target, next);
  }

  async function setLeadInactive(customerId) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const ok = await askForConfirmation({
      title: "Skjul sak",
      message: "Skjule denne gamle leadmarkeringen fra innboksen? Kundekortet beholdes.",
      confirmLabel: "Skjul sak",
      tone: "danger",
    });
    if (!ok) return;
    const tags = uniqueTags(splitTags(customer.tags).filter((tag) => !isLegacyLeadTag(tag)));
    await saveCustomerInline(customer, { tags }, "");
    selectedLeadId = leadEntryKey(allLeadEntries()[0]) || "";
    renderAll();
    setSyncStatus("Saken er skjult. Kundekortet er beholdt.", "ok");
  }

  async function deleteLeadEntry(entryKey) {
    const entry = leadEntryForTarget(entryKey);
    if (!entry?.lead?.id) throw new Error("Fant ikke henvendelsen som skulle slettes.");
    const customer = entry.customer ? findCustomer(leadEntryCustomerKey(entry)) : null;
    const ok = await askForConfirmation({
      title: "Slett sak",
      message: `Slette saken for ${cleanDisplayName(entry.customer)}? Kundekort slettes ikke.`,
      confirmLabel: "Slett sak",
      tone: "danger",
    });
    if (!ok) return;
    if (store.isConfigured) {
      if (!store.deleteLead) throw new Error("Sletting av saker krever oppdatert Supabase-adapter.");
      await store.deleteLead(entry.lead.id);
    } else {
      deleteLocalLead(entry.lead.id);
    }
    leads = leads.filter((lead) => lead.id !== entry.lead.id);
    if (customer) {
      const tags = uniqueTags(splitTags(customer.tags).filter((tag) => !isLegacyLeadTag(tag)));
      await saveCustomerInline(customer, { tags }, "");
    }
    selectedLeadId = leadEntryKey(allLeadEntries()[0]) || "";
    renderAll();
    setView("leads");
    setSyncStatus("Saken er slettet. Kundekortet er beholdt.", "ok");
  }

  function leadStatusControlHtml(customer, statusOverride = "", targetKey = "") {
    const key = targetKey || customerKey(customer);
    const current = statusOverride || leadStatusForCustomer(customer);
    const options = Object.entries(leadStatuses).map(([value, info]) => (
      `<option value="${value}" ${current === value ? "selected" : ""}>${escapeHtml(info.label)}</option>`
    )).join("");
    return `
      <label class="lead-status-control">Status
        <select data-lead-status-customer="${escapeHtml(key)}" title="Velg neste steg for denne saken.">
          ${options}
        </select>
      </label>
    `;
  }

  function compactPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length >= 8 ? digits.slice(-8) : digits;
  }

  function aiRegistrationTypeLabel(type) {
    return aiRegistrationTypes[type]?.label || aiRegistrationTypes.lead.label;
  }

  function aiRegistrationTypeOptions(selected) {
    return Object.entries(aiRegistrationTypes).map(([value, item]) => (
      `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(item.label)}</option>`
    )).join("");
  }

  function firstMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = String(text || "").match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return "";
  }

  function cleanAiLine(value) {
    return String(value || "")
      .replace(/^[>\-\s]+/, "")
      .replace(/\s+/g, " ")
      .replace(/[.,;:]+$/, "")
      .trim();
  }

  function leadManualStatusActionsHtml(leadTarget, currentStatus, realCustomer) {
    const rows = [
      ["needs_offer", "Tilbud må sendes", "Legg saken i tilbudskøen."],
      ["offer_sent", "Tilbud sendt", "Marker manuelt at tilbud er sendt og venter på svar."],
      ["won", "Vunnet", "Kunden har takket ja. Da bør det opprettes jobb."],
      ["lost", "Tapt", "Avslutt saken når kunden ikke skal gå videre."],
    ];
    return rows.map(([value, label, title]) => {
      if (value === currentStatus) {
        return `<span class="lead-current-status" title="Dette er gjeldende status nå.">${escapeHtml(label)} nå</span>`;
      }
      return `<button class="secondary" data-lead-set-status="${escapeHtml(value)}" data-lead-status-customer="${escapeHtml(leadTarget)}" type="button" title="${escapeHtml(title)}">${escapeHtml(label)}</button>`;
    }).join("")
      + (realCustomer && currentStatus !== "followup"
        ? `<button class="secondary" data-lead-set-status="followup" data-lead-status-customer="${escapeHtml(leadTarget)}" type="button" title="Flytt saken tilbake til Må kontaktes hvis den må avklares på nytt.">Gjenåpne</button>`
        : "");
  }

  function cleanAiNameCandidate(value) {
    return cleanAiLine(String(value || "")
      .replace(/\s*[.!?]\s+(?:kan|kunne|onsker|\u00f8nsker|vil|trenger|har|skal|ma|m\u00e5|er|det|jeg|vi|dere|kontakt)\b.*$/i, "")
      .replace(/\s+(?:kan dere|kan du|kunne dere|kunne du|kontakt meg|ta kontakt|ring meg)\b.*$/i, "")
      .replace(/\b(?:mob|telefon|tlf|adresse|mailadresse|mail|e-post|postnr|sted)\b.*$/i, "")
      .replace(/^(?:ny\s+)?(?:henvendelse|forespørsel|foresporsel|melding|lead)\s+(?:fra\s+)?/i, "")
      .replace(/^(?:fra\s+)?(?:nettside|webskjema|web|kontaktskjema|skjema|facebook|e-post|mail|sms)\s*[:\-]\s*/i, "")
      .split(/[;,]/)[0]);
  }

  function intakeEngine() {
    return window.NumedalIntake || null;
  }

  function intakeFieldValue(field) {
    return String(field?.value || "").trim();
  }

  function intakeFieldConfidence(field) {
    return field?.confidence || "low";
  }

  function intakeConfidenceLabel(value) {
    const map = { high: "Høy sikkerhet", medium: "Middels sikkerhet", low: "Usikkert" };
    return map[value] || "Usikkert";
  }

  function extractAiEmail(text) {
    const engine = intakeEngine();
    if (engine?.extractEmails) {
      return engine.extractEmails(text).find((item) => !item.own)?.value || "";
    }
    return (String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "").trim();
  }

  function extractAiPhones(text) {
    const engine = intakeEngine();
    if (engine?.extractPhones) {
      return engine.extractPhones(text).filter((item) => !item.rejected && !item.own).map((item) => item.value);
    }
    const matches = String(text || "").match(/(?:\+47\s*)?(?:\d[\s.\-]*){8}/g) || [];
    return [...new Set(matches.map(compactPhone).filter((phone) => phone.length === 8))];
  }

  function extractAiName(text) {
    const explicit = firstMatch(text, [
      /^\s*(?:navn|kunde)\s*:\s*([^\n\r]+)/im,
      /henvendelse\s+fra\s+([^\n\r]+)/i,
      /(?:med vennlig hilsen|mvh\.?|hilsen(?:\s+(?:fra|frs))?)\s*:?\s*([A-ZÆØÅ][^\n\r]{2,70})/i,
    ]);
    if (explicit) return cleanAiNameCandidate(explicit);
    const lines = String(text || "")
      .split(/\r?\n/)
      .map(cleanAiLine)
      .filter(Boolean)
      .reverse();
    const ignored = /(hei|sender|melding|ref|telefon|adresse|postnr|sted|mvh|hilsen|takk|www|http|varmepumpe|service|befaring|tilbud|mvh gunnar|numedal)/i;
    const candidate = lines.find((line) => {
      if (ignored.test(line) || /\d|@/.test(line)) return false;
      const words = line.split(/\s+/).filter(Boolean);
      return words.length >= 2 && words.length <= 5 && words.every((word) => /^[A-ZÆØÅa-zæøå.'-]+$/.test(word));
    });
    return candidate || "";
  }

  function splitAddressParts(line) {
    const value = cleanAiLine(line).replace(/\s+er\s+riktig$/i, "");
    const zipMatch = value.match(/\b(\d{4})\s+([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]+)$/);
    const zip = zipMatch?.[1] || "";
    const city = cleanAiLine(zipMatch?.[2] || "");
    const street = cleanAiLine(zipMatch ? value.slice(0, zipMatch.index) : value).replace(/,+$/, "");
    return { street, zip, city };
  }

  function extractAiAddress(text) {
    const explicitStreet = firstMatch(text, [/^\s*adresse\s*:\s*([^\n\r]+)/im]);
    const explicitZip = firstMatch(text, [/^\s*postnr\.?\s*:\s*(\d{4})/im]);
    const explicitCity = firstMatch(text, [/^\s*sted\s*:\s*([^\n\r]+)/im]);
    if (explicitStreet) {
      const parts = splitAddressParts(explicitStreet);
      const zip = explicitZip || parts.zip;
      const city = cleanAiLine(explicitCity && !/\[.*\]/.test(explicitCity) ? explicitCity : (parts.city || postalCityByZip[zip] || ""));
      return { street: parts.street, zip, city };
    }

    const withZip = String(text || "").match(/([A-ZÆØÅ][A-Za-zÆØÅæøå0-9 .,'-]{3,80}?\s+\d+[A-Za-z]?)\s*,?\s+(\d{4})\s+([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]+)/);
    if (withZip) {
      return {
        street: cleanAiLine(withZip[1]),
        zip: withZip[2],
        city: cleanAiLine(withZip[3]),
      };
    }

    const streetPattern = /([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]*(?:veien|vegen|vei|veg|gata|gate|stien|lia|bakken|svingen|tunet|reset|jordet|berget|åsen|plassen|ringen|myra|toppen|kollen|hagan|høgda|høyda|smiuberget|tunmarcks vei|middelthunsvei)\s+\d+[A-Za-z]?)(?:\s*,?\s*([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]+))?/i;
    const streetMatch = String(text || "").match(streetPattern);
    if (!streetMatch) return { street: "", zip: "", city: "" };
    let city = cleanAiLine(streetMatch[2] || "");
    if (/^(er riktig|er rikti|som avtalt|ref tlf|mvh|og de|hei)$/i.test(city)) city = "";
    return { street: cleanAiLine(streetMatch[1]), zip: "", city };
  }

  function inferAiRegistrationType(text) {
    const engine = intakeEngine();
    if (engine?.analyzeText) {
      const analysis = engine.analyzeText(text);
      const category = analysis?.intent?.category || "";
      if (category === "insulation" || category === "rental") return "blaseisolering";
      if (category === "site_visit_request") return "befaring";
      if (category === "quote_accepted") return "installasjon";
      if (["service_request", "repair_request"].includes(category)) return "service";
      return "lead";
    }
    const normalized = normalizeMatch(text);
    if (/\b(blaseisolering|isobygg|isolering|supafil|stubbloft|sagflis|kutterflis|industristovsuger|stovsuger)\b/.test(normalized)) return "blaseisolering";
    if (/\b(befaring|komme pa en befaring|pa befaring)\b/.test(normalized)) return "befaring";
    if (/\b(aksepterer tilbud|bekreftet tilbud|godtar tilbud|onsker a bestille|ønsker å bestille|sett oss opp)\b/.test(normalized)) return "installasjon";
    if (/\b(service|flytting|flytte|dryppanne|dempet veggbrakett|vibrasjonsdempere|isklump|avgir vann|varmepumpa)\b/.test(normalized)) return "service";
    return "lead";
  }

  function aiTagsForType(type) {
    return uniqueTags(aiRegistrationTypes[type]?.tags || []);
  }

  function aiProjectDetailNote(analysis) {
    const project = analysis?.project || {};
    const lines = [
      intakeFieldValue(project.squareMeters) ? `Areal: ${intakeFieldValue(project.squareMeters)} m2` : "",
      intakeFieldValue(project.thicknessCm) ? `Tykkelse: ${intakeFieldValue(project.thicknessCm)} cm` : "",
      intakeFieldValue(project.construction) ? `Konstruksjon: ${intakeFieldValue(project.construction)}` : "",
      intakeFieldValue(project.buildYear) ? `Byggeår: ${intakeFieldValue(project.buildYear)}` : "",
      intakeFieldValue(project.estimate) ? `Estimert pris: ${intakeFieldValue(project.estimate)}` : "",
      intakeFieldValue(project.customerInfo) ? `Tilleggsinfo: ${intakeFieldValue(project.customerInfo)}` : "",
    ].filter(Boolean);
    return lines.length ? `Prosjektdetaljer fra e-post/skjema:\n${lines.join("\n")}` : "";
  }

  function parseAiRegistrationText(text, serverAnalysis = null) {
    const raw = String(text || "").trim();
    const analysis = serverAnalysis || (intakeEngine()?.analyzeText
      ? intakeEngine().analyzeText(raw)
      : null);
    const contact = analysis?.contacts?.[0] || {};
    const location = analysis?.locations?.[0] || {};
    const equipment = analysis?.equipment?.[0] || {};
    const phones = extractAiPhones(raw);
    const email = intakeFieldValue(contact.email) || extractAiEmail(raw);
    const address = analysis
      ? {
          street: intakeFieldValue(location.street),
          zip: intakeFieldValue(location.postalCode),
          city: intakeFieldValue(location.city),
        }
      : extractAiAddress(raw);
    const type = analysis
      ? (analysis.intent?.category === "insulation" || analysis.intent?.category === "rental" ? "blaseisolering"
        : analysis.intent?.category === "site_visit_request" ? "befaring"
          : analysis.intent?.category === "quote_accepted" ? "installasjon"
            : ["service_request", "repair_request"].includes(analysis.intent?.category) ? "service"
              : "lead")
      : inferAiRegistrationType(raw);
    const name = intakeFieldValue(contact.name) || extractAiName(raw);
    const brand = intakeFieldValue(equipment.brand);
    const model = intakeFieldValue(equipment.model);
    const note = [
      `${aiRegistrationTypeLabel(type)} foreslått fra hurtigregistrering ${weekdayDate(isoDate(new Date()), { long: true })}.`,
      aiProjectDetailNote(analysis),
      [brand, model].filter(Boolean).length ? `Varmepumpe/produkt: ${[brand, model].filter(Boolean).join(" ")}` : "",
    ].filter(Boolean).join("\n\n");
    return {
      raw,
      analysis,
      type,
      name,
      phone: intakeFieldValue(contact.phone) || phones[0] || "",
      email,
      street: address.street,
      zip: address.zip,
      city: address.city || postalCityByZip[address.zip] || "",
      tags: aiTagsForType(type),
      note,
      brand,
      model,
      action: type === "history" ? "append_existing" : "create_customer",
    };
  }

  function aiRegistrationFormValues() {
    return {
      action: document.getElementById("aiRegistrationAction")?.value || aiRegistrationDraft?.action || "create_customer",
      type: document.getElementById("aiRegistrationType")?.value || aiRegistrationDraft?.type || "lead",
      name: document.getElementById("aiRegistrationName")?.value.trim() || "",
      phone: document.getElementById("aiRegistrationPhone")?.value.trim() || "",
      email: document.getElementById("aiRegistrationEmail")?.value.trim() || "",
      street: document.getElementById("aiRegistrationStreet")?.value.trim() || "",
      zip: document.getElementById("aiRegistrationZip")?.value.trim() || "",
      city: document.getElementById("aiRegistrationCity")?.value.trim() || "",
      tags: document.getElementById("aiRegistrationTags")?.value.trim() || "",
      brand: document.getElementById("aiRegistrationBrand")?.value.trim() || aiRegistrationDraft?.brand || "",
      model: document.getElementById("aiRegistrationModel")?.value.trim() || aiRegistrationDraft?.model || "",
      note: document.getElementById("aiRegistrationNote")?.value.trim() || "",
      keepOriginal: document.getElementById("aiRegistrationKeepOriginal")?.checked ?? true,
      raw: aiRegistrationDraft?.raw || "",
    };
  }

  function aiCustomerSearchText(customer) {
    return [
      cleanDisplayName(customer),
      customer.phone,
      customer.email,
      customer.visit_street,
      customer.visit_zip,
      customer.visit_city,
      customer.tags,
    ].filter(Boolean).join(" ");
  }

  function aiRegistrationCandidates(values = aiRegistrationFormValues()) {
    const engine = intakeEngine();
    const activeCustomers = customers.filter((customer) => customer && !customer.is_inactive);
    if (engine?.matchCustomers) {
      return engine.matchCustomers(values, activeCustomers).map((item) => ({
        customer: item.customer,
        score: item.score,
        reasons: item.reasons || [],
      }));
    }
    const phone = compactPhone(values.phone);
    const email = normalizeMatch(values.email);
    const name = normalizeMatch(values.name);
    const street = normalizeMatch(values.street);
    const city = normalizeMatch(values.city);
    return activeCustomers
      .map((customer) => {
        let score = 0;
        const customerPhone = compactPhone(customer.phone);
        const customerEmail = normalizeMatch(customer.email);
        const customerName = normalizeMatch(cleanDisplayName(customer));
        const customerStreet = normalizeMatch(customer.visit_street);
        const customerCity = normalizeMatch(customer.visit_city || customer.location_tag);
        if (phone && customerPhone && phone === customerPhone) score += 120;
        if (email && customerEmail && email === customerEmail) score += 120;
        if (name && customerName === name) score += 80;
        else if (name && customerName.includes(name)) score += 45;
        else if (name && name.includes(customerName) && customerName.length > 4) score += 35;
        if (street && customerStreet && (customerStreet.includes(street) || street.includes(customerStreet))) score += 45;
        if (city && customerCity && customerCity.includes(city)) score += 15;
        return { customer, score, reasons: [] };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || cleanDisplayName(a.customer).localeCompare(cleanDisplayName(b.customer), "nb-NO"))
      .slice(0, 5);
  }

  function renderAiRegistrationCandidates() {
    const list = document.getElementById("aiRegistrationCandidates");
    const selected = document.getElementById("aiRegistrationSelectedCustomer");
    if (!list || !selected) return;
    const values = aiRegistrationFormValues();
    const candidates = aiRegistrationCandidates(values);
    const selectedCustomer = findCustomer(aiRegistrationSelectedCustomerId);
    selected.innerHTML = selectedCustomer
      ? `<strong>Kobles til valgt kunde:</strong> ${escapeHtml(cleanDisplayName(selectedCustomer))} <button data-ai-clear-customer type="button">Fjern kobling</button>`
      : "<strong>Ingen kunde valgt.</strong> Velg et treff hvis saken hører til en eksisterende kunde, ellers opprettes nytt kundekort.";
    if (!candidates.length) {
      list.innerHTML = `<div class="empty-state">Ingen sikre treff. Lagring oppretter nytt kundekort og kobler saken dit.</div>`;
      return;
    }
    list.innerHTML = candidates.map(({ customer, score, reasons }) => {
      const key = customerKey(customer);
      const active = key === aiRegistrationSelectedCustomerId;
      const reasonText = (reasons || []).length ? reasons.join(", ") : (score >= 100 ? "sterk match" : "mulig treff");
      return `
        <button class="${active ? "active" : ""}" data-ai-candidate="${escapeHtml(key)}" type="button">
          <strong>${escapeHtml(cleanDisplayName(customer))}</strong>
          <span>${escapeHtml([customer.visit_city || customer.location_tag, customer.phone, customer.visit_street].filter(Boolean).join(" · ") || "Lite info")}</span>
          <small>${score >= 100 ? "Svært sannsynlig treff" : "Mulig treff"}: ${escapeHtml(reasonText)}</small>
        </button>
      `;
    }).join("");
  }

  function aiRegistrationActionOptions(selected) {
    const options = [
      ["create_customer", "Opprett kundekort + oppfølging"],
      ["append_existing", "Legg på valgt kundekort"],
      ["history_only", "Kun historikk på valgt kundekort"],
    ];
    return options.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
  }

  function aiRegistrationWarningsHtml(analysis) {
    const warnings = analysis?.warnings || [];
    if (!warnings.length) {
      return `<div class="ai-warning-list ok" title="Kontroller navn, telefon og adresse før lagring."><strong>Ingen kritiske advarsler</strong></div>`;
    }
    return `<div class="ai-warning-list">${warnings.map((warning) => `
      <article class="${escapeHtml(warning.severity || "warning")}">
        <strong>${escapeHtml(warning.severity === "critical" ? "Kritisk" : warning.severity === "info" ? "Info" : "Sjekk")}</strong>
        <span>${escapeHtml(warning.message || warning.code || "")}</span>
      </article>
    `).join("")}</div>`;
  }

  function aiFieldMetaHtml(label, field) {
    if (!field?.evidence && !field?.confidence) return "";
    const confidence = intakeConfidenceLabel(intakeFieldConfidence(field));
    const evidence = field?.evidence ? `Kilde: ${String(field.evidence).slice(0, 180)}` : `${label}: ${confidence}`;
    return `<small class="ai-field-meta" title="${escapeHtml(evidence)}">${escapeHtml(confidence)}</small>`;
  }

  function renderAiRegistrationDraft() {
    if (!el.aiRegistrationDraft || !aiRegistrationDraft) return;
    const analysis = aiRegistrationDraft.analysis || null;
    const contact = analysis?.contacts?.[0] || {};
    const location = analysis?.locations?.[0] || {};
    const equipment = analysis?.equipment?.[0] || {};
    const suggestedAction = analysis?.recommendedAction || "manual_review";
    const parserLabel = /(server|supabase|edge)/i.test(analysis?.parser || "")
      ? "Serveranalyse"
      : "Lokal analyse";
    const summaryText = analysis?.summary || "Forslag klart.";
    const parserHelp = `${parserLabel}. Anbefalt handling: ${suggestedAction.replaceAll("_", " ")}. Kontroller feltene før lagring.`;
    const originalTextAlreadyStored = Boolean(aiRegistrationDraft.intakeId);
    el.aiRegistrationDraft.classList.remove("hidden");
    el.aiRegistrationDraft.innerHTML = `
      <div id="aiRegistrationMessage" class="dialog-message hidden"></div>
      <div class="ai-draft-summary">
        <div>
          <span title="${escapeHtml(parserHelp)}">Forslag</span>
          <h3>${escapeHtml(summaryText)}</h3>
        </div>
        <strong>${escapeHtml(aiRegistrationTypeLabel(aiRegistrationDraft.type))}</strong>
      </div>
      ${aiRegistrationWarningsHtml(analysis)}
      ${aiRegistrationLinkHintHtml(aiRegistrationDraft)}
      <div class="ai-draft-grid">
        <div class="ai-draft-form">
          <label>Hva skal lagres?
            <select id="aiRegistrationAction" data-ai-field>${aiRegistrationActionOptions(aiRegistrationDraft.action || "create_customer")}</select>
          </label>
          <label>Hva skal opprettes?
            <select id="aiRegistrationType" data-ai-field>${aiRegistrationTypeOptions(aiRegistrationDraft.type)}</select>
          </label>
          <label>Navn
            <input id="aiRegistrationName" data-ai-field type="text" value="${escapeHtml(aiRegistrationDraft.name)}" placeholder="Kundenavn" />
            ${aiFieldMetaHtml("Navn", contact.name)}
          </label>
          <label>Telefon
            <input id="aiRegistrationPhone" data-ai-field type="text" value="${escapeHtml(aiRegistrationDraft.phone)}" placeholder="Telefon" />
            ${aiFieldMetaHtml("Telefon", contact.phone)}
          </label>
          <label>E-post
            <input id="aiRegistrationEmail" data-ai-field type="email" value="${escapeHtml(aiRegistrationDraft.email)}" placeholder="E-post" />
            ${aiFieldMetaHtml("E-post", contact.email)}
          </label>
          <label>Adresse
            <input id="aiRegistrationStreet" data-ai-field type="text" value="${escapeHtml(aiRegistrationDraft.street)}" placeholder="Anleggsadresse" />
            ${aiFieldMetaHtml("Adresse", location.street)}
          </label>
          <div class="ai-two-cols">
            <label>Postnr
              <input id="aiRegistrationZip" data-ai-field type="text" value="${escapeHtml(aiRegistrationDraft.zip)}" placeholder="3622" />
              ${aiFieldMetaHtml("Postnr", location.postalCode)}
            </label>
            <label>Sted
              <input id="aiRegistrationCity" data-ai-field type="text" value="${escapeHtml(aiRegistrationDraft.city)}" placeholder="Svene" />
              ${aiFieldMetaHtml("Sted", location.city)}
            </label>
          </div>
          <div class="ai-two-cols">
            <label>Merke
              <input id="aiRegistrationBrand" data-ai-field type="text" value="${escapeHtml(aiRegistrationDraft.brand || "")}" placeholder="Panasonic" />
              ${aiFieldMetaHtml("Merke", equipment.brand)}
            </label>
            <label>Modell
              <input id="aiRegistrationModel" data-ai-field type="text" value="${escapeHtml(aiRegistrationDraft.model || "")}" placeholder="NZ25YKE" />
              ${aiFieldMetaHtml("Modell", equipment.model)}
            </label>
          </div>
          <label>Tags
            <input id="aiRegistrationTags" data-ai-field type="text" value="${escapeHtml(aiRegistrationDraft.tags)}" placeholder="Oppfølging; Service; Blåseisolering" />
          </label>
          <label>Notat / historikk
            <textarea id="aiRegistrationNote" rows="8">${escapeHtml(aiRegistrationDraft.note)}</textarea>
          </label>
          <label class="checkbox-line">
            <input id="aiRegistrationKeepOriginal" type="checkbox" ${originalTextAlreadyStored ? "disabled" : "checked"} />
            ${originalTextAlreadyStored ? "Originaltekst ligger allerede i CRM-innboks" : "Behold originaltekst i historikk"}
          </label>
          <div class="ai-save-row">
            <button id="aiRegistrationInboxButton" class="secondary" type="button" title="Legg forslaget i CRM-innboks uten å opprette kunde eller oppfølging ennå.">Lagre i CRM-innboks</button>
            <button id="aiRegistrationSaveButton" type="button">Lagre godkjent forslag</button>
            <span class="compact-help" title="CRM-innboks er bare utkast. Lagre godkjent forslag oppretter eller kobler kunde, oppfølging eller historikk.">?</span>
          </div>
        </div>
        <aside class="ai-match-panel">
          <h3>Mulige eksisterende kunder</h3>
          <p title="Appen foreslår treff, men du velger selv riktig kunde før lagring.">Velg ved treff.</p>
          <div id="aiRegistrationSelectedCustomer" class="ai-selected-customer"></div>
          <div id="aiRegistrationCandidates" class="ai-candidate-list"></div>
          ${aiRegistrationDraft.intakeId ? `
            <div class="ai-stored-attachments">
              <h3>Vedlegg</h3>
              ${crmAttachmentListHtml(attachmentsForIntake(aiRegistrationDraft.intakeId), { compact: true, empty: "Ingen lagrede vedlegg på utkastet." })}
            </div>
          ` : ""}
          <details class="ai-original-source">
            <summary>Originaltekst</summary>
            <pre>${escapeHtml(aiRegistrationDraft.raw || "")}</pre>
          </details>
        </aside>
      </div>
    `;
    renderAiRegistrationCandidates();
  }

  function showAiRegistrationMessage(message, tone = "error") {
    const node = document.getElementById("aiRegistrationMessage");
    if (!node) return;
    node.textContent = message || "";
    node.className = `dialog-message ${tone || ""}`.trim();
  }

  function clearAiRegistrationMessage() {
    const node = document.getElementById("aiRegistrationMessage");
    if (!node) return;
    node.textContent = "";
    node.className = "dialog-message hidden";
  }

  function clearAiRegistration() {
    aiRegistrationDraft = null;
    aiRegistrationSelectedCustomerId = "";
    aiRegistrationAttachments.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    aiRegistrationAttachments = [];
    if (el.aiRegistrationInput) el.aiRegistrationInput.value = "";
    renderAiRegistrationAttachments();
    if (el.aiRegistrationDraft) {
      el.aiRegistrationDraft.classList.add("hidden");
      el.aiRegistrationDraft.innerHTML = "";
    }
  }

  function aiRegistrationFinalJson(values = aiRegistrationFormValues()) {
    return {
      action: values.action || null,
      type: values.type || null,
      name: values.name || null,
      phone: values.phone || null,
      email: values.email || null,
      street: values.street || null,
      zip: values.zip || null,
      city: values.city || null,
      tags: values.tags || null,
      brand: values.brand || null,
      model: values.model || null,
      note: values.note || null,
      keepOriginal: Boolean(values.keepOriginal),
    };
  }

  async function saveAiRegistrationInboxDraft() {
    if (!aiRegistrationDraft) throw new Error("Lag et forslag først.");
    if (!store.isConfigured || !store.saveIntakeDraft) {
      throw new Error("CRM-innboks krever Supabase. Bruk Lagre godkjent forslag lokalt hvis du tester uten database.");
    }
    const values = aiRegistrationFormValues();
    const saved = aiRegistrationDraft.intakeId && store.updateIntakeItem
      ? await store.updateIntakeItem(aiRegistrationDraft.intakeId, {
          status: "needs_review",
          selected_action: values.action,
          linked_customer_id: aiRegistrationSelectedCustomerId || null,
          analysis_json: aiRegistrationDraft.analysis || {},
          final_json: aiRegistrationFinalJson(values),
        })
      : await store.saveIntakeDraft({
          ...values,
          analysis: aiRegistrationDraft.analysis || {},
          customer_id: aiRegistrationSelectedCustomerId || null,
          source_kind: aiRegistrationDraft.analysis?.source?.kind || "pasted_text",
          source_channel: "crm_hurtigregistrering",
          attachment_count: aiRegistrationAttachments.length,
        });
    await persistAiRegistrationAttachments({
      intake_id: saved.id,
      customer_id: aiRegistrationSelectedCustomerId || null,
      source_kind: "hurtigregistrering",
      note: "Vedlagt CRM-innboksutkast.",
    });
    intakeItems = [saved, ...intakeItems.filter((row) => row.id !== saved.id)];
    aiRegistrationDraft.intakeId = saved.id;
    renderDashboard();
    showAiRegistrationMessage("Lagret i CRM-innboks. Det er ikke opprettet kunde/oppfølging ennå.", "ok");
    setSyncStatus("Hurtigregistrering lagret i CRM-innboks for senere kontroll.", "ok");
  }

  async function markIntakeCommitted(intakeId, patch = {}) {
    if (!intakeId || !store.updateIntakeItem) return null;
    const updated = await store.updateIntakeItem(intakeId, {
      ...patch,
      status: "committed",
    });
    intakeItems = intakeItems.filter((row) => row.id !== intakeId);
    renderDashboard();
    return updated;
  }

  function renderAiRegistrationAttachments() {
    if (!el.aiRegistrationAttachments) return;
    el.aiRegistrationAttachments.classList.toggle("hidden", aiRegistrationAttachments.length === 0);
    el.aiRegistrationAttachments.innerHTML = aiRegistrationAttachments.map((item, index) => `
      <article>
        <img src="${escapeHtml(item.previewUrl || "")}" alt="Vedlagt skjermbilde ${index + 1}" />
        <div>
          <strong>${escapeHtml(item.name || `Skjermbilde ${index + 1}`)}</strong>
          <span>${escapeHtml(item.type || "bilde")} · ${Math.round((item.size || 0) / 1024).toLocaleString("nb-NO")} kB</span>
          <small>Lagres som privat CRM-vedlegg når du lagrer i innboks eller på kunde/oppfølging.</small>
        </div>
        <button data-remove-ai-attachment="${index}" type="button" title="Fjern dette bildet">Fjern</button>
      </article>
    `).join("");
  }

  function addAiRegistrationFiles(files) {
    const accepted = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
    const incoming = Array.from(files || []);
    const room = Math.max(0, 5 - aiRegistrationAttachments.length);
    for (const file of incoming.slice(0, room)) {
      if (!accepted.includes(file.type)) {
        setSyncStatus(`Filtypen ${file.type || "ukjent"} støttes ikke i hurtigregistrering.`, "error");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setSyncStatus("Bildet er over 10 MB og ble ikke lagt til.", "error");
        continue;
      }
      aiRegistrationAttachments.push({
        file,
        name: file.name || "skjermbilde",
        size: file.size,
        type: file.type,
        previewUrl: URL.createObjectURL(file),
      });
    }
    renderAiRegistrationAttachments();
  }

  function attachmentFileKind(attachment) {
    const type = String(attachment?.mime_type || attachment?.type || "").toLowerCase();
    if (type.startsWith("image/")) return "Bilde";
    if (type === "application/pdf") return "PDF";
    return "Vedlegg";
  }

  function attachmentSizeLabel(bytes) {
    const size = Number(bytes || 0);
    if (!size) return "";
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toLocaleString("nb-NO", { maximumFractionDigits: 1 })} MB`;
    return `${Math.max(1, Math.round(size / 1024)).toLocaleString("nb-NO")} kB`;
  }

  function attachmentTitle(attachment, index = 0) {
    return attachment?.title || attachment?.original_filename || `Vedlegg ${index + 1}`;
  }

  function attachmentsForCustomer(customer) {
    const key = customer?.id || customerKey(customer);
    return key ? (crmAttachmentsByCustomer.get(String(key)) || []) : [];
  }

  function attachmentsForLead(entry, customer) {
    const leadId = entry?.lead?.id || "";
    if (leadId) return crmAttachmentsByLead.get(String(leadId)) || [];
    return attachmentsForCustomer(customer);
  }

  function attachmentsForInstallation(installation) {
    return installation?.id ? (crmAttachmentsByInstallation.get(String(installation.id)) || []) : [];
  }

  function attachmentsForJob(job) {
    return job?.id ? (crmAttachmentsByJob.get(String(job.id)) || []) : [];
  }

  function findInstallationById(id) {
    const wanted = String(id || "");
    if (!wanted) return null;
    for (const list of installationsByCustomer.values()) {
      const found = (list || []).find((installation) => String(installation.id || "") === wanted);
      if (found) return found;
    }
    return null;
  }

  function attachmentsForIntake(id) {
    return id ? (crmAttachmentsByIntake.get(String(id)) || []) : [];
  }

  function crmAttachmentListHtml(attachments, options = {}) {
    const rows = (attachments || []).slice(0, options.limit || 8);
    if (!rows.length) {
      return options.empty ? `<div class="empty-state">${escapeHtml(options.empty)}</div>` : "";
    }
    return `
      <div class="crm-attachment-list ${options.compact ? "compact" : ""}">
        ${rows.map((attachment, index) => `
          <article>
            <div class="attachment-icon" aria-hidden="true">${attachmentFileKind(attachment) === "Bilde" ? "IMG" : "PDF"}</div>
            <div>
              <strong>${escapeHtml(attachmentTitle(attachment, index))}</strong>
              <span>${escapeHtml([attachmentFileKind(attachment), attachmentSizeLabel(attachment.size_bytes), formatDate(isoDate(new Date(attachment.created_at || Date.now())))].filter(Boolean).join(" · "))}</span>
              ${attachment.note ? `<small>${escapeHtml(attachment.note)}</small>` : ""}
            </div>
            <button data-open-crm-attachment="${escapeHtml(attachment.id)}" type="button" title="Åpne vedlegget i en tidsbegrenset privat lenke.">Åpne</button>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderCustomerAttachmentSection(customer) {
    const key = customerKey(customer);
    const attachments = attachmentsForCustomer(customer);
    const actions = store.isConfigured && isAdmin() && customer?.id ? `
      <div class="section-actions">
        <button data-add-customer-attachment="${escapeHtml(key)}" type="button" title="Last opp bilde eller PDF til kundekortet.">Legg til bilde/vedlegg</button>
      </div>
    ` : "";
    return `
      <section class="detail-section">
        <div class="section-title-row">
          <h3>Bilder og vedlegg</h3>
          ${actions}
        </div>
        ${crmAttachmentListHtml(attachments, { empty: "Ingen bilder eller vedlegg lagret på kundekortet ennå." })}
      </section>
    `;
  }

  function renderLeadAttachmentSection(entry, customer, leadTarget) {
    const attachments = attachmentsForLead(entry, customer);
    const leadId = entry?.lead?.id || "";
    const key = customerKey(customer);
    const actions = store.isConfigured && isAdmin() && (leadId || customer?.id) ? `
      <div class="section-actions">
        <button data-add-lead-attachment="${escapeHtml(leadTarget || key)}" type="button" title="Last opp bilde eller PDF på denne saken.">Legg til bilde/vedlegg</button>
      </div>
    ` : "";
    return `
      <section class="detail-section">
        <div class="section-title-row">
          <h3>Bilder og vedlegg</h3>
          ${actions}
        </div>
        ${crmAttachmentListHtml(attachments, { empty: leadId ? "Ingen bilder lagret på denne saken ennå." : "Ingen bilder lagret på kundekortet ennå." })}
      </section>
    `;
  }

  function renderInstallationAttachmentBlock(customer, installation) {
    if (!installation?.id) return "";
    const attachments = attachmentsForInstallation(installation);
    const key = customerKey(customer);
    return `
      <div class="installation-attachments">
        <div>
          <strong>Bilder / vedlegg</strong>
          <span>${attachments.length ? `${attachments.length.toLocaleString("nb-NO")} lagret` : "Ingen lagret"}</span>
        </div>
        ${crmAttachmentListHtml(attachments, { compact: true, limit: 3 })}
        ${store.isConfigured && isAdmin() && customer?.id ? `<button class="secondary" data-add-installation-attachment="${escapeHtml(installation.id)}" data-attachment-customer="${escapeHtml(key)}" type="button" title="Last opp bilde på akkurat dette anlegget.">Legg bilde til anlegg</button>` : ""}
      </div>
    `;
  }

  function canUploadJobAttachment(customer, linkedJob) {
    return Boolean(
      store.isConfigured
      && store.saveCrmAttachment
      && customer?.id
      && linkedJob?.id
      && (isAdmin() || isTechnicianUser())
    );
  }

  function renderOrderAttachmentSection(order, customer, linkedJob) {
    const attachments = attachmentsForJob(linkedJob);
    const installation = installationForOrder(order, customer, linkedJob);
    const canUpload = canUploadJobAttachment(customer, linkedJob);
    const actions = canUpload ? `
      <div class="section-actions">
        <button data-add-job-attachment="${escapeHtml(order.id)}" type="button" title="Last opp bilde eller PDF til akkurat denne jobben.">Legg til bilde/vedlegg</button>
      </div>
    ` : "";
    const empty = linkedJob?.id
      ? "Ingen bilder eller vedlegg lagret på denne jobben ennå."
      : "Jobben mangler jobbkobling. Opprett jobbkobling før bilder kan lagres direkte på jobben.";
    return `
      <section class="detail-section">
        <div class="section-title-row">
          <h3>Bilder og vedlegg</h3>
          ${actions}
        </div>
        ${installation ? `<p class="compact-help">Gjelder anlegg: ${escapeHtml(installationDisplayName(installation))}</p>` : ""}
        ${crmAttachmentListHtml(attachments, { empty })}
      </section>
    `;
  }

  function renderOrderJobMirrorNotice(order, linkedJob) {
    if (!orderMissingJobMirror({ order, job: linkedJob }) || !store.repairOrderJobMirror || !isAdmin()) return "";
    return `
      <section class="detail-section attention compact-warning">
        <h3>Mangler jobbkobling</h3>
        <p>Denne eldre jobben mangler teknisk kobling til ny jobbtabell. Opprett kobling før du legger bilder på jobben, fullfører/fakturerer videre eller bruker jobbstatusen som fasit.</p>
        <button data-repair-order-job="${escapeHtml(order.id)}" type="button" title="Opprett manglende kobling til ny jobbtabell. Kundedata slettes ikke.">Opprett jobbkobling</button>
      </section>
    `;
  }

  async function persistAiRegistrationAttachments(links = {}) {
    if (!aiRegistrationAttachments.length || !store.saveCrmAttachment || !store.isConfigured) return [];
    const saved = [];
    for (let index = 0; index < aiRegistrationAttachments.length; index += 1) {
      const item = aiRegistrationAttachments[index];
      if (item.savedCrmAttachmentId) continue;
      const row = await store.saveCrmAttachment(item.file, {
        ...links,
        title: item.name || `Skjermbilde ${index + 1}`,
        note: links.note || "Vedlagt hurtigregistrering.",
        source_kind: links.source_kind || "hurtigregistrering",
        source_order: index,
      });
      item.savedCrmAttachmentId = row.id;
      saved.push(row);
    }
    replaceCrmAttachments(saved);
    return saved;
  }

  async function linkStoredIntakeAttachments(intakeId, links = {}) {
    if (!intakeId || !store.linkCrmAttachments) return [];
    const updated = await store.linkCrmAttachments({
      intake_id: intakeId,
      ...links,
    });
    replaceCrmAttachments(updated);
    return updated;
  }

  function promptCrmAttachmentUpload(context = {}) {
    if (!store.isConfigured || !store.saveCrmAttachment) {
      setSyncStatus("Bildeopplasting krever oppdatert Supabase-lagring.", "error");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf";
    input.multiple = true;
    input.addEventListener("change", () => {
      uploadCrmAttachmentFiles(input.files, context)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke laste opp vedlegg.", "error"))
        .finally(() => input.remove());
    });
    document.body.appendChild(input);
    input.click();
  }

  async function uploadCrmAttachmentFiles(files, context = {}) {
    const incoming = Array.from(files || []).slice(0, 8);
    if (!incoming.length) return;
    const saved = [];
    setSyncStatus(`Laster opp ${incoming.length.toLocaleString("nb-NO")} vedlegg...`, "");
    for (let index = 0; index < incoming.length; index += 1) {
      const row = await store.saveCrmAttachment(incoming[index], {
        ...context,
        source_order: index,
      });
      saved.push(row);
    }
    replaceCrmAttachments(saved);
    renderAll();
    setSyncStatus(`${saved.length.toLocaleString("nb-NO")} vedlegg lagret.`, "ok");
  }

  async function openCrmAttachment(id, previewWindow = null) {
    const attachment = crmAttachments.find((item) => String(item.id) === String(id));
    if (!attachment) throw new Error("Fant ikke vedlegget.");
    if (!store.attachmentUrl) throw new Error("Privat visningslenke er ikke tilgjengelig.");
    const url = await store.attachmentUrl(attachment);
    if (!url) throw new Error("Klarte ikke lage visningslenke.");
    if (previewWindow && !previewWindow.closed) {
      previewWindow.location.href = url;
      return;
    }
    window.open(url, "_blank", "noopener");
  }

  function handleCrmAttachmentClick(event) {
    const openAttachment = event.target.closest("[data-open-crm-attachment]");
    if (openAttachment) {
      const previewWindow = window.open("about:blank", "_blank");
      if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.document.title = "Åpner vedlegg";
        previewWindow.document.body.textContent = "Åpner privat CRM-vedlegg...";
      }
      openCrmAttachment(openAttachment.dataset.openCrmAttachment, previewWindow)
        .catch((error) => {
          if (previewWindow && !previewWindow.closed) previewWindow.close();
          setSyncStatus(error.message || "Klarte ikke åpne vedlegg.", "error");
        });
      return true;
    }
    const addCustomer = event.target.closest("[data-add-customer-attachment]");
    if (addCustomer) {
      const customer = findCustomer(addCustomer.dataset.addCustomerAttachment);
      if (!customer?.id) {
        setSyncStatus("Kundekortet må være lagret i databasen før bilder kan lastes opp.", "error");
        return true;
      }
      promptCrmAttachmentUpload({
        customer_id: customer.id,
        source_kind: "kundekort",
        note: "Lastet opp fra kundekort.",
      });
      return true;
    }
    const addLead = event.target.closest("[data-add-lead-attachment]");
    if (addLead) {
      const entry = leadEntryForTarget(addLead.dataset.addLeadAttachment);
      const customer = entry?.customer ? (findCustomer(leadEntryCustomerKey(entry)) || entry.customer) : null;
      const leadId = entry?.lead?.id || null;
      if (!customer?.id && !leadId) {
        setSyncStatus("Leaden må være lagret i databasen før bilder kan lastes opp.", "error");
        return true;
      }
      promptCrmAttachmentUpload({
        customer_id: customer?.id || null,
        lead_id: leadId,
        source_kind: "lead",
        note: "Lastet opp fra oppfølging/tilbud.",
      });
      return true;
    }
    const addInstallation = event.target.closest("[data-add-installation-attachment]");
    if (addInstallation) {
      const customer = findCustomer(addInstallation.dataset.attachmentCustomer);
      const installation = findInstallationById(addInstallation.dataset.addInstallationAttachment);
      if (!customer?.id || !installation?.id) {
        setSyncStatus("Anlegget må være lagret i databasen før bilder kan lastes opp.", "error");
        return true;
      }
      promptCrmAttachmentUpload({
        customer_id: customer.id,
        installation_id: installation.id,
        source_kind: "anlegg",
        note: "Lastet opp på varmepumpe/anlegg.",
      });
      return true;
    }
    const addJob = event.target.closest("[data-add-job-attachment]");
    if (addJob) {
      const order = findOrder(addJob.dataset.addJobAttachment);
      const customer = order ? findCustomer(orderCustomerId(order)) : null;
      const linkedJob = order ? jobForOrder(order) : null;
      if (!order || !customer?.id) {
        setSyncStatus("Fant ikke lagret kunde/jobb for vedlegget.", "error");
        return true;
      }
      if (!linkedJob?.id) {
        setSyncStatus("Opprett jobbkobling før bilder kan lagres direkte på jobben.", "error");
        return true;
      }
      promptCrmAttachmentUpload({
        customer_id: customer.id,
        job_id: linkedJob.id,
        installation_id: installationIdForOrder(order, linkedJob) || null,
        source_kind: "jobb",
        note: "Lastet opp fra jobbkort.",
      });
      return true;
    }
    return false;
  }

  async function analyzeAiRegistrationText(text) {
    if (store.isConfigured && store.analyzeIntake) {
      try {
        const analysis = await store.analyzeIntake({
          text,
          source_kind: "pasted_text",
          attachment_count: aiRegistrationAttachments.length,
        });
        return {
          analysis: {
            ...analysis,
            parser: analysis?.parser || "server_text_recognition",
          },
          source: "server",
        };
      } catch (error) {
        return {
          analysis: intakeEngine()?.analyzeText ? intakeEngine().analyzeText(text) : null,
          source: "local_fallback",
          error: error.message || "Serveranalyse var ikke tilgjengelig.",
        };
      }
    }
    return {
      analysis: intakeEngine()?.analyzeText ? intakeEngine().analyzeText(text) : null,
      source: "local",
    };
  }

  async function parseAiRegistrationInput() {
    const text = el.aiRegistrationInput?.value || "";
    if (!text.trim()) {
      if (aiRegistrationAttachments.length) {
        const placeholder = `${weekdayDate(isoDate(new Date()), { long: true })}: Bildevedlegg uten tekst. Fyll inn kundeinfo manuelt ved behandling.`;
        aiRegistrationDraft = parseAiRegistrationText(placeholder, null);
        aiRegistrationDraft = {
          ...aiRegistrationDraft,
          action: "create_customer",
          type: "lead",
          name: "",
          phone: "",
          email: "",
          street: "",
          zip: "",
          city: "",
          tags: "Bildevedlegg, Må kontaktes",
          brand: "",
          model: "",
          note: placeholder,
          raw: placeholder,
          analysis: {
            parser: "image_attachment_placeholder",
            warnings: [{ code: "image_only", message: "Bilde er lagt ved. Fyll inn kundeinfo før du lagrer som kunde eller oppfølging.", severity: "info" }],
          },
        };
        renderAiRegistrationDraft();
        showAiRegistrationMessage("Bildeutkast klart. Lagre i CRM-innboks, eller fyll inn kundeinfo manuelt først.", "ok");
        setSyncStatus("Bildeutkast klart for CRM-innboks.", "ok");
        return;
      }
      if (el.aiRegistrationDraft) {
        el.aiRegistrationDraft.classList.remove("hidden");
        el.aiRegistrationDraft.innerHTML = `<div id="aiRegistrationMessage" class="dialog-message error">Lim inn SMS/e-post før du lager forslag.</div>`;
      }
      setSyncStatus("Lim inn SMS/e-post før du lager forslag.", "error");
      return;
    }
    try {
      if (el.aiRegistrationParseButton) el.aiRegistrationParseButton.disabled = true;
      setSyncStatus("Analyserer hurtigregistrering...", "");
      const result = await analyzeAiRegistrationText(text);
      aiRegistrationDraft = parseAiRegistrationText(text, result.analysis);
      if (result.source === "local_fallback") {
        aiRegistrationDraft.analysis = {
          ...(aiRegistrationDraft.analysis || {}),
          warnings: [
            ...(aiRegistrationDraft.analysis?.warnings || []),
            { code: "server_unavailable", message: `Serveranalyse feilet: ${result.error}. Lokal enkel tekstgjenkjenning er brukt.`, severity: "warning" },
          ],
        };
      }
      aiRegistrationSelectedCustomerId = "";
      renderAiRegistrationDraft();
      setSyncStatus(result.source === "server"
        ? "Serverforslag laget. Sjekk og trykk lagre hvis det stemmer."
        : "Lokalt forslag laget. Sjekk og trykk lagre hvis det stemmer.",
      "ok");
    } catch (error) {
      if (el.aiRegistrationDraft) {
        el.aiRegistrationDraft.classList.remove("hidden");
        el.aiRegistrationDraft.innerHTML = `<div id="aiRegistrationMessage" class="dialog-message error">${escapeHtml(error.message || "Klarte ikke analysere hurtigregistreringen.")}</div>`;
      }
      setSyncStatus(error.message || "Klarte ikke analysere hurtigregistreringen.", "error");
    } finally {
      if (el.aiRegistrationParseButton) el.aiRegistrationParseButton.disabled = false;
    }
  }

  function mergeAiTags(existingTags, formTags, type) {
    return uniqueTags([
      ...splitTags(existingTags),
      ...splitTags(formTags || aiTagsForType(type)),
    ]);
  }

  function buildAiCustomer(values, existing) {
    const noteIntro = `${weekdayDate(isoDate(new Date()), { long: true })}: ${aiRegistrationTypeLabel(values.type)} registrert via hurtigregistrering.`;
    const note = appendCustomerNote(existing || {}, `${noteIntro}\n${values.note}`.trim());
    const keepExisting = Boolean(existing);
    const mergedTags = mergeAiTags(existing?.tags, values.tags, values.type);
    return {
      ...(existing || {}),
      lime_id: existing?.lime_id || `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: existing?.source || "Hurtigregistrering",
      name: keepExisting ? (existing?.name || values.name || `Ukjent kunde ${values.phone || values.email || ""}`.trim()) : (values.name || `Ukjent kunde ${values.phone || values.email || ""}`.trim()),
      phone: keepExisting ? (existing?.phone || values.phone || "") : (values.phone || ""),
      email: keepExisting ? (existing?.email || values.email || "") : (values.email || ""),
      visit_street: keepExisting ? (existing?.visit_street || values.street || "") : (values.street || ""),
      visit_zip: keepExisting ? (existing?.visit_zip || values.zip || "") : (values.zip || ""),
      visit_city: keepExisting ? (existing?.visit_city || values.city || "") : (values.city || ""),
      location_tag: existing?.location_tag || values.city || "",
      brand: keepExisting ? (existing?.brand || values.brand || "") : (values.brand || ""),
      model_or_note: keepExisting ? (existing?.model_or_note || values.model || "") : (values.model || ""),
      tags: keepExisting ? mergedTags : nextTagsWithCustomerMarker(mergedTags, false),
      local_note: note,
    };
  }

  async function saveAiRegistrationDraft() {
    if (!aiRegistrationDraft) throw new Error("Lag et forslag først.");
    const sourceIntakeId = aiRegistrationDraft.intakeId || "";
    const values = aiRegistrationFormValues();
    if (!values.name && !values.phone && !values.email && !values.street) {
      throw new Error("Forslaget mangler navn, telefon, e-post og adresse. Legg inn minst én av disse før lagring.");
    }
    const existing = findCustomer(aiRegistrationSelectedCustomerId);
    if (["append_existing", "history_only"].includes(values.action) && !existing) {
      throw new Error("Velg en eksisterende kunde før du lagrer på kundekort/historikk.");
    }
    if (values.action === "create_lead") values.action = "create_customer";
    const customerToSave = buildAiCustomer(values, existing);
    let saved = null;
    if (store.isConfigured) {
      saved = await store.saveCustomer(customerToSave);
      const index = customers.findIndex((customer) => customerKey(customer) === customerKey(saved));
      if (index >= 0) customers[index] = saved;
      else customers.unshift(saved);
    } else if (existing) {
      requireLocalDemoStorage();
      Object.assign(existing, customerToSave);
      customerEdits[customerKey(existing)] = { ...(customerEdits[customerKey(existing)] || {}), ...customerToSave };
      saveLocalEdits();
      saved = existing;
    } else {
      requireLocalDemoStorage();
      customers.unshift(customerToSave);
      customerEdits[customerKey(customerToSave)] = customerToSave;
      saveLocalEdits();
      saved = customerToSave;
    }

    const keepOriginalInEvent = values.keepOriginal && !sourceIntakeId;
    await saveServiceEvent(saved, {
      event_date: isoDate(new Date()),
      event_type: aiRegistrationTypes[values.type]?.eventType || "Hurtigregistrering",
      note: keepOriginalInEvent
        ? `${values.note}\n\nOriginaltekst:\n${values.raw}`.trim()
        : values.note,
    });
    const syncedLead = ["lead", "befaring", "installasjon", "blaseisolering"].includes(values.type) || isLeadCustomer(saved)
      ? await syncLeadRecord(saved, leadStatusForCustomer(saved), values.note)
      : null;
    if (sourceIntakeId) {
      await linkStoredIntakeAttachments(sourceIntakeId, {
        customer_id: saved?.id || "",
        lead_id: syncedLead?.id || null,
      });
    } else {
      await persistAiRegistrationAttachments({
        customer_id: saved?.id || "",
        lead_id: syncedLead?.id || null,
        source_kind: "hurtigregistrering",
        note: "Vedlagt hurtigregistrering.",
      });
    }
    await markIntakeCommitted(sourceIntakeId, {
      linked_customer_id: saved?.id || "",
      linked_lead_id: syncedLead?.id || null,
      selected_action: values.action,
      final_json: aiRegistrationFinalJson(values),
    });
    const shouldOpenLead = ["lead", "befaring", "installasjon", "blaseisolering"].includes(values.type) || Boolean(syncedLead);
    if (shouldOpenLead) {
      const status = leadStatusFromDb(syncedLead?.status) || leadStatusForCustomer(saved);
      selectedLeadId = syncedLead?.id ? `lead:${syncedLead.id}` : customerKey(saved);
      focusLeadQueueForStatus(status);
      clearAiRegistration();
      setView("leads");
      setSyncStatus(existing
        ? "Oppfølging lagret på eksisterende kundekort og åpnet i Innboks."
        : "Kundekort og oppfølging opprettet. Saken er åpnet i Innboks for videre oppfølging.",
      "ok");
      return;
    }
    selectedCustomerId = customerKey(saved);
    currentCustomerFilter = "all";
    currentSearch = "";
    if (el.statusFilter) el.statusFilter.value = "all";
    if (el.customerSearch) el.customerSearch.value = "";
    clearAiRegistration();
    setView("customers");
    setSyncStatus(existing ? "Tekst lagret på eksisterende kundekort." : "Nytt kundekort lagret fra hurtigregistrering, med oppfølging koblet der det passer.", "ok");
  }

  function starToggleHtml(customer) {
    const key = customerKey(customer);
    const active = isStarredCustomer(customer);
    const title = active ? "Slå av prioritert servicekunde." : "Prioritert servicekunde: bruk for kunder som ofte svarer ja, ønsker jevnlig service eller er aktuelle når du fyller servicedag.";
    return `<button class="star-icon-toggle ${active ? "active" : ""}" data-toggle-star="${escapeHtml(key)}" type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><span aria-hidden="true">&#9733;</span></button>`;
  }

  function splitTags(value) {
    return String(value || "")
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function canonicalTagLabel(tag) {
    const clean = repairTextEncoding(tag).replace(/\s+/g, " ").trim();
    const normalized = normalizeMatch(clean);
    const exact = {
      blefjell: "Blefjell",
      fagerfjell: "Fagerfjell",
      vegglifjell: "Vegglifjell nord",
      "vegglifjell nord": "Vegglifjell nord",
      "vegglifjell sor": "Vegglifjell sør",
      "vegglifjell syd": "Vegglifjell sør",
      veggli: "Veggli",
      hytte: "Hytte",
      servicekunde: "Servicekunde",
      "service kunde": "Servicekunde",
      kunde: "Kunde",
      "er kunde": "Kunde",
      "ikke kunde": "Ikke kunde",
      "er ikke kunde": "Ikke kunde",
      nokkelboks: "Nøkkelboks",
      kodeboks: "Kodeboks",
      nettside: "Nettside",
      lead: "Lead",
    };
    return exact[normalized] || clean;
  }

  function tagIdentity(tag) {
    return normalizeMatch(canonicalTagLabel(tag));
  }

  function uniqueTagArray(tags) {
    const seen = new Set();
    const result = [];
    for (const tag of tags || []) {
      const label = canonicalTagLabel(tag);
      const key = tagIdentity(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(label);
    }
    return result;
  }

  function isLegacyImportTag(tag) {
    const normalized = normalizeMatch(tag);
    if (!normalized) return true;
    if (isLegacyLeadTag(tag)) return true;
    if (/^(varmepumpe kunde|lime go|lime|import|eaccounting|visma)$/.test(normalized)) return true;
    if (/^(panasonic|samsung|mitsubishi|fujitsu|wilfa|norgespumpa)$/.test(normalized)) return true;
    if (/^(hz|nz|cz|z)\s*\d{0,2}\s*(xke|zke|yke)?$/.test(normalized)) return true;
    if (/^(samsung )?smart\s*9$/.test(normalized)) return true;
    if (/^(kaiteki|hara|iguru|vindfree|gulvmodell)$/.test(normalized)) return true;
    if (/^(19|20)\d{2}$/.test(normalized)) return true;
    return false;
  }

  function isLegacyLeadTag(tag) {
    const normalized = normalizeMatch(tag);
    return /^lead(status)?\s*:/.test(String(tag || "").trim().toLowerCase()) || normalized === "lead";
  }

  function legacyTagKind(tag) {
    const normalized = normalizeMatch(tag);
    if (isLegacyLeadTag(tag)) return "Gammel leadstatus";
    if (/^(panasonic|samsung|mitsubishi|fujitsu|wilfa|norgespumpa)$/.test(normalized)) return "Merke fra import";
    if (/^(hz|nz|cz|z)\s*\d{0,2}\s*(xke|zke|yke)?$/.test(normalized) || /^(samsung )?smart\s*9$/.test(normalized) || /^(kaiteki|hara|iguru|vindfree|gulvmodell)$/.test(normalized)) return "Modell fra import";
    if (/^(19|20)\d{2}$/.test(normalized)) return "Årstall fra import";
    return "Importtagg";
  }

  function customerVisibleTags(customer) {
    return splitTags(customer?.tags).filter((tag) => !isLegacyImportTag(tag) && !isCustomerMarkerTag(tag));
  }

  function customerTagDisplayLabel(tag) {
    const normalized = normalizeMatch(tag);
    if (/^(gullkunde|stjerne|favoritt|prioritert servicekunde)$/.test(normalized)) return "Prioritert servicekunde";
    if (/^(ikke stjerne|ikke gullkunde|skjul stjerne)$/.test(normalized)) return "Ikke prioritert servicekunde";
    return canonicalTagLabel(tag);
  }

  function customerDisplayTags(tags) {
    const seen = new Set();
    return (tags || [])
      .map(customerTagDisplayLabel)
      .filter((tag) => {
        const key = normalizeMatch(tag);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function customerTagFactText(customer) {
    const visible = customerDisplayTags(customerVisibleTags(customer));
    if (visible.length) return visible.join("; ");
    const hiddenTags = splitTags(customer?.tags).filter((tag) => !isCustomerMarkerTag(tag));
    return hiddenTags.length ? "Gamle importtagger skjult" : "Ikke registrert";
  }

  function uniqueTags(tags) {
    return uniqueTagArray(tags).join("; ");
  }

  function knownCustomerTags() {
    const tags = new Map();
    for (const customer of customers || []) {
      for (const tag of splitTags(customer.tags)) {
        const label = canonicalTagLabel(tag);
        const key = tagIdentity(label);
        if (key && !tags.has(key)) tags.set(key, label);
      }
      if (customer.location_tag) {
        const label = canonicalTagLabel(customer.location_tag);
        const key = tagIdentity(label);
        if (key && !tags.has(key)) tags.set(key, label);
      }
    }
    return [...tags.values()].sort((a, b) => a.localeCompare(b, "nb-NO"));
  }

  function deriveLocationTagFromTags(tagsValue) {
    const tags = splitTags(tagsValue);
    const location = tags.find((tag) => cabinAreaNames.some((area) => normalizeMatch(tag).includes(normalizeMatch(area))))
      || tags.find((tag) => /kongsberg|flesberg|svene|lampeland|veggli|blefjell|fagerfjell|skrim|rollag|rødberg|rodberg/i.test(tag));
    return location ? canonicalTagLabel(location) : "";
  }

  function currentFormTags() {
    return splitTags(el.formTags?.value || "");
  }

  function setFormTags(tags) {
    el.formTags.value = uniqueTags(tags);
    renderTagCatalog(currentFormTags());
  }

  function renderTagCatalog(selectedTags = currentFormTags()) {
    if (!el.formTagCatalog) return;
    const selected = new Set(selectedTags.map((tag) => normalizeMatch(tag)));
    const catalog = knownCustomerTags()
      .filter((tag) => !isLegacyImportTag(tag) && !isCustomerMarkerTag(tag));
    if (!catalog.length) {
      el.formTagCatalog.innerHTML = `<span class="tag-catalog-empty">Lag en tagg i feltet over. Den kan hukes av her neste gang.</span>`;
      return;
    }
    el.formTagCatalog.innerHTML = catalog.map((tag) => {
      const checked = selected.has(normalizeMatch(tag));
      return `
        <label class="tag-chip ${checked ? "active" : ""}">
          <input type="checkbox" value="${escapeHtml(tag)}" ${checked ? "checked" : ""} />
          <span>${escapeHtml(tag)}</span>
        </label>
      `;
    }).join("");
  }

  function syncPostalFieldsVisibility() {
    const show = Boolean(el.formDifferentPostal?.checked);
    document.querySelectorAll(".postal-extra").forEach((node) => node.classList.toggle("hidden", !show));
    if (!show) {
      el.formPostalStreet.value = "";
      el.formPostalZip.value = "";
      el.formPostalCity.value = "";
    }
  }

  function nextTagsWithManualStar(customer, shouldStar) {
    const existing = splitTags(customer?.tags);
    const kept = existing.filter((tag) => !/^(gullkunde|stjerne|favoritt|ikke stjerne|ikke gullkunde|skjul stjerne)$/i.test(tag));
    if (shouldStar) kept.unshift("Gullkunde");
    else if (isAutoStarredCustomer(customer)) kept.unshift("Ikke stjerne");
    return uniqueTags(kept);
  }

  async function toggleCustomerStar(customerId) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const shouldStar = !isStarredCustomer(customer);
    const updated = { ...customer, tags: nextTagsWithManualStar(customer, shouldStar) };
    if (store.isConfigured) {
      const saved = await store.saveCustomer(updated);
      const index = customers.findIndex((item) => customerKey(item) === customerKey(saved));
      if (index >= 0) customers[index] = saved;
      selectedCustomerId = customerKey(saved);
    } else {
      requireLocalDemoStorage();
      Object.assign(customer, updated);
      const key = customerKey(customer);
      customerEdits[key] = { ...(customerEdits[key] || {}), tags: updated.tags };
      saveLocalEdits();
    }
    renderAll();
  }

  async function toggleCustomerStatus(customerId) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const shouldMark = !customerIsMarkedCustomer(customer);
    await saveCustomerInline(
      customer,
      { tags: nextTagsWithCustomerMarker(customer.tags, shouldMark) },
      shouldMark ? "Kunden er markert som kunde." : "Kundekortet er markert som ikke kunde.",
    );
  }

  function isManualInsulationTagged(customer) {
    return /\b(isobygg|blåseisolering|blaseisolering|isolering)\b/i.test(String(customer?.tags || ""));
  }

  function nextTagsWithInsulation(value, shouldMark) {
    const kept = splitTags(value).filter((tag) => !/^(isobygg|blåseisolering|blaseisolering|isolering)$/i.test(tag));
    if (shouldMark) kept.unshift("Blåseisolering");
    return uniqueTags(kept);
  }

  function insulationToggleHtml(customer) {
    const key = customerKey(customer);
    const active = isInsulationCustomer(customer);
    return `<button class="tag-toggle ${active ? "active" : ""}" data-toggle-insulation="${escapeHtml(key)}" type="button" title="Marker kunden som blåseisolering/Isobygg, slik at den dukker opp i blåseisolering-filteret.">Blåseisolering</button>`;
  }

  function paymentControlsHtml(customer) {
    const key = customerKey(customer);
    const cash = Boolean(customer?.pays_cash);
    return `
      <div class="payment-control" role="group" aria-label="Betaling">
        <button class="${cash ? "" : "active"}" data-payment-customer="${escapeHtml(key)}" data-payment-mode="invoice" type="button" title="Faktura er standard betaling.">Faktura</button>
        <button class="${cash ? "active" : ""}" data-payment-customer="${escapeHtml(key)}" data-payment-mode="cash" type="button" title="Marker at kunden betaler på stedet.">Betaling på stedet</button>
      </div>
    `;
  }

  async function saveCustomerInline(customer, changes, message) {
    if (!customer) return null;
    const updated = { ...customer, ...changes };
    if (store.isConfigured) {
      const saved = await store.saveCustomer(updated);
      const index = customers.findIndex((item) => customerKey(item) === customerKey(saved));
      if (index >= 0) customers[index] = saved;
      selectedCustomerId = customerKey(saved);
      if (Object.prototype.hasOwnProperty.call(changes, "access_note")) upsertAccessNoteInMemory(saved, changes.access_note);
      renderAll();
      if (message) setSyncStatus(message, "ok");
      return saved;
    }
    requireLocalDemoStorage();
    Object.assign(customer, updated);
    const key = customerKey(customer);
    customerEdits[key] = { ...(customerEdits[key] || {}), ...changes };
    saveLocalEdits();
    if (Object.prototype.hasOwnProperty.call(changes, "access_note")) upsertAccessNoteInMemory(customer, changes.access_note);
    renderAll();
    if (message) setSyncStatus(message, "ok");
    return customer;
  }

  function openAccessDialog(customerId, options = {}) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const prefill = options.prefill === "suggested" && !accessInfo(customer)
      ? suggestedAccessInfo(customer)
      : "";
    openCustomerDialog(customerId, {
      focus: "access",
      accessPrefill: prefill,
    });
  }

  async function promoteCustomerAccessNote(customerId) {
    const customer = findCustomer(customerId);
    if (!customer) throw new Error("Fant ikke kunden.");
    const note = accessInfo(customer) || suggestedAccessInfo(customer);
    if (!note) throw new Error("Fant ingen adkomsttekst å lagre.");
    await saveCustomerInline(customer, { access_note: note }, "Adkomst lagret som eget adkomstnotat.");
  }

  async function setCustomerPaymentMode(customerId, mode) {
    const customer = findCustomer(customerId);
    const paysCash = mode === "cash";
    await saveCustomerInline(customer, { pays_cash: paysCash }, "");
    setSyncStatus("", "");
  }

  async function toggleCustomerInsulation(customerId) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const shouldMark = !isManualInsulationTagged(customer);
    await saveCustomerInline(
      customer,
      { tags: nextTagsWithInsulation(customer.tags, shouldMark) },
      "",
    );
  }

  function findCustomer(id) {
    if (!id) return undefined;
    return customers.find((customer) => customerKey(customer) === id || customer.lime_id === id || customer.id === id);
  }

  function addressFor(customer) {
    return [customer.visit_street, customer.visit_zip, customer.visit_city].filter(Boolean).join(", ");
  }

  function postalAddressFor(customer) {
    return [customer.postal_street, customer.postal_zip, customer.postal_city].filter(Boolean).join(", ");
  }

  const cabinAreaNames = [
    "veggli",
    "vegglifjell sør",
    "vegglifjell nord",
    "vegglifjell",
    "blefjell",
    "fagerfjell",
    "skrim",
    "nore",
    "uvdal",
    "rollag",
    "lampeland",
    "flesberg",
    "rodberg",
    "rodberg",
  ];

  const likelyHomeCities = [
    "skien",
    "porsgrunn",
    "oslo",
    "asker",
    "nesbru",
    "drammen",
    "hokksund",
    "mjondalen",
    "mjondalen",
    "horten",
    "fredrikstad",
    "larvik",
    "lyngdal",
  ];

  function cabinAreaTag(customer) {
    const text = normalizeMatch([
      customer.location_tag,
      customer.tags,
      customer.latest_deal_name,
      customer.model_or_note,
    ].filter(Boolean).join(" "));
    return cabinAreaNames.find((area) => text.includes(normalizeMatch(area))) || "";
  }

  function isLikelyHomeAddress(customer) {
    const area = cabinAreaTag(customer);
    const city = normalizeMatch(customer.visit_city);
    if (!area || !city) return false;
    if (normalizeMatch(area).includes(city) || city.includes(normalizeMatch(area))) return false;
    if (["svene", "lampeland", "flesberg", "veggli", "rollag", "rodberg", "rodberg", "kongsberg"].some((local) => city.includes(normalizeMatch(local)))) return false;
    return likelyHomeCities.some((homeCity) => city.includes(normalizeMatch(homeCity)));
  }

  function siteLocationText(customer) {
    if (isLikelyHomeAddress(customer)) return cabinAreaTag(customer) || customer.location_tag || customer.visit_city || "";
    return addressFor(customer) || customer.location_tag || customer.visit_city || "";
  }

  function parseCoordinateText(value) {
    const numbers = String(value || "").match(/-?\d+(?:[.,]\d+)?/g);
    if (!numbers || numbers.length < 2) return null;
    for (let index = 0; index < numbers.length - 1; index += 1) {
      const lat = Number(numbers[index].replace(",", "."));
      const lon = Number(numbers[index + 1].replace(",", "."));
      if (lat >= 57 && lat <= 72 && lon >= 4 && lon <= 32) return { lat, lon };
    }
    return null;
  }

  function mapQuery(customer) {
    const exact = parseCoordinateText(customer.gps_coordinates) || parseCoordinateText(customer.google_maps);
    if (exact) return `${exact.lat},${exact.lon}`;
    return siteLocationText(customer);
  }

  function accessInfo(customer) {
    const key = customerKey(customer);
    const accessNotes = key ? accessNotesByCustomer.get(key) || [] : [];
    const note = accessNotes.find((item) => item.note_type === "adkomst") || accessNotes[0];
    return String(note?.note || customer?.access_note || "").trim();
  }

  function structuredAccessInfo(customer) {
    const key = customerKey(customer);
    const accessNotes = key ? accessNotesByCustomer.get(key) || [] : [];
    const note = accessNotes.find((item) => item.note_type === "adkomst") || accessNotes[0];
    return String(note?.note || "").trim();
  }

  function likelyAccessLines(customer) {
    const sourceText = [
      customer?.access_note,
      customer?.local_note,
      customer?.latest_deal_name,
      customer?.tags,
    ].filter(Boolean).join("\n");
    const lines = sourceText
      .split(/\n|;|\s-\s|•/g)
      .map((line) => repairTextEncoding(line).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const accessPattern = /\b(adkomst|kodeboks|nøkkelboks|nokkelboks|nøkkel|nokkel|dørkode|dorkode|portkode|legge ut|lagt ut|ligger under|ligger ved|under matte|under matta)\b/i;
    const seen = new Set();
    return lines
      .filter((line) => accessPattern.test(line))
      .map((line) => line.replace(/^tags?\s*[:=-]\s*/i, "").trim())
      .filter((line) => {
        const key = normalizeMatch(line);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }

  function suggestedAccessInfo(customer) {
    return likelyAccessLines(customer).join("\n").trim();
  }

  function phoneForLink(value) {
    return String(value || "").replace(/[^\d+]/g, "");
  }

  function mapsUrl(customer) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(customer))}`;
  }

  function exactCoordinates(customer) {
    return parseCoordinateText(customer?.gps_coordinates) || parseCoordinateText(customer?.google_maps);
  }

  function routeAreaTerms() {
    return normalizeMatch(el.routeArea?.value || "").split(" ").filter(Boolean);
  }

  function installationAreaText(installation, customer) {
    const location = locationForInstallation(installation, customer);
    return [
      installation?.label,
      installation?.brand,
      installation?.model,
      installation?.notes,
      location?.location_name,
      locationAddressText(location),
      location?.city,
      location?.postal_code,
    ].filter(Boolean).join(" ");
  }

  function installationMatchesRouteArea(installation, customer, areaTerms = routeAreaTerms()) {
    if (!areaTerms.length) return false;
    const text = normalizeMatch(installationAreaText(installation, customer));
    return areaTerms.every((term) => text.includes(term));
  }

  function routeLocationText(customer, installation = routePrimaryInstallation(customer, { areaTerms: routeAreaTerms() })) {
    const installationLocation = installation ? locationAddressText(locationForInstallation(installation, customer)) : "";
    if (installationLocation) return installationLocation;
    const exact = exactCoordinates(customer);
    if (exact) return `${exact.lat},${exact.lon}`;
    return siteLocationText(customer);
  }

  function hasRouteLocation(customer) {
    return Boolean(routeLocationText(customer));
  }

  function routeLocationLabel(customer) {
    const installation = routePrimaryInstallation(customer, { areaTerms: routeAreaTerms() });
    if (installation && locationAddressText(locationForInstallation(installation, customer))) return "Anleggsadresse";
    if (exactCoordinates(customer)) return "Koordinater";
    if (isLikelyHomeAddress(customer)) return "Område/tagg - mulig hytteadresse";
    if (addressFor(customer)) return "Adresse";
    return "Mangler adresse/koordinater";
  }

  function distanceKm(a, b) {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    const toRad = (value) => value * Math.PI / 180;
    const radius = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(h));
  }

  function knownPlacePointForText(value) {
    const text = normalizeMatch(value);
    if (!text) return null;
    if (text.includes("vegglifjell sor")) return null;
    for (const [key, point] of [...knownPlacePoints].sort((a, b) => b[0].length - a[0].length)) {
      if (text.includes(key)) return { ...point, estimated: true };
    }
    return null;
  }

  function routePointDetails(customer, areaIndex = routeAreaPointIndex()) {
    const areaTerms = routeAreaTerms();
    const routeInstallation = routePrimaryInstallation(customer, { areaTerms });
    if (routeInstallation && areaTerms.length && installationMatchesRouteArea(routeInstallation, customer, areaTerms)) {
      const installationKnown = knownPlacePointForText(installationAreaText(routeInstallation, customer));
      if (installationKnown) return { point: installationKnown, label: "Anleggsområde-estimat", quality: "low" };
    }
    const exact = exactCoordinates(customer);
    if (exact) return { point: exact, label: "Koordinater", quality: "medium" };
    for (const key of routeAreaKeys(customer)) {
      const estimated = areaIndex.get(key);
      if (estimated) return { point: estimated, label: "Område-estimat", quality: "low" };
    }
    const known = knownPlacePointForCustomer(customer);
    if (known) return { point: known, label: "Stedsestimat", quality: "low" };
    return { point: null, label: "Mangler kartgrunnlag", quality: "missing" };
  }

  function estimatedDriveLeg(previousCustomer, customer, areaIndex, fallbackFromPoint = null) {
    if (!customer) {
      return { drivingMinutes: 0, bufferMinutes: 0, totalMinutes: 0, km: 0, quality: "start" };
    }
    const from = previousCustomer
      ? routePointDetails(previousCustomer, areaIndex)
      : { point: fallbackFromPoint, label: "Startpunkt", quality: fallbackFromPoint ? "medium" : "missing" };
    const to = routePointDetails(customer, areaIndex);
    if (!from.point) {
      return { drivingMinutes: 0, bufferMinutes: 0, totalMinutes: 0, km: 0, quality: "start" };
    }
    const km = distanceKm(from.point, to.point);
    if (!Number.isFinite(km)) {
      return {
        drivingMinutes: 20,
        bufferMinutes: 15,
        totalMinutes: 35,
        km: null,
        quality: "missing",
        sourceLabel: `${from.label} -> ${to.label}`,
      };
    }
    const drivingMinutes = Math.max(6, Math.min(90, Math.round((km / 42) * 60) + 6));
    const bufferMinutes = km < 4 ? 5 : km < 14 ? 10 : 15;
    const quality = from.quality === "medium" && to.quality === "medium" ? "medium" : "low";
    return {
      drivingMinutes,
      bufferMinutes,
      totalMinutes: drivingMinutes + bufferMinutes,
      km,
      quality,
      sourceLabel: `${from.label} -> ${to.label}`,
    };
  }

  function routeDriveText(leg) {
    if (!leg?.totalMinutes) return "";
    const distanceText = Number.isFinite(leg.km) ? `, ca. ${leg.km.toFixed(1)} km luftlinje` : "";
    const fromText = String(leg.sourceLabel || "").startsWith("Startpunkt") ? "fra startpunkt" : "fra forrige kunde";
    return `Estimert reise/overgang: ca. ${leg.totalMinutes} min ${fromText}${distanceText}. Faktisk kjøretid sjekkes i Google Maps.`;
  }

  function routeDriveHtml(leg) {
    const text = routeDriveText(leg);
    if (!text) return "";
    const precision = leg.quality === "medium" ? "basert på koordinater" : leg.quality === "missing" ? "mangler kartgrunnlag" : "grovt estimat";
    return `
      <div class="route-drive-estimate ${escapeHtml(leg.quality)}" title="Dette er et internt estimat for reise og litt praktisk slingringsmonn. Google Maps viser faktisk kjøretid når du åpner ruten.">
        <span>${escapeHtml(text)}</span>
        <em>${escapeHtml(precision)}</em>
      </div>
    `;
  }

  function routeAreaKeys(customer) {
    return [customer.location_tag, customer.visit_city, customer.visit_zip, customer.postal_zip]
      .map((value) => normalizeMatch(value))
      .filter((value) => value.length >= 3);
  }

  function knownPlacePointForCustomer(customer) {
    return knownPlacePointForText([
      customer.location_tag,
      customer.visit_city,
      customer.visit_zip,
      customer.postal_city,
      customer.postal_zip,
      customer.visit_street,
      customer.tags,
      ...installationsForCustomer(customer).map((installation) => installationAreaText(installation, customer)),
    ].filter(Boolean).join(" "));
  }

  function routeAreaPointIndex() {
    const buckets = new Map();
    for (const customer of customers) {
      if (customer.is_inactive) continue;
      const point = exactCoordinates(customer);
      if (!point) continue;
      for (const key of routeAreaKeys(customer)) {
        const bucket = buckets.get(key) || { lat: 0, lon: 0, count: 0 };
        bucket.lat += point.lat;
        bucket.lon += point.lon;
        bucket.count += 1;
        buckets.set(key, bucket);
      }
    }
    const index = new Map();
    for (const [key, bucket] of buckets) {
      if (bucket.count >= 2) index.set(key, { lat: bucket.lat / bucket.count, lon: bucket.lon / bucket.count, estimated: true });
    }
    return index;
  }

  function routePoint(customer, areaIndex = routeAreaPointIndex()) {
    return routePointDetails(customer, areaIndex).point;
  }

  function routeOriginQuery() {
    const origin = String(el.routeOrigin?.value || "").trim();
    if (!origin) return defaultRouteOrigin.label;
    const normalized = normalizeMatch(origin);
    if (!normalized || normalized.includes("numedal varmepumpeservice") || normalized.includes("svene")) {
      return defaultRouteOrigin.label;
    }
    return origin;
  }

  function routeOriginPoint(areaIndex) {
    const origin = String(el.routeOrigin?.value || "").trim();
    const coordinates = parseCoordinateText(origin);
    if (coordinates) return coordinates;
    const normalized = normalizeMatch(origin);
    if (!normalized || normalized.includes("numedal varmepumpeservice") || normalized.includes("svene")) return defaultRouteOrigin.point;
    for (const [key, point] of areaIndex) {
      if (normalized.includes(key)) return point;
    }
    for (const [key, point] of knownPlacePoints) {
      if (normalized.includes(key)) return point;
    }
    return null;
  }

  function routeDistanceForOrder(route, originPoint, areaIndex) {
    if (!route.length) return 0;
    let total = 0;
    let currentPoint = originPoint || routePoint(route[0], areaIndex);
    for (const customer of route) {
      const nextPoint = routePoint(customer, areaIndex);
      const distance = distanceKm(currentPoint, nextPoint);
      if (Number.isFinite(distance)) total += distance;
      currentPoint = nextPoint || currentPoint;
    }
    return total;
  }

  function improveRouteOrder(route, originPoint, areaIndex) {
    const best = route.slice();
    let bestDistance = routeDistanceForOrder(best, originPoint, areaIndex);
    let improved = true;
    while (improved) {
      improved = false;
      for (let start = 0; start < best.length - 1; start += 1) {
        for (let end = start + 1; end < best.length; end += 1) {
          const candidate = best.slice();
          candidate.splice(start, end - start + 1, ...best.slice(start, end + 1).reverse());
          const candidateDistance = routeDistanceForOrder(candidate, originPoint, areaIndex);
          if (candidateDistance + 0.05 < bestDistance) {
            best.splice(0, best.length, ...candidate);
            bestDistance = candidateDistance;
            improved = true;
          }
        }
      }
    }
    return best;
  }

  function exactShortestRoute(route, originPoint, areaIndex) {
    const n = route.length;
    if (n <= 1) return route.slice();
    if (n > 10) return null;
    const points = route.map((customer) => routePoint(customer, areaIndex));
    if (points.some((point) => !point)) return null;
    const origin = originPoint || defaultRouteOrigin.point;
    const size = 1 << n;
    const dp = Array.from({ length: size }, () => Array(n).fill(Number.POSITIVE_INFINITY));
    const parent = Array.from({ length: size }, () => Array(n).fill(-1));
    for (let index = 0; index < n; index += 1) {
      dp[1 << index][index] = distanceKm(origin, points[index]);
    }
    for (let mask = 1; mask < size; mask += 1) {
      for (let last = 0; last < n; last += 1) {
        const current = dp[mask][last];
        if (!Number.isFinite(current)) continue;
        for (let next = 0; next < n; next += 1) {
          if (mask & (1 << next)) continue;
          const nextMask = mask | (1 << next);
          const candidate = current + distanceKm(points[last], points[next]);
          if (candidate < dp[nextMask][next]) {
            dp[nextMask][next] = candidate;
            parent[nextMask][next] = last;
          }
        }
      }
    }
    const full = size - 1;
    let last = 0;
    for (let index = 1; index < n; index += 1) {
      if (dp[full][index] < dp[full][last]) last = index;
    }
    const order = [];
    let mask = full;
    while (last >= 0) {
      order.push(last);
      const previous = parent[mask][last];
      mask &= ~(1 << last);
      last = previous;
    }
    order.reverse();
    return order.map((index) => route[index]);
  }

  function nearestRoute(candidates, limit, originPoint, areaIndex, forcedStart = null) {
    const remaining = candidates.slice();
    const route = [];
    let currentPoint = originPoint || (forcedStart ? routePoint(forcedStart, areaIndex) : null);
    if (forcedStart && remaining.includes(forcedStart)) {
      route.push(forcedStart);
      remaining.splice(remaining.indexOf(forcedStart), 1);
    }
    while (remaining.length && route.length < limit) {
      remaining.sort((a, b) => {
        const aDistance = distanceKm(currentPoint, routePoint(a, areaIndex));
        const bDistance = distanceKm(currentPoint, routePoint(b, areaIndex));
        if (Number.isFinite(aDistance) || Number.isFinite(bDistance)) return aDistance - bDistance;
        return routeCandidateScore(a, []).localeCompare(routeCandidateScore(b, []));
      });
      const next = remaining.shift();
      route.push(next);
      currentPoint = routePoint(next, areaIndex) || currentPoint;
    }
    const improved = improveRouteOrder(route, originPoint, areaIndex);
    return exactShortestRoute(improved, originPoint, areaIndex) || improved;
  }

  function optimizedRouteCustomers(list) {
    const maxJobs = Math.max(1, Math.min(10, Number(el.routeMaxJobs?.value || 8)));
    const areaIndex = routeAreaPointIndex();
    const originPoint = routeOriginPoint(areaIndex);
    const withPoint = list.filter((customer) => routePoint(customer, areaIndex));
    const withoutPoint = list.filter((customer) => !routePoint(customer, areaIndex));
    if (!withPoint.length) return list.slice();

    const limit = Math.min(maxJobs, withPoint.length);
    let bestRoute = nearestRoute(withPoint, limit, originPoint, areaIndex);
    let bestDistance = routeDistanceForOrder(bestRoute, originPoint, areaIndex);
    const startOptions = originPoint ? withPoint : withPoint.slice(0, Math.min(withPoint.length, 20));
    for (const start of startOptions) {
      const candidate = nearestRoute(withPoint, limit, originPoint, areaIndex, start);
      const candidateDistance = routeDistanceForOrder(candidate, originPoint, areaIndex);
      if (candidateDistance < bestDistance) {
        bestRoute = candidate;
        bestDistance = candidateDistance;
      }
    }

    const selectedKeys = new Set(bestRoute.map(customerKey));
    const restWithPoint = withPoint.filter((customer) => !selectedKeys.has(customerKey(customer)));
    const tailOrigin = bestRoute.length ? routePoint(bestRoute.at(-1), areaIndex) : originPoint;
    const tail = restWithPoint.length ? nearestRoute(restWithPoint, restWithPoint.length, tailOrigin, areaIndex) : [];
    const ordered = [...bestRoute, ...tail];
    const exact = exactShortestRoute(ordered.slice(0, limit), originPoint, areaIndex);
    return [...(exact || ordered.slice(0, limit)), ...ordered.slice(limit), ...withoutPoint];
  }

  function routeAreaText(customer) {
    return [
      customer.location_tag,
      customer.visit_city,
      customer.visit_street,
      customer.tags,
      customer.google_maps,
      customer.local_note,
      customer.latest_deal_name,
      ...installationsForCustomer(customer).map((installation) => installationAreaText(installation, customer)),
    ].join(" ");
  }

  function googleDirectionsUrlForRows(rows) {
    const areaTerms = routeAreaTerms();
    const points = rows
      .map((row) => routeLocationText(row.customer, routePrimaryInstallation(row.customer, { areaTerms })))
      .filter(Boolean);
    if (!points.length) return "";
    if (points.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(points[0])}`;
    }
    const origin = routeOriginQuery();
    const params = new URLSearchParams({
      api: "1",
      travelmode: "driving",
      destination: points.at(-1),
    });
    params.set("origin", origin);
    const waypoints = points.slice(0, -1);
    if (waypoints.length) params.set("waypoints", waypoints.join("|"));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  function routeCustomerNote(customer) {
    return [
      customer.local_note,
      customer.access_note,
      customer.tags,
      customer.latest_deal_name,
      customer.model_or_note,
    ].filter(Boolean).join(" ");
  }

  function routeReplyKind(customer) {
    const text = normalizeMatch(routeCustomerNote(customer));
    const hasKey = /(nokkel|kode|adkomst|nkkel|nokkelboks|kodeboks|dor|door|legge ut|lagt ut)/.test(text);
    const positive = /(ja|ok|greit|passer|klart|bekreftet|onsker service|kan komme|kommer|hjemme|hytta|nkkel|nokkel|kode|legge ut)/.test(text);
    if (hasKey) return "key";
    if (positive) return "positive";
    return "unknown";
  }

  function routeReplyLabel(customer) {
    const kind = routeReplyKind(customer);
    if (kind === "key") return "Nøkkel/adkomst";
    if (kind === "positive") return "Har svart ja/ok";
    return "Ikke bekreftet";
  }

  function routeCandidateScore(customer, areaTerms) {
    const routeInstallation = routePrimaryInstallation(customer, { areaTerms });
    const statusRank = { red: 0, yellow: 1, green: 3, missing: 8 };
    const kind = routeInstallation ? statusKindForDueDate(routeInstallation.next_service_due) : statusKind(customer);
    const statusScore = statusRank[kind] ?? 5;
    const due = routeInstallation?.next_service_due || nextServiceDueForCustomer(customer) || "9999-99-99";
    const areaText = normalizeMatch(routeAreaText(customer));
    const areaScore = areaTerms.length && areaTerms.every((term) => areaText.includes(term)) ? -4 : 0;
    const reply = routeReplyKind(customer);
    const replyScore = reply === "key" ? -2 : reply === "positive" ? -1 : 0;
    return `${String(statusScore + areaScore + replyScore).padStart(3, "0")}-${due}-${normalizeMatch(customer.name)}`;
  }

  function selectedRouteCustomers() {
    return [...routeSelectedCustomerIds]
      .map((id) => findCustomer(id))
      .filter((customer) => customer && !customer.is_inactive);
  }

  function routeCandidates() {
    const areaTerms = routeAreaTerms();
    const statusFilter = el.routeStatus?.value || "due";
    const replyFilter = el.routeReplyFilter?.value || "all";
    const requireLocation = el.routeRequireLocation?.checked;
    const starredOnly = Boolean(el.routeStarredOnly?.checked);
    return customers
      .filter((customer) => !customer.is_inactive)
      .filter((customer) => {
        const routeInstallation = routePrimaryInstallation(customer, { areaTerms });
        const kind = routeInstallation ? statusKindForDueDate(routeInstallation.next_service_due) : statusKind(customer);
        if (statusFilter === "due" && !["red", "yellow"].includes(kind)) return false;
        if (statusFilter !== "due" && kind !== statusFilter) return false;
        if (requireLocation && !hasRouteLocation(customer)) return false;
        if (starredOnly && !isStarredCustomer(customer)) return false;
        if (areaTerms.length) {
          const areaText = normalizeMatch(routeAreaText(customer));
          if (!areaTerms.every((term) => areaText.includes(term))) return false;
        }
        const reply = routeReplyKind(customer);
        if (replyFilter === "positive" && !["positive", "key"].includes(reply)) return false;
        if (replyFilter === "key" && reply !== "key") return false;
        if (replyFilter === "manual" && !routeSelectedCustomerIds.has(customerKey(customer))) return false;
        return true;
      })
      .sort((a, b) => routeCandidateScore(a, areaTerms).localeCompare(routeCandidateScore(b, areaTerms)));
  }

  function sortedRouteRows(list) {
    return optimizedRouteCustomers(list).map((customer, index) => ({ customer, index: index + 1 }));
  }

  function minutesFromTime(value) {
    const [hours, minutes] = normalizeBookingTime(value, "00:00").split(":").map(Number);
    return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  }

  function timeFromMinutes(total) {
    const hours = Math.floor(total / 60) % 24;
    const minutes = total % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function normalizeBookingTime(value, fallback = "09:00") {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{1,2})(?::?(\d{1,2}))?$/);
    if (!match) return fallback;
    let hours = Number(match[1]);
    let minutes = Number(match[2] ?? 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
    minutes = Math.round(minutes / 15) * 15;
    if (minutes === 60) {
      hours = (hours + 1) % 24;
      minutes = 0;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function routeRowsWithinDay(rows) {
    const start = minutesFromTime(el.routeStartTime?.value || "08:00");
    const end = minutesFromTime(el.routeEndTime?.value || "18:00");
    const duration = Number(el.routeDuration?.value || 60);
    const maxJobs = Math.max(1, Math.min(10, Number(el.routeMaxJobs?.value || 8)));
    const areaIndex = routeAreaPointIndex();
    const originPoint = routeOriginPoint(areaIndex) || defaultRouteOrigin.point;
    let cursor = start;
    let previousCustomer = null;
    const planned = [];
    const overflow = [];
    for (const row of rows) {
      const driveLeg = planned.length
        ? estimatedDriveLeg(previousCustomer, row.customer, areaIndex)
        : estimatedDriveLeg(null, row.customer, areaIndex, originPoint);
      const rowStart = cursor + driveLeg.totalMinutes;
      const finish = rowStart + duration;
      const timedRow = {
        ...row,
        driveMinutes: driveLeg.totalMinutes,
        driveLeg,
        startTime: timeFromMinutes(rowStart),
        endTime: timeFromMinutes(finish),
      };
      if (finish <= end && planned.length < maxJobs) {
        planned.push(timedRow);
        cursor = finish;
        previousCustomer = row.customer;
      } else {
        overflow.push(timedRow);
      }
    }
    return { planned, overflow };
  }

  function updateRouteAreaOptions() {
    if (!el.routeAreaOptions) return;
    const areas = new Set();
    for (const customer of customers) {
      if (customer.is_inactive) continue;
      for (const value of [customer.location_tag, customer.visit_city]) {
        const text = String(value || "").trim();
        if (text && text.length <= 40) areas.add(text);
      }
      for (const installation of installationsForCustomer(customer)) {
        const location = locationForInstallation(installation, customer);
        for (const value of [installation.label, location?.location_name, location?.city]) {
          const text = String(value || "").trim();
          if (text && text.length <= 40) areas.add(text);
        }
      }
    }
    el.routeAreaOptions.innerHTML = [...areas]
      .sort((a, b) => a.localeCompare(b, "nb"))
      .slice(0, 200)
      .map((value) => `<option value="${escapeHtml(value)}"></option>`)
      .join("");
  }

  function routeBookingRows() {
    const date = el.routeBookingDate?.value || isoDate(new Date());
    const duration = Number(el.routeDuration?.value || 60);
    const areaTerms = routeAreaTerms();
    return routePlannerRows.map((row) => {
      const installation = routePrimaryInstallation(row.customer, { areaTerms });
      const installationNote = installation ? installationBookingNote(installation, row.customer) : "";
      const booking = {
        customerId: customerKey(row.customer),
        date,
        time: normalizeBookingTime(row.startTime || el.routeStartTime?.value || "08:00", "08:00"),
        type: "service",
        duration: String(duration),
        resource: el.routeResource?.value || defaultBookingResourceName(),
        status: "booked",
        note: [
          "Utkast fra ruteplanlegger.",
          `Rute #${row.index}.`,
          installationNote,
          routeReplyLabel(row.customer),
          row.driveLeg?.totalMinutes ? routeDriveText(row.driveLeg) : "",
          !installationNote && accessInfo(row.customer) ? `Adkomst: ${accessInfo(row.customer)}` : "",
        ].filter(Boolean).join("\n"),
      };
      return booking;
    });
  }

  function routeBulkSmsText() {
    if (!routePlannerRows.length) return "";
    return routePlannerRows.map((row) => {
      const customer = row.customer;
      return [
        `${cleanDisplayName(customer)}${customer.phone ? ` - ${customer.phone}` : ""}`,
        routeServiceSmsText(customer),
      ].filter(Boolean).join("\n");
    }).join("\n\n---\n\n");
  }

  async function copyRouteBulkSms() {
    const text = routeBulkSmsText();
    if (!text) throw new Error("Ingen rute å kopiere SMS for.");
    await copyTextToClipboard(text);
    setSyncStatus(`SMS-tekster kopiert for ${routePlannerRows.length} kunder.`, "ok");
  }

  function renderRouteSelectedCustomers() {
    if (!el.routeSelectedCustomers) return;
    const selected = selectedRouteCustomers();
    if (!selected.length) {
      el.routeSelectedCustomers.innerHTML = `<div class="empty-state">Ingen manuelt valgte kunder ennå. Søk opp de som har svart ja og legg dem til.</div>`;
      return;
    }
    el.routeSelectedCustomers.innerHTML = selected.map((customer) => `
      <article>
        <div>
          <strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong>
          <span>${escapeHtml([customer.visit_city || customer.location_tag, customer.phone, formatDate(nextServiceDueForCustomer(customer))].filter(Boolean).join(" · "))}</span>
        </div>
        <button data-route-remove-selected="${escapeHtml(customerKey(customer))}" type="button">Fjern</button>
      </article>
    `).join("");
  }

  function renderRouteCustomerSearch() {
    if (!el.routeCustomerResults) return;
    const search = el.routeCustomerSearch?.value || "";
    const starredOnly = Boolean(el.routeStarredOnly?.checked);
    const matches = customers
      .filter((customer) => !customer.is_inactive)
      .filter((customer) => matchesSearchText(customer, search))
      .filter((customer) => !starredOnly || isStarredCustomer(customer))
      .filter((customer) => !routeSelectedCustomerIds.has(customerKey(customer)))
      .sort((a, b) => {
        const aDue = ["red", "yellow"].includes(statusKind(a)) ? 0 : 1;
        const bDue = ["red", "yellow"].includes(statusKind(b)) ? 0 : 1;
        return aDue - bDue || (a.name || "").localeCompare(b.name || "", "nb");
      })
      .slice(0, search.trim() ? 8 : 0);
    if (!matches.length) {
      el.routeCustomerResults.innerHTML = search.trim() ? `<div class="booking-result-empty">Ingen treff.</div>` : "";
      return;
    }
    el.routeCustomerResults.innerHTML = matches.map((customer) => `
      <button data-route-add-customer="${escapeHtml(customerKey(customer))}" type="button">
        <strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong>
        <span>${escapeHtml([customer.visit_city || customer.location_tag, customer.phone, statusLabel(customer)].filter(Boolean).join(" · "))}</span>
      </button>
    `).join("");
  }

  function renderRoutePlanner() {
    if (!el.routeResults) return;
    renderResourceSelectOptions(el.routeResource, el.routeResource?.value || defaultBookingResourceName());
    if (!el.routeBookingDate.value) el.routeBookingDate.value = isoDate(new Date());
    updateRouteAreaOptions();
    const starredOnly = Boolean(el.routeStarredOnly?.checked);
    const routeTerms = routeAreaTerms();
    const manual = selectedRouteCustomers().filter((customer) => !starredOnly || isStarredCustomer(customer));
    const maxJobs = Math.max(1, Math.min(10, Number(el.routeMaxJobs?.value || 8)));
    const candidates = manual.length ? manual : routeCandidates().slice(0, maxJobs * 4);
    const sortedRows = sortedRouteRows(candidates);
    const dayPlan = routeRowsWithinDay(sortedRows);
    routePlannerRows = dayPlan.planned;
    const missing = customers
      .filter((customer) => !customer.is_inactive)
      .filter((customer) => ["red", "yellow"].includes(statusKind(customer)))
      .filter((customer) => !starredOnly || isStarredCustomer(customer))
      .filter((customer) => !hasRouteLocation(customer))
      .filter((customer) => {
        const areaTerms = routeTerms;
        if (!areaTerms.length) return true;
        const areaText = normalizeMatch(routeAreaText(customer));
        return areaTerms.every((term) => areaText.includes(term));
      })
      .slice(0, 8);
    const directionsUrl = googleDirectionsUrlForRows(routePlannerRows);
    el.routeOpenMapsButton.disabled = !directionsUrl;
    el.routeBookDraftButton.disabled = !routePlannerRows.length || !isAdmin();
    if (el.routeCampaignButton) el.routeCampaignButton.disabled = !routePlannerRows.length;
    el.routeSummary.innerHTML = `
      <strong>${routePlannerRows.length} servicekandidater foreslått</strong>
      <span>Serviceoppfølging er potensielle jobber. Book først når kunden har sagt ja eller du har avtale/adkomst. Start: ${escapeHtml(routeOriginQuery())}. ${candidates.length} aktuelle treff. ${routePlannerRows.filter((row) => routePoint(row.customer)).length} med kartgrunnlag. ${dayPlan.overflow.length ? `${dayPlan.overflow.length} får ikke plass i valgt tidsrom.` : "Alle får plass i valgt tidsrom."}</span>
      <small>Åpne ruten i Google Maps for faktisk kjøretid og siste justering av rekkefølgen. Ekte Maps-tid inne i appen krever Google Routes/Distance Matrix API senere.</small>
    `;
    if (!routePlannerRows.length) {
      el.routeResults.innerHTML = `<div class="empty-state">Ingen kunder passet filteret. Prøv et annet område eller slå av kravet om adresse/koordinater.</div>`;
    } else {
      el.routeResults.innerHTML = routePlannerRows.map((row) => {
        const customer = row.customer;
        const access = accessInfo(customer);
        const installation = routePrimaryInstallation(customer, { areaTerms: routeTerms });
        const routeKind = installation ? statusKindForDueDate(installation.next_service_due) : statusKind(customer);
        const routeStatus = installation ? installationServiceStatusLabel(installation) : statusLabel(customer);
        const installationLine = routeInstallationLine(customer, { areaTerms: routeTerms });
        const installationLocation = installation ? locationAddressText(locationForInstallation(installation, customer)) : "";
        const routeMapQuery = routeLocationText(customer, installation);
        return `
          <article class="route-card" data-route-customer="${escapeHtml(customerKey(customer))}">
            <div class="route-number">${row.index}</div>
            <div>
              <div class="route-title">
                <span class="dot ${routeKind}"></span>
                <strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong>
                <em>${escapeHtml(routeStatus)}</em>
              </div>
              <p>${escapeHtml(installationLocation || siteLocationText(customer) || "Adresse mangler")}</p>
              ${installationLine ? `<small>${escapeHtml(installationLine)}</small>` : ""}
              <small>${escapeHtml(row.startTime || "")}-${escapeHtml(row.endTime || "")} · ${escapeHtml(routeLocationLabel(customer))} · ${escapeHtml(routeReplyLabel(customer))} · Neste serviceoppfølging ${formatDate(installation?.next_service_due || nextServiceDueForCustomer(customer))}</small>
              ${routeDriveHtml(row.driveLeg)}
              ${isLikelyHomeAddress(customer) ? `<p class="route-access">Mulig hjemmeadresse: kontroller koordinater/anleggsadresse for booking.</p>` : ""}
              ${access ? `<p class="route-access">${escapeHtml(access)}</p>` : ""}
            </div>
            <div class="route-card-actions">
              ${customer.phone ? `<a href="tel:${escapeHtml(phoneForLink(customer.phone))}">Ring</a>${copyPhoneButton(customer.phone, "Kopier")}` : ""}
              ${routeMapQuery ? `<a href="${escapeHtml(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(routeMapQuery)}`)}" target="_blank" rel="noreferrer">Kart</a>` : ""}
              ${routeMessageButtons(customer)}
              <button class="book-primary" data-book-customer="${escapeHtml(customerKey(customer))}" data-book-type="service" data-book-installation="${escapeHtml(installation?.id || "")}" type="button">Book service</button>
            </div>
          </article>
        `;
      }).join("");
    }
    if (dayPlan.overflow.length) {
      el.routeResults.insertAdjacentHTML("beforeend", `
        <section class="route-overflow">
          <h3>Ikke plass denne dagen</h3>
          ${dayPlan.overflow.map((row) => `
            <article class="route-overflow-card" data-route-overflow-customer="${escapeHtml(customerKey(row.customer))}" tabindex="0" title="Trykk for kundeinfo. Hold over for handlinger.">
              <div>
                <strong>${customerStarHtml(row.customer)}${customerCashBadgeHtml(row.customer)}${escapeHtml(cleanDisplayName(row.customer))}</strong>
                <span>Forslag tidligst ${escapeHtml(row.startTime)} · ${escapeHtml(row.customer.visit_city || row.customer.location_tag || "")}</span>
              </div>
              <div class="route-overflow-actions">
                ${row.customer.phone ? `<a href="${escapeHtml(smsUrl())}" target="_blank" rel="noreferrer">SMS</a>${copyPhoneButton(row.customer.phone, "Kopier nr")}` : ""}
                ${routeMessageButtons(row.customer)}
                <button data-book-customer="${escapeHtml(customerKey(row.customer))}" data-book-type="service" data-book-installation="${escapeHtml(routePrimaryInstallation(row.customer, { areaTerms: routeTerms })?.id || "")}" type="button">Book service</button>
                <button data-route-open-customer="${escapeHtml(customerKey(row.customer))}" type="button">Info</button>
              </div>
            </article>
          `).join("")}
        </section>
      `);
    }
    el.routeMissing.innerHTML = missing.length ? `
      <h3>Mangler kartgrunnlag</h3>
      <div class="route-missing-list">
        ${missing.map((customer) => `
          <button data-route-missing-customer="${escapeHtml(customerKey(customer))}" type="button" title="Åpne kundekort i sidepanel for å sjekke eller fylle inn adresse/koordinater.">
            <strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong>
            <span>${escapeHtml(customer.location_tag || customer.visit_city || "Ukjent sted")} · ${formatDate(nextServiceDueForCustomer(customer))}</span>
          </button>
        `).join("")}
      </div>
    ` : "";
    renderRouteSelectedCustomers();
    renderRouteCustomerSearch();
    renderRouteMonth();
  }

  function calendarDateTime(date, time) {
    return `${String(date || "").replaceAll("-", "")}T${String(time || "09:00").replace(":", "")}00`;
  }

  function addMinutesToTime(date, time, minutes) {
    const start = new Date(`${date}T${time || "09:00"}:00`);
    if (Number.isNaN(start.getTime())) return { date, time: "10:00" };
    start.setMinutes(start.getMinutes() + Number(minutes || 60));
    return { date: isoDate(start), time: start.toTimeString().slice(0, 5) };
  }

  function googleCalendarUrl(row) {
    const customer = row.customer;
    const booking = row.booking;
    const end = addMinutesToTime(booking.date, booking.time, booking.duration);
    const title = `${bookingJobLabel(row)} - ${cleanDisplayName(customer) || "kunde"}`;
    const details = [
      booking.note || "",
      customer.phone ? `Telefon: ${customer.phone}` : "",
      customer.email ? `E-post: ${customer.email}` : "",
      mapQuery(customer) ? `Kart: ${mapsUrl(customer)}` : "",
    ].filter(Boolean).join("\n");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${calendarDateTime(booking.date, booking.time)}/${calendarDateTime(end.date, end.time)}`,
      details,
      location: addressFor(customer) || customer.location_tag || customer.visit_city || "",
      ctz: "Europe/Oslo",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function customerActionLinks(customer) {
    const links = [];
    if (customer.phone) links.push(`<a href="tel:${escapeHtml(phoneForLink(customer.phone))}" title="Ring kunden med registrert telefonnummer.">Ring</a>`);
    const emailLink = customerEmailLinkHtml(customer);
    if (emailLink) links.push(emailLink);
    if (mapQuery(customer)) links.push(`<a href="${escapeHtml(mapsUrl(customer))}" target="_blank" rel="noreferrer" title="Åpne anleggsadressen i Google Maps.">Kart</a>`);
    return links.join("");
  }

  function customerPrimaryActionsHtml(customer) {
    const key = customerKey(customer);
    const actions = [];
    if (customer.phone) {
      actions.push(`<a href="tel:${escapeHtml(phoneForLink(customer.phone))}" title="Ring kunden med registrert telefonnummer.">Ring</a>`);
    }
    if (isAdmin() && !customer.is_inactive) {
      actions.push(`<button class="book-primary" data-book-customer="${escapeHtml(key)}" type="button" title="Book avtale i kalenderen. Dette lager jobbutkast hvis det mangler.">Book avtale</button>`);
    }
    if (mapQuery(customer)) {
      actions.push(`<a href="${escapeHtml(mapsUrl(customer))}" target="_blank" rel="noreferrer" title="Åpne anleggsadressen i Google Maps.">Kart</a>`);
    }
    actions.push(customerMoreActionsHtml(customer));
    return actions.filter(Boolean).join("");
  }

  function customerMoreActionsHtml(customer) {
    const key = customerKey(customer);
    const actions = [];
    const emailLink = customerEmailLinkHtml(customer);
    if (emailLink) actions.push(emailLink);
    if (customer.phone) actions.push(`<a href="${escapeHtml(smsUrl())}" target="_blank" rel="noreferrer" title="Åpne Google Messages for å sende SMS.">SMS</a>`);
    if (isAdmin() && !customer.is_inactive) {
      actions.push(`<button class="secondary" data-new-order-customer="${escapeHtml(key)}" type="button" title="Lag jobb uten å velge dato nå. Bruk Book avtale hvis tidspunktet skal settes med en gang.">Ny jobb uten dato</button>`);
      actions.push(`<button class="secondary" data-new-lead-existing-customer="${escapeHtml(key)}" type="button" title="Opprett ny oppfølging/tilbud på eksisterende kunde, f.eks. ekstra varmepumpe, befaring eller blåseisolering.">Ny oppfølging</button>`);
      actions.push(`<button class="secondary" data-new-installation-customer="${escapeHtml(key)}" type="button" title="Registrer egen varmepumpe/anlegg med adresse og servicefrist.">Ny varmepumpe/anlegg</button>`);
      actions.push(`<button class="secondary" data-new-reminder-customer="${escapeHtml(key)}" type="button" title="Lag rask påminnelse om å ringe, sende tilbud eller følge opp kunden.">Ny påminnelse</button>`);
      actions.push(insulationToggleHtml(customer));
      if (isInsulationCustomer(customer)) actions.push(`<button class="secondary" data-new-lead-existing-customer="${escapeHtml(key)}" data-lead-kind="blaseisolering" type="button" title="Lag egen oppfølging/tilbud for blåseisolering på denne kunden.">Ny blåseisolering</button>`);
    }
    if (isAdmin()) {
      actions.push(`<button class="secondary" data-edit-customer="${escapeHtml(key)}" type="button" title="Rediger kundedata, adresse, e-post, telefon og betalingsvalg.">Rediger kunde</button>`);
    }
    if (!actions.length) return "";
    return `
      <details class="inline-more-actions">
        <summary title="Vis flere handlinger for kunden.">Mer</summary>
        <div>${actions.join("")}</div>
      </details>
    `;
  }

  function customerEmailLinkHtml(customer, label = "E-post") {
    if (!customer?.email) return "";
    const draft = customerEmailDraftParts(customer);
    return `<a href="${escapeHtml(emailUrl(customer, draft.reference))}" data-open-customer-email="${escapeHtml(customerKey(customer))}" data-email-reference="${escapeHtml(draft.reference)}" title="Åpne standard e-postprogram. CRM-ref legges i emne og logges på kundekortet.">${escapeHtml(label)}</a>`;
  }

  function emailUrl(customer, reference = "") {
    const draft = customerEmailDraftParts(customer, reference);
    return mailtoUrl(draft.to, draft.subject, draft.body);
  }

  function smsUrl() {
    return "https://messages.google.com/web/conversations/new";
  }

  function lookupQuery(customer) {
    return [
      cleanDisplayName(customer),
      customer.phone || "",
      addressFor(customer) || customer.location_tag || customer.visit_city || "",
      postalAddressFor(customer),
    ]
      .filter(Boolean)
      .map((part) => String(part).replace(/[;,|]+/g, " ").trim())
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function directoryLinks(customer) {
    const query = lookupQuery(customer);
    return {
      one: `https://www.1881.no/?query=${encodeURIComponent(query)}`,
      google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    };
  }

  function lookupMissingDataSection(customer, compact = false) {
    const missing = [];
    if (!customer.phone) missing.push("telefon");
    if (!customer.email) missing.push("e-post");
    if (!addressFor(customer) && !exactCoordinates(customer)) missing.push("anleggsadresse");
    if (!missing.length) return "";
    const links = directoryLinks(customer);
    const tag = compact ? "section" : "section";
    const className = compact ? "quick-block lookup-block" : "detail-section lookup-block";
    const heading = compact ? "<strong>Finn manglende info</strong>" : "<h3>Finn manglende info</h3>";
    return `
      <${tag} class="${className}">
        ${heading}
        <p>Mangler ${escapeHtml(missing.join(", "))}. Sjekk manuelt før du lagrer ny adresse, spesielt hvis kunden har hytte.</p>
        <div class="lookup-actions">
          <a href="${escapeHtml(links.one)}" target="_blank" rel="noreferrer">Søk 1881</a>
          <a href="${escapeHtml(links.google)}" target="_blank" rel="noreferrer">Søk Google</a>
        </div>
      </${tag}>
    `;
  }

  function statusKind(customer) {
    if (customer?.is_inactive) return "inactive";
    const nextDue = nextServiceDueForCustomer(customer);
    if (nextDue) {
      const due = new Date(`${nextDue}T00:00:00`);
      if (!Number.isNaN(due.getTime())) {
        const today = new Date(`${isoDate(new Date())}T00:00:00`);
        const days = Math.round((due - today) / 86400000);
        if (days < 0) return "red";
        if (days < 120) return "yellow";
        return "green";
      }
    }
    const status = String(customer.service_status || "").toLowerCase();
    if (status.includes("service nå") || status.includes("service na") || status.includes("forfalt") || status.includes("rød")) return "red";
    if (status.includes("snart") || status.includes("nærmer") || status.includes("gul")) return "yellow";
    if (status.includes("ok") || status.includes("grønn")) return "green";
    return "missing";
  }

  function statusLabel(customer) {
    const kind = statusKind(customer);
    if (kind === "inactive") return "Inaktiv";
    if (kind === "red") return "Forfalt service";
    if (kind === "yellow") return "Aktuell for service";
    if (kind === "green") return "Neste service senere";
    return "Mangler serviceinfo";
  }

  function statusKindForDueDate(value) {
    if (!value) return "";
    const due = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(due.getTime())) return "";
    const days = Math.round((due - new Date()) / 86400000);
    if (days < 0) return "red";
    if (days < 120) return "yellow";
    return "green";
  }

  function installationsForCustomer(customer) {
    const key = customerKey(customer);
    return installationsByCustomer.get(key) || installationsByCustomer.get(customer?.lime_id) || [];
  }

  function customerLocationsForCustomer(customer) {
    const key = customerKey(customer);
    return customerLocationsByCustomer.get(key) || [];
  }

  function fallbackCustomerLocation(customer) {
    if (!customer) return null;
    return {
      id: "",
      customer_id: customerKey(customer),
      location_name: "Kundeadresse",
      address: customer.visit_street || "",
      postal_code: customer.visit_zip || "",
      city: customer.visit_city || customer.location_tag || "",
      is_primary: true,
      isFallback: true,
    };
  }

  function primaryLocationForCustomer(customer) {
    const locations = customerLocationsForCustomer(customer);
    return locations.find((location) => location.is_primary) || locations[0] || fallbackCustomerLocation(customer);
  }

  function locationAddressText(location) {
    if (!location) return "";
    return [
      location.address,
      [location.postal_code, location.city].filter(Boolean).join(" "),
    ].filter(Boolean).join(", ");
  }

  function locationOptionLabel(location) {
    const address = locationAddressText(location);
    return [location.location_name || "Anlegg", address].filter(Boolean).join(" - ");
  }

  function locationForInstallation(installation, customer) {
    const id = installation?.location_id || installation?.locationId || "";
    return (id && customerLocationById.get(String(id))) || primaryLocationForCustomer(customer);
  }

  function installationIdForOrder(order, job = jobForOrder(order)) {
    return order?.installation_id || order?.installationId || job?.installation_id || job?.installationId || "";
  }

  function locationIdForOrder(order, job = jobForOrder(order)) {
    return order?.location_id || order?.locationId || job?.location_id || job?.locationId || "";
  }

  function installationForOrder(order, customer, job = jobForOrder(order)) {
    const id = installationIdForOrder(order, job);
    if (!id || !customer) return null;
    return installationsForCustomer(customer).find((installation) => String(installation.id || "") === String(id)) || null;
  }

  function orderInstallationText(order, customer, job = jobForOrder(order)) {
    const installation = installationForOrder(order, customer, job);
    if (installation) {
      const location = locationForInstallation(installation, customer);
      return [
        installationDisplayName(installation),
        locationAddressText(location),
      ].filter(Boolean).join(" - ");
    }
    const locationId = locationIdForOrder(order, job);
    const location = locationId ? customerLocationById.get(String(locationId)) : null;
    if (location) return locationOptionLabel(location);
    return "";
  }

  function installationServiceIntervalMonths(installation) {
    const months = Number(installation?.service_interval_months || installation?.serviceIntervalMonths || 0);
    return Number.isFinite(months) && months > 0 ? months : 0;
  }

  function installationServiceIntervalLabel(installation) {
    const months = installationServiceIntervalMonths(installation);
    if (!months) return "Manuelt intervall";
    if (months % 12 === 0) return `${months / 12} år`;
    return `${months} mnd`;
  }

  function installationServiceStatusLabel(installation) {
    const kind = statusKindForDueDate(installation?.next_service_due);
    if (kind === "red") return "Forfalt service";
    if (kind === "yellow") return "Aktuell for service";
    if (kind === "green") return "Neste service senere";
    return "Mangler serviceinfo";
  }

  function installationAccessLabel(installation, customer) {
    const location = locationForInstallation(installation, customer);
    const access = [
      location?.directions,
      installation?.access_note,
      installation?.access_notes,
      installation?.accessInfo,
      accessInfo(customer),
    ].filter(Boolean).join("\n").trim();
    return access;
  }

  function installationShortLabel(installation, customer) {
    const location = locationForInstallation(installation, customer);
    return [
      installation?.label || "Anlegg",
      [installation?.brand, installation?.model].filter(Boolean).join(" "),
      locationAddressText(location),
    ].filter(Boolean).join(" - ");
  }

  function installationBookingNote(installation, customer) {
    const location = locationForInstallation(installation, customer);
    const lines = [
      `Anlegg: ${installationShortLabel(installation, customer)}`,
      locationAddressText(location) ? `Adresse: ${locationAddressText(location)}` : "",
      installationServiceIntervalLabel(installation) ? `Serviceintervall: ${installationServiceIntervalLabel(installation)}` : "",
      installationAccessLabel(installation, customer) ? `Kodeboks/nøkkel/adkomst: ${installationAccessLabel(installation, customer)}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  }

  function customerServiceSummary(customer, installations = installationsForCustomer(customer)) {
    const activeInstallations = (installations || []).filter((installation) => installation.active !== false);
    if (activeInstallations.length > 1) {
      const due = activeInstallations.filter((installation) => statusKindForDueDate(installation.next_service_due) === "red").length;
      const upcoming = activeInstallations.filter((installation) => statusKindForDueDate(installation.next_service_due) === "yellow").length;
      const summary = [`${activeInstallations.length} anlegg`];
      if (due) summary.push(`${due} forfalt service`);
      if (upcoming) summary.push(`${upcoming} aktuell for service`);
      if (!due && !upcoming) summary.push("neste service senere");
      return summary.join(" · ");
    }
    if (activeInstallations.length === 1) return installationServiceStatusLabel(activeInstallations[0]);
    if (customer?.brand || customer?.model_or_note || customer?.first_install_date || customer?.next_service_due) return "Serviceinfo på kundekort";
    return statusLabel(customer);
  }

  function customerRelationshipLabel(customer, installations = installationsForCustomer(customer)) {
    if (customer?.is_inactive) return "Inaktivt kundekort";
    if (!customerIsMarkedCustomer(customer)) return "Er ikke kunde";
    if (customerDisplayTags(splitTags(customer?.tags)).some((tag) => tagIdentity(tag) === "servicekunde")) return "Servicekunde";
    const activeInstallations = (installations || []).filter((installation) => installation.active !== false);
    if (activeInstallations.length) {
      const text = normalizeMatch(activeInstallations.map((installation) => [
        installation.notes,
        installation.brand,
        installation.model,
      ].filter(Boolean).join(" ")).join(" "));
      if (/\b(ikke levert av oss|leverandor|megaflis|coop|annen leverandor|andre montor)\b/.test(text)) return "Servicekunde";
      return "Er kunde";
    }
    return "Er kunde";
  }

  function nextServiceDueForCustomer(customer) {
    const dates = [
      customer?.next_service_due,
      ...installationsForCustomer(customer)
        .filter((installation) => installation.active !== false)
        .map((installation) => installation.next_service_due),
    ].filter(Boolean).sort();
    return dates[0] || "";
  }

  function installationSearchText(customer) {
    return installationsForCustomer(customer)
      .map((installation) => [
        installation.label,
        installation.kind,
        installation.brand,
        installation.model,
        locationAddressText(locationForInstallation(installation, customer)),
        installation.notes,
      ].filter(Boolean).join(" "))
      .join(" ");
  }

  function customerActivitySearchText(customer) {
    const keys = new Set([
      customerKey(customer),
      customer?.id,
      customer?.lime_id,
      customer?.legacy_lime_id,
    ].filter(Boolean).map(String));
    return (activities || [])
      .filter((activity) => {
        const metadata = activity?.metadata || {};
        return keys.has(String(activity?.customer_id || ""))
          || keys.has(String(activity?.customerId || ""))
          || keys.has(String(metadata.customer_id || ""))
          || keys.has(String(metadata.customer_lime_id || ""))
          || keys.has(String(metadata.customer_key || ""));
      })
      .slice(0, 30)
      .map((activity) => {
        const metadata = activity?.metadata || {};
        return [
          activity.summary,
          activity.body,
          activity.activity_type,
          metadata.email_reference,
          metadata.subject,
          metadata.to,
          metadata.from,
        ].filter(Boolean).join(" ");
      })
      .join(" ");
  }

  function customerHaystack(customer) {
    return [
      customer.name,
      customer.phone,
      customer.email,
      customer.visit_street,
      customer.visit_city,
      customer.postal_street,
      customer.postal_zip,
      customer.postal_city,
      customer.location_tag,
      customer.brand,
      customer.model_or_note,
      customer.tags,
      customer.lead_source,
      customer.latest_deal_name,
      customer.local_note,
      installationSearchText(customer),
      customerActivitySearchText(customer),
    ].join(" ").toLowerCase();
  }

  function matchesSearchText(customer, searchText) {
    const terms = normalizeMatch(searchText).split(" ").filter(Boolean);
    if (!terms.length) return true;
    const haystack = normalizeMatch(customerHaystack(customer));
    const digits = String(customer.phone || "").replace(/\D/g, "");
    return terms.every((term) => {
      const termDigits = term.replace(/\D/g, "");
      return haystack.includes(term) || (termDigits && digits.includes(termDigits));
    });
  }

  function isInsulationCustomer(customer) {
    const text = String([
      customer.name,
      customer.tags,
      customer.lead_source,
      customer.customer_type,
      customer.latest_deal_name,
      customer.model_or_note,
      customer.local_note,
    ].join(" "))
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replaceAll("ø", "o")
      .replaceAll("å", "a")
      .replaceAll("æ", "ae")
      .replaceAll("ã¸", "o")
      .replaceAll("ã¥", "a")
      .replaceAll("ã¦", "ae")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return /\b(isobygg|blaseisolering|blase|blasing|isolering)\b/.test(text);
  }

  function isAdmin() {
    return currentUser?.key === "admin" || String(currentUser?.role || "").toLowerCase() === "admin";
  }

  function profileDisplayName(profile) {
    return String(profile?.full_name || profile?.display_name || profile?.name || "").trim();
  }

  function profilePreferenceKey(profile) {
    return String(profile?.id || profile?.key || profileDisplayName(profile) || "").trim();
  }

  function profileIsActive(profile) {
    return profile?.active !== false;
  }

  function profileIsTechnician(profile) {
    return String(profile?.role || "").toLowerCase() === "technician" || String(profile?.role || "").toLowerCase() === "tekniker";
  }

  function profileIsHubert(profile) {
    return normalizeMatch(profileDisplayName(profile)).includes("hubert");
  }

  function profilePreferencesMap() {
    const value = crmSettings.profile_preferences;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function defaultProfilePreferences(profile) {
    return {
      language: profileIsHubert(profile) ? "pl" : "nb",
      extraHelp: profileIsHubert(profile),
    };
  }

  function profilePreferences(profile) {
    const defaults = defaultProfilePreferences(profile);
    const key = profilePreferenceKey(profile);
    const saved = key ? profilePreferencesMap()[key] || {} : {};
    const language = supportedProfileLanguages[saved.language] ? saved.language : defaults.language;
    return {
      language,
      extraHelp: "extraHelp" in saved ? Boolean(saved.extraHelp) : Boolean(defaults.extraHelp),
    };
  }

  function profileLanguageOptionsHtml(selected = "nb") {
    return Object.entries(supportedProfileLanguages)
      .map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`)
      .join("");
  }

  function currentTechnicianLanguage() {
    const language = currentUser?.language || "nb";
    return supportedProfileLanguages[language] ? language : "nb";
  }

  function technicianText(key, ...args) {
    const language = currentTechnicianLanguage();
    const value = technicianCopy[language]?.[key] ?? technicianCopy.nb[key];
    return typeof value === "function" ? value(...args) : value;
  }

  function currentTechnicianExtraHelp() {
    return Boolean(currentUser?.extraHelp);
  }

  function applyCurrentUserPreferences(profile = null) {
    if (!currentUser) return;
    const sourceProfile = profile
      || profiles.find((item) => String(item.id || "") === String(currentUser.id || ""))
      || profiles.find((item) => normalizeMatch(profileDisplayName(item)) === normalizeMatch(currentUser.name))
      || currentUser;
    const prefs = profilePreferences(sourceProfile);
    currentUser.language = prefs.language;
    currentUser.extraHelp = prefs.extraHelp;
  }

  function activeResourceProfiles() {
    return (profiles || [])
      .filter(profileIsActive)
      .filter((profile) => profileDisplayName(profile));
  }

  function resourceSortRank(name) {
    const normalized = normalizeMatch(name);
    if (normalized === "gunnar") return 1;
    if (normalized === "hubert") return 2;
    if (normalized === "gunnar og hubert") return 3;
    return 10;
  }

  function sortResourceNames(list) {
    return [...new Set(list.filter(Boolean).map((name) => String(name).trim()).filter(Boolean))]
      .sort((a, b) => resourceSortRank(a) - resourceSortRank(b) || a.localeCompare(b, "nb-NO"));
  }

  function activeResourceNames() {
    return sortResourceNames(activeResourceProfiles().map(profileDisplayName));
  }

  function activeTechnicianNames() {
    return sortResourceNames(activeResourceProfiles().filter(profileIsTechnician).map(profileDisplayName));
  }

  function profileForResourceName(name) {
    const normalized = normalizeMatch(name);
    if (!normalized) return null;
    return (profiles || []).find((profile) => normalizeMatch(profileDisplayName(profile)) === normalized) || null;
  }

  function resourceBelongsToInactiveProfile(name) {
    const profile = profileForResourceName(name);
    return Boolean(profile && !profileIsActive(profile));
  }

  function activeNamedResource(name) {
    const normalized = normalizeMatch(name);
    return activeResourceNames().some((item) => normalizeMatch(item) === normalized);
  }

  function jointResourceAvailable() {
    return activeNamedResource("Gunnar") && activeNamedResource("Hubert");
  }

  function defaultBookingResourceName() {
    const technicians = activeTechnicianNames();
    if (technicians.length) return technicians[0];
    if (currentUser?.name && activeNamedResource(currentUser.name)) return currentUser.name;
    return activeNamedResource("Gunnar") ? "Gunnar" : activeResourceNames()[0] || currentUser?.name || "Gunnar";
  }

  function assignableResourceNames(selected = "") {
    const resources = activeResourceNames();
    if (jointResourceAvailable()) resources.push("Gunnar og Hubert");
    if (selected && !resources.includes(selected)) resources.push(selected);
    return sortResourceNames(resources);
  }

  function renderResourceSelectOptions(select, selected = "", options = {}) {
    if (!select) return "";
    const selectedValue = selected || defaultBookingResourceName();
    const resources = assignableResourceNames(options.includeSelected === false ? "" : selectedValue);
    select.innerHTML = resources.map((resource) => `<option value="${escapeHtml(resource)}">${escapeHtml(resource)}</option>`).join("");
    select.value = resources.includes(selectedValue) ? selectedValue : resources[0] || "";
    return select.value;
  }

  function updateResourceSelects() {
    renderResourceSelectOptions(el.routeResource, defaultBookingResourceName(), { includeSelected: false });
    renderResourceSelectOptions(el.bookingResource, defaultBookingResourceName(), { includeSelected: false });
  }

  async function saveProfilePreferences(profileId, prefs) {
    const current = profilePreferencesMap();
    const next = {
      ...current,
      [profileId]: {
        language: supportedProfileLanguages[prefs.language] ? prefs.language : "nb",
        extraHelp: Boolean(prefs.extraHelp),
      },
    };
    crmSettings.profile_preferences = await saveCrmSettingValue("profile_preferences", next);
    if (String(currentUser?.id || currentUser?.key || "") === String(profileId)) applyCurrentUserPreferences();
  }

  function canUseLocalDemo() {
    return demoEnabled && !store.isConfigured;
  }

  function requireLocalDemoStorage() {
    if (!canUseLocalDemo()) throw new Error(databaseUnavailableMessage);
  }

  function requireSharedDatabase() {
    if (!store.isConfigured) throw new Error(databaseUnavailableMessage);
  }

  function setSyncStatus(message, tone) {
    el.syncStatus.textContent = message || "";
    el.syncStatus.className = `sync-status ${tone || ""}`.trim();
  }

  function runBusyButton(button, action, errorMessage) {
    if (!button || button.dataset.busy === "true") return;
    button.dataset.busy = "true";
    button.disabled = true;
    Promise.resolve()
      .then(action)
      .catch((error) => setSyncStatus(error.message || errorMessage || "Handlingen feilet.", "error"))
      .finally(() => {
        if (!button.isConnected) return;
        delete button.dataset.busy;
        button.disabled = false;
      });
  }

  async function runBusyForm(form, action, options = {}) {
    if (!form || form.dataset.busy === "true") return false;
    const busyLabel = options.busyLabel || "Lagrer...";
    const submitControls = [...form.querySelectorAll('button[type="submit"], input[type="submit"]')];
    const originals = submitControls.map((control) => ({
      control,
      disabled: control.disabled,
      label: control.tagName === "BUTTON" ? control.textContent : control.value,
    }));
    form.dataset.busy = "true";
    form.setAttribute("aria-busy", "true");
    submitControls.forEach((control) => {
      control.disabled = true;
      if (control.tagName === "BUTTON") control.textContent = busyLabel;
      else control.value = busyLabel;
    });
    try {
      await action();
      return true;
    } finally {
      delete form.dataset.busy;
      form.removeAttribute("aria-busy");
      originals.forEach(({ control, disabled, label }) => {
        if (!control.isConnected) return;
        control.disabled = disabled;
        if (control.tagName === "BUTTON") control.textContent = label;
        else control.value = label;
      });
    }
  }

  async function saveCrmSettingValue(key, value) {
    crmSettings[key] = value;
    if (store.isConfigured && store.saveCrmSetting) {
      const saved = await store.saveCrmSetting(key, value);
      crmSettings[key] = saved?.value ?? value;
      return crmSettings[key];
    }
    localStorage.setItem(storage.crmSettings, JSON.stringify(crmSettings));
    return value;
  }

  function resolveConfirmDialog(value) {
    if (!confirmDialogResolver) return;
    const resolver = confirmDialogResolver;
    confirmDialogResolver = null;
    resolver(Boolean(value));
  }

  function askForConfirmation(options = {}) {
    const message = options.message || "";
    if (!el.confirmDialog) return Promise.resolve(window.confirm(message));
    if (confirmDialogResolver) resolveConfirmDialog(false);
    el.confirmTitle.textContent = options.title || "Bekreft handling";
    el.confirmText.textContent = message;
    el.confirmOkButton.textContent = options.confirmLabel || "OK";
    el.confirmCancelButton.textContent = options.cancelLabel || "Avbryt";
    el.confirmOkButton.classList.toggle("danger", options.tone === "danger");
    el.confirmDialog.showModal();
    return new Promise((resolve) => {
      confirmDialogResolver = resolve;
    });
  }

  function setElementHelp(selector, text) {
    document.querySelectorAll(selector).forEach((node) => {
      node.setAttribute("title", text);
      if (!node.getAttribute("aria-label") && (node.tagName === "BUTTON" || node.tagName === "A")) {
        node.setAttribute("aria-label", `${node.textContent.trim()} - ${text}`);
      }
      const label = node.closest("label");
      if (label) label.setAttribute("title", text);
    });
  }

  function installHelpText() {
    const help = [
      ["#importSeedButton", "Kun utvikling: import fra lokal prototype. Produksjonsimport skal kjøres kontrollert server-side."],
      ["#newActionButton", "Åpner meny for ny kunde, avtale, service, installasjon eller lim inn melding."],
      ['[data-new-action="paste"]', "Gå til Innboks og lim inn en ny melding eller oppfølging."],
      ['[data-new-action="booking"]', "Book en avtale direkte i kalenderen."],
      ['[data-new-action="reminder"]', "Lag en rask påminnelse som vises på forsiden, gjerne knyttet til kunde."],
      ["#aiRegistrationInput", "Lim inn SMS, e-post eller notater fra kunde. CRM foreslår et utkast du kan rette før lagring."],
      ["#aiRegistrationParseButton", "Lager forslag til kunde, type og historikk fra teksten. Ingenting lagres før du godkjenner."],
      ["#aiRegistrationClearButton", "Tømmer hurtigregistrering-feltet uten å lagre noe."],
      ['[data-filter-shortcut="red"]', "Forfalt service: kunder/anlegg som er over frist og kan kontaktes først."],
      ['[data-filter-shortcut="yellow"]', "Aktuell for service: kunder/anlegg som nærmer seg servicefrist og kan kontaktes når du samler område."],
      ['[data-filter-shortcut="green"]', "Neste service senere: kunder/anlegg som nylig har hatt service eller har frist lenger frem."],
      ['[data-filter-shortcut="booked"]', "Planlagt: jobber som ligger i planen."],
      ["#customerSearch", "Søk på navn, telefon, adresse, sted, merke eller annen kundetekst."],
      ["#statusFilter", "Filtrer kundelisten etter service-status, blåseisolering eller manglende data."],
      ["#leadSearch", "Søk i saker etter navn, telefon, sted, produkt, tags og notat."],
      ["#leadStatusFilter", "Filtrer saker etter neste steg, for eksempel tilbud må sendes eller venter på svar."],
      ["#insulationCustomerSelect", "Velg blåseisolering-kunden som tilbudsteksten skal gjelde."],
      ["#insulationLineType", "Velg konstruksjon/produkt fra iSOBYGG-tilbudsskjemaet. Prisene er eks. mva."],
      ["#insulationQuantity", "Legg inn areal, løpemeter eller kubikk etter valgt linje."],
      ["#insulationDiscount", "Rabatt på akkurat denne kalkylelinjen. Bruk 0 hvis ingen rabatt."],
      ["#insulationAddLineButton", "Legger valgt linje inn i kalkylen. Du kan legge inn flere konstruksjoner på samme tilbud."],
      ["#insulationKm", "Kjøring tur/retur fra Svene. Første versjon bruker fast sats fra tilbudsskjemaet."],
      ["#insulationToll", "Ferge, bom eller andre direkte kostnader eks. mva."],
      ["#insulationRigPrep", "Standard rigg/klargjøring. Står normalt på 1 når det er en blåsejobb."],
      ["#insulationRigExtra", "Ekstra rigg dersom jobben krever mer flytting/opprigg enn normalt."],
      ["#insulationRigLarge", "Stor riggpost for større eller mer krevende blåsejobber."],
      ["#insulationCopyOfferButton", "Kopierer kalkylen som tekst. Sender ingenting automatisk ennå."],
      ["#insulationCreateOfferButton", "Lager en redigerbar tilbudstekst fra valgt kunde, adresse og kalkylelinjene."],
      ["#rentalCreateOfferButton", "Lager en redigerbar tekst for leie av industristøvsuger 15 hk med valgt kunde og leieperiode."],
      ["#rentalDays", "Antall døgn kunden skal leie maskinen. Prisen regnes med 1800,- eks. mva per døgn."],
      ["#rentalDeliveryFee", "Valgfri pris eks. mva hvis vi skal levere eller hente maskinen hos kunde."],
      ["#rentalImages", "Bilder av støvsuger, slange og rampe. Åpne bildene for større visning."],
      ["#insulationOfferDraft", "Rediger tilbudsteksten her før du kopierer den til e-post eller annet."],
      ["#insulationCopyOfferTextButton", "Kopierer tilbudsteksten slik den står i feltet."],
      ["#insulationClearButton", "Nullstiller bare kalkylen du jobber med nå, ikke kundedata."],
      ["#insulationCustomerSearch", "Søk blant kunder som er tagget med blåseisolering, Isobygg eller isolering."],
      ["#insulationNewCustomerButton", "Opprett nytt kundekort som automatisk merkes for blåseisolering."],
      ["#previousWeekButton", "Gå til forrige uke i planningboardet."],
      ["#nextWeekButton", "Gå til neste uke i planningboardet."],
      ["#planningWeekModeButton", "Vis vanlig ukeplan med klokkeslett og jobber per dag."],
      ["#planningMonthModeButton", "Vis månedsoversikt med prikker, antall jobber og cirka booket tid per dag."],
      ["#planningResourceFilter", "Velg om kalenderen skal vise alle ansatte eller bare jobbene til én person."],
      ["#planningMonthGrid", "Klikk en dag for å hoppe ukeplanen til den uken."],
      ["#todayButton", "Hopp tilbake til denne uken."],
      ["#copyDayPlanButton", "Kopierer dagsplanen for valgt dag/person slik at den kan sendes videre."],
      ["#routeArea", "Brukes når du vil finne aktuelle servicekunder i et område, for eksempel Vegglifjell nord, Vegglifjell sør eller Blefjell."],
      ["#routeStatus", "Velg hvilke serviceoppfølginger som skal tas med i ruteplanen."],
      ["#routeReplyFilter", "Bruk Manuelt valgte når du kun vil planlegge de kundene som faktisk har svart ja."],
      ["#routeMaxJobs", "Maks antall servicejobber i ruten. Standard er 8 fordi det ofte er en full servicedag."],
      ["#routeOrigin", "Startpunkt for ruten. Standard er Svene, og appen optimaliserer rekkefølgen fra dette punktet."],
      ["#routeBookingDate", "Datoen som brukes hvis du trykker Book alle som utkast."],
      ["#routeStartTime", "Første foreslåtte tidspunkt for teknikerens dag."],
      ["#routeEndTime", "Siste tidspunkt appen prøver å få jobbene innenfor."],
      ["#routeDuration", "Normal varighet per servicejobb. Brukes for å foreslå klokkeslett i dagsruten."],
      ["#routeResource", "Hvem jobben/ruten skal bookes på."],
      ["#routeRequireLocation", "Når denne er på, tas bare kunder med adresse eller koordinater med i ruten."],
      ["#routeRefreshButton", "Regn ut ruten på nytt med valgte kunder og innstillinger."],
      ["#routeOpenMapsButton", "Åpner ruten i Google Maps. Maps viser faktisk kjøretid; appen viser bare ca.-estimat før Maps API er koblet på."],
      ["#routeBookDraftButton", "Legger alle kundene i ruten inn i planningboardet som serviceutkast med foreslåtte tider."],
      ["#routeCampaignButton", "Kopierer én ferdig SMS-tekst per foreslåtte kunde. Sender ingenting automatisk ennå."],
      ["#routeClearSelectionButton", "Fjerner alle kunder du manuelt har lagt inn som har svart ja."],
      ["#routeCustomerSearch", "Søk opp kunder som har svart ja på SMS, og legg dem inn i ruten før du optimaliserer."],
      ["#bookingCustomerSearch", "Søk og velg kunden avtalen skal knyttes til. Fra kundekort skal kunden allerede være valgt."],
      ["#bookingDate", "Dato jobben skal ligge i planen."],
      ["#bookingTime", "Starttid for jobben. Bruk 15-minutters intervaller."],
      ["#bookingType", "Velg type jobb: vanlig service, servicearbeid/timejobb, befaring, installasjon eller blåseisolering."],
      ["#bookingDuration", "Hvor lang tid jobben settes av i kalenderen."],
      ["#bookingResource", "Hvem som skal utføre jobben."],
      ["#deleteBookingButton", "Fjerner avtalen fra planen. Hvis den har jobb, får du spørsmål om jobben også skal slettes."],
      ["#formDifferentPostal", "Huk av bare hvis kunden har annen faktura-/bostedsadresse enn adressen der varmepumpen/anlegget er."],
      ["#formIsCustomer", "Huk av når personen faktisk er kunde. Nye saker fra innboks starter normalt som ikke kunde."],
      ["#formPaysCash", "Marker hvis kunden normalt betaler på stedet i stedet for faktura."],
      ["#formInsulation", "Marker hvis kunden gjelder blåseisolering/Isobygg. Kunden vises da i blåseisolering-filteret."],
      ["#formGps", "Valgfritt. Bruk koordinater for hytter/steder der vanlig adresse ikke treffer godt nok i kart."],
      ["#formGoogleMaps", "Google Maps-lenke eller koordinater for kundens installasjonssted."],
      ["#formServiceDates", "Datoer for tidligere service. Brukes for historikk og vurdering av neste service."],
      ["#formTags", "Frie merkelapper. Skriv nye tags her, eller huk av i tag-kartoteket under."],
      ["#formTagCatalog", "Kartotek over tags som allerede finnes på kundene. Huk av for å legge dem til kunden."],
      ["#deleteCustomerButton", "Setter kunden inaktiv. Kunden slettes ikke permanent, men tas bort fra aktive lister."],
      ["#completionNextAction", "Velg hva som skal skje etter fullført jobb, for eksempel ny servicepåminnelse om 1 eller 2 år."],
      ["#completionInterval", "Standard er 2 år. Bruk 1 år bare for kunder som ønsker årlig service."],
      ["#completionNextDate", "Dato for neste oppfølging/service etter at jobben er fullført."],
      ["#completionPricePreset", "Velg et vanlig tillegg fra prislisten. Linjen kan redigeres før jobben fullføres."],
      ["#completionPriceQuantity", "Antall meter, timer eller stykk for valgt tillegg."],
      ["#completionAddPriceLine", "Legger valgt tillegg inn i prisgrunnlaget for jobben."],
      ["#completionPriceLines", "Prisgrunnlag som følger jobben videre til fakturering. Kontroller teksten før faktura sendes."],
      ["#billingPriceBasis", "Prisgrunnlag hentet fra fullført jobb. Kan redigeres før faktura eller betaling markeres."],
      ["#reminderText", "Skriv kort hva du skal huske, for eksempel at kunden skal ringes tilbake i dag."],
      ["#technicianDate", "Velg datoen du vil se dagsplan for."],
      ["#technicianRouteButton", technicianText("routeTitle")],
    ];
    help.forEach(([selector, text]) => setElementHelp(selector, text));
  }

  function localLoad() {
    requireLocalDemoStorage();
    const localUser = JSON.parse(localStorage.getItem(storage.user) || "null");
    currentUser = localUser;
    currentView = currentUser?.view || "dashboard";
    bookings = JSON.parse(localStorage.getItem(storage.bookings) || "{}");
    orders = JSON.parse(localStorage.getItem(storage.orders) || "{}");
    customerEdits = JSON.parse(localStorage.getItem(storage.edits) || "{}");
    deletedCustomers = new Set(JSON.parse(localStorage.getItem(storage.deleted) || "[]"));
    doneJobs = new Set(JSON.parse(localStorage.getItem(storage.doneJobs) || "[]"));
    insulationCalcLines = JSON.parse(localStorage.getItem(storage.insulationCalc) || "[]");
    crmSettings = JSON.parse(localStorage.getItem(storage.crmSettings) || "{}");
    loadWebsiteSubmissionVisibleOverrides();
    profiles = Object.values(users).map((user) => ({
      id: user.key,
      display_name: user.name,
      full_name: user.name,
      role: user.key === "admin" ? "admin" : "technician",
      active: user.active !== false,
    }));
    applyCurrentUserPreferences();
    buildCustomerLocations([]);
    customers = rawData.customers
      .filter((customer) => !deletedCustomers.has(customer.lime_id))
      .filter((customer) => !hiddenDuplicateLimeIds.has(String(customer.lime_id || customer.legacy_lime_id || "")))
      .map((customer) => ({ ...customer, ...(customerEdits[customer.lime_id] || {}) }));
    const customerKeys = new Set(customers.map((customer) => customerKey(customer)).filter(Boolean));
    Object.values(customerEdits)
      .filter((customer) => customer && customerKey(customer) && !customerKeys.has(customerKey(customer)) && !deletedCustomers.has(customerKey(customer)))
      .forEach((customer) => {
        customers.unshift(customer);
        customerKeys.add(customerKey(customer));
      });
    applyLimeEnrichmentToCustomers(customers);
    applyKnownCustomerCorrections(customers);
    buildInvoices(rawData.invoices || []);
    buildServiceEvents(localServiceEvents());
    buildInstallations(localInstallations());
    buildCrmAttachments([]);
    leads = localLeads();
  }

  async function supabaseLoad() {
    const session = await store.session();
    if (!session) {
      currentUser = null;
      customers = [];
      bookings = {};
      orders = {};
      leads = [];
      activities = [];
      jobs = [];
      appointments = [];
      websiteSubmissions = [];
      intakeItems = [];
      crmAttachments = [];
      profiles = [];
      crmSettings = {};
      buildCustomerLocations([]);
      buildInvoices([]);
      buildServiceEvents([]);
      buildInstallations([]);
      buildAccessNotes([]);
      buildCrmAttachments([]);
      return;
    }
    const profile = await store.profile();
    const role = profile?.role === "admin" ? "Admin" : "Tekniker";
    const firstLoad = !currentUser;
    currentUser = {
      id: profile?.id,
      name: profile?.full_name || profile?.display_name || session.user?.email || "Bruker",
      role,
      key: profile?.role === "admin" ? "admin" : "tech",
      view: profile?.role === "admin" ? "dashboard" : "technician",
    };
    if (firstLoad || !currentView) currentView = currentUser.view;
    const loaded = await store.loadAll();
    insulationCalcLines = [];
    customers = loaded.customers
      .filter((customer) => !hiddenDuplicateLimeIds.has(String(customer.lime_id || customer.legacy_lime_id || "")));
    applyLimeEnrichmentToCustomers(customers);
    applyKnownCustomerCorrections(customers);
    bookings = loaded.bookings;
    orders = loaded.orders || {};
    leads = loaded.leads || [];
    activities = loaded.activities || [];
    jobs = loaded.jobs || [];
    appointments = loaded.appointments || [];
    websiteSubmissions = loaded.websiteSubmissions || [];
    loadWebsiteSubmissionVisibleOverrides();
    intakeItems = loaded.intakeItems || [];
    crmAttachments = loaded.crmAttachments || [];
    profiles = loaded.profiles || [];
    crmSettings = loaded.crmSettings || {};
    applyCurrentUserPreferences(profile);
    buildCustomerLocations(loaded.customerLocations || []);
    buildInvoices(loaded.invoices || []);
    buildServiceEvents(loaded.serviceEvents || []);
    buildInstallations(loaded.installations || []);
    buildAccessNotes(loaded.accessNotes || []);
    buildCrmAttachments(crmAttachments);
  }

  function buildInvoices(invoices) {
    invoicesByCustomer = new Map();
    for (const invoice of invoices || []) {
      const keys = [invoice.customer_id, invoice.lime_id, invoice.legacy_lime_id].filter(Boolean);
      for (const key of keys) {
        const list = invoicesByCustomer.get(key) || [];
        list.push(invoice);
        invoicesByCustomer.set(key, list);
      }
    }
    for (const list of invoicesByCustomer.values()) {
      list.sort((a, b) => String(b.date || b.invoice_date || "").localeCompare(String(a.date || a.invoice_date || "")));
    }
  }

  function buildServiceEvents(events) {
    serviceEventsByCustomer = new Map();
    for (const event of events || []) {
      const keys = [event.customer_id, event.lime_id, event.legacy_lime_id].filter(Boolean);
      for (const key of keys) {
        const list = serviceEventsByCustomer.get(key) || [];
        list.push(event);
        serviceEventsByCustomer.set(key, list);
      }
    }
    for (const list of serviceEventsByCustomer.values()) {
      list.sort((a, b) => String(b.event_date || "").localeCompare(String(a.event_date || "")));
    }
  }

  function buildInstallations(installations) {
    installationsByCustomer = new Map();
    const seen = new Set();
    for (const installation of installations || []) {
      const keys = [...new Set([installation.customer_id, installation.lime_id, installation.legacy_lime_id].filter(Boolean))];
      const uniqueKey = installation.id
        || installation.legacy_key
        || `${installation.customer_id || installation.lime_id || ""}|${installation.label || ""}|${installation.model || ""}|${installation.installed_at || ""}|${installation.last_service_at || ""}|${installation.notes || ""}`;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      for (const key of keys) {
        const list = installationsByCustomer.get(key) || [];
        list.push(installation);
        installationsByCustomer.set(key, list);
      }
    }
    for (const list of installationsByCustomer.values()) {
      list.sort((a, b) => {
        const aDate = a.next_service_due || a.last_service_at || a.installed_at || "";
        const bDate = b.next_service_due || b.last_service_at || b.installed_at || "";
        return String(aDate).localeCompare(String(bDate)) || installationLabelRank(a) - installationLabelRank(b) || String(a.label || "").localeCompare(String(b.label || ""));
      });
    }
  }

  function installationLabelRank(installation) {
    const match = String(installation.label || "").match(/\d+/);
    return match ? Number(match[0]) : 999;
  }

  function buildCustomerLocations(locations) {
    customerLocationsByCustomer = new Map();
    customerLocationById = new Map();
    for (const location of locations || []) {
      if (!location?.id) continue;
      customerLocationById.set(String(location.id), location);
      if (!location.customer_id) continue;
      const list = customerLocationsByCustomer.get(location.customer_id) || [];
      list.push(location);
      customerLocationsByCustomer.set(location.customer_id, list);
    }
    for (const list of customerLocationsByCustomer.values()) {
      list.sort((a, b) => {
        if (Boolean(a.is_primary) !== Boolean(b.is_primary)) return a.is_primary ? -1 : 1;
        return String(a.location_name || "").localeCompare(String(b.location_name || ""), "nb");
      });
    }
  }

  function buildAccessNotes(notes) {
    accessNotesByCustomer = new Map();
    for (const note of notes || []) {
      if (!note.customer_id || note.active === false) continue;
      const list = accessNotesByCustomer.get(note.customer_id) || [];
      list.push(note);
      accessNotesByCustomer.set(note.customer_id, list);
    }
    for (const list of accessNotesByCustomer.values()) {
      list.sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
    }
  }

  function buildCrmAttachments(rows) {
    crmAttachments = (rows || []).filter((item) => item && !item.deleted_at);
    crmAttachmentsByCustomer = new Map();
    crmAttachmentsByLead = new Map();
    crmAttachmentsByInstallation = new Map();
    crmAttachmentsByJob = new Map();
    crmAttachmentsByIntake = new Map();
    const add = (map, key, attachment) => {
      if (!key) return;
      const list = map.get(String(key)) || [];
      list.push(attachment);
      map.set(String(key), list);
    };
    for (const attachment of crmAttachments) {
      add(crmAttachmentsByCustomer, attachment.customer_id, attachment);
      add(crmAttachmentsByLead, attachment.lead_id, attachment);
      add(crmAttachmentsByInstallation, attachment.installation_id, attachment);
      add(crmAttachmentsByJob, attachment.job_id, attachment);
      add(crmAttachmentsByIntake, attachment.intake_id, attachment);
    }
    const sort = (list) => list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")) || String(a.title || "").localeCompare(String(b.title || ""), "nb"));
    for (const map of [crmAttachmentsByCustomer, crmAttachmentsByLead, crmAttachmentsByInstallation, crmAttachmentsByJob, crmAttachmentsByIntake]) {
      for (const list of map.values()) sort(list);
    }
  }

  function replaceCrmAttachments(updatedRows) {
    const updated = Array.isArray(updatedRows) ? updatedRows : [updatedRows].filter(Boolean);
    if (!updated.length) return;
    const byId = new Map(crmAttachments.map((item) => [item.id, item]));
    for (const row of updated) {
      if (row?.id) byId.set(row.id, row);
    }
    buildCrmAttachments([...byId.values()]);
  }

  function upsertAccessNoteInMemory(customer, note) {
    const key = customerKey(customer);
    if (!key) return;
    const cleanNote = String(note || "").trim();
    if (!cleanNote) {
      accessNotesByCustomer.set(key, []);
      return;
    }
    const list = accessNotesByCustomer.get(key) || [];
    const existingIndex = list.findIndex((item) => item.note_type === "adkomst");
    const existing = existingIndex >= 0 ? list[existingIndex] : {};
    const row = {
      ...existing,
      id: existing.id || `access-${Date.now()}`,
      customer_id: key,
      note_type: "adkomst",
      note: cleanNote,
      active: true,
      updated_at: new Date().toISOString(),
    };
    accessNotesByCustomer.set(key, [row, ...list.filter((_, index) => index !== existingIndex)]);
  }

  function localServiceEvents() {
    const events = [];
    const enrichment = window.CRM_LIME_ENRICHMENT || { records: [] };
    for (const record of enrichment.records || []) {
      const customer = (record.limeId && customers.find((item) => item.lime_id === record.limeId || item.legacy_lime_id === record.limeId))
        || customers.find((item) => normalizeMatch(item.name) === normalizeMatch(record.matchName));
      if (!customer) continue;
      for (const entry of record.history || []) {
        events.push({
          customer_id: customerKey(customer),
          event_date: entry.event_date,
          event_type: entry.event_type || "Lime Go",
          note: `${entry.title || "Lime Go oppgave"}\n${entry.description || ""}`.trim(),
        });
      }
    }
    return events;
  }

  function localInstallations() {
    const rows = [];
    for (const record of limeInstallations.records || []) {
      const customer = (record.limeId && customers.find((item) => item.lime_id === record.limeId || item.legacy_lime_id === record.limeId))
        || customers.find((item) => normalizeMatch(item.name) === normalizeMatch(record.matchName));
      if (!customer) continue;
      for (const installation of record.installations || []) {
        rows.push({
          ...installation,
          customer_id: customerKey(customer),
          lime_id: customer.lime_id,
        });
      }
    }
    return rows;
  }

  async function refreshData(message) {
    try {
      if (store.isConfigured) {
        if (currentUser) setSyncStatus("Laster CRM-data fra Supabase. På tregt nett kan dette ta litt tid.", "");
        await supabaseLoad();
      }
      else if (canUseLocalDemo()) localLoad();
      else throw new Error(databaseUnavailableMessage);
      const repairedOrders = await ensureOrdersForLoadedBookings();
      updateResourceSelects();
      renderApp();
      if (message) setSyncStatus(message, "ok");
      else if (repairedOrders) setSyncStatus(`Fant ${repairedOrders} avtale${repairedOrders === 1 ? "" : "r"} uten jobb og opprettet jobb automatisk.`, "ok");
      return true;
    } catch (error) {
      const messageText = error.message || "Klarte ikke laste data.";
      setSyncStatus(messageText, "error");
      if (!el.loginView.classList.contains("hidden")) {
        el.loginMessage.textContent = messageText;
      }
      if (!currentUser || !el.loginView.classList.contains("hidden")) {
        currentUser = null;
        renderApp();
      }
      return false;
    }
  }

  function saveLocalBookings() {
    requireLocalDemoStorage();
    localStorage.setItem(storage.bookings, JSON.stringify(bookings));
  }

  function saveLocalOrders() {
    requireLocalDemoStorage();
    localStorage.setItem(storage.orders, JSON.stringify(orders));
  }

  function saveLocalEdits() {
    requireLocalDemoStorage();
    localStorage.setItem(storage.edits, JSON.stringify(customerEdits));
  }

  function localLeads() {
    try {
      return JSON.parse(localStorage.getItem(storage.leads) || "[]");
    } catch {
      return [];
    }
  }

  function saveLocalLeads() {
    requireLocalDemoStorage();
    localStorage.setItem(storage.leads, JSON.stringify(leads));
  }

  function loadWebsiteSubmissionVisibleOverrides() {
    try {
      websiteSubmissionVisibleOverrides = new Set(JSON.parse(localStorage.getItem(storage.websiteSubmissionVisibleOverrides) || "[]"));
    } catch {
      websiteSubmissionVisibleOverrides = new Set();
    }
  }

  function saveWebsiteSubmissionVisibleOverrides() {
    try {
      localStorage.setItem(storage.websiteSubmissionVisibleOverrides, JSON.stringify([...websiteSubmissionVisibleOverrides]));
    } catch {
      // Local override is only a convenience; ignore browsers that block storage.
    }
  }

  function setWebsiteSubmissionVisibleOverride(id, shouldShow) {
    if (!id) return;
    const key = String(id);
    if (shouldShow) websiteSubmissionVisibleOverrides.add(key);
    else websiteSubmissionVisibleOverrides.delete(key);
    saveWebsiteSubmissionVisibleOverrides();
  }

  function saveLocalLeadPatch(id, patch = {}) {
    requireLocalDemoStorage();
    const index = leads.findIndex((lead) => lead.id === id);
    if (index < 0) throw new Error("Fant ikke leaden.");
    const updated = { ...leads[index], ...patch, updated_at: new Date().toISOString() };
    leads[index] = updated;
    saveLocalLeads();
    return updated;
  }

  function deleteLocalLead(id) {
    requireLocalDemoStorage();
    leads = leads.filter((lead) => lead.id !== id);
    saveLocalLeads();
  }

  function bookingRows() {
    return Object.entries(bookings)
      .map(([id, booking]) => ({
        id,
        booking,
        customer: findCustomer(booking.customerId),
      }))
      .filter((row) => row.customer && row.booking.date && row.booking.status !== "cancelled")
      .sort((a, b) => `${a.booking.date} ${a.booking.time || ""}`.localeCompare(`${b.booking.date} ${b.booking.time || ""}`));
  }

  function normalizeOrderId(id) {
    return String(id || "").trim();
  }

  function bookingIdsForOrder(order) {
    if (Array.isArray(order?.bookingIds)) return order.bookingIds.map(String).filter(Boolean);
    if (Array.isArray(order?.booking_ids)) return order.booking_ids.map(String).filter(Boolean);
    return [];
  }

  function setBookingIdsForOrder(order, ids) {
    const unique = [...new Set((ids || []).map(String).filter(Boolean))];
    order.bookingIds = unique;
    order.booking_ids = unique;
    return order;
  }

  function orderCustomerId(order) {
    return order?.customerId || order?.customer_id || "";
  }

  function findOrder(orderId) {
    const id = normalizeOrderId(orderId);
    return id ? orders[id] || null : null;
  }

  function findJob(jobId) {
    const id = String(jobId || "").trim();
    return id ? (jobs || []).find((job) => String(job.id || "") === id) || null : null;
  }

  function jobForOrder(orderOrId) {
    const order = typeof orderOrId === "object" ? orderOrId : findOrder(orderOrId);
    const orderId = normalizeOrderId(typeof orderOrId === "object" ? order?.id : orderOrId);
    const directJob = findJob(order?.jobId || order?.job_id);
    if (directJob) return directJob;
    if (!orderId) return null;
    return (jobs || []).find((job) => (
      job?.source_table === "orders"
      && normalizeOrderId(job.source_id) === orderId
    )) || null;
  }

  function orderForLeadId(leadId) {
    const id = String(leadId || "").trim();
    if (!id) return null;
    for (const [orderId, order] of Object.entries(orders || {})) {
      const normalized = { ...order, id: order.id || orderId };
      if (
        String(normalized.lead_id || normalized.leadId || "") === id
        && orderEffectiveStatus(normalized, jobForOrder(normalized)) !== "cancelled"
      ) {
        return normalized;
      }
    }
    const job = (jobs || []).find((row) => (
      String(row.lead_id || "") === id
      && String(row.work_status || "") !== "cancelled"
      && row.source_table === "orders"
      && findOrder(row.source_id)
    ));
    return job ? findOrder(job.source_id) : null;
  }

  function orderIdForActivity(activity) {
    const metadataOrderId = activity?.metadata?.order_id || "";
    if (metadataOrderId && findOrder(metadataOrderId)) return metadataOrderId;
    const job = findJob(activity?.job_id || activity?.jobId);
    if (job?.source_table === "orders" && job.source_id && findOrder(job.source_id)) return job.source_id;
    return "";
  }

  function linkedOrderForBooking(bookingId) {
    const id = normalizeOrderId(bookingId);
    if (!id) return null;
    return Object.values(orders).find((order) => bookingIdsForOrder(order).includes(id)) || null;
  }

  function bookingRowsForOrder(order) {
    return bookingIdsForOrder(order)
      .map((id) => bookingRows().find((row) => row.id === id))
      .filter(Boolean);
  }

  function customerOrders(customer) {
    const key = customerKey(customer);
    return orderRows()
      .filter((row) => row.customer && customerKey(row.customer) === key)
      .map((row) => row.order);
  }

  function orderRows() {
    return Object.entries(orders || {})
      .map(([id, order]) => {
        const normalized = { ...order, id: order.id || id, customerId: orderCustomerId(order) };
        const linkedBookings = bookingRowsForOrder(normalized);
        return {
          id: normalized.id,
          order: normalized,
          customer: findCustomer(normalized.customerId),
          job: jobForOrder(normalized),
          linkedBookings,
        };
      })
      .filter((row) => row.order && row.customer)
      .sort((a, b) => {
        const rank = { unscheduled: 0, scheduled: 1, completed: 2, cancelled: 9 };
        const aStatus = orderEffectiveStatus(a.order, a.job, a.linkedBookings);
        const bStatus = orderEffectiveStatus(b.order, b.job, b.linkedBookings);
        const aBilling = orderEffectiveBillingStatus(a.order, a.job, a.linkedBookings);
        const bBilling = orderEffectiveBillingStatus(b.order, b.job, b.linkedBookings);
        const billingRank = (status) => status === "ready" ? -1 : status === "sent" ? 4 : 0;
        return billingRank(aBilling) - billingRank(bBilling)
          || (rank[aStatus] ?? 5) - (rank[bStatus] ?? 5)
          || String(a.order.scheduledDate || a.order.scheduled_date || a.order.completedAt || a.order.completed_at || a.order.created_at || "").localeCompare(String(b.order.scheduledDate || b.order.scheduled_date || b.order.completedAt || b.order.completed_at || b.order.created_at || ""))
          || cleanDisplayName(a.customer).localeCompare(cleanDisplayName(b.customer), "nb");
      });
  }

  function orderStatusLabel(status) {
    return orderStatuses[status]?.label || "Jobb";
  }

  function orderStatusHelp(status) {
    return orderStatuses[status]?.help || "Jobb knyttet til kundekortet.";
  }

  function billingStatusLabel(status) {
    return billingStatuses[status || "not_ready"] || "Ikke klar";
  }

  function jobWorkStatusLabel(status) {
    return jobWorkStatuses[status || "draft"]?.label || "Jobb";
  }

  function jobWorkStatusHelp(status) {
    return jobWorkStatuses[status || "draft"]?.help || "Jobbspeil i jobs-tabellen.";
  }

  function jobBillingStatusLabel(status) {
    return jobBillingStatuses[status || "not_ready"] || "Ikke klar";
  }

  function jobStatusClass(status) {
    return String(status || "draft").replace(/[^a-z0-9_-]/gi, "-");
  }

  function orderJobBadge(order, job = jobForOrder(order)) {
    if (job) {
      const status = job.work_status || "draft";
      return `<span class="order-badge job ${escapeHtml(jobStatusClass(status))}" title="${escapeHtml(jobWorkStatusHelp(status))}">${escapeHtml(jobWorkStatusLabel(status))}</span>`;
    }
    if ((order?.status || "") === "cancelled") {
      return `<span class="order-badge job cancelled" title="Avsluttede jobber skjules fra aktiv jobbliste.">Jobb avsluttet</span>`;
    }
    if (!store.isConfigured) return "";
    return `<span class="order-badge job missing" title="Jobben er ikke koblet til ny jobs-tabell ennå.">Mangler jobbkobling</span>`;
  }

  function orderBadgesHtml(order, job = jobForOrder(order), linkedRows = null) {
    return `${orderStatusBadge(order, orderEffectiveStatus(order, job, linkedRows))}${orderBillingBadge(order, orderEffectiveBillingStatus(order, job, linkedRows))}${orderJobBadge(order, job)}`;
  }

  function orderJobSummary(order, job = jobForOrder(order)) {
    if (!job && (order?.status || "") === "cancelled") return "Jobb avsluttet";
    if (!job) return store.isConfigured ? "Mangler jobbkobling" : "Ikke aktivert i demo";
    const parts = [
      jobWorkStatusLabel(job.work_status),
      jobBillingStatusLabel(job.billing_status),
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function orderStatusFromJob(job) {
    if (!job) return "";
    if (job.work_status === "draft") return "unscheduled";
    if (job.work_status === "planned" || job.work_status === "in_progress") return "scheduled";
    if (job.work_status === "completed") return "completed";
    if (job.work_status === "cancelled") return "cancelled";
    return "";
  }

  function orderEffectiveStatus(order, job = jobForOrder(order), linkedRows = null) {
    const rows = Array.isArray(linkedRows) ? linkedRows : bookingRowsForOrder(order);
    const explicit = orderStatusFromJob(job) || order?.status || "";
    if (explicit === "cancelled") return "cancelled";
    if (rows.some((row) => row.booking.status === "done" || doneJobs.has(row.id))) return "completed";
    if (rows.length && explicit !== "completed") return "scheduled";
    return explicit || "unscheduled";
  }

  function orderBillingStatusFromJob(job) {
    if (!job) return "";
    if (job.payment_status === "paid" || job.payment_status === "paid_on_site") return "paid";
    if (job.billing_status === "ready_for_invoice" || job.billing_status === "credit_needed") return "ready";
    if (job.billing_status === "exported" || job.billing_status === "invoiced") return "sent";
    return "";
  }

  function orderEffectiveBillingStatus(order, job = jobForOrder(order), linkedRows = null) {
    const explicit = orderBillingStatusFromJob(job) || order?.billingStatus || order?.billing_status || "not_ready";
    const type = order?.type || job?.job_type || job?.type || "";
    if (!billableJobType(type) && !["sent", "paid"].includes(explicit)) return "not_ready";
    if (explicit && explicit !== "not_ready") return explicit;
    const rows = Array.isArray(linkedRows) ? linkedRows : bookingRowsForOrder(order);
    if (rows.some((row) => bookingNeedsPaymentAction(row))) return "ready";
    return explicit || "not_ready";
  }

  function jobWorkStatusFromOrder(order) {
    if ((order?.status || "") === "completed") return "completed";
    if ((order?.status || "") === "cancelled") return "cancelled";
    if ((order?.status || "") === "scheduled") return "planned";
    return "draft";
  }

  function jobBillingStatusFromOrder(order) {
    const billing = order?.billingStatus || order?.billing_status || "not_ready";
    if (billing === "ready") return "ready_for_invoice";
    if (billing === "sent") return "invoiced";
    return "not_ready";
  }

  function jobPaymentStatusFromOrder(order) {
    const billing = order?.billingStatus || order?.billing_status || "not_ready";
    if (billing === "paid") return "paid_on_site";
    if (billing === "sent") return "unpaid";
    return "unknown";
  }

  function upsertLocalJobMirrorForOrder(order) {
    if (!store.isConfigured || !order?.id) return;
    const existingIndex = (jobs || []).findIndex((job) => (
      String(job.id || "") === String(order.jobId || order.job_id || "")
      || (job?.source_table === "orders" && normalizeOrderId(job.source_id) === normalizeOrderId(order.id))
    ));
    if (existingIndex < 0 && !(order.jobId || order.job_id)) return;
    const existing = existingIndex >= 0 ? jobs[existingIndex] : {};
    const hasInstallationId = Object.prototype.hasOwnProperty.call(order, "installationId")
      || Object.prototype.hasOwnProperty.call(order, "installation_id");
    const hasLocationId = Object.prototype.hasOwnProperty.call(order, "locationId")
      || Object.prototype.hasOwnProperty.call(order, "location_id");
    const next = {
      ...existing,
      id: existing.id || order.jobId || order.job_id,
      customer_id: order.customerId || order.customer_id || existing.customer_id || null,
      lead_id: order.leadId || order.lead_id || existing.lead_id || null,
      title: order.title || existing.title || "Jobb",
      job_type: order.type || existing.job_type || "service",
      installation_id: hasInstallationId ? (order.installationId ?? order.installation_id ?? null) : (existing.installation_id || null),
      location_id: hasLocationId ? (order.locationId ?? order.location_id ?? null) : (existing.location_id || null),
      work_status: jobWorkStatusFromOrder(order),
      billing_status: jobBillingStatusFromOrder(order),
      payment_status: jobPaymentStatusFromOrder(order),
      description: order.note || existing.description || null,
      source_table: "orders",
      source_id: order.id,
      completed_at: order.completedAt || order.completed_at || existing.completed_at || null,
      updated_at: order.updated_at || new Date().toISOString(),
    };
    if (existingIndex >= 0) jobs[existingIndex] = next;
    else jobs.unshift(next);
  }

  function orderMissingJobMirror(row) {
    const order = row?.order || row || {};
    return store.isConfigured && (order.status || "") !== "cancelled" && !row?.job && !jobForOrder(order);
  }

  function upsertJobMirror(job) {
    if (!job?.id) return;
    const index = (jobs || []).findIndex((item) => String(item.id || "") === String(job.id));
    if (index >= 0) jobs[index] = job;
    else jobs.unshift(job);
  }

  async function repairOrderJobMirror(orderId) {
    const order = findOrder(orderId);
    if (!order) throw new Error("Fant ikke jobben som skulle repareres.");
    if (!store.repairOrderJobMirror) throw new Error("Jobbkobling krever oppdatert Supabase-adapter.");
    const job = await store.repairOrderJobMirror(order.id, order);
    if (!job?.id) throw new Error("Supabase opprettet ikke jobbkobling for jobben.");
    upsertJobMirror(job);
    orders[order.id] = { ...order, jobId: job.id, job_id: job.id };
    setSyncStatus("Jobbkobling opprettet for jobben.", "ok");
    renderAll();
  }

  function serviceWorkType(type) {
    return ["reparasjon", "servicearbeid", "reklamasjon"].includes(String(type || "").toLowerCase());
  }

  function serviceWorkNoteRegex() {
    return /\b(dryppanne|veggstativ|fjær|fjærer|gummidemper|gummidempere|dempere?|støy|flytte|flytting|demonter|monter|reparasjon|feil|fiks|fix|timejobb|timer|stativ|lekkasje|is|vann)\b/i;
  }

  function bookingDisplayType(rowOrBooking) {
    const booking = rowOrBooking?.booking || rowOrBooking || {};
    const type = booking.type || "service";
    if (serviceWorkType(type)) return "reparasjon";
    if (type === "service" && serviceWorkNoteRegex().test(booking.note || "")) return "reparasjon";
    return type;
  }

  function bookingJobLabel(rowOrBooking) {
    const displayType = bookingDisplayType(rowOrBooking);
    if (displayType === "reparasjon") return "Servicearbeid / timejobb";
    return bookingTypeLabel(displayType || "service");
  }

  function bookingWorkKind(rowOrBooking) {
    const displayType = bookingDisplayType(rowOrBooking);
    if (displayType === "reparasjon") {
      return {
        type: "reparasjon",
        label: "Servicearbeid / timejobb",
        help: "Ikke standardservice 2490,-. Dette faktureres etter timer, materiell eller avtalt pris.",
        billing: "Fakturer etter timer/avtale",
      };
    }
    if (displayType === "service") {
      return {
        type: "service",
        label: "Standard service",
        help: "Vanlig servicejobb. Normalt 2490,- og ny servicefrist etter utført service.",
        billing: "Standard service 2490,-",
      };
    }
    return {
      type: displayType,
      label: bookingTypeLabel(displayType),
      help: "Jobbtype valgt i booking.",
      billing: billableJobType(displayType) ? "Fakturerbar jobb" : "Oppfølging",
    };
  }

  function orderTypeLabel(type) {
    if (type === "blaseisolering") return "Blåseisolering";
    if (type === "annet") return "Annet arbeid";
    return bookingTypeLabel(type || "service");
  }

  function defaultOrderTitle(customer, type = "service") {
    return `${orderTypeLabel(type)} - ${cleanDisplayName(customer)}`;
  }

  function orderDateText(order) {
    const scheduled = order.scheduledDate || order.scheduled_date;
    const completed = order.completedAt || order.completed_at;
    if (scheduled) return `Planlagt ${formatDate(scheduled)}${order.scheduledTime || order.scheduled_time ? ` kl. ${escapeHtml(normalizeBookingTime(order.scheduledTime || order.scheduled_time))}` : ""}`;
    if (completed) return `Utført ${formatDate(completed)}`;
    return "Ikke planlagt";
  }

  function orderSearchText(row) {
    const order = row.order;
    const customer = row.customer;
    const job = row.job || jobForOrder(order);
    const status = orderEffectiveStatus(order, job, row.linkedBookings);
    const billing = orderEffectiveBillingStatus(order, job, row.linkedBookings);
    return normalizeMatch([
      order.title,
      order.note,
      order.type,
      order.status,
      order.billingStatus || order.billing_status,
      orderStatusLabel(status),
      billingStatusLabel(billing),
      job?.title,
      job?.work_status,
      job?.billing_status,
      orderInstallationText(order, customer, job),
      cleanDisplayName(customer),
      customer.phone,
      customer.email,
      customer.visit_street,
      customer.visit_city,
      customer.location_tag,
    ].filter(Boolean).join(" "));
  }

  function orderStatusBadge(order, effectiveStatus = "") {
    const rawStatus = order?.status || "unscheduled";
    const status = effectiveStatus || rawStatus;
    const adjusted = status !== rawStatus;
    const help = adjusted
      ? `${orderStatusHelp(status)} Vises etter koblet jobbspeil.`
      : orderStatusHelp(status);
    return `<span class="order-badge ${escapeHtml(status)}" title="${escapeHtml(help)}">${escapeHtml(orderStatusLabel(status))}</span>`;
  }

  function orderBillingBadge(order, effectiveStatus = "") {
    const status = effectiveStatus || order.billingStatus || order.billing_status || "not_ready";
    if (status === "not_ready") return "";
    return `<span class="order-badge billing ${escapeHtml(status)}" title="Fakturastatus for jobben.">${escapeHtml(billingStatusLabel(status))}</span>`;
  }

  function workflowStep(label, state, help = "") {
    return { label, state, help };
  }

  function workflowHtml(flow, options = {}) {
    if (!flow) return "";
    const compact = options.compact ? " compact" : "";
    const title = options.title || "Jobbflyt";
    return `
      <section class="job-flow ${escapeHtml(flow.kind || "info")}${compact}" title="${escapeHtml(flow.help || "Viser hva som er gjort og hva som er neste steg.")}">
        <div class="job-flow-head">
          <span>${escapeHtml(title)}</span>
          <strong>${escapeHtml(flow.heading)}</strong>
          <em>${escapeHtml(flow.next)}</em>
        </div>
        <ol class="job-flow-steps">
          ${flow.steps.map((step) => `
            <li class="${escapeHtml(step.state)}" title="${escapeHtml(step.help || step.label)}">
              <span></span>
              <strong>${escapeHtml(step.label)}</strong>
            </li>
          `).join("")}
        </ol>
      </section>
    `;
  }

  function billableJobType(type) {
    return ["service", "installasjon", "blaseisolering", "reparasjon", "servicearbeid", "reklamasjon", "utleie"].includes(type || "service");
  }

  function bookingCanHavePriceBasis(row) {
    return billableJobType(bookingDisplayType(row));
  }

  function bookingWorkflowState(row, order = null) {
    if (!row) return null;
    const type = bookingDisplayType(row);
    const workKind = bookingWorkKind(row);
    const done = row.booking.status === "done" || doneJobs.has(row.id);
    const needsMove = bookingNeedsMove(row);
    const paymentMode = bookingPaymentMode(row);
    const billingStatus = order?.billingStatus || order?.billing_status || "not_ready";
    const isCash = Boolean(row.customer?.pays_cash);
    const isBillable = billableJobType(type);
    const steps = [
      workflowStep("Jobb", "done", "Jobben finnes i systemet."),
      workflowStep("Planlagt", "done", "Jobben ligger i planen."),
      workflowStep("Utført", done ? "done" : needsMove || bookingNeedsCompletion(row) ? "warn" : "current", done ? "Jobben er markert utført." : "Trykk Fullfør når jobben er gjort."),
      workflowStep(isCash ? "Betaling" : "Faktura", "pending", isCash ? "Betaling på stedet må registreres mottatt." : "Faktura må sendes manuelt og markeres her."),
      workflowStep("Ferdig", "pending", "Ingen videre handling når betaling/fakturering er avklart."),
    ];

    if (needsMove) {
      steps[2] = workflowStep("Må flyttes", "warn", "Jobben ble ikke gjennomført og må avtales på nytt.");
      return {
        kind: "move",
        heading: "Må flyttes",
        next: "Avtal ny tid med kunde og flytt/book jobben på nytt.",
        help: "Jobben er ikke ferdig. Den må flyttes før den kan fullføres.",
        steps,
      };
    }

    if (!done) {
      const overdue = bookingNeedsCompletion(row);
      return {
        kind: overdue ? "overdue" : "scheduled",
        heading: overdue ? `${workKind.label}: dato passert` : `${workKind.label}: planlagt`,
        next: overdue ? "Trykk Fullfør hvis jobben er gjort, ellers Må flyttes." : "Neste steg er å utføre jobben og trykke Fullfør.",
        help: `${workKind.help} Jobben er ikke markert utført ennå.`,
        steps,
      };
    }

    steps[2] = workflowStep("Utført", "done", "Jobben er markert utført.");

    if (!isBillable) {
      if (type === "befaring") {
        steps[3] = workflowStep("Tilbud/salg", "current", "Befaring faktureres normalt ikke. Avklar tilbud, muntlig salg eller videre oppfølging.");
        steps[4] = workflowStep("Ferdig", "pending", "Ferdig når tilbud/salg/oppfølging er avklart.");
        return {
          kind: "followup",
          heading: "Befaring utført",
          next: "Send tilbud, marker muntlig tilbud/salg eller book installasjon.",
          help: "Befaring er et salgssteg og skal normalt ikke faktureres.",
          steps,
        };
      }
      steps[3] = workflowStep("Oppfølging", "current", "Befaring/annet arbeid kan trenge tilbud eller ny jobb.");
      steps[4] = workflowStep("Ferdig", "pending", "Lukkes når videre oppfølging er avklart.");
      return {
        kind: "done",
        heading: "Utført",
        next: "Sjekk om kunden skal ha tilbud, installasjon eller annen oppfølging.",
        help: "Jobben er utført, men denne typen jobb trenger ikke nødvendigvis faktura.",
        steps,
      };
    }

    if (bookingNeedsPaymentAction(row) || billingStatus === "ready") {
      steps[3] = workflowStep(isCash ? "Betaling mangler" : "Må faktureres", "warn", isCash ? "Betaling på stedet er ikke markert mottatt." : "Faktura er ikke markert sendt.");
      return {
        kind: "billing",
        heading: isCash ? "Utført - betaling ikke registrert" : "Utført - må faktureres",
        next: isCash ? "Marker betalt når betalingen er mottatt." : "Send faktura i eAccounting og marker Fakturert her.",
        help: "Jobben er utført, men betaling/faktura mangler.",
        steps,
      };
    }

    if (paymentMode === "cash" || billingStatus === "paid") {
      steps[3] = workflowStep("Betalt", "done", "Betaling på stedet er registrert mottatt.");
      steps[4] = workflowStep("Ferdig", "done", "Jobben er ferdig behandlet.");
      return {
        kind: "complete",
        heading: "Ferdig - betalt",
        next: "Ingen handling nødvendig.",
        help: "Jobben er utført og betaling er registrert.",
        steps,
      };
    }

    if (paymentMode === "invoice" || billingStatus === "sent") {
      steps[3] = workflowStep("Fakturert", "done", "Faktura er markert sendt.");
      steps[4] = workflowStep("Ferdig", "done", "Jobben er ferdig behandlet.");
      return {
        kind: "complete",
        heading: "Ferdig - fakturert",
        next: "Ingen handling nødvendig.",
        help: "Jobben er utført og faktura er markert sendt.",
        steps,
      };
    }

    steps[3] = workflowStep(isCash ? "Betaling" : "Faktura", "current", "Avklar betaling/faktura.");
    return {
      kind: "billing",
      heading: "Utført - avklar betaling",
      next: isCash ? "Marker betalt hvis kunden har betalt på stedet." : "Marker Fakturert når faktura er sendt.",
      help: "Jobben er utført, men betalingsstatus er uklar.",
      steps,
    };
  }

  function orderWorkflowState(order, linkedRows = []) {
    if (!order) return null;
    const rows = linkedRows.length ? linkedRows : bookingIdsForOrder(order)
      .map((id) => bookingRows().find((row) => row.id === id))
      .filter(Boolean);
    const priorityRow = rows.find((row) => bookingNeedsPaymentAction(row))
      || rows.find((row) => bookingNeedsCompletion(row))
      || rows.find((row) => row.booking.status !== "done")
      || rows[0];
    if (priorityRow) return bookingWorkflowState(priorityRow, order);

    const linkedJob = jobForOrder(order);
    const status = orderEffectiveStatus(order, linkedJob, linkedRows);
    const billing = orderEffectiveBillingStatus(order, linkedJob, linkedRows);
    const billable = billableJobType(order.type || "service");
    const steps = [
      workflowStep("Jobb", "done", "Jobben finnes på kundekortet."),
      workflowStep("Planlagt", status === "unscheduled" ? "current" : "done", "Jobben må legges i planen."),
      workflowStep("Utført", status === "completed" ? "done" : "pending", "Jobben markeres utført etter arbeid."),
      workflowStep("Faktura", billing === "ready" ? "warn" : billing === "sent" || billing === "paid" ? "done" : "pending", "Faktura/betaling avklares etter utført jobb."),
      workflowStep("Ferdig", billing === "sent" || billing === "paid" || (status === "completed" && !billable) ? "done" : "pending", "Ferdig når arbeid og betaling er avklart."),
    ];

    if (status === "cancelled") {
      return {
        kind: "move",
        heading: "Avsluttet",
        next: "Ingen aktiv jobb. Lag ny jobb hvis kunden skal følges opp igjen.",
        help: "Jobben er avsluttet.",
        steps: [workflowStep("Avsluttet", "warn", "Jobben er lukket uten videre arbeid.")],
      };
    }
    if (billing === "ready") {
      return {
        kind: "billing",
        heading: "Utført - må faktureres",
        next: "Send faktura i eAccounting og marker Fakturert.",
        help: "Jobben er utført, men faktura mangler.",
        steps,
      };
    }
    if (billing === "sent" || billing === "paid") {
      return {
        kind: "complete",
        heading: billing === "paid" ? "Ferdig - betalt" : "Ferdig - fakturert",
        next: "Ingen handling nødvendig.",
        help: "Jobben er ferdig behandlet.",
        steps,
      };
    }
    if (status === "completed") {
      if (!billable && (order.type || "") === "befaring") {
        steps[3] = workflowStep("Tilbud/salg", "current", "Befaring faktureres normalt ikke. Avklar tilbud, salg eller videre oppfølging.");
        return {
          kind: "followup",
          heading: "Befaring utført",
          next: "Send tilbud, marker muntlig tilbud/salg eller book installasjon.",
          help: "Befaring er et salgssteg og skal normalt ikke faktureres.",
          steps,
        };
      }
      return {
        kind: billable ? "billing" : "done",
        heading: billable ? "Utført - avklar faktura" : "Utført",
        next: billable ? "Marker fakturert når faktura er sendt." : "Sjekk om det trengs videre oppfølging.",
        help: "Jobben er utført.",
        steps,
      };
    }
    if (status === "scheduled") {
      return {
        kind: "scheduled",
        heading: "Planlagt - ikke utført",
        next: "Utfør jobben og trykk Fullfør i planen.",
        help: "Jobben ligger i kalenderen.",
        steps,
      };
    }
    return {
      kind: "unscheduled",
      heading: "Jobb - ikke planlagt",
      next: "Trykk Book avtale og legg jobben i kalenderen.",
      help: "Jobben finnes, men den ligger ikke i kalenderen ennå.",
      steps,
    };
  }

  function workflowInlineHtml(flow) {
    if (!flow) return "";
    return `<div class="job-next-action ${escapeHtml(flow.kind || "info")}" title="${escapeHtml(flow.help || "")}"><strong>${escapeHtml(flow.heading)}</strong><span>Neste: ${escapeHtml(flow.next)}</span></div>`;
  }

  function bookingWorkflowButtons(row, options = {}) {
    if (!row || !isAdmin()) return "";
    const done = row.booking.status === "done" || doneJobs.has(row.id);
    const needsMove = bookingNeedsMove(row);
    const canHavePriceBasis = bookingCanHavePriceBasis(row);
    const paymentActionLabel = row.customer?.pays_cash ? "Betalt" : "Fakturert";
    return [
      !done ? `<button data-complete-booking="${escapeHtml(row.id)}" type="button">Fullfør jobb</button>` : "",
      done && bookingNeedsPaymentAction(row) ? `<button data-billing-booking="${escapeHtml(row.id)}" type="button">${escapeHtml(paymentActionLabel)}</button>` : "",
      done && canHavePriceBasis ? `<button class="secondary" data-price-basis-booking="${escapeHtml(row.id)}" type="button">Fakturagrunnlag</button>` : "",
      !done && !needsMove ? `<button class="secondary" data-move-booking="${escapeHtml(row.id)}" type="button">Må flyttes</button>` : "",
      options.includeEdit ? `<button class="secondary" data-edit-booking="${escapeHtml(row.id)}" type="button">Endre avtale</button>` : "",
    ].filter(Boolean).join("");
  }

  function bookingQuickFocusHtml(row, linkedOrder = null) {
    if (!row) return "";
    const workKind = bookingWorkKind(row);
    const flow = bookingWorkflowState(row, linkedOrder);
    const done = row.booking.status === "done" || doneJobs.has(row.id);
    const needsMove = bookingNeedsMove(row);
    const statusLine = bookingNeedsPaymentAction(row)
      ? (row.customer?.pays_cash ? "Utført, men betaling er ikke registrert." : "Utført, men faktura er ikke markert sendt.")
      : needsMove
        ? "Jobben må avtales på nytt eller flyttes."
        : bookingNeedsCompletion(row)
          ? "Datoen er passert. Fullfør jobben hvis den er gjort, ellers flytt den."
          : done
            ? "Jobben er markert utført."
            : "Jobben er planlagt, men ikke markert utført.";
    return `
      <section class="quick-job-focus ${escapeHtml(workKind.type)}">
        <div class="quick-job-head">
          <span class="job-type-pill ${escapeHtml(workKind.type)}">${escapeHtml(workKind.label)}</span>
          <strong>${escapeHtml(statusLine)}</strong>
          <em>${escapeHtml(formatDate(row.booking.date))} kl. ${escapeHtml(bookingTimeText(row.booking))} · ${escapeHtml(row.booking.resource || "Ikke satt")}</em>
        </div>
        <p class="job-billing-hint">${escapeHtml(workKind.billing)}. ${escapeHtml(workKind.help)}</p>
        ${row.booking.note ? `<p class="quick-job-note">${escapeHtml(cleanBookingNote(row.booking.note)).replaceAll("\n", "<br>")}</p>` : ""}
        ${flow ? workflowHtml(flow, { title: "Hva skjer med jobben?", compact: true }) : ""}
        ${isAdmin() ? `<div class="quick-work-actions">${bookingWorkflowButtons(row, { includeEdit: true })}</div>` : ""}
      </section>
    `;
  }

  function orderTitleFromBooking(customer, booking) {
    return `${bookingJobLabel(booking || { type: "service" })} - ${cleanDisplayName(customer)}`;
  }

  function orderDraftForBooking(bookingId, booking, overrides = {}) {
    const customer = findCustomer(booking.customerId);
    const type = bookingDisplayType(booking);
    const installationId = overrides.installationId ?? overrides.installation_id ?? booking.installationId ?? booking.installation_id ?? "";
    const locationId = overrides.locationId ?? overrides.location_id ?? booking.locationId ?? booking.location_id ?? "";
    const isDone = overrides.status === "completed" || booking.status === "done" || doneJobs.has(bookingId);
    const paymentMode = customer ? bookingPaymentMode({ id: bookingId, booking, customer }) : "";
    const billingStatus = overrides.billingStatus
      || (paymentMode === "cash" ? "paid" : "")
      || (paymentMode === "invoice" ? "sent" : "")
      || (isDone && billableJobType(type) && !customer?.pays_cash ? "ready" : "not_ready");
    return setBookingIdsForOrder({
      id: overrides.id,
      customerId: booking.customerId,
      title: overrides.title || orderTitleFromBooking(customer || {}, booking),
      type,
      status: overrides.status || (isDone ? "completed" : "scheduled"),
      billingStatus,
      source: overrides.source || "booking",
      scheduledDate: booking.date || "",
      scheduledTime: normalizeBookingTime(booking.time),
      resource: booking.resource || "",
      installationId,
      installation_id: installationId,
      locationId,
      location_id: locationId,
      completedAt: overrides.completedAt || (isDone ? booking.done_at || booking.date || "" : ""),
      note: overrides.note ?? noteWithJobPriceBasis(cleanBookingNote(booking.note || ""), extractJobPriceBasis(booking.note || "")),
      created_at: overrides.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, [bookingId]);
  }

  async function saveOrderRecord(id, order, options = {}) {
    const nextId = normalizeOrderId(id || order.id) || `order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const mirrorJob = jobForOrder(order.id || id || nextId);
    const hasInstallationId = Object.prototype.hasOwnProperty.call(order, "installationId")
      || Object.prototype.hasOwnProperty.call(order, "installation_id");
    const hasLocationId = Object.prototype.hasOwnProperty.call(order, "locationId")
      || Object.prototype.hasOwnProperty.call(order, "location_id");
    const installationId = hasInstallationId ? (order.installationId ?? order.installation_id ?? "") : (mirrorJob?.installation_id || "");
    const locationId = hasLocationId ? (order.locationId ?? order.location_id ?? "") : (mirrorJob?.location_id || "");
    const record = {
      ...order,
      id: nextId,
      customerId: order.customerId || order.customer_id || "",
      type: order.type || "service",
      status: order.status || "unscheduled",
      billingStatus: order.billingStatus || order.billing_status || "not_ready",
      installationId,
      installation_id: installationId,
      locationId,
      location_id: locationId,
      updated_at: new Date().toISOString(),
    };
    setBookingIdsForOrder(record, bookingIdsForOrder(record));
    if (store.isConfigured && store.saveOrder && !options.localOnly) {
      const saved = await store.saveOrder(nextId, record);
      orders[saved.id] = saved;
      upsertLocalJobMirrorForOrder(saved);
      if (nextId !== saved.id) delete orders[nextId];
      return saved;
    }
    if (store.isConfigured && options.localOnly) {
      orders[nextId] = record;
      upsertLocalJobMirrorForOrder(record);
      return record;
    }
    requireLocalDemoStorage();
    orders[nextId] = record;
    saveLocalOrders();
    return record;
  }

  function unlinkOrderFromLocalBookings(orderId) {
    let changed = false;
    for (const booking of Object.values(bookings || {})) {
      if (booking?.orderId === orderId) {
        booking.orderId = "";
        changed = true;
      }
    }
    if (changed && !store.isConfigured) saveLocalBookings();
  }

  async function deleteOrderRecord(orderId, options = {}) {
    const id = normalizeOrderId(orderId);
    if (!id || !orders[id]) return;
    const order = orders[id];
    const bookingIds = bookingIdsForOrder(order);
    if (store.isConfigured && store.deleteOrder && !String(id).startsWith("order-")) {
      await store.deleteOrder(id);
    }
    delete orders[id];
    selectedOrderIds.delete(id);
    if (selectedOrderId === id) selectedOrderId = "";
    unlinkOrderFromLocalBookings(id);
    if (options.cancelLinkedBookings) {
      for (const bookingId of bookingIds) {
        if (bookings[bookingId]) {
          if (store.isConfigured) await store.cancelBooking(bookingId);
          delete bookings[bookingId];
        }
      }
      if (!store.isConfigured) saveLocalBookings();
    }
    if (!store.isConfigured) saveLocalOrders();
  }

  function showDeleteOrdersMessage(message, type = "error") {
    if (!el.deleteOrdersDialogMessage) return;
    el.deleteOrdersDialogMessage.textContent = message || "";
    el.deleteOrdersDialogMessage.className = `dialog-message ${type}`;
    el.deleteOrdersDialogMessage.classList.toggle("hidden", !message);
  }

  function clearDeleteOrdersMessage() {
    showDeleteOrdersMessage("", "error");
  }

  function orderDeleteSummary(ids) {
    const linkedBookingCount = ids.reduce((sum, id) => sum + bookingIdsForOrder(orders[id]).filter((bookingId) => bookings[bookingId]).length, 0);
    const examples = ids
      .slice(0, 4)
      .map((id) => {
        const order = orders[id];
        const customer = order ? findCustomer(orderCustomerId(order)) : null;
        return `<li>${escapeHtml(order?.title || "Jobb")} · ${escapeHtml(customer ? cleanDisplayName(customer) : "Ukjent kunde")}</li>`;
      })
      .join("");
    return { linkedBookingCount, examples };
  }

  function openDeleteOrdersDialog(ids = [...selectedOrderIds]) {
    const realIds = ids.map(normalizeOrderId).filter((id) => orders[id]);
    if (!realIds.length || !el.deleteOrdersDialog) return;
    deleteOrdersDialogIds = realIds;
    const { linkedBookingCount, examples } = orderDeleteSummary(realIds);
    el.deleteOrdersSummary.innerHTML = `
      <strong>${realIds.length} jobber valgt</strong>
      <span>${linkedBookingCount ? `${linkedBookingCount} avtale${linkedBookingCount === 1 ? "" : "r"} er koblet til valgte jobber.` : "Ingen aktive avtaler er koblet til valgte jobber."}</span>
      ${examples ? `<ul>${examples}${realIds.length > 4 ? `<li>+ ${realIds.length - 4} flere</li>` : ""}</ul>` : ""}
    `;
    if (el.deleteOrdersBookingOptions) el.deleteOrdersBookingOptions.classList.toggle("hidden", linkedBookingCount === 0);
    if (el.deleteOrdersKeepBookings) el.deleteOrdersKeepBookings.checked = true;
    clearDeleteOrdersMessage();
    el.deleteOrdersDialog.showModal();
  }

  async function deleteSelectedOrders(options = {}) {
    const ids = (deleteOrdersDialogIds.length ? deleteOrdersDialogIds : [...selectedOrderIds]).filter((id) => orders[id]);
    if (!ids.length) return;
    for (const id of ids) await deleteOrderRecord(id, { cancelLinkedBookings: Boolean(options.cancelLinkedBookings) });
    selectedOrderIds = new Set();
    deleteOrdersDialogIds = [];
    renderAll();
    setSyncStatus(`${ids.length} jobber slettet.`, "ok");
  }

  async function ensureOrderForBooking(bookingId, booking, overrides = {}, options = {}) {
    if (!bookingId || !booking?.customerId) return null;
    const existing = findOrder(booking.orderId) || linkedOrderForBooking(bookingId);
    const draft = orderDraftForBooking(bookingId, booking, { ...overrides, id: existing?.id || overrides.id });
    const merged = existing ? {
      ...existing,
      ...draft,
      created_at: existing.created_at || draft.created_at,
      title: existing.title || draft.title,
      note: overrides.note ?? existing.note ?? draft.note,
    } : draft;
    if ("invoicedAt" in overrides || "invoiced_at" in overrides) {
      merged.invoicedAt = overrides.invoicedAt || overrides.invoiced_at || "";
    }
    setBookingIdsForOrder(merged, [...bookingIdsForOrder(existing), bookingId]);
    const saved = await saveOrderRecord(merged.id, merged, { quiet: true, localOnly: options.localOnly });
    if (bookings[bookingId]) {
      bookings[bookingId].orderId = saved.id;
      if (!store.isConfigured) saveLocalBookings();
    }
    return saved;
  }

  async function ensureOrdersForLoadedBookings() {
    if (!isAdmin()) return 0;
    if (store.isConfigured && !store.saveOrder) return 0;
    let created = 0;
    for (const row of bookingRows()) {
      const existing = findOrder(row.booking.orderId) || linkedOrderForBooking(row.id);
      if (existing) {
        if (bookings[row.id] && bookings[row.id].orderId !== existing.id) bookings[row.id].orderId = existing.id;
        continue;
      }
      await ensureOrderForBooking(row.id, row.booking);
      created += 1;
    }
    if (created && !store.isConfigured) saveLocalBookings();
    return created;
  }

  async function markOrderUnscheduledForBooking(bookingId) {
    const order = linkedOrderForBooking(bookingId);
    if (!order) return;
    const ids = bookingIdsForOrder(order).filter((id) => id !== bookingId);
    const next = {
      ...order,
      status: ids.length ? order.status : "unscheduled",
      scheduledDate: ids.length ? order.scheduledDate : "",
      scheduledTime: ids.length ? order.scheduledTime : "",
    };
    setBookingIdsForOrder(next, ids);
    await saveOrderRecord(order.id, next, { quiet: true });
  }

  async function markOrderInvoicedForBooking(bookingId, invoiceDate) {
    return markOrderBillingForBooking(bookingId, "sent", invoiceDate);
  }

  async function markOrderBillingForBooking(bookingId, billingStatus, billingDate) {
    const order = linkedOrderForBooking(bookingId);
    if (!order) return;
    await saveOrderRecord(order.id, {
      ...order,
      billingStatus,
      invoicedAt: billingDate,
      status: order.status === "unscheduled" ? "completed" : order.status,
    }, { quiet: true });
  }

  async function createOrderFromLead(customerId, options = {}) {
    const entry = leadEntryForTarget(customerId);
    const targetCustomerId = entry ? leadEntryCustomerKey(entry) : customerId;
    const customer = findCustomer(targetCustomerId);
    if (!customer) throw new Error("Fant ikke henvendelse/kunde.");
    const lead = entry?.lead || leadForCustomer(customer);
    const leadId = lead?.id || "";
    const lockKey = `lead-order:${leadId || customerKey(customer)}`;
    if (pendingLeadOrderKeys.has(lockKey)) {
      setSyncStatus("Jobb opprettes allerede. Vent et øyeblikk.", "");
      return;
    }
    pendingLeadOrderKeys.add(lockKey);
    try {
      const note = entry ? leadNoteForEntry(entry) : leadNoteForCustomer(customer);
      const selectedInstallation = options.installationId
        ? installationsForCustomer(customer).find((installation) => String(installation.id || "") === String(options.installationId))
        : null;
      const selectedLocation = selectedInstallation ? locationForInstallation(selectedInstallation, customer) : null;
      const productParts = String(options.productInterest || "").trim()
        ? [options.productInterest]
        : [lead?.product_interest, customer.brand, customer.model_or_note];
      const productInterest = productParts
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .join(" · ");
      const accessories = String(options.accessories || "").trim();
      const wonNote = String(options.note || "").trim();
      const sourceDetail = String(lead?.source_detail || customer.latest_deal_name || "").trim();
      const leadText = normalizeMatch([note, productInterest, sourceDetail, customer.tags].filter(Boolean).join(" "));
      const type = /\b(blaseisolering|isobygg|isolering|supafil)\b/.test(leadText)
        ? "blaseisolering"
        : /\b(service|reparasjon|feil|drypp|stoy|støy)\b/.test(leadText)
          ? "service"
          : "installasjon";
      const priceBasis = type === "installasjon" ? priceBasisFromSalesDetails(productInterest, accessories) : priceBasisFromSalesDetails("", accessories);
      const existingLeadOrder = orderForLeadId(leadId);
      const existingOrderId = normalizeOrderId(existingLeadOrder?.id || "");
      if (existingOrderId) {
        selectedOrderId = existingOrderId;
        setView("orders");
        setSyncStatus("Denne saken har allerede en jobb. Jeg åpnet eksisterende jobb i stedet.", "ok");
        return;
      }
      const openOrders = customerOrders(customer).filter((order) => !["completed", "cancelled"].includes(orderEffectiveStatus(order, jobForOrder(order), bookingRowsForOrder(order))));
      if (openOrders.length) {
        const ok = await askForConfirmation({
          title: "Kunden har åpen jobb",
          message: `${cleanDisplayName(customer)} har allerede ${openOrders.length} åpen jobb. Opprette en ny jobb likevel?`,
          confirmLabel: "Opprett ny jobb",
        });
        if (!ok) return;
      }
      const orderNote = noteWithJobPriceBasis([
        "Fra vunnet oppfølging:",
        productInterest ? `Produkt/ønske: ${productInterest}` : "",
        accessories ? `Tilbehør/tillegg: ${accessories}` : "",
        selectedInstallation ? `Gjelder anlegg: ${installationDisplayName(selectedInstallation)}` : "",
        selectedLocation ? `Anleggsadresse: ${locationAddressText(selectedLocation)}` : "",
        sourceDetail && sourceDetail !== productInterest ? `Kilde/detalj: ${sourceDetail}` : "",
        wonNote ? `Avtalt/notat: ${wonNote}` : "",
        note || `Kunden har takket ja. Status: ${leadStatusLabel(leadStatusForCustomer(customer))}.`,
        accessInfo(customer) ? `Adkomst: ${accessInfo(customer)}` : "",
      ].filter(Boolean).join("\n"), priceBasis);
      const titleProduct = productInterest || sourceDetail;
      const order = await saveOrderRecord("", {
        customerId: customerKey(customer),
        leadId,
        lead_id: leadId,
        title: `${orderTypeLabel(type)} - ${titleProduct || cleanDisplayName(customer)}`,
        type,
        status: "unscheduled",
        billingStatus: "not_ready",
        installationId: selectedInstallation?.id || "",
        installation_id: selectedInstallation?.id || "",
        locationId: selectedLocation?.id || "",
        location_id: selectedLocation?.id || "",
        source: "lead",
        note: orderNote,
        created_at: new Date().toISOString(),
      });
      await saveServiceEvent(customer, {
        event_date: isoDate(new Date()),
        event_type: "Jobb opprettet",
        note: [
          `${orderTypeLabel(type)} opprettet fra vunnet oppfølging.`,
          productInterest ? `Produkt/ønske: ${productInterest}.` : "",
          accessories ? `Tilbehør/tillegg: ${accessories}.` : "",
          selectedInstallation ? `Anlegg: ${installationDisplayName(selectedInstallation)}.` : "",
          wonNote,
          note || "",
        ].filter(Boolean).join(" ").trim(),
      });
      selectedOrderId = order.id;
      if (options.bookAfter) {
        renderAll();
        openBookingDialog(customerKey(customer), "", {
          orderId: order.id,
          type: type === "blaseisolering" ? "blaseisolering" : type,
          installationId: selectedInstallation?.id || "",
          note: order.note || orderNote,
        });
        setSyncStatus("Jobb opprettet. Velg dato og tid for avtalen.", "ok");
        return;
      }
      setView("orders");
      setSyncStatus("Jobb opprettet fra oppfølging.", "ok");
    } finally {
      pendingLeadOrderKeys.delete(lockKey);
    }
  }

  function showOrderDialogMessage(message, tone = "error") {
    if (!el.orderDialogMessage) return;
    el.orderDialogMessage.textContent = message || "";
    el.orderDialogMessage.className = `dialog-message ${tone || ""}`.trim();
  }

  function clearOrderDialogMessage() {
    if (!el.orderDialogMessage) return;
    el.orderDialogMessage.textContent = "";
    el.orderDialogMessage.className = "dialog-message hidden";
  }

  function showCustomerDialogMessage(message, tone = "error") {
    if (!el.customerDialogMessage) return;
    el.customerDialogMessage.textContent = message || "";
    el.customerDialogMessage.className = `dialog-message ${tone || ""}`.trim();
  }

  function clearCustomerDialogMessage() {
    if (!el.customerDialogMessage) return;
    el.customerDialogMessage.textContent = "";
    el.customerDialogMessage.className = "dialog-message hidden";
  }

  function renderOrderInstallationOptions(customer, selectedId = "") {
    if (!el.orderInstallationSelect) return;
    const allInstallations = installationsForCustomer(customer);
    const installations = allInstallations.filter((installation) => (
      installation.active !== false || String(installation.id || "") === String(selectedId || "")
    ));
    const autoId = !selectedId && installations.length === 1 ? String(installations[0].id || "") : "";
    const current = selectedId || autoId;
    const rows = [
      `<option value="">Ikke valgt / gjelder hele kunden</option>`,
      ...installations.map((installation) => {
        const location = locationForInstallation(installation, customer);
        const locationText = locationAddressText(location);
        const label = [installationDisplayName(installation), locationText].filter(Boolean).join(" - ");
        return `<option value="${escapeHtml(installation.id || "")}">${escapeHtml(label)}</option>`;
      }),
    ];
    el.orderInstallationSelect.innerHTML = rows.join("");
    el.orderInstallationSelect.value = current;
    el.orderInstallationSelect.disabled = installations.length === 0;
    el.orderInstallationSelect.title = installations.length
      ? "Velg hvilket anlegg jobben gjelder. Dette brukes videre ved fullføring og servicefrist."
      : "Kunden har ingen registrerte varmepumper/anlegg ennå.";
  }

  function renderOrderPriceTotal() {
    if (!el.orderPriceTotal || !el.orderPriceLines) return;
    const total = jobPriceBasisTotal(el.orderPriceLines.value);
    el.orderPriceTotal.textContent = total > 0
      ? `Ca. avtalt grunnlag: ${formatJobPriceAmount(total)} inkl. mva - kan korrigeres ved fullføring.`
      : "Ingen summerbare produkt- eller prislinjer lagt inn.";
  }

  function syncOrderPriceQuantity() {
    if (!el.orderPricePreset || !el.orderPriceQuantity) return;
    const item = offerLinePresets.find((entry) => entry.id === el.orderPricePreset.value);
    if (item) el.orderPriceQuantity.value = String(item.defaultQty || 1);
    const heatPump = offerLineItemIsHeatPump(item);
    el.orderStandardInstallationWrap?.classList.toggle("hidden", !heatPump);
    if (el.orderIncludeStandardInstallation) el.orderIncludeStandardInstallation.checked = heatPump;
  }

  function syncOrderPriceSearch() {
    if (!el.orderPricePreset) return;
    const query = el.orderPriceSearch?.value || "";
    const currentValue = el.orderPricePreset.value || "heatpump_custom";
    el.orderPricePreset.innerHTML = offerLinePresetOptions(currentValue, query);
    const available = new Set(Array.from(el.orderPricePreset.options).map((option) => option.value).filter(Boolean));
    const preferredValue = query.trim() && currentValue === "heatpump_custom"
      ? firstOfferLineMatch(query).id
      : currentValue;
    el.orderPricePreset.value = available.has(preferredValue) ? preferredValue : firstOfferLineMatch(query).id;
    syncOrderPriceQuantity();
  }

  function orderPriceLineFromSelection() {
    const selected = offerLinePresets.find((entry) => entry.id === el.orderPricePreset?.value);
    const quantity = Number(String(el.orderPriceQuantity?.value || selected?.defaultQty || 1).replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Antall må være større enn 0.");
    if (!selected || selected.id === "heatpump_custom") {
      const label = String(el.orderPriceSearch?.value || "").trim();
      if (!label) throw new Error("Søk eller velg produkt/tillegg før du legger til.");
      return `- ${label}: ${formatJobPriceNumber(quantity)} stk - pris avtales/legges inn`;
    }
    const line = jobPriceLineForItem(selected, quantity);
    if (offerLineItemIsHeatPump(selected) && el.orderIncludeStandardInstallation?.checked) {
      return [line, standardInstallationOfferLine(quantity)].filter(Boolean).join("\n");
    }
    return line;
  }

  function addOrderPriceLine() {
    if (!el.orderPriceLines) return;
    const line = orderPriceLineFromSelection();
    const existing = String(el.orderPriceLines.value || "").trim();
    if (offerLinesAlreadyInclude(existing, line)) {
      showOrderDialogMessage("Linjen ligger allerede i grunnlaget. Endre antall hvis kunden skal ha flere.", "info");
      return;
    }
    el.orderPriceLines.value = [existing, line].filter(Boolean).join("\n");
    renderOrderPriceTotal();
    clearOrderDialogMessage();
  }

  function priceBasisLineForItem(item, quantity = 1) {
    if (!item || item.id === "heatpump_custom") return "";
    return jobPriceLineForItem(item, quantity || item.defaultQty || 1);
  }

  function appendUniquePriceBasisLine(lines, line) {
    const clean = String(line || "").trim();
    if (!clean) return lines;
    const existing = lines.join("\n");
    if (offerLinesAlreadyInclude(existing, clean)) return lines;
    return [...lines, clean];
  }

  function priceBasisLinesFromText(text, options = {}) {
    const terms = String(text || "")
      .split(/\r?\n|,/)
      .map((part) => part.trim())
      .filter(Boolean);
    let lines = [];
    for (const term of terms) {
      const item = firstOfferLineMatch(term);
      if (!item || item.id === "heatpump_custom") {
        lines = appendUniquePriceBasisLine(lines, `- ${term}: pris avtales/legges inn`);
        continue;
      }
      lines = appendUniquePriceBasisLine(lines, priceBasisLineForItem(item, item.defaultQty || 1));
      if (options.includeStandardInstallation && offerLineItemIsHeatPump(item)) {
        lines = appendUniquePriceBasisLine(lines, standardInstallationOfferLine(item.defaultQty || 1));
      }
    }
    return lines;
  }

  function priceBasisFromSalesDetails(productInterest = "", accessories = "") {
    const lines = [
      ...priceBasisLinesFromText(productInterest, { includeStandardInstallation: true }),
      ...priceBasisLinesFromText(accessories),
    ].reduce((result, line) => appendUniquePriceBasisLine(result, line), []);
    return lines.join("\n");
  }

  function setupOrderPriceFields(order, options = {}) {
    if (!el.orderPriceDetails || !el.orderPricePreset || !el.orderPriceLines) return;
    const sourceNote = order?.note || options.note || "";
    const generatedBasis = priceBasisFromSalesDetails(options.productInterest, options.accessories);
    const priceBasis = extractJobPriceBasis(sourceNote) || generatedBasis;
    if (el.orderPriceSearch) el.orderPriceSearch.value = String(options.productInterest || "").trim();
    el.orderPricePreset.innerHTML = offerLinePresetOptions("heatpump_custom", el.orderPriceSearch?.value || "");
    const firstMatch = el.orderPriceSearch?.value ? firstOfferLineMatch(el.orderPriceSearch.value) : null;
    if (firstMatch?.id && Array.from(el.orderPricePreset.options).some((option) => option.value === firstMatch.id)) {
      el.orderPricePreset.value = firstMatch.id;
    }
    if (el.orderPriceQuantity) el.orderPriceQuantity.value = "1";
    el.orderPriceLines.value = priceBasis;
    syncOrderPriceQuantity();
    el.orderPriceDetails.open = Boolean(priceBasis || options.productInterest || options.accessories);
    renderOrderPriceTotal();
  }

  function orderPriceBasisText() {
    return String(el.orderPriceLines?.value || "").trim();
  }

  function renderBookingInstallationOptions(customer, selectedId = "") {
    if (!el.bookingInstallationSelect) return;
    const allInstallations = customer ? installationsForCustomer(customer) : [];
    const installations = allInstallations.filter((installation) => (
      installation.active !== false || String(installation.id || "") === String(selectedId || "")
    ));
    const activeInstallations = installations.filter((installation) => installation.active !== false);
    const autoId = !selectedId
      && ["service", "reparasjon"].includes(el.bookingType?.value || "service")
      && activeInstallations.length === 1
      ? String(activeInstallations[0].id || "")
      : "";
    const current = selectedId || autoId;
    const rows = [
      `<option value="">Ikke valgt / gjelder hele kunden</option>`,
      ...installations.map((installation) => {
        const location = locationForInstallation(installation, customer);
        const label = [installationDisplayName(installation), locationAddressText(location)].filter(Boolean).join(" - ");
        return `<option value="${escapeHtml(installation.id || "")}">${escapeHtml(label)}</option>`;
      }),
    ];
    el.bookingInstallationSelect.innerHTML = rows.join("");
    el.bookingInstallationSelect.value = current;
    el.bookingInstallationSelect.disabled = !customer || installations.length === 0;
    el.bookingInstallationSelect.title = installations.length
      ? "Velg hvilket anlegg avtalen gjelder. Valget føres videre til jobben og fullføring/servicefrist."
      : "Kunden har ingen registrerte varmepumper/anlegg ennå.";
  }

  function selectedBookingInstallation(customer = findCustomer(bookingSelectedCustomerId)) {
    const installationId = el.bookingInstallationSelect?.value || "";
    if (!customer || !installationId) return null;
    return installationsForCustomer(customer).find((installation) => String(installation.id || "") === String(installationId)) || null;
  }

  function syncBookingInstallationNoteFromSelect() {
    const customer = findCustomer(bookingSelectedCustomerId);
    const installation = selectedBookingInstallation(customer);
    if (!customer || !installation) return;
    const generated = installationBookingNote(installation, customer);
    if (!generated) return;
    const keepLines = String(el.bookingNote?.value || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line && !/^(Anlegg|Adresse|Serviceintervall|Kodeboks\/nøkkel\/adkomst|Kodeboks\/nokkel\/adkomst):/i.test(line));
    el.bookingNote.value = [...keepLines, generated].filter(Boolean).join("\n");
  }

  function openOrderDialog(customerId, orderId = "", options = {}) {
    const order = findOrder(orderId);
    const customer = findCustomer(order ? orderCustomerId(order) : customerId);
    if (!customer) {
      setSyncStatus("Velg eller opprett kunde før du lager jobb.", "error");
      return;
    }
    editingOrderId = order?.id || "";
    orderDialogCustomerId = customerKey(customer);
    orderTitleManuallyEdited = Boolean(order?.title);
    clearOrderDialogMessage();
    el.orderDialogTitle.textContent = order ? "Rediger jobb" : "Ny jobb";
    el.orderCustomerName.value = cleanDisplayName(customer);
    el.orderType.value = serviceWorkType(order?.type || options.type) ? "reparasjon" : (order?.type || options.type || "service");
    renderOrderInstallationOptions(customer, installationIdForOrder(order || options.order || {}, jobForOrder(order || "")));
    el.orderTitleInput.value = order?.title || defaultOrderTitle(customer, el.orderType.value);
    el.orderBookNow.checked = false;
    el.orderNoteInput.value = cleanBookingNote(order?.note || options.note || "");
    setupOrderPriceFields(order, options);
    el.orderDialog.showModal();
    setTimeout(() => el.orderNoteInput.focus(), 0);
  }

  function syncOrderTitleFromType() {
    const customer = findCustomer(orderDialogCustomerId);
    if (!customer || orderTitleManuallyEdited) return;
    el.orderTitleInput.value = defaultOrderTitle(customer, el.orderType.value);
  }

  function orderFormValues() {
    const customer = findCustomer(orderDialogCustomerId);
    if (!customer) throw new Error("Fant ikke kunden for jobben.");
    const installationId = el.orderInstallationSelect?.value || "";
    const installation = installationId
      ? installationsForCustomer(customer).find((item) => String(item.id || "") === String(installationId))
      : null;
    const location = installation ? locationForInstallation(installation, customer) : null;
    return {
      customer,
      type: el.orderType.value || "service",
      title: el.orderTitleInput.value.trim() || defaultOrderTitle(customer, el.orderType.value),
      note: noteWithJobPriceBasis(el.orderNoteInput.value.trim(), orderPriceBasisText()),
      cleanNote: el.orderNoteInput.value.trim(),
      priceBasis: orderPriceBasisText(),
      installationId,
      locationId: location?.id || "",
      bookNow: Boolean(el.orderBookNow.checked),
    };
  }

  async function saveOrderFromDialog() {
    const values = orderFormValues();
    const existing = findOrder(editingOrderId);
    const selectedInstallation = values.installationId
      ? installationsForCustomer(values.customer).find((item) => String(item.id || "") === String(values.installationId))
      : null;
    const order = await saveOrderRecord(editingOrderId, {
      ...existing,
      customerId: customerKey(values.customer),
      title: values.title,
      type: values.type,
      status: existing?.status || "unscheduled",
      billingStatus: existing?.billingStatus || existing?.billing_status || "not_ready",
      installationId: values.installationId,
      installation_id: values.installationId,
      locationId: values.locationId,
      location_id: values.locationId,
      source: existing?.source || "manual",
      note: values.note,
      created_at: existing?.created_at || new Date().toISOString(),
    });
    await saveServiceEvent(values.customer, {
      event_date: isoDate(new Date()),
      event_type: existing ? "Jobb endret" : "Jobb opprettet",
      note: [
        `${orderTypeLabel(values.type)}-jobb ${existing ? "endret" : "opprettet"} direkte på kundekort.`,
        selectedInstallation ? `Anlegg: ${installationDisplayName(selectedInstallation)}.` : "",
        values.cleanNote,
        values.priceBasis ? `Prisgrunnlag/tillegg:\n${values.priceBasis}` : "",
      ].filter(Boolean).join("\n"),
    });
    selectedOrderId = order.id;
    const shouldBook = values.bookNow;
    const customerId = customerKey(values.customer);
    el.orderDialog.close();
    if (shouldBook) {
      renderAll();
      setSyncStatus(existing ? "Jobb oppdatert." : "Jobb opprettet direkte fra kundekort.", "ok");
      openBookingDialog(customerId, "", {
        orderId: order.id,
        type: values.type === "annet" ? "service" : values.type,
        installationId: values.installationId,
        note: values.note,
      });
    } else {
      setView("orders");
      setSyncStatus(existing ? "Jobb oppdatert." : "Jobb opprettet direkte fra kundekort.", "ok");
    }
  }

  function knownPlanningResources(rows = bookingRows()) {
    const resources = new Set(activeResourceNames());
    if (jointResourceAvailable()) resources.add("Gunnar og Hubert");
    if (currentUser?.name && !/bruker/i.test(currentUser.name) && !resourceBelongsToInactiveProfile(currentUser.name)) resources.add(currentUser.name);
    for (const row of rows) {
      const resource = String(row.booking.resource || "").trim();
      if (resource && !resourceBelongsToInactiveProfile(resource)) resources.add(resource);
    }
    return sortResourceNames([...resources]);
  }

  function resourceMatchesFilter(row, filter = planningResourceFilter) {
    if (!filter || filter === "all") return true;
    const resource = normalizeMatch(row?.booking?.resource || "");
    const selected = normalizeMatch(filter);
    if (!resource || !selected) return false;
    const jointGunnarHubert = resource.includes("gunnar") && resource.includes("hubert");
    if (selected === "gunnar og hubert") return jointGunnarHubert;
    return resource.includes(selected) || jointGunnarHubert;
  }

  function filteredPlanningRows(rows = bookingRows()) {
    return rows.filter((row) => resourceMatchesFilter(row));
  }

  function renderPlanningResourceOptions(rows = bookingRows()) {
    if (!el.planningResourceFilter) return;
    const current = planningResourceFilter || "all";
    const resources = knownPlanningResources(rows);
    if (current !== "all" && !resources.includes(current)) resources.push(current);
    el.planningResourceFilter.innerHTML = [
      `<option value="all">Alle ansatte</option>`,
      ...resources.map((resource) => `<option value="${escapeHtml(resource)}">${escapeHtml(resource)}</option>`),
    ].join("");
    planningResourceFilter = current === "all" || resources.includes(current) ? current : "all";
    el.planningResourceFilter.value = planningResourceFilter;
  }

  function invoiceMarkerRegex() {
    return /\[Fakturert[^\]]*\]/i;
  }

  function cashPaymentMarkerRegex() {
    return /\[(Betalt cash|Betalt på stedet)[^\]]*\]/i;
  }

  function paymentMarkerRegex() {
    return /\[(Fakturert|Betalt cash|Betalt på stedet)[^\]]*\]/i;
  }

  function paymentMarkersRegex() {
    return /\[(Fakturert|Betalt cash|Betalt på stedet)[^\]]*\]/gi;
  }

  function moveMarkerRegex() {
    return /\[Må flyttes[^\]]*\]/gi;
  }

  function markerText(note, regex) {
    return String(note || "").match(regex)?.[0] || "";
  }

  function jobPriceBlockRegex() {
    return /\n*\[Prisgrunnlag\]\n?([\s\S]*?)\n?\[\/Prisgrunnlag\]\n*/i;
  }

  function extractJobPriceBasis(note) {
    return String(note || "").match(jobPriceBlockRegex())?.[1]?.trim() || "";
  }

  function stripJobPriceBasis(note) {
    return String(note || "")
      .replace(jobPriceBlockRegex(), "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function noteWithJobPriceBasis(note, priceBasis) {
    const clean = stripJobPriceBasis(note);
    const priceText = String(priceBasis || "").trim();
    if (!priceText) return clean;
    return [clean, `[Prisgrunnlag]\n${priceText}\n[/Prisgrunnlag]`].filter(Boolean).join("\n");
  }

  function noteWithoutMoveMarker(note) {
    return String(note || "")
      .replace(moveMarkerRegex(), "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function cleanBookingNote(note) {
    return String(note || "")
      .replace(paymentMarkerRegex(), "")
      .replace(paymentMarkersRegex(), "")
      .replace(moveMarkerRegex(), "")
      .replace(jobPriceBlockRegex(), "")
      .trim();
  }

  function bookingNeedsMove(row) {
    return Boolean(row?.booking?.needs_move || moveMarkerRegex().test(row?.booking?.note || ""));
  }

  function bookingMoveReason(row) {
    const marker = markerText(row?.booking?.note, moveMarkerRegex());
    return marker.replace(/^\[Må flyttes\s*/i, "").replace(/\]$/, "").trim();
  }

  function isPastBookingDate(date) {
    return Boolean(date && date < isoDate(new Date()));
  }

  function bookingIsInvoiced(row) {
    return Boolean(row?.booking?.invoiced || invoiceMarkerRegex().test(row?.booking?.note || ""));
  }

  function bookingIsPaidCash(row) {
    return Boolean(row?.booking?.paid_cash || cashPaymentMarkerRegex().test(row?.booking?.note || ""));
  }

  function bookingPaymentMode(row) {
    if (bookingIsPaidCash(row)) return "cash";
    if (bookingIsInvoiced(row)) return "invoice";
    return "";
  }

  function bookingPaymentDone(row) {
    return Boolean(bookingPaymentMode(row));
  }

  function bookingIsSettledForPlanning(row) {
    const done = row?.booking?.status === "done" || doneJobs.has(row?.id);
    if (!done) return false;
    if (!billableJobType(bookingDisplayType(row))) return bookingDisplayType(row) !== "befaring";
    return bookingPaymentDone(row);
  }

  function bookingNeedsSalesFollowup(row) {
    if (!row) return false;
    const done = row.booking.status === "done" || doneJobs.has(row.id);
    return done && bookingDisplayType(row) === "befaring" && !bookingNeedsMove(row);
  }

  function bookingNeedsInvoice(row) {
    if (!row || bookingPaymentDone(row)) return false;
    if (row.customer?.pays_cash) return false;
    if (!billableJobType(bookingDisplayType(row))) return false;
    return row.booking.status === "done" || doneJobs.has(row.id);
  }

  function bookingNeedsCashPayment(row) {
    if (!row || bookingPaymentDone(row)) return false;
    if (!row.customer?.pays_cash) return false;
    if (!billableJobType(bookingDisplayType(row))) return false;
    return row.booking.status === "done" || doneJobs.has(row.id);
  }

  function bookingNeedsPaymentAction(row) {
    return bookingNeedsInvoice(row) || bookingNeedsCashPayment(row);
  }

  function bookingNeedsCompletion(row) {
    if (!row || row.booking.status === "done" || doneJobs.has(row.id)) return false;
    if (bookingNeedsMove(row)) return false;
    if (!["service", "installasjon", "blaseisolering", "reparasjon", "servicearbeid", "reklamasjon"].includes(bookingDisplayType(row))) return false;
    return isPastBookingDate(row.booking.date);
  }

  function billingQueueRows() {
    return bookingRows()
      .filter((row) => bookingNeedsPaymentAction(row) || bookingNeedsCompletion(row))
      .sort((a, b) => {
        const rank = (row) => bookingNeedsPaymentAction(row) ? 0 : 1;
        return rank(a) - rank(b) || String(a.booking.date || "").localeCompare(String(b.booking.date || ""));
      });
  }

  function moveQueueRows() {
    return bookingRows()
      .filter((row) => bookingNeedsMove(row) && row.booking.status !== "done" && !doneJobs.has(row.id))
      .sort((a, b) => `${a.booking.date || ""} ${a.booking.time || ""}`.localeCompare(`${b.booking.date || ""} ${b.booking.time || ""}`));
  }

  function setDemoUser(userKey) {
    if (store.isConfigured || !demoEnabled) {
      el.loginMessage.textContent = store.isConfigured
        ? "Supabase er konfigurert. Bruk e-post og passord."
        : databaseUnavailableMessage;
      return;
    }
    currentUser = { ...users[userKey] };
    applyCurrentUserPreferences(currentUser);
    localStorage.setItem(storage.user, JSON.stringify(currentUser));
    currentView = currentUser.view;
    renderApp();
  }

  function isTechnicianUser() {
    return currentUser?.role === "Tekniker";
  }

  function viewAllowedForCurrentUser(view) {
    if (!isTechnicianUser()) return true;
    return new Set(["technician", "planning", "customers"]).has(view);
  }

  function defaultViewForCurrentUser() {
    return isTechnicianUser() ? "technician" : "dashboard";
  }

  function isMobileLayout() {
    return Boolean(window.matchMedia?.("(max-width: 760px)")?.matches);
  }

  function scrollPanelIntoMobileView(panel) {
    if (!panel || !isMobileLayout()) return;
    setTimeout(() => {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function closeFloatingMenus() {
    el.moreMenu?.classList.add("hidden");
    el.moreMenuButton?.setAttribute("aria-expanded", "false");
    el.mobileMoreMenu?.classList.add("hidden");
    el.mobileMoreButton?.setAttribute("aria-expanded", "false");
    el.newActionMenu?.classList.add("hidden");
    el.newActionButton?.setAttribute("aria-expanded", "false");
  }

  function updateNavigationForRole() {
    const technician = isTechnicianUser();
    document.querySelectorAll("[data-admin-nav]").forEach((node) => node.classList.toggle("hidden", technician));
    document.querySelectorAll("[data-tech-nav]").forEach((node) => node.classList.toggle("hidden", !technician));
    document.querySelectorAll("[data-admin-mobile]").forEach((node) => node.classList.toggle("hidden", technician));
    document.querySelectorAll("[data-tech-mobile]").forEach((node) => node.classList.toggle("hidden", !technician));
    document.querySelectorAll('[data-tech-nav][data-view="technician"], [data-tech-mobile][data-view="technician"]').forEach((node) => {
      node.textContent = technicianText("navDay");
    });
    document.querySelectorAll("[data-mobile-more-toggle]").forEach((node) => node.classList.toggle("hidden", false));
    el.mobileMoreMenu?.classList.toggle("hidden", true);
    el.mobileMoreButton?.setAttribute("aria-expanded", "false");
    el.moreMenuButton?.closest(".more-nav-wrap")?.classList.toggle("hidden", technician);
  }

  function setNavigationActive(view) {
    const groupedView = view === "routeplanner" ? "planning" : view;
    document.querySelectorAll("[data-view]").forEach((button) => {
      const target = button.dataset.view;
      const grouped = target === groupedView && !button.closest(".more-menu");
      button.classList.toggle("active", target === view || grouped);
    });
    const moreActive = !isTechnicianUser() && moreNavigationViews.includes(view);
    el.moreMenuButton?.classList.toggle("active", moreActive);
    el.mobileMoreButton?.classList.toggle("active", moreActive);
    document.querySelectorAll("[data-plan-tab-view]").forEach((button) => button.classList.toggle("active", button.dataset.planTabView === view));
  }

  function setView(view) {
    const requestedView = view || currentUser?.view || defaultViewForCurrentUser();
    const previousView = currentView;
    currentView = viewAllowedForCurrentUser(requestedView) ? requestedView : defaultViewForCurrentUser();
    closeFloatingMenus();
    setNavigationActive(currentView);
    document.querySelectorAll(".view").forEach((panel) => panel.classList.add("hidden"));
    document.getElementById(`${currentView}View`)?.classList.remove("hidden");
    if (previousView !== currentView && isMobileLayout()) {
      window.scrollTo({ left: 0, top: 0, behavior: "auto" });
    }
    const titles = {
      dashboard: ["Start", "Hva må følges opp nå."],
      customers: ["Kunder", "Søk, rediger og book kunder."],
      leads: ["Innboks", "Nettside, e-post, saker og oppfølging."],
      orders: ["Jobber", "Jobber fra oppfølging, kalender og utført arbeid."],
      insulation: ["Blåseisolering", "Kalkyle, dokumenter og kunder for iSOBYGG Buskerud."],
      planning: ["Plan", "Kalender for avtaler og jobber."],
      routeplanner: ["Servicerute", "Lag kjørbar rute av kunder som har svart ja."],
      technician: ["Min dag", "Jobbene dine på mobil."],
      settings: ["Innstillinger", "Brukere, roller og innlogging."],
    };
    if (currentView === "technician" && isTechnicianUser()) {
      el.viewTitle.textContent = technicianText("viewTitle");
      el.viewSubtitle.textContent = technicianText("viewSubtitle");
    } else {
      el.viewTitle.textContent = titles[currentView]?.[0] || "CRM";
      el.viewSubtitle.textContent = titles[currentView]?.[1] || "";
    }
    renderAll();
  }

  function openCustomerCard(customerId) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    selectedCustomerId = customerKey(customer);
    currentCustomerFilter = "all";
    currentSearch = "";
    if (el.statusFilter) el.statusFilter.value = "all";
    if (el.customerSearch) el.customerSearch.value = "";
    setView("customers");
  }

  function showBookingInPlanning(bookingId) {
    const row = bookingRows().find((item) => item.id === bookingId);
    if (!row) {
      setSyncStatus("Fant ikke bookingen i plan.", "error");
      return;
    }
    const date = new Date(`${row.booking.date}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      weekStart = startOfWeek(date);
      planningMonthCursor = date;
    }
    setView("planning");
    setSyncStatus(`${cleanDisplayName(row.customer)} ligger i planen ${formatDate(row.booking.date)}. Bruk Flytt eller dra jobben til ny dato.`, "ok");
  }

  function focusInboxComposer() {
    setLeadInboxTab("new");
    setView("leads");
    setTimeout(() => {
      document.querySelector(".ai-registration-panel")?.setAttribute("open", "");
      el.aiRegistrationPasteZone?.scrollIntoView({ behavior: "smooth", block: "start" });
      el.aiRegistrationInput?.focus();
    }, 0);
  }

  function handleNewAction(action) {
    closeFloatingMenus();
    if (action === "customer") {
      openCustomerDialog("");
      return;
    }
    if (action === "lead" || action === "paste") {
      focusInboxComposer();
      return;
    }
    if (action === "booking") {
      openBookingDialog("");
      return;
    }
    if (action === "service") {
      openBookingDialog("", "", { type: "service" });
      return;
    }
    if (action === "install") {
      openBookingDialog("", "", { type: "installasjon" });
      return;
    }
    if (action === "reminder") {
      openReminderDialog("");
      return;
    }
    if (action === "job") {
      setView("orders");
      setSyncStatus("Velg en kunde eller åpne et kundekort for å lage ny jobb. Book avtale brukes når du vil velge dato og tid med en gang.", "ok");
    }
  }

  function openBookingFromButton(button) {
    if (!button) return;
    const customer = findCustomer(button.dataset.bookCustomer);
    const installation = customer && button.dataset.bookInstallation
      ? installationsForCustomer(customer).find((item) => String(item.id || "") === String(button.dataset.bookInstallation))
      : null;
    openBookingDialog(button.dataset.bookCustomer, "", {
      type: button.dataset.bookType || "",
      installationId: installation?.id || "",
      note: installation ? installationBookingNote(installation, customer) : "",
    });
  }

  function legacyInstallationPrefill(customer) {
    if (!customer) return {};
    const serviceDates = [
      customer.last_service_date,
      ...(String(customer.service_dates || "").match(/\d{4}-\d{2}-\d{2}/g) || []),
    ].filter(Boolean).sort();
    const lastService = serviceDates.at(-1) || "";
    const intervalText = `${customer.service_interval || ""} ${customer.tags || ""}`;
    const serviceIntervalMonths = /årlig|arlig|1\s*år|1\s*ar/i.test(intervalText) ? 12 : 24;
    const fallbackLocation = fallbackCustomerLocation(customer) || {};
    const hasLocations = customerLocationsForCustomer(customer).length > 0;
    const notes = [
      "Opprettet fra serviceinfo på kundekortet. Kontroller modell, datoer og adresse før lagring.",
      customer.service_interval ? `Serviceintervall fra import: ${customer.service_interval}` : "",
      customer.service_dates ? `Tidligere servicedatoer: ${customer.service_dates}` : "",
    ].filter(Boolean);
    return {
      label: "Hovedanlegg",
      brand: customer.brand || "",
      model: customer.model_or_note || "",
      installed_at: customer.first_install_date || "",
      last_service_at: lastService,
      next_service_due: customer.next_service_due || addMonthsIsoDate(lastService, serviceIntervalMonths),
      service_interval_months: serviceIntervalMonths,
      notes: notes.join("\n"),
      forceNewLocation: !hasLocations,
      location_name: fallbackLocation.location_name || "Kundeadresse",
      address: fallbackLocation.address || "",
      postal_code: fallbackLocation.postal_code || "",
      city: fallbackLocation.city || "",
    };
  }

  function openInstallationFromButton(button) {
    if (!button) return;
    const customerId = button.dataset.newInstallationCustomer || "";
    const customer = findCustomer(customerId);
    const prefill = button.dataset.installationPrefill === "legacy"
      ? legacyInstallationPrefill(customer)
      : {};
    openInstallationDialog(customerId, "", Object.keys(prefill).length ? { prefill } : {});
  }

  function handleStartAction(action) {
    if (action === "inbox" || action === "followup") {
      setLeadInboxTab(action === "followup" ? "followup" : "new");
      setView("leads");
      return;
    }
    if (action === "today") {
      weekStart = startOfWeek(new Date());
      planningMonthCursor = new Date();
      setView("planning");
      return;
    }
    if (action === "service") {
      currentCustomerFilter = "due";
      if (el.statusFilter) el.statusFilter.value = "due";
      setView("customers");
      return;
    }
    if (action === "billing") {
      setView("dashboard");
      setTimeout(() => el.billingQueue?.closest(".panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      return;
    }
    if (action === "reminders") {
      setView("dashboard");
      setTimeout(() => el.reminderQueue?.closest(".panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      return;
    }
    if (action === "move") {
      setView("dashboard");
      setTimeout(() => el.moveQueue?.closest(".panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      return;
    }
    if (action === "quality") {
      const firstQuality = dataQualityRows()[0]?.id || "missing";
      currentCustomerFilter = firstQuality;
      currentSearch = "";
      if (el.statusFilter) el.statusFilter.value = firstQuality;
      if (el.customerSearch) el.customerSearch.value = "";
      setView("customers");
    }
  }

  function showPasswordResetMessage(message, tone = "error") {
    if (!el.passwordResetMessage) return;
    el.passwordResetMessage.textContent = message || "";
    el.passwordResetMessage.className = `dialog-message ${tone || ""}`.trim();
    el.passwordResetMessage.classList.toggle("hidden", !message);
  }

  function openPasswordResetDialog() {
    if (!el.passwordResetDialog) return;
    passwordRecoveryActive = true;
    el.passwordResetNew.value = "";
    el.passwordResetConfirm.value = "";
    showPasswordResetMessage("", "error");
    if (!el.passwordResetDialog.open) el.passwordResetDialog.showModal();
    setTimeout(() => el.passwordResetNew?.focus(), 0);
  }

  async function requestPasswordReset() {
    if (!store.isConfigured || !store.resetPassword) {
      el.loginMessage.textContent = "Passordreset krever Supabase-innlogging.";
      return;
    }
    const email = el.loginEmail.value.trim();
    if (!email) {
      el.loginMessage.textContent = "Skriv inn e-postadressen først.";
      el.loginEmail.focus();
      return;
    }
    const redirectTo = appPublicUrl("/");
    const previousText = el.forgotPasswordButton.textContent;
    el.forgotPasswordButton.disabled = true;
    el.forgotPasswordButton.textContent = "Sender...";
    try {
      await store.resetPassword(email, redirectTo);
      el.loginMessage.textContent = "Hvis e-posten finnes i CRM, kommer det en lenke for nytt passord.";
    } catch (error) {
      el.loginMessage.textContent = error.message || "Klarte ikke sende passordlenke.";
    } finally {
      el.forgotPasswordButton.disabled = false;
      el.forgotPasswordButton.textContent = previousText;
    }
  }

  async function savePasswordReset() {
    if (!store.updatePassword) throw new Error("Passordendring krever Supabase.");
    const password = el.passwordResetNew.value;
    const confirm = el.passwordResetConfirm.value;
    if (password.length < 10) throw new Error("Passordet må ha minst 10 tegn.");
    if (password !== confirm) throw new Error("Passordene er ikke like.");
    await store.updatePassword(password);
    passwordRecoveryActive = false;
    el.passwordResetDialog.close();
    if (window.history?.replaceState) window.history.replaceState(null, "", `${window.location.origin}${window.location.pathname}`);
    await refreshData("Passord oppdatert.");
  }

  function renderApp() {
    installHelpText();
    const missingProductionDatabase = !store.isConfigured && !demoEnabled;
    if (el.loginRemember) el.loginRemember.checked = localStorage.getItem(storage.rememberLogin) === "true";
    el.loginIntro.textContent = store.isConfigured
      ? "Logg inn med intern bruker fra Supabase."
      : demoEnabled
        ? "Lokal utviklingsdemo. Ikke bruk dette til ekte kundedata."
        : databaseUnavailableMessage;
    el.loginForm.classList.toggle("hidden", !store.isConfigured);
    const showDemoLogin = demoEnabled && !store.isConfigured;
    document.querySelector(".demo-label")?.classList.toggle("hidden", !showDemoLogin);
    document.querySelector(".demo-login-actions")?.classList.toggle("hidden", !showDemoLogin);
    document.querySelectorAll("[data-login]").forEach((button) => button.classList.toggle("hidden", !showDemoLogin));
    if (missingProductionDatabase && el.loginMessage) el.loginMessage.textContent = databaseUnavailableMessage;

    if (!currentUser) {
      el.loginView.classList.remove("hidden");
      el.appView.classList.add("hidden");
      el.appView.classList.remove("technician-mode");
      return;
    }
    el.loginView.classList.add("hidden");
    el.appView.classList.remove("hidden");
    el.currentUserName.textContent = currentUser.name;
    el.currentUserRole.textContent = currentUser.role;
    el.dataModePill.textContent = store.isConfigured ? "Supabase database" : "Lokal utviklingsdemo";
    el.dataModePill.classList.toggle("online", store.isConfigured);
    el.importSeedButton.classList.toggle("hidden", !(store.isConfigured && browserImportEnabled && isAdmin() && (rawData.customers || []).length));
    const technician = isTechnicianUser();
    el.appView.classList.toggle("technician-mode", technician);
    updateNavigationForRole();
    if (!viewAllowedForCurrentUser(currentView)) currentView = defaultViewForCurrentUser();
    el.newActionButton?.classList.toggle("hidden", technician);
    el.newCustomerButton?.classList.toggle("hidden", technician);
    el.newBookingButton?.classList.toggle("hidden", technician);
    setView(currentView || currentUser.view);
    installHelpText();
  }

  function renderAll() {
    renderDashboard();
    renderCustomers();
    renderLeads();
    renderOrders();
    renderInsulation();
    renderPlanning();
    renderRoutePlanner();
    renderTechnician();
    renderSettings();
  }

  function renderDashboard() {
    const activeCustomers = customers.filter((customer) => customer && !customer.is_inactive);
    const redCount = activeCustomers.filter((customer) => statusKind(customer) === "red").length;
    const yellowCount = activeCustomers.filter((customer) => statusKind(customer) === "yellow").length;
    const greenCount = activeCustomers.filter((customer) => statusKind(customer) === "green").length;
    const upcomingBookings = bookingRows().filter((row) => row.booking.date >= isoDate(new Date())).length;
    const moveRows = moveQueueRows();
    const billingRows = billingQueueRows();
    const reminderRows = activeReminderRows();
    const activeLeadCount = allLeadEntries().filter((entry) => !["won", "lost"].includes(leadStatusForEntry(entry))).length;
    const openWebsiteSubmissionCount = openWebsiteSubmissionRows().length;
    el.redMetric.textContent = redCount.toLocaleString("nb-NO");
    el.yellowMetric.textContent = yellowCount.toLocaleString("nb-NO");
    el.greenMetric.textContent = greenCount.toLocaleString("nb-NO");
    el.bookedMetric.textContent = bookingRows().length.toLocaleString("nb-NO");
    if (el.dashboardServiceCount) el.dashboardServiceCount.textContent = (redCount + yellowCount).toLocaleString("nb-NO");
    if (el.dashboardLeadCount) el.dashboardLeadCount.textContent = (activeLeadCount + openWebsiteSubmissionCount).toLocaleString("nb-NO");
    if (el.dashboardBookingCount) el.dashboardBookingCount.textContent = upcomingBookings.toLocaleString("nb-NO");
    if (el.dashboardMoveCount) el.dashboardMoveCount.textContent = moveRows.length.toLocaleString("nb-NO");
    if (el.dashboardBillingCount) el.dashboardBillingCount.textContent = billingRows.length.toLocaleString("nb-NO");
    if (el.dashboardReminderCount) el.dashboardReminderCount.textContent = reminderRows.length.toLocaleString("nb-NO");

    renderStartWorklist({
      redCount,
      yellowCount,
      activeLeadCount,
      openWebsiteSubmissionCount,
      moveCount: moveRows.length,
      billingCount: billingRows.length,
      reminderCount: reminderRows.length,
    });
    renderGlobalSearch();
    renderNextJobs();
    renderMoveQueue(moveRows);
    renderReminderQueue();

    el.dueCustomers.innerHTML = "";
    const dueList = activeCustomers
      .filter((item) => ["red", "yellow"].includes(statusKind(item)))
      .sort((a, b) => String(nextServiceDueForCustomer(a) || "9999-99-99").localeCompare(String(nextServiceDueForCustomer(b) || "9999-99-99")));
    for (const customer of dueList.slice(0, 12)) {
      const button = document.createElement("button");
      const installationLine = routeInstallationLine(customer);
      button.type = "button";
      button.dataset.customerId = customerKey(customer);
      button.innerHTML = `<span class="dot ${statusKind(customer)}"></span><strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong><span>${escapeHtml([installationLine, customer.location_tag || customer.visit_city || ""].filter(Boolean).join(" · "))}</span>`;
      el.dueCustomers.appendChild(button);
    }
    renderBillingQueue();
    renderDataQuality();
    renderRecentActivity();
    renderIntakeInbox();
  }

  function renderStartWorklist(counts = {}) {
    if (!el.startWorklist) return;
    const today = isoDate(new Date());
    const todayJobs = bookingRows().filter((row) => row.booking?.date === today && row.booking?.status !== "done");
    const followupCount = allLeadEntries().filter((entry) => ["followup", "needs_offer", "offer_sent"].includes(leadStatusForEntry(entry))).length;
    const qualityRows = dataQualityRows();
    const qualityCount = qualityRows.reduce((sum, row) => sum + row.count, 0);
    const items = [
      {
        action: "inbox",
        label: "Nye saker",
        count: (counts.activeLeadCount || 0) + (counts.openWebsiteSubmissionCount || 0),
        help: "Nettside, e-postutkast og saker som må avklares.",
      },
      {
        action: "followup",
        label: "Oppfølging",
        count: followupCount,
        help: "Kontakter, tilbud og svar som bør følges videre.",
      },
      {
        action: "today",
        label: "Dagens jobber",
        count: todayJobs.length,
        help: "Avtaler i kalenderen for i dag.",
      },
      {
        action: "reminders",
        label: "Påminnelser",
        count: counts.reminderCount || 0,
        help: "Raske huskelapper, telefonløfter og oppfølginger.",
      },
      {
        action: "billing",
        label: "Må faktureres",
        count: counts.billingCount || 0,
        help: "Utførte jobber som ikke er markert fakturert eller betalt.",
      },
      {
        action: "service",
        label: "Serviceoppfølging",
        count: (counts.redCount || 0) + (counts.yellowCount || 0),
        help: "Kunder/anlegg som kan kontaktes. Ikke booket før kunden har sagt ja eller adkomst finnes.",
      },
      {
        action: "move",
        label: "Må flyttes",
        count: counts.moveCount || 0,
        help: "Avtaler som må planlegges på nytt.",
      },
      {
        action: "quality",
        label: "Datakvalitet",
        count: qualityCount,
        help: qualityRows[0]?.label ? `Første ryddepunkt: ${qualityRows[0].label}.` : "Ingen tydelige varsler akkurat nå.",
      },
    ];
    el.startWorklist.innerHTML = items.map((item) => `
      <button data-start-action="${escapeHtml(item.action)}" type="button">
        <span>${escapeHtml(item.label)}</span>
        <strong>${Number(item.count || 0).toLocaleString("nb-NO")}</strong>
        <small>${escapeHtml(item.help)}</small>
      </button>
    `).join("");
  }

  function globalSearchMatches(text, query) {
    const terms = normalizeMatch(query).split(" ").filter(Boolean);
    if (!terms.length) return false;
    const haystack = normalizeMatch(text);
    const digits = String(text || "").replace(/\D/g, "");
    return terms.every((term) => {
      const termDigits = term.replace(/\D/g, "");
      return haystack.includes(term) || (termDigits && digits.includes(termDigits));
    });
  }

  function invoiceSearchRows() {
    const rows = [];
    const seen = new Set();
    for (const [key, list] of invoicesByCustomer.entries()) {
      const customer = findCustomer(key) || customers.find((item) => item.lime_id === key || item.legacy_lime_id === key);
      if (!customer) continue;
      for (const invoice of list || []) {
        const stable = [
          invoice.id,
          invoice.invoice_number,
          invoice.file_name,
          invoice.file_url,
          invoice.date || invoice.invoice_date,
          customerKey(customer),
        ].filter(Boolean).join("|");
        if (seen.has(stable)) continue;
        seen.add(stable);
        rows.push({ invoice, customer });
      }
    }
    return rows;
  }

  function globalSearchRows(query = globalSearchQuery) {
    if (!String(query || "").trim()) return [];
    const results = [];
    for (const customer of customers || []) {
      if (customer?.is_inactive) continue;
      const text = customerHaystack(customer);
      if (!globalSearchMatches(text, query)) continue;
      results.push({
        id: `customer:${customerKey(customer)}`,
        kind: "Kunde",
        title: cleanDisplayName(customer),
        meta: [customer.phone, customer.email, addressFor(customer) || customer.location_tag, customer.tags].filter(Boolean).join(" · "),
        customerId: customerKey(customer),
        searchText: text,
      });
    }
    for (const customer of customers || []) {
      if (customer?.is_inactive) continue;
      installationsForCustomer(customer).forEach((installation, index) => {
        const location = locationForInstallation(installation, customer);
        const text = [
          customerHaystack(customer),
          installation.label,
          installation.kind,
          installation.brand,
          installation.model,
          installation.serial_number,
          installation.notes,
          locationAddressText(location),
          installation.next_service_due,
          installation.installed_at,
        ].filter(Boolean).join(" ");
        if (!globalSearchMatches(text, query)) return;
        results.push({
          id: `installation:${customerKey(customer)}:${installation.id || index}`,
          kind: "Anlegg",
          title: installationDisplayName(installation),
          meta: [
            cleanDisplayName(customer),
            locationAddressText(location),
            installation.next_service_due ? `Neste service ${formatDate(installation.next_service_due)}` : "",
          ].filter(Boolean).join(" · "),
          customerId: customerKey(customer),
          installationId: installation.id || "",
          searchText: text,
        });
      });
    }
    for (const entry of allLeadEntries()) {
      const customer = entry.customer;
      const text = [
        customerHaystack(customer),
        entry.lead?.source,
        entry.lead?.source_detail,
        entry.lead?.product_interest,
        leadStatusLabel(leadStatusForEntry(entry)),
        leadNoteForEntry(entry),
      ].filter(Boolean).join(" ");
      if (!globalSearchMatches(text, query)) continue;
      results.push({
        id: `lead:${leadEntryKey(entry)}`,
        kind: "Lead",
        title: cleanDisplayName(customer),
        meta: [leadStatusLabel(leadStatusForEntry(entry)), customer.phone, addressFor(customer) || customer.visit_city].filter(Boolean).join(" · "),
        leadKey: leadEntryKey(entry),
        searchText: text,
      });
    }
    for (const row of openWebsiteSubmissionRows()) {
      const values = websiteSubmissionLeadValues(row);
      const text = [
        values.name,
        values.phone,
        values.email,
        values.address,
        values.city,
        values.product_interest,
        values.note,
        row?.public_reference,
        row?.idempotency_key,
        websiteSubmissionSourcePage(row),
      ].filter(Boolean).join(" ");
      if (!globalSearchMatches(text, query)) continue;
      results.push({
        id: `website:${row.id || row.public_reference || results.length}`,
        kind: "Nettside",
        title: values.name || row?.public_reference || "Nettsideinnsending",
        meta: [
          websiteSubmissionTypeLabel(row),
          values.phone,
          values.email,
          values.address || values.city,
          row?.public_reference,
        ].filter(Boolean).join(" · "),
        websiteSubmissionId: row.id,
        searchText: text,
      });
    }
    for (const row of orderRows()) {
      const text = orderSearchText(row);
      if (!globalSearchMatches(text, query)) continue;
      results.push({
        id: `order:${row.id}`,
        kind: "Jobb",
        title: row.order.title || defaultOrderTitle(row.customer, row.order.type),
        meta: [cleanDisplayName(row.customer), orderStatusLabel(orderEffectiveStatus(row.order, row.job, row.linkedBookings)), billingStatusLabel(orderEffectiveBillingStatus(row.order, row.job, row.linkedBookings))].filter(Boolean).join(" · "),
        orderId: row.id,
        searchText: text,
      });
    }
    for (const row of bookingRows()) {
      const text = [
        cleanDisplayName(row.customer),
        customerHaystack(row.customer),
        row.booking.type,
        row.booking.status,
        row.booking.note,
        row.booking.resource,
        row.booking.date,
        bookingJobLabel(row),
      ].filter(Boolean).join(" ");
      if (!globalSearchMatches(text, query)) continue;
      results.push({
        id: `booking:${row.id}`,
        kind: "Avtale",
        title: cleanDisplayName(row.customer),
        meta: [formatDate(row.booking.date), bookingTimeText(row.booking), row.booking.resource, bookingJobLabel(row)].filter(Boolean).join(" · "),
        bookingId: row.id,
        customerId: customerKey(row.customer),
        searchText: text,
      });
    }
    for (const { invoice, customer } of invoiceSearchRows()) {
      const text = [
        invoice.invoice_number,
        invoice.file_name,
        invoice.description,
        invoice.amount,
        invoice.date || invoice.invoice_date,
        customerHaystack(customer),
      ].filter(Boolean).join(" ");
      if (!globalSearchMatches(text, query)) continue;
      results.push({
        id: `invoice:${customerKey(customer)}:${invoice.id || invoice.invoice_number || invoice.file_name || results.length}`,
        kind: "Faktura",
        title: invoice.invoice_number ? `Faktura ${invoice.invoice_number}` : invoice.file_name || "Faktura",
        meta: [cleanDisplayName(customer), formatDate(invoice.date || invoice.invoice_date), invoice.amount ? formatMoney(invoice.amount) : ""].filter(Boolean).join(" · "),
        customerId: customerKey(customer),
        searchText: text,
      });
    }
    const rank = { Kunde: 0, Anlegg: 1, Lead: 2, Nettside: 3, Jobb: 4, Avtale: 5, Faktura: 6 };
    return results
      .sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9) || String(a.title || "").localeCompare(String(b.title || ""), "nb"))
      .slice(0, 18);
  }

  function globalSearchKindLabel(kind) {
    const labels = {
      Kunde: "Kundekort",
      Anlegg: "Anlegg",
      Lead: "Oppfølging",
      Nettside: "Nettsideinnsending",
      Jobb: "Jobb",
      Avtale: "Planlagt",
      Faktura: "Faktura",
    };
    return labels[kind] || kind || "Treff";
  }

  function globalSearchGroupLabel(kind) {
    const labels = {
      Kunde: "Kunder",
      Anlegg: "Varmepumper og anlegg",
      Lead: "Oppfølginger",
      Nettside: "Nye nettskjema",
      Jobb: "Jobber",
      Avtale: "Planlagte jobber",
      Faktura: "Fakturaer",
    };
    return labels[kind] || "Andre treff";
  }

  function globalSearchRowsHtml(rows) {
    let currentGroup = "";
    return rows.map((row) => {
      globalSearchResultCache.set(row.id, row);
      const group = globalSearchGroupLabel(row.kind);
      const heading = group !== currentGroup ? `<div class="global-search-group-title">${escapeHtml(group)}</div>` : "";
      currentGroup = group;
      return `
        ${heading}
        <button data-global-search-result="${escapeHtml(row.id)}" type="button" title="Åpne ${escapeHtml(globalSearchKindLabel(row.kind).toLowerCase())}">
          <span>${escapeHtml(globalSearchKindLabel(row.kind))}</span>
          <strong>${escapeHtml(row.title || "Uten navn")}</strong>
          <small>${escapeHtml(row.meta || "Ingen ekstra info")}</small>
        </button>
      `;
    }).join("");
  }

  function renderGlobalSearch() {
    if (!el.globalSearchResults) return;
    const query = globalSearchQuery || el.globalSearchInput?.value?.trim() || "";
    const searchFocused = document.activeElement === el.globalSearchInput;
    globalSearchResultCache.clear();
    if (!query) {
      el.globalSearchResults.innerHTML = "";
      el.globalSearchResults.classList.add("hidden");
      return;
    }
    el.globalSearchResults.classList.toggle("hidden", !searchFocused);
    if (normalizeMatch(query).length < 2) {
      el.globalSearchResults.innerHTML = `<div class="empty-state compact">Skriv minst to tegn.</div>`;
      return;
    }
    const rows = globalSearchRows(query);
    if (!rows.length) {
      el.globalSearchResults.innerHTML = `<div class="empty-state compact">Ingen treff på "${escapeHtml(query)}".</div>`;
      return;
    }
    el.globalSearchResults.innerHTML = `
      <div class="global-search-count">${rows.length.toLocaleString("nb-NO")} treff</div>
      ${globalSearchRowsHtml(rows)}
    `;
  }

  function hideGlobalSearchResults() {
    el.globalSearchResults?.classList.add("hidden");
  }

  function clearGlobalSearch() {
    globalSearchQuery = "";
    if (el.globalSearchInput) el.globalSearchInput.value = "";
    if (el.globalSearchResults) el.globalSearchResults.innerHTML = "";
    hideGlobalSearchResults();
  }

  function openFirstGlobalSearchResult() {
    const query = globalSearchQuery || el.globalSearchInput?.value?.trim() || "";
    if (normalizeMatch(query).length < 2) return false;
    const rows = globalSearchRows(query);
    rows.forEach((row) => globalSearchResultCache.set(row.id, row));
    const first = rows[0];
    if (!first) return false;
    openGlobalSearchResult(first.id);
    hideGlobalSearchResults();
    el.globalSearchInput?.blur();
    return true;
  }

  function scrollSelectedWebsiteSubmissionIntoView() {
    if (!selectedWebsiteSubmissionId || !el.websiteSubmissionInbox) return;
    const card = el.websiteSubmissionInbox.querySelector(`[data-website-submission-card="${CSS.escape(selectedWebsiteSubmissionId)}"]`);
    if (!card) return;
    card.scrollIntoView({ block: "center", behavior: "smooth" });
    card.focus({ preventScroll: true });
  }

  function handleGlobalSearchKeydown(event) {
    if (event.key === "Escape") {
      if (globalSearchQuery || el.globalSearchInput?.value || !el.globalSearchResults?.classList.contains("hidden")) {
        event.preventDefault();
        clearGlobalSearch();
      }
      return;
    }
    if (event.key === "Enter") {
      if (openFirstGlobalSearchResult()) event.preventDefault();
    }
  }

  function openGlobalSearchResult(id) {
    const row = globalSearchResultCache.get(id);
    if (!row) return;
    if (row.kind === "Kunde" || row.kind === "Anlegg" || row.kind === "Faktura") {
      openCustomerCard(row.customerId);
      if (row.kind === "Anlegg") setSyncStatus(`Åpnet kundekort for ${row.title}.`, "ok");
      return;
    }
    if (row.kind === "Lead") {
      selectedLeadId = row.leadKey;
      currentLeadFilter = "all";
      currentLeadSearch = "";
      if (el.leadStatusFilter) el.leadStatusFilter.value = "all";
      if (el.leadSearch) el.leadSearch.value = "";
      setView("leads");
      return;
    }
    if (row.kind === "Nettside") {
      currentLeadFilter = "inbox_tab";
      currentLeadSearch = "";
      setLeadInboxTab("website");
      selectedWebsiteSubmissionId = row.websiteSubmissionId || "";
      if (el.leadStatusFilter) el.leadStatusFilter.value = "inbox_tab";
      if (el.leadSearch) el.leadSearch.value = "";
      setView("leads");
      requestAnimationFrame(scrollSelectedWebsiteSubmissionIntoView);
      if (selectedWebsiteSubmissionId) setSyncStatus(`Åpnet nettsideinnsending for ${row.title || "valgt treff"}.`, "ok");
      return;
    }
    if (row.kind === "Jobb") {
      selectedOrderId = row.orderId;
      currentOrderFilter = "all";
      currentOrderSearch = "";
      if (el.orderStatusFilter) el.orderStatusFilter.value = "all";
      if (el.orderSearch) el.orderSearch.value = "";
      setView("orders");
      return;
    }
    if (row.kind === "Avtale") {
      const linked = linkedOrderForBooking(row.bookingId);
      if (linked?.id) {
        selectedOrderId = linked.id;
        currentOrderFilter = "all";
        if (el.orderStatusFilter) el.orderStatusFilter.value = "all";
        setView("orders");
        return;
      }
      showBookingInPlanning(row.bookingId);
    }
  }

  function renderBillingQueue() {
    if (!el.billingQueue) return;
    el.billingQueue.innerHTML = "";
    const rows = billingQueueRows().slice(0, 12);
    if (!rows.length) {
      el.billingQueue.innerHTML = `<div class="empty-state">Ingen jobber venter på fakturering.</div>`;
      return;
    }
    for (const row of rows) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.billingCustomer = customerKey(row.customer);
      button.dataset.billingBooking = row.id;
      const label = bookingNeedsCashPayment(row) ? "Betaling ikke registrert" : bookingNeedsInvoice(row) ? "Må faktureres" : "Dato passert";
      const kind = bookingNeedsPaymentAction(row) ? "yellow" : "red";
      button.innerHTML = `
        <span class="dot ${kind}"></span>
        <strong>${escapeHtml(cleanDisplayName(row.customer))}</strong>
        <span>${escapeHtml(label)} · ${formatDate(row.booking.date)} · ${escapeHtml(bookingJobLabel(row))}</span>
      `;
      el.billingQueue.appendChild(button);
    }
  }

  function profileRoleLabel(role) {
    return role === "admin" ? "Admin" : "Tekniker";
  }

  function renderOfferTemplateSettings() {
    if (!el.offerTemplateSettings) return;
    if (!isAdmin()) {
      el.offerTemplateSettings.innerHTML = "";
      return;
    }
    const settings = offerSettings();
    const canSave = Boolean(store.isConfigured && store.saveCrmSetting);
    const disabled = canSave ? "" : "disabled";
    el.offerTemplateSettings.innerHTML = `
      <section class="settings-section">
        <div class="section-head compact">
          <div>
            <h3>Tilbudsmaler og priser</h3>
            <p>Rediger tekstene som brukes i Innboks/tilbud. Prisgrunnlaget brukes i flere maler.</p>
          </div>
          <div class="mini-action-row">
            <button class="secondary" data-reset-offer-settings type="button">Standardtekst</button>
            <button data-save-offer-settings type="button" ${disabled}>Lagre</button>
          </div>
        </div>
        ${canSave ? "" : `<p class="form-hint">Lagring av maler krever Supabase og crm_settings-tabellen.</p>`}
        <label class="check-row"><input data-offer-settings-auto-email type="checkbox" ${settings.autoEmailEnabled ? "checked" : ""} ${disabled} /> Aktiver direkte sending fra CRM</label>
        <p class="form-hint">Direkte sending er testet med Google Workspace. Slå den bare av ved e-postfeil eller vedlikehold.</p>
        <div class="offer-template-editor-list">
          ${Object.entries(leadTemplates).map(([id, template]) => {
            const override = settings.templateOverrides?.[id] || {};
            const subject = String(override.subject || defaultLeadTemplateSubject(id));
            const body = String(override.body || defaultLeadTemplateBodyForSettings(id));
            const changed = String(override.subject || "").trim() || String(override.body || "").trim();
            return `
              <details class="offer-template-editor" data-offer-settings-template="${escapeHtml(id)}">
                <summary>
                  <strong>${escapeHtml(template.title)}</strong>
                  <span>${escapeHtml(changed ? "Tilpasset" : "Standard")}</span>
                </summary>
                <label>Emne
                  <input data-offer-settings-template-subject="${escapeHtml(id)}" value="${escapeHtml(subject)}" ${disabled} />
                </label>
                <label>Tekst
                  <textarea data-offer-settings-template-body="${escapeHtml(id)}" rows="10" ${disabled}>${escapeHtml(body)}</textarea>
                </label>
                <div class="mini-action-row">
                  <button class="secondary" data-reset-one-offer-template="${escapeHtml(id)}" type="button" ${disabled}>Tilbakestill denne</button>
                </div>
              </details>
            `;
          }).join("")}
        </div>
        <label>Prisgrunnlag / standard montering og tillegg
          <textarea data-offer-settings-prices rows="16" ${disabled}>${escapeHtml(settings.priceTermsText)}</textarea>
        </label>
        <p class="form-hint">Plassholdere: {fornavn}, {navn}, {adresse}, {prisgrunnlag}. Aktiv prisliste kan hukes av i tilbudsboksen og legges inn som PDF-lenke i e-postteksten.</p>
      </section>
    `;
  }

  function renderEaccountingCatalogSettings() {
    if (!el.eaccountingCatalogSettings) return;
    if (!isAdmin()) {
      el.eaccountingCatalogSettings.innerHTML = "";
      return;
    }
    const rows = eaccountingProductRows();
    const heatPumpCount = rows.filter((row) => /^91/.test(String(row.articleNo))).length;
    const serviceCount = rows.filter((row) => row.type === "Tjeneste").length;
    const goodsCount = rows.filter((row) => row.type === "Vare").length;
    el.eaccountingCatalogSettings.innerHTML = `
      <section class="settings-section">
        <div class="section-head compact">
          <div>
            <h3>eAccounting produktliste</h3>
            <p>Last ned CRM-varene med varenummer, pris og gruppe. Brukes til import/kontroll i eAccounting.</p>
          </div>
          <div class="mini-action-row">
            <button class="secondary" data-download-eaccounting-products type="button">Last ned CSV</button>
          </div>
        </div>
        <div class="legacy-tag-summary">
          <article>
            <strong>${rows.length.toLocaleString("nb-NO")}</strong>
            <span>CRM-varer</span>
          </article>
          <article>
            <strong>${heatPumpCount.toLocaleString("nb-NO")}</strong>
            <span>Varmepumper</span>
          </article>
          <article>
            <strong>${serviceCount.toLocaleString("nb-NO")} / ${goodsCount.toLocaleString("nb-NO")}</strong>
            <span>Tjenester / varer</span>
          </article>
        </div>
        <p class="form-hint">CSV-en bruker egne CRM-varenummer og produktgruppe CRM. Priser er med baade inkl. og eks. mva for trygg kontroll ved import.</p>
      </section>
    `;
  }

  function renderSettings() {
    if (!el.settingsAccessSummary || !el.profileList) return;
    const admin = isAdmin();
    const activeProfiles = (profiles || []).filter((profile) => profile.active !== false);
    const adminCount = activeProfiles.filter((profile) => profile.role === "admin").length;
    const technicianCount = activeProfiles.filter((profile) => profile.role === "technician").length;
    el.settingsAccessSummary.innerHTML = `
      <article>
        <strong>${adminCount.toLocaleString("nb-NO")}</strong>
        <span>Aktive admin</span>
      </article>
      <article>
        <strong>${technicianCount.toLocaleString("nb-NO")}</strong>
        <span>Aktive teknikere</span>
      </article>
      <article>
        <strong>${store.isConfigured ? "Supabase" : "Demo"}</strong>
        <span>${store.isConfigured ? "Innlogging og roller styres mot databasen" : "Lokal demo viser bare testbrukere"}</span>
      </article>
    `;
    renderOfferTemplateSettings();
    renderEaccountingCatalogSettings();
    renderTagSettings();
    if (!admin) {
      el.profileList.innerHTML = `<div class="empty-state">Bare admin kan endre brukerroller.</div>`;
      return;
    }
    const rows = [...(profiles || [])].sort((a, b) => (
      (a.active === false) - (b.active === false)
      || String(a.display_name || a.full_name || "").localeCompare(String(b.display_name || b.full_name || ""), "nb")
    ));
    if (!rows.length) {
      el.profileList.innerHTML = `<div class="empty-state">Ingen CRM-profiler funnet.</div>`;
      return;
    }
    el.profileList.innerHTML = rows.map((profile) => {
      const id = String(profile.id || "");
      const name = profile.full_name || profile.display_name || "Uten navn";
      const self = (currentUser?.id && String(currentUser.id) === id) || (currentUser?.key && String(currentUser.key) === id);
      const canEdit = ((store.isConfigured && store.saveProfile) || canUseLocalDemo()) && !self;
      const disabled = canEdit ? "" : "disabled";
      const active = profile.active !== false;
      const prefs = profilePreferences(profile);
      const resourceStatus = active ? "Synlig i planlegging og booking" : "Skjult til brukeren aktiveres";
      return `
        <article class="${active ? "" : "inactive"}" data-profile-row="${escapeHtml(id)}">
          <div>
            <strong>${escapeHtml(name)}${self ? ` <span class="profile-self">Deg</span>` : ""}</strong>
            <span>${escapeHtml(profileRoleLabel(profile.role))}${active ? "" : " · Inaktiv"} · ${escapeHtml(resourceStatus)}</span>
          </div>
          <label>Navn<input data-profile-name="${escapeHtml(id)}" value="${escapeHtml(name)}" ${disabled} /></label>
          <label>Telefon<input data-profile-phone="${escapeHtml(id)}" value="${escapeHtml(profile.phone || "")}" ${disabled} /></label>
          <label>Rolle
            <select data-profile-role="${escapeHtml(id)}" ${disabled}>
              <option value="technician" ${profile.role === "technician" ? "selected" : ""}>Tekniker</option>
              <option value="admin" ${profile.role === "admin" ? "selected" : ""}>Admin</option>
            </select>
          </label>
          <label>Språk
            <select data-profile-language="${escapeHtml(id)}" ${disabled}>
              ${profileLanguageOptionsHtml(prefs.language)}
            </select>
          </label>
          <label class="check-row profile-active"><input data-profile-active="${escapeHtml(id)}" type="checkbox" ${active ? "checked" : ""} ${disabled} /> Aktiv</label>
          <label class="check-row profile-active"><input data-profile-extra-help="${escapeHtml(id)}" type="checkbox" ${prefs.extraHelp ? "checked" : ""} ${disabled} /> Ekstra forklaring for tekniker</label>
          <button data-save-profile="${escapeHtml(id)}" type="button" ${canEdit ? "" : "disabled"}>${self ? "Egen profil" : "Lagre"}</button>
        </article>
      `;
    }).join("");
  }

  function tagUsageRows(filter) {
    const usage = new Map();
    for (const customer of customers || []) {
      if (!customer || customer.is_inactive) continue;
      const seenForCustomer = new Set();
      for (const tag of splitTags(customer.tags)) {
        if (filter && !filter(tag)) continue;
        const label = canonicalTagLabel(tag);
        const key = tagIdentity(label);
        if (!key || seenForCustomer.has(key)) continue;
        seenForCustomer.add(key);
        const row = usage.get(key) || { tag: label, count: 0, kind: legacyTagKind(label), variants: new Set() };
        row.count += 1;
        row.variants.add(tag);
        usage.set(key, row);
      }
    }
    return [...usage.values()]
      .map((row) => ({ ...row, variants: [...row.variants].map(canonicalTagLabel).filter((tag, index, list) => list.indexOf(tag) === index) }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "nb-NO"));
  }

  function customerTagUsageRows() {
    return tagUsageRows((tag) => !isLegacyImportTag(tag));
  }

  function hiddenCustomerTagUsageRows() {
    return tagUsageRows((tag) => isLegacyImportTag(tag));
  }

  function customersWithTag(tag) {
    const wanted = tagIdentity(tag);
    return (customers || []).filter((customer) => splitTags(customer.tags).some((item) => tagIdentity(item) === wanted));
  }

  async function saveProfileFromSettings(profileId) {
    if (!isAdmin()) throw new Error("Bare admin kan endre brukerroller.");
    if (!store.saveProfile && !canUseLocalDemo()) throw new Error("Brukerroller krever Supabase.");
    if ((currentUser?.id && String(currentUser.id) === String(profileId)) || (currentUser?.key && String(currentUser.key) === String(profileId))) {
      throw new Error("Egen rolle/aktiv-status må endres av en annen admin.");
    }
    const row = el.profileList?.querySelector(`[data-profile-row="${CSS.escape(profileId)}"]`);
    if (!row) throw new Error("Fant ikke profilen som skulle lagres.");
    const name = row.querySelector(`[data-profile-name="${CSS.escape(profileId)}"]`)?.value?.trim() || "";
    const phone = row.querySelector(`[data-profile-phone="${CSS.escape(profileId)}"]`)?.value?.trim() || "";
    const role = row.querySelector(`[data-profile-role="${CSS.escape(profileId)}"]`)?.value === "admin" ? "admin" : "technician";
    const active = Boolean(row.querySelector(`[data-profile-active="${CSS.escape(profileId)}"]`)?.checked);
    const language = row.querySelector(`[data-profile-language="${CSS.escape(profileId)}"]`)?.value || "nb";
    const extraHelp = Boolean(row.querySelector(`[data-profile-extra-help="${CSS.escape(profileId)}"]`)?.checked);
    if (!name) throw new Error("Navn kan ikke være tomt.");
    const patch = {
      display_name: name,
      full_name: name,
      phone,
      role,
      active,
    };
    const existing = profiles.find((profile) => String(profile.id) === String(profileId)) || {};
    const saved = store.isConfigured && store.saveProfile
      ? await store.saveProfile(profileId, patch)
      : { ...existing, id: profileId, ...patch };
    await saveProfilePreferences(profileId, { language, extraHelp });
    const index = profiles.findIndex((profile) => String(profile.id) === String(saved.id));
    if (index >= 0) profiles[index] = saved;
    else profiles.push(saved);
    updateResourceSelects();
    renderSettings();
    setSyncStatus("Brukerprofil oppdatert.", "ok");
  }

  async function saveOfferSettingsFromSettings() {
    if (!isAdmin()) throw new Error("Bare admin kan endre tilbudsmaler.");
    if (!store.saveCrmSetting) throw new Error("Lagring av tilbudsmaler krever Supabase.");
    const container = el.offerTemplateSettings;
    const templateOverrides = {};
    container?.querySelectorAll("[data-offer-settings-template]").forEach((row) => {
      const id = row.dataset.offerSettingsTemplate || "";
      if (!leadTemplates[id]) return;
      const subject = row.querySelector(`[data-offer-settings-template-subject="${CSS.escape(id)}"]`)?.value?.trim() || "";
      const body = row.querySelector(`[data-offer-settings-template-body="${CSS.escape(id)}"]`)?.value || "";
      const defaultSubject = defaultLeadTemplateSubject(id);
      const defaultBody = defaultLeadTemplateBodyForSettings(id);
      const changedSubject = subject && subject !== defaultSubject;
      const changedBody = body.trim() && body !== defaultBody;
      if (changedSubject || changedBody) {
        templateOverrides[id] = {
          subject: changedSubject ? subject : defaultSubject,
          body: changedBody ? body : defaultBody,
        };
      }
    });
    const generalOverride = templateOverrides.general_price_offer || {};
    const next = {
      generalOfferSubject: generalOverride.subject || "Pristilbud på varmepumpe og tilleggsarbeid",
      generalOfferBody: generalOverride.body || defaultGeneralOfferBody(),
      priceTermsText: normalizeOfferPriceTermsText(container?.querySelector("[data-offer-settings-prices]")?.value || defaultOfferPriceTermsText()),
      autoEmailEnabled: Boolean(container?.querySelector("[data-offer-settings-auto-email]")?.checked),
      templateOverrides,
    };
    const saved = await store.saveCrmSetting("offer_settings", next);
    crmSettings.offer_settings = saved?.value || next;
    renderSettings();
    renderLeadDetail();
    setSyncStatus("Tilbudsmaler og prisgrunnlag lagret.", "ok");
  }

  function resetOfferSettingsForm() {
    const container = el.offerTemplateSettings;
    const prices = container?.querySelector("[data-offer-settings-prices]");
    const autoEmail = container?.querySelector("[data-offer-settings-auto-email]");
    if (autoEmail) autoEmail.checked = false;
    container?.querySelectorAll("[data-offer-settings-template]").forEach((row) => {
      const id = row.dataset.offerSettingsTemplate || "";
      resetOneOfferTemplateForm(id);
    });
    if (prices) prices.value = defaultOfferPriceTermsText();
    setSyncStatus("Standard tilbudstekst er fylt inn. Trykk Lagre for å bruke den videre.", "ok");
  }

  function resetOneOfferTemplateForm(templateId) {
    const container = el.offerTemplateSettings;
    if (!container || !leadTemplates[templateId]) return;
    const row = container.querySelector(`[data-offer-settings-template="${CSS.escape(templateId)}"]`);
    const subject = container.querySelector(`[data-offer-settings-template-subject="${CSS.escape(templateId)}"]`);
    const body = container.querySelector(`[data-offer-settings-template-body="${CSS.escape(templateId)}"]`);
    if (subject) subject.value = defaultLeadTemplateSubject(templateId);
    if (body) body.value = defaultLeadTemplateBodyForSettings(templateId);
    const stateLabel = row?.querySelector("summary span");
    if (stateLabel) stateLabel.textContent = "Standard";
  }

  function renderTagSettings() {
    if (!el.tagSettings) return;
    if (!isAdmin()) {
      el.tagSettings.innerHTML = "";
      return;
    }
    const rows = customerTagUsageRows();
    const hiddenRows = hiddenCustomerTagUsageRows();
    const hiddenCustomerCount = (customers || []).filter((customer) => (
      customer && !customer.is_inactive && splitTags(customer.tags).some((tag) => isLegacyImportTag(tag))
    )).length;
    const hiddenLeadCount = hiddenRows.filter((row) => isLegacyLeadTag(row.tag)).reduce((sum, row) => sum + row.count, 0);
    const canSave = Boolean(store.isConfigured ? store.saveCustomer : demoEnabled);
    el.tagSettings.innerHTML = `
      <section class="settings-section">
        <div class="section-head compact">
          <div>
            <h3>Tagger</h3>
            <p>Rydd vanlige tagger. Gamle importtagger skjules fra kundekort og kartotek.</p>
          </div>
        </div>
        <div class="legacy-tag-summary">
          <article>
            <strong>${hiddenRows.length.toLocaleString("nb-NO")}</strong>
            <span>Skjulte importtagger</span>
          </article>
          <article>
            <strong>${hiddenCustomerCount.toLocaleString("nb-NO")}</strong>
            <span>Kundekort med skjulte importtagger</span>
          </article>
          <article>
            <strong>${hiddenLeadCount.toLocaleString("nb-NO")}</strong>
            <span>Gamle status-tagger skjult</span>
          </article>
        </div>
        ${hiddenRows.length ? `
          <details class="legacy-tag-details">
            <summary>Mest brukte skjulte importtagger</summary>
            <div class="legacy-tag-list">
              ${hiddenRows.slice(0, 12).map((row) => `
                <span title="Skjules i kundekort og taggkartotek. Ikke slettet fra historiske data.">
                  <strong>${escapeHtml(row.tag)}</strong>
                  <small>${escapeHtml(row.kind)} · ${row.count.toLocaleString("nb-NO")} kundekort</small>
                </span>
              `).join("")}
            </div>
          </details>
        ` : ""}
        ${rows.length ? `
          <div class="tag-settings-list">
            ${rows.map((row) => `
              <article data-tag-settings-row="${escapeHtml(row.tag)}">
                <div>
                  <strong>${escapeHtml(row.tag)}</strong>
                  <span>${row.count.toLocaleString("nb-NO")} kundekort</span>
                </div>
                <input data-tag-rename-input="${escapeHtml(row.tag)}" value="${escapeHtml(row.tag)}" ${canSave ? "" : "disabled"} />
                <div class="mini-action-row">
                  <button data-rename-tag="${escapeHtml(row.tag)}" type="button" ${canSave ? "" : "disabled"} title="Gi taggen nytt navn på alle kundekort som bruker den.">Gi nytt navn</button>
                  <button class="secondary danger" data-delete-tag="${escapeHtml(row.tag)}" type="button" ${canSave ? "" : "disabled"} title="Fjern taggen fra alle kundekort.">Slett</button>
                </div>
              </article>
            `).join("")}
          </div>
        ` : `<div class="empty-state">Ingen egendefinerte tagger å rydde.</div>`}
      </section>
    `;
  }

  async function saveCustomerTagsFromSettings(customer, tags) {
    if (!customer) return null;
    const nextTags = uniqueTags(tags);
    const updated = { ...customer, tags: nextTags };
    if (store.isConfigured) {
      const saved = await store.saveCustomer(updated);
      const index = customers.findIndex((item) => customerKey(item) === customerKey(saved));
      if (index >= 0) customers[index] = saved;
      return saved;
    }
    requireLocalDemoStorage();
    Object.assign(customer, updated);
    const key = customerKey(customer);
    customerEdits[key] = { ...(customerEdits[key] || {}), tags: nextTags };
    saveLocalEdits();
    return customer;
  }

  async function renameCustomerTagFromSettings(oldTag, newTag) {
    if (!isAdmin()) throw new Error("Bare admin kan endre tagger.");
    const cleanOld = String(oldTag || "").trim();
    const cleanNew = String(newTag || "").trim();
    if (!cleanOld) throw new Error("Fant ikke taggen som skulle endres.");
    if (!cleanNew) throw new Error("Ny tagg kan ikke være tom.");
    if (normalizeMatch(cleanOld) === normalizeMatch(cleanNew)) {
      setSyncStatus("Taggen er uendret.", "ok");
      return;
    }
    const affected = customersWithTag(cleanOld);
    for (const customer of affected) {
      const next = splitTags(customer.tags).map((tag) => normalizeMatch(tag) === normalizeMatch(cleanOld) ? cleanNew : tag);
      await saveCustomerTagsFromSettings(customer, next);
    }
    renderAll();
    setSyncStatus(`Taggen "${cleanOld}" ble endret til "${cleanNew}" på ${affected.length.toLocaleString("nb-NO")} kundekort.`, "ok");
  }

  async function deleteCustomerTagFromSettings(tag) {
    if (!isAdmin()) throw new Error("Bare admin kan slette tagger.");
    const cleanTag = String(tag || "").trim();
    if (!cleanTag) return;
    const affected = customersWithTag(cleanTag);
    if (!affected.length) {
      setSyncStatus("Taggen var ikke i bruk.", "ok");
      renderTagSettings();
      return;
    }
    const ok = await askForConfirmation({
      title: "Slett tagg",
      message: `Fjerne taggen "${cleanTag}" fra ${affected.length.toLocaleString("nb-NO")} kundekort? Kundene slettes ikke.`,
      confirmLabel: "Fjern tagg",
      tone: "danger",
    });
    if (!ok) return;
    for (const customer of affected) {
      const next = splitTags(customer.tags).filter((item) => normalizeMatch(item) !== normalizeMatch(cleanTag));
      await saveCustomerTagsFromSettings(customer, next);
    }
    renderAll();
    setSyncStatus(`Taggen "${cleanTag}" ble fjernet fra ${affected.length.toLocaleString("nb-NO")} kundekort.`, "ok");
  }

  function renderMoveQueue(rows = moveQueueRows()) {
    if (!el.moveQueue) return;
    el.moveQueue.innerHTML = "";
    const visible = rows.slice(0, 12);
    if (!visible.length) {
      el.moveQueue.innerHTML = `<div class="empty-state">Ingen jobber er markert som må flyttes.</div>`;
      return;
    }
    for (const row of visible) {
      const card = document.createElement("article");
      card.className = "compact-action-card move";
      card.innerHTML = `
        <div>
          <strong>${escapeHtml(cleanDisplayName(row.customer))}</strong>
          <span>${escapeHtml(formatDate(row.booking.date))} kl. ${escapeHtml(bookingTimeText(row.booking))} · ${escapeHtml(row.booking.resource || "")} · ${escapeHtml(bookingJobLabel(row))}</span>
          <small>${escapeHtml(bookingMoveReason(row) || "Jobben må avtales på nytt.")}</small>
        </div>
        <div class="mini-action-row">
          <button data-edit-move-booking="${escapeHtml(row.id)}" type="button" title="Åpne bookingen og sett ny dato eller nytt tidspunkt.">Flytt</button>
          <button class="secondary" data-show-move-booking="${escapeHtml(row.id)}" type="button" title="Gå til uken der jobben ligger i plan.">Vis i plan</button>
        </div>
      `;
      el.moveQueue.appendChild(card);
    }
  }

  function intakeItemFinal(row) {
    return row?.final_json && typeof row.final_json === "object" ? row.final_json : {};
  }

  function intakeItemTitle(row) {
    const final = intakeItemFinal(row);
    return final.name
      || row?.analysis_json?.contacts?.[0]?.name?.value
      || row?.analysis_json?.contacts?.[0]?.name
      || row?.source_subject
      || row?.public_reference
      || "Ubehandlet tekst";
  }

  function intakeItemSummary(row) {
    const final = intakeItemFinal(row);
    const attachmentCount = attachmentsForIntake(row?.id).length || Number(final.attachment_count || row?.analysis_json?.attachment_count || 0);
    return [
      final.type ? aiRegistrationTypeLabel(final.type) : "",
      final.phone || "",
      final.email || "",
      [final.street, final.zip, final.city].filter(Boolean).join(", "),
      attachmentCount ? `${attachmentCount.toLocaleString("nb-NO")} vedlegg` : "",
      row?.status || "needs_review",
    ].filter(Boolean).join(" · ") || String(row?.raw_text || row?.extracted_text || "").slice(0, 140);
  }

  function intakeItemEmailReference(row) {
    const source = row?.analysis_json?.source || {};
    return String(
      source.emailReference
      || row?.email_reference
      || row?.final_json?.emailReference
      || extractEmailReference(row?.source_subject, row?.raw_text, row?.extracted_text, row?.final_json?.note)
      || "",
    ).toUpperCase();
  }

  function intakeLinkedLeadEntry(row) {
    const linkedLeadId = String(row?.linked_lead_id || row?.analysis_json?.source?.matchedLeadId || "").trim();
    if (!linkedLeadId) return null;
    return allLeadEntries().find((entry) => String(entry?.lead?.id || "") === linkedLeadId) || null;
  }

  function intakeLinkedCustomer(row) {
    const linkedCustomerId = String(row?.linked_customer_id || row?.analysis_json?.source?.matchedCustomerId || "").trim();
    return (linkedCustomerId ? findCustomer(linkedCustomerId) : null) || intakeLinkedLeadEntry(row)?.customer || null;
  }

  function intakeLinkHintsHtml(row) {
    const reference = intakeItemEmailReference(row);
    const customer = intakeLinkedCustomer(row);
    const linkedLead = intakeLinkedLeadEntry(row);
    const hints = [];
    if (reference) hints.push(`CRM-ref ${reference}`);
    if (customer) hints.push(`Koblet til ${cleanDisplayName(customer)}`);
    else if (linkedLead?.lead?.id) hints.push("Koblet til salgsmulighet");
    if (!hints.length) return "";
    return `<div class="intake-link-hints" title="Funnet fra e-postreferanse eller tidligere CRM-aktivitet. Kontroller før lagring.">${hints.map((hint) => `<span>${escapeHtml(hint)}</span>`).join("")}</div>`;
  }

  function aiRegistrationLinkHintHtml(draft) {
    const reference = String(draft?.emailReference || "").trim();
    const customer = draft?.linkedCustomerId ? findCustomer(draft.linkedCustomerId) : null;
    const linkedLead = draft?.linkedLeadId ? allLeadEntries().find((entry) => String(entry?.lead?.id || "") === String(draft.linkedLeadId)) : null;
    const target = customer || linkedLead?.customer || null;
    if (!reference && !target && !draft?.linkedLeadId) return "";
    return `
      <div class="ai-link-hint" title="Utkastet har foreslått kobling fra CRM-innboksen. Kontroller koblingen før du lagrer.">
        <strong>${reference ? `CRM-ref ${escapeHtml(reference)}` : "Kobling fra innboks"}</strong>
        <span>${escapeHtml(target ? `Foreslått koblet til ${cleanDisplayName(target)}` : "Foreslått koblet til salgsmulighet")}</span>
      </div>
    `;
  }

  function openIntakeRows() {
    return (intakeItems || []).filter((row) => ["draft", "needs_review", "ready", "failed"].includes(row.status || "needs_review"));
  }

  function intakeItemSourceKind(row) {
    const text = normalizeMatch([
      row?.source_channel,
      row?.source_subject,
      row?.raw_text,
      row?.extracted_text,
    ].filter(Boolean).join(" "));
    if (/e-post|e post|epost|email|gmail|mail|innboks/i.test(text)) return "email";
    if (/nettside|website|webskjema|skjema|contact form|kontaktform|kontaktskjema/i.test(text)) return "website";
    return "manual";
  }

  function intakeRowsForInboxTab(tab = currentLeadInboxTab) {
    const rows = openIntakeRows();
    if (currentLeadFilter !== "inbox_tab") return [];
    if (tab === "new") return rows;
    if (tab === "email") return rows.filter((row) => intakeItemSourceKind(row) === "email");
    return [];
  }

  function renderIntakeInbox() {
    if (!el.intakeInbox) return;
    const rows = intakeRowsForInboxTab();
    el.intakeInbox.classList.toggle("hidden", !rows.length);
    if (!rows.length) {
      el.intakeInbox.innerHTML = "";
      return;
    }
    const sourceTitle = currentLeadInboxTab === "email" ? "Utkast fra e-post" : "Nye innboksutkast";
    el.intakeInbox.innerHTML = `
      <div class="section-head compact">
        <div>
          <h3>${sourceTitle}</h3>
          <p title="Dette er lagrede utkast. Åpne og godkjenn før de blir kunde, oppfølging eller historikk.">Åpne og godkjenn.</p>
        </div>
        <strong>${rows.length.toLocaleString("nb-NO")}</strong>
      </div>
      <div class="intake-inbox-list">
        ${rows.slice(0, 8).map((row) => `
          <article>
            <div>
              <strong>${escapeHtml(intakeItemTitle(row))}</strong>
              <span>${escapeHtml(intakeItemSummary(row))}</span>
              ${intakeLinkHintsHtml(row)}
              <small>${escapeHtml(formatDate(isoDate(new Date(row.created_at || Date.now()))))} · ${escapeHtml(row.source_channel || "hurtigregistrering")}</small>
            </div>
            <div class="mini-action-row">
              <button data-load-intake="${escapeHtml(row.id)}" type="button" title="Åpne utkastet i Hurtigregistrering for kontroll og lagring.">Behandle</button>
              <button class="secondary" data-discard-intake="${escapeHtml(row.id)}" type="button" title="Forkast dette innboksutkastet. Original tekst slettes ikke fra historikk hvis det allerede er lagret et annet sted.">Kast</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function loadIntakeIntoAiRegistration(id) {
    const row = (intakeItems || []).find((item) => item.id === id);
    if (!row) {
      setSyncStatus("Fant ikke innboksposten.", "error");
      return;
    }
    const raw = String(row.raw_text || row.extracted_text || "");
    const final = intakeItemFinal(row);
    const draft = parseAiRegistrationText(raw, row.analysis_json || null);
    aiRegistrationAttachments.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    aiRegistrationAttachments = [];
    renderAiRegistrationAttachments();
    aiRegistrationDraft = {
      ...draft,
      action: final.action || row.selected_action || draft.action,
      type: final.type || draft.type,
      name: final.name || draft.name,
      phone: final.phone || draft.phone,
      email: final.email || draft.email,
      street: final.street || draft.street,
      zip: final.zip || draft.zip,
      city: final.city || draft.city,
      tags: final.tags || draft.tags,
      brand: final.brand || draft.brand,
      model: final.model || draft.model,
      note: final.note || draft.note,
      raw,
      analysis: row.analysis_json || draft.analysis,
      intakeId: row.id,
      emailReference: intakeItemEmailReference(row),
      linkedCustomerId: customerKey(intakeLinkedCustomer(row)) || "",
      linkedLeadId: String(row.linked_lead_id || row.analysis_json?.source?.matchedLeadId || ""),
    };
    aiRegistrationSelectedCustomerId = aiRegistrationDraft.linkedCustomerId || "";
    if (currentView !== "leads") setView("leads");
    if (el.aiRegistrationInput) el.aiRegistrationInput.value = raw;
    renderAiRegistrationDraft();
    el.aiRegistrationDraft?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSyncStatus("Innbokspost åpnet i Hurtigregistrering. Kontroller før lagring.", "ok");
  }

  async function discardIntakeItem(id) {
    if (!id) return;
    const row = (intakeItems || []).find((item) => item.id === id);
    if (row) {
      const ok = await askForConfirmation({
        title: "Kast innboksutkast",
        message: `Kaste innboksutkastet for ${intakeItemTitle(row)}?`,
        confirmLabel: "Kast utkast",
        tone: "danger",
      });
      if (!ok) return;
    }
    if (store.discardIntakeItem) await store.discardIntakeItem(id);
    else if (store.updateIntakeItem) await store.updateIntakeItem(id, { status: "discarded" });
    intakeItems = intakeItems.filter((item) => item.id !== id);
    renderDashboard();
    renderLeads();
    setSyncStatus("Innboksutkast kastet.", "ok");
  }

  function duplicateNameKeys() {
    return duplicateIndex().keys;
  }

  function duplicateIdentityParts(customer) {
    const parts = [];
    const name = normalizeMatch(cleanDisplayName(customer));
    if (name.length >= 5) parts.push(`name:${name}`);
    const email = String(customer?.email || "").trim().toLowerCase();
    if (email.includes("@") && !ignoredDuplicateEmails.has(email)) parts.push(`email:${email}`);
    const phone = compactPhone(customer?.phone);
    if (phone.length >= 8) parts.push(`phone:${phone}`);
    const address = normalizeMatch([
      customer?.visit_street,
      customer?.visit_zip,
      customer?.visit_city,
    ].filter(Boolean).join(" "));
    if (address.length >= 10) parts.push(`address:${address}`);
    return parts;
  }

  function duplicateIndex() {
    const counts = new Map();
    const byPart = new Map();
    for (const customer of customers) {
      if (customer.is_inactive) continue;
      for (const part of duplicateIdentityParts(customer)) {
        counts.set(part, (counts.get(part) || 0) + 1);
        const list = byPart.get(part) || [];
        list.push(customer);
        byPart.set(part, list);
      }
    }
    const keys = new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
    return { keys, byPart };
  }

  function duplicatePairKey(a, b) {
    const keys = [String(a || ""), String(b || "")].filter(Boolean).sort();
    return keys.length === 2 ? keys.join("::") : "";
  }

  function dismissedDuplicatePairs() {
    const pairs = Array.isArray(crmSettings.dismissed_duplicate_pairs)
      ? crmSettings.dismissed_duplicate_pairs
      : [];
    return new Set(pairs.map(String).filter(Boolean));
  }

  function isDuplicatePairDismissed(a, b) {
    const key = duplicatePairKey(a, b);
    return Boolean(key && dismissedDuplicatePairs().has(key));
  }

  async function dismissDuplicateMatch(customerId, otherId) {
    const key = duplicatePairKey(customerId, otherId);
    if (!key) return;
    const next = [...dismissedDuplicatePairs(), key].sort();
    await saveCrmSettingValue("dismissed_duplicate_pairs", next);
    renderAll();
    setSyncStatus("Dublettreff avvist. Kundekortene er ikke endret.", "ok");
  }

  function duplicateMatchesForCustomer(customer, duplicateData = duplicateIndex()) {
    if (!customer || customer.is_inactive) return [];
    const selfKey = customerKey(customer);
    const seen = new Set();
    const rows = [];
    for (const part of duplicateIdentityParts(customer)) {
      if (!duplicateData.keys.has(part)) continue;
      const [kind] = part.split(":");
      for (const other of duplicateData.byPart.get(part) || []) {
        const key = customerKey(other);
        if (!key || key === selfKey || seen.has(key)) continue;
        if (isDuplicatePairDismissed(selfKey, key)) continue;
        seen.add(key);
        const label = kind === "email" ? "samme e-post" : kind === "phone" ? "samme telefon" : kind === "address" ? "samme adresse" : "samme navn";
        rows.push({ customer: other, label });
      }
    }
    return rows.slice(0, 6);
  }

  function renderDuplicateWarning(customer) {
    const matches = duplicateMatchesForCustomer(customer);
    if (!matches.length) return "";
    const preview = matches
      .slice(0, 2)
      .map((row) => cleanDisplayName(row.customer))
      .filter(Boolean)
      .join(", ");
    return `
      <details class="detail-section attention compact-warning duplicate-notice">
        <summary>
          <strong>Mulig dublett (${matches.length})</strong>
          <span>${escapeHtml(preview || "Se treff")}</span>
        </summary>
        <p>Vises kun som kontroll. Ingenting slås sammen automatisk.</p>
        <div class="duplicate-links">
          ${matches.slice(0, 4).map((row) => `
            <div class="duplicate-link-row">
              <button class="duplicate-open-button" data-open-customer="${escapeHtml(customerKey(row.customer))}" type="button" title="Åpne mulig dublett i kundelisten.">
                <strong>${escapeHtml(cleanDisplayName(row.customer))}</strong>
                <span>${escapeHtml(row.label)} · ${escapeHtml([row.customer.visit_city, row.customer.phone, row.customer.email].filter(Boolean).join(" · "))}</span>
              </button>
              ${isAdmin() ? `<button class="secondary duplicate-dismiss-button" data-dismiss-duplicate="${escapeHtml(customerKey(customer))}" data-dismiss-duplicate-other="${escapeHtml(customerKey(row.customer))}" type="button" title="Skjul akkurat dette dubletttreffet. Kundedata slettes ikke.">Avvis</button>` : ""}
            </div>
          `).join("")}
        </div>
      </details>
    `;
  }

  function hasCabinTag(customer) {
    return /\b(vegglifjell|veggli|blefjell|fagerfjell|skrim|norefjell|hytte|hyttekunde)\b/i.test([
      customer?.tags,
      customer?.location_tag,
      customer?.lead_source,
      customer?.local_note,
      customer?.latest_deal_name,
    ].filter(Boolean).join(" "));
  }

  function looksLikeHomeAddressOnCabinCustomer(customer) {
    if (!hasCabinTag(customer)) return false;
    const city = normalizeMatch(customer?.visit_city || "");
    if (!city) return false;
    const likelyHomeCities = [
      "oslo", "asker", "baerum", "barum", "nesbru", "sandvika", "drammen", "lier",
      "hokksund", "mjondalen", "skien", "porsgrunn", "tonsberg", "horten",
      "holmestrand", "fredrikstad", "moss", "larvik", "notteroy", "notteroy",
    ];
    return likelyHomeCities.some((item) => city.includes(item));
  }

  function hasMultiplePumpSignal(customer) {
    const installationCount = installationsForCustomer(customer).length;
    if (installationCount > 1) return true;
    const text = normalizeMatch([
      customer?.model_or_note,
      customer?.local_note,
      customer?.latest_deal_name,
      customer?.tags,
    ].filter(Boolean).join(" "));
    return /\b(2|3|4|5|6)\s*(varmepumper|pumper|anlegg)\b/.test(text) || /\bflere\s*(varmepumper|pumper|anlegg)\b/.test(text);
  }

  function hasConfirmedMultiplePumps(customer) {
    return /flere\s+(varmepumper|pumper|anlegg)\s+bekreftet|multi[_ -]?pump[_ -]?confirmed/i.test([
      customer?.tags,
      customer?.local_note,
    ].filter(Boolean).join(" "));
  }

  function qualityIssueForCustomer(customer, issue, duplicateData = null) {
    if (!customer) return false;
    if (customer.is_inactive) return false;
    if (issue === "quality_phone") return !compactPhone(customer.phone);
    if (issue === "quality_email") return !String(customer.email || "").includes("@");
    if (issue === "quality_address") return !addressFor(customer) && !exactCoordinates(customer);
    if (issue === "quality_duplicate") return duplicateMatchesForCustomer(customer, duplicateData || duplicateIndex()).length > 0;
    if (issue === "quality_home_address") return looksLikeHomeAddressOnCabinCustomer(customer);
    if (issue === "quality_multi_pump") return hasMultiplePumpSignal(customer) && !hasConfirmedMultiplePumps(customer);
    if (issue === "quality_due") return statusKind(customer) === "missing" || !nextServiceDueForCustomer(customer);
    return false;
  }

  function dataQualityRows() {
    const duplicateData = duplicateIndex();
    const definitions = [
      ["quality_phone", "Mangler telefon", "Fint å rydde før SMS eller ringelister."],
      ["quality_email", "Mangler e-post", "Påvirker tilbud, utsendelse og fakturahistorikk."],
      ["quality_address", "Mangler adresse/kart", "Må sjekkes før ruteplanlegging og booking."],
      ["quality_duplicate", "Mulig dublett", "Samme navn, telefon, e-post eller adresse finnes flere steder. Kan være ekte, men bør sjekkes."],
      ["quality_home_address", "Mulig hjemmeadresse på hyttekunde", "Tagg tyder hytte/fjell, men anleggsadresse ser ut som bosted."],
      ["quality_multi_pump", "Flere varmepumper", "Bør sjekkes per anlegg slik at riktig servicefrist kommer opp."],
      ["quality_due", "Usikker servicefrist", "Mangler tydelig neste service eller status."],
    ];
    return definitions.map(([id, label, help]) => {
      const matches = customers.filter((customer) => qualityIssueForCustomer(customer, id, duplicateData));
      return { id, label, help, count: matches.length };
    }).filter((row) => row.count > 0);
  }

  function renderDataQuality() {
    if (!el.dataQualityList) return;
    const rows = dataQualityRows();
    if (!rows.length) {
      el.dataQualityList.innerHTML = `<div class="empty-state">Ingen tydelige datavarsler akkurat nå.</div>`;
      return;
    }
    el.dataQualityList.innerHTML = rows.map((row) => `
      <button data-quality-filter="${escapeHtml(row.id)}" type="button" title="${escapeHtml(row.help)}">
        <strong>${escapeHtml(row.label)}</strong>
        <span>${row.count.toLocaleString("nb-NO")}</span>
      </button>
    `).join("");
  }

  function jobPeriodLabel(dateValue) {
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Uten dato";
    const today = new Date(`${isoDate(new Date())}T00:00:00`);
    const tomorrow = shiftDate(today, 1);
    const thisWeekStart = startOfWeek(today);
    const thisWeekEnd = shiftDate(thisWeekStart, 6);
    const nextWeekEnd = shiftDate(thisWeekEnd, 7);
    if (date < today) return "Tidligere";
    if (dateValue === isoDate(today)) return "I dag";
    if (dateValue === isoDate(tomorrow)) return "I morgen";
    if (date <= thisWeekEnd) return "Denne uken";
    if (date <= nextWeekEnd) return "Neste uke";
    return "Senere";
  }

  function jobPeriodRank(label) {
    return {
      "I dag": 0,
      "I morgen": 1,
      "Denne uken": 2,
      "Neste uke": 3,
      "Senere": 4,
      "Tidligere": 5,
      "Uten dato": 6,
    }[label] ?? 9;
  }

  function renderNextJobs() {
    el.nextJobs.innerHTML = "";
    const rows = bookingRows()
      .filter((row) => row.booking.date >= isoDate(new Date()))
      .sort((a, b) => `${a.booking.date} ${a.booking.time || ""}`.localeCompare(`${b.booking.date} ${b.booking.time || ""}`))
      .slice(0, 12);
    if (!rows.length) {
      el.nextJobs.innerHTML = `<div class="empty-state">Ingen kommende jobber booket.</div>`;
      return;
    }
    const groups = new Map();
    for (const row of rows) {
      const label = jobPeriodLabel(row.booking.date);
      const list = groups.get(label) || [];
      list.push(row);
      groups.set(label, list);
    }
    for (const [label, groupRows] of [...groups.entries()].sort((a, b) => jobPeriodRank(a[0]) - jobPeriodRank(b[0]))) {
      const group = document.createElement("section");
      group.className = "job-group";
      group.innerHTML = `<h3>${escapeHtml(label)} <span>${groupRows.length} jobb${groupRows.length === 1 ? "" : "er"}</span></h3><div></div>`;
      const list = group.querySelector("div");
      for (const row of groupRows) list.appendChild(jobCard(row, false, { showDate: true }));
      el.nextJobs.appendChild(group);
    }
  }

  function eventCustomer(event) {
    return findCustomer(event.customer_id || event.lime_id || event.legacy_lime_id);
  }

  function serviceEventKey(event) {
    return event?.id || `${event?.customer_id || event?.lime_id || ""}-${event?.event_date || ""}-${event?.event_type || ""}-${event?.note || ""}`;
  }

  function allServiceEvents() {
    const seen = new Set();
    const rows = [];
    for (const list of serviceEventsByCustomer.values()) {
      for (const event of list) {
        const key = serviceEventKey(event);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(event);
      }
    }
    return rows;
  }

  function findServiceEventByKey(key) {
    return allServiceEvents().find((event) => String(serviceEventKey(event)) === String(key || ""));
  }

  function activityTime(value, fallbackDate = "") {
    const text = value || (fallbackDate ? `${fallbackDate}T00:00:00` : "");
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function reminderDoneIds() {
    return new Set((activities || [])
      .filter((activity) => String(activity.activity_type || "").toLowerCase() === "reminder_done")
      .map((activity) => String(activity.metadata?.reminder_id || activity.metadata?.reminderId || ""))
      .filter(Boolean));
  }

  function reminderCustomer(activity) {
    const metadata = activity?.metadata || {};
    return findCustomer(activity?.customer_id)
      || findCustomer(metadata.customer_key)
      || findCustomer(metadata.customer_id)
      || customers.find((customer) => customer?.lime_id && String(customer.lime_id) === String(metadata.customer_lime_id || ""));
  }

  function reminderDueIso(activity) {
    return activity?.metadata?.due_date || activity?.metadata?.dueDate || String(activity?.occurred_at || activity?.created_at || "").slice(0, 10) || isoDate(new Date());
  }

  function reminderDueTime(activity) {
    return activity?.metadata?.due_time || activity?.metadata?.dueTime || "";
  }

  function currentReminderTimeInputValue(date = new Date()) {
    const stepMinutes = 15;
    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    const rounded = Math.round(totalMinutes / stepMinutes) * stepMinutes;
    const clamped = Math.min(23 * 60 + 45, Math.max(0, rounded));
    const hours = String(Math.floor(clamped / 60)).padStart(2, "0");
    const minutes = String(clamped % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function reminderDueAt(activity) {
    const date = reminderDueIso(activity);
    const time = reminderDueTime(activity) || "23:59";
    const parsed = new Date(`${date}T${time}`);
    return Number.isNaN(parsed.getTime()) ? activityTime(activity?.occurred_at || activity?.created_at) : parsed.getTime();
  }

  function activeReminderRows() {
    const doneIds = reminderDoneIds();
    return (activities || [])
      .filter((activity) => String(activity.activity_type || "").toLowerCase() === "reminder")
      .filter((activity) => {
        const metadata = activity.metadata || {};
        return !doneIds.has(String(activity.id || ""))
          && metadata.status !== "done"
          && metadata.status !== "cancelled"
          && metadata.done !== true;
      })
      .map((activity) => ({ activity, customer: reminderCustomer(activity), dueAt: reminderDueAt(activity) }))
      .sort((a, b) => a.dueAt - b.dueAt || activityTime(b.activity.created_at) - activityTime(a.activity.created_at));
  }

  function reminderDueLabel(activity) {
    const date = reminderDueIso(activity);
    const time = reminderDueTime(activity);
    const today = isoDate(new Date());
    const tomorrow = isoDate(shiftDate(new Date(), 1));
    const dateText = date === today ? "I dag" : date === tomorrow ? "I morgen" : formatDate(date);
    return [dateText, time].filter(Boolean).join(" kl. ");
  }

  function renderReminderQueue() {
    if (!el.reminderQueue) return;
    const rows = activeReminderRows().slice(0, 12);
    if (!rows.length) {
      el.reminderQueue.innerHTML = `<div class="empty-state">Ingen åpne påminnelser.</div>`;
      return;
    }
    el.reminderQueue.innerHTML = rows.map(({ activity, customer }) => {
      const customerKeyValue = customer ? customerKey(customer) : "";
      return `
        <article class="reminder-card" data-open-reminder="${escapeHtml(activity.id || "")}" data-reminder-customer="${escapeHtml(customerKeyValue)}">
          <strong>${escapeHtml(activity.summary || "Påminnelse")}</strong>
          <span>${escapeHtml(reminderDueLabel(activity))}${customer ? ` · ${escapeHtml(cleanDisplayName(customer))}` : ""}</span>
          <small>${escapeHtml(shortEventNote(activity.body || "") || "Ingen notat")}</small>
          <div class="reminder-actions">
            ${customer ? `<button data-open-reminder-customer="${escapeHtml(customerKeyValue)}" type="button">Kunde</button>` : ""}
            <button data-complete-reminder="${escapeHtml(activity.id || "")}" type="button">Ferdig</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderReminderCustomerOptions(query = "", selectedId = "") {
    if (!el.reminderCustomer) return;
    const normalized = String(query || "").trim();
    const selected = selectedId || reminderDialogCustomerId || "";
    let list = customers.filter((customer) => customer && !customer.is_inactive);
    if (normalized) list = list.filter((customer) => matchesSearchText(customer, normalized));
    const selectedCustomer = selected ? findCustomer(selected) : null;
    if (selectedCustomer && !list.some((customer) => customerKey(customer) === customerKey(selectedCustomer))) {
      list.unshift(selectedCustomer);
    }
    el.reminderCustomer.innerHTML = [
      `<option value="">Ingen kunde valgt</option>`,
      ...list.slice(0, 40).map((customer) => {
        const key = customerKey(customer);
        const label = [cleanDisplayName(customer), customer.phone, customer.visit_city || customer.location_tag].filter(Boolean).join(" · ");
        return `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`;
      }),
    ].join("");
    el.reminderCustomer.value = selected && list.some((customer) => customerKey(customer) === selected) ? selected : "";
    if (el.reminderCustomerHint) {
      el.reminderCustomerHint.textContent = el.reminderCustomer.value
        ? "Påminnelsen knyttes til kundekortet og vises på forsiden."
        : "Kunde er valgfritt. Påminnelsen vises uansett på forsiden.";
    }
  }

  function showReminderDialogMessage(message, type = "error") {
    if (!el.reminderDialogMessage) return;
    el.reminderDialogMessage.textContent = message || "";
    el.reminderDialogMessage.className = `dialog-message ${type}`;
    el.reminderDialogMessage.classList.toggle("hidden", !message);
  }

  function openReminderDialog(customerId = "") {
    if (!el.reminderDialog) return;
    reminderDialogCustomerId = customerId || "";
    const customer = reminderDialogCustomerId ? findCustomer(reminderDialogCustomerId) : null;
    if (el.reminderTitle) el.reminderTitle.textContent = customer ? `Påminnelse - ${cleanDisplayName(customer)}` : "Ny påminnelse";
    if (el.reminderText) el.reminderText.value = "";
    if (el.reminderDueDate) el.reminderDueDate.value = isoDate(new Date());
    if (el.reminderDueTime) el.reminderDueTime.value = currentReminderTimeInputValue();
    if (el.reminderCustomerSearch) el.reminderCustomerSearch.value = customer ? cleanDisplayName(customer) : "";
    renderReminderCustomerOptions(customer ? cleanDisplayName(customer) : "", reminderDialogCustomerId);
    showReminderDialogMessage("", "error");
    el.reminderDialog.showModal();
    setTimeout(() => el.reminderText?.focus(), 0);
  }

  function closeReminderDialog() {
    reminderDialogCustomerId = "";
    el.reminderDialog?.close();
  }

  async function saveReminderFromDialog() {
    const text = String(el.reminderText?.value || "").trim();
    if (!text) throw new Error("Skriv hva du skal huske.");
    const dueDate = el.reminderDueDate?.value || isoDate(new Date());
    const dueTime = el.reminderDueTime?.value || "";
    const customerId = el.reminderCustomer?.value || reminderDialogCustomerId || "";
    const customer = customerId ? findCustomer(customerId) : null;
    const dueLabel = reminderDueLabel({ metadata: { due_date: dueDate, due_time: dueTime } });
    await saveActivityRecord({
      customer_id: customer?.id || "",
      activity_type: "reminder",
      summary: `Påminnelse ${dueLabel}`,
      body: text,
      metadata: {
        customer_key: customer ? customerKey(customer) : "",
        customer_lime_id: customer?.lime_id || "",
        due_date: dueDate,
        due_time: dueTime,
        status: "open",
      },
      occurred_at: `${dueDate}T${dueTime || "09:00"}:00`,
    });
    closeReminderDialog();
    renderAll();
    setSyncStatus("Påminnelse lagt på forsiden.", "ok");
  }

  async function completeReminder(id) {
    const reminder = (activities || []).find((activity) => String(activity.id || "") === String(id || ""));
    if (!reminder) throw new Error("Fant ikke påminnelsen.");
    const customer = reminderCustomer(reminder);
    await saveActivityRecord({
      customer_id: customer?.id || "",
      activity_type: "reminder_done",
      summary: "Påminnelse ferdig",
      body: reminder.body || reminder.summary || "",
      metadata: {
        reminder_id: reminder.id || "",
        customer_key: customer ? customerKey(customer) : reminder.metadata?.customer_key || "",
      },
    });
    renderAll();
    setSyncStatus("Påminnelse markert ferdig.", "ok");
  }

  function renderRecentActivity() {
    if (!el.recentActivity) return;
    const items = [];
    for (const row of bookingRows()) {
      const time = activityTime(row.booking.updated_at || row.booking.done_at || row.booking.created_at, row.booking.date);
      items.push({
        time,
        kind: "booking",
        customerId: customerKey(row.customer),
        bookingId: row.id,
        title: row.booking.status === "done" ? "Jobb fullført" : "Booking",
        customer: row.customer?.name || "Uten navn",
        text: `${bookingJobLabel(row)} ${formatDate(row.booking.date)} kl. ${bookingTimeText(row.booking)}`,
      });
    }
    for (const row of orderRows()) {
      const time = activityTime(row.order.updated_at || row.order.created_at || row.order.scheduledDate, row.order.scheduledDate);
      const jobText = row.job ? ` · ${jobWorkStatusLabel(row.job.work_status)}` : "";
      const status = orderEffectiveStatus(row.order, row.job, row.linkedBookings);
      items.push({
        time,
        kind: "order",
        customerId: customerKey(row.customer),
        orderId: row.id,
        title: "Jobb",
        customer: row.customer?.name || "Uten navn",
        text: `${orderStatusLabel(status)} · ${orderTypeLabel(row.order.type)} · ${orderDateText(row.order)}${jobText}`,
      });
    }
    for (const event of allServiceEvents()) {
      const customer = eventCustomer(event);
      items.push({
        time: activityTime(event.created_at, event.event_date),
        kind: "event",
        customerId: customer ? customerKey(customer) : "",
        title: event.event_type || "Historikk",
        customer: customer?.name || "Ukjent kunde",
        text: shortEventNote(event.note || "") || formatDate(event.event_date),
      });
    }
    for (const activity of activities || []) {
      if (String(activity.activity_type || "").toLowerCase() === "email_history") continue;
      const customer = findCustomer(activity.customer_id);
      const orderId = orderIdForActivity(activity);
      if (!customer && !orderId) continue;
      items.push({
        time: activityTime(activity.occurred_at || activity.created_at),
        kind: "activity",
        customerId: customer ? customerKey(customer) : "",
        orderId,
        title: activity.summary || "CRM-aktivitet",
        customer: customer ? cleanDisplayName(customer) : "CRM",
        text: shortEventNote(activity.body || activity.activity_type || "") || "Aktivitet",
      });
    }
    for (const customer of customers) {
      if (!customer.updated_at || !/manuell|manual/i.test(`${customer.source || ""} ${customer.legacy_lime_id || customer.lime_id || ""}`)) continue;
      items.push({
        time: activityTime(customer.updated_at),
        kind: "customer",
        customerId: customerKey(customer),
        title: "Kundekort endret",
        customer: cleanDisplayName(customer),
        text: [customer.visit_city || customer.location_tag, customer.phone].filter(Boolean).join(" · ") || "Manuell kunde",
      });
    }
    const visible = items
      .filter((item) => item.time)
      .sort((a, b) => b.time - a.time)
      .slice(0, 8);
    if (!visible.length) {
      el.recentActivity.innerHTML = `<div class="empty-state">Ingen nylige endringer registrert ennå.</div>`;
      return;
    }
    el.recentActivity.innerHTML = visible.map((item) => `
      <button type="button" data-recent-kind="${escapeHtml(item.kind || "")}" data-recent-customer="${escapeHtml(item.customerId || "")}" data-recent-booking="${escapeHtml(item.bookingId || "")}" data-recent-order="${escapeHtml(item.orderId || "")}" title="Åpne mer informasjon om denne endringen.">
        <time>${formatDate(isoDate(new Date(item.time)))}</time>
        <strong>${escapeHtml(item.title)} · ${escapeHtml(item.customer)}</strong>
        <p>${escapeHtml(String(item.text || "").slice(0, 180))}</p>
      </button>
    `).join("");
  }

  function openRecentActivity(item) {
    const kind = item.dataset.recentKind;
    const customerId = item.dataset.recentCustomer;
    const bookingId = item.dataset.recentBooking;
    const orderId = item.dataset.recentOrder;
    if (kind === "order" && orderId && findOrder(orderId)) {
      selectedOrderId = orderId;
      setView("orders");
      return;
    }
    if (customerId && findCustomer(customerId)) {
      openCustomerQuickPanel(customerId, bookingId || "");
      return;
    }
    if (orderId && findOrder(orderId)) {
      selectedOrderId = orderId;
      setView("orders");
    }
  }

  function filteredCustomers() {
    const filter = el.statusFilter?.value || currentCustomerFilter || "all";
    const search = el.customerSearch?.value || currentSearch || "";
    const duplicateData = duplicateIndex();
    return customers
      .filter((customer) => {
        if (filter === "inactive") return Boolean(customer.is_inactive);
        if (customer.is_inactive) return false;
        const kind = statusKind(customer);
        return filter === "all"
          || kind === filter
          || (filter === "due" && ["red", "yellow"].includes(kind))
          || (filter === "missing" && kind === "missing")
          || (filter === "insulation" && isInsulationCustomer(customer))
          || qualityIssueForCustomer(customer, filter, duplicateData);
      })
      .filter((customer) => matchesSearchText(customer, search))
      .sort((a, b) => {
        const rank = { red: 0, yellow: 1, missing: 2, green: 3 };
        return (rank[statusKind(a)] ?? 4) - (rank[statusKind(b)] ?? 4) || (a.name || "").localeCompare(b.name || "", "nb");
      });
  }

  function renderCustomers() {
    currentCustomerFilter = el.statusFilter?.value || "all";
    currentSearch = el.customerSearch?.value?.trim() || "";
    const list = filteredCustomers();
    if (!selectedCustomerId || !list.some((customer) => customerKey(customer) === selectedCustomerId)) selectedCustomerId = customerKey(list[0]) || "";
    el.customerList.innerHTML = "";
    for (const customer of list.slice(0, 250)) {
      const key = customerKey(customer);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.customerId = key;
      button.className = key === selectedCustomerId ? "active" : "";
      button.innerHTML = `<span class="dot ${statusKind(customer)}"></span><strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong><small>${leadBadgeHtml(customer)}${escapeHtml(customer.location_tag || customer.visit_city || "Ukjent sted")} · ${escapeHtml(customer.brand || "Ukjent merke")} · ${formatDate(nextServiceDueForCustomer(customer))}</small>`;
      el.customerList.appendChild(button);
    }
    renderCustomerDetail();
  }

  function allLeadCustomers() {
    return customers.filter((customer) => !customer.is_inactive && isLeadCustomer(customer));
  }

  function leadCustomerFromRow(lead) {
    const customer = findCustomer(leadCustomerId(lead));
    if (customer) return customer;
    const name = lead?.company_name || [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Sak uten navn";
    return {
      id: leadCustomerId(lead) || `lead:${lead?.id || ""}`,
      name,
      phone: lead?.phone || "",
      email: lead?.email || "",
      visit_street: lead?.address || "",
      visit_zip: lead?.postal_code || "",
      visit_city: lead?.city || "",
      location_tag: lead?.city || "",
      lead_source: lead?.source || "",
      source: lead?.source_detail || "",
      brand: lead?.preferred_brand || "",
      model_or_note: lead?.product_interest || "",
      local_note: leadNoteFromDb(lead),
      tags: "Lead",
    };
  }

  function leadEntryKey(entry) {
    return entry?.lead?.id ? `lead:${entry.lead.id}` : `customer:${customerKey(entry?.customer)}`;
  }

  function leadEntryCustomerKey(entry) {
    return customerKey(entry?.customer);
  }

  function allLeadEntries() {
    const representedCustomers = new Set();
    const entries = [];
    for (const lead of leads || []) {
      const dbCustomerId = leadCustomerId(lead);
      const customer = dbCustomerId ? findCustomer(dbCustomerId) : leadCustomerFromRow(lead);
      if (dbCustomerId && !customer) continue;
      const key = customerKey(customer);
      if (key) representedCustomers.add(key);
      entries.push({ lead, customer, source: "db" });
    }
    for (const customer of allLeadCustomers()) {
      const key = customerKey(customer);
      if (key && !representedCustomers.has(key)) entries.push({ lead: null, customer, source: "customer" });
    }
    return entries;
  }

  function selectedLeadEntry(list = allLeadEntries()) {
    return list.find((entry) => leadEntryKey(entry) === selectedLeadId || leadEntryCustomerKey(entry) === selectedLeadId) || null;
  }

  function leadStatusForEntry(entry) {
    const dbStatus = leadStatusFromDb(entry?.lead?.status);
    const customerStatus = leadStatusForCustomer(entry?.customer);
    if (dbStatus && dbStatus !== "followup") return dbStatus;
    if (customerStatus && customerStatus !== "followup") return customerStatus;
    return dbStatus || customerStatus;
  }

  function leadNoteForEntry(entry) {
    return leadNoteFromDb(entry?.lead) || leadNoteForCustomer(entry?.customer);
  }

  function leadCardSummary(entry) {
    const note = leadNoteForEntry(entry);
    if (note) return note;
    const product = [
      entry?.lead?.product_interest,
      entry?.lead?.source_detail,
    ].filter(Boolean).join(" · ");
    if (product) return product;
    const tags = importantCustomerTags(entry?.customer);
    if (tags.length) return tags.join("; ");
    return "Ingen notat ennå";
  }

  function leadEntryMatchesSearch(entry, search) {
    if (!search) return true;
    const customer = entry.customer;
    const leadText = [
      entry.lead?.company_name,
      entry.lead?.first_name,
      entry.lead?.last_name,
      entry.lead?.phone,
      entry.lead?.email,
      entry.lead?.address,
      entry.lead?.city,
      entry.lead?.source,
      entry.lead?.product_interest,
      leadNoteForEntry(entry),
    ].join(" ");
    return matchesSearchText(customer, search) || normalizeMatch(leadText).includes(normalizeMatch(search));
  }

  function leadEntrySourceKind(entry) {
    const text = normalizeMatch([
      entry?.lead?.source,
      entry?.lead?.raw_text,
      entry?.lead?.note,
      entry?.customer?.source,
      entry?.customer?.tags,
      leadNoteForEntry(entry),
    ].filter(Boolean).join(" "));
    if (/nettside|website|webskjema|skjema|contact form|kontaktform|kontaktskjema/i.test(text)) return "website";
    if (/e-post|e post|epost|email|gmail|mail|innboks/i.test(text)) return "email";
    return "manual";
  }

  function leadEntryLooksLikeSpam(entry) {
    if (leadEntrySourceKind(entry) !== "website") return false;
    if (leadStatusForEntry(entry) !== "followup") return false;
    const linkedSubmission = entry?.lead
      ? (websiteSubmissions || []).find((row) => row.id === entry.lead.raw_submission_id || row.created_lead_id === entry.lead.id)
      : null;
    if (linkedSubmission && websiteSubmissionLooksLikeSpam(linkedSubmission)) return true;
    const customer = entry?.customer || {};
    const text = [
      cleanDisplayName(customer),
      customer.phone,
      customer.email,
      customer.source,
      customer.lead_source,
      customer.tags,
      customer.local_note,
      entry?.lead?.source,
      entry?.lead?.source_detail,
      entry?.lead?.product_interest,
      leadNoteForEntry(entry),
    ].filter(Boolean).join(" ");
    return spamSignalScore(text, {
      name: cleanDisplayName(customer),
      phone: customer.phone || entry?.lead?.phone || "",
      email: customer.email || entry?.lead?.email || "",
      message: leadNoteForEntry(entry),
    }) >= 2;
  }

  function leadInboxTabForStatus(status) {
    if (status === "followup") return "new";
    if (["needs_offer", "offer_sent"].includes(status)) return "followup";
    if (["won", "lost"].includes(status)) return "archive";
    return "new";
  }

  function focusLeadQueueForStatus(status) {
    if (["won", "lost"].includes(status)) {
      setLeadInboxTab("archive");
      return;
    }
    setLeadInboxTab(leadInboxTabForStatus(status));
  }

  function leadEntryMatchesInboxTab(entry, tab = currentLeadInboxTab) {
    const status = leadStatusForEntry(entry);
    const source = leadEntrySourceKind(entry);
    if (tab === "followup") return ["needs_offer", "offer_sent"].includes(status);
    if (tab === "archive") return ["won", "lost"].includes(status);
    if (leadEntryLooksLikeSpam(entry)) return false;
    if (["needs_offer", "offer_sent", "won", "lost"].includes(status)) return false;
    if (tab === "email") return source === "email" && status === "followup";
    if (tab === "website") return source === "website" && status === "followup";
    return status === "followup";
  }

  function setLeadInboxTab(tab = "new") {
    currentLeadInboxTab = ["new", "email", "website", "followup", "archive"].includes(tab) ? tab : "new";
    currentLeadFilter = "inbox_tab";
    if (currentLeadInboxTab !== "website") selectedWebsiteSubmissionId = "";
    if (el.leadStatusFilter) el.leadStatusFilter.value = "inbox_tab";
  }

  function syncLeadInboxTabs() {
    document.querySelectorAll("[data-lead-inbox-tab]").forEach((button) => {
      const active = currentLeadFilter === "inbox_tab" && button.dataset.leadInboxTab === currentLeadInboxTab;
      button.classList.toggle("active", active);
      if (button.closest("[role='tablist']")) button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function filteredLeads() {
    const search = currentLeadSearch;
    const filter = currentLeadFilter === "inbox_tab" || currentLeadFilter === "all" || leadStatuses[currentLeadFilter] ? currentLeadFilter : "inbox_tab";
    return allLeadEntries()
      .filter((entry) => {
        const status = leadStatusForEntry(entry);
        if (filter === "inbox_tab") return leadEntryMatchesInboxTab(entry);
        if (filter === "all") return true;
        return status === filter;
      })
      .filter((entry) => leadEntryMatchesSearch(entry, search))
      .sort((a, b) => {
        const rank = { needs_offer: 0, offer_sent: 1, followup: 2, won: 3, lost: 4 };
        return (rank[leadStatusForEntry(a)] ?? 9) - (rank[leadStatusForEntry(b)] ?? 9)
          || cleanDisplayName(a.customer).localeCompare(cleanDisplayName(b.customer), "nb");
      });
  }

  function renderLeads() {
    if (!el.leadList || !el.leadDetail) return;
    const selectedFilter = el.leadStatusFilter?.value || "";
    currentLeadFilter = selectedFilter || (currentLeadFilter === "inbox_tab" || currentLeadFilter === "all" || leadStatuses[currentLeadFilter] ? currentLeadFilter : "inbox_tab");
    if (el.leadStatusFilter && !selectedFilter) el.leadStatusFilter.value = currentLeadFilter;
    currentLeadSearch = el.leadSearch?.value?.trim() || "";
    renderWebsiteSubmissionInbox();
    renderIntakeInbox();
    const all = allLeadEntries();
    const openWebsiteCount = openWebsiteSubmissionRows().length;
    const openIntake = openIntakeRows();
    const emailIntakeCount = openIntake.filter((row) => intakeItemSourceKind(row) === "email").length;
    if (el.leadFollowupMetric) el.leadFollowupMetric.textContent = (openWebsiteCount + openIntake.length + all.filter((entry) => leadEntryMatchesInboxTab(entry, "new")).length).toLocaleString("nb-NO");
    if (el.leadEmailMetric) el.leadEmailMetric.textContent = (emailIntakeCount + all.filter((entry) => leadEntryMatchesInboxTab(entry, "email")).length).toLocaleString("nb-NO");
    if (el.leadWebsiteMetric) el.leadWebsiteMetric.textContent = (openWebsiteCount + all.filter((entry) => leadEntryMatchesInboxTab(entry, "website")).length).toLocaleString("nb-NO");
    if (el.leadNeedsOfferMetric) el.leadNeedsOfferMetric.textContent = all.filter((entry) => leadEntryMatchesInboxTab(entry, "followup")).length.toLocaleString("nb-NO");
    if (el.leadOfferSentMetric) el.leadOfferSentMetric.textContent = all.filter((entry) => leadStatusForEntry(entry) === "offer_sent").length.toLocaleString("nb-NO");
    if (el.leadLostMetric) el.leadLostMetric.textContent = all.filter((entry) => leadEntryMatchesInboxTab(entry, "archive")).length.toLocaleString("nb-NO");
    syncLeadInboxTabs();
    let list = filteredLeads();
    const currentRawInboxCount = websiteSubmissionRowsForInboxTab().length + intakeRowsForInboxTab().length;
    if (!list.length && !currentRawInboxCount && !currentLeadSearch && currentLeadFilter === "inbox_tab" && currentLeadInboxTab === "new" && all.length) {
      const fallbackTab = ["followup", "website", "email", "archive"].find((tab) => all.some((entry) => leadEntryMatchesInboxTab(entry, tab)));
      if (fallbackTab) {
        setLeadInboxTab(fallbackTab);
        syncLeadInboxTabs();
        list = filteredLeads();
      }
    }
    if (!selectedLeadId || !selectedLeadEntry(list)) selectedLeadId = leadEntryKey(list[0]) || "";
    el.leadList.innerHTML = "";
    if (!list.length) {
      el.leadList.innerHTML = currentRawInboxCount
        ? `<div class="empty-state">Behandle innsendelser eller utkast over. Etter behandling vises de som oppfølging, jobb eller historikk.</div>`
        : `<div class="empty-state">Ingen saker i dette filteret. Bruk + Ny eller lim inn melding i Innboks.</div>`;
    }
    for (const entry of list.slice(0, 250)) {
      const customer = entry.customer;
      const key = leadEntryKey(entry);
      const status = leadStatusForEntry(entry);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.leadId = key;
      button.className = selectedLeadEntry([entry]) ? "active" : "";
      button.innerHTML = `
        <strong>${leadBadgeForStatus(status)}${escapeHtml(cleanDisplayName(customer))}</strong>
        <small>${escapeHtml([customer.visit_city || customer.location_tag || "Ukjent sted", customer.phone, customer.email].filter(Boolean).join(" · "))}</small>
        <span>${escapeHtml(leadCardSummary(entry)).slice(0, 150)}</span>
      `;
      el.leadList.appendChild(button);
    }
    renderLeadDetail();
  }

  function renderWebsiteSubmissionInbox() {
    if (!el.websiteSubmissionInbox) return;
    const rows = websiteSubmissionRowsForInboxTab();
    const hiddenRows = websiteSubmissionHiddenRowsForInboxTab();
    const selectedOpenRow = selectedWebsiteSubmissionId ? rows.find((row) => row.id === selectedWebsiteSubmissionId) : null;
    const selectedVisible = selectedOpenRow && rows.slice(0, 6).some((row) => row.id === selectedWebsiteSubmissionId);
    const visibleRows = selectedOpenRow && !selectedVisible
      ? [selectedOpenRow, ...rows.filter((row) => row.id !== selectedWebsiteSubmissionId).slice(0, 5)]
      : rows.slice(0, 6);
    el.websiteSubmissionInbox.classList.toggle("hidden", !rows.length && !hiddenRows.length);
    if (!rows.length && !hiddenRows.length) {
      el.websiteSubmissionInbox.innerHTML = "";
      return;
    }
    const openHtml = rows.length ? `
      <div class="section-head compact">
        <div>
          <h3>Nye nettskjema</h3>
          <p title="Dette er rå skjema fra nettsiden. Når du behandler et skjema kan det bli salgsmulighet eller serviceforespørsel.">Rå nettskjema før de blir salgsmulighet eller jobb.</p>
        </div>
        <strong>${rows.length.toLocaleString("nb-NO")}</strong>
      </div>
      <div class="website-submission-list">
        ${visibleRows.map((row) => {
          const name = websiteSubmissionName(row);
          const message = websiteSubmissionMessage(row);
          const date = row.received_at ? formatDate(isoDate(new Date(row.received_at))) : "";
          const text = [websiteSubmissionTypeLabel(row), row.normalized_phone, row.normalized_email, date].filter(Boolean).join(" · ");
          const duplicateHints = websiteSubmissionDuplicateHints(row, rows);
          const customerHint = websiteSubmissionCustomerMatchHint(row);
          const canCreateServiceOrder = websiteSubmissionCanCreateServiceOrder(row);
          const workflowHint = websiteSubmissionWorkflowHint(row, duplicateHints.length);
          const leadActionLabel = websiteSubmissionLeadActionLabel(row);
          const isSelected = selectedWebsiteSubmissionId && row.id === selectedWebsiteSubmissionId;
          const primaryAction = canCreateServiceOrder
            ? `<button class="order-primary" data-create-website-service-order="${escapeHtml(row.id)}" type="button" title="Opprett eller koble kundekort, og lag en ikke-planlagt servicejobb som kan bookes etter kontakt med kunden.">Lag serviceforespørsel</button>`
            : `<button class="order-primary" data-create-website-lead="${escapeHtml(row.id)}" type="button" title="Oppretter eller kobler kundekort hvis nødvendig, og legger saken som oppfølging/tilbud.">${escapeHtml(leadActionLabel)}</button>`;
          const alternateAction = canCreateServiceOrder
            ? `<button class="secondary" data-create-website-lead="${escapeHtml(row.id)}" type="button" title="Bruk hvis innsendingen egentlig gjelder tilbud, befaring eller ny varmepumpe.">${escapeHtml(leadActionLabel)}</button>`
            : "";
          return `
            <article class="${isSelected ? "selected" : ""}" data-website-submission-card="${escapeHtml(row.id)}" tabindex="-1" title="${isSelected ? "Valgt fra søket. " : ""}Rå innsending beholdes uendret til den behandles server-side.">
              <div>
                <strong>${escapeHtml(name || "Ukjent innsending")}</strong>
                <span>${escapeHtml(text || "Ny innsending")}</span>
                ${websiteSubmissionDetailsHtml(row)}
                <div class="website-workflow-hint ${escapeHtml(workflowHint.kind)}">
                  <strong title="${escapeHtml(workflowHint.detail)}">${escapeHtml(workflowHint.label)}</strong>
                </div>
                ${duplicateHints.length ? `<small class="website-duplicate-hint">Mulig duplikat: ${escapeHtml(duplicateHints.join(", "))}</small>` : ""}
                ${customerHint ? `<small class="website-duplicate-hint">${escapeHtml(customerHint)}</small>` : ""}
              </div>
              <div class="mini-action-row">
                ${primaryAction}
                <button class="secondary" data-website-submission-status="read" data-website-submission-id="${escapeHtml(row.id)}" type="button" title="Skjuler innsendingen uten å opprette kunde, oppfølging eller jobb.">Arkiver</button>
                <details class="inline-more-actions">
                  <summary title="Vis flere valg for innsendingen.">Mer</summary>
                  <div>
                    ${alternateAction}
                    <button class="secondary danger" data-website-submission-status="spam" data-website-submission-id="${escapeHtml(row.id)}" type="button" title="Marker som spam/ugyldig og skjul fra innboksen.">Spam</button>
                    <button class="secondary danger" data-delete-website-submission="${escapeHtml(row.id)}" type="button" title="Slett denne nettsideinnsendingen permanent. Brukes for test/spam.">Slett</button>
                    ${websiteSubmissionRawDataHtml(row)}
                  </div>
                </details>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    ` : "";
    const hiddenHtml = hiddenRows.length ? `
      <details class="website-hidden-submissions">
        <summary title="Åpne bare når du vil rydde test, spam eller tidligere skjulte nettskjema.">Skjulte/spam/test (${hiddenRows.length.toLocaleString("nb-NO")})</summary>
        <div class="website-submission-list compact">
          ${hiddenRows.slice(0, 30).map((row) => {
            const status = row.processing_status || "read";
            const inferredSpam = websiteSubmissionLooksLikeSpam(row) && websiteSubmissionIsOpen(row);
            const statusLabel = inferredSpam ? "Mulig spam/test" : websiteSubmissionStatusLabel(status);
            const date = row.received_at ? formatDate(isoDate(new Date(row.received_at))) : "";
            return `
              <article>
                <div>
                  <strong>${escapeHtml(websiteSubmissionName(row) || "Ukjent innsending")}</strong>
                  <span>${escapeHtml([statusLabel, websiteSubmissionTypeLabel(row), date].filter(Boolean).join(" · "))}</span>
                  ${websiteSubmissionMessage(row) ? `<small>${escapeHtml(websiteSubmissionMessage(row)).slice(0, 140)}</small>` : ""}
                </div>
                <div class="mini-action-row">
                  <button class="secondary" data-website-submission-status="new" data-website-submission-id="${escapeHtml(row.id)}" type="button" title="Legg innsendingen tilbake i nye nettskjema.">Vis i innboks</button>
                  <button class="secondary danger" data-delete-website-submission="${escapeHtml(row.id)}" type="button" title="Slett denne nettsideinnsendingen permanent. Brukes for test/spam.">Slett</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </details>
    ` : "";
    el.websiteSubmissionInbox.innerHTML = `
      ${openHtml}
      ${hiddenHtml}
    `;
  }

  function openWebsiteSubmissionRows() {
    return (websiteSubmissions || []).filter((row) => websiteSubmissionIsOpen(row) && !websiteSubmissionLooksLikeSpam(row));
  }

  function hiddenWebsiteSubmissionRows() {
    return (websiteSubmissions || []).filter((row) => websiteSubmissionIsHidden(row) || (websiteSubmissionIsOpen(row) && websiteSubmissionLooksLikeSpam(row)));
  }

  function websiteSubmissionIsOpen(row) {
    return ["new", "duplicate_possible", "failed"].includes(row?.processing_status || "new");
  }

  function websiteSubmissionIsHidden(row) {
    return ["read", "spam", "invalid"].includes(row?.processing_status || "new");
  }

  function websiteSubmissionRowsForInboxTab(tab = currentLeadInboxTab) {
    if (currentLeadFilter !== "inbox_tab") return [];
    return ["new", "website"].includes(tab) ? openWebsiteSubmissionRows() : [];
  }

  function websiteSubmissionHiddenRowsForInboxTab(tab = currentLeadInboxTab) {
    if (currentLeadFilter !== "inbox_tab") return [];
    return tab === "website" ? hiddenWebsiteSubmissionRows() : [];
  }

  function websiteSubmissionStatusLabel(status) {
    if (status === "spam") return "Spam";
    if (status === "invalid") return "Ugyldig";
    if (status === "read") return "Skjult";
    if (status === "processed") return "Behandlet";
    if (status === "failed") return "Feilet";
    return "Ny";
  }

  function websiteSubmissionDuplicateHints(row, rows = websiteSubmissions || []) {
    const hints = new Set();
    for (const match of websiteSubmissionDuplicateRows(row, rows)) {
      for (const reason of match.reasons) hints.add(reason);
    }
    return [...hints];
  }

  function websiteSubmissionDuplicateRows(row, rows = websiteSubmissions || []) {
    const phone = compactPhone(firstFilled(row?.normalized_phone, websiteSubmissionCustomer(row).phone));
    const email = String(firstFilled(row?.normalized_email, websiteSubmissionCustomer(row).email)).trim().toLowerCase();
    const name = normalizeMatch(websiteSubmissionName(row));
    const matches = [];
    for (const other of rows) {
      if (!other || other.id === row?.id) continue;
      if (!websiteSubmissionIsOpen(other) || websiteSubmissionLooksLikeSpam(other)) continue;
      const otherPhone = compactPhone(firstFilled(other.normalized_phone, websiteSubmissionCustomer(other).phone));
      const otherEmail = String(firstFilled(other.normalized_email, websiteSubmissionCustomer(other).email)).trim().toLowerCase();
      const otherName = normalizeMatch(websiteSubmissionName(other));
      const reasons = [];
      if (phone && otherPhone && phone === otherPhone) reasons.push("samme telefon");
      if (email && otherEmail && email === otherEmail) reasons.push("samme e-post");
      if (name && otherName && name === otherName) reasons.push("samme navn");
      if (reasons.length) matches.push({ row: other, reasons });
    }
    return matches;
  }

  function websiteSubmissionDuplicateSummary(row) {
    return websiteSubmissionDuplicateRows(row)
      .slice(0, 3)
      .map((item) => `${websiteSubmissionName(item.row)} (${item.reasons.join(", ")})`)
      .join("; ");
  }

  function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function firstFilled(...values) {
    for (const value of values) {
      const text = String(value || "").trim();
      if (text) return text;
    }
    return "";
  }

  function spamSignalScore(text, options = {}) {
    const raw = String(text || "");
    const normalized = normalizeMatch(raw);
    const phone = compactPhone(options.phone || "");
    const email = String(options.email || "").trim().toLowerCase();
    const name = String(options.name || "").trim();
    const hasContact = Boolean(phone || isEmailAddress(email));
    const urlCount = (raw.match(/https?:\/\/|www\.|href=|\[url|url=/gi) || []).length;
    let score = 0;
    if (urlCount >= 2) score += 2;
    else if (urlCount === 1) score += 1;
    if (/\b(casino|gambling|betting|crypto|forex|loan|investment|viagra|porn|escort|dating|onlyfans|adult|xxx|seo|backlink|guest post|link building|rank higher|increase traffic|telegram|whatsapp|whats app)\b/i.test(raw)) score += 2;
    if (/<\/?[a-z][\s\S]*?>|&lt;\/?a|href=/i.test(raw)) score += 2;
    if (/[\u0400-\u04ff]/.test(raw)) score += 1;
    if (!hasContact && urlCount) score += 1;
    if (!hasContact && !String(options.message || "").trim()) score += 1;
    if (/^(test|tester|testing|asdf|qwerty|spam|admin)$/i.test(name)) score += 2;
    if (/\b(test test|bare test|dette er en test|asdf|qwerty|lorem ipsum)\b/i.test(raw)) score += 2;
    if (/^(?:0{6,}|1{6,}|9{6,}|12345678|11111111|00000000)$/.test(phone)) score += 2;
    if (/@(?:example|test|mailinator|tempmail|10minutemail)\./i.test(email)) score += 2;
    if (normalized.length > 1800 && urlCount) score += 1;
    return score;
  }

  function websiteSubmissionSpamText(row) {
    return [
      row?.name,
      row?.customer_name,
      row?.email,
      row?.normalized_email,
      row?.phone,
      row?.normalized_phone,
      websiteSubmissionName(row),
      websiteSubmissionMessage(row),
      websiteSubmissionSourcePage(row),
      JSON.stringify(websiteSubmissionPayload(row)).slice(0, 5000),
    ].filter(Boolean).join(" ");
  }

  function websiteSubmissionLooksLikeSpam(row) {
    if (!row) return false;
    if (websiteSubmissionVisibleOverrides.has(String(row.id || ""))) return false;
    const status = row.processing_status || "new";
    if (["spam", "invalid"].includes(status)) return true;
    if (!websiteSubmissionIsOpen(row)) return false;
    const customer = websiteSubmissionCustomer(row);
    const message = websiteSubmissionMessage(row);
    return spamSignalScore(websiteSubmissionSpamText(row), {
      name: websiteSubmissionName(row),
      phone: firstFilled(customer.phone, row?.phone, row?.normalized_phone),
      email: firstFilled(customer.email, row?.email, row?.normalized_email),
      message,
    }) >= 2;
  }

  function websiteSubmissionPayload(row) {
    return plainObject(row?.payload);
  }

  function websiteSubmissionCustomer(row) {
    const payload = websiteSubmissionPayload(row);
    const nested = plainObject(payload.customer);
    const direct = plainObject(row?.customer);
    const merged = { ...nested, ...direct };
    const postalCode = firstFilled(
      direct.postal_code,
      direct.zip,
      row?.postal_code,
      row?.zip,
      nested.postal_code,
      nested.zip,
      payload.postal_code,
      payload.zip,
    );
    return {
      ...merged,
      name: firstFilled(direct.name, row?.customer_name, row?.name, nested.name, payload.customer_name, payload.name, payload.navn, payload.fullName),
      phone: firstFilled(direct.phone, row?.phone, row?.normalized_phone, nested.phone, payload.phone),
      email: firstFilled(direct.email, row?.email, row?.normalized_email, nested.email, payload.email),
      address: firstFilled(direct.address, direct.street, row?.address, row?.street, nested.address, nested.street, payload.address, payload.adresse),
      postal_code: postalCode,
      zip: postalCode,
      city: firstFilled(direct.city, row?.city, nested.city, payload.city, postalCityByZip[postalCode]),
    };
  }

  function websiteSubmissionRequest(row) {
    const payload = websiteSubmissionPayload(row);
    const nested = plainObject(payload.request);
    const direct = plainObject(row?.request);
    const merged = { ...nested, ...direct };
    return {
      ...merged,
      request_type: firstFilled(direct.request_type, row?.request_type, nested.request_type, payload.request_type),
      service_reason: firstFilled(direct.service_reason, row?.service_reason, nested.service_reason, payload.service_reason),
      preferred_contact_method: firstFilled(direct.preferred_contact_method, row?.preferred_contact_method, nested.preferred_contact_method, payload.preferred_contact_method),
      address: firstFilled(direct.address, row?.address, nested.address, payload.address, payload.adresse),
      message: firstFilled(direct.message, row?.message, nested.message, payload.message, payload.melding),
    };
  }

  function websiteSubmissionSupport(row) {
    const payload = websiteSubmissionPayload(row);
    const nested = plainObject(payload.support);
    const direct = plainObject(row?.support);
    return {
      ...nested,
      ...direct,
      symptom_slug: firstFilled(direct.symptom_slug, row?.symptom_slug, nested.symptom_slug, payload.symptom_slug),
      severity: firstFilled(direct.severity, row?.severity, nested.severity, payload.severity),
      preferred_contact_method: firstFilled(direct.preferred_contact_method, row?.preferred_contact_method, nested.preferred_contact_method, payload.preferred_contact_method),
      message: firstFilled(direct.message, row?.message, nested.message, payload.message, payload.melding),
      billable: direct.billable ?? row?.billable ?? nested.billable ?? payload.billable,
    };
  }

  function websiteSubmissionAttribution(row) {
    const payload = websiteSubmissionPayload(row);
    return plainObject(payload.attribution);
  }

  function websiteSubmissionSourcePage(row) {
    const payload = websiteSubmissionPayload(row);
    const attribution = websiteSubmissionAttribution(row);
    return firstFilled(attribution.page_url, attribution.landing_page, payload.source_page, row?.landing_page);
  }

  function websiteSubmissionName(row) {
    const payload = websiteSubmissionPayload(row);
    const customer = websiteSubmissionCustomer(row);
    return firstFilled(customer.name, row?.customer_name, row?.name, payload.name, payload.navn, payload.fullName, row?.normalized_email, row?.normalized_phone, row?.public_reference);
  }

  function websiteSubmissionMessage(row) {
    const payload = websiteSubmissionPayload(row);
    const request = websiteSubmissionRequest(row);
    const support = websiteSubmissionSupport(row);
    return firstFilled(request.message, support.message, row?.message, row?.note, payload.message, payload.melding, payload.note, payload.notes, payload.comment, payload.kommentar);
  }

  function readableSubmissionValue(value) {
    if (value === true) return "Ja";
    if (value === false) return "Nei";
    if (Array.isArray(value)) return value.map(readableSubmissionValue).filter(Boolean).join(", ");
    if (value && typeof value === "object") {
      const named = firstFilled(value.name, value.file_name, value.filename, value.url, value.href, value.label, value.title);
      if (named) return named;
      return "";
    }
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const labels = {
      new_installation: "Ny montering",
      replacement: "Bytte gammel pumpe",
      site_visit: "Befaring",
      quote_request: "Tilbud",
      phone: "Telefon",
      phone_consultation: "Telefon",
      home_visit: "Hjemmebesøk",
      email: "E-post",
      regular_service: "Vanlig service",
      poor_heating: "Varmer dårlig",
      error_code: "Feilkode",
      other: "Annet",
    };
    return labels[text.toLowerCase()] || text.replaceAll("_", " ");
  }

  function uniqueReadableSubmissionValues(values) {
    const seen = new Set();
    return values
      .map(readableSubmissionValue)
      .filter(Boolean)
      .filter((value) => {
        const key = normalizeMatch(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function websiteSubmissionAttachments(row) {
    const payload = websiteSubmissionPayload(row);
    const request = websiteSubmissionRequest(row);
    const support = websiteSubmissionSupport(row);
    return [
      payload.attachments,
      payload.photos,
      payload.files,
      request.attachments,
      request.photos,
      support.attachments,
      support.photos,
    ].flatMap((value) => Array.isArray(value) ? value : value ? [value] : []);
  }

  function websiteSubmissionDetailRows(row) {
    const payload = websiteSubmissionPayload(row);
    const customer = websiteSubmissionCustomer(row);
    const request = websiteSubmissionRequest(row);
    const support = websiteSubmissionSupport(row);
    const product = plainObject(payload.product_interest);
    const address = [
      firstFilled(customer.address, request.address, payload.address, payload.adresse),
      firstFilled(customer.postal_code, request.postal_code, payload.postal_code),
      firstFilled(customer.city, request.city, payload.city),
    ].filter(Boolean).join(", ");
    const productText = uniqueReadableSubmissionValues([
      request.request_type,
      request.preferred_product_name,
      request.preferred_product_slug,
      request.preferred_brand,
      product.preferred_product_name,
      product.preferred_brand,
    ]).join(" · ");
    const serviceText = uniqueReadableSubmissionValues([
      request.service_reason,
      request.error_code,
      request.heat_pump_brand,
      request.heat_pump_model,
      request.serial_number,
      request.approximate_installation_year,
      support.symptom_slug,
      support.severity,
      support.billable ? "Fakturerbar hjelp" : "",
    ]).join(" · ");
    const contactText = firstFilled(request.preferred_contact_method, support.preferred_contact_method, payload.preferred_contact_method);
    const sourceText = firstFilled(row?.public_reference, websiteSubmissionSourcePage(row));
    const attachments = websiteSubmissionAttachments(row);
    const attachmentText = attachments.length
      ? attachments.map(readableSubmissionValue).filter(Boolean).slice(0, 4).join(", ") || `${attachments.length} vedlegg`
      : "";
    return [
      ["Adresse", address],
      ["Ønske", productText],
      ["Serviceinfo", serviceText],
      ["Kontaktmåte", readableSubmissionValue(contactText)],
      ["Vedlegg", attachmentText],
      ["Kilde", sourceText],
    ].filter(([, value]) => String(value || "").trim());
  }

  function websiteSubmissionDetailsHtml(row) {
    const message = websiteSubmissionMessage(row);
    const details = websiteSubmissionDetailRows(row);
    const messageHtml = message ? `
      <div class="website-submission-message">
        <strong>Kunden skrev</strong>
        <p>${escapeHtml(message.slice(0, 900))}${message.length > 900 ? " ..." : ""}</p>
      </div>
    ` : "";
    const rowsHtml = details.length ? `
      <dl class="website-submission-fields">
        ${details.slice(0, 6).map(([label, value]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(String(value).slice(0, 260))}${String(value).length > 260 ? " ..." : ""}</dd>
          </div>
        `).join("")}
      </dl>
    ` : "";
    return `${messageHtml}${rowsHtml}`;
  }

  function websiteSubmissionRawDataHtml(row) {
    const raw = JSON.stringify({
      id: row?.id || null,
      reference: row?.public_reference || null,
      type: row?.submission_type || null,
      status: row?.processing_status || null,
      payload: websiteSubmissionPayload(row),
    }, null, 2);
    return `
      <details class="website-raw-details">
        <summary>Vis rådata</summary>
        <pre>${escapeHtml(raw.slice(0, 5000))}${raw.length > 5000 ? "\n..." : ""}</pre>
      </details>
    `;
  }

  function websiteSubmissionTypeLabel(row) {
    const type = String(row?.submission_type || websiteSubmissionPayload(row).submission_type || "").toLowerCase();
    const labels = {
      lead: "Oppfølging",
      new_heat_pump: "Ny varmepumpe",
      quote_request: "Tilbud",
      site_visit_request: "Befaring",
      service_request: "Service",
      support_request: "Servicehjelp",
      insulation: "Blåseisolering",
      rental: "Utleie",
      other: "Annet",
    };
    return labels[type] || type || "Nettside";
  }

  function websiteSubmissionIsInsulation(row) {
    const text = normalizeMatch([
      row?.submission_type,
      websiteSubmissionTypeLabel(row),
      websiteSubmissionMessage(row),
      JSON.stringify(websiteSubmissionRequest(row)),
      JSON.stringify(websiteSubmissionPayload(row)),
    ].filter(Boolean).join(" "));
    return /\b(blaseisolering|blåseisolering|isobygg|supafil|isolering)\b/.test(text);
  }

  function websiteSubmissionLeadActionLabel(row) {
    return websiteSubmissionIsInsulation(row) ? "Lag kundekort + blåseisolering" : "Lag kundekort + salgsmulighet";
  }

  function websiteSubmissionLeadValues(row) {
    const payload = websiteSubmissionPayload(row);
    const customer = websiteSubmissionCustomer(row);
    const request = websiteSubmissionRequest(row);
    const support = websiteSubmissionSupport(row);
    const postalCode = firstFilled(customer.postal_code, customer.zip, row?.postal_code, row?.zip, payload.postal_code, payload.zip);
    const sourcePage = websiteSubmissionSourcePage(row);
    const productInterest = [
      websiteSubmissionTypeLabel(row),
      request.request_type,
      request.service_reason,
      request.preferred_contact_method,
      support.symptom_slug,
      support.billable ? "Fakturerbar hjelp" : "",
    ].filter(Boolean).join(" · ");
    const note = [
      `Nettsideinnsending ${row?.public_reference || ""}`.trim(),
      websiteSubmissionMessage(row),
      sourcePage ? `Side: ${sourcePage}` : "",
      row?.idempotency_key ? `Idempotency: ${row.idempotency_key}` : "",
    ].filter(Boolean).join("\n");
    return {
      name: websiteSubmissionName(row),
      phone: firstFilled(customer.phone, row?.phone, payload.phone, row?.normalized_phone),
      email: firstFilled(customer.email, row?.email, payload.email, row?.normalized_email),
      postal_code: postalCode,
      zip: postalCode,
      address: firstFilled(customer.address, row?.address, row?.street, payload.address, request.address),
      street: firstFilled(customer.address, row?.address, row?.street, payload.address, request.address),
      city: firstFilled(customer.city, row?.city, payload.city, postalCityByZip[postalCode]),
      source: "Nettside",
      source_detail: [row?.public_reference, sourcePage].filter(Boolean).join(" · ") || "Nettsideinnsending",
      product_interest: productInterest,
      note,
      lead_status: "followup",
      action: "create_lead",
      parser: "website_submission",
      raw_submission_id: row?.id || null,
      keepOriginal: true,
      raw: JSON.stringify(payload, null, 2),
    };
  }

  function websiteSubmissionServiceText(row) {
    return [
      row?.submission_type,
      websiteSubmissionTypeLabel(row),
      websiteSubmissionMessage(row),
      JSON.stringify(websiteSubmissionRequest(row)),
      JSON.stringify(websiteSubmissionSupport(row)),
    ].filter(Boolean).join(" ");
  }

  function routePrimaryInstallation(customer, options = {}) {
    const installations = installationsForCustomer(customer).filter((installation) => installation.active !== false);
    if (!installations.length) return null;
    const areaTerms = Array.isArray(options.areaTerms) ? options.areaTerms : routeAreaTerms();
    const areaMatches = areaTerms.length
      ? installations.filter((installation) => installationMatchesRouteArea(installation, customer, areaTerms))
      : [];
    const candidates = areaMatches.length ? areaMatches : installations;
    const candidateDates = candidates.map((installation) => installation.next_service_due).filter(Boolean).sort();
    const due = candidateDates[0] || nextServiceDueForCustomer(customer);
    return candidates.find((installation) => installation.next_service_due && installation.next_service_due === due)
      || candidates.find((installation) => ["red", "yellow"].includes(statusKindForDueDate(installation.next_service_due)))
      || candidates[0];
  }

  function routeInstallationLine(customer, options = {}) {
    const installation = routePrimaryInstallation(customer, options);
    if (!installation) return "";
    const title = [installation.label || "Anlegg", [installation.brand, installation.model].filter(Boolean).join(" ")].filter(Boolean).join(" - ");
    return title;
  }

  function websiteSubmissionIsService(row) {
    const type = String(row?.submission_type || websiteSubmissionPayload(row).submission_type || "").toLowerCase();
    if (["service_request", "support_request"].includes(type)) return true;
    const requestType = String(websiteSubmissionRequest(row).request_type || "").toLowerCase();
    if (["lead", "new_heat_pump", "quote_request", "site_visit_request"].includes(type)) return false;
    if (["new_installation", "replacement", "site_visit", "business_system"].includes(requestType)) return false;
    const text = websiteSubmissionServiceText(row);
    return /\b(service|support|reparasjon|reklamasjon|garanti|feil|hjelp|problem|problemer|lekker|lekkasje|drypp|støy|lyd|lukter|fungerer ikke|is|vann|rens|vedlikehold|timejobb|flytte|demonter|monter)\b/i.test(text);
  }

  function websiteSubmissionCanCreateServiceOrder(row) {
    return websiteSubmissionIsService(row) && !row?.created_job_id;
  }

  function websiteSubmissionWorkflowHint(row, duplicateCount = 0) {
    if (websiteSubmissionCanCreateServiceOrder(row)) {
      return {
        kind: duplicateCount ? "service duplicate" : "service",
        label: "Forslag: Serviceforespørsel",
        detail: duplicateCount
          ? "Service/feil. Behandle én innsending, arkiver eventuell kopi."
          : "Opprett eller koble kundekort, og lag en ikke-planlagt servicejobb som kan bookes etter kontakt med kunden.",
      };
    }
    if (websiteSubmissionIsInsulation(row)) {
      return {
        kind: duplicateCount ? "lead duplicate" : "lead",
        label: "Forslag: Blåseisolering",
        detail: duplicateCount
          ? "Blåseisolering/interesse. Behandle én innsending, arkiver eventuell kopi."
          : "Opprett eller koble kundekort, og legg saken som blåseisolering-oppfølging. Ikke lag jobb før kunden har sagt ja.",
      };
    }
    return {
      kind: duplicateCount ? "lead duplicate" : "lead",
      label: "Forslag: Salgsmulighet",
      detail: duplicateCount
        ? "Tilbud/befaring. Behandle én innsending, arkiver eventuell kopi."
        : "Opprett eller koble kundekort, og legg saken som oppfølging/tilbud.",
    };
  }

  function websiteSubmissionOrderType(row) {
    const text = websiteSubmissionServiceText(row);
    if (/\b(reklamasjon|garanti)\b/i.test(text)) return "reklamasjon";
    if (String(row?.submission_type || "").toLowerCase() === "support_request") return "reparasjon";
    if (serviceWorkNoteRegex().test(text)) return "reparasjon";
    if (/\b(feil|hjelp|problem|problemer|lekker|lekkasje|drypp|støy|lyd|lukter|fungerer ikke|is|vann|timejobb|flytte|demonter|monter)\b/i.test(text)) return "reparasjon";
    return "service";
  }

  function websiteSubmissionMatchValues(row) {
    const values = websiteSubmissionLeadValues(row);
    return {
      name: values.name || "",
      phone: values.phone || "",
      email: values.email || "",
      street: values.street || values.address || "",
      city: values.city || "",
    };
  }

  function websiteSubmissionCustomerCandidates(row) {
    return aiRegistrationCandidates(websiteSubmissionMatchValues(row))
      .filter((item) => item.score >= 40)
      .slice(0, 5);
  }

  function strongWebsiteSubmissionCustomerCandidate(row) {
    return websiteSubmissionCustomerCandidates(row).find((item) => item.score >= 120) || null;
  }

  function websiteSubmissionCustomerMatchHint(row) {
    const candidate = strongWebsiteSubmissionCustomerCandidate(row);
    if (!candidate?.customer) return "";
    const reasons = candidate.reasons?.length ? candidate.reasons.join(", ") : "sterk match på kundeinfo";
    return `Kundetreff: ${cleanDisplayName(candidate.customer)} (${reasons})`;
  }

  function websiteSubmissionAddressText(row) {
    const values = websiteSubmissionLeadValues(row);
    const place = [values.zip, values.city].filter(Boolean).join(" ");
    return [values.street || values.address, place].filter(Boolean).join(", ");
  }

  function websiteSubmissionOrderNote(row) {
    const values = websiteSubmissionLeadValues(row);
    const request = websiteSubmissionRequest(row);
    const support = websiteSubmissionSupport(row);
    const sourcePage = websiteSubmissionSourcePage(row);
    const address = websiteSubmissionAddressText(row);
    return [
      `Nettsideinnsending ${row?.public_reference || ""}`.trim(),
      `Type: ${websiteSubmissionTypeLabel(row)}`,
      websiteSubmissionMessage(row),
      request.request_type ? `Ønske: ${request.request_type}` : "",
      request.service_reason ? `Årsak: ${request.service_reason}` : "",
      request.preferred_contact_method ? `Kontaktmetode: ${request.preferred_contact_method}` : "",
      support.symptom_slug ? `Symptom: ${support.symptom_slug}` : "",
      support.billable ? "Merket som fakturerbar hjelp i skjema." : "",
      values.phone ? `Telefon: ${values.phone}` : "",
      values.email ? `E-post: ${values.email}` : "",
      address ? `Adresse: ${address}` : "",
      sourcePage ? `Side: ${sourcePage}` : "",
      row?.idempotency_key ? `Idempotency: ${row.idempotency_key}` : "",
    ].filter(Boolean).join("\n");
  }

  function websiteSubmissionCustomerDraft(row, options = {}) {
    const values = websiteSubmissionLeadValues(row);
    const type = websiteSubmissionOrderType(row);
    const purpose = options.purpose || "order";
    const fallbackName = `Ukjent kunde ${values.phone || values.email || ""}`.trim();
    const tags = purpose === "lead"
      ? ["Nettside", "Lead", `Leadstatus: ${leadStatusLabel("followup")}`]
      : ["Nettside", type === "service" ? "Service" : "Servicearbeid"];
    return {
      source: "Nettside",
      name: values.name || fallbackName || "Ukjent kunde",
      phone: values.phone || "",
      email: values.email || "",
      visit_street: values.street || values.address || "",
      visit_zip: values.zip || values.postal_code || "",
      visit_city: values.city || "",
      location_tag: values.city || "",
      model_or_note: values.product_interest || "",
      tags: nextTagsWithCustomerMarker(uniqueTags(tags), false),
      local_note: [
        `${weekdayDate(isoDate(new Date()), { long: true })}: Kundekort opprettet fra ${purpose === "lead" ? "nettsidehenvendelse" : "nettsideinnsending"}.`,
        websiteSubmissionOrderNote(row),
      ].filter(Boolean).join("\n"),
    };
  }

  async function customerForWebsiteSubmissionLead(row) {
    const linkedCustomer = row?.created_customer_id ? findCustomer(row.created_customer_id) : null;
    if (linkedCustomer) return { customer: linkedCustomer, created: false, match: null };
    const candidate = strongWebsiteSubmissionCustomerCandidate(row);
    if (candidate?.customer) return { customer: candidate.customer, created: false, match: candidate };
    const draft = websiteSubmissionCustomerDraft(row, { purpose: "lead" });
    if (!draft.name && !draft.phone && !draft.email && !draft.visit_street) {
      throw new Error("Nettsideinnsendingen mangler nok kontaktinfo til å lage kundekort.");
    }
    const savedCustomer = await store.saveCustomer(draft);
    const index = customers.findIndex((customer) => customerKey(customer) === customerKey(savedCustomer));
    if (index >= 0) customers[index] = savedCustomer;
    else customers.unshift(savedCustomer);
    return { customer: savedCustomer, created: true, match: null };
  }

  async function customerForWebsiteSubmissionOrder(row) {
    const linkedCustomer = row?.created_customer_id ? findCustomer(row.created_customer_id) : null;
    if (linkedCustomer) return { customer: linkedCustomer, created: false, match: null };
    const candidate = strongWebsiteSubmissionCustomerCandidate(row);
    if (candidate?.customer) return { customer: candidate.customer, created: false, match: candidate };
    const draft = websiteSubmissionCustomerDraft(row);
    if (!draft.name && !draft.phone && !draft.email && !draft.visit_street) {
      throw new Error("Nettsideinnsendingen mangler nok kontaktinfo til å lage kundekort.");
    }
    const savedCustomer = await store.saveCustomer(draft);
    const index = customers.findIndex((customer) => customerKey(customer) === customerKey(savedCustomer));
    if (index >= 0) customers[index] = savedCustomer;
    else customers.unshift(savedCustomer);
    return { customer: savedCustomer, created: true, match: null };
  }

  function mergeWebsiteSubmission(id, patch, updated = null) {
    websiteSubmissions = (websiteSubmissions || []).map((row) => (
      row.id === id ? { ...row, ...patch, ...(updated || {}) } : row
    ));
  }

  async function createLeadFromWebsiteSubmission(id) {
    if (!store.saveCustomer || !store.saveLeadDraft || !store.updateWebsiteSubmission) {
        throw new Error("Nettsideinnsendinger krever Supabase og oppdatert adapter med kundekort og henvendelser.");
    }
    const row = (websiteSubmissions || []).find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke nettsideinnsendingen.");
    if (row.created_lead_id) {
      selectedLeadId = `lead:${row.created_lead_id}`;
      setLeadInboxTab("website");
      renderLeads();
      setSyncStatus("Denne nettsidehenvendelsen har allerede en oppfølging. Jeg åpnet den i stedet.", "ok");
      return;
    }
    const lockKey = `website-lead:${id}`;
    if (pendingLeadCreateKeys.has(lockKey)) {
      setSyncStatus("Oppfølging opprettes allerede. Vent et øyeblikk.", "");
      return;
    }
    pendingLeadCreateKeys.add(lockKey);
    try {
      const values = websiteSubmissionLeadValues(row);
      if (!values.name && !values.phone && !values.email && !values.address) {
        throw new Error("Nettsideinnsendingen mangler nok kontaktinfo til å lage oppfølging.");
      }
      const duplicateRows = websiteSubmissionDuplicateRows(row);
      if (duplicateRows.length) {
        const ok = await askForConfirmation({
          title: "Mulig duplikat",
          message: `Fant annen åpen nettsideinnsending som ligner: ${websiteSubmissionDuplicateSummary(row)}. Fortsett og lag kundekort + oppfølging for valgt innsending?`,
          confirmLabel: "Lag oppfølging",
        });
        if (!ok) return;
      }
      const { customer, created, match } = await customerForWebsiteSubmissionLead(row);
      const linkedCustomerId = isUuid(customer?.id) ? customer.id : "";
      const savedLead = await store.saveLeadDraft({
        ...values,
        action: "create_customer_lead",
        customer_id: linkedCustomerId || null,
      });
      leads.unshift(savedLead);
      const updatePatch = {
        processing_status: "processed",
        created_lead_id: savedLead.id,
        created_customer_id: linkedCustomerId || null,
      };
      const updated = await store.updateWebsiteSubmission(id, updatePatch);
      mergeWebsiteSubmission(id, updatePatch, updated);
      await saveServiceEvent(customer, {
        event_date: isoDate(new Date()),
        event_type: created ? "Oppfølging fra nettside - nytt kundekort" : "Oppfølging fra nettside - koblet kundekort",
        note: [
          websiteSubmissionOrderNote(row),
          match?.customer ? `Koblet til eksisterende kundekort: ${cleanDisplayName(match.customer)}.` : "",
        ].filter(Boolean).join("\n"),
      });
      selectedLeadId = `lead:${savedLead.id}`;
      setLeadInboxTab("website");
      renderLeads();
      setSyncStatus(created ? "Kundekort og oppfølging opprettet fra nettsideinnsending." : "Nettsideoppfølging koblet til kundekort.", "ok");
    } finally {
      pendingLeadCreateKeys.delete(lockKey);
    }
  }

  async function createServiceOrderFromWebsiteSubmission(id) {
    if (!store.saveCustomer || !store.saveOrder || !store.updateWebsiteSubmission) {
      throw new Error("Servicejobb fra nettside krever Supabase og oppdatert adapter.");
    }
    const row = (websiteSubmissions || []).find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke nettsideinnsendingen.");
    if (row.created_job_id) {
      const existingJob = findJob(row.created_job_id);
      const existingOrderId = existingJob?.source_table === "orders" ? normalizeOrderId(existingJob.source_id) : "";
      if (existingOrderId && findOrder(existingOrderId)) {
        selectedOrderId = existingOrderId;
        setView("orders");
      }
      setSyncStatus("Denne nettsideinnsendingen har allerede en serviceforespørsel/jobb.", "ok");
      return;
    }
    const lockKey = `website-service:${id}`;
    if (pendingLeadCreateKeys.has(lockKey)) {
      setSyncStatus("Servicejobb opprettes allerede. Vent et øyeblikk.", "");
      return;
    }
    pendingLeadCreateKeys.add(lockKey);
    try {
      if (!websiteSubmissionIsService(row)) {
        throw new Error("Denne innsendingen ser ikke ut som service. Bruk Lag kundekort + salgsmulighet hvis den skal følges opp som tilbud/salg.");
      }
      const values = websiteSubmissionLeadValues(row);
      if (!values.name && !values.phone && !values.email && !values.address && !values.street) {
        throw new Error("Nettsideinnsendingen mangler nok kontaktinfo til å lage serviceforespørsel.");
      }
      const duplicateRows = websiteSubmissionDuplicateRows(row);
      if (duplicateRows.length) {
        const ok = await askForConfirmation({
          title: "Mulig duplikat",
          message: `Fant annen åpen nettsideinnsending som ligner: ${websiteSubmissionDuplicateSummary(row)}. Fortsett og lag serviceforespørsel for valgt innsending?`,
          confirmLabel: "Lag serviceforespørsel",
        });
        if (!ok) return;
      }
      const { customer, created, match } = await customerForWebsiteSubmissionOrder(row);
      const type = websiteSubmissionOrderType(row);
      const note = websiteSubmissionOrderNote(row);
      const order = await saveOrderRecord("", {
        customerId: customerKey(customer),
        title: `${orderTypeLabel(type)} - ${cleanDisplayName(customer)}`,
        type,
        status: "unscheduled",
        billingStatus: "not_ready",
        source: "website_submission",
        note,
        created_at: new Date().toISOString(),
      });
      let savedActivity = null;
      let activityWarning = "";
      try {
        savedActivity = await saveActivityRecord({
          customer_id: customerKey(customer),
          job_id: order.jobId || order.job_id || null,
          activity_type: "website_submission",
          summary: `${orderTypeLabel(type)} opprettet fra nettside`,
          body: note,
          metadata: {
            source: "website_submission",
            public_reference: row.public_reference || null,
            submission_type: row.submission_type || null,
            website_submission_id: row.id || null,
            order_id: order.id || null,
            created_customer: Boolean(created),
            matched_customer_id: match?.customer ? customerKey(match.customer) : null,
          },
        });
      } catch (error) {
        activityWarning = error.message || "Aktivitet ble ikke lagret.";
      }
      const updatedPatch = {
        processing_status: "processed",
        created_customer_id: customer.id || customerKey(customer),
      };
      if (order.jobId || order.job_id) updatedPatch.created_job_id = order.jobId || order.job_id;
      if (savedActivity?.id) updatedPatch.created_activity_id = savedActivity.id;
      const updated = await store.updateWebsiteSubmission(id, updatedPatch);
      mergeWebsiteSubmission(id, updatedPatch, updated);
      await saveServiceEvent(customer, {
        event_date: isoDate(new Date()),
        event_type: created ? "Servicejobb fra nettside" : "Servicejobb fra nettside på eksisterende kundekort",
        note: [
          `${orderTypeLabel(type)} opprettet fra nettsideinnsending.`,
          match?.customer ? `Koblet til eksisterende kunde: ${cleanDisplayName(match.customer)}.` : "",
          note,
        ].filter(Boolean).join("\n"),
      });
      selectedCustomerId = customerKey(customer);
      selectedOrderId = order.id;
      currentOrderFilter = "unscheduled";
      currentOrderSearch = "";
      if (el.orderStatusFilter) el.orderStatusFilter.value = currentOrderFilter;
      if (el.orderSearch) el.orderSearch.value = "";
      setView("orders");
      setSyncStatus(activityWarning ? `Serviceforespørsel opprettet fra nettsideinnsending. Aktivitetsspor ble ikke lagret: ${activityWarning}` : "Serviceforespørsel opprettet fra nettsideinnsending.", "ok");
    } finally {
      pendingLeadCreateKeys.delete(lockKey);
    }
  }

  async function updateWebsiteSubmissionStatus(id, status) {
    if (!store.updateWebsiteSubmission) throw new Error("Kan ikke oppdatere nettsideinnsending uten Supabase.");
    const row = (websiteSubmissions || []).find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke nettsideinnsendingen.");
    if (status === "spam") {
      const ok = await askForConfirmation({
        title: "Marker som spam",
        message: `Marker ${websiteSubmissionName(row)} som spam/ugyldig?`,
        confirmLabel: "Marker spam",
        tone: "danger",
      });
      if (!ok) return;
    }
    const updated = await store.updateWebsiteSubmission(id, { processing_status: status });
    mergeWebsiteSubmission(id, { processing_status: status }, updated);
    setWebsiteSubmissionVisibleOverride(id, status === "new");
    renderLeads();
    const message = status === "read"
      ? "Nettsideinnsending markert lest."
      : status === "new"
        ? "Nettsideinnsending gjenåpnet."
        : "Nettsideinnsending markert som spam.";
    setSyncStatus(message, "ok");
  }

  async function deleteWebsiteSubmission(id) {
    if (!store.deleteWebsiteSubmission) throw new Error("Sletting krever oppdatert Supabase-adapter.");
    const row = (websiteSubmissions || []).find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke nettsideinnsendingen.");
    const ok = await askForConfirmation({
      title: "Slett nettsideinnsending",
      message: `Slette nettsideinnsendingen fra ${websiteSubmissionName(row)}? Eventuelt opprettet kundekort, oppfølging eller jobb slettes ikke.`,
      confirmLabel: "Slett",
      tone: "danger",
    });
    if (!ok) return;
    await store.deleteWebsiteSubmission(id);
    setWebsiteSubmissionVisibleOverride(id, false);
    websiteSubmissions = (websiteSubmissions || []).filter((item) => item.id !== id);
    renderLeads();
    setSyncStatus("Nettsideinnsendingen er slettet.", "ok");
  }

  function leadCustomerMatchValues(entry) {
    const lead = entry?.lead || {};
    const customer = entry?.customer || leadCustomerFromRow(lead);
    return {
      name: cleanDisplayName(customer),
      phone: customer.phone || lead.phone || "",
      email: customer.email || lead.email || "",
      street: customer.visit_street || lead.address || "",
      city: customer.visit_city || customer.location_tag || lead.city || "",
    };
  }

  function leadCustomerCandidates(entry) {
    if (!entry?.lead || leadCustomerId(entry.lead)) return [];
    return aiRegistrationCandidates(leadCustomerMatchValues(entry))
      .filter((item) => item.score >= 40)
      .slice(0, 5);
  }

  function strongLeadCustomerCandidate(entry) {
    return leadCustomerCandidates(entry).find((item) => item.score >= 120) || null;
  }

  function leadCustomerMatchHtml(entry) {
    const candidates = leadCustomerCandidates(entry);
    if (!candidates.length) return "";
    const preview = candidates
      .slice(0, 2)
      .map(({ customer }) => cleanDisplayName(customer))
      .filter(Boolean)
      .join(", ");
    return `
      <details class="detail-section attention compact-warning lead-match-notice">
        <summary>
          <strong>Mulig kundekort finnes (${candidates.length})</strong>
          <span>${escapeHtml(preview || "Vis treff")}</span>
        </summary>
        <p>Åpne bare hvis du vil sjekke om saken skal kobles til et eksisterende kundekort.</p>
        <div class="lead-match-list">
          ${candidates.slice(0, 4).map(({ customer, score, reasons }) => {
            const key = customerKey(customer);
            const reasonText = (reasons || []).length ? reasons.join(", ") : (score >= 100 ? "sterk match" : "mulig treff");
            return `
              <article>
                <div>
                  <strong>${escapeHtml(cleanDisplayName(customer))}</strong>
                  <span>${escapeHtml([customer.visit_city || customer.location_tag, customer.phone, customer.email].filter(Boolean).join(" · ") || "Lite info")}</span>
                  <small>${score >= 120 ? "Svært sannsynlig treff" : "Mulig treff"}: ${escapeHtml(reasonText)}</small>
                </div>
                <div class="mini-action-row">
                  <button data-link-lead-customer="${escapeHtml(leadEntryKey(entry))}" data-link-existing-customer="${escapeHtml(key)}" type="button">Koble kundekort</button>
                  <button class="secondary" data-open-lead-customer="${escapeHtml(key)}" type="button">Åpne</button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </details>
    `;
  }

  function leadCustomerDraft(entry) {
    const lead = entry?.lead || {};
    const customer = entry?.customer || leadCustomerFromRow(lead);
    const status = leadStatusForEntry(entry);
    const note = leadNoteForEntry(entry);
    const source = lead.source || customer.lead_source || "Oppfølging";
    const sourceDetail = lead.source_detail || customer.source || "";
    const tags = nextTagsWithCustomerMarker(uniqueTags([
      "Lead",
      `Leadstatus: ${leadStatusLabel(status)}`,
      source === "Nettside" ? "Nettside" : "",
    ]), false);
    return {
      source,
      name: cleanDisplayName(customer),
      phone: customer.phone || lead.phone || "",
      email: customer.email || lead.email || "",
      visit_street: customer.visit_street || lead.address || "",
      visit_zip: customer.visit_zip || lead.postal_code || "",
      visit_city: customer.visit_city || lead.city || "",
      location_tag: customer.location_tag || lead.city || "",
      brand: customer.brand || lead.preferred_brand || "",
      model_or_note: customer.model_or_note || lead.product_interest || "",
      tags,
      local_note: [
        `${weekdayDate(isoDate(new Date()), { long: true })}: Kundekort opprettet fra henvendelse.`,
        sourceDetail ? `Kilde: ${sourceDetail}` : "",
        note,
      ].filter(Boolean).join("\n"),
    };
  }

  async function linkWebsiteSubmissionToCustomerFromLead(lead, customerId) {
    const linkedSubmission = (websiteSubmissions || []).find((row) => row.id === lead.raw_submission_id || row.created_lead_id === lead.id);
    const linkedSubmissionId = lead.raw_submission_id || linkedSubmission?.id || "";
    if (!linkedSubmissionId || !store.updateWebsiteSubmission) return;
    const updatedSubmission = await store.updateWebsiteSubmission(linkedSubmissionId, { created_customer_id: customerId });
    mergeWebsiteSubmission(linkedSubmissionId, { created_customer_id: customerId }, updatedSubmission);
  }

  async function linkLeadToExistingCustomer(entryKey, customerId) {
    if (store.isConfigured && !store.updateLead) throw new Error("Kobling av henvendelse krever oppdatert Supabase-adapter.");
    if (!store.isConfigured) requireLocalDemoStorage();
    const entry = allLeadEntries().find((item) => leadEntryKey(item) === entryKey);
    if (!entry?.lead) throw new Error("Fant ikke henvendelsen.");
    const customer = findCustomer(customerId);
    if (!customer) throw new Error("Fant ikke kundekortet som skulle kobles.");
    const updatedLead = store.isConfigured
      ? await store.updateLead(entry.lead.id, { existing_customer_id: customerKey(customer) })
      : saveLocalLeadPatch(entry.lead.id, { existing_customer_id: customerKey(customer) });
    const leadIndex = leads.findIndex((lead) => lead.id === updatedLead.id);
    if (leadIndex >= 0) leads[leadIndex] = updatedLead;
    else leads.unshift(updatedLead);
    await linkWebsiteSubmissionToCustomerFromLead(updatedLead, customerKey(customer));
    await saveServiceEvent(customer, {
      event_date: isoDate(new Date()),
      event_type: "Henvendelse koblet til kundekort",
      note: leadNoteForEntry({ ...entry, lead: updatedLead, customer }) || "Henvendelse koblet til eksisterende kundekort.",
    });
    selectedLeadId = `lead:${updatedLead.id}`;
    selectedCustomerId = customerKey(customer);
    currentLeadFilter = leadStatusForEntry({ ...entry, lead: updatedLead, customer }) || "followup";
    if (el.leadStatusFilter) el.leadStatusFilter.value = currentLeadFilter;
    renderAll();
    setView("leads");
    setSyncStatus("Oppfølging koblet til eksisterende kundekort. Du kan nå sette status, booke avtale eller opprette jobb.", "ok");
  }

  async function createCustomerFromLead(entryKey) {
    if (store.isConfigured && (!store.saveCustomer || !store.updateLead)) throw new Error("Opprett kundekort fra henvendelse krever oppdatert Supabase-adapter.");
    if (!store.isConfigured) requireLocalDemoStorage();
    const entry = allLeadEntries().find((item) => leadEntryKey(item) === entryKey);
    if (!entry?.lead) throw new Error("Fant ikke henvendelsen.");
    const existingCustomerId = leadCustomerId(entry.lead);
    if (existingCustomerId && findCustomer(existingCustomerId)) {
      selectedCustomerId = existingCustomerId;
      setView("customers");
      setSyncStatus("Saken er allerede koblet til kundekort.", "ok");
      return;
    }
    const strongCandidate = strongLeadCustomerCandidate(entry);
    if (strongCandidate) {
      setSyncStatus(`Fant mulig eksisterende kundekort: ${cleanDisplayName(strongCandidate.customer)}. Bruk Koble kundekort hvis dette er samme kunde.`, "ok");
      renderLeadDetail();
      return;
    }
    const draft = leadCustomerDraft(entry);
    if (!draft.name && !draft.phone && !draft.email) throw new Error("Henvendelsen mangler nok kontaktinfo til å opprette kundekort.");
    const savedCustomer = store.isConfigured
      ? await store.saveCustomer(draft)
      : { ...draft, lime_id: draft.lime_id || `lead-customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    const index = customers.findIndex((customer) => customerKey(customer) === customerKey(savedCustomer));
    if (index >= 0) customers[index] = savedCustomer;
    else customers.unshift(savedCustomer);
    if (!store.isConfigured) {
      customerEdits[customerKey(savedCustomer)] = savedCustomer;
      saveLocalEdits();
    }

    const updatedLead = store.isConfigured
      ? await store.updateLead(entry.lead.id, { existing_customer_id: savedCustomer.id })
      : saveLocalLeadPatch(entry.lead.id, { existing_customer_id: customerKey(savedCustomer), converted_customer_id: customerKey(savedCustomer) });
    const leadIndex = leads.findIndex((lead) => lead.id === updatedLead.id);
    if (leadIndex >= 0) leads[leadIndex] = updatedLead;
    else leads.unshift(updatedLead);

    await linkWebsiteSubmissionToCustomerFromLead(updatedLead, savedCustomer.id);

    await saveServiceEvent(savedCustomer, {
      event_date: isoDate(new Date()),
      event_type: "Henvendelse konvertert til kundekort",
      note: leadNoteForEntry({ ...entry, lead: updatedLead, customer: savedCustomer }) || "Kundekort opprettet fra henvendelse.",
    });
    selectedLeadId = `lead:${updatedLead.id}`;
    selectedCustomerId = customerKey(savedCustomer);
    setLeadInboxTab("new");
    renderAll();
    setView("leads");
    setSyncStatus("Kundekort opprettet fra oppfølging. Du kan nå sette status, opprette jobb eller booke avtale.", "ok");
  }

  function leadTemplateButtons(customer, target = "") {
    const key = customerKey(customer);
    return Object.entries(leadTemplates).map(([id, template]) => (
      `<button data-copy-lead-template="${escapeHtml(id)}" data-lead-template-customer="${escapeHtml(key)}" data-lead-template-target="${escapeHtml(target)}" type="button" title="Fyll tilbudsutkastet hvis tilbudsfeltet er synlig, ellers kopier teksten.">${escapeHtml(template.title)}</button>`
    )).join("");
  }

  function leadSourceText(customer) {
    return [customer.source, customer.lead_source]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 220);
  }

  function leadSourceDetailText(entry, customer, status) {
    const parts = [
      leadSourceText(customer),
      entry?.lead?.source,
      entry?.lead?.source_detail,
      status ? `Status: ${leadStatusLabel(status)}` : "",
    ]
      .filter(Boolean)
      .flatMap((part) => String(part).split(" · "))
      .map((part) => part.trim())
      .filter(Boolean);
    return [...new Set(parts)].join(" · ").slice(0, 260);
  }

  function leadNextActionText(status, realCustomer, hasOrder = false) {
    if (!realCustomer) {
      return {
        heading: "Opprett eller koble kundekort",
        body: "Før saken kan bli jobb, avtale eller faktura må den kobles til et kundekort.",
      };
    }
    if (status === "needs_offer") {
      return {
        heading: "Skriv og send tilbud",
        body: "Bruk tilbudsfeltet under. Når kunden svarer ja, marker saken som vunnet og opprett jobb.",
      };
    }
    if (status === "offer_sent") {
      return {
        heading: "Følg opp tilbudet",
        body: "Neste naturlige steg er å markere saken som vunnet eller tapt når kunden svarer.",
      };
    }
    if (status === "won") {
      return hasOrder
        ? {
          heading: "Jobb er opprettet",
          body: "Saken er vunnet og har jobb. Åpne jobben for booking, utføring og fakturering.",
        }
        : {
          heading: "Opprett jobb",
          body: "Saken er vunnet. Lag jobb før avtale, så flyten går videre til utført og fakturert.",
        };
    }
    if (status === "lost") {
      return {
        heading: "Ingen aktiv oppfølging",
        body: "Saken er tapt. Gjenåpne bare hvis kunden tar kontakt igjen.",
      };
    }
    return {
      heading: "Avklar behovet",
      body: "Kontakt kunden, sjekk om det er tilbud, befaring, servicejobb eller ny varmepumpe.",
    };
  }

  function leadNextActionHtml(entry, customer, realCustomer, status, leadTarget) {
    const key = customerKey(customer);
    const entryKey = leadEntryKey(entry);
    const existingLeadOrder = entry?.lead?.id ? orderForLeadId(entry.lead.id) : null;
    const text = leadNextActionText(status, realCustomer, Boolean(existingLeadOrder));
    const actions = [];
    if (!realCustomer && entry?.lead) {
        actions.push(`<button class="order-primary" data-create-customer-from-lead="${escapeHtml(entryKey)}" type="button" title="Opprett kundekort fra saken. Bruk dette når det er en ny kunde og ingen tydelig dublett.">Opprett kundekort</button>`);
    }
    if (realCustomer && status === "followup") {
      actions.push(`<button class="order-primary" data-lead-set-status="needs_offer" data-lead-status-customer="${escapeHtml(leadTarget)}" type="button" title="Flytt saken til tilbudskøen når du har nok info til å lage tilbud.">Klar for tilbud</button>`);
      actions.push(`<button class="secondary" data-book-customer="${escapeHtml(key)}" data-book-type="befaring" type="button" title="Legg befaring eller annen oppfølging i kalenderen.">Book befaring</button>`);
    }
    if (realCustomer && status === "needs_offer") {
      actions.push(`<button class="order-primary" data-focus-lead-offer="${escapeHtml(leadTarget)}" type="button" title="Hopp til tilbudsfeltet og bruk en tilbudsmal.">Skriv tilbud</button>`);
      actions.push(`<button class="secondary" data-lead-set-status="offer_sent" data-lead-status-customer="${escapeHtml(leadTarget)}" type="button" title="Brukes bare når tilbudet faktisk er sendt utenfor CRM eller bekreftet sendt.">Marker sendt</button>`);
    }
    if (realCustomer && status === "offer_sent") {
      actions.push(`<button class="order-primary" data-lead-set-status="won" data-lead-status-customer="${escapeHtml(leadTarget)}" type="button" title="Kunden har takket ja. Neste steg blir jobb og avtale.">Vunnet</button>`);
      actions.push(`<button class="secondary" data-lead-set-status="lost" data-lead-status-customer="${escapeHtml(leadTarget)}" type="button" title="Kunden har takket nei eller saken skal avsluttes.">Tapt</button>`);
    }
    if (realCustomer && status === "won") {
      if (existingLeadOrder) {
        actions.push(`<button class="order-primary" data-open-order="${escapeHtml(existingLeadOrder.id)}" type="button" title="Denne saken har allerede jobb. Åpne jobben og book tid derfra.">Åpne jobb</button>`);
        actions.push(`<button class="secondary" data-open-lead-customer="${escapeHtml(key)}" type="button" title="Åpne kundekortet hvis du vil se anlegg, historikk eller kontaktinfo.">Åpne kundekort</button>`);
      } else {
        actions.push(`<button class="order-primary" data-create-order-from-lead="${escapeHtml(leadTarget)}" type="button" title="Opprett jobb fra akkurat denne saken. Jobben kan planlegges etterpå.">Opprett jobb</button>`);
        actions.push(`<button class="secondary" data-open-lead-customer="${escapeHtml(key)}" type="button" title="Åpne kundekortet hvis du vil se anlegg, historikk eller kontaktinfo først.">Åpne kundekort</button>`);
      }
      actions.push(`<details class="inline-more-actions"><summary title="Snarveier og sjeldnere valg.">Mer</summary><div>
        ${!existingLeadOrder ? `<button class="secondary" data-create-order-and-book-from-lead="${escapeHtml(leadTarget)}" type="button" title="Snarvei. Bruk bare når tidspunktet skal settes nå.">Opprett jobb og book direkte</button>` : ""}
        <button class="secondary" data-new-lead-existing-customer="${escapeHtml(key)}" type="button" title="Lag en ny oppfølging/tilbud på samme kunde, for eksempel ekstra varmepumpe på hjemmeadresse eller hytte.">Ny oppfølging</button>
        ${entry?.lead && isAdmin() ? `<button class="secondary danger" data-delete-lead-entry="${escapeHtml(entryKey)}" type="button" title="Slett bare denne saken. Kundekort beholdes.">Slett sak</button>` : ""}
      </div></details>`);
    }
    if (status === "lost") {
      actions.push(`<button class="secondary" data-lead-set-status="followup" data-lead-status-customer="${escapeHtml(leadTarget)}" type="button" title="Gjenåpne saken hvis kunden tar kontakt igjen.">Gjenåpne</button>`);
    }
    if (realCustomer && status !== "won") {
      actions.push(`<button class="secondary" data-new-lead-existing-customer="${escapeHtml(key)}" type="button" title="Lag en ny oppfølging/tilbud på samme kunde, for eksempel ekstra varmepumpe på hjemmeadresse eller hytte.">Ny oppfølging</button>`);
    }
    if (entry?.lead && isAdmin() && status !== "won") {
      actions.push(`<button class="secondary danger" data-delete-lead-entry="${escapeHtml(entryKey)}" type="button" title="Slett bare denne saken. Kundekort beholdes.">Slett sak</button>`);
    }
    return `
      <section class="lead-next-action ${escapeHtml(status)}">
        <div>
          <span>Neste steg</span>
          <strong>${escapeHtml(text.heading)}</strong>
          <p>${escapeHtml(text.body)}</p>
        </div>
        <div class="lead-next-actions">${actions.join("")}</div>
      </section>
    `;
  }

  function leadStatusDialogCustomer(target) {
    const entry = leadEntryForTarget(target);
    const key = entry ? leadEntryCustomerKey(entry) : target;
    const customer = key ? findCustomer(key) : null;
    return customer || entry?.customer || null;
  }

  function leadStatusProductPrefill(entry, customer) {
    return [
      entry?.lead?.product_interest,
      customer?.brand,
      customer?.model_or_note,
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(" · ");
  }

  function renderLeadStatusInstallationOptions(customer, selectedId = "") {
    if (!el.leadStatusInstallation) return;
    const installations = customer
      ? installationsForCustomer(customer).filter((installation) => (
        installation.active !== false || String(installation.id || "") === String(selectedId || "")
      ))
      : [];
    const rows = [
      `<option value="">Ikke valgt / nytt anlegg</option>`,
      ...installations.map((installation) => {
        const location = locationForInstallation(installation, customer);
        const label = [installationDisplayName(installation), locationAddressText(location)].filter(Boolean).join(" - ");
        return `<option value="${escapeHtml(installation.id || "")}">${escapeHtml(label)}</option>`;
      }),
    ];
    el.leadStatusInstallation.innerHTML = rows.join("");
    el.leadStatusInstallation.value = selectedId || "";
    el.leadStatusInstallation.disabled = !installations.length;
    el.leadStatusInstallation.title = installations.length
      ? "Velg eksisterende anlegg hvis saken gjelder en pumpe som allerede ligger på kundekortet."
      : "Ingen registrerte anlegg ennå. Bruk produktfeltet, og registrer anlegget etter montering eller på kundekortet.";
  }

  function showLeadStatusDialogMessage(message, tone = "error") {
    if (!el.leadStatusDialogMessage) return;
    el.leadStatusDialogMessage.textContent = message || "";
    el.leadStatusDialogMessage.className = `dialog-message ${tone || ""}`.trim();
    el.leadStatusDialogMessage.classList.toggle("hidden", !message);
  }

  function openLeadStatusDialog(target, status, options = {}) {
    if (!el.leadStatusDialog) {
      setLeadStatusTarget(target, status)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre henvendelsesstatus.", "error"));
      return;
    }
    const entry = leadEntryForTarget(target);
    const customer = leadStatusDialogCustomer(target);
    if (!customer) {
      setSyncStatus("Fant ikke kunde/sak for statusendringen.", "error");
      return;
    }
    leadStatusDialogState = { target, status };
    const isWon = status === "won";
    const isLost = status === "lost";
    const label = leadStatusLabel(status);
    showLeadStatusDialogMessage("", "error");
    el.leadStatusDialogTitle.textContent = isWon ? "Kunden sa ja" : label;
    el.leadStatusCustomerName.textContent = cleanDisplayName(customer);
    el.leadStatusLabelText.textContent = isWon
      ? "Legg inn hva kunden sa ja til før jobb og kalender opprettes."
      : status === "offer_sent"
        ? "Legg inn hvordan tilbudet ble sendt eller hva som bør følges opp."
        : isLost
          ? "Skriv gjerne kort hvorfor saken avsluttes."
          : "Legg inn en kort historikklinje hvis noe er avtalt.";
    el.leadStatusProduct.value = leadStatusProductPrefill(entry, customer);
    el.leadStatusAccessories.value = "";
    el.leadStatusNote.value = "";
    el.leadStatusCreateOrder.checked = isWon ? options.createOrder !== false : false;
    el.leadStatusBookAfter.checked = isWon ? options.bookAfter !== false : false;
    el.leadStatusOrderFields.classList.toggle("hidden", !isWon);
    renderLeadStatusInstallationOptions(customer, "");
    el.saveLeadStatusButton.textContent = isWon ? "Lagre og fortsett" : "Lagre";
    if (!el.leadStatusDialog.open) el.leadStatusDialog.showModal();
    setTimeout(() => (isWon ? el.leadStatusProduct : el.leadStatusNote)?.focus(), 0);
  }

  function leadStatusDialogValues() {
    const state = leadStatusDialogState || {};
    const customer = leadStatusDialogCustomer(state.target || "");
    const includeOrderDetails = state.status === "won";
    const installationId = el.leadStatusInstallation?.value || "";
    const installation = customer && installationId
      ? installationsForCustomer(customer).find((item) => String(item.id || "") === String(installationId))
      : null;
    return {
      ...state,
      customer,
      productInterest: includeOrderDetails ? (el.leadStatusProduct?.value.trim() || "") : "",
      accessories: includeOrderDetails ? (el.leadStatusAccessories?.value.trim() || "") : "",
      note: el.leadStatusNote?.value.trim() || "",
      installationId: includeOrderDetails ? installationId : "",
      installationLabel: includeOrderDetails && installation ? installationDisplayName(installation) : "",
      createOrder: includeOrderDetails && Boolean(el.leadStatusCreateOrder?.checked),
      bookAfter: includeOrderDetails && Boolean(el.leadStatusBookAfter?.checked),
    };
  }

  async function saveLeadStatusFromDialog() {
    const values = leadStatusDialogValues();
    if (!values.target || !values.status || !values.customer) throw new Error("Fant ikke saken som skal oppdateres.");
    if (values.status === "won" && !values.productInterest && !values.note) {
      throw new Error("Skriv inn hva kunden sa ja til, eller legg en kort kommentar.");
    }
    await setLeadStatusTarget(values.target, values.status, values);
    leadStatusDialogState = null;
    el.leadStatusDialog.close();
    if (values.status === "won" && values.createOrder) {
      await createOrderFromLead(values.target, {
        bookAfter: values.bookAfter,
        productInterest: values.productInterest,
        accessories: values.accessories,
        note: values.note,
        installationId: values.installationId,
      });
    }
  }

  function closeLeadStatusDialog() {
    leadStatusDialogState = null;
    if (el.leadStatusDialog?.open) el.leadStatusDialog.close();
    renderAll();
  }

  function leadStatusNeedsDetails(status) {
    return ["offer_sent", "won", "lost"].includes(String(status || ""));
  }

  function changeLeadStatusFromUi(target, status) {
    if (leadStatusNeedsDetails(status)) {
      openLeadStatusDialog(target, status);
      return Promise.resolve();
    }
    return setLeadStatusTarget(target, status);
  }

  function leadContactSectionHtml(entry, customer, realCustomer, status) {
    const key = customerKey(customer);
    const sourceText = leadSourceDetailText(entry, customer, status);
    const importantTags = importantCustomerTags(customer);
    return `
      <section class="detail-section lead-contact-panel">
        <div class="section-title-row">
          <h3>Kontakt og grunninfo</h3>
          <div class="section-actions lead-contact-actions">
            ${customerActionLinks(customer)}
            ${realCustomer ? `<button class="secondary" data-open-lead-customer="${escapeHtml(key)}" type="button" title="Åpne samme kunde i kundelisten hvis du vil jobbe videre der.">Åpne i kundelisten</button>` : ""}
          </div>
        </div>
        <dl class="facts compact">
          <div><dt>Telefon</dt><dd class="copy-field">${phoneField(customer.phone)}</dd></div>
          <div><dt>E-post</dt><dd class="copy-field">${emailField(customer.email)}</dd></div>
          <div><dt>Adresse</dt><dd>${escapeHtml(addressFor(customer) || customer.location_tag || customer.visit_city || "Ikke registrert")}</dd></div>
          <div><dt>Kilde/status</dt><dd>${escapeHtml(sourceText || "Ikke registrert")}</dd></div>
          ${importantTags.length ? `<div><dt>Viktige tagger</dt><dd>${importantTags.map((tag) => `<span class="soft-pill">${escapeHtml(tag)}</span>`).join("")}</dd></div>` : ""}
          <div><dt>Merke/modell</dt><dd>${escapeHtml([customer.brand, customer.model_or_note].filter(Boolean).join(" · ") || "Ikke registrert")}</dd></div>
          <div><dt>Betaling</dt><dd>${customer.pays_cash ? "Betaling på stedet" : "Faktura"}</dd></div>
        </dl>
      </section>
    `;
  }

  function leadQuickNoteHtml(leadTarget, note, canEditLead) {
    const hasNote = Boolean(String(note || "").trim());
    return `
      <section class="detail-section lead-quick-note">
        <div class="section-title-row">
          <h3>Samtalenotat</h3>
          <div class="section-actions">
            ${canEditLead ? `<button data-append-lead-note="${escapeHtml(leadTarget)}" type="button" title="Legg teksten inn som datert samtalenotat øverst.">Legg til</button>
            <button class="secondary" data-save-lead-note="${escapeHtml(leadTarget)}" type="button" title="Erstatt leadnotatet med teksten i feltet.">Erstatt</button>` : ""}
          </div>
        </div>
        ${hasNote ? `<div class="lead-note-current">${escapeHtml(note).replaceAll("\n", "<br>")}</div>` : ""}
        <textarea data-lead-note-text="${escapeHtml(leadTarget)}" rows="2" placeholder="Snakket med kunde, mangler info, neste steg..."></textarea>
      </section>
    `;
  }

  function leadEmbeddedCustomerSections(customer) {
    const key = customerKey(customer);
    const invoices = invoicesByCustomer.get(key) || invoicesByCustomer.get(customer.lime_id) || [];
    const events = serviceEventsByCustomer.get(key) || serviceEventsByCustomer.get(customer.lime_id) || [];
    const installations = installationsForCustomer(customer);
    const booking = bookingRows().find((row) => customerKey(row.customer) === key);
    return `
      <section class="detail-section embedded-customer-card">
        <div class="section-title-row">
          <div>
            <h3>Kundekort</h3>
            <p title="Denne delen viser kundekort, anlegg, jobber, historikk og fakturaer direkte i saken.">Kundeinfo, anlegg og historikk.</p>
          </div>
          <div class="section-actions">
            ${isAdmin() && !customer.is_inactive ? customerMoreActionsHtml(customer) : ""}
          </div>
        </div>
        ${booking ? workflowHtml(bookingWorkflowState(booking), { title: "Aktiv jobbstatus", compact: true }) : ""}
        <p class="context-hint">Kundekortet samler kontaktinfo, steder, varmepumper, jobber og historikk. Book service fra riktig anlegg når kunden har flere pumper.</p>
      </section>
      ${lookupMissingDataSection(customer)}
      ${renderCustomerContactAccess(customer)}
      ${renderInstallationList(customer, installations)}
      ${renderCustomerOpenLeads(customer)}
      ${renderCustomerOrders(customer)}
      ${renderCustomerTagsSection(customer)}
      ${renderServiceHistory(events, customer)}
      ${renderCustomerActivities(customer)}
      ${renderInvoiceList(invoices, customer)}
      ${renderNoteSection(customer)}
    `;
  }

  function leadEmailToolsHtml(entry, customer, leadTarget, status) {
    const offerTarget = leadEntryKey(entry);
    const templateSection = `
      <section class="detail-section lead-template-section">
        <h3>E-postmaler</h3>
        <p title="Velg en mal for å fylle tilbudsfeltet. Hvis tilbudsfeltet ikke er synlig, kopieres teksten.">Fyll tilbudstekst.</p>
        <div class="lead-template-buttons">${leadTemplateButtons(customer, offerTarget)}</div>
      </section>
    `;
    const offerSection = isAdmin() ? leadOfferComposerHtml(entry) : "";
    if (status === "followup" || status === "needs_offer") return `${templateSection}${offerSection}`;
    const summary = status === "won"
      ? "Vis tidligere tilbud/e-post"
      : status === "followup"
        ? "Vis tilbud/e-postmaler"
        : "Vis tilbud/e-post";
    return `
      <details class="detail-section lead-email-tools-collapsed">
        <summary>${escapeHtml(summary)}</summary>
        ${templateSection}
        ${offerSection}
      </details>
    `;
  }

  function renderLeadDetail() {
    const entry = selectedLeadEntry();
    const customer = entry?.customer || null;
    if (!customer) {
      el.leadDetail.innerHTML = `<div class="empty-state">Velg en sak til venstre, eller bruk + Ny for å lime inn en melding.</div>`;
      return;
    }
    const key = customerKey(customer);
    const leadTarget = entry?.lead?.id ? leadEntryKey(entry) : key;
    const realCustomer = Boolean(findCustomer(key));
    const canEditLead = realCustomer || Boolean(entry?.lead);
    const status = leadStatusForEntry(entry);
    const note = leadNoteForEntry(entry);
    el.leadDetail.innerHTML = `
      <div class="customer-title">
        <div class="title-pills">${leadBadgeForStatus(status)}</div>
        <h2>${customerStarHtml(customer, { showEmpty: true })}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</h2>
        <p>${escapeHtml(addressFor(customer) || customer.location_tag || customer.visit_city || "Adresse mangler")}</p>
      </div>
      <div class="lead-stage-box ${escapeHtml(status)}">
        <strong>${escapeHtml(leadStatusLabel(status))}</strong>
        <span>${escapeHtml(leadStatusHelp(status))}</span>
      </div>
      ${leadNextActionHtml(entry, customer, realCustomer, status, leadTarget)}
      ${!realCustomer && entry?.lead ? leadCustomerMatchHtml(entry) : ""}
      ${leadContactSectionHtml(entry, customer, realCustomer, status)}
      ${realCustomer ? renderLeadAttachmentSection(entry, customer, leadTarget) : ""}
      ${leadQuickNoteHtml(leadTarget, note, canEditLead)}
      <section class="detail-section">
        <h3>Endre status manuelt</h3>
        <p class="context-hint">En oppfølging er ikke ferdig avklart. Når kunden sier ja, oppretter du jobb. Deretter planlegges jobben i kalenderen.</p>
        <details>
          <summary>Vis manuelle statusvalg</summary>
          ${canEditLead ? leadStatusControlHtml(customer, status, leadTarget) : `<p class="muted">Denne saken mangler kundekort. Opprett kundekort først når saken er reell og skal følges opp videre.</p>`}
          ${!realCustomer && entry?.lead ? `<p class="muted">Du kan følge opp status og notat her. Opprett kundekort når saken er reell og skal bli kunde, jobb eller avtale.</p>` : ""}
          <div class="lead-status-actions">
            ${canEditLead ? `${leadManualStatusActionsHtml(leadTarget, status, realCustomer)}
            ${realCustomer && !entry?.lead ? `<button class="secondary" data-inactivate-lead="${escapeHtml(key)}" type="button" title="Skjul denne gamle leadmarkeringen fra aktiv liste. Kundekortet beholdes.">Skjul sak</button>` : ""}` : ""}
          </div>
        </details>
      </section>
      ${leadEmailToolsHtml(entry, customer, leadTarget, status)}
      ${realCustomer ? leadEmbeddedCustomerSections(customer) : ""}
    `;
  }

  function filteredOrders() {
    const search = normalizeMatch(currentOrderSearch);
    const filter = currentOrderFilter || "all";
    return orderRows()
      .filter((row) => {
        const status = orderEffectiveStatus(row.order, row.job, row.linkedBookings);
        const billing = orderEffectiveBillingStatus(row.order, row.job, row.linkedBookings);
        if (filter === "all") return true;
        if (filter === "billing_ready") return billing === "ready";
        if (filter === "invoiced") return billing === "sent" || billing === "paid";
        if (filter === "missing_job") return orderMissingJobMirror(row);
        return status === filter;
      })
      .filter((row) => !search || orderSearchText(row).includes(search));
  }

  function updateOrderBulkActions(visibleIds = []) {
    const selectedVisible = visibleIds.filter((id) => selectedOrderIds.has(id));
    if (el.orderSelectAll) {
      el.orderSelectAll.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
      el.orderSelectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
      el.orderSelectAll.disabled = !visibleIds.length;
    }
    if (el.deleteSelectedOrdersButton) el.deleteSelectedOrdersButton.disabled = selectedOrderIds.size === 0;
    if (el.orderSelectionSummary) {
      el.orderSelectionSummary.textContent = selectedOrderIds.size
        ? `${selectedOrderIds.size} jobber valgt`
        : "Ingen valgt";
    }
  }

  function renderOrders() {
    if (!el.orderList || !el.orderDetail) return;
    currentOrderSearch = el.orderSearch?.value?.trim() || "";
    currentOrderFilter = el.orderStatusFilter?.value || currentOrderFilter || "all";
    document.querySelectorAll("[data-order-filter-shortcut]").forEach((button) => {
      const active = button.dataset.orderFilterShortcut === currentOrderFilter;
      button.classList.toggle("active", active);
      if (button.closest(".job-tabs")) button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const rows = orderRows();
    if (el.orderUnscheduledMetric) el.orderUnscheduledMetric.textContent = rows.filter((row) => orderEffectiveStatus(row.order, row.job, row.linkedBookings) === "unscheduled").length.toLocaleString("nb-NO");
    if (el.orderScheduledMetric) el.orderScheduledMetric.textContent = rows.filter((row) => orderEffectiveStatus(row.order, row.job, row.linkedBookings) === "scheduled").length.toLocaleString("nb-NO");
    if (el.orderBillingMetric) el.orderBillingMetric.textContent = rows.filter((row) => orderEffectiveBillingStatus(row.order, row.job, row.linkedBookings) === "ready").length.toLocaleString("nb-NO");
    if (el.orderCompletedMetric) el.orderCompletedMetric.textContent = rows.filter((row) => orderEffectiveStatus(row.order, row.job, row.linkedBookings) === "completed").length.toLocaleString("nb-NO");
    if (el.orderMissingJobMetric) el.orderMissingJobMetric.textContent = rows.filter(orderMissingJobMirror).length.toLocaleString("nb-NO");
    const list = filteredOrders();
    const visibleRows = list.slice(0, 250);
    const visibleIds = visibleRows.map((row) => row.id);
    selectedOrderIds = new Set([...selectedOrderIds].filter((id) => orders[id]));
    if (!selectedOrderId || !list.some((row) => row.id === selectedOrderId)) selectedOrderId = list[0]?.id || "";
    el.orderList.innerHTML = "";
    if (!list.length) {
      el.orderList.innerHTML = `<div class="empty-state">Ingen jobber i dette filteret. Bruk + Ny for ny jobb, eller bytt til Alle.</div>`;
    }
    for (const row of visibleRows) {
      const item = document.createElement("article");
      item.className = `order-list-row ${row.id === selectedOrderId ? "active" : ""}`;
      const installationText = orderInstallationText(row.order, row.customer, row.job);
      const attachmentCount = attachmentsForJob(row.job).length;
      item.innerHTML = `
        <label class="order-select" title="Velg jobb for sletting.">
          <input data-order-check="${escapeHtml(row.id)}" type="checkbox" ${selectedOrderIds.has(row.id) ? "checked" : ""} />
          <span>Velg</span>
        </label>
      `;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.orderId = row.id;
      button.innerHTML = `
        <strong>${orderBadgesHtml(row.order, row.job, row.linkedBookings)}${escapeHtml(row.order.title || orderTitleFromBooking(row.customer, row.order))}</strong>
        <small>${escapeHtml(cleanDisplayName(row.customer))} · ${escapeHtml(orderTypeLabel(row.order.type))} · ${escapeHtml(orderDateText(row.order))}</small>
        ${installationText ? `<small>${escapeHtml(installationText)}</small>` : ""}
        ${attachmentCount ? `<small>${attachmentCount.toLocaleString("nb-NO")} vedlegg</small>` : ""}
        <span>${escapeHtml(cleanBookingNote(row.order.note) || addressFor(row.customer) || row.customer.location_tag || "Ingen notat").slice(0, 150)}</span>
      `;
      item.appendChild(button);
      el.orderList.appendChild(item);
    }
    updateOrderBulkActions(visibleIds);
    renderOrderDetail();
  }

  function orderDetailActionsHtml(order, customer, primaryBooking, effectiveBilling, linkedJob) {
    const key = customerKey(customer);
    const primary = [];
    const secondary = [];
    const more = [];
    if (primaryBooking) {
      const done = primaryBooking.booking.status === "done" || doneJobs.has(primaryBooking.id);
      const needsMove = bookingNeedsMove(primaryBooking);
      const canHavePriceBasis = bookingCanHavePriceBasis(primaryBooking);
      const paymentActionLabel = primaryBooking.customer?.pays_cash ? "Marker betalt" : "Marker fakturert";
      if (!done) primary.push(`<button class="order-primary" data-complete-booking="${escapeHtml(primaryBooking.id)}" type="button" title="Marker jobben som utført når arbeidet er ferdig.">Fullfør jobb</button>`);
      else if (bookingNeedsPaymentAction(primaryBooking)) primary.push(`<button class="order-primary" data-billing-booking="${escapeHtml(primaryBooking.id)}" type="button" title="Lukk faktura- eller betalingssteget for ferdig jobb.">${escapeHtml(paymentActionLabel)}</button>`);
      if (!done && !needsMove) secondary.push(`<button class="secondary" data-move-booking="${escapeHtml(primaryBooking.id)}" type="button">Må flyttes</button>`);
      more.push(`<button class="secondary" data-edit-booking="${escapeHtml(primaryBooking.id)}" type="button">Endre avtale</button>`);
      if (done && canHavePriceBasis) more.push(`<button class="secondary" data-price-basis-booking="${escapeHtml(primaryBooking.id)}" type="button">Fakturagrunnlag</button>`);
    } else if (effectiveBilling === "ready") {
      primary.push(`<button class="order-primary" data-mark-order-invoiced="${escapeHtml(order.id)}" type="button" title="Marker jobben som fakturert når fakturaen er sendt.">Marker fakturert</button>`);
    } else {
      primary.push(`<button class="book-primary" data-book-order="${escapeHtml(order.id)}" type="button" title="Legg jobben inn i kalenderen med dato, tidspunkt og tekniker.">Book avtale</button>`);
    }
    if (customer.phone) secondary.push(`<a href="tel:${escapeHtml(phoneForLink(customer.phone))}" title="Ring kunden.">Ring</a>`);
    if (mapQuery(customer)) secondary.push(`<a href="${escapeHtml(mapsUrl(customer))}" target="_blank" rel="noreferrer" title="Åpne anleggsadressen i Google Maps.">Kart</a>`);
    more.push(`<button data-edit-order="${escapeHtml(order.id)}" type="button">Rediger jobb</button>`);
    more.push(`<button data-open-order-customer="${escapeHtml(key)}" type="button">Åpne kundekort</button>`);
    if (orderMissingJobMirror({ order, job: linkedJob }) && store.repairOrderJobMirror && isAdmin()) {
      more.push(`<button data-repair-order-job="${escapeHtml(order.id)}" type="button">Opprett jobbkobling</button>`);
    }
    more.push(`<button class="secondary danger" data-delete-one-order="${escapeHtml(order.id)}" type="button">Slett jobb</button>`);
    return `
      ${primary.join("")}
      ${secondary.slice(0, 2).join("")}
      <details class="inline-more-actions">
        <summary title="Vis flere jobbvalg.">Mer</summary>
        <div>${more.join("")}</div>
      </details>
    `;
  }

  function renderOrderDetail() {
    const order = findOrder(selectedOrderId);
    const customer = order ? findCustomer(orderCustomerId(order)) : null;
    if (!order || !customer) {
      el.orderDetail.innerHTML = `<div class="empty-state">Velg en jobb til venstre, eller bruk + Ny for å lage jobb eller booke avtale.</div>`;
      return;
    }
    const key = customerKey(customer);
    const linkedBookings = bookingIdsForOrder(order)
      .map((id) => bookingRows().find((row) => row.id === id))
      .filter(Boolean);
    const flow = orderWorkflowState(order, linkedBookings);
    const linkedJob = jobForOrder(order);
    const effectiveBilling = orderEffectiveBillingStatus(order, linkedJob, linkedBookings);
    const installationText = orderInstallationText(order, customer, linkedJob);
    const primaryBooking = linkedBookings[0] || null;
    const orderCleanNote = cleanBookingNote(order.note);
    const orderPriceBasis = extractJobPriceBasis(order.note);
    el.orderDetail.innerHTML = `
      <div class="customer-title">
        <div class="title-pills">${orderBadgesHtml(order, linkedJob, linkedBookings)}</div>
        <h2>${customerStarHtml(customer, { showEmpty: true })}${customerCashBadgeHtml(customer)}${escapeHtml(order.title || orderTitleFromBooking(customer, order))}</h2>
        <p>${escapeHtml(cleanDisplayName(customer))} · ${escapeHtml(addressFor(customer) || customer.location_tag || "Adresse mangler")}</p>
      </div>
      ${workflowHtml(flow, { title: "Hvor er jobben?" })}
      <p class="context-hint">Jobben er arbeidet som skal gjøres. Avtalen er tidspunktet i kalenderen. Når jobben er utført, havner den i Må faktureres.</p>
      ${renderOrderJobMirrorNotice(order, linkedJob)}
      <div class="action-row">
        ${orderDetailActionsHtml(order, customer, primaryBooking, effectiveBilling, linkedJob)}
      </div>
      <dl class="facts">
        <div><dt>Kunde</dt><dd>${escapeHtml(cleanDisplayName(customer))}</dd></div>
        <div><dt>Type</dt><dd>${escapeHtml(orderTypeLabel(order.type))}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(orderStatusLabel(orderEffectiveStatus(order, linkedJob, linkedBookings)))}</dd></div>
        <div><dt>Faktura</dt><dd>${escapeHtml(billingStatusLabel(effectiveBilling))}</dd></div>
        <div><dt>Jobbkobling</dt><dd>${escapeHtml(orderJobSummary(order, linkedJob))}</dd></div>
        <div><dt>Anlegg</dt><dd>${escapeHtml(installationText || "Ikke valgt")}</dd></div>
        <div><dt>Dato</dt><dd>${escapeHtml(orderDateText(order))}</dd></div>
        <div><dt>Telefon</dt><dd class="copy-field">${phoneField(customer.phone)}</dd></div>
      </dl>
      ${renderOrderAttachmentSection(order, customer, linkedJob)}
      ${orderPriceBasis ? `<section class="detail-section"><h3>Fakturagrunnlag</h3><div class="note-box">${escapeHtml(orderPriceBasis).replaceAll("\n", "<br>")}</div><p class="form-hint">Kontrolleres og kan endres ved fullføring eller før faktura.</p></section>` : ""}
      <section class="detail-section">
        <h3>Avtale</h3>
        ${linkedBookings.length ? `<div class="order-booking-list">${linkedBookings.map((row) => `
          <article>
            <strong>${weekdayDate(row.booking.date, { long: true })} kl. ${escapeHtml(bookingTimeText(row.booking))}</strong>
            <span>${escapeHtml(row.booking.resource || "")} · ${escapeHtml(bookingJobLabel(row))}</span>
            ${workflowInlineHtml(bookingWorkflowState(row, order))}
            <button data-edit-booking="${escapeHtml(row.id)}" type="button">Endre</button>
          </article>
        `).join("")}</div>` : `<div class="empty-state">Jobben er ikke planlagt ennå.</div>`}
      </section>
      ${orderCleanNote ? `<section class="detail-section"><h3>Jobbnotat</h3><div class="note-box">${escapeHtml(orderCleanNote).replaceAll("\n", "<br>")}</div></section>` : ""}
    `;
  }

  function renderCustomerOrders(customer) {
    const rows = customerOrders(customer).slice(0, 8);
    if (!rows.length) {
      return `<section class="detail-section"><h3>Jobber</h3><div class="empty-state">Ingen jobber opprettet ennå. Bruk Ny jobb hvis kunden ringer og vil ha service, befaring eller installasjon direkte.</div></section>`;
    }
    return `
      <section class="detail-section">
        <h3>Jobber</h3>
        <div class="customer-order-list">
          ${rows.map((order) => {
            const linkedBookings = bookingRows().filter((row) => bookingIdsForOrder(order).includes(row.id) || row.booking.orderId === order.id);
            const linkedJob = jobForOrder(order);
            const installationText = orderInstallationText(order, customer, linkedJob);
            const attachmentCount = attachmentsForJob(linkedJob).length;
            const bookingLine = linkedBookings.length
              ? linkedBookings.map((row) => `${formatDate(row.booking.date)} ${bookingTimeText(row.booking)} ${row.booking.resource || ""}`.trim()).join(" · ")
              : "Ikke planlagt";
            return `
              <article>
                <div>
                  <strong>${orderBadgesHtml(order, linkedJob, linkedBookings)}${escapeHtml(order.title || orderTypeLabel(order.type))}</strong>
                  <span>${escapeHtml(orderDateText(order))} · ${escapeHtml(billingStatusLabel(orderEffectiveBillingStatus(order, linkedJob, linkedBookings)))} · ${escapeHtml(orderJobSummary(order, linkedJob))}</span>
                  ${installationText ? `<small>${escapeHtml(installationText)}</small>` : ""}
                  <small>${escapeHtml(bookingLine)}</small>
                  ${attachmentCount ? `<small>${attachmentCount.toLocaleString("nb-NO")} bilde(r)/vedlegg på jobben</small>` : ""}
                  ${workflowInlineHtml(orderWorkflowState(order, linkedBookings))}
                </div>
                <button data-open-order="${escapeHtml(order.id)}" type="button">Åpne jobb</button>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function saveInsulationCalc() {
    if (store.isConfigured) return;
    requireLocalDemoStorage();
    localStorage.setItem(storage.insulationCalc, JSON.stringify(insulationCalcLines));
  }

  function insulationCatalogItem(id) {
    return insulationCatalog.find((item) => item.id === id) || insulationCatalog[0];
  }

  function insulationLinePackages(item, quantity) {
    const qty = Number(quantity || 0);
    if (!qty || !item) return 0;
    if (item.unit === "m2" && item.thickness && item.density) return qty * item.thickness * item.density / insulationRates.packageWeight;
    if (item.unit === "m3" && item.density) return qty * item.density / insulationRates.packageWeight;
    return 0;
  }

  function insulationLineAmount(line) {
    const item = insulationCatalogItem(line.itemId);
    const qty = Number(line.quantity || 0);
    const discount = Math.max(0, Math.min(100, Number(line.discount || 0)));
    return qty * Number(item.price || 0) * (1 - discount / 100);
  }

  function insulationExtraRows() {
    return [
      { label: "Km tur/retur fra Svene", quantity: Number(el.insulationKm?.value || 0), unit: "km", price: insulationRates.km },
      { label: "Ferge/bom", quantity: Number(el.insulationToll?.value || 0) ? 1 : 0, unit: "stk", price: Number(el.insulationToll?.value || 0) },
      { label: "Rigg/klargjøring", quantity: Number(el.insulationRigPrep?.value || 0), unit: "stk", price: insulationRates.rigPrep },
      { label: "Ekstra rigg", quantity: Number(el.insulationRigExtra?.value || 0), unit: "stk", price: insulationRates.rigExtra },
      { label: "Stor rigg", quantity: Number(el.insulationRigLarge?.value || 0), unit: "stk", price: insulationRates.rigLarge },
    ].filter((row) => row.quantity > 0 && row.price > 0);
  }

  function insulationTotals() {
    const productRows = insulationCalcLines.map((line) => {
      const item = insulationCatalogItem(line.itemId);
      return {
        ...line,
        item,
        amount: insulationLineAmount(line),
        packages: insulationLinePackages(item, line.quantity),
      };
    });
    const extras = insulationExtraRows().map((row) => ({ ...row, amount: row.quantity * row.price, packages: 0 }));
    const rows = [...productRows, ...extras];
    const subtotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const packages = productRows.reduce((sum, row) => sum + Number(row.packages || 0), 0);
    const fabricM2 = productRows.filter((row) => row.item.material === "fabric").reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const rigUnits = packages / 118;
    const materialCost = packages * insulationRates.packageCost;
    const fabricCost = fabricM2 * insulationRates.fabricCost;
    const laborCost = rigUnits * insulationRates.manHour * 2 * 7.5;
    const selfCost = materialCost + fabricCost + laborCost;
    const gross = subtotal - selfCost;
    const indirect = gross * insulationRates.indirectPercent / 100;
    const profit = gross - indirect;
    const vat = subtotal * insulationRates.vat;
    return { productRows, extras, rows, subtotal, vat, total: subtotal + vat, packages, rigUnits, materialCost, fabricCost, laborCost, selfCost, gross, indirect, profit };
  }

  function renderInsulationCatalogOptions() {
    if (!el.insulationLineType || el.insulationLineType.options.length) return;
    const groups = [...new Set(insulationCatalog.map((item) => item.group))];
    el.insulationLineType.innerHTML = groups.map((group) => `
      <optgroup label="${escapeHtml(group)}">
        ${insulationCatalog.filter((item) => item.group === group).map((item) => (
          `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} - ${formatMoney(item.price)} eks. mva / ${escapeHtml(item.unit)}</option>`
        )).join("")}
      </optgroup>
    `).join("");
  }

  function renderInsulationDocuments() {
    if (!el.insulationDocuments) return;
    const docs = [priceListDocument, ...insulationDocuments];
    el.insulationDocuments.innerHTML = docs.map((doc) => `
      <a href="${escapeHtml(doc.href)}" target="_blank" rel="noreferrer" download>
        <strong>${escapeHtml(doc.title)}</strong>
        <span>${escapeHtml(doc.note)}</span>
      </a>
    `).join("");
  }

  function renderRentalImages() {
    if (!el.rentalImages) return;
    el.rentalImages.innerHTML = rentalImages.map((image) => `
      <a href="${escapeHtml(image.href)}" target="_blank" rel="noreferrer" title="Åpne større bilde">
        <img src="${escapeHtml(image.href)}" alt="${escapeHtml(image.title)}" loading="lazy" />
        <span>${escapeHtml(image.title)}</span>
      </a>
    `).join("");
  }

  function rentalTotals() {
    const days = Math.max(1, Math.round(Number(el.rentalDays?.value || 1)));
    const delivery = Math.max(0, Number(el.rentalDeliveryFee?.value || 0));
    const rent = rentalRates.startup + days * rentalRates.perDay;
    const subtotal = rent + delivery;
    const vat = subtotal * rentalRates.vat;
    return { days, delivery, rent, subtotal, vat, total: subtotal + vat };
  }

  function allInsulationCustomers() {
    return customers
      .filter((customer) => !customer.is_inactive)
      .filter((customer) => isInsulationCustomer(customer))
      .sort((a, b) => cleanDisplayName(a).localeCompare(cleanDisplayName(b), "nb"));
  }

  function selectedInsulationCustomer() {
    return findCustomer(currentInsulationCustomerId || el.insulationCustomerSelect?.value || "");
  }

  function renderInsulationCustomerSelect() {
    if (!el.insulationCustomerSelect) return;
    const list = allInsulationCustomers();
    const selectedStillExists = list.some((customer) => customerKey(customer) === currentInsulationCustomerId);
    if (!selectedStillExists) {
      const activeCustomer = findCustomer(selectedCustomerId);
      currentInsulationCustomerId = activeCustomer && isInsulationCustomer(activeCustomer)
        ? customerKey(activeCustomer)
        : customerKey(list[0]) || "";
    }
    el.insulationCustomerSelect.innerHTML = [
      `<option value="">Velg kunde</option>`,
      ...list.map((customer) => {
        const key = customerKey(customer);
        const label = [cleanDisplayName(customer), customer.visit_city || customer.location_tag, customer.phone].filter(Boolean).join(" · ");
        return `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`;
      }),
    ].join("");
    el.insulationCustomerSelect.value = currentInsulationCustomerId || "";
    renderInsulationSelectedCustomer();
  }

  function renderInsulationSelectedCustomer() {
    if (!el.insulationSelectedCustomer) return;
    const customer = selectedInsulationCustomer();
    if (!customer) {
      el.insulationSelectedCustomer.innerHTML = `<div class="empty-state">Velg en blåseisolering-kunde før du lager tilbudstekst.</div>`;
      return;
    }
    el.insulationSelectedCustomer.innerHTML = `
      <strong>${escapeHtml(cleanDisplayName(customer))}</strong>
      <span>${escapeHtml([addressFor(customer), customer.phone, customer.email].filter(Boolean).join(" · ") || "Adresse/kontaktinfo mangler")}</span>
    `;
  }

  function renderInsulationLines() {
    if (!el.insulationLines || !el.insulationSummary) return;
    const totals = insulationTotals();
    if (!insulationCalcLines.length) {
      el.insulationLines.innerHTML = `<div class="empty-state">Legg inn areal/mengde for konstruksjonen. Kjøring og rigg legges i feltene over.</div>`;
    } else {
      el.insulationLines.innerHTML = totals.productRows.map((row) => `
        <article class="insulation-line">
          <div>
            <strong>${escapeHtml(row.item.name)}</strong>
            <span>${Number(row.quantity || 0).toLocaleString("nb-NO")} ${escapeHtml(row.item.unit)} · ${formatMoney(row.item.price)} / ${escapeHtml(row.item.unit)}${Number(row.discount || 0) ? ` · ${Number(row.discount)}% rabatt` : ""}</span>
            ${row.packages ? `<small>Ca. ${row.packages.toFixed(1)} pakker</small>` : ""}
          </div>
          <strong>${formatMoney(row.amount)}</strong>
          <button data-remove-insulation-line="${escapeHtml(row.id)}" type="button">Fjern</button>
        </article>
      `).join("");
    }
    const extraText = totals.extras.length ? totals.extras.map((row) => `
      <div><span>${escapeHtml(row.label)}</span><strong>${formatMoney(row.amount)}</strong></div>
    `).join("") : `<p>Ingen kjøring/rigg lagt til.</p>`;
    el.insulationSummary.innerHTML = `
      <h3>Sum kalkyle</h3>
      <div><span>Tilbud eks. mva</span><strong>${formatMoney(totals.subtotal)}</strong></div>
      <div><span>+ 25% mva</span><strong>${formatMoney(totals.vat)}</strong></div>
      <div class="grand"><span>Tilbud inkl. mva</span><strong>${formatMoney(totals.total)}</strong></div>
      <hr />
      ${extraText}
      <hr />
      <div><span>Ca. pakker</span><strong>${totals.packages.toFixed(1)}</strong></div>
      <div><span>Ca. rigg</span><strong>${totals.rigUnits.toFixed(2)}</strong></div>
      <div><span>Ca. selvkost</span><strong>${formatMoney(totals.selfCost)}</strong></div>
      <div><span>Beregnet fortjeneste</span><strong>${formatMoney(totals.profit)}</strong></div>
      <small>Selvkost er veiledende fra tilbudsskjemaet: pakker, fiberduk og 2 mann per rigg.</small>
    `;
  }

  function insulationOfferText() {
    const totals = insulationTotals();
    const lines = totals.productRows.map((row) => (
      `${row.item.name}: ${Number(row.quantity || 0).toLocaleString("nb-NO")} ${row.item.unit} x ${formatMoney(row.item.price)} = ${formatMoney(row.amount)} eks. mva`
    ));
    const extras = totals.extras.map((row) => `${row.label}: ${formatMoney(row.amount)} eks. mva`);
    return [
      "Blåseisolering - kalkyle",
      "",
      ...lines,
      ...extras,
      "",
      `Sum eks. mva: ${formatMoney(totals.subtotal)}`,
      `Mva 25%: ${formatMoney(totals.vat)}`,
      `Sum inkl. mva: ${formatMoney(totals.total)}`,
      "",
      `Ca. pakker: ${totals.packages.toFixed(1)}`,
      "Vedlegg: standard leveringsbetingelser, produktdatablad Supafil Frame og SINTEF-godkjenning.",
    ].join("\n");
  }

  function rentalOfferDraftText(customer) {
    const totals = rentalTotals();
    const name = cleanDisplayName(customer);
    const address = addressFor(customer) || customer?.location_tag || customer?.visit_city || "Ikke registrert";
    const date = formatDate(isoDate(new Date()));
    const first = firstName(customer);
    return [
      `Emne: Tilbud på leie av industristøvsuger 15 hk - ${name}`,
      "",
      first ? `Hei ${first},` : "Hei,",
      "",
      "Vi takker for forespørselen og kan herved gi pristilbud på leie av industristøvsuger:",
      "",
      `Kunde: ${name}`,
      `Leverings-/bruksadresse: ${address}`,
      `Tilbudsdato: ${date}`,
      "",
      "Utstyr:",
      "- Industristøvsuger 15 hk for utsuging av gammel blåseisolasjon, stubbloftsleire, sagflis, kutterflis og lignende masser.",
      "- Lukket Ifor Williams skaphenger med totalvekt 1000 kg.",
      "- 20 m sugeslange totalt.",
      "- Kortere utblåsslange til container/henger.",
      "- Slangeklemmer.",
      "- 2 aluminium kjørelemmer for inn- og utlasting.",
      "",
      "Pris:",
      `- Engangsleie/oppstart: ${formatMoney(rentalRates.startup)} eks. mva`,
      `- Døgnleie: ${formatMoney(rentalRates.perDay)} eks. mva per døgn`,
      `- Antall døgn i tilbudet: ${totals.days}`,
      totals.delivery ? `- Levering/henting etter avtale: ${formatMoney(totals.delivery)} eks. mva` : "- Maskinen hentes og leveres i Svene etter avtale.",
      "",
      `Pristilbud eks. mva.: ${formatMoney(totals.subtotal)}`,
      `+ mva 25 %: ${formatMoney(totals.vat)}`,
      `Sum inkl. mva: ${formatMoney(totals.total)}`,
      "",
      "Viktige leiebetingelser:",
      "- Maskinen skal kun brukes med 98 oktan bensin.",
      "- Maskin og henger hentes/leveres med full tank, og skal returneres med full tank.",
      "- Maskinen har snorstart, choke og gass som på en vanlig bensindrevet gressklipper.",
      "- Kjør maskinen varm på lavere turtall før arbeid startes for fullt.",
      "- Utblås kan føres til container eller henger med medfølgende utblåsslange.",
      "- Leietaker er ansvarlig for maskin, henger, slanger, lemmer og tilbehør i hele leieperioden.",
      "- Leietaker er ansvarlig ved tyveri, skade, feil bruk, tap av utstyr eller manglende tilbakelevering.",
      `- Utstyrsverdi er ${formatMoney(rentalRates.equipmentValue)}.`,
      "- Forsinket tilbakelevering kan faktureres med ekstra døgnleie.",
      "- Eventuelle skader, feil eller mangler skal meldes umiddelbart.",
      "",
      "Vedlegg:",
      "- Leiebetingelser industristøvsuger 15 hk",
      "",
      "Maskinen kan også leveres etter forespørsel dersom vi har kapasitet til å kjøre den ut.",
      "",
      "Med vennlig hilsen",
      "Gunnar Grette",
      "Numedal Varmepumpeservice",
      "Tlf.: 93436855",
    ].join("\n");
  }

  function insulationOfferDraftText(customer) {
    const totals = insulationTotals();
    const name = cleanDisplayName(customer);
    const address = addressFor(customer) || customer?.location_tag || customer?.visit_city || "Ikke registrert";
    const date = formatDate(isoDate(new Date()));
    const productLines = totals.productRows.map((row) => {
      const qty = Number(row.quantity || 0).toLocaleString("nb-NO");
      const discountText = Number(row.discount || 0) ? `, ${Number(row.discount)}% rabatt` : "";
      return `- ${row.item.name}: ${qty} ${row.item.unit}${discountText}`;
    });
    const extraLines = totals.extras.map((row) => `- ${row.label}: ${row.quantity.toLocaleString("nb-NO")} ${row.unit || "stk"}`);
    const first = firstName(customer);
    return [
      `Emne: Tilbud på blåseisolering - ${name}`,
      "",
      first ? `Hei ${first},` : "Hei,",
      "",
      "Vi takker for forespørselen og kan herved gi pristilbud på følgende:",
      "",
      `Kunde: ${name}`,
      `Oppdragsadresse: ${address}`,
      `Tilbudsdato: ${date}`,
      "",
      "Arbeid:",
      "Innblåsing av glassull (Supafil Frame).",
      ...productLines,
      ...(extraLines.length ? ["", "Kjøring/rigg i kalkylen:", ...extraLines] : []),
      "",
      `Pristilbud eks. mva.: ${formatMoney(totals.subtotal)}`,
      `+ mva 25 %: ${formatMoney(totals.vat)}`,
      `Sum inkl. mva: ${formatMoney(totals.total)}`,
      "",
      "Standard forutsetninger:",
      "- Arealet forutsettes ryddet av kunde/oppdragsgiver før utførelse.",
      "- Riggplass for liten lastebil forutsettes innen ca. 60 m fra innblåsingspunkt.",
      "- Fri tilgang til byggestrøm, minimum 2 x 16 A.",
      "- Oppdragsgiver holder nødvendig stillas/lift ved arbeidshøyde over 2,7 m.",
      "- Deponering av emballasjeavfall utføres av tiltakshaver/entreprenør hvis ikke annet er avtalt.",
      "- Hull/tetting i diffusjonssperre og ferdig overflate utføres av oppdragsgiver hvis ikke annet er avtalt.",
      "- Prisen gjelder oppgitt areal og kan justeres etter faktisk oppmåling/medgått mengde dersom arealet endres.",
      "- Tilbudet er gyldig i 60 dager fra tilbudsdato.",
      "- Kun skriftlig aksept av tilbudet godtas før utførelse.",
      "",
      "Vedlegg som kan sendes med tilbudet:",
      "- Standard leveringsbetingelser",
      "- Produktdatablad Supafil Frame",
      "- SINTEF-godkjenning for Supafil",
      "",
      "Vi håper dette kan være av interesse, og imøteser en tilbakemelding.",
      "",
      "Med vennlig hilsen",
      "Gunnar Grette",
      "Tlf.: 93436855",
      "post.buskerud@isobygg.no",
      "iSOBYGG Buskerud",
    ].join("\n");
  }

  function insulationCustomers() {
    const search = normalizeMatch(currentInsulationSearch);
    return customers
      .filter((customer) => !customer.is_inactive)
      .filter((customer) => isInsulationCustomer(customer))
      .filter((customer) => !search || matchesSearchText(customer, search))
      .sort((a, b) => cleanDisplayName(a).localeCompare(cleanDisplayName(b), "nb"));
  }

  function renderInsulationCustomers() {
    if (!el.insulationCustomers) return;
    const list = insulationCustomers();
    if (!list.length) {
      el.insulationCustomers.innerHTML = `<div class="empty-state">Ingen kunder er tagget med blåseisolering ennå.</div>`;
      return;
    }
    el.insulationCustomers.innerHTML = list.slice(0, 150).map((customer) => {
      const key = customerKey(customer);
      return `
        <article class="insulation-customer-card">
          <div>
            <strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong>
            <span>${escapeHtml([customer.visit_city || customer.location_tag, customer.phone, addressFor(customer)].filter(Boolean).join(" · "))}</span>
            ${customer.local_note ? `<p>${escapeHtml(customer.local_note).slice(0, 180)}</p>` : ""}
          </div>
          <div class="route-card-actions">
            <button data-jump-customer="${escapeHtml(key)}" type="button">Åpne</button>
            <button data-select-insulation-customer="${escapeHtml(key)}" type="button">Tilbud</button>
            <details class="inline-more-actions">
              <summary>Mer</summary>
              <div>
                <button data-new-lead-existing-customer="${escapeHtml(key)}" data-lead-kind="blaseisolering" type="button">Ny blåseisolering</button>
                ${customer.phone ? `<a href="tel:${escapeHtml(phoneForLink(customer.phone))}">Ring</a>${copyPhoneButton(customer.phone, "Kopier")}` : ""}
                ${customerEmailLinkHtml(customer)}
                <button data-book-insulation-customer="${escapeHtml(key)}" type="button">Book blåsejobb</button>
                <button data-new-insulation-order="${escapeHtml(key)}" type="button">Ny blåsejobb</button>
              </div>
            </details>
          </div>
        </article>
      `;
    }).join("");
  }

  function syncInsulationMode() {
    const mode = insulationMode === "rental" ? "rental" : "insulation";
    insulationMode = mode;
    el.insulationModeButtons?.forEach((button) => {
      const active = button.dataset.insulationMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    el.insulationModePanels?.forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.insulationPanel !== mode);
    });
    el.insulationModeActions?.forEach((button) => {
      button.classList.toggle("hidden", button.dataset.insulationActionMode !== mode);
    });
    if (el.insulationOfferDraft) {
      el.insulationOfferDraft.placeholder = mode === "rental"
        ? "Velg kunde og trykk Lag leietilbud støvsuger."
        : "Velg kunde, legg inn m2/mengder og trykk Lag isolasjonstilbud.";
    }
  }

  function syncInsulationWorkspace() {
    const valid = new Set(["offer", "rental", "customers", "documents"]);
    if (!valid.has(currentInsulationWorkspaceTab)) currentInsulationWorkspaceTab = "offer";
    el.insulationWorkspaceTabs?.forEach((button) => {
      const active = button.dataset.insulationWorkspaceTab === currentInsulationWorkspaceTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    el.insulationWorkspacePanels?.forEach((panel) => {
      const panels = String(panel.dataset.insulationWorkspacePanel || "").split(/\s+/);
      panel.classList.toggle("hidden", !panels.includes(currentInsulationWorkspaceTab));
    });
    el.insulationLayout?.classList.toggle("single-panel", ["customers", "documents"].includes(currentInsulationWorkspaceTab));
  }

  function setInsulationWorkspaceTab(tab) {
    currentInsulationWorkspaceTab = ["offer", "rental", "customers", "documents"].includes(tab) ? tab : "offer";
    if (currentInsulationWorkspaceTab === "rental") insulationMode = "rental";
    if (currentInsulationWorkspaceTab === "offer") insulationMode = "insulation";
    syncInsulationMode();
    syncInsulationWorkspace();
  }

  function setInsulationMode(mode) {
    insulationMode = mode === "rental" ? "rental" : "insulation";
    currentInsulationWorkspaceTab = insulationMode === "rental" ? "rental" : "offer";
    syncInsulationMode();
    syncInsulationWorkspace();
  }

  function renderInsulation() {
    syncInsulationMode();
    syncInsulationWorkspace();
    renderInsulationCatalogOptions();
    renderInsulationDocuments();
    renderRentalImages();
    renderInsulationCustomerSelect();
    currentInsulationSearch = el.insulationCustomerSearch?.value?.trim() || "";
    renderInsulationLines();
    renderInsulationCustomers();
  }

  function addInsulationLine() {
    const item = insulationCatalogItem(el.insulationLineType?.value);
    const quantity = Number(el.insulationQuantity?.value || 0);
    if (!item || quantity <= 0) {
      setSyncStatus("Legg inn mengde før du legger til kalkylelinje.", "error");
      return;
    }
    insulationCalcLines.push({
      id: `ins-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      itemId: item.id,
      quantity,
      discount: Number(el.insulationDiscount?.value || 0),
    });
    saveInsulationCalc();
    renderInsulationLines();
    setSyncStatus(`${item.name} lagt til i kalkylen.`, "ok");
  }

  function removeInsulationLine(id) {
    insulationCalcLines = insulationCalcLines.filter((line) => line.id !== id);
    saveInsulationCalc();
    renderInsulationLines();
  }

  async function copyInsulationOffer() {
    await copyTextToClipboard(insulationOfferText());
    setSyncStatus("Blåseisolering-kalkyle kopiert.", "ok");
  }

  function createInsulationOfferDraft() {
    const customer = selectedInsulationCustomer();
    if (!customer) {
      setSyncStatus("Velg kunde før du lager tilbudstekst.", "error");
      return;
    }
    if (!insulationCalcLines.length) {
      setSyncStatus("Legg inn minst én kalkylelinje før du lager tilbud.", "error");
      return;
    }
    el.insulationOfferDraft.value = insulationOfferDraftText(customer);
    el.insulationOfferDraft.focus();
    setSyncStatus(`Tilbudstekst laget for ${cleanDisplayName(customer)}.`, "ok");
  }

  function createRentalOfferDraft() {
    const customer = selectedInsulationCustomer();
    if (!customer) {
      setSyncStatus("Velg kunde før du lager leietilbud.", "error");
      return;
    }
    const totals = rentalTotals();
    if (el.rentalDays) el.rentalDays.value = String(totals.days);
    el.insulationOfferDraft.value = rentalOfferDraftText(customer);
    el.insulationOfferDraft.focus();
    setSyncStatus(`Leietilbud for industristøvsuger laget for ${cleanDisplayName(customer)}.`, "ok");
  }

  async function copyInsulationOfferDraft() {
    if (!el.insulationOfferDraft?.value?.trim()) createInsulationOfferDraft();
    const text = el.insulationOfferDraft?.value?.trim() || "";
    if (!text) return;
    await copyTextToClipboard(text);
    setSyncStatus("Tilbudstekst kopiert.", "ok");
  }

  function clearInsulationCalc() {
    insulationCalcLines = [];
    saveInsulationCalc();
    if (el.insulationKm) el.insulationKm.value = "0";
    if (el.insulationToll) el.insulationToll.value = "0";
    if (el.insulationRigPrep) el.insulationRigPrep.value = "1";
    if (el.insulationRigExtra) el.insulationRigExtra.value = "0";
    if (el.insulationRigLarge) el.insulationRigLarge.value = "0";
    renderInsulationLines();
  }

  function openInsulationBooking(customerId) {
    openBookingDialog(customerId, "", {
      type: "blaseisolering",
      note: "Blåseisolering/iSOBYGG.",
    });
    el.bookingDuration.value = defaultBookingDuration("blaseisolering");
    syncBookingDialogTypeStyle();
    renderBookingMonth();
  }

  function openInsulationOrder(customerId) {
    openOrderDialog(customerId, "", { type: "blaseisolering" });
    el.orderTitleInput.value = defaultOrderTitle(findCustomer(customerId) || {}, "blaseisolering");
  }

  function leadTemplateText(templateId, customer) {
    const template = leadTemplates[templateId];
    if (!template) return "";
    return `Emne: ${offerTemplateSubject(templateId)}\n\n${offerTemplateBody(templateId, customer)}`;
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function isEmailAddress(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function mailtoUrl(to, subject = "", body = "") {
    const params = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    return `mailto:${encodeURIComponent(String(to || "").trim())}${params.length ? `?${params.join("&")}` : ""}`;
  }

  function publicDocumentUrl(doc) {
    return new URL(String(doc?.href || "").replace(/^\.\//, ""), appPublicBaseUrl).href;
  }

  function offerTemplateUsesPriceList(templateId) {
    return ["heatpump_standard_offer", "general_price_offer", "fujitsu_floor", "norgespumpa_black"].includes(String(templateId || ""));
  }

  function offerPriceListBlock() {
    return [
      "",
      "---",
      "Prisliste / prisgrunnlag:",
      `${priceListDocument.title}: ${publicDocumentUrl(priceListDocument)}`,
      "Prislisten er veiledende og oppdateres løpende. Endelig pris avklares i tilbud/ordre før utførelse.",
      "---",
    ].join("\n");
  }

  function stripOfferDocumentBlock(text) {
    return String(text || "")
      .replace(/\n*\n---\nPrisliste \/ prisgrunnlag:[\s\S]*?\n---(?=\n|$)/g, "")
      .trimEnd();
  }

  function splitEmailReferenceFooter(text) {
    const value = String(text || "").trimEnd();
    const match = value.match(/\n*\n---\nCRM-ref:\s*(NVS-[A-Z0-9]+-\d{8}-[A-Z0-9]{6})\s*$/i);
    if (!match) return { body: value, footer: "" };
    return {
      body: value.slice(0, match.index).trimEnd(),
      footer: `---\nCRM-ref: ${match[1].toUpperCase()}`,
    };
  }

  function applyOfferDocumentSelection(text, includePriceList) {
    const referenceSplit = splitEmailReferenceFooter(text);
    const clean = stripOfferDocumentBlock(referenceSplit.body);
    if (!includePriceList) return [clean, referenceSplit.footer].filter(Boolean).join("\n\n").trimEnd();
    const url = publicDocumentUrl(priceListDocument);
    const withDocument = clean.includes(url) ? clean : `${clean}\n${offerPriceListBlock()}`.trimEnd();
    return [withDocument, referenceSplit.footer].filter(Boolean).join("\n\n").trimEnd();
  }

  function emailReferenceSuffix(length = 6) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const values = new Uint32Array(length);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(values);
    } else {
      for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 65536);
    }
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  }

  function createEmailReference(prefix = "MAIL") {
    const safePrefix = String(prefix || "MAIL").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "MAIL";
    return `NVS-${safePrefix}-${isoDate(new Date()).replaceAll("-", "")}-${emailReferenceSuffix()}`;
  }

  function extractEmailReference(...values) {
    const text = values.map((value) => String(value || "")).join(" ");
    return (text.match(/\bNVS-[A-Z0-9]+-\d{8}-[A-Z0-9]{6}\b/i)?.[0] || "").toUpperCase();
  }

  function ensureEmailReference(subject, body, prefix = "MAIL") {
    const reference = extractEmailReference(subject, body) || createEmailReference(prefix);
    const cleanSubject = String(subject || "").trim();
    const { body: cleanBody } = splitEmailReferenceFooter(body);
    return {
      reference,
      subject: cleanSubject.includes(reference) ? cleanSubject : `${cleanSubject} [${reference}]`,
      body: cleanBody.includes(reference) ? cleanBody : [cleanBody, `---\nCRM-ref: ${reference}`].filter(Boolean).join("\n\n"),
    };
  }

  function emailActivityCustomerMetadata(customer, customerId = "") {
    return {
      customer_id: customerId || null,
      customer_lime_id: customer?.lime_id || customer?.legacy_lime_id || null,
      customer_key: customerId || customerKey(customer) || null,
    };
  }

  async function recordExternalEmailDraftActivity({
    customer,
    leadId = "",
    jobId = "",
    reference = "",
    from = "",
    to = "",
    subject = "",
    body = "",
    source = "external_mail",
    activityType = "email_draft_opened",
    summary = "E-postutkast åpnet",
  } = {}) {
    const customerId = customer ? customerKey(customer) : "";
    return saveActivityRecord({
      customer_id: isUuid(customerId) ? customerId : null,
      lead_id: isUuid(leadId) ? leadId : null,
      job_id: isUuid(jobId) ? jobId : null,
      activity_type: activityType,
      summary,
      body: [
        reference ? `CRM-ref: ${reference}` : "",
        to ? `Til: ${to}` : "",
        from ? `Fra: ${from}` : "",
        subject ? `Emne: ${subject}` : "",
        body ? `Utdrag:\n${String(body).slice(0, 1200)}` : "",
      ].filter(Boolean).join("\n"),
      metadata: {
        direction: "outgoing",
        external_mail_client: true,
        source,
        email_reference: reference || null,
        from: from || null,
        to: to || null,
        subject: subject || null,
        ...emailActivityCustomerMetadata(customer, customerId),
      },
    });
  }

  async function openReferencedEmailDraft({
    customer,
    leadId = "",
    jobId = "",
    from = "",
    to = "",
    subject = "",
    body = "",
    referencePrefix = "MAIL",
    source = "external_mail",
    activityType = "email_draft_opened",
    summary = "E-postutkast åpnet",
    statusMessage = "E-postutkast åpnet.",
  } = {}) {
    if (!isEmailAddress(to)) throw new Error("Mottaker mangler eller har ugyldig e-postadresse.");
    const draft = ensureEmailReference(subject, body, referencePrefix);
    const url = mailtoUrl(to, draft.subject, draft.body);
    if (url.length > 7500) {
      throw new Error("E-posten er for lang til å åpnes direkte. Kopier teksten og lim den inn manuelt i e-postprogrammet.");
    }

    let warning = "";
    try {
      await recordExternalEmailDraftActivity({
        customer,
        leadId,
        jobId,
        reference: draft.reference,
        from,
        to,
        subject: draft.subject,
        body: draft.body,
        source,
        activityType,
        summary,
      });
    } catch (error) {
      warning = error.message || "Aktivitet ble ikke lagret.";
    }

    window.location.href = url;
    setSyncStatus(
      warning
        ? `${statusMessage} CRM-ref ${draft.reference} er lagt i e-posten, men loggen på kundekortet feilet: ${warning}`
        : `${statusMessage} CRM-ref ${draft.reference} er lagt i e-posten og logget på kundekortet.`,
      warning ? "error" : "ok",
    );
    return draft;
  }

  function customerEmailDraftParts(customer, reference = "") {
    const emailReference = reference || createEmailReference("MAIL");
    const name = firstName(customer);
    const body = [
      name ? `Hei ${name}!` : "Hei!",
      "",
      "",
      "Mvh",
      "Gunnar",
      "Numedal Varmepumpeservice",
      "93436855",
      "",
      "---",
      `CRM-ref: ${emailReference}`,
    ].join("\n");
    return {
      reference: emailReference,
      to: customer.email || "",
      subject: `Numedal Varmepumpeservice - ${cleanDisplayName(customer) || "oppfølging"} [${emailReference}]`,
      body,
    };
  }

  async function openCustomerEmailDraft(customerId, reference = "") {
    const customer = findCustomer(customerId);
    if (!customer) throw new Error("Fant ikke kunden.");
    if (!isEmailAddress(customer.email)) throw new Error("Kunden mangler gyldig e-postadresse.");
    const draft = customerEmailDraftParts(customer, reference);
    await openReferencedEmailDraft({
      customer,
      to: draft.to,
      from: "post@numedalvps.no",
      subject: draft.subject,
      body: draft.body,
      referencePrefix: "MAIL",
      source: "customer_email",
      summary: "E-postutkast åpnet fra kundekort",
      statusMessage: "E-postutkast åpnet i standard e-postprogram.",
    });
  }

  function defaultLeadOfferTemplateId(entry) {
    const text = normalizeMatch([
      leadNoteForEntry(entry),
      entry?.lead?.source,
      entry?.lead?.source_detail,
      entry?.lead?.product_interest,
      entry?.customer?.tags,
      entry?.customer?.model_or_note,
    ].filter(Boolean).join(" "));
    const status = leadStatusForEntry(entry);
    if (status === "offer_sent") return "followup_offer";
    if (/\b(stovsuger|utleie|vac|leie)\b/.test(text)) return "vac_rental_offer";
    if (/\b(isobygg|blaseisolering|isolering|supafil)\b/.test(text)) return "insulation_offer";
    if (/\b(gulvmodell|floor|fujitsu)\b/.test(text)) return "fujitsu_floor";
    if (/\b(norgespumpa|sort)\b/.test(text)) return "norgespumpa_black";
    return status === "followup" ? "heatpump_info_request" : "heatpump_standard_offer";
  }

  function offerSenderOptions(selected = "post@numedalvps.no") {
    const senders = [
      { value: "post@numedalvps.no", label: "post@numedalvps.no", disabled: false },
    ];
    return senders.map((sender) => (
      `<option value="${escapeHtml(sender.value)}" ${selected === sender.value ? "selected" : ""} ${sender.disabled ? "disabled" : ""}>${escapeHtml(sender.label)}</option>`
    )).join("");
  }

  function offerTemplateOptions(selected) {
    return Object.entries(leadTemplates).map(([id, template]) => (
      `<option value="${escapeHtml(id)}" ${id === selected ? "selected" : ""}>${escapeHtml(template.title)}</option>`
    )).join("");
  }

  function offerLineDisplayLabel(item) {
    const label = String(item?.label || "").trim();
    const brand = String(item?.brand || "").trim();
    if (!brand || !offerLineItemIsHeatPump(item)) return label;
    return normalizeMatch(label).startsWith(normalizeMatch(brand)) ? label : `${brand} ${label}`;
  }

  function offerLineSearchText(item) {
    return normalizeMatch([
      item?.brand,
      item?.label,
      item?.articleNo,
      item?.articleName,
      offerLineDisplayLabel(item),
      item?.id,
      Number(item?.price || 0) > 0 ? formatJobPriceAmount(item.price) : "",
    ].filter(Boolean).join(" "));
  }

  function filteredOfferLineItems(items, query = "") {
    const search = normalizeMatch(query);
    if (!search) return items;
    return items.filter((item) => offerLineSearchText(item).includes(search));
  }

  function offerLineNoResultsOption(label) {
    return `<option value="" disabled>${escapeHtml(label)}</option>`;
  }

  function leadOfferAddress(entry) {
    const leadAddress = [
      entry?.lead?.address,
      entry?.lead?.postal_code,
      entry?.lead?.city,
    ].filter(Boolean).join(", ");
    return leadAddress || customerOfferAddress(entry?.customer) || "";
  }

  function defaultOfferContextSubject(entry, templateId = "") {
    const product = firstFilled(
      entry?.lead?.product_interest,
      entry?.customer?.model_or_note,
      entry?.customer?.brand,
    );
    if (product) return product;
    const id = templateId || defaultLeadOfferTemplateId(entry);
    if (/insulation|blaseisolering/i.test(id)) return "Blåseisolering";
    if (/service/i.test(id)) return "Service på varmepumpe";
    if (/vac|rental|stovsuger/i.test(id)) return "Leie av industristøvsuger";
    return "Varmepumpe og montering";
  }

  function offerLineOptionHtml(item, selected = "") {
    const price = Number(item.price || 0) > 0 ? ` - ${formatJobPriceAmount(item.price)} / ${item.unit}` : "";
    return `<option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(offerLineDisplayLabel(item) + price)}</option>`;
  }

  function offerLinePresetOptions(selected = "heatpump_custom", query = "") {
    const custom = offerLineOptionHtml(offerLinePresets[0], selected);
    const heatPumpMatches = filteredOfferLineItems(heatPumpOfferItems, query);
    const additionMatches = filteredOfferLineItems(jobPriceItems, query);
    const heatPumps = heatPumpMatches.length
      ? heatPumpMatches.map((item) => offerLineOptionHtml(item, selected)).join("")
      : offerLineNoResultsOption("Ingen varmepumper matcher søket");
    const additions = additionMatches.length
      ? additionMatches.map((item) => offerLineOptionHtml(item, selected)).join("")
      : offerLineNoResultsOption("Ingen tillegg matcher søket");
    return [
      custom,
      `<optgroup label="Varmepumper">${heatPumps}</optgroup>`,
      `<optgroup label="Montering og tillegg">${additions}</optgroup>`,
    ].join("");
  }

  function eaccountingCatalogItems() {
    return [...heatPumpOfferItems, ...jobPriceItems]
      .filter((item) => item && item.articleNo)
      .sort((a, b) => String(a.articleNo).localeCompare(String(b.articleNo), "nb-NO", { numeric: true }));
  }

  function eaccountingProductName(item) {
    return String(item?.articleName || offerLineDisplayLabel(item) || item?.label || "").trim();
  }

  function eaccountingProductKindLabel(item) {
    return item?.eaccountingType === "services" ? "Tjeneste" : "Vare";
  }

  function eaccountingProductRows() {
    return eaccountingCatalogItems().map((item) => {
      const priceInclVat = Number(item.price || 0);
      const priceExVat = Math.round((priceInclVat / 1.25) * 100) / 100;
      return {
        articleNo: item.articleNo,
        name: eaccountingProductName(item),
        type: eaccountingProductKindLabel(item),
        group: item.eaccountingGroup || "CRM",
        unit: item.eaccountingUnit || item.unit || "stk",
        priceInclVat,
        priceExVat,
        vatRate: 25,
        crmId: item.id,
      };
    });
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function csvAmount(value) {
    return Number(value || 0).toLocaleString("nb-NO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function eaccountingProductCsv() {
    const headers = ["Artikkelnr", "Navn", "Type", "Produktgruppe", "Enhet", "Pris inkl mva", "Pris eks mva", "Mva %", "CRM id"];
    const rows = eaccountingProductRows().map((row) => [
      row.articleNo,
      row.name,
      row.type,
      row.group,
      row.unit,
      csvAmount(row.priceInclVat),
      csvAmount(row.priceExVat),
      row.vatRate,
      row.crmId,
    ]);
    return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  }

  function leadOfferComposerHtml(entry) {
    const customer = entry?.customer || {};
    const target = leadEntryKey(entry);
    const templateId = defaultLeadOfferTemplateId(entry);
    const includePriceList = offerTemplateUsesPriceList(templateId);
    const body = applyOfferDocumentSelection(offerTemplateBody(templateId, customer), includePriceList);
    const subject = offerTemplateSubject(templateId);
    const contextSubject = defaultOfferContextSubject(entry, templateId);
    const contextAddress = leadOfferAddress(entry);
    const autoSendEnabled = offerAutoEmailEnabled();
    const autoSendDisabled = autoSendEnabled ? "" : "disabled";
    const autoSendTitle = autoSendEnabled
      ? "Send tilbud direkte fra CRM."
      : "Direkte CRM-sending er av i Innstillinger. Bruk e-postutkast og marker sendt manuelt.";
    return `
      <section class="detail-section lead-offer-section">
        <h3>Tilbud</h3>
        <div class="lead-offer-grid">
          <label>Avsender
            <select data-offer-from="${escapeHtml(target)}">
              ${offerSenderOptions("post@numedalvps.no")}
            </select>
          </label>
          <label>Mottaker
            <input data-offer-to="${escapeHtml(target)}" type="email" value="${escapeHtml(customer.email || "")}" placeholder="kunde@eksempel.no" />
          </label>
          <label>Mal
            <select data-offer-template-select="${escapeHtml(target)}">
              ${offerTemplateOptions(templateId)}
            </select>
          </label>
          <label>Emne
            <input data-offer-subject="${escapeHtml(target)}" value="${escapeHtml(subject)}" />
          </label>
        </div>
        <div class="lead-offer-documents">
          <label class="check-row">
            <input data-offer-pricelist="${escapeHtml(target)}" type="checkbox" ${includePriceList ? "checked" : ""} />
            <span>
              <strong>Legg ved prisliste som lenke</strong>
              <small>Legger PDF-lenke i e-postteksten. Selve PDF-en kan lastes ned her og legges ved manuelt ved behov.</small>
            </span>
          </label>
          <a href="${escapeHtml(priceListDocument.href)}" target="_blank" rel="noreferrer" download title="Last ned aktiv prisliste-PDF.">${escapeHtml(priceListDocument.title)}</a>
        </div>
        <div class="lead-offer-context">
          <div class="lead-offer-builder-head">
            <div>
              <strong>Tilbudsgrunnlag</strong>
              <small>Legges i e-postteksten slik kunden ser hva tilbudet gjelder.</small>
            </div>
            <label class="check-row compact">
              <input data-offer-context-include="${escapeHtml(target)}" type="checkbox" checked />
              <span>Ta med</span>
            </label>
          </div>
          <div class="lead-offer-context-grid">
            <label>Gjelder
              <input data-offer-context-subject="${escapeHtml(target)}" value="${escapeHtml(contextSubject)}" placeholder="F.eks. varmepumpe til stue/hytte" />
            </label>
            <label>Adresse/anlegg
              <input data-offer-context-address="${escapeHtml(target)}" value="${escapeHtml(contextAddress)}" placeholder="Adresse eller anleggssted tilbudet gjelder" />
            </label>
            <label>Forutsetninger/notat
              <textarea data-offer-context-note="${escapeHtml(target)}" rows="2" placeholder="F.eks. standard montering, trevegg, egen strøm, hytteadresse, flere modeller..."></textarea>
            </label>
          </div>
        </div>
        <div class="lead-offer-builder">
          <div class="lead-offer-builder-head">
            <div>
              <strong>Tilbudslinjer</strong>
              <small>Bygg opp modeller og tillegg før teksten sendes.</small>
            </div>
            <button class="secondary" data-insert-offer-lines="${escapeHtml(target)}" type="button" title="Legger tilbudsgrunnlag og tilbudslinjer inn i teksten under.">Legg i tekst</button>
          </div>
          <div class="lead-offer-line-grid">
            <label>Søk produkt/tillegg
              <input data-offer-line-search="${escapeHtml(target)}" type="search" placeholder="Søk Panasonic, HZ25, Toshiba..." />
            </label>
            <label>Prisvalg
              <select data-offer-line-preset="${escapeHtml(target)}">
                ${offerLinePresetOptions()}
              </select>
            </label>
            <label>Linje/modell
              <input data-offer-line-label="${escapeHtml(target)}" placeholder="F.eks. Mitsubishi Kaiteki 6600" />
            </label>
            <label>Antall
              <input data-offer-line-qty="${escapeHtml(target)}" type="number" min="0" step="0.25" value="1" />
            </label>
            <label>Enhet
              <input data-offer-line-unit="${escapeHtml(target)}" value="stk" />
            </label>
            <label>Pris inkl. mva
              <input data-offer-line-price="${escapeHtml(target)}" inputmode="decimal" placeholder="29900" />
            </label>
            <button class="secondary" data-add-offer-line="${escapeHtml(target)}" type="button" title="Legger linjen i listen. Kontroller teksten før du sender tilbudet.">Legg til</button>
          </div>
          <label class="check-row lead-offer-standard-installation hidden" data-offer-standard-installation-wrap="${escapeHtml(target)}">
            <input data-offer-standard-installation="${escapeHtml(target)}" type="checkbox" checked />
            <span>
              <strong>Ta med standard montering</strong>
              <small>Legges til sammen med valgt varmepumpe. Fjern avhuking hvis kunden bare skal ha produktpris.</small>
            </span>
          </label>
          <textarea data-offer-lines="${escapeHtml(target)}" rows="4" placeholder="Tilbudslinjer som skal inn i e-postteksten. Du kan også skrive her manuelt."></textarea>
          <div class="lead-offer-builder-footer">
            <small data-offer-lines-total="${escapeHtml(target)}">Ingen tilbudslinjer lagt inn.</small>
            <button class="secondary" data-clear-offer-lines="${escapeHtml(target)}" type="button">Tøm linjer</button>
          </div>
        </div>
        <textarea data-offer-text="${escapeHtml(target)}" rows="12">${escapeHtml(body)}</textarea>
        <div class="lead-offer-actions">
          <button class="secondary" data-fill-offer-template="${escapeHtml(target)}" type="button">Bruk mal</button>
          <button class="secondary" data-copy-offer-draft="${escapeHtml(target)}" type="button">Kopier tilbud</button>
          <button class="secondary" data-open-offer-mailto="${escapeHtml(target)}" type="button" title="Åpne et ferdig e-postutkast i standard e-postprogram. Marker sendt manuelt etter at e-posten faktisk er sendt.">Åpne e-postutkast</button>
          <button class="order-primary" data-mark-offer-sent-manual="${escapeHtml(target)}" type="button" title="Bruk etter at tilbudet er sendt utenfor CRM. Lagrer historikk og flytter saken til venter svar.">Marker sendt manuelt</button>
          <button class="secondary" data-send-offer-email="${escapeHtml(target)}" type="button" title="${escapeHtml(autoSendTitle)}" ${autoSendDisabled}>Send fra CRM</button>
        </div>
      </section>
    `;
  }

  function leadOfferFields(target) {
    const safe = CSS.escape(target);
    return {
      from: el.leadDetail.querySelector(`[data-offer-from="${safe}"]`),
      to: el.leadDetail.querySelector(`[data-offer-to="${safe}"]`),
      template: el.leadDetail.querySelector(`[data-offer-template-select="${safe}"]`),
      subject: el.leadDetail.querySelector(`[data-offer-subject="${safe}"]`),
      text: el.leadDetail.querySelector(`[data-offer-text="${safe}"]`),
      priceList: el.leadDetail.querySelector(`[data-offer-pricelist="${safe}"]`),
      contextInclude: el.leadDetail.querySelector(`[data-offer-context-include="${safe}"]`),
      contextSubject: el.leadDetail.querySelector(`[data-offer-context-subject="${safe}"]`),
      contextAddress: el.leadDetail.querySelector(`[data-offer-context-address="${safe}"]`),
      contextNote: el.leadDetail.querySelector(`[data-offer-context-note="${safe}"]`),
      lineSearch: el.leadDetail.querySelector(`[data-offer-line-search="${safe}"]`),
      linePreset: el.leadDetail.querySelector(`[data-offer-line-preset="${safe}"]`),
      lineLabel: el.leadDetail.querySelector(`[data-offer-line-label="${safe}"]`),
      lineQty: el.leadDetail.querySelector(`[data-offer-line-qty="${safe}"]`),
      lineUnit: el.leadDetail.querySelector(`[data-offer-line-unit="${safe}"]`),
      linePrice: el.leadDetail.querySelector(`[data-offer-line-price="${safe}"]`),
      standardInstallation: el.leadDetail.querySelector(`[data-offer-standard-installation="${safe}"]`),
      standardInstallationWrap: el.leadDetail.querySelector(`[data-offer-standard-installation-wrap="${safe}"]`),
      lines: el.leadDetail.querySelector(`[data-offer-lines="${safe}"]`),
      linesTotal: el.leadDetail.querySelector(`[data-offer-lines-total="${safe}"]`),
    };
  }

  function stripOfferLinesBlock(text) {
    return String(text || "")
      .replace(/\n*\[Tilbudslinjer\][\s\S]*?\[\/Tilbudslinjer\]/g, "")
      .trimEnd();
  }

  function stripOfferContextBlock(text) {
    return String(text || "")
      .replace(/\n*\[Tilbudsgrunnlag\][\s\S]*?\[\/Tilbudsgrunnlag\]/g, "")
      .trimEnd();
  }

  function offerContextBlock(target) {
    const fields = leadOfferFields(target);
    if (fields.contextInclude && !fields.contextInclude.checked) return "";
    const rows = [
      ["Gjelder", fields.contextSubject?.value],
      ["Adresse/anlegg", fields.contextAddress?.value],
      ["Forutsetninger", fields.contextNote?.value],
    ]
      .map(([label, value]) => [label, String(value || "").trim()])
      .filter(([, value]) => value);
    if (!rows.length) return "";
    return [
      "",
      "[Tilbudsgrunnlag]",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "[/Tilbudsgrunnlag]",
    ].join("\n");
  }

  function offerLinesBlock(linesText) {
    const lines = String(linesText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return "";
    const total = jobPriceBasisTotal(lines.join("\n"));
    return [
      "",
      "[Tilbudslinjer]",
      ...lines,
      total > 0 ? `Sum tilbudslinjer: ${formatJobPriceAmount(total)} inkl. mva` : "",
      "[/Tilbudslinjer]",
    ].filter((line) => line !== "").join("\n");
  }

  function applyOfferBuilderLinesToText(target, text) {
    const fields = leadOfferFields(target);
    const lines = String(fields.lines?.value || "").trim();
    const context = offerContextBlock(target);
    if (!lines && !context) return String(text || "");
    const referenceSplit = splitEmailReferenceFooter(text);
    const base = stripOfferDocumentBlock(stripOfferLinesBlock(stripOfferContextBlock(referenceSplit.body))).trimEnd();
    const block = offerLinesBlock(lines);
    const withLines = [base, context, block].filter(Boolean).join("\n").trimEnd();
    return [withLines, referenceSplit.footer].filter(Boolean).join("\n\n").trimEnd();
  }

  function renderOfferLinesTotal(target) {
    const fields = leadOfferFields(target);
    if (!fields.linesTotal || !fields.lines) return;
    const text = String(fields.lines.value || "").trim();
    const total = jobPriceBasisTotal(text);
    fields.linesTotal.textContent = text
      ? total > 0
        ? `Sum tilbudslinjer: ${formatJobPriceAmount(total)} inkl. mva.`
        : "Tilbudslinjer uten summerbar pris. Kontroller teksten før sending."
      : "Ingen tilbudslinjer lagt inn.";
  }

  function normalizeOfferLinesForCompare(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  }

  function offerLinesAlreadyInclude(existingText, newText) {
    const existing = normalizeOfferLinesForCompare(existingText);
    const line = normalizeOfferLinesForCompare(newText);
    return Boolean(line && `\n${existing}\n`.includes(`\n${line}\n`));
  }

  function offerLineItemIsHeatPump(item) {
    return item?.kind === "heatpump";
  }

  function standardInstallationOfferLine(quantity = 1) {
    const item = jobPriceItems.find((entry) => entry.id === "standard_installation");
    return item ? jobPriceLineForItem(item, quantity || item.defaultQty || 1) : "";
  }

  function firstOfferLineMatch(query = "") {
    const heatPump = filteredOfferLineItems(heatPumpOfferItems, query)[0];
    if (heatPump) return heatPump;
    const addition = filteredOfferLineItems(jobPriceItems, query)[0];
    return addition || offerLinePresets[0];
  }

  function syncOfferLineSearch(target) {
    const fields = leadOfferFields(target);
    if (!fields.linePreset) return;
    const query = fields.lineSearch?.value || "";
    const currentValue = fields.linePreset.value || "heatpump_custom";
    fields.linePreset.innerHTML = offerLinePresetOptions(currentValue, query);
    const available = new Set(Array.from(fields.linePreset.options).map((option) => option.value).filter(Boolean));
    const preferredValue = query.trim() && currentValue === "heatpump_custom"
      ? firstOfferLineMatch(query).id
      : currentValue;
    fields.linePreset.value = available.has(preferredValue)
      ? preferredValue
      : firstOfferLineMatch(query).id;
    syncOfferLinePreset(target);
    const searchText = query.trim();
    if (searchText && fields.linePreset.value === "heatpump_custom") {
      if (fields.lineLabel) fields.lineLabel.value = searchText;
      if (fields.lineUnit) fields.lineUnit.value = "stk";
      if (fields.lineQty) fields.lineQty.value = "1";
      if (fields.linePrice) fields.linePrice.value = "";
    }
  }

  function syncOfferLinePreset(target) {
    const fields = leadOfferFields(target);
    const item = offerLinePresets.find((entry) => entry.id === fields.linePreset?.value);
    if (!item) return;
    const heatPump = offerLineItemIsHeatPump(item);
    fields.standardInstallationWrap?.classList.toggle("hidden", !heatPump);
    if (fields.standardInstallation) fields.standardInstallation.checked = heatPump;
    if (item.id === "heatpump_custom") {
      if (fields.lineLabel && !fields.lineLabel.value.trim()) fields.lineLabel.value = "";
      if (fields.lineUnit) fields.lineUnit.value = "stk";
      if (fields.lineQty) fields.lineQty.value = "1";
      if (fields.linePrice && !fields.linePrice.value.trim()) fields.linePrice.value = "";
      return;
    }
    if (fields.lineLabel) fields.lineLabel.value = offerLineDisplayLabel(item);
    if (fields.lineUnit) fields.lineUnit.value = item.unit || "stk";
    if (fields.lineQty) fields.lineQty.value = String(item.defaultQty || 1);
    if (fields.linePrice) fields.linePrice.value = formatJobPriceAmount(item.price).replace(",-", "");
  }

  function offerLineFromBuilder(target) {
    const fields = leadOfferFields(target);
    const selected = offerLinePresets.find((entry) => entry.id === fields.linePreset?.value);
    const label = String(fields.lineLabel?.value || offerLineDisplayLabel(selected) || "").trim();
    const unit = String(fields.lineUnit?.value || selected?.unit || "stk").trim() || "stk";
    const qtyText = String(fields.lineQty?.value || selected?.defaultQty || 1).replace(",", ".");
    const qty = Number(qtyText);
    const price = parseJobPriceAmount(fields.linePrice?.value || selected?.price || 0);
    if (!label) throw new Error("Skriv inn linje/modell før du legger til tilbudslinje.");
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Antall må være større enn 0.");
    const line = price <= 0
      ? `- ${label}: ${formatJobPriceNumber(qty)} ${unit} - pris avtales/legges inn`
      : `- ${label}: ${formatJobPriceNumber(qty)} ${unit} x ${formatJobPriceAmount(price)} = ${formatJobPriceAmount(qty * price)} inkl. mva`;
    if (offerLineItemIsHeatPump(selected) && fields.standardInstallation?.checked) {
      return [line, standardInstallationOfferLine(qty)].filter(Boolean).join("\n");
    }
    return line;
  }

  function addOfferLine(target) {
    const fields = leadOfferFields(target);
    if (!fields.lines) return;
    const line = offerLineFromBuilder(target);
    const existing = String(fields.lines.value || "").trim();
    if (offerLinesAlreadyInclude(existing, line)) {
      setSyncStatus("Tilbudslinjen ligger allerede inne. Endre antall hvis kunden skal ha flere.", "");
      return;
    }
    fields.lines.value = [existing, line].filter(Boolean).join("\n");
    renderOfferLinesTotal(target);
    setSyncStatus("Tilbudslinje lagt til. Trykk Legg i tekst når tilbudet er klart.", "ok");
  }

  function insertOfferLinesIntoText(target) {
    const fields = leadOfferFields(target);
    if (!fields.text || !fields.lines) return;
    const withLines = applyOfferBuilderLinesToText(target, fields.text.value);
    const block = [offerContextBlock(target), offerLinesBlock(fields.lines.value)].filter(Boolean).join("\n").trim();
    fields.text.value = applyOfferDocumentSelection(withLines, Boolean(fields.priceList?.checked));
    renderOfferLinesTotal(target);
    focusLeadOfferFields(target);
    setSyncStatus(block ? "Tilbudsgrunnlag og linjer er lagt inn i teksten." : "Tilbudslinjer fjernet fra teksten.", "ok");
  }

  function clearOfferLines(target) {
    const fields = leadOfferFields(target);
    if (fields.lines) fields.lines.value = "";
    if (fields.text) fields.text.value = applyOfferDocumentSelection(stripOfferLinesBlock(fields.text.value), Boolean(fields.priceList?.checked));
    renderOfferLinesTotal(target);
    setSyncStatus("Tilbudslinjer tømt.", "ok");
  }

  function fillLeadOfferTemplate(target, templateId = "") {
    const entry = leadEntryForTarget(target);
    const customer = entry?.customer || {};
    const fields = leadOfferFields(target);
    const id = templateId || fields.template?.value || defaultLeadOfferTemplateId(entry);
    const template = leadTemplates[id];
    if (!template) return;
    if (fields.template) fields.template.value = id;
    if (fields.subject) fields.subject.value = offerTemplateSubject(id);
    if (fields.priceList) fields.priceList.checked = offerTemplateUsesPriceList(id);
    if (fields.text) fields.text.value = applyOfferDocumentSelection(offerTemplateBody(id, customer), Boolean(fields.priceList?.checked));
    renderOfferLinesTotal(target);
  }

  function syncLeadOfferDocuments(target) {
    const fields = leadOfferFields(target);
    if (!fields.text) return;
    fields.text.value = applyOfferDocumentSelection(fields.text.value, Boolean(fields.priceList?.checked));
  }

  function focusLeadOfferFields(target) {
    const fields = leadOfferFields(target);
    const focusTarget = fields.text || fields.subject;
    focusTarget?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => focusTarget?.focus(), 250);
    return Boolean(focusTarget);
  }

  function leadOfferPayload(target, options = {}) {
    const entry = leadEntryForTarget(target);
    if (!entry) throw new Error("Fant ikke leaden.");
    const requireEmail = options.requireEmail !== false;
    const fields = leadOfferFields(target);
    const customer = entry.customer || {};
    const to = String(fields.to?.value || "").trim();
    const subject = String(fields.subject?.value || "").trim();
    const textDraft = applyOfferBuilderLinesToText(target, String(fields.text?.value || "").trim());
    const text = applyOfferDocumentSelection(textDraft, Boolean(fields.priceList?.checked));
    if (fields.text && fields.text.value !== text) fields.text.value = text;
    if (requireEmail && !isEmailAddress(to)) throw new Error("Mottaker mangler eller har ugyldig e-postadresse.");
    if (!subject) throw new Error("Emne mangler.");
    if (!text) throw new Error("Tilbudstekst mangler.");
    const customerId = customerKey(customer);
    return {
      from: fields.from?.value || "post@numedalvps.no",
      to,
      replyTo: fields.from?.value || "post@numedalvps.no",
      subject,
      text,
      customer_id: isUuid(customerId) ? customerId : null,
      lead_id: isUuid(entry.lead?.id) ? entry.lead.id : null,
      template_id: fields.template?.value || "",
      include_price_list: Boolean(fields.priceList?.checked),
      price_list_url: Boolean(fields.priceList?.checked) ? publicDocumentUrl(priceListDocument) : "",
      source: "lead_detail",
    };
  }

  function prepareLeadOfferPayload(target, options = {}) {
    const payload = leadOfferPayload(target, options);
    const draft = ensureEmailReference(payload.subject, payload.text, "TILBUD");
    const fields = leadOfferFields(target);
    if (fields.subject) fields.subject.value = draft.subject;
    if (fields.text) fields.text.value = draft.body;
    return {
      ...payload,
      subject: draft.subject,
      text: draft.body,
      email_reference: draft.reference,
    };
  }

  async function copyLeadOfferDraft(target) {
    const payload = prepareLeadOfferPayload(target, { requireEmail: false });
    await copyTextToClipboard(`Emne: ${payload.subject}\n\n${payload.text}`);
    const entry = leadEntryForTarget(target);
    const customer = entry?.customer ? (findCustomer(leadEntryCustomerKey(entry)) || entry.customer) : null;
    try {
      await recordExternalEmailDraftActivity({
        customer,
        leadId: entry?.lead?.id || "",
        reference: payload.email_reference,
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        body: payload.text,
        source: "lead_offer_copy",
        activityType: "email_offer_draft",
        summary: "Tilbudsutkast kopiert",
      });
    } catch (_error) {
      // Kopiering skal ikke stoppes hvis historikkloggen ikke kan lagres.
    }
    setSyncStatus(`Tilbud kopiert med CRM-ref ${payload.email_reference}.`, "ok");
  }

  async function openLeadOfferMailDraft(target) {
    const payload = prepareLeadOfferPayload(target);
    const entry = leadEntryForTarget(target);
    const customer = entry?.customer ? (findCustomer(leadEntryCustomerKey(entry)) || entry.customer) : null;
    await openReferencedEmailDraft({
      customer,
      leadId: entry?.lead?.id || "",
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      body: payload.text,
      referencePrefix: "TILBUD",
      source: "lead_offer_mailto",
      activityType: "email_offer_draft",
      summary: "Tilbudsutkast åpnet",
      statusMessage: "E-postutkast åpnet. Marker tilbud sendt først etter at e-posten faktisk er sendt.",
    });
  }

  async function markLeadOfferSentManually(target) {
    const payload = prepareLeadOfferPayload(target, { requireEmail: false });
    const entry = leadEntryForTarget(target);
    if (!entry) throw new Error("Fant ikke leaden.");
    const recipientText = payload.to || cleanDisplayName(entry.customer) || "kunden";
    const ok = await askForConfirmation({
      title: "Marker tilbud sendt",
      message: `Marker at tilbudet til ${recipientText} er sendt utenfor CRM?`,
      confirmLabel: "Marker sendt",
    });
    if (!ok) return;
    setSyncStatus("Lagrer tilbud som sendt...", "");
    const customer = entry.customer ? (findCustomer(leadEntryCustomerKey(entry)) || entry.customer) : null;
    const customerId = customer ? customerKey(customer) : leadCustomerId(entry.lead);
    const body = [
      "Tilbud sendt manuelt utenfor CRM.",
      payload.email_reference ? `CRM-ref: ${payload.email_reference}` : "",
      `Mottaker: ${payload.to || "Ikke registrert"}`,
      `Avsender: ${payload.from}`,
      `Emne: ${payload.subject}`,
    ].filter(Boolean).join("\n");

    if (entry.lead?.id) {
      const updatedLead = store.isConfigured && store.updateLead
        ? updateLeadInMemory(await store.updateLead(entry.lead.id, { status: "offer_sent" }))
        : updateLeadInMemory(saveLocalLeadPatch(entry.lead.id, { status: "offer_sent" }));
      selectedLeadId = `lead:${updatedLead.id}`;
    }

    if (customer) {
      const saved = await saveCustomerInline(customer, { tags: nextTagsWithLeadStatus(customer, "offer_sent") }, "");
      await saveServiceEvent(saved || customer, {
        event_date: isoDate(new Date()),
        event_type: "Tilbud sendt",
        note: `Tilbud sendt manuelt til ${payload.to || recipientText}. Emne: ${payload.subject}`,
      });
      selectedCustomerId = customerKey(saved || customer);
      if (!entry.lead?.id) {
        await syncLeadRecord(saved || customer, "offer_sent", `Tilbud sendt manuelt: ${payload.subject}`);
        selectedLeadId = target;
      }
    }

    await saveActivityRecord({
      customer_id: customerId || null,
      lead_id: entry.lead?.id || null,
      activity_type: "email_offer_sent",
      summary: "Tilbud sendt manuelt",
      body,
      metadata: {
        direction: "outgoing",
        manual: true,
        source: "mailto",
        email_reference: payload.email_reference || null,
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        template_id: payload.template_id,
        customer_id: customerId || null,
        customer_lime_id: customer?.lime_id || null,
      },
    });

    currentLeadFilter = "offer_sent";
    if (el.leadStatusFilter) el.leadStatusFilter.value = currentLeadFilter;
    renderAll();
    setView("leads");
    setSyncStatus("Tilbud markert sendt og lagret i historikken.", "ok");
  }

  async function sendLeadOfferEmail(target) {
    if (!store.sendOfferEmail) throw new Error("Tilbudsutsending krever oppdatert serverfunksjon.");
    const payload = prepareLeadOfferPayload(target);
    const ok = await askForConfirmation({
      title: "Send tilbud",
      message: `Sende tilbud fra ${payload.from} til ${payload.to}?`,
      confirmLabel: "Send tilbud",
    });
    if (!ok) return;
    setSyncStatus("Sender tilbud...", "");
    const result = await store.sendOfferEmail(payload);
    if (!result?.ok) throw new Error(result?.error || "Klarte ikke sende tilbud.");
    const accepted = Array.isArray(result.accepted)
      ? result.accepted.map((item) => String(item?.address || item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    const rejected = Array.isArray(result.rejected)
      ? result.rejected.map((item) => String(item?.address || item || "").trim().toLowerCase()).filter(Boolean)
      : [];
    if (!result.sent || !accepted.includes(payload.to.toLowerCase()) || rejected.length) {
      throw new Error("E-postserveren bekreftet ikke mottakeren. Leaden er ikke markert som sendt.");
    }

    const entry = leadEntryForTarget(target);
    if (entry?.lead?.id) {
      updateLeadInMemory({
        ...entry.lead,
        status: "quote_sent",
        last_contact_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      selectedLeadId = `lead:${entry.lead.id}`;
    } else if (entry?.customer) {
      const key = customerKey(entry.customer);
      const customer = findCustomer(key);
      if (customer) {
        const saved = await saveCustomerInline(customer, { tags: nextTagsWithLeadStatus(customer, "offer_sent") }, "");
        await syncLeadRecord(saved || customer, "offer_sent", `Tilbud sendt: ${payload.subject}`);
      }
      selectedLeadId = target;
    }
    currentLeadFilter = "offer_sent";
    if (el.leadStatusFilter) el.leadStatusFilter.value = currentLeadFilter;
    renderAll();
    setView("leads");
    setSyncStatus("Tilbud sendt og lead satt til venter svar.", "ok");
  }

  function routeServiceDateLabel() {
    return weekdayDate(el.routeBookingDate?.value || isoDate(new Date()), { long: true });
  }

  function routeServiceAreaLabel(customer) {
    return customer?.location_tag || customer?.visit_city || "området ditt";
  }

  function routeServiceSmsText(customer) {
    const name = firstName(customer);
    const greeting = name ? `Hei ${name}.` : "Hei.";
    return [
      greeting,
      `Vi planlegger service på varmepumper i ${routeServiceAreaLabel(customer)} ${routeServiceDateLabel()}.`,
      "Ønsker du service da?",
      "Hvis det passer kommer vi tilbake med ca. klokkeslett. Fint om du kan legge ut nøkkel eller gi beskjed om adkomst hvis du ikke er hjemme.",
      "Vi forsøker å samle jobber i området for å holde reisekostnaden nede.",
      "Mvh Gunnar, Numedal Varmepumpeservice",
    ].join(" ");
  }

  function routeServiceEmailText(customer) {
    const name = firstName(customer);
    const greeting = name ? `Hei ${name}!` : "Hei!";
    const subject = `Service på varmepumpe ${routeServiceDateLabel()}`;
    const body = [
      greeting,
      "",
      `Vi planlegger service på varmepumper i ${routeServiceAreaLabel(customer)} ${routeServiceDateLabel()}.`,
      "",
      "Ønsker du service på varmepumpen da?",
      "",
      "Hvis dette passer kommer vi tilbake med ca. klokkeslett. Hvis du ikke er hjemme er det fint om du kan legge ut nøkkel eller gi beskjed om adkomst.",
      "",
      "Vi forsøker å samle flere jobber i samme område for å redusere reisekostnaden.",
      "",
      "Mvh",
      "Gunnar",
      "Numedal Varmepumpeservice",
      "93436855",
    ].join("\n");
    return `Emne: ${subject}\n\n${body}`;
  }

  function routeMessageButtons(customer) {
    const key = customerKey(customer);
    return `
      <button class="route-message-button sms" data-copy-route-message="sms" data-route-message-customer="${escapeHtml(key)}" type="button" title="Kopier ferdig SMS-tekst med fornavn og valgt servicedato.">SMS-tekst</button>
      <button class="route-message-button email" data-copy-route-message="email" data-route-message-customer="${escapeHtml(key)}" type="button" title="Kopier ferdig e-posttekst med fornavn og valgt servicedato.">E-posttekst</button>
    `;
  }

  async function copyLeadTemplate(templateId, customerId) {
    const customer = findCustomer(customerId) || findCustomer(selectedLeadId);
    if (!customer) throw new Error("Fant ikke lead.");
    const text = leadTemplateText(templateId, customer);
    if (!text) throw new Error("Fant ikke mal.");
    await copyTextToClipboard(text);
    setSyncStatus("E-postmal kopiert. Lim den inn i e-post foreløpig.", "ok");
  }

  async function copyRouteMessage(kind, customerId, button) {
    const customer = findCustomer(customerId);
    if (!customer) throw new Error("Fant ikke kunden.");
    const text = kind === "email" ? routeServiceEmailText(customer) : routeServiceSmsText(customer);
    await copyTextToClipboard(text);
    const oldText = button?.textContent || "";
    if (button) button.textContent = "Kopiert";
    setSyncStatus(kind === "email" ? "E-posttekst kopiert. Lim den inn i e-post foreløpig." : "SMS-tekst kopiert. Lim den inn i Google Messages foreløpig.", "ok");
    if (button) {
      setTimeout(() => {
        button.textContent = oldText;
      }, 1400);
    }
  }

  function phoneNumbersForCopy(phone) {
    const matches = String(phone || "").match(/\+?\d[\d\s-]{6,}\d/g) || [];
    const normalized = matches
      .map((value) => value.trim().replace(/[^\d+]/g, ""))
      .filter((value) => value.replace(/\D/g, "").length >= 8);
    const unique = [...new Set(normalized)];
    if (unique.length) return unique;
    const fallback = phoneForLink(phone);
    return fallback ? [fallback] : [];
  }

  function copyPhoneButton(phone, label = "Kopier") {
    const numbers = phoneNumbersForCopy(phone);
    if (!numbers.length) return "";
    return numbers.map((number) => {
      const buttonLabel = numbers.length > 1 ? `${label} ${number}` : label;
      return `<button class="copy-phone-button" data-copy-phone="${escapeHtml(number)}" type="button" title="Kopier telefonnummeret til utklippstavlen.">${escapeHtml(buttonLabel)}</button>`;
    }).join("");
  }

  function phoneField(phone) {
    const clean = String(phone || "").trim();
    if (!clean) return "Ikke registrert";
    return `<span>${escapeHtml(clean)}</span>${copyPhoneButton(clean)}`;
  }

  function copyEmailButton(email, label = "Kopier") {
    const clean = String(email || "").trim();
    if (!clean) return "";
    return `<button class="copy-phone-button" data-copy-email="${escapeHtml(clean)}" type="button" title="Kopier e-postadressen til utklippstavlen.">${escapeHtml(label)}</button>`;
  }

  function emailField(email) {
    const clean = String(email || "").trim();
    if (!clean) return "Ikke registrert";
    return `<span>${escapeHtml(clean)}</span>${copyEmailButton(clean)}`;
  }

  function installationKindLabel(kind) {
    if (kind === "service") return "Service";
    if (kind === "installasjon") return "Installasjon";
    if (kind === "oppdrag") return "Oppdrag";
    return "Anlegg";
  }

  function installationDateFacts(installation) {
    const facts = [];
    if (installation.installed_at) facts.push(`Installert ${formatDate(installation.installed_at)}`);
    if (installation.last_service_at) facts.push(`Siste service ${formatDate(installation.last_service_at)}`);
    if (installation.next_service_due) facts.push(`Neste service ${formatDate(installation.next_service_due)}`);
    return facts;
  }

  function installationDisplayName(installation) {
    return [
      installation.label || "Anlegg",
      [installation.brand, installation.model].filter(Boolean).join(" "),
      installation.next_service_due ? `neste ${formatDate(installation.next_service_due)}` : "",
    ].filter(Boolean).join(" · ");
  }

  function installationServicePills(installation, customer) {
    const rawText = [
      installation.notes,
      installation.kind,
      customer?.tags,
    ].filter(Boolean).join(" ");
    const text = normalizeMatch(rawText);
    const pills = [];
    const add = (label) => {
      if (label && !pills.includes(label)) pills.push(label);
    };
    if (/\bservice\s*kunde\b|\bservicekunde\b/.test(text)) add("Servicekunde");
    if (/\bikke\s+(levert|solgt|montert)\s+av\s+oss\b|\blevert\s+av\s+oss\s+(nei|no)\b|\bikke\s+var\s+levert\s+av\s+oss\b/.test(text)) add("Ikke levert av oss");
    if (/\bmegaflis\b/.test(text)) add("Leverandør: Megaflis");
    else if (/\bcoop\b/.test(text)) add("Leverandør: Coop");
    else if (/\bukjent\s+leverandor\b|\bleverandor\s+ukjent\b/.test(text)) add("Leverandør ukjent");
    else if (/\bannen\s+(leverandor|montor)\b|\bandre\s+montor\b/.test(text)) add("Annen leverandør");
    else {
      const supplier = String(rawText || "").match(/leverand(?:ør|or)\s*[:=-]\s*([^\n.;,]+)/i)?.[1]?.trim();
      if (supplier && !/^(ukjent|nei|no)$/i.test(supplier)) add(`Leverandør: ${supplier.slice(0, 32)}`);
    }
    return pills;
  }

  function renderInstallationList(customer, installations) {
    const rows = (installations || []).slice(0, 12);
    const fallback = [];
    if (!rows.length && (customer.brand || customer.model_or_note || customer.first_install_date || customer.next_service_due)) {
      fallback.push({
        label: "Hovedanlegg",
        kind: "anlegg",
        brand: customer.brand || "",
        model: customer.model_or_note || "",
        installed_at: customer.first_install_date || "",
        last_service_at: customer.last_service_date || "",
        next_service_due: customer.next_service_due || "",
        notes: "Fra kundekortets samlefelter.",
      });
    }
    const visible = rows.length ? rows : fallback;
    const key = customerKey(customer);
    const actions = isAdmin() && !customer?.is_inactive ? `
      <div class="section-actions">
        <button data-new-installation-customer="${escapeHtml(key)}" type="button">Ny varmepumpe/anlegg</button>
      </div>
    ` : "";
    if (!visible.length) {
      return `<section class="detail-section"><div class="section-title-row"><h3>Varmepumper / anlegg</h3>${actions}</div><div class="empty-state">Ingen varmepumpe/anlegg registrert ennå. Legg inn egen pumpe for hytte, ekstra pumpe hjemme eller ulik servicefrist.</div></section>`;
    }
    return `
      <section class="detail-section">
        <div class="section-title-row"><h3>Varmepumper / anlegg</h3>${actions}</div>
        <div class="installation-list">
          ${visible.map((installation) => {
            const dueKind = statusKindForDueDate(installation.next_service_due);
            const title = [installation.brand, installation.model].filter(Boolean).join(" · ") || "Modell ikke tolket";
            const dates = installationDateFacts(installation);
            const note = String(installation.notes || "").replace(/\n?Kilde:.*$/is, "").trim();
            const location = locationForInstallation(installation, customer);
            const address = locationAddressText(location);
            const access = installationAccessLabel(installation, customer);
            const realInstallation = Boolean(installation.id);
            const servicePills = installationServicePills(installation, customer);
            const primaryInstallationActions = [];
            const secondaryInstallationActions = [];
            if (isAdmin() && realInstallation) {
              primaryInstallationActions.push(`<button data-book-customer="${escapeHtml(key)}" data-book-type="service" data-book-installation="${escapeHtml(installation.id || "")}" type="button" title="Book service på akkurat dette anlegget. Anlegg, adresse og adkomst legges i notatet.">Book service på dette anlegget</button>`);
              secondaryInstallationActions.push(`<button class="secondary" data-new-lead-existing-customer="${escapeHtml(key)}" data-lead-kind="installasjon" data-lead-installation="${escapeHtml(installation.id || "")}" type="button" title="Lag en ny oppfølging/tilbud som tydelig gjelder dette anlegget.">Ny oppfølging på anlegget</button>`);
              secondaryInstallationActions.push(`<button class="secondary" data-edit-installation="${escapeHtml(installation.id)}" data-installation-customer="${escapeHtml(key)}" type="button">Rediger anlegg</button>`);
            } else if (isAdmin() && !customer?.is_inactive) {
              primaryInstallationActions.push(`<button data-new-installation-customer="${escapeHtml(key)}" data-installation-prefill="legacy" type="button" title="Åpner anleggsdialogen med pumpe-/serviceinfo fra kundekortet ferdig utfylt. Ingenting lagres før du trykker Lagre.">Gjør til anlegg</button>`);
            }
            const secondaryActionsHtml = secondaryInstallationActions.length ? `
              <details class="inline-more-actions">
                <summary title="Sjeldnere valg for dette anlegget.">Mer</summary>
                <div>${secondaryInstallationActions.join("\n")}</div>
              </details>
            ` : "";
            return `
              <article class="installation-card ${dueKind} ${installation.active === false ? "inactive" : ""}">
                <div>
                  <strong>${escapeHtml(installation.label || "Anlegg")}</strong>
                  <span>${escapeHtml(installation.active === false ? "Inaktiv" : installationServiceStatusLabel(installation))}</span>
                </div>
                <p>${escapeHtml(title)}</p>
                ${servicePills.length ? `<div class="installation-meta-pills">${servicePills.map((pill) => `<span>${escapeHtml(pill)}</span>`).join("")}</div>` : ""}
                ${address ? `<small>${escapeHtml(location.location_name || "Anleggsadresse")}: ${escapeHtml(address)}</small>` : `<small>Anleggsadresse ikke registrert</small>`}
                ${dates.length ? `<small>${escapeHtml(dates.join(" · "))}</small>` : `<small>Datoer mangler</small>`}
                <small>Serviceintervall: ${escapeHtml(installationServiceIntervalLabel(installation))}</small>
                ${access ? `<small class="access-inline">Adkomst finnes</small>` : ""}
                ${note ? `<details><summary>Notat / leverandør</summary><p>${escapeHtml(note).replaceAll("\n", "<br>")}</p></details>` : ""}
                ${renderInstallationAttachmentBlock(customer, installation)}
                <div class="installation-actions">
                  ${primaryInstallationActions.join("")}
                  ${secondaryActionsHtml}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderCustomerDetail() {
    const customer = findCustomer(selectedCustomerId);
    if (!customer) {
      el.customerDetail.innerHTML = `<div class="empty-state">Velg en kunde.</div>`;
      return;
    }
    const key = customerKey(customer);
    const invoices = invoicesByCustomer.get(key) || invoicesByCustomer.get(customer.lime_id) || [];
    const events = serviceEventsByCustomer.get(key) || serviceEventsByCustomer.get(customer.lime_id) || [];
    const installations = installationsForCustomer(customer);
    const booking = bookingRows().find((row) => customerKey(row.customer) === key);
    el.customerDetail.innerHTML = `
      <div class="customer-title">
        <div class="title-pills">
          <span class="soft-pill">${escapeHtml(customerRelationshipLabel(customer, installations))}</span>
          <span class="status ${statusKind(customer)}">${escapeHtml(customerServiceSummary(customer, installations))}</span>
          ${isStarredCustomer(customer) ? `<span class="soft-pill">Prioritert servicekunde</span>` : ""}
          ${accessInfo(customer) ? `<span class="soft-pill">Adkomst finnes</span>` : ""}
          ${isInsulationCustomer(customer) ? `<span class="soft-pill">Blåseisolering</span>` : ""}
          ${leadBadgeHtml(customer)}
        </div>
        <h2>${isAdmin() ? starToggleHtml(customer) : customerStarHtml(customer, { showEmpty: true })}${customerStatusMarkerHtml(customer, isAdmin())}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</h2>
        <p>${escapeHtml([customer.phone, customer.email, customer.visit_city || customer.location_tag].filter(Boolean).join(" · ") || "Kontaktinfo mangler")}</p>
      </div>
      <div class="action-row">
        ${customerPrimaryActionsHtml(customer)}
      </div>
      <p class="context-hint">Kundekortet samler kontaktinfo, steder, varmepumper, jobber og historikk. Book service fra riktig anlegg når kunden har flere pumper.</p>
      ${booking ? workflowHtml(bookingWorkflowState(booking), { title: "Aktiv jobbstatus", compact: true }) : ""}
      ${lookupMissingDataSection(customer)}
      ${renderDuplicateWarning(customer)}
      ${isLikelyHomeAddress(customer) ? `<section class="detail-section attention compact-warning"><h3>Mulig hjemmeadresse</h3><p>Kunden er tagget med ${escapeHtml(cabinAreaTag(customer) || "hytteområde")}, men adressen ligger i ${escapeHtml(customer.visit_city || "annet sted")}. Bruk koordinater eller kontroller anleggsadresse for rute.</p></section>` : ""}
      ${renderCustomerContactAccess(customer)}
      ${renderCustomerAttachmentSection(customer)}
      ${renderInstallationList(customer, installations)}
      ${renderCustomerOpenLeads(customer)}
      ${renderCustomerOrders(customer)}
      ${renderCustomerMoreSections(customer, events, invoices)}
    `;
  }

  function renderCustomerMoreSections(customer, events, invoices) {
    const sections = [
      renderNoteSection(customer),
      renderCustomerTagsSection(customer),
      renderServiceHistory(events, customer),
      renderCustomerActivities(customer),
      renderInvoiceList(invoices, customer),
    ].filter(Boolean);
    if (!sections.length) return "";
    return `
      <details class="customer-more-sections">
        <summary>Mer på kundekortet</summary>
        <div>${sections.join("")}</div>
      </details>
    `;
  }

  function renderCustomerContactAccess(customer) {
    const mainAddress = addressFor(customer) || customer.location_tag || customer.visit_city || "";
    const primaryLocation = primaryLocationForCustomer(customer);
    const siteAddress = locationAddressText(primaryLocation) || mainAddress;
    const access = accessInfo(customer);
    const structuredAccess = structuredAccessInfo(customer);
    const suggestedAccess = suggestedAccessInfo(customer);
    const key = customerKey(customer);
    const actions = [];
    if (isAdmin() && !customer?.is_inactive) {
      actions.push(`<button class="secondary" data-edit-access="${escapeHtml(key)}" type="button" title="Åpne kundeskjemaet direkte på adkomstfeltet.">Rediger adkomst</button>`);
      if (!structuredAccess && access) {
        actions.push(`<button data-promote-access="${escapeHtml(key)}" type="button" title="Lagrer dagens adkomsttekst som eget adkomstnotat i databasen.">Lagre som adkomstnotat</button>`);
      } else if (!access && suggestedAccess) {
        actions.push(`<button data-edit-access="${escapeHtml(key)}" data-access-prefill="suggested" type="button" title="Åpner kundeskjemaet med foreslått adkomsttekst fra gamle notater/tags. Kontroller før lagring.">Foreslå fra notat</button>`);
      }
    }
    return `
      <section class="detail-section contact-access-section">
        <div class="section-title-row">
          <h3>Kontakt og adkomst</h3>
          ${actions.length ? `<div class="section-actions">${actions.join("")}</div>` : ""}
        </div>
        <dl class="facts compact">
          <div><dt>Telefon</dt><dd class="copy-field">${phoneField(customer.phone)}</dd></div>
          <div><dt>E-post</dt><dd class="copy-field">${emailField(customer.email)}</dd></div>
          <div><dt>Postadresse</dt><dd>${escapeHtml(postalAddressFor(customer) || "Ikke registrert")}</dd></div>
          <div><dt>Anleggsadresse</dt><dd>${escapeHtml(siteAddress || "Ikke registrert")}</dd></div>
          <div><dt>Adkomst</dt><dd>${access ? `<strong>Adkomst finnes</strong><br>${escapeHtml(access).replaceAll("\n", "<br>")}` : "Ikke registrert"}</dd></div>
        </dl>
        ${!access && suggestedAccess ? `<p class="context-hint">Mulig adkomstinfo funnet i eldre notat/tag. Kontroller før lagring.</p>` : ""}
      </section>
    `;
  }

  function importantCustomerTags(customer) {
    const wanted = /(blåseisolering|blaseisolering|isobygg|servicekunde|hytte|vegglifjell|blefjell|fagerfjell|nøkkelboks|nokkelboks|kodeboks|prioritert|gullkunde|stjerne)/i;
    return customerDisplayTags(customerVisibleTags(customer).filter((tag) => wanted.test(tag))).slice(0, 6);
  }

  function renderCustomerTagsSection(customer) {
    const activeTags = customerDisplayTags(customerVisibleTags(customer));
    const hiddenImportCount = splitTags(customer.tags).filter((tag) => isLegacyImportTag(tag) && !isCustomerMarkerTag(tag)).length;
    if (!activeTags.length && !hiddenImportCount) return "";
    const activeText = activeTags.length
      ? `${activeTags.length.toLocaleString("nb-NO")} aktiv${activeTags.length === 1 ? "" : "e"}`
      : "Ingen aktive";
    const hiddenText = hiddenImportCount
      ? `${hiddenImportCount.toLocaleString("nb-NO")} gammel${hiddenImportCount === 1 ? "" : "e"} importtagg${hiddenImportCount === 1 ? "" : "er"} skjult`
      : "";
    return `
      <section class="detail-section compact-tags-section">
        <details class="compact-tags-details">
          <summary>
            <span>
              <strong>Tagger</strong>
              <small>${escapeHtml([activeText, hiddenText].filter(Boolean).join(" · "))}</small>
            </span>
            <em>Vis tagger</em>
          </summary>
          ${activeTags.length ? `<div class="tag-row">${activeTags.map((tag) => `<span class="soft-pill">${escapeHtml(tag)}</span>`).join("")}</div>` : `<p class="muted">Ingen aktive tagger å vise.</p>`}
          ${hiddenImportCount ? `<p class="muted">Gamle importtagger er skjult her. De kan ryddes i Innstillinger.</p>` : ""}
        </details>
      </section>
    `;
  }

  function openLeadEntriesForCustomer(customer) {
    const key = customerKey(customer);
    const dbEntries = allLeadEntries().filter((entry) => leadEntryCustomerKey(entry) === key && !["won", "lost"].includes(leadStatusForEntry(entry)));
    if (dbEntries.length) return dbEntries;
    return isLeadCustomer(customer) && !["won", "lost"].includes(leadStatusForCustomer(customer))
      ? [{ customer, lead: leadForCustomer(customer) }]
      : [];
  }

  function leadTypeLabelForEntry(entry) {
    const text = normalizeMatch([
      entry?.lead?.product_interest,
      entry?.lead?.source_detail,
      entry?.lead?.source,
      leadNoteForEntry(entry),
      entry?.customer?.tags,
    ].filter(Boolean).join(" "));
    if (/\b(blaseisolering|isobygg|isolering|supafil)\b/.test(text)) return "Blåseisolering";
    if (/\b(service|reparasjon|feil|drypp|stoy|støy)\b/.test(text)) return "Serviceforespørsel";
    if (/\b(befaring|bilder|se pa|se på)\b/.test(text)) return "Befaring";
    if (/\b(utskifting|bytte|ny pumpe|varmepumpe|installasjon)\b/.test(text)) return "Ny varmepumpe";
    return "Annet";
  }

  function renderCustomerOpenLeads(customer) {
    const entries = openLeadEntriesForCustomer(customer).slice(0, 6);
    const key = customerKey(customer);
    const actions = isAdmin() && !customer?.is_inactive ? `
      <div class="section-actions">
        <button class="secondary" data-new-lead-existing-customer="${escapeHtml(key)}" type="button">Ny oppfølging</button>
      </div>
    ` : "";
    if (!entries.length) {
      return `<section class="detail-section"><div class="section-title-row"><h3>Åpne oppfølginger / tilbud</h3>${actions}</div><div class="empty-state">Ingen åpne oppfølginger eller tilbud på kunden.</div></section>`;
    }
    return `
      <section class="detail-section">
        <div class="section-title-row"><h3>Åpne oppfølginger / tilbud</h3>${actions}</div>
        <div class="customer-order-list">
          ${entries.map((entry) => {
            const target = leadEntryKey(entry) || key;
            const status = leadStatusForEntry(entry);
            const note = leadNoteForEntry(entry);
            const existingLeadOrder = entry?.lead?.id ? orderForLeadId(entry.lead.id) : null;
            return `
              <article>
                <div>
                  <strong>${escapeHtml(leadTypeLabelForEntry(entry))} · ${escapeHtml(leadStatusLabel(status))}</strong>
                  <span>${escapeHtml(note || "Ingen notat").slice(0, 140)}</span>
                </div>
                <button data-open-lead-entry="${escapeHtml(target)}" type="button">Åpne</button>
                ${status === "won" ? (existingLeadOrder
                  ? `<button class="order-primary" data-open-order="${escapeHtml(existingLeadOrder.id)}" type="button">Åpne jobb</button>`
                  : `<button class="order-primary" data-create-order-from-lead="${escapeHtml(target)}" type="button">Opprett jobb</button>
                <details class="inline-more-actions"><summary>Mer</summary><div>
                  <button class="secondary" data-create-order-and-book-from-lead="${escapeHtml(target)}" type="button">Opprett jobb og book direkte</button>
                </div></details>`) : ""}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function lastServiceText(customer, events) {
    const dates = [
      customer.last_service_date,
      ...(String(customer.service_dates || "").match(/\d{4}-\d{2}-\d{2}/g) || []),
      ...(events || [])
        .filter((event) => /utført|utfort|faktura|kontant|cash/i.test(`${event.event_type || ""} ${event.note || ""}`))
        .map((event) => event.event_date),
    ].filter(Boolean).sort();
    return dates.length ? formatDate(dates.at(-1)) : "Ikke registrert";
  }

  function legacyServiceReminderSource(event) {
    const note = repairTextEncoding(event?.note || "");
    const original = note.match(/Original tekst:\s*([^\n]+)/i)?.[1] || "";
    return (original || shortEventNote(note)).replace(/[•·]/g, " ").replace(/\s+/g, " ").trim();
  }

  function legacyPumpModelFromText(value) {
    const text = repairTextEncoding(value || "");
    const modelPatterns = [
      [/\bnz\s*25\s*(yke)?\b/i, "NZ25YKE"],
      [/\bnz\s*35\s*(yke)?\b/i, "NZ35YKE"],
      [/\bhz\s*25\s*(xke|zke|yke)?\b/i, (match) => `HZ25${(match[1] || "").toUpperCase()}`],
      [/\bcz\s*25\s*(?:tke|wke|zke|yke)?\b/i, "CZ25"],
      [/\bz\s*25\b/i, "Z25 gulvmodell"],
      [/\bsamsung\s+smart\s*9\b/i, "Samsung Smart 9"],
      [/\bsmart\s*9\b/i, "Smart 9"],
      [/\bkaiteki\b/i, "Kaiteki"],
      [/\bhara\b/i, "Hara"],
      [/\biguru\b/i, "Iguru"],
    ];
    for (const [pattern, label] of modelPatterns) {
      const match = text.match(pattern);
      if (match) return typeof label === "function" ? label(match) : label;
    }
    return "";
  }

  function brandFromPumpModel(model, source = "") {
    const text = normalizeMatch(`${model || ""} ${source || ""}`);
    if (/\b(hz|nz|cz)\s*\d|\bz\s*(25|35)\b|\bpanasonic\b/.test(text)) return "Panasonic";
    if (/\b(samsung|smart 9|vindfree)\b/.test(text)) return "Samsung";
    if (/\b(kaiteki|hara|iguru|mitsubishi)\b/.test(text)) return "Mitsubishi";
    if (/\b(wilfa|narvik)\b/.test(text)) return "Wilfa";
    if (/\b(fujitsu|norgespumpa)\b/.test(text)) return "Fujitsu";
    return "";
  }

  function legacyReminderLocationLabel(source, model) {
    let text = repairTextEncoding(source || "")
      .split(/[|]/)[0]
      .replace(/^\s*service\s*/i, "")
      .trim();
    text = text
      .replace(/\b(hz|nz|cz)\s*\d{0,2}\s*(xke|zke|yke)?\b/i, "")
      .replace(/\bz\s*25\b/i, "")
      .replace(/\bsamsung\s+smart\s*9\b/i, "")
      .replace(/\bsmart\s*9\b/i, "")
      .replace(/\b(kaiteki|hara|iguru)\b/i, "")
      .replace(model ? new RegExp(escapeRegex(model), "i") : /$^/, "")
      .replace(/\s+/g, " ")
      .trim();
    return text.length >= 3 ? text : "";
  }

  function legacyServiceReminderInfo(event) {
    const text = repairTextEncoding(`${event?.event_type || ""}\n${event?.note || ""}`);
    if (!/(lime go|servicepåminnelse|servicepaminnelse|fremtidig servicefrist|original tekst:\s*service)/i.test(text)) return null;
    const source = legacyServiceReminderSource(event);
    const model = legacyPumpModelFromText(source || text);
    const brand = brandFromPumpModel(model, source || text);
    const locationLabel = legacyReminderLocationLabel(source, model);
    const isFuture = /fremtidig|frist/i.test(text) || String(event?.event_date || "") > isoDate(new Date());
    return { source, model, brand, locationLabel, isFuture };
  }

  function installationPrefillFromServiceEvent(event, customer) {
    const info = legacyServiceReminderInfo(event) || {};
    const label = info.locationLabel
      ? `Anlegg ${info.locationLabel}`
      : info.model
        ? `Anlegg ${info.model}`
        : `Anlegg ${installationsForCustomer(customer).length + 1}`;
    const notes = [
      "Opprettet fra importert Lime Go-servicepåminnelse. Kontroller modell, installasjonsdato, adresse og serviceintervall før lagring.",
      info.source ? `Importtekst: ${info.source}` : "",
      event?.event_date ? `Påminnelsesdato: ${formatDate(event.event_date)}` : "",
      shortEventNote(event?.note || ""),
    ].filter(Boolean).join("\n");
    return {
      label,
      brand: info.brand || "",
      model: info.model || "",
      next_service_due: info.isFuture ? event?.event_date || "" : "",
      last_service_at: !info.isFuture ? event?.event_date || "" : "",
      service_interval_months: 24,
      notes,
      forceNewLocation: Boolean(info.locationLabel),
      location_name: info.locationLabel || "",
    };
  }

  function openInstallationFromServiceReminder(eventKey, customerId) {
    const customer = findCustomer(customerId);
    const event = findServiceEventByKey(eventKey);
    if (!customer || !event) {
      setSyncStatus("Fant ikke påminnelsen eller kundekortet.", "error");
      return;
    }
    openInstallationDialog(customerKey(customer), "", {
      prefill: installationPrefillFromServiceEvent(event, customer),
    });
    setSyncStatus("Forslag til nytt anlegg er fylt ut fra gammel påminnelse. Kontroller før du lagrer.", "ok");
  }

  function renderServiceHistory(events, customer = null) {
    const visible = (events || []).slice(0, 6);
    if (!visible.length) {
      return `<section class="detail-section"><h3>Historikk / servicepåminnelser</h3><div class="empty-state">Ingen historikk importert på denne kunden ennå.</div></section>`;
    }
    return `
      <section class="detail-section">
        <h3>Historikk / servicepåminnelser</h3>
        <div class="timeline-list">
          ${visible.map((event) => {
            const reminder = legacyServiceReminderInfo(event);
            return `
              <article class="${reminder ? "legacy-reminder" : ""}">
                <time>${formatDate(event.event_date)}</time>
                <strong>${escapeHtml(event.event_type || "Historikk")}</strong>
                <p>${escapeHtml(shortEventNote(event.note || "")).replaceAll("\n", "<br>")}</p>
                ${reminder ? `
                  <small class="timeline-hint">Importert servicepåminnelse${reminder.model ? ` · ${escapeHtml(reminder.model)}` : ""}${reminder.locationLabel ? ` · ${escapeHtml(reminder.locationLabel)}` : ""}. Dette er ikke bekreftet som utført service.</small>
                  ${customer && isAdmin() ? `<button class="secondary" data-installation-from-event="${escapeHtml(serviceEventKey(event))}" data-installation-event-customer="${escapeHtml(customerKey(customer))}" type="button" title="Lag forslag til varmepumpe/anlegg fra denne gamle påminnelsen. Du kontrollerer og lagrer selv.">Lag anlegg fra påminnelse</button>` : ""}
                ` : ""}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function activitiesForCustomer(customer) {
    const keys = new Set([
      customerKey(customer),
      customer?.id,
      customer?.lime_id,
      customer?.legacy_lime_id,
    ].filter(Boolean).map(String));
    return (activities || [])
      .filter((activity) => {
        const metadata = activity?.metadata || {};
        return keys.has(String(activity?.customer_id || ""))
          || keys.has(String(activity?.customerId || ""))
          || keys.has(String(metadata.customer_id || ""))
          || keys.has(String(metadata.customer_lime_id || ""))
          || keys.has(String(metadata.customer_key || ""));
      })
      .filter((activity) => !["status_change", "lead_status"].includes(String(activity.activity_type || "").toLowerCase()))
      .sort((a, b) => activityTime(b.occurred_at || b.created_at) - activityTime(a.occurred_at || a.created_at));
  }

  function activityTypeLabel(type) {
    const value = String(type || "").toLowerCase();
    if (value === "email_history") return "E-post";
    if (value === "email_draft_opened") return "E-postutkast";
    if (value === "email_offer_draft") return "Tilbudsutkast";
    if (value === "email_offer_sent") return "Tilbud sendt";
    if (value === "email_offer_failed") return "Tilbud feilet";
    if (value === "email_received") return "E-post mottatt";
    if (value === "email_sent") return "E-post sendt";
    if (value === "website_submission") return "Nettside";
    if (value === "note") return "Notat";
    if (value === "reminder") return "Påminnelse";
    if (value === "reminder_done") return "Påminnelse ferdig";
    if (value === "job_price_basis_updated") return "Fakturagrunnlag";
    if (value === "job_completed") return "Jobb fullført";
    return "Aktivitet";
  }

  function renderCustomerActivities(customer) {
    const visible = activitiesForCustomer(customer).slice(0, 8);
    if (!visible.length) return "";
    return `
      <section class="detail-section">
        <h3>Aktivitet / e-post</h3>
        <div class="timeline-list">
          ${visible.map((activity) => {
            const metadata = activity.metadata || {};
            const direction = metadata.direction === "incoming" ? "Inn" : metadata.direction === "outgoing" ? "Ut" : "";
            const folder = metadata.folder || metadata.source_folder || "";
            const reference = metadata.email_reference || extractEmailReference(activity.summary, activity.body, metadata.subject);
            const hint = [activityTypeLabel(activity.activity_type), direction, reference ? `Ref ${reference}` : "", folder].filter(Boolean).join(" · ");
            return `
              <article>
                <time>${formatDate(activity.occurred_at || activity.created_at)}</time>
                <strong>${escapeHtml(activity.summary || activityTypeLabel(activity.activity_type))}</strong>
                <p>${escapeHtml(shortEventNote(activity.body || "") || activityTypeLabel(activity.activity_type)).replaceAll("\n", "<br>")}</p>
                ${hint ? `<small class="timeline-hint">${escapeHtml(hint)}</small>` : ""}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function shortEventNote(note) {
    const text = String(note || "")
      .replace(/\n?Kilde:.*$/is, "")
      .replace(/Service burde vært gjort \/ følges opp\.\s*/i, "")
      .trim();
    const original = text.match(/\n?Original tekst:\s*([^\n]+)/i)?.[1] || "";
    const withoutOriginal = text.replace(/\n?Original tekst:\s*[^\n]+/i, "").trim();
    return (withoutOriginal || original)
      .slice(0, 360);
  }

  function renderInvoiceList(invoices, customer) {
    const visible = (invoices || []).slice(0, 6);
    const paymentBlock = isAdmin() && customer ? `
      <div class="invoice-payment-row">
        <div>
          <strong>Betaling</strong>
          <span>Faktura er standard. Bruk betaling på stedet bare når kunden normalt betaler kontant.</span>
        </div>
        ${paymentControlsHtml(customer)}
      </div>
    ` : "";
    if (!visible.length) {
      return `<section class="detail-section"><h3>Fakturaer</h3>${paymentBlock}<div class="empty-state">Ingen faktura koblet ennå.</div></section>`;
    }
    return `
      <section class="detail-section">
        <h3>Fakturaer</h3>
        ${paymentBlock}
        <div class="invoice-list">
          ${visible.map((invoice) => {
            const href = invoiceHref(invoice);
            return `
              <article>
                <div>
                  <strong>${escapeHtml(invoice.invoice_number ? `Faktura ${invoice.invoice_number}` : invoice.file_name || "Faktura")}</strong>
                  <span>${formatDate(invoice.date || invoice.invoice_date)}${invoice.amount ? ` · ${formatMoney(invoice.amount)}` : ""}</span>
                  ${invoice.description ? `<p>${escapeHtml(String(invoice.description).slice(0, 220))}</p>` : ""}
                </div>
                ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Vis</a>` : ""}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function invoiceHref(invoice) {
    const value = invoice.file_url || "";
    if (!value) return "";
    if (/^https?:/i.test(value)) return value;
    if (value.startsWith("./")) return `../numedal-crm-app/${value.slice(2)}`;
    return value;
  }

  function formatMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(number);
  }

  function renderNoteSection(customer) {
    const note = customer.local_note || customer.latest_deal_name || "";
    if (!note) return "";
    return `<section class="detail-section"><h3>Notat</h3><div class="note-box">${escapeHtml(note)}</div></section>`;
  }

  function renderPlanning() {
    const weekEnd = shiftDate(weekStart, 6);
    el.weekLabel.textContent = `Uke ${isoWeekNumber(weekStart)} · ${formatDate(isoDate(weekStart))} - ${formatDate(isoDate(weekEnd))}`;
    el.previousWeekButton.textContent = planningMode === "month" ? "Forrige måned" : "Forrige uke";
    el.nextWeekButton.textContent = planningMode === "month" ? "Neste måned" : "Neste uke";
    el.todayButton.textContent = planningMode === "month" ? "Denne måneden" : "Denne uken";
    el.planningWeekModeButton?.classList.toggle("active", planningMode === "week");
    el.planningMonthModeButton?.classList.toggle("active", planningMode === "month");
    el.planningMonthOverview?.classList.toggle("hidden", planningMode !== "month");
    el.planningBoard.innerHTML = "";
    const allRows = bookingRows();
    renderPlanningResourceOptions(allRows);
    const rows = filteredPlanningRows(allRows);
    if (planningMode === "month") renderPlanningMonthOverview(rows);
    for (let offset = 0; offset < 7; offset += 1) {
      const day = shiftDate(weekStart, offset);
      const dayIso = isoDate(day);
      const today = isTodayIso(dayIso);
      const dayRows = rows
        .filter((row) => row.booking.date === dayIso)
        .sort((a, b) => bookingRowStartMinutes(a) - bookingRowStartMinutes(b));
      const column = document.createElement("section");
      column.className = `planning-day ${today ? "today" : ""} ${dayRows.length ? "has-jobs" : "is-empty"}`;
      column.dataset.planningDate = dayIso;
      column.innerHTML = `
        <div class="day-head">
          <strong>${new Intl.DateTimeFormat("nb-NO", { weekday: "short" }).format(day)}</strong>
          <span>${formatDate(dayIso)}</span>
          ${today ? `<small>I dag</small>` : ""}
          <em>${dayRows.length} jobb${dayRows.length === 1 ? "" : "er"}</em>
        </div>
        <div class="drop-hint">Slipp i tidslinjen for klokkeslett i 15-minutters steg, eller over en jobb for før/etter.</div>
        ${planningDayTimeline(dayRows, dayIso)}
        <div class="day-jobs"></div>
      `;
      const list = column.querySelector(".day-jobs");
      if (!dayRows.length) list.innerHTML = `<div class="empty-state">Ledig</div>`;
      for (const row of dayRows) list.appendChild(jobCard(row, true));
      el.planningBoard.appendChild(column);
    }
    scrollPlanningBoardToRelevantDay();
  }

  function scrollPlanningBoardToRelevantDay() {
    if (!el.planningBoard || planningMode !== "week") return;
    if (!window.matchMedia?.("(max-width: 760px)").matches) return;
    const target = el.planningBoard.querySelector(".planning-day.today") || el.planningBoard.querySelector(".planning-day.has-jobs") || el.planningBoard.querySelector(".planning-day");
    if (!target) return;
    window.requestAnimationFrame(() => {
      const left = Math.max(0, target.offsetLeft - el.planningBoard.offsetLeft - 2);
      el.planningBoard.scrollTo({ left, behavior: "auto" });
    });
  }

  function renderPlanningMonthOverview(rows) {
    if (!el.planningMonthGrid || !el.planningMonthLabel) return;
    const base = new Date(planningMonthCursor);
    const month = base.getMonth();
    const year = base.getFullYear();
    const selectedWeekEnd = shiftDate(weekStart, 6);
    const formatter = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" });
    el.planningMonthLabel.textContent = formatter.format(base);
    const firstDayOffset = (new Date(year, month, 1).getDay() || 7) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthRows = rows.filter((row) => {
      const date = new Date(`${row.booking.date}T00:00:00`);
      return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month;
    });
    const totalMinutes = monthRows.reduce((sum, row) => sum + bookingDurationMinutes(row), 0);
    const bookedDays = new Set(monthRows.map((row) => row.booking.date)).size;
    if (el.planningMonthSummary) {
      el.planningMonthSummary.textContent = `${monthRows.length} jobber · ${formatDuration(totalMinutes)} booket · ${bookedDays} dager med jobb`;
    }
    const cells = [
      ...["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => `<div class="month-weekday">${day}</div>`),
    ];
    for (let i = 0; i < firstDayOffset; i += 1) cells.push(`<div class="month-empty"></div>`);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayRows = rows.filter((row) => row.booking.date === date);
      const counts = bookingTypeCounts(dayRows);
      const load = bookingLoadKind(dayRows);
      const minutes = dayRows.reduce((sum, row) => sum + bookingDurationMinutes(row), 0);
      const inSelectedWeek = date >= isoDate(weekStart) && date <= isoDate(selectedWeekEnd);
      const today = isTodayIso(date);
      const title = dayRows.length
        ? `${dayRows.length} jobber, ${formatDuration(minutes)} booket. Klikk for å vise uken.`
        : "Ledig. Klikk for å vise uken.";
      cells.push(`
        <button class="month-day planning-month-day ${load} ${inSelectedWeek ? "selected" : ""} ${today ? "today" : ""}" data-planning-date="${date}" type="button" title="${escapeHtml(today ? `I dag. ${title}` : title)}">
          <span>${day}</span>
          <em>${dayRows.length ? `${dayRows.length} jobb${dayRows.length === 1 ? "" : "er"}` : "Ledig"}</em>
          <small>${minutes ? formatDuration(minutes) : ""}</small>
          <b>
            ${counts.service ? `<i class="service"></i>` : ""}
            ${counts.reparasjon ? `<i class="reparasjon"></i>` : ""}
            ${counts.befaring ? `<i class="befaring"></i>` : ""}
            ${counts.installasjon ? `<i class="installasjon"></i>` : ""}
            ${counts.blaseisolering ? `<i class="blaseisolering"></i>` : ""}
          </b>
        </button>
      `);
    }
    el.planningMonthGrid.innerHTML = cells.join("");
  }

  function planningTimelineDropZones(dayIso, workStart, workEnd) {
    const workSpan = workEnd - workStart;
    const zones = [];
    for (let minutes = workStart; minutes < workEnd; minutes += 15) {
      if (minutes < workStart || minutes >= workEnd) continue;
      const top = ((minutes - workStart) / workSpan) * 100;
      const height = (15 / workSpan) * 100;
      const label = timeFromMinutes(minutes);
      const marker = minutes % 60 === 0 ? "hour" : minutes % 30 === 0 ? "half" : "quarter";
      zones.push(`
        <div
          class="timeline-drop-zone ${marker}"
          data-planning-date="${escapeHtml(dayIso)}"
          data-planning-time="${label}"
          style="top:${top.toFixed(2)}%;height:${height.toFixed(2)}%"
        >
          <span>${label}</span>
        </div>
      `);
    }
    return zones.join("");
  }

  function planningRowsForDropDate(dayIso, draggedRow) {
    const resource = String(draggedRow?.booking?.resource || "").trim();
    return bookingRows()
      .filter((row) => row.id !== draggedRow?.id && row.booking.date === dayIso)
      .filter((row) => !resource || String(row.booking.resource || "").trim() === resource)
      .sort((a, b) => bookingRowStartMinutes(a) - bookingRowStartMinutes(b));
  }

  function planningFallbackDropPlacement(dayIso, draggedRow) {
    const duration = draggedRow ? bookingDurationMinutes(draggedRow) : 60;
    const rows = planningRowsForDropDate(dayIso, draggedRow);
    const slots = freeSlotsForDay(rows);
    const fittingSlot = slots.find((slot) => slot.end - slot.start >= duration) || slots[0];
    if (fittingSlot) {
      const time = timeFromMinutes(clampPlanningMinutes(fittingSlot.start));
      return { time, label: `første ledige kl. ${time}` };
    }
    const time = "09:00";
    return { time, label: `kl. ${time}` };
  }

  function planningDayTimeline(rows, dayIso = "") {
    const workStart = minutesFromTime("08:00");
    const workEnd = minutesFromTime("18:00");
    const workSpan = workEnd - workStart;
    const sorted = [...rows].sort((a, b) => bookingRowStartMinutes(a) - bookingRowStartMinutes(b));
    const bookedMinutes = sorted.reduce((sum, row) => {
      const start = Math.max(workStart, bookingRowStartMinutes(row));
      const end = Math.min(workEnd, bookingRowEndMinutes(row));
      return sum + Math.max(0, end - start);
    }, 0);
    const freeMinutes = Math.max(0, workSpan - bookedMinutes);
    const hourMarks = [8, 10, 12, 14, 16, 18].map((hour) => {
      const minutes = hour * 60;
      const top = ((minutes - workStart) / workSpan) * 100;
      const label = `${String(hour).padStart(2, "0")}:00`;
      return `
        <span class="timeline-hour-label" style="top:${top.toFixed(2)}%">${label}</span>
        <i class="timeline-hour-line" style="top:${top.toFixed(2)}%"></i>
      `;
    }).join("");
    const events = sorted.map((row) => {
      const start = Math.max(workStart, bookingRowStartMinutes(row));
      const end = Math.min(workEnd, bookingRowEndMinutes(row));
      if (end <= workStart || start >= workEnd || end <= start) return "";
      const top = ((start - workStart) / workSpan) * 100;
      const height = Math.max(6.5, ((end - start) / workSpan) * 100);
      const type = bookingDisplayType(row);
      const done = row.booking.status === "done" || doneJobs.has(row.id);
      const settled = bookingIsSettledForPlanning(row);
      const draggable = Boolean(isAdmin() && !done);
      const overlap = bookingOverlapForRow(row, sorted);
      const needsMove = bookingNeedsMove(row);
      const paymentMode = bookingPaymentMode(row);
      const linkedOrder = linkedOrderForBooking(row.id) || findOrder(row.booking.orderId);
      const installationText = linkedOrder ? orderInstallationText(linkedOrder, row.customer, jobForOrder(linkedOrder)) : "";
      const statusBits = [];
      if (overlap) statusBits.push("Overlapp");
      if (needsMove) statusBits.push("Må flyttes");
      if (done) statusBits.push("Utført");
      if (bookingNeedsSalesFollowup(row)) statusBits.push("Tilbud/salg");
      if (bookingNeedsInvoice(row)) statusBits.push("Må faktureres");
      if (bookingNeedsCashPayment(row)) statusBits.push("Betaling ikke registrert");
      if (paymentMode === "invoice") statusBits.push("Fakturert");
      if (paymentMode === "cash") statusBits.push("Betalt på stedet");
      if (settled) statusBits.push("Ferdigbehandlet");
      if (bookingNeedsCompletion(row)) statusBits.push("Dato passert");
      const statusText = statusBits.join(" · ");
      const title = `${statusText ? `${statusText}: ` : ""}${bookingJobLabel(row)} ${timeRangeText(bookingRowStartMinutes(row), bookingRowEndMinutes(row))}: ${cleanDisplayName(row.customer)}${installationText ? ` - ${installationText}` : ""}`;
      return `
        <article
          class="timeline-event ${escapeHtml(type)} ${done ? "done" : ""} ${settled ? "settled" : ""} ${needsMove ? "needs-move" : ""} ${overlap ? "overlap" : ""}"
          style="top:${top.toFixed(2)}%;height:${height.toFixed(2)}%"
          data-customer-id="${escapeHtml(customerKey(row.customer))}"
          data-booking-id="${escapeHtml(row.id)}"
          draggable="${draggable ? "true" : "false"}"
          title="${escapeHtml(title)}"
        >
          <strong>${timeRangeText(bookingRowStartMinutes(row), bookingRowEndMinutes(row))}</strong>
          <span>${escapeHtml(bookingJobLabel(row))} · ${escapeHtml(cleanDisplayName(row.customer))}</span>
          ${installationText ? `<em>${escapeHtml(installationText)}</em>` : ""}
          ${statusText ? `<em>${escapeHtml(statusText)}</em>` : ""}
        </article>
      `;
    }).join("");
    const slots = freeSlotsForDay(sorted);
    const slotText = slots.length
      ? slots.slice(0, 3).map((slot) => `<span>${timeRangeText(slot.start, slot.end)} ledig</span>`).join("")
      : `<span>Ingen tydelige ledige hull</span>`;
    const moreSlots = slots.length > 3 ? `<small>+${slots.length - 3} til</small>` : "";
    return `
      <div class="day-timeline-wrap" title="Tidslinje for dagen. Jobbene ligger der de fyller tid mellom 08:00 og 18:00.">
        <div class="day-time-summary">
          <strong>${formatDuration(bookedMinutes)} brukt</strong>
          <span>${formatDuration(freeMinutes)} ledig</span>
        </div>
        <div class="day-timeline">
          <div class="timeline-axis">${hourMarks}</div>
          <div class="timeline-grid">
            ${hourMarks}
            <div class="timeline-drop-zones">${planningTimelineDropZones(dayIso, workStart, workEnd)}</div>
            <div class="timeline-events">${events || `<div class="timeline-empty">Ledig dag</div>`}</div>
          </div>
        </div>
        <div class="day-free-chips">${slotText}${moreSlots}</div>
      </div>
    `;
  }

  function planningDayOverview(rows) {
    return planningDayTimeline(rows);
  }

  function formatDuration(minutes) {
    const rounded = Math.max(0, Math.round(minutes));
    const hours = Math.floor(rounded / 60);
    const rest = rounded % 60;
    if (!hours) return `${rest} min`;
    if (!rest) return `${hours} t`;
    return `${hours} t ${rest} min`;
  }

  function jobCard(row, editable, options = {}) {
    const card = document.createElement("article");
    const done = row.booking.status === "done" || doneJobs.has(row.id);
    const settled = bookingIsSettledForPlanning(row);
    const needsMove = bookingNeedsMove(row);
    const moveReason = bookingMoveReason(row);
    const overlap = bookingOverlapForRow(row);
    const type = bookingDisplayType(row);
    const paymentMode = bookingPaymentMode(row);
    const linkedOrder = linkedOrderForBooking(row.id) || findOrder(row.booking.orderId);
    const linkedJob = linkedOrder ? jobForOrder(linkedOrder) : null;
    const flow = bookingWorkflowState(row, linkedOrder);
    const canHavePriceBasis = bookingCanHavePriceBasis(row);
    const installationText = linkedOrder ? orderInstallationText(linkedOrder, row.customer, linkedJob) : "";
    const attachmentCount = attachmentsForJob(linkedJob).length;
    const paymentActionLabel = row.customer?.pays_cash ? "Betalt" : "Fakturert";
    const paymentActionTitle = row.customer?.pays_cash
      ? "Marker at betaling er mottatt for denne jobben."
      : "Marker at faktura er sendt manuelt i eAccounting.";
    const headerParts = options.showDate
      ? [weekdayDate(row.booking.date, { long: true }), `kl. ${bookingTimeText(row.booking)}`, row.booking.resource || "", bookingJobLabel(row)]
      : [bookingTimeText(row.booking), row.booking.resource || "", bookingJobLabel(row)];
    card.className = `job-card ${type} ${done ? "done" : ""} ${settled ? "settled" : ""} ${needsMove ? "needs-move" : ""} ${overlap ? "overlap" : ""}`;
    card.dataset.bookingId = row.id;
    card.dataset.customerId = customerKey(row.customer);
    card.draggable = Boolean(editable && isAdmin() && !done);
    card.title = card.draggable
      ? "Dra jobben til en dag eller et timefelt i planen. Slipp over en jobb for å legge den før eller etter."
      : done
        ? "Utført jobb kan ikke flyttes med dra-og-slipp."
        : "Åpne kundekort eller bruk knappene for å endre jobben.";
    card.innerHTML = `
      <span class="job-meta">${escapeHtml(headerParts.filter(Boolean).join(" · "))}</span>
      ${done ? `<span class="done-pill">Utført</span>` : ""}
      ${settled ? `<span class="invoice-pill invoiced">Ferdigbehandlet</span>` : ""}
      ${bookingNeedsSalesFollowup(row) ? `<span class="invoice-pill followup">Tilbud/salg</span>` : ""}
      ${overlap ? `<span class="invoice-pill overlap">Overlapp</span>` : ""}
      ${needsMove ? `<span class="invoice-pill move">Må flyttes</span>` : ""}
      ${bookingNeedsCompletion(row) ? `<span class="invoice-pill overdue">Dato passert - fullfør</span>` : ""}
      ${bookingNeedsInvoice(row) ? `<span class="invoice-pill">Må faktureres</span>` : ""}
      ${bookingNeedsCashPayment(row) ? `<span class="invoice-pill">Betaling ikke registrert</span>` : ""}
      ${paymentMode === "invoice" ? `<span class="invoice-pill invoiced">Fakturert</span>` : ""}
      ${paymentMode === "cash" ? `<span class="invoice-pill paid">Betalt på stedet</span>` : ""}
      <strong>${customerStarHtml(row.customer)}${customerCashBadgeHtml(row.customer)}${escapeHtml(cleanDisplayName(row.customer))}</strong>
      ${workflowInlineHtml(flow)}
      <span class="job-type-pill ${escapeHtml(type)}">${escapeHtml(bookingJobLabel(row))}</span>
      ${installationText ? `<small>${escapeHtml(installationText)}</small>` : ""}
      ${attachmentCount ? `<small>${attachmentCount.toLocaleString("nb-NO")} bilde(r)/vedlegg</small>` : ""}
      <small>${escapeHtml(addressFor(row.customer) || row.customer.location_tag || row.customer.visit_city || "Adresse mangler")}</small>
      ${accessInfo(row.customer) ? `<small class="access-inline">Kodeboks/nøkkel: ${escapeHtml(accessInfo(row.customer))}</small>` : ""}
      ${overlap ? `<p class="overlap-note">Krasjer med ${escapeHtml(cleanDisplayName(overlap.customer))} kl. ${escapeHtml(bookingTimeText(overlap.booking))}. Flytt en av jobbene.</p>` : ""}
      ${needsMove ? `<p class="move-note">${escapeHtml(moveReason || "Jobben må avtales på nytt.")}</p>` : ""}
      ${cleanBookingNote(row.booking.note) ? `<p>${escapeHtml(cleanBookingNote(row.booking.note))}</p>` : ""}
      <div class="job-actions">
        ${row.customer.phone ? `<a href="tel:${escapeHtml(phoneForLink(row.customer.phone))}" title="Ring kunden fra enhet som støtter telefonsamtaler.">Ring</a>` : ""}
        ${row.customer.phone ? copyPhoneButton(row.customer.phone, "Kopier nr") : ""}
        ${mapQuery(row.customer) ? `<a href="${escapeHtml(mapsUrl(row.customer))}" target="_blank" rel="noreferrer" title="Åpne adressen eller koordinatene i Google Maps.">Kart</a>` : ""}
        <a href="${escapeHtml(googleCalendarUrl(row))}" target="_blank" rel="noreferrer" title="Åpne denne jobben som et ferdig kalenderforslag.">Kalender</a>
        ${editable && isAdmin() ? `<button data-edit-booking="${escapeHtml(row.id)}" type="button" title="Endre tidspunkt, type, tekniker eller notat på denne jobben.">${needsMove ? "Flytt" : "Endre"}</button>` : ""}
        ${editable && isAdmin() ? `<button data-complete-booking="${escapeHtml(row.id)}" type="button" title="Marker jobben som utført og velg eventuell neste oppfølging.">${done ? "Utført" : "Fullfør"}</button>` : ""}
        ${editable && isAdmin() && done && canHavePriceBasis ? `<button data-price-basis-booking="${escapeHtml(row.id)}" type="button" title="Rediger prisgrunnlag og tillegg før eller etter faktura.">Fakturagrunnlag</button>` : ""}
        ${editable && isAdmin() && !done && !needsMove ? `<button data-move-booking="${escapeHtml(row.id)}" type="button" title="Marker at jobben må flyttes fordi kunden ikke var tilgjengelig, dere ikke kom inn, eller tidspunkt må avtales på nytt.">Må flyttes</button>` : ""}
        ${editable && isAdmin() && bookingNeedsPaymentAction(row) ? `<button data-billing-booking="${escapeHtml(row.id)}" type="button" title="${escapeHtml(paymentActionTitle)}">${escapeHtml(paymentActionLabel)}</button>` : ""}
        ${editable && isAdmin() ? `<button data-delete-booking="${escapeHtml(row.id)}" type="button" title="Fjern avtalen fra planen uten å slette kundehistorikk.">Fjern</button>` : ""}
      </div>
    `;
    return card;
  }

  function bookingTypeLabel(type) {
    if (type === "installasjon") return "Installasjon";
    if (type === "befaring") return "Befaring";
    if (type === "blaseisolering") return "Blåseisolering";
    if (type === "reparasjon" || type === "servicearbeid") return "Servicearbeid";
    if (type === "reklamasjon") return "Reklamasjon";
    if (type === "utleie") return "Utleie";
    if (type === "annet") return "Annet arbeid";
    return "Service";
  }

  function defaultBookingDuration(type) {
    if (type === "installasjon") return "180";
    if (type === "blaseisolering") return "240";
    if (type === "reparasjon" || type === "servicearbeid") return "90";
    return "60";
  }

  function todaysPersonalRows() {
    const today = isoDate(new Date());
    return personalRowsForDate(today);
  }

  function personalRowsForDate(date) {
    const name = normalizeMatch(currentUser?.name || "Gunnar");
    const firstName = name.split(/\s+/)[0] || name;
    return bookingRows()
      .filter((row) => row.booking.date === date)
      .filter((row) => {
        const resource = normalizeMatch(row.booking.resource || "");
        return !resource
          || resource.includes(name)
          || (firstName && resource.includes(firstName))
          || (resource && name.includes(resource))
          || resource.includes("gunnar og hubert");
      });
  }

  function dayPlanText(rows = todaysPersonalRows()) {
    const today = isoDate(new Date());
    const heading = `Dagsplan ${formatDate(today)} - ${currentUser?.name || "Gunnar"}`;
    if (!rows.length) return `${heading}\n\nIngen jobber booket i dag.`;
    const lines = rows.map((row, index) => {
      const customer = row.customer;
      return [
        `${index + 1}. ${bookingTimeText(row.booking)} - ${bookingJobLabel(row)} - ${cleanDisplayName(customer)}`,
        `Adresse: ${addressFor(customer) || customer.location_tag || customer.visit_city || "Adresse mangler"}`,
        customer.phone ? `Telefon: ${customer.phone}` : "",
        mapQuery(customer) ? `Kart: ${mapsUrl(customer)}` : "",
        row.booking.note ? `Notat: ${row.booking.note}` : "",
      ].filter(Boolean).join("\n");
    });
    return `${heading}\n\n${lines.join("\n\n")}`;
  }

  async function copyTextToClipboard(text) {
    const value = String(text || "");
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch (_error) {
        // Flere mobilnettlesere eksponerer clipboard API, men nekter selve kopieringen.
      }
    }
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "0";
    area.style.top = "0";
    area.style.width = "1px";
    area.style.height = "1px";
    area.style.padding = "0";
    area.style.border = "0";
    area.style.fontSize = "16px";
    area.style.opacity = "0.01";
    document.body.appendChild(area);
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, area.value.length);
    const selection = window.getSelection?.();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(area);
      selection.removeAllRanges();
      selection.addRange(range);
      area.setSelectionRange(0, area.value.length);
    }
    const copied = document.execCommand("copy");
    area.remove();
    if (!copied) {
      showManualCopyFallback(value);
      throw new Error("Klarte ikke kopiere automatisk. Teksten er markert i kopieringsboksen.");
    }
  }

  function showManualCopyFallback(text) {
    document.querySelector(".manual-copy-fallback")?.remove();
    const wrap = document.createElement("div");
    wrap.className = "manual-copy-fallback";
    wrap.innerHTML = `
      <div>
        <strong>Kopier manuelt</strong>
        <button type="button" aria-label="Lukk kopieringsboks">×</button>
      </div>
      <textarea rows="2"></textarea>
    `;
    const textarea = wrap.querySelector("textarea");
    const close = wrap.querySelector("button");
    textarea.value = text;
    close.addEventListener("click", () => wrap.remove());
    document.body.appendChild(wrap);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
  }

  async function copyDayPlan() {
    const text = dayPlanText();
    await copyTextToClipboard(text);
    setSyncStatus(`Dagsplan kopiert (${todaysPersonalRows().length} jobber).`, "ok");
  }

  async function copyPhone(button) {
    const phone = button.dataset.copyPhone || "";
    if (!phone) return;
    await copyTextToClipboard(phone);
    const oldText = button.textContent;
    button.textContent = "Kopiert";
    setSyncStatus(`Telefonnummer kopiert: ${phone}`, "ok");
    setTimeout(() => {
      button.textContent = oldText;
    }, 1400);
  }

  async function copyEmail(button) {
    const email = button.dataset.copyEmail || "";
    if (!email) return;
    await copyTextToClipboard(email);
    const oldText = button.textContent;
    button.textContent = "Kopiert";
    setSyncStatus(`E-post kopiert: ${email}`, "ok");
    setTimeout(() => {
      button.textContent = oldText;
    }, 1400);
  }

  function downloadTextFile(filename, text, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadDayPlan() {
    const text = dayPlanText();
    downloadTextFile(`dagsplan-${isoDate(new Date())}.txt`, text);
    setSyncStatus(`Dagsplan lastet ned (${todaysPersonalRows().length} jobber).`, "ok");
  }

  function downloadEaccountingProductCsv() {
    const rows = eaccountingProductRows();
    downloadTextFile(`crm-produktliste-eaccounting-${isoDate(new Date())}.csv`, eaccountingProductCsv(), "text/csv;charset=utf-8");
    setSyncStatus(`eAccounting-produktliste lastet ned (${rows.length} CRM-varer).`, "ok");
  }

  function openCustomerQuickPanel(customerId, bookingId) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const booking = bookings[bookingId] || null;
    const bookingRow = bookingId ? bookingRows().find((row) => row.id === bookingId) : null;
    const linkedOrder = bookingRow ? linkedOrderForBooking(bookingRow.id) || findOrder(bookingRow.booking.orderId) : null;
    const key = customerKey(customer);
    const invoices = invoicesByCustomer.get(key) || invoicesByCustomer.get(customer.lime_id) || [];
    const events = serviceEventsByCustomer.get(key) || serviceEventsByCustomer.get(customer.lime_id) || [];
    const installations = installationsForCustomer(customer);
    el.customerQuickContent.innerHTML = `
      ${bookingRow ? bookingQuickFocusHtml(bookingRow, linkedOrder) : ""}
      <div class="quick-title">
        <span class="soft-pill">${escapeHtml(customerRelationshipLabel(customer, installations))}</span>
        <span class="status ${statusKind(customer)}">${escapeHtml(customerServiceSummary(customer, installations))}</span>
        <h3>${isAdmin() ? starToggleHtml(customer) : customerStarHtml(customer, { showEmpty: true })}${customerStatusMarkerHtml(customer, isAdmin())}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</h3>
        <p>${escapeHtml(addressFor(customer) || "Adresse mangler")}</p>
      </div>
      <div class="action-row">${customerPrimaryActionsHtml(customer)}</div>
      ${lookupMissingDataSection(customer, true)}
      ${isLikelyHomeAddress(customer) ? `<section class="quick-block attention"><strong>Mulig hjemmeadresse</strong><p>Tagg/område tyder på hytte/anlegg, men adressen kan være hjemmeadresse. Kontroller koordinater for rute.</p></section>` : ""}
      <dl class="quick-facts">
        <div><dt>Telefon</dt><dd class="copy-field">${phoneField(customer.phone)}</dd></div>
        <div><dt>E-post</dt><dd class="copy-field">${emailField(customer.email)}</dd></div>
        <div><dt>Postadresse</dt><dd>${escapeHtml(postalAddressFor(customer) || "Ikke registrert")}</dd></div>
        <div><dt>Adkomst</dt><dd>${escapeHtml(accessInfo(customer) ? "Adkomst finnes" : "Ikke registrert")}</dd></div>
        <div><dt>Neste serviceoppfølging</dt><dd>${formatDate(nextServiceDueForCustomer(customer))}</dd></div>
        <div><dt>Betaling</dt><dd>${customer.pays_cash ? "Betaling på stedet" : "Faktura"}</dd></div>
        <div><dt>Fakturaer</dt><dd>${invoices.length.toLocaleString("nb-NO")} koblet</dd></div>
      </dl>
      ${renderInstallationList(customer, installations)}
      ${customer.local_note ? `<section class="quick-block"><strong>Notat</strong><p>${escapeHtml(customer.local_note)}</p></section>` : ""}
      <div class="quick-actions">
        <button data-jump-customer="${escapeHtml(key)}" type="button">Åpne kundekort</button>
        ${bookingId && isAdmin() ? `<button class="secondary" data-edit-booking="${escapeHtml(bookingId)}" type="button">Endre avtale</button>` : ""}
      </div>
    `;
    if (!el.customerQuickDialog.open) el.customerQuickDialog.showModal();
  }

  function handleJobCardOpen(event) {
    if (event.target.closest("a, button")) return false;
    const card = event.target.closest(".job-card[data-customer-id], .timeline-event[data-customer-id]");
    if (!card) return false;
    openCustomerQuickPanel(card.dataset.customerId, card.dataset.bookingId);
    return true;
  }

  function technicianHelpHtml() {
    if (!isTechnicianUser() || !currentTechnicianExtraHelp()) return "";
    const steps = technicianText("helpSteps") || [];
    return `
      <article>
        <strong>${escapeHtml(technicianText("helpTitle"))}</strong>
        <ol>
          ${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
      </article>
    `;
  }

  function renderTechnician() {
    if (!el.technicianDate.value) el.technicianDate.value = isoDate(new Date());
    const rows = personalRowsForDate(el.technicianDate.value);
    if (el.technicianHeading) el.technicianHeading.textContent = technicianText("heading", currentUser?.name || "Min");
    if (el.technicianIntro) el.technicianIntro.textContent = technicianText("intro");
    if (el.technicianRouteButton) el.technicianRouteButton.textContent = technicianText("routeButton");
    if (el.technicianRouteButton) el.technicianRouteButton.title = technicianText("routeTitle");
    if (el.technicianRouteButton) el.technicianRouteButton.disabled = !googleDirectionsUrlForRows(rows);
    if (el.technicianHelp) {
      el.technicianHelp.innerHTML = technicianHelpHtml();
      el.technicianHelp.classList.toggle("hidden", !el.technicianHelp.innerHTML.trim());
    }
    el.technicianJobs.innerHTML = "";
    if (!rows.length) {
      el.technicianJobs.innerHTML = `<div class="empty-state">${escapeHtml(technicianText("empty", currentUser?.name || "deg"))}</div>`;
      return;
    }
    for (const row of rows) {
      const card = jobCard(row, false);
      const done = row.booking.status === "done" || doneJobs.has(row.id);
      const needsMove = bookingNeedsMove(row);
      const doneButton = document.createElement("button");
      doneButton.type = "button";
      doneButton.dataset.doneBooking = row.id;
      doneButton.textContent = done ? technicianText("done") : technicianText("markDone");
      if (done && !isAdmin()) {
        doneButton.disabled = true;
        doneButton.title = technicianText("doneTitle");
      }
      card.querySelector(".job-actions").appendChild(doneButton);
      if (!done && !needsMove) {
        const moveButton = document.createElement("button");
        moveButton.type = "button";
        moveButton.dataset.moveBooking = row.id;
        moveButton.title = technicianText("moveTitle");
        moveButton.textContent = technicianText("needsMove");
        card.querySelector(".job-actions").appendChild(moveButton);
      }
      el.technicianJobs.appendChild(card);
    }
  }

  function openCustomerDialog(customerId, options = {}) {
    const customer = findCustomer(customerId);
    editingCustomerId = customerKey(customer) || "";
    el.customerDialogTitle.textContent = customer ? "Rediger kunde" : "Ny kunde";
    clearCustomerDialogMessage();
    el.deleteCustomerButton.classList.toggle("hidden", !customer);
    el.formName.value = customer?.name || "";
    el.formPhone.value = customer?.phone || "";
    el.formEmail.value = customer?.email || "";
    el.formOrg.value = customer?.organization_number || "";
    el.formStreet.value = customer?.visit_street || "";
    el.formZip.value = customer?.visit_zip || "";
    el.formCity.value = customer?.visit_city || "";
    el.formTag.value = customer?.location_tag || "";
    const postalText = normalizeMatch([customer?.postal_street, customer?.postal_zip, customer?.postal_city].filter(Boolean).join(" "));
    const visitText = normalizeMatch([customer?.visit_street, customer?.visit_zip, customer?.visit_city].filter(Boolean).join(" "));
    const hasPostalAddress = Boolean(postalText) && postalText !== visitText;
    el.formDifferentPostal.checked = hasPostalAddress;
    el.formPostalStreet.value = customer?.postal_street || "";
    el.formPostalZip.value = customer?.postal_zip || "";
    el.formPostalCity.value = customer?.postal_city || "";
    el.formGps.value = customer?.gps_coordinates || "";
    el.formGoogleMaps.value = customer?.google_maps || "";
    el.formBrand.value = customer?.brand || "";
    el.formModel.value = customer?.model_or_note || "";
    el.formInstallDate.value = customer?.first_install_date || "";
    el.formLastService.value = customer?.last_service_date || "";
    el.formNextService.value = customer?.next_service_due || "";
    el.formAccess.value = options.accessPrefill || (customer ? accessInfo(customer) : "");
    el.formIsCustomer.checked = customer ? customerIsMarkedCustomer(customer) : options.isCustomer !== false;
    el.formPaysCash.checked = Boolean(customer?.pays_cash);
    el.formInsulation.checked = customer ? isInsulationCustomer(customer) : Boolean(options.insulation);
    el.formServiceDates.value = customer?.service_dates || "";
    el.formTags.value = uniqueTags([
      ...splitTags(customer?.tags),
      customer?.location_tag || "",
      options.insulation ? "Blåseisolering" : "",
    ]);
    el.formNote.value = customer?.local_note || "";
    syncPostalFieldsVisibility();
    renderTagCatalog(currentFormTags());
    el.customerDialog.showModal();
    if (options.focus === "access") {
      setTimeout(() => {
        el.formAccess?.focus();
        el.formAccess?.select();
      }, 0);
    }
  }

  function customerFormValues() {
    const tags = nextTagsWithCustomerMarker(
      nextTagsWithInsulation(el.formTags.value.trim(), Boolean(el.formInsulation.checked)),
      Boolean(el.formIsCustomer.checked),
    );
    const hasDifferentPostal = Boolean(el.formDifferentPostal.checked);
    return {
      name: el.formName.value.trim(),
      phone: el.formPhone.value.trim(),
      email: el.formEmail.value.trim(),
      organization_number: el.formOrg.value.trim(),
      visit_street: el.formStreet.value.trim(),
      visit_zip: el.formZip.value.trim(),
      visit_city: el.formCity.value.trim(),
      location_tag: deriveLocationTagFromTags(tags) || el.formTag.value.trim(),
      postal_street: hasDifferentPostal ? el.formPostalStreet.value.trim() : "",
      postal_zip: hasDifferentPostal ? el.formPostalZip.value.trim() : "",
      postal_city: hasDifferentPostal ? el.formPostalCity.value.trim() : "",
      gps_coordinates: el.formGps.value.trim(),
      google_maps: el.formGoogleMaps.value.trim(),
      brand: el.formBrand.value.trim(),
      model_or_note: el.formModel.value.trim(),
      first_install_date: el.formInstallDate.value,
      last_service_date: el.formLastService.value,
      next_service_due: el.formNextService.value,
      access_note: el.formAccess.value.trim(),
      pays_cash: Boolean(el.formPaysCash.checked),
      service_dates: el.formServiceDates.value.trim(),
      tags,
      local_note: el.formNote.value.trim(),
    };
  }

  function showInstallationDialogMessage(message, tone = "error") {
    if (!el.installationDialogMessage) return;
    el.installationDialogMessage.textContent = message || "";
    el.installationDialogMessage.className = `dialog-message ${tone || ""}`.trim();
    el.installationDialogMessage.classList.toggle("hidden", !message);
  }

  function addMonthsIsoDate(value, months) {
    if (!value || !months) return "";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    const originalDay = date.getDate();
    date.setMonth(date.getMonth() + Number(months));
    if (date.getDate() < originalDay) date.setDate(0);
    return isoDate(date);
  }

  function syncInstallationNextServiceSuggestion(force = false) {
    const months = Number(el.installationServiceInterval?.value || 0);
    if (!months || !el.installationLastServiceAt?.value) return;
    if (!force && el.installationNextServiceDue?.value) return;
    el.installationNextServiceDue.value = addMonthsIsoDate(el.installationLastServiceAt.value, months);
  }

  function syncInstallationLocationFields() {
    const isNew = el.installationLocationSelect?.value === "__new__";
    document.querySelectorAll(".installation-location-field input").forEach((input) => {
      input.disabled = !isNew;
    });
    if (!isNew) {
      const location = customerLocationById.get(String(el.installationLocationSelect.value));
      if (location) fillInstallationLocationFields(location);
    }
  }

  function fillInstallationLocationFields(location) {
    el.installationLocationName.value = location?.location_name || "";
    el.installationAddress.value = location?.address || "";
    el.installationZip.value = location?.postal_code || "";
    el.installationCity.value = location?.city || "";
  }

  function renderInstallationLocationOptions(customer, selectedId = "", forceNew = false) {
    const locations = customerLocationsForCustomer(customer);
    const fallback = fallbackCustomerLocation(customer);
    const options = locations.map((location) => (
      `<option value="${escapeHtml(location.id)}">${escapeHtml(locationOptionLabel(location))}</option>`
    ));
    options.push(`<option value="__new__">Ny anleggsadresse</option>`);
    el.installationLocationSelect.innerHTML = options.join("");
    const value = forceNew || (!locations.length && !selectedId) ? "__new__" : (selectedId || locations[0]?.id || "__new__");
    el.installationLocationSelect.value = value;
    if (value === "__new__") fillInstallationLocationFields(locations.length ? {} : fallback);
    else fillInstallationLocationFields(customerLocationById.get(String(value)));
    syncInstallationLocationFields();
  }

  function openInstallationDialog(customerId, installationId = "", options = {}) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const installation = installationId
      ? installationsForCustomer(customer).find((item) => String(item.id || "") === String(installationId))
      : null;
    const prefill = !installation ? (options.prefill || {}) : {};
    editingInstallationCustomerId = customerKey(customer);
    editingInstallationId = installation?.id || "";
    showInstallationDialogMessage("", "error");
    el.installationDialogTitle.textContent = installation ? "Rediger varmepumpe / anlegg" : "Ny varmepumpe / anlegg";
    el.installationCustomerName.value = cleanDisplayName(customer);
    el.installationLabel.value = installation?.label || prefill.label || `Anlegg ${installationsForCustomer(customer).length + 1}`;
    el.installationBrand.value = installation?.brand || prefill.brand || "";
    el.installationModel.value = installation?.model || prefill.model || "";
    el.installationSerial.value = installation?.serial_number || prefill.serial_number || "";
    el.installationInstalledAt.value = installation?.installed_at || prefill.installed_at || "";
    el.installationLastServiceAt.value = installation?.last_service_at || prefill.last_service_at || "";
    el.installationNextServiceDue.value = installation?.next_service_due || prefill.next_service_due || "";
    el.installationServiceInterval.value = String(installationServiceIntervalMonths(installation) || prefill.service_interval_months || 24);
    el.installationActive.checked = installation?.active !== false;
    el.installationNotes.value = installation?.notes || prefill.notes || "";
    renderInstallationLocationOptions(customer, installation?.location_id || prefill.location_id || "", Boolean(prefill.forceNewLocation) || (!installation && !customerLocationsForCustomer(customer).length));
    if (!installation && prefill.forceNewLocation) {
      fillInstallationLocationFields({
        location_name: prefill.location_name || "",
        address: prefill.address || "",
        postal_code: prefill.postal_code || "",
        city: prefill.city || "",
      });
      syncInstallationLocationFields();
    }
    if (!el.installationDialog.open) el.installationDialog.showModal();
    setTimeout(() => el.installationLabel?.focus(), 0);
  }

  function installationFormValues() {
    const months = Number(el.installationServiceInterval.value || 0);
    const nextService = el.installationNextServiceDue.value
      || addMonthsIsoDate(el.installationLastServiceAt.value, months);
    return {
      id: editingInstallationId,
      label: el.installationLabel.value.trim() || "Anlegg",
      brand: el.installationBrand.value.trim(),
      model: el.installationModel.value.trim(),
      serial_number: el.installationSerial.value.trim(),
      installed_at: el.installationInstalledAt.value,
      last_service_at: el.installationLastServiceAt.value,
      next_service_due: nextService,
      service_interval_months: Number.isFinite(months) && months > 0 ? months : 0,
      active: Boolean(el.installationActive.checked),
      notes: el.installationNotes.value.trim(),
    };
  }

  function locationFormValues(customer) {
    const name = el.installationLocationName.value.trim() || "Anlegg";
    return {
      customer_id: customerKey(customer),
      location_name: name,
      address: el.installationAddress.value.trim(),
      postal_code: el.installationZip.value.trim(),
      city: el.installationCity.value.trim(),
      location_type: name.toLowerCase().includes("hytte") ? "cabin" : "unknown",
      is_primary: !customerLocationsForCustomer(customer).length,
    };
  }

  function upsertCustomerLocationInMemory(location) {
    if (!location?.id) return location;
    customerLocationById.set(String(location.id), location);
    const key = location.customer_id;
    if (!key) return location;
    const list = customerLocationsByCustomer.get(key) || [];
    const index = list.findIndex((item) => String(item.id) === String(location.id));
    if (index >= 0) list[index] = location;
    else list.push(location);
    customerLocationsByCustomer.set(key, list);
    return location;
  }

  function upsertInstallationInMemory(customer, installation) {
    if (!installation) return installation;
    const key = customerKey(customer);
    const id = installation.id || `installation-${Date.now()}`;
    const row = { ...installation, id, customer_id: installation.customer_id || key };
    const list = installationsByCustomer.get(key) || [];
    const index = list.findIndex((item) => String(item.id || "") === String(id));
    if (index >= 0) list[index] = row;
    else list.push(row);
    installationsByCustomer.set(key, list);
    if (customer?.lime_id && customer.lime_id !== key) installationsByCustomer.set(customer.lime_id, list);
    return row;
  }

  async function saveInstallationFromDialog() {
    const customer = findCustomer(editingInstallationCustomerId);
    if (!customer) throw new Error("Fant ikke kunden for anlegget.");
    const values = installationFormValues();
    let locationId = el.installationLocationSelect.value;
    if (locationId === "__new__") {
      const locationValues = locationFormValues(customer);
      if (store.isConfigured) {
        if (!store.saveCustomerLocation) throw new Error("Lagring av anleggsadresse krever oppdatert Supabase-adapter.");
        const savedLocation = await store.saveCustomerLocation(customerKey(customer), locationValues);
        upsertCustomerLocationInMemory(savedLocation);
        locationId = savedLocation.id;
      } else {
        const localLocation = { ...locationValues, id: `location-${Date.now()}` };
        upsertCustomerLocationInMemory(localLocation);
        locationId = localLocation.id;
      }
    }
    values.location_id = locationId && locationId !== "__new__" ? locationId : null;
    let savedInstallation;
    if (store.isConfigured) {
      if (!store.saveInstallation) throw new Error("Lagring av varmepumpe/anlegg krever oppdatert Supabase-adapter.");
      savedInstallation = await store.saveInstallation(customerKey(customer), values);
    } else {
      requireLocalDemoStorage();
      savedInstallation = { ...values, id: values.id || `installation-${Date.now()}`, customer_id: customerKey(customer) };
    }
    upsertInstallationInMemory(customer, savedInstallation);
    el.installationDialog.close();
    renderAll();
    setSyncStatus("Varmepumpe/anlegg lagret på kundekortet.", "ok");
  }

  async function createLeadForExistingCustomer(customerId, options = {}) {
    const customer = findCustomer(customerId);
    if (!customer) throw new Error("Fant ikke kunden.");
    const kind = options.kind === "blaseisolering" ? "blaseisolering" : "installasjon";
    const linkedInstallation = options.installationId
      ? installationsForCustomer(customer).find((installation) => String(installation.id || "") === String(options.installationId))
      : null;
    const installationLine = linkedInstallation ? `Gjelder anlegg: ${installationDisplayName(linkedInstallation)}.` : "";
    const installationNote = linkedInstallation ? installationBookingNote(linkedInstallation, customer) : "";
    const lockKey = `customer-lead:${customerKey(customer)}:${kind}:${linkedInstallation?.id || ""}`;
    if (pendingLeadCreateKeys.has(lockKey)) {
      setSyncStatus("Oppfølging opprettes allerede. Vent et øyeblikk.", "");
      return;
    }
    pendingLeadCreateKeys.add(lockKey);
    try {
      const isInsulationLead = kind === "blaseisolering";
      const note = [
        isInsulationLead
          ? "Eksisterende kunde er aktuell for blåseisolering. Dette er en oppfølging/tilbudssak, ikke en jobb før kunden har sagt ja."
          : "Eksisterende kunde ønsker tilbud/oppfølging på ny varmepumpe eller ekstra anlegg.",
        installationLine,
        installationNote,
        `Kunde har ${installationsForCustomer(customer).length || "ukjent antall"} registrert(e) anlegg fra før.`,
        isInsulationLead
          ? "Kontroller areal, adkomst, bilder og om dette er tilbud, befaring eller faktisk blåsejobb."
          : "Kontroller om adressen er hjemme, hytte eller samme adresse som eksisterende anlegg.",
      ].filter(Boolean).join("\n");
      const sourceDetail = isInsulationLead
        ? "Blåseisolering på eksisterende kunde"
        : (linkedInstallation ? "Oppfølging på eksisterende anlegg" : "Ny varmepumpe på eksisterende kunde");
      const productInterest = isInsulationLead
        ? "Blåseisolering"
        : (linkedInstallation ? `Oppfølging på ${installationDisplayName(linkedInstallation)}` : "Ny varmepumpe / ekstra anlegg");
      let savedLead;
      if (store.isConfigured) {
        if (!store.saveLeadDraft) throw new Error("Ny lead på eksisterende kunde krever oppdatert Supabase-adapter.");
        savedLead = await store.saveLeadDraft({
          action: "create_lead",
          customer_id: customerKey(customer),
          name: cleanDisplayName(customer),
          phone: customer.phone || "",
          email: customer.email || "",
          street: customer.visit_street || "",
          zip: customer.visit_zip || "",
          city: customer.visit_city || customer.location_tag || "",
          source: "Kundekort",
          source_detail: sourceDetail,
          type: kind,
          product_interest: productInterest,
          note,
          lead_status: "needs_offer",
        });
      } else {
        requireLocalDemoStorage();
        savedLead = {
          id: `lead-${Date.now()}`,
          existing_customer_id: customerKey(customer),
          first_name: cleanDisplayName(customer),
          phone: customer.phone || "",
          email: customer.email || "",
          address: customer.visit_street || "",
          postal_code: customer.visit_zip || "",
          city: customer.visit_city || customer.location_tag || "",
          source: "Kundekort",
          source_detail: sourceDetail,
          product_interest: productInterest,
          note,
          status: "quote_needed",
          updated_at: new Date().toISOString(),
        };
      }
      updateLeadInMemory(savedLead);
      if (!store.isConfigured) saveLocalLeads();
      selectedLeadId = `lead:${savedLead.id}`;
      currentLeadFilter = "needs_offer";
      if (el.leadStatusFilter) el.leadStatusFilter.value = currentLeadFilter;
      setView("leads");
      setSyncStatus(isInsulationLead ? "Blåseisolering-oppfølging opprettet på eksisterende kunde." : "Ny oppfølging opprettet på eksisterende kunde.", "ok");
    } finally {
      pendingLeadCreateKeys.delete(lockKey);
    }
  }

  function leadOptionsFromButton(button) {
    return {
      kind: button?.dataset.leadKind,
      installationId: button?.dataset.leadInstallation,
    };
  }

  function openBookingDialog(customerId, bookingId, options = {}) {
    editingBookingId = bookingId || "";
    const booking = bookings[bookingId] || null;
    const selectedId = booking?.customerId || customerId || "";
    const selectedCustomer = findCustomer(selectedId);
    bookingSelectedCustomerId = selectedCustomer ? customerKey(selectedCustomer) : "";
    bookingPendingOrderId = options.orderId || booking?.orderId || linkedOrderForBooking(bookingId)?.id || "";
    clearBookingDialogMessage();
    setSyncStatus("", "");
    const linkedOrder = bookingPendingOrderId ? findOrder(bookingPendingOrderId) : linkedOrderForBooking(bookingId);
    const linkedInstallationId = options.installationId || (linkedOrder ? installationIdForOrder(linkedOrder, jobForOrder(linkedOrder)) : "");
    el.bookingCustomerSearch.value = selectedCustomer ? searchDisplayText(selectedCustomer) : "";
    setBookingCustomerSelection(selectedCustomer, linkedInstallationId);
    closeBookingCustomerResults();
    el.bookingDate.value = booking?.date || isoDate(new Date());
    el.bookingTime.value = normalizeBookingTime(booking?.time, "09:00");
    const dialogType = serviceWorkType(booking?.type || options.type) ? "reparasjon" : (booking?.type || options.type || "service");
    el.bookingType.value = dialogType;
    renderBookingInstallationOptions(selectedCustomer, linkedInstallationId);
    const linkedInstallation = selectedBookingInstallation(selectedCustomer);
    el.bookingDuration.value = booking?.duration || defaultBookingDuration(el.bookingType.value);
    renderResourceSelectOptions(el.bookingResource, booking?.resource || defaultBookingResourceName());
    const defaultAccessNote = !booking && selectedCustomer && accessInfo(selectedCustomer)
      ? `Kodeboks/nøkkel/adkomst: ${accessInfo(selectedCustomer)}`
      : "";
    const installationNote = !booking && linkedInstallation ? installationBookingNote(linkedInstallation, selectedCustomer) : "";
    const baseBookingNote = booking?.note || options.note || "";
    const accessNoteNeeded = !booking
      && !installationNote
      && defaultAccessNote
      && Boolean(baseBookingNote)
      && !/kodeboks|nøkkel|nokkel|adkomst/i.test(baseBookingNote);
    const bookingNote = [
      baseBookingNote || defaultAccessNote,
      accessNoteNeeded ? defaultAccessNote : "",
      installationNote && !String(booking?.note || options.note || "").includes("Anlegg:") ? installationNote : "",
    ].filter(Boolean).join("\n");
    el.bookingNote.value = cleanBookingNote(bookingNote);
    if (!booking && selectedCustomer && !linkedInstallation && installationsForCustomer(selectedCustomer).filter((installation) => installation.active !== false).length > 1) {
      showBookingDialogMessage("Kunden har flere anlegg. Velg riktig anlegg før avtalen lagres hvis jobben gjelder en bestemt varmepumpe.", "info");
    }
    el.deleteBookingButton.classList.toggle("hidden", !booking);
    syncBookingDialogTypeStyle();
    el.bookingDialog.showModal();
    renderBookingMonth();
    setTimeout(() => {
      el.bookingCustomerSearch.focus();
      el.bookingCustomerSearch.select();
    }, 0);
  }

  function searchDisplayText(customer) {
    return [customer.name, customer.visit_city || customer.location_tag, customer.phone].filter(Boolean).join(" · ");
  }

  function bookingOptionLabel(customer) {
    return [
      cleanDisplayName(customer),
      customer.visit_city || customer.location_tag || "",
      customer.phone || "",
    ].filter(Boolean).join(" · ");
  }

  function setBookingCustomerSelection(customer, selectedInstallationId = "") {
    if (!customer) {
      bookingSelectedCustomerId = "";
      el.bookingCustomer.innerHTML = `<option value="">Velg kunde</option>`;
      el.bookingCustomer.value = "";
      renderBookingInstallationOptions(null, "");
      return;
    }
    const key = customerKey(customer);
    bookingSelectedCustomerId = key;
    el.bookingCustomer.innerHTML = `<option value="${escapeHtml(key)}">${escapeHtml(bookingOptionLabel(customer))}</option>`;
    el.bookingCustomer.value = key;
    el.bookingCustomerSearch.value = searchDisplayText(customer);
    renderBookingInstallationOptions(customer, selectedInstallationId);
  }

  function renderBookingCustomerResults(searchText = "", selectedId = bookingSelectedCustomerId) {
    const selectedCustomer = selectedId ? findCustomer(selectedId) : null;
    if (selectedCustomer && searchText === searchDisplayText(selectedCustomer)) {
      setBookingCustomerSelection(selectedCustomer, el.bookingInstallationSelect?.value || "");
      el.bookingCustomerResults.innerHTML = "";
      return;
    }
    const search = String(searchText || "").trim();
    const matches = customers
      .filter((customer) => matchesSearchText(customer, search))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "nb"))
      .slice(0, 8);
    if (!matches.length) {
      el.bookingCustomer.innerHTML = `<option value="">Ingen treff</option>`;
      el.bookingCustomer.value = "";
      bookingSelectedCustomerId = "";
      el.bookingCustomerResults.innerHTML = `<div class="booking-result-empty">Ingen treff. Lag kunden med Ny kunde først.</div>`;
      return;
    }
    el.bookingCustomer.innerHTML = matches
      .map((customer) => `<option value="${escapeHtml(customerKey(customer))}">${escapeHtml(bookingOptionLabel(customer))}</option>`)
      .join("");
    if (selectedId && matches.some((customer) => customerKey(customer) === selectedId)) {
      el.bookingCustomer.value = selectedId;
    } else {
      el.bookingCustomer.value = "";
    }
    const activeId = selectedId;
    el.bookingCustomerResults.innerHTML = matches.map((customer) => {
      const key = customerKey(customer);
      return `
        <button class="${key === activeId ? "active" : ""}" data-booking-customer-id="${escapeHtml(key)}" type="button">
          <strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong>
          <span>${escapeHtml([customer.visit_city || customer.location_tag, customer.phone, customer.visit_street].filter(Boolean).join(" · ") || "Ingen ekstra info")}</span>
        </button>
      `;
    }).join("");
  }

  function closeBookingCustomerResults() {
    el.bookingCustomerResults.innerHTML = "";
  }

  function showBookingDialogMessage(message, tone = "error") {
    el.bookingDialogMessage.textContent = message || "";
    el.bookingDialogMessage.className = `dialog-message ${tone || ""}`.trim();
  }

  function clearBookingDialogMessage() {
    el.bookingDialogMessage.textContent = "";
    el.bookingDialogMessage.className = "dialog-message hidden";
  }

  function syncBookingDialogTypeStyle() {
    if (!el.bookingDialog || !el.bookingType) return;
    const type = el.bookingType.value || "service";
    ["service", "reparasjon", "befaring", "installasjon", "blaseisolering"].forEach((value) => {
      el.bookingDialog.classList.toggle(`booking-${value}`, type === value);
    });
  }

  function bookingMonthBaseDate() {
    const value = el.bookingDate.value || isoDate(new Date());
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function renderBookingMonth() {
    const base = bookingMonthBaseDate();
    const month = base.getMonth();
    const year = base.getFullYear();
    const selected = el.bookingDate.value;
    const formatter = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" });
    el.bookingMonthLabel.textContent = formatter.format(base);
    const firstDayOffset = (new Date(year, month, 1).getDay() || 7) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows = bookingRows();
    const cells = [
      ...["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => `<div class="month-weekday">${day}</div>`),
    ];
    for (let i = 0; i < firstDayOffset; i += 1) cells.push(`<div class="month-empty"></div>`);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayRows = rows.filter((row) => row.booking.date === date);
      const counts = bookingTypeCounts(dayRows);
      const load = bookingLoadKind(dayRows);
      const label = dayRows.length ? `${dayRows.length} jobb${dayRows.length === 1 ? "" : "er"}` : "Ledig";
      const today = isTodayIso(date);
      cells.push(`
        <button class="month-day ${load} ${selected === date ? "selected" : ""} ${today ? "today" : ""}" data-booking-date="${date}" type="button" title="${escapeHtml(today ? `I dag. ${label}` : label)}">
          <span>${day}</span>
          <em>${dayRows.length || ""}</em>
          <b>
            ${counts.service ? `<i class="service"></i>` : ""}
            ${counts.reparasjon ? `<i class="reparasjon"></i>` : ""}
            ${counts.befaring ? `<i class="befaring"></i>` : ""}
            ${counts.installasjon ? `<i class="installasjon"></i>` : ""}
            ${counts.blaseisolering ? `<i class="blaseisolering"></i>` : ""}
          </b>
        </button>
      `);
    }
    el.bookingMonthGrid.innerHTML = cells.join("");
    renderBookingDayAgenda();
  }

  function bookingDurationMinutes(row) {
    const type = row.booking.type || "service";
    const fallback = Number(defaultBookingDuration(type));
    const duration = Number(row.booking.duration || fallback);
    return Number.isFinite(duration) && duration > 0 ? duration : fallback;
  }

  function bookingTimeText(booking) {
    return normalizeBookingTime(booking?.time, "09:00");
  }

  function bookingRowStartMinutes(row) {
    return minutesFromTime(bookingTimeText(row.booking));
  }

  function bookingRowEndMinutes(row) {
    return bookingRowStartMinutes(row) + bookingDurationMinutes(row);
  }

  function bookingResourceTokens(value) {
    const resource = normalizeMatch(value);
    if (!resource) return ["alle"];
    const tokens = new Set();
    if (resource.includes("gunnar")) tokens.add("gunnar");
    if (resource.includes("hubert")) tokens.add("hubert");
    if (resource.includes("kasper")) tokens.add("kasper");
    if (resource.includes("alle") || resource.includes("felles") || resource.includes("ukjent")) tokens.add("alle");
    if (!tokens.size) tokens.add(resource);
    return [...tokens];
  }

  function resourcesOverlap(a, b) {
    const left = bookingResourceTokens(a);
    const right = bookingResourceTokens(b);
    if (left.includes("alle") || right.includes("alle")) return true;
    return left.some((token) => right.includes(token));
  }

  function bookingTimeWindow(booking) {
    const type = booking?.type || "service";
    const fallback = Number(defaultBookingDuration(type));
    const duration = Number(booking?.duration || fallback);
    const start = minutesFromTime(normalizeBookingTime(booking?.time, "09:00"));
    const end = start + (Number.isFinite(duration) && duration > 0 ? duration : fallback);
    return { start, end };
  }

  function bookingConflict(values, ignoreId = "") {
    if (!values?.date || !values?.time) return null;
    const { start, end } = bookingTimeWindow(values);
    return bookingRows().find((row) => {
      if (row.id === ignoreId) return false;
      if (row.booking.date !== values.date) return false;
      if (!resourcesOverlap(row.booking.resource || "", values.resource || "")) return false;
      const rowStart = bookingRowStartMinutes(row);
      const rowEnd = bookingRowEndMinutes(row);
      return start < rowEnd && end > rowStart;
    }) || null;
  }

  function bookingRowsForSameResource(values, ignoreId = "") {
    return bookingRows()
      .filter((row) => row.id !== ignoreId)
      .filter((row) => row.booking.date === values?.date)
      .filter((row) => resourcesOverlap(row.booking.resource || "", values?.resource || ""))
      .sort((a, b) => bookingRowStartMinutes(a) - bookingRowStartMinutes(b));
  }

  function fittingSlotsForBooking(values, ignoreId = "") {
    if (!values?.date || !values?.time) return [];
    const duration = Math.max(1, bookingTimeWindow(values).end - bookingTimeWindow(values).start);
    return freeSlotsForDay(bookingRowsForSameResource(values, ignoreId))
      .filter((slot) => slot.end - slot.start >= duration);
  }

  function slotSuggestionText(slot, duration) {
    const latestStart = slot.end - duration;
    if (latestStart <= slot.start) return timeRangeText(slot.start, slot.end);
    return `${timeRangeText(slot.start, slot.end)} (start senest ${timeFromMinutes(latestStart)})`;
  }

  function bookingConflictMessage(prefix, values, conflict, ignoreId = "") {
    const window = bookingTimeWindow(values);
    const duration = Math.max(1, window.end - window.start);
    const attempted = `${formatDate(values.date)} kl. ${timeRangeText(window.start, window.end)} (${formatDuration(duration)})`;
    const conflictStart = bookingRowStartMinutes(conflict);
    const conflictEnd = bookingRowEndMinutes(conflict);
    const conflictText = `${conflict.booking.resource || "Ansatt"} er allerede booket ${formatDate(conflict.booking.date)} kl. ${timeRangeText(conflictStart, conflictEnd)} hos ${cleanDisplayName(conflict.customer)}.`;
    const slots = fittingSlotsForBooking(values, ignoreId);
    const suggestion = slots.length
      ? `Ledig for ${formatDuration(duration)}: ${slots.slice(0, 3).map((slot) => slotSuggestionText(slot, duration)).join(", ")}.`
      : `Ingen ledige hull for ${formatDuration(duration)} på ${values.resource || conflict.booking.resource || "valgt ansatt"} denne dagen. Endre varighet, ansatt eller dag.`;
    return `${prefix}: forsøkte ${attempted}. ${conflictText} ${suggestion}`;
  }

  function bookingOverlapForRow(row, rows = bookingRows()) {
    if (!row?.booking?.date) return null;
    const rowWindow = bookingTimeWindow(row.booking);
    return rows.find((other) => {
      if (!other || other.id === row.id) return false;
      if (other.booking.date !== row.booking.date) return false;
      if (!resourcesOverlap(other.booking.resource || "", row.booking.resource || "")) return false;
      const otherWindow = bookingTimeWindow(other.booking);
      return rowWindow.start < otherWindow.end && rowWindow.end > otherWindow.start;
    }) || null;
  }

  function draftBookingConflict(drafts) {
    for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < drafts.length; rightIndex += 1) {
        const left = drafts[leftIndex];
        const right = drafts[rightIndex];
        if (left.date !== right.date) continue;
        if (!resourcesOverlap(left.resource || "", right.resource || "")) continue;
        const leftWindow = bookingTimeWindow(left);
        const rightWindow = bookingTimeWindow(right);
        if (leftWindow.start < rightWindow.end && leftWindow.end > rightWindow.start) {
          return { left, right };
        }
      }
    }
    return null;
  }

  function timeRangeText(start, end) {
    return `${timeFromMinutes(start)}-${timeFromMinutes(end)}`;
  }

  function freeSlotsForDay(rows) {
    const workStart = minutesFromTime("08:00");
    const workEnd = minutesFromTime("18:00");
    let cursor = workStart;
    const slots = [];
    for (const row of rows) {
      const start = bookingRowStartMinutes(row);
      const end = bookingRowEndMinutes(row);
      if (start - cursor >= 30) slots.push({ start: cursor, end: start });
      cursor = Math.max(cursor, end);
    }
    if (workEnd - cursor >= 30) slots.push({ start: cursor, end: workEnd });
    return slots;
  }

  function renderBookingDayAgenda() {
    if (!el.bookingDayAgenda) return;
    const date = el.bookingDate.value || isoDate(new Date());
    const previewValues = {
      date,
      time: normalizeBookingTime(el.bookingTime?.value || "09:00"),
      type: el.bookingType?.value || "service",
      duration: el.bookingDuration?.value || defaultBookingDuration(el.bookingType?.value || "service"),
      resource: el.bookingResource?.value || "",
    };
    const rows = bookingRows()
      .filter((row) => row.booking.date === date)
      .sort((a, b) => bookingRowStartMinutes(a) - bookingRowStartMinutes(b));
    const resourceRows = rows
      .filter((row) => row.id !== editingBookingId)
      .filter((row) => resourcesOverlap(row.booking.resource || "", previewValues.resource || ""));
    const selectedWindow = bookingTimeWindow(previewValues);
    const selectedDuration = Math.max(1, selectedWindow.end - selectedWindow.start);
    const slots = freeSlotsForDay(resourceRows).filter((slot) => slot.end - slot.start >= selectedDuration);
    const conflict = bookingConflict(previewValues, editingBookingId);
    const previewText = `${timeRangeText(selectedWindow.start, selectedWindow.end)} · ${previewValues.resource || "valgt ansatt"}`;
    const previewHtml = conflict
      ? `<div class="day-agenda-preview conflict">Valgt tid krasjer med ${escapeHtml(cleanDisplayName(conflict.customer))} kl. ${escapeHtml(timeRangeText(bookingRowStartMinutes(conflict), bookingRowEndMinutes(conflict)))}.</div>`
      : `<div class="day-agenda-preview ok">Valgt tid ser ledig ut: ${escapeHtml(previewText)}.</div>`;
    const jobHtml = rows.length ? rows.map((row) => `
      <article class="day-agenda-job ${escapeHtml(bookingDisplayType(row))} ${resourcesOverlap(row.booking.resource || "", previewValues.resource || "") ? "same-resource" : ""}">
        <strong>${timeRangeText(bookingRowStartMinutes(row), bookingRowEndMinutes(row))} · ${escapeHtml(bookingJobLabel(row))}</strong>
        <span>${escapeHtml(cleanDisplayName(row.customer))} · ${escapeHtml(row.booking.resource || "Ikke satt")} · ${escapeHtml(siteLocationText(row.customer) || "Adresse mangler")}</span>
      </article>
    `).join("") : `<div class="empty-state">Ingen jobber booket denne dagen.</div>`;
    const slotHtml = slots.length ? slots.map((slot) => `
      <button class="free-slot" data-booking-slot-time="${escapeHtml(timeFromMinutes(slot.start))}" type="button" title="Bruk ${escapeHtml(timeFromMinutes(slot.start))} som starttid.">${escapeHtml(slotSuggestionText(slot, selectedDuration))}</button>
    `).join("") : `<span class="free-slot busy">Ingen ledige hull for ${escapeHtml(formatDuration(selectedDuration))} på valgt ansatt</span>`;
    el.bookingDayAgenda.innerHTML = `
      <div class="day-agenda-head">
        <strong>${formatDate(date)}</strong>
        <span>${rows.length} jobb${rows.length === 1 ? "" : "er"} · ${resourceRows.length} på valgt ansatt</span>
      </div>
      ${previewHtml}
      <div class="day-agenda-free">${slotHtml}</div>
      <div class="day-agenda-list">${jobHtml}</div>
    `;
  }

  function bookingTypeCounts(rows) {
    return rows.reduce((counts, row) => {
      const type = bookingDisplayType(row);
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, { service: 0, reparasjon: 0, befaring: 0, installasjon: 0, blaseisolering: 0 });
  }

  function bookingLoadKind(rows) {
    const counts = bookingTypeCounts(rows);
    if (!rows.length) return "free";
    if (counts.installasjon >= 2 || rows.length >= 7) return "busy";
    if (counts.installasjon >= 1 || rows.length >= 4) return "some";
    return "light";
  }

  function shiftBookingMonth(offset) {
    const base = bookingMonthBaseDate();
    base.setMonth(base.getMonth() + offset);
    const selectedDay = Math.min(Number((el.bookingDate.value || "").slice(8, 10)) || 1, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate());
    base.setDate(selectedDay);
    el.bookingDate.value = isoDate(base);
    renderBookingMonth();
  }

  function routeMonthBaseDate() {
    const value = el.routeBookingDate?.value || isoDate(new Date());
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function renderRouteMonth() {
    if (!el.routeMonthGrid || !el.routeMonthLabel) return;
    const base = routeMonthBaseDate();
    const month = base.getMonth();
    const year = base.getFullYear();
    const selected = el.routeBookingDate?.value || "";
    const formatter = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" });
    el.routeMonthLabel.textContent = formatter.format(base);
    const firstDayOffset = (new Date(year, month, 1).getDay() || 7) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows = bookingRows();
    const cells = [
      ...["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => `<div class="month-weekday">${day}</div>`),
    ];
    for (let i = 0; i < firstDayOffset; i += 1) cells.push(`<div class="month-empty"></div>`);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayRows = rows.filter((row) => row.booking.date === date);
      const counts = bookingTypeCounts(dayRows);
      const load = bookingLoadKind(dayRows);
      const label = dayRows.length ? `${dayRows.length} jobb${dayRows.length === 1 ? "" : "er"}` : "Ledig";
      const today = isTodayIso(date);
      cells.push(`
        <button class="month-day ${load} ${selected === date ? "selected" : ""} ${today ? "today" : ""}" data-route-date="${date}" type="button" title="${escapeHtml(today ? `I dag. ${label}` : label)}">
          <span>${day}</span>
          <em>${dayRows.length || ""}</em>
          <b>
            ${counts.service ? `<i class="service"></i>` : ""}
            ${counts.reparasjon ? `<i class="reparasjon"></i>` : ""}
            ${counts.befaring ? `<i class="befaring"></i>` : ""}
            ${counts.installasjon ? `<i class="installasjon"></i>` : ""}
            ${counts.blaseisolering ? `<i class="blaseisolering"></i>` : ""}
          </b>
        </button>
      `);
    }
    el.routeMonthGrid.innerHTML = cells.join("");
  }

  function shiftRouteMonth(offset) {
    const base = routeMonthBaseDate();
    base.setMonth(base.getMonth() + offset);
    const selectedDay = Math.min(Number((el.routeBookingDate?.value || "").slice(8, 10)) || 1, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate());
    base.setDate(selectedDay);
    if (el.routeBookingDate) el.routeBookingDate.value = isoDate(base);
    renderRoutePlanner();
  }

  function bookingFormValues() {
    const existing = bookings[editingBookingId] || null;
    const customer = findCustomer(el.bookingCustomer.value);
    const installationId = el.bookingInstallationSelect?.value || "";
    const installation = customer && installationId
      ? installationsForCustomer(customer).find((item) => String(item.id || "") === String(installationId))
      : null;
    const location = installation ? locationForInstallation(installation, customer) : null;
    const paymentMarker = markerText(existing?.note, paymentMarkerRegex());
    const rawNote = el.bookingNote.value.trim();
    const linkedOrder = bookingPendingOrderId ? findOrder(bookingPendingOrderId) : linkedOrderForBooking(editingBookingId);
    const priceBasis = extractJobPriceBasis(rawNote)
      || extractJobPriceBasis(existing?.note)
      || extractJobPriceBasis(linkedOrder?.note);
    const installationNote = installation && !/^\s*Anlegg:/im.test(rawNote)
      ? installationBookingNote(installation, customer)
      : "";
    const note = noteWithJobPriceBasis([
      cleanBookingNote(rawNote),
      installationNote,
      paymentMarker,
    ].filter(Boolean).join("\n"), priceBasis);
    return {
      customerId: el.bookingCustomer.value,
      date: el.bookingDate.value,
      time: normalizeBookingTime(el.bookingTime.value),
      type: el.bookingType.value,
      duration: el.bookingDuration.value,
      resource: el.bookingResource.value,
      note,
      installationId,
      installation_id: installationId,
      locationId: location?.id || "",
      location_id: location?.id || "",
      orderId: bookingPendingOrderId || existing?.orderId || linkedOrderForBooking(editingBookingId)?.id || "",
      status: existing?.status,
      invoiced: existing?.invoiced,
      needs_move: false,
    };
  }

  async function saveCustomerFromDialog() {
    const values = customerFormValues();
    if (store.isConfigured) {
      const existing = findCustomer(editingCustomerId) || {};
      const saved = await store.saveCustomer({ ...existing, ...values });
      const index = customers.findIndex((customer) => customerKey(customer) === customerKey(saved));
      if (index >= 0) customers[index] = saved;
      else customers.unshift(saved);
      selectedCustomerId = customerKey(saved);
      upsertAccessNoteInMemory(saved, values.access_note);
      setSyncStatus("Kunde lagret i Supabase.", "ok");
    } else if (editingCustomerId) {
      requireLocalDemoStorage();
      const customer = findCustomer(editingCustomerId);
      Object.assign(customer, values);
      customerEdits[editingCustomerId] = { ...(customerEdits[editingCustomerId] || {}), ...values };
      selectedCustomerId = editingCustomerId;
      saveLocalEdits();
      upsertAccessNoteInMemory(customer, values.access_note);
    } else {
      requireLocalDemoStorage();
      const customer = { lime_id: `manual-${Date.now()}`, source: "Manuell", ...values };
      customers.unshift(customer);
      customerEdits[customer.lime_id] = customer;
      selectedCustomerId = customer.lime_id;
      saveLocalEdits();
      upsertAccessNoteInMemory(customer, values.access_note);
    }
    el.customerDialog.close();
    currentCustomerFilter = "all";
    currentSearch = "";
    if (el.statusFilter) el.statusFilter.value = "all";
    if (el.customerSearch) el.customerSearch.value = "";
    setView("customers");
  }

  async function saveBookingFromDialog() {
    const values = bookingFormValues();
    if (!values.customerId) throw new Error("Velg en kunde før du lagrer avtale.");
    const conflict = bookingConflict(values, editingBookingId);
    if (conflict) {
      throw new Error(bookingConflictMessage("Konflikt", values, conflict, editingBookingId));
    }
    const savedMessage = store.isConfigured ? "Avtale lagret i Supabase." : "Avtale lagret i lokal utviklingsdemo.";
    let savedId = editingBookingId;
    if (store.isConfigured) {
      const saved = await store.saveBooking(editingBookingId, values);
      bookings[saved.id] = {
        ...saved.booking,
        installationId: values.installationId,
        installation_id: values.installationId,
        locationId: values.locationId,
        location_id: values.locationId,
      };
      savedId = saved.id;
      if (editingBookingId && editingBookingId !== saved.id) delete bookings[editingBookingId];
    } else {
      requireLocalDemoStorage();
      const id = editingBookingId || `booking-${Date.now()}`;
      bookings[id] = values;
      savedId = id;
      saveLocalBookings();
    }
    if (bookingPendingOrderId && orders[bookingPendingOrderId]) {
      const order = orders[bookingPendingOrderId];
      const scheduledOrder = setBookingIdsForOrder({
        ...order,
        status: "scheduled",
        type: values.type || order.type,
        scheduledDate: values.date,
        scheduledTime: values.time,
        resource: values.resource,
        installationId: values.installationId || order.installationId || order.installation_id || "",
        installation_id: values.installationId || order.installation_id || order.installationId || "",
        locationId: values.locationId || order.locationId || order.location_id || "",
        location_id: values.locationId || order.location_id || order.locationId || "",
        note: order.note || values.note || "",
      }, [...bookingIdsForOrder(order), savedId]);
      const savedOrder = await saveOrderRecord(order.id, scheduledOrder, { quiet: true });
      if (bookings[savedId]) {
        bookings[savedId].orderId = savedOrder.id;
        if (!store.isConfigured) saveLocalBookings();
      }
    } else {
      await ensureOrderForBooking(savedId, {
        ...(bookings[savedId] || values),
        installationId: values.installationId,
        installation_id: values.installationId,
        locationId: values.locationId,
        location_id: values.locationId,
      });
    }
    bookingPendingOrderId = "";
    if (values.date) weekStart = startOfWeek(new Date(`${values.date}T00:00:00`));
    el.bookingDialog.close();
    showBookingInPlanning(savedId);
    setSyncStatus(savedMessage, "ok");
  }

  async function saveRouteDraftBookings() {
    const drafts = routeBookingRows();
    if (!drafts.length) throw new Error("Ingen kunder i ruteplanen.");
    const draftConflict = draftBookingConflict(drafts);
    if (draftConflict) {
      const leftCustomer = findCustomer(draftConflict.left.customerId);
      const rightCustomer = findCustomer(draftConflict.right.customerId);
      throw new Error(`Ruten har overlapp internt: ${bookingTimeText(draftConflict.left)} hos ${cleanDisplayName(leftCustomer)} krasjer med ${bookingTimeText(draftConflict.right)} hos ${cleanDisplayName(rightCustomer)}.`);
    }
    const conflict = drafts.map((draft) => ({ draft, conflict: bookingConflict(draft, "") })).find((item) => item.conflict);
    if (conflict) {
      throw new Error(`Ruten krasjer med eksisterende booking: ${conflict.conflict.booking.resource || "Ansatt"} er allerede booket ${formatDate(conflict.conflict.booking.date)} kl. ${bookingTimeText(conflict.conflict.booking)} hos ${cleanDisplayName(conflict.conflict.customer)}.`);
    }
    const ok = await askForConfirmation({
      title: "Book rute som utkast",
      message: `Booke ${drafts.length} servicejobber som utkast på ${formatDate(drafts[0].date)}?\n\nDette legger jobbene i planen og oppretter jobbutkast på kundene.`,
      confirmLabel: "Book utkast",
    });
    if (!ok) return;
    for (const draft of drafts) {
      let savedId = "";
      if (store.isConfigured) {
        const saved = await store.saveBooking("", draft);
        bookings[saved.id] = saved.booking;
        savedId = saved.id;
      } else {
        requireLocalDemoStorage();
        savedId = `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        bookings[savedId] = draft;
      }
      await ensureOrderForBooking(savedId, bookings[savedId] || draft);
    }
    if (!store.isConfigured) saveLocalBookings();
    weekStart = startOfWeek(new Date(`${drafts[0].date}T00:00:00`));
    setSyncStatus(`Booket ${drafts.length} servicejobber som utkast.`, "ok");
    setView("planning");
  }

  async function removeBooking(id, options = {}) {
    if (!id) return;
    const linkedOrder = linkedOrderForBooking(id) || findOrder(bookings[id]?.orderId);
    if (!linkedOrder || !options.deleteLinkedOrder) {
      await markOrderUnscheduledForBooking(id);
    }
    if (store.isConfigured) await store.cancelBooking(id);
    delete bookings[id];
    if (!store.isConfigured) saveLocalBookings();
    if (linkedOrder && options.deleteLinkedOrder) {
      await deleteOrderRecord(linkedOrder.id);
    }
    renderAll();
  }

  function showDeleteBookingMessage(message, type = "error") {
    if (!el.deleteBookingDialogMessage) return;
    el.deleteBookingDialogMessage.textContent = message || "";
    el.deleteBookingDialogMessage.className = `dialog-message ${type}`;
    el.deleteBookingDialogMessage.classList.toggle("hidden", !message);
  }

  function clearDeleteBookingMessage() {
    showDeleteBookingMessage("", "error");
  }

  function openDeleteBookingDialog(id, options = {}) {
    if (!id || !el.deleteBookingDialog) return;
    const row = bookingRows().find((item) => item.id === id);
    const booking = bookings[id];
    const customer = row?.customer || findCustomer(booking?.customerId);
    if (!booking || !customer) {
      setSyncStatus("Fant ikke bookingen som skulle fjernes.", "error");
      return;
    }
    const order = linkedOrderForBooking(id) || findOrder(bookings[id]?.orderId);
    deleteBookingDialogBookingId = id;
    deleteBookingCloseBookingDialog = Boolean(options.closeBookingDialog);
    el.deleteBookingSummary.innerHTML = `
      <strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong>
      <span>${escapeHtml(bookingJobLabel(booking))} · ${formatDate(booking.date)} kl. ${escapeHtml(bookingTimeText(booking))} · ${escapeHtml(booking.resource || "")}</span>
      ${order ? `<p>Koblet til jobb: ${escapeHtml(order.title || "Jobb")}</p>` : `<p>Ingen tilknyttet jobb funnet. Kun avtalen fjernes fra kalenderen.</p>`}
    `;
    if (el.deleteBookingOrderOptions) el.deleteBookingOrderOptions.classList.toggle("hidden", !order);
    if (el.deleteBookingKeepOrder) el.deleteBookingKeepOrder.checked = true;
    if (el.deleteBookingDeleteOrder) el.deleteBookingDeleteOrder.disabled = !order;
    clearDeleteBookingMessage();
    el.deleteBookingDialog.showModal();
  }

  async function deleteBookingFromDialog() {
    const id = deleteBookingDialogBookingId;
    if (!id) throw new Error("Fant ikke bookingen som skulle fjernes.");
    const order = linkedOrderForBooking(id) || findOrder(bookings[id]?.orderId);
    const deleteLinkedOrder = Boolean(order && el.deleteBookingDeleteOrder?.checked);
    await removeBooking(id, { deleteLinkedOrder });
    deleteBookingDialogBookingId = "";
    el.deleteBookingDialog.close();
    if (deleteBookingCloseBookingDialog && el.bookingDialog?.open) el.bookingDialog.close();
    deleteBookingCloseBookingDialog = false;
    setSyncStatus(deleteLinkedOrder ? "Avtale og tilknyttet jobb slettet." : "Avtale fjernet fra kalenderen.", "ok");
  }

  function completionOptions(type) {
    if (type === "blaseisolering") {
      return [
        ["none", "Ingen neste steg nå"],
      ];
    }
    if (serviceWorkType(type)) {
      return [
        ["none", "Ingen neste servicefrist"],
        ["service_followup", "Lag servicefrist hvis dette også var service"],
      ];
    }
    if (type === "befaring") {
      return [
        ["offer_followup", "Tilbud må sendes"],
        ["offer_sent_followup", "Tilbud gitt muntlig / venter svar"],
        ["book_installation", "Kunden sa ja - book installasjon nå"],
        ["won_followup", "Kunden sa ja - planlegg senere"],
        ["followup_later", "Oppfølging senere / ring igjen"],
        ["none", "Ingen neste steg nå"],
      ];
    }
    if (type === "installasjon") {
      return [
        ["service_followup", "Lag neste servicefrist"],
        ["none", "Ingen neste servicefrist"],
      ];
    }
    return [
      ["service_followup", "Lag neste servicefrist"],
      ["none", "Ingen neste servicefrist"],
    ];
  }

  function formatJobPriceNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return number.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
  }

  function formatJobPriceAmount(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    const decimals = Number.isInteger(number) ? 0 : 2;
    return `${number.toLocaleString("nb-NO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })},-`;
  }

  function parseJobPriceAmount(value) {
    const normalized = String(value || "").replace(/\s/g, "").replace(",", ".");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function jobPriceBasisTotal(text) {
    return [...String(text || "").matchAll(/=\s*([\d\s]+(?:,\d{1,2})?)\s*(?:,-|kr|inkl|$)/gi)]
      .reduce((sum, match) => sum + parseJobPriceAmount(match[1]), 0);
  }

  function jobPriceLineForItem(item, quantity) {
    const qty = Number(quantity || item.defaultQty || 1);
    const amount = qty * Number(item.price || 0);
    return `- ${offerLineDisplayLabel(item)}: ${formatJobPriceNumber(qty)} ${item.unit} x ${formatJobPriceAmount(item.price)} = ${formatJobPriceAmount(amount)} inkl. mva`;
  }

  function renderCompletionPriceTotal() {
    if (!el.completionPriceTotal || !el.completionPriceLines) return;
    const total = jobPriceBasisTotal(el.completionPriceLines.value);
    el.completionPriceTotal.textContent = total > 0
      ? `Ca. sum grunnlag: ${formatJobPriceAmount(total)} inkl. mva - kontroller før faktura.`
      : "Ingen summerbare produkt- eller tilleggslinjer lagt inn.";
  }

  function renderBillingPriceTotal() {
    if (!el.billingPriceTotal || !el.billingPriceBasis) return;
    const total = jobPriceBasisTotal(el.billingPriceBasis.value);
    el.billingPriceTotal.textContent = total > 0
      ? `Ca. sum grunnlag: ${formatJobPriceAmount(total)} inkl. mva.`
      : "Ingen summerbare produkt- eller tilleggslinjer.";
  }

  function billingDraftTextForRow(row, options = {}) {
    if (!row) return "";
    const customer = row.customer || {};
    const linkedOrder = linkedOrderForBooking(row.id) || findOrder(row.booking.orderId);
    const linkedJob = linkedOrder ? jobForOrder(linkedOrder) : null;
    const installationText = linkedOrder ? orderInstallationText(linkedOrder, customer, linkedJob) : "";
    const priceBasis = "priceBasis" in options
      ? String(options.priceBasis || "").trim()
      : extractJobPriceBasis(row.booking.note);
    const total = jobPriceBasisTotal(priceBasis);
    const note = String(options.note || "").trim();
    const contact = [
      customer.phone ? `Telefon: ${customer.phone}` : "",
      customer.email ? `E-post: ${customer.email}` : "",
      customer.organization_number ? `Org.nr: ${customer.organization_number}` : "",
    ].filter(Boolean);
    const address = [
      addressFor(customer) ? `Anleggsadresse: ${addressFor(customer)}` : "",
      postalAddressFor(customer) ? `Postadresse: ${postalAddressFor(customer)}` : "",
      installationText ? `Anlegg: ${installationText}` : "",
    ].filter(Boolean);
    return [
      "FAKTURAGRUNNLAG FRA CRM",
      "",
      `Kunde: ${cleanDisplayName(customer)}`,
      ...contact,
      ...address,
      "",
      `Jobb: ${bookingJobLabel(row)}`,
      `Dato: ${formatDate(row.booking.date)}${bookingTimeText(row.booking) ? ` kl. ${bookingTimeText(row.booking)}` : ""}`,
      row.booking.resource ? `Utført av: ${row.booking.resource}` : "",
      linkedOrder?.id ? `CRM jobb-id: ${linkedOrder.id}` : `CRM booking-id: ${row.id}`,
      "",
      "Prislinjer:",
      priceBasis || "Mangler prislinjer. Kontroller jobben før faktura lages.",
      total > 0 ? `Sum inkl. mva: ${formatJobPriceAmount(total)}` : "",
      "",
      note ? `Notat: ${note}` : "",
      "Status: Skal kontrolleres og faktureres i eAccounting. Marker fakturert i CRM først etter at faktura er sendt.",
    ].filter((line, index, list) => line || list[index - 1] !== "").join("\n").trim();
  }

  async function copyBillingDraftFromDialog() {
    const row = billingDialogBookingId ? bookingRows().find((item) => item.id === billingDialogBookingId) : null;
    if (!row) throw new Error("Fant ikke jobben som skulle kopieres.");
    const text = billingDraftTextForRow(row, {
      priceBasis: el.billingPriceBasis?.value || "",
      note: el.billingNote?.value || "",
    });
    await copyTextToClipboard(text);
    showBillingDialogMessage("Fakturagrunnlag kopiert. Åpne eAccounting og lim det inn i fakturautkast/notat.", "ok");
    setSyncStatus("Fakturagrunnlag kopiert. Lim det inn i eAccounting som grunnlag/notat før faktura sendes.", "ok");
  }

  function syncCompletionPriceQuantity() {
    if (!el.completionPricePreset || !el.completionPriceQuantity) return;
    const item = offerLinePresets.find((entry) => entry.id === el.completionPricePreset.value);
    if (item) el.completionPriceQuantity.value = String(item.defaultQty || 1);
  }

  function defaultCompletionPriceItemId(type) {
    if (type === "service") return "service_heatpump";
    if (type === "reparasjon" || serviceWorkType(type)) return "technician_hour";
    if (type === "installasjon") return "standard_installation";
    return jobPriceItems[0]?.id || "";
  }

  function syncCompletionPriceSearch() {
    if (!el.completionPricePreset) return;
    const query = el.completionPriceSearch?.value || "";
    const currentValue = el.completionPricePreset.value || defaultCompletionPriceItemId(bookingDisplayType(bookingRows().find((item) => item.id === completingBookingId))) || "standard_installation";
    el.completionPricePreset.innerHTML = offerLinePresetOptions(currentValue, query);
    const available = new Set(Array.from(el.completionPricePreset.options).map((option) => option.value).filter(Boolean));
    const preferredValue = query.trim() ? firstOfferLineMatch(query).id : currentValue;
    el.completionPricePreset.value = available.has(preferredValue) ? preferredValue : firstOfferLineMatch(query).id;
    syncCompletionPriceQuantity();
  }

  function setupCompletionPriceFields(row) {
    if (!el.completionPriceDetails || !el.completionPricePreset || !el.completionPriceLines) return;
    const type = bookingDisplayType(row);
    const show = completionCanHavePayment(type);
    el.completionPriceDetails.classList.toggle("hidden", !show);
    if (!show) {
      el.completionPriceLines.value = "";
      return;
    }
    if (el.completionPriceSearch) el.completionPriceSearch.value = "";
    const preferredId = defaultCompletionPriceItemId(type);
    el.completionPricePreset.innerHTML = offerLinePresetOptions(preferredId || "standard_installation", "");
    if (preferredId && offerLinePresets.some((item) => item.id === preferredId)) {
      el.completionPricePreset.value = preferredId;
    }
    el.completionPriceLines.value = extractJobPriceBasis(row.booking.note);
    syncCompletionPriceQuantity();
    el.completionPriceDetails.open = Boolean(el.completionPriceLines.value) || ["installasjon", "reparasjon"].includes(type);
    renderCompletionPriceTotal();
  }

  function addCompletionPriceLine() {
    if (!el.completionPricePreset || !el.completionPriceQuantity || !el.completionPriceLines) return;
    const item = offerLinePresets.find((entry) => entry.id === el.completionPricePreset.value);
    if (!item || item.id === "heatpump_custom") {
      const label = String(el.completionPriceSearch?.value || "").trim();
      if (!label) return;
      const quantity = Number(String(el.completionPriceQuantity.value || 1).replace(",", "."));
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      const existing = String(el.completionPriceLines.value || "").trim();
      el.completionPriceLines.value = [existing, `- ${label}: ${formatJobPriceNumber(quantity)} stk - pris avtales/legges inn`].filter(Boolean).join("\n");
      renderCompletionPriceTotal();
      return;
    }
    const quantity = Number(el.completionPriceQuantity.value || item.defaultQty || 1);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const existing = String(el.completionPriceLines.value || "").trim();
    const line = offerLineItemIsHeatPump(item)
      ? [jobPriceLineForItem(item, quantity), standardInstallationOfferLine(quantity)].filter(Boolean).join("\n")
      : jobPriceLineForItem(item, quantity);
    el.completionPriceLines.value = [existing, line].filter(Boolean).join("\n");
    renderCompletionPriceTotal();
  }

  function completionPriceBasisText() {
    return String(el.completionPriceLines?.value || "").trim();
  }

  function completionAttachmentFiles() {
    return Array.from(el.completionAttachments?.files || []);
  }

  function completionAttachmentContextForRow(row) {
    const linkedOrder = row ? (linkedOrderForBooking(row.id) || findOrder(row.booking.orderId)) : null;
    const linkedJob = linkedOrder ? jobForOrder(linkedOrder) : null;
    return {
      row,
      customer: row?.customer || null,
      order: linkedOrder,
      job: linkedJob,
      canUpload: canUploadJobAttachment(row?.customer, linkedJob),
    };
  }

  function renderCompletionAttachmentList() {
    if (!el.completionAttachmentList || !el.completionAttachments) return;
    const context = completionAttachmentContext || {};
    const files = completionAttachmentFiles();
    const existing = attachmentsForJob(context.job);
    if (!context.customer?.id) {
      el.completionAttachmentList.innerHTML = `<span>Bildelagring krever lagret kundekort.</span>`;
      return;
    }
    if (!context.job?.id) {
      el.completionAttachmentList.innerHTML = `<span>Jobben mangler jobbkobling. Opprett jobbkobling før bilder kan lagres på jobben.</span>`;
      return;
    }
    const parts = [];
    if (existing.length) {
      parts.push(`<span>${existing.length.toLocaleString("nb-NO")} vedlegg er lagret på jobben fra før.</span>`);
    }
    if (files.length) {
      parts.push(`
        <ul>
          ${files.map((file) => `<li>${escapeHtml(file.name || "Vedlegg")} <small>${escapeHtml(attachmentSizeLabel(file.size))}</small></li>`).join("")}
        </ul>
      `);
    } else {
      parts.push(`<span>Ingen nye filer valgt.</span>`);
    }
    el.completionAttachmentList.innerHTML = parts.join("");
  }

  function setupCompletionAttachmentField(row) {
    if (!el.completionAttachmentSection || !el.completionAttachments || !el.completionAttachmentList) return;
    completionAttachmentContext = completionAttachmentContextForRow(row);
    el.completionAttachments.value = "";
    const shouldShow = Boolean(store.isConfigured && store.saveCrmAttachment && row?.customer?.id && (isAdmin() || isTechnicianUser()));
    el.completionAttachmentSection.classList.toggle("hidden", !shouldShow);
    el.completionAttachments.disabled = !completionAttachmentContext.canUpload;
    renderCompletionAttachmentList();
  }

  async function saveCompletionAttachments(row, selectedInstallation, doneDate) {
    const files = completionAttachmentFiles();
    if (!files.length) return [];
    const context = completionAttachmentContextForRow(row);
    if (!context.customer?.id) throw new Error("Kundekortet må være lagret før bilder kan lagres.");
    if (!context.job?.id) throw new Error("Jobben mangler jobbkobling. Opprett jobbkobling før bilder kan lagres på jobben.");
    const installationId = selectedInstallation?.id || installationIdForOrder(context.order, context.job) || null;
    const saved = [];
    setSyncStatus(`Laster opp ${files.length.toLocaleString("nb-NO")} vedlegg...`, "");
    for (let index = 0; index < files.length; index += 1) {
      const rowAttachment = await store.saveCrmAttachment(files[index], {
        customer_id: context.customer.id,
        job_id: context.job.id,
        installation_id: installationId,
        source_kind: "jobb_fullforing",
        note: `Lastet opp ved fullføring ${formatDate(doneDate)}.`,
        source_order: index,
      });
      saved.push(rowAttachment);
    }
    replaceCrmAttachments(saved);
    return saved;
  }

  function openCompletionDialog(id) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row) return;
    completingBookingId = id;
    completionFollowupBooking = null;
    const type = bookingDisplayType(row);
    const cleanNote = cleanBookingNote(row.booking.note);
    const priceBasis = extractJobPriceBasis(row.booking.note);
    el.completionTitle.textContent = isTechnicianUser()
      ? `${technicianText("completionTitle")} ${bookingJobLabel(row).toLowerCase()}`
      : `Fullfør ${bookingJobLabel(row).toLowerCase()}`;
    el.completionSummary.innerHTML = `
      <strong>${customerStarHtml(row.customer)}${customerCashBadgeHtml(row.customer)}${escapeHtml(cleanDisplayName(row.customer))}</strong>
      <span>${formatDate(row.booking.date)} kl. ${escapeHtml(bookingTimeText(row.booking))} · ${escapeHtml(row.booking.resource || "")}</span>
      <em>${escapeHtml(bookingWorkKind(row).help)}</em>
      ${isTechnicianUser() && currentTechnicianExtraHelp() ? `<p class="tech-flow-help">${escapeHtml(technicianText("completionHelp"))}</p>` : ""}
      ${cleanNote ? `<p>${escapeHtml(cleanNote)}</p>` : ""}
      ${priceBasis ? `<p>Prisgrunnlag er allerede lagt inn på jobben.</p>` : ""}
    `;
    el.completionDoneDate.value = row.booking.date || isoDate(new Date());
    const nextOptions = isAdmin() ? completionOptions(type) : [["none", technicianText("noNextStep")]];
    el.completionNextAction.innerHTML = nextOptions
      .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
      .join("");
    el.completionInterval.value = "2";
    el.completionNextDate.value = type === "befaring" || serviceWorkType(type) ? "" : addYearsIso(el.completionDoneDate.value, 2);
    setupCompletionInstallationField(row);
    syncCompletionIntervalFromInstallation();
    setupCompletionPaymentFields(row);
    setupCompletionPriceFields(row);
    setupCompletionAttachmentField(row);
    el.completionNote.value = "";
    if (isTechnicianUser()) {
      if (el.cancelCompletionButton) el.cancelCompletionButton.textContent = technicianText("cancel");
      if (el.completionSubmitButton) el.completionSubmitButton.textContent = technicianText("complete");
    } else {
      if (el.cancelCompletionButton) el.cancelCompletionButton.textContent = "Avbryt";
      if (el.completionSubmitButton) el.completionSubmitButton.textContent = "Fullfør";
    }
    syncCompletionFields();
    el.completionDialog.showModal();
  }

  function syncCompletionIntervalFromInstallation() {
    const customer = bookingRows().find((item) => item.id === completingBookingId)?.customer;
    const installationId = el.completionInstallation?.value || "";
    const installation = customer && installationId
      ? installationsForCustomer(customer).find((item) => String(item.id || "") === String(installationId))
      : null;
    const months = installationServiceIntervalMonths(installation);
    if (!months) return;
    if (months === 12 || months === 24) el.completionInterval.value = String(months / 12);
    if (el.completionDoneDate?.value && el.completionNextAction?.value === "service_followup") {
      el.completionNextDate.value = addMonthsIsoDate(el.completionDoneDate.value, months) || addYearsIso(el.completionDoneDate.value, el.completionInterval.value);
    }
  }

  function setupCompletionInstallationField(row) {
    if (!el.completionInstallationLabel || !el.completionInstallation) return;
    if (!isAdmin()) {
      el.completionInstallation.value = "";
      el.completionInstallation.innerHTML = "";
      el.completionInstallationLabel.classList.add("hidden");
      return;
    }
    const type = bookingDisplayType(row);
    const relevant = ["service", "installasjon"].includes(type);
    const linkedOrder = linkedOrderForBooking(row.id) || findOrder(row.booking.orderId);
    const linkedInstallationId = linkedOrder ? installationIdForOrder(linkedOrder, jobForOrder(linkedOrder)) : "";
    const installations = relevant
      ? installationsForCustomer(row.customer).filter((installation) => (
        installation.active !== false || String(installation.id || "") === String(linkedInstallationId)
      ))
      : [];
    el.completionInstallation.innerHTML = "";
    if (!installations.length) {
      el.completionInstallationLabel.classList.add("hidden");
      return;
    }
    const activeInstallations = installations.filter((installation) => installation.active !== false);
    const singleActiveInstallation = activeInstallations.length === 1 ? activeInstallations[0] : null;
    const needsExplicitInstallation = activeInstallations.length > 1 && !linkedInstallationId;
    const options = [
      `<option value="">${needsExplicitInstallation ? "Velg anlegg før servicefrist lagres" : "Kundekortets hovedfrist"}</option>`,
      ...installations.map((installation) => {
        const location = locationForInstallation(installation, row.customer);
        const label = [installationDisplayName(installation), locationAddressText(location)].filter(Boolean).join(" - ");
        return `<option value="${escapeHtml(installation.id || "")}">${escapeHtml(label)}</option>`;
      }),
    ];
    el.completionInstallation.innerHTML = options.join("");
    el.completionInstallation.value = linkedInstallationId || singleActiveInstallation?.id || "";
    el.completionInstallation.title = needsExplicitInstallation
      ? "Kunden har flere anlegg. Velg riktig varmepumpe før ny servicefrist lagres."
      : "Velg hvilket anlegg service eller installasjon gjelder.";
    el.completionInstallationLabel.classList.toggle("hidden", installations.length < 2 && !singleActiveInstallation);
  }

  function completionCanHavePayment(type) {
    return billableJobType(type || "service");
  }

  function completionBillingStatus(type, customer, paymentDone) {
    if (!completionCanHavePayment(type)) return "not_ready";
    if (paymentDone && customer?.pays_cash) return "paid";
    if (paymentDone) return "sent";
    return customer?.pays_cash ? "not_ready" : "ready";
  }

  function setupCompletionPaymentFields(row) {
    if (!el.completionPaymentDoneLabel || !el.completionPaymentDone) return;
    const type = bookingDisplayType(row);
    const show = isAdmin() && completionCanHavePayment(type);
    el.completionPaymentDone.checked = false;
    el.completionPaymentDoneLabel.classList.toggle("hidden", !show);
    el.completionPaymentHint?.classList.toggle("hidden", !show);
    if (!show) return;
    const labelText = row.customer?.pays_cash
      ? "Betaling er mottatt"
      : "Faktura er sendt";
    const labelSpan = el.completionPaymentDoneLabel.querySelector("span");
    if (labelSpan) labelSpan.textContent = labelText;
    if (el.completionPaymentHint) {
      el.completionPaymentHint.textContent = row.customer?.pays_cash
        ? "La stå av hvis jobben er utført, men betaling ikke er mottatt ennå."
        : "La stå av hvis jobben er utført, men faktura skal sendes manuelt etterpå.";
    }
  }

  function syncCompletionFields() {
    const showServiceFields = el.completionNextAction.value === "service_followup";
    el.completionIntervalLabel.classList.toggle("hidden", !showServiceFields);
    el.completionNextDateLabel.classList.toggle("hidden", !showServiceFields);
    if (showServiceFields && !el.completionNextDate.value) {
      el.completionNextDate.value = addYearsIso(el.completionDoneDate.value, el.completionInterval.value);
    }
  }

  function appendCustomerNote(customer, line) {
    const existing = String(customer.local_note || "").trim();
    return [existing, line].filter(Boolean).join("\n");
  }

  function appendServiceDate(customer, date) {
    const dates = new Set(String(customer.service_dates || "").match(/\d{4}-\d{2}-\d{2}/g) || []);
    if (date) dates.add(date);
    return [...dates].sort().join("; ");
  }

  function addServiceEventToLocalCache(customer, event) {
    const key = customerKey(customer);
    const row = {
      id: event.id,
      customer_id: event.customer_id || key,
      lime_id: event.lime_id || customer.lime_id,
      event_date: event.event_date,
      event_type: event.event_type,
      note: event.note,
      created_at: event.created_at,
    };
    const list = serviceEventsByCustomer.get(key) || [];
    list.unshift(row);
    serviceEventsByCustomer.set(key, list);
    return row;
  }

  async function saveServiceEvent(customer, event) {
    const key = customerKey(customer);
    const row = {
      customer_id: key,
      lime_id: customer.lime_id,
      event_date: event.event_date,
      event_type: event.event_type,
      note: event.note,
    };
    if (store.isConfigured && store.saveServiceEvent) {
      const saved = await store.saveServiceEvent({ ...row, customerId: customer.id || key });
      return addServiceEventToLocalCache(customer, saved);
    }
    return addServiceEventToLocalCache(customer, row);
  }

  async function saveActivityRecord(activity = {}) {
    const row = {
      customer_id: activity.customer_id || activity.customerId || null,
      lead_id: activity.lead_id || activity.leadId || null,
      job_id: activity.job_id || activity.jobId || null,
      activity_type: activity.activity_type || activity.activityType || "note",
      summary: activity.summary || "CRM-aktivitet",
      body: activity.body || null,
      metadata: activity.metadata && typeof activity.metadata === "object" ? activity.metadata : {},
      occurred_at: activity.occurred_at || activity.occurredAt || new Date().toISOString(),
    };
    if (store.isConfigured && store.saveActivity) {
      const saved = await store.saveActivity(row);
      activities.unshift(saved);
      return saved;
    }
    const local = {
      ...row,
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      created_at: new Date().toISOString(),
    };
    activities.unshift(local);
    return local;
  }

  function updateCustomerInMemory(customer) {
    const index = customers.findIndex((item) => customerKey(item) === customerKey(customer));
    if (index >= 0) customers[index] = customer;
    return customer;
  }

  async function saveCustomerAfterCompletion(customer, options = {}) {
    if (options.localOnly) return updateCustomerInMemory(customer);
    if (store.isConfigured) {
      const saved = await store.saveCustomer(customer);
      const index = customers.findIndex((item) => customerKey(item) === customerKey(saved));
      if (index >= 0) customers[index] = saved;
      return saved;
    }
    const key = customerKey(customer);
    customerEdits[key] = { ...(customerEdits[key] || {}), ...customer };
    saveLocalEdits();
    return customer;
  }

  function updateLocalInstallation(customer, installationId, patch) {
    if (!installationId) return null;
    const keys = [customerKey(customer), customer?.lime_id].filter(Boolean);
    let updated = null;
    for (const key of keys) {
      const list = installationsByCustomer.get(key) || [];
      const index = list.findIndex((installation) => String(installation.id || "") === String(installationId));
      if (index < 0) continue;
      list[index] = { ...list[index], ...patch };
      updated = list[index];
      installationsByCustomer.set(key, list);
    }
    return updated;
  }

  function recalculateCustomerServiceFromInstallations(customer) {
    const installationDates = installationsForCustomer(customer)
      .map((installation) => installation.next_service_due)
      .filter(Boolean)
      .sort();
    if (installationDates.length) {
      customer.next_service_due = installationDates[0];
      customer.service_status = "Service ok";
    }
  }

  async function saveInstallationAfterCompletion(customer, installationId, patch, options = {}) {
    if (!installationId) return null;
    const updated = updateLocalInstallation(customer, installationId, patch);
    if (options.localOnly) return updated;
    if (store.isConfigured && store.saveInstallationPatch) {
      const saved = await store.saveInstallationPatch(installationId, patch);
      updateLocalInstallation(customer, installationId, saved);
      return saved;
    }
    return updated;
  }

  async function setBookingDone(id, done, options = {}) {
    if (store.isConfigured) {
      await store.markBookingDone(id, done, options);
    } else {
      requireLocalDemoStorage();
      if (done) doneJobs.add(id);
      else doneJobs.delete(id);
      localStorage.setItem(storage.doneJobs, JSON.stringify([...doneJobs]));
    }
    if (bookings[id]) {
      bookings[id].status = done ? "done" : "booked";
      bookings[id].done_at = done ? options.completedAt || new Date().toISOString() : null;
      if (done) bookings[id].needs_move = false;
      if ("bookingNote" in options) bookings[id].note = options.bookingNote || "";
    }
    if (!done) {
      const order = linkedOrderForBooking(id);
      if (order) {
        await saveOrderRecord(order.id, {
          ...order,
          status: "scheduled",
          billingStatus: "not_ready",
          completedAt: "",
        }, { quiet: true });
      }
    }
  }

  function customerTagsWithoutLead(customer) {
    return uniqueTags(splitTags(customer.tags).filter((tag) => !/^lead$/i.test(tag) && !/^lead(status)?\s*:/i.test(tag)));
  }

  async function saveBookingRecord(id, booking) {
    if (store.isConfigured) {
      const saved = await store.saveBooking(id, booking);
      bookings[saved.id] = saved.booking;
      if (id && id !== saved.id) delete bookings[id];
      return saved;
    }
    requireLocalDemoStorage();
    bookings[id] = booking;
    saveLocalBookings();
    return { id, booking };
  }

  function clampPlanningMinutes(minutes) {
    const workStart = minutesFromTime("08:00");
    const workEnd = minutesFromTime("18:00");
    const rounded = Math.round(Number(minutes || workStart) / 15) * 15;
    return Math.max(workStart, Math.min(workEnd - 15, rounded));
  }

  function planningDropPlacement(event, bookingId, day) {
    const draggedRow = bookingRows().find((item) => item.id === bookingId);
    const targetEvent = event.target.closest(".timeline-event[data-booking-id], .job-card[data-booking-id]");
    if (targetEvent && targetEvent.dataset.bookingId !== bookingId) {
      const targetRow = bookingRows().find((item) => item.id === targetEvent.dataset.bookingId);
      if (targetRow) {
        const rect = targetEvent.getBoundingClientRect();
        const after = event.clientY >= rect.top + rect.height / 2;
        const minutes = after
          ? bookingRowEndMinutes(targetRow)
          : bookingRowStartMinutes(targetRow) - bookingDurationMinutes(draggedRow || targetRow);
        return {
          time: timeFromMinutes(clampPlanningMinutes(minutes)),
          label: after ? "etter valgt jobb" : "før valgt jobb",
        };
      }
    }
    const slot = event.target.closest("[data-planning-time]");
    if (slot?.dataset.planningTime) return { time: slot.dataset.planningTime, label: `kl. ${slot.dataset.planningTime}` };
    const grid = event.target.closest(".timeline-grid");
    if (grid && day?.contains(grid)) {
      const rect = grid.getBoundingClientRect();
      const ratio = rect.height ? Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) : 0;
      const workStart = minutesFromTime("08:00");
      const workEnd = minutesFromTime("18:00");
      const minutes = workStart + ratio * (workEnd - workStart);
      const time = timeFromMinutes(clampPlanningMinutes(minutes));
      return { time, label: `kl. ${time}` };
    }
    return planningFallbackDropPlacement(day?.dataset?.planningDate, draggedRow);
  }

  async function moveBookingToDate(id, targetDate, options = {}) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke bookingen som skulle flyttes.");
    if (row.booking.status === "done" || doneJobs.has(id)) {
      throw new Error("Utførte jobber kan ikke flyttes direkte. Angre fullføring først hvis datoen er feil.");
    }
    const targetTime = normalizeBookingTime(options.time || row.booking.time || bookingTimeText(row.booking));
    if (!targetDate || (row.booking.date === targetDate && bookingTimeText(row.booking) === targetTime)) return;
    const updated = {
      ...row.booking,
      date: targetDate,
      time: targetTime,
      needs_move: false,
      note: noteWithoutMoveMarker(row.booking.note),
      status: "booked",
      done_at: null,
    };
    const conflict = bookingConflict(updated, id);
    if (conflict) {
      throw new Error(bookingConflictMessage("Kan ikke flytte", updated, conflict, id));
    }
    const saved = await saveBookingRecord(id, updated);
    const savedId = saved.id || id;
    await ensureOrderForBooking(savedId, bookings[savedId] || updated, {
      status: "scheduled",
      scheduledDate: targetDate,
      scheduledTime: updated.time,
    });
    renderAll();
    const placement = options.placement ? ` (${options.placement})` : "";
    setSyncStatus(`Booking flyttet til ${formatDate(targetDate)} kl. ${targetTime}${placement}.`, "ok");
  }

  function billingModeLabel(mode) {
    return mode === "cash" ? "Betalt på stedet" : "Fakturert";
  }

  function billingModeMarker(mode, date) {
    return mode === "cash" ? `[Betalt på stedet ${date}]` : `[Fakturert ${date}]`;
  }

  function defaultBillingModeForRow(row) {
    return row?.customer?.pays_cash ? "cash" : "invoice";
  }

  async function markBookingPaymentDone(id, options = {}) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke bookingen.");
    const mode = options.mode || defaultBillingModeForRow(row);
    const billingDate = options.date || isoDate(new Date());
    const installDate = row.booking.date || billingDate;
    const userNote = String(options.note || "").trim();
    const marker = billingModeMarker(mode, billingDate);
    const paymentNote = userNote ? `${billingModeLabel(mode)}: ${userNote}` : "";
    const priceBasis = "priceBasis" in options
      ? String(options.priceBasis || "").trim()
      : extractJobPriceBasis(row.booking.note);
    const updatedBooking = {
      ...row.booking,
      note: noteWithJobPriceBasis([cleanBookingNote(row.booking.note), marker, paymentNote].filter(Boolean).join("\n"), priceBasis),
      invoiced: mode === "invoice",
      paid_cash: mode === "cash",
    };
    await saveBookingRecord(id, updatedBooking);

    const customer = row.customer;
    const displayType = bookingDisplayType(row);
    if (displayType === "installasjon") {
      customer.first_install_date = installDate;
      customer.next_service_due = addYearsIso(installDate, 2);
      customer.service_status = "Service ok";
      customer.tags = customerTagsWithoutLead(customer);
      customer.local_note = appendCustomerNote(
        customer,
        `Installasjon ${mode === "cash" ? "betalt på stedet" : "fakturert"} ${formatDate(billingDate)}. Neste service satt til ${formatDate(customer.next_service_due)} basert på installasjonsdato ${formatDate(installDate)}.`,
      );
    } else if (displayType === "service") {
      customer.last_service_date = installDate;
      customer.service_dates = appendServiceDate(customer, installDate);
      customer.next_service_due = addYearsIso(installDate, 2);
    }
    await saveCustomerAfterCompletion(customer);
    await saveServiceEvent(customer, {
      event_date: billingDate,
      event_type: billingModeLabel(mode),
      note: [
        `${bookingJobLabel(row)} markert ${mode === "cash" ? "betalt på stedet" : "fakturert"}.`,
        `Jobbdato/installasjonsdato: ${formatDate(installDate)}.`,
        priceBasis ? `Prisgrunnlag/tillegg: ${priceBasis.replace(/\n+/g, " / ")}` : "",
        userNote,
      ].filter(Boolean).join(" "),
    });
    await markOrderBillingForBooking(id, mode === "cash" ? "paid" : "sent", billingDate);
    renderAll();
    setSyncStatus(mode === "cash" ? "Jobb markert betalt og kundekort oppdatert." : "Jobb markert fakturert og kundekort oppdatert.", "ok");
  }

  async function markBookingInvoiced(id) {
    return markBookingPaymentDone(id, { mode: "invoice" });
  }

  function showBillingDialogMessage(message, type = "error") {
    if (!el.billingDialogMessage) return;
    el.billingDialogMessage.textContent = message || "";
    el.billingDialogMessage.className = `dialog-message ${type}`;
    el.billingDialogMessage.classList.toggle("hidden", !message);
  }

  function clearBillingDialogMessage() {
    showBillingDialogMessage("", "error");
  }

  function syncBillingDialogText() {
    if (!el.billingMode || !el.billingTitle || !el.billingHint || !el.saveBillingButton) return;
    const priceOnly = billingDialogPurpose === "price_basis";
    el.billingDateLabel?.classList.toggle("hidden", priceOnly);
    el.billingModeLabel?.classList.toggle("hidden", priceOnly);
    el.billingDate.required = !priceOnly;
    if (priceOnly) {
      el.billingTitle.textContent = "Rediger fakturagrunnlag";
      el.billingHint.textContent = "Dette endrer bare prisgrunnlag/tillegg på jobben. Det markerer ikke ny faktura eller betaling.";
      el.saveBillingButton.textContent = "Lagre grunnlag";
      return;
    }
    const mode = el.billingMode.value === "cash" ? "cash" : "invoice";
    if (mode === "cash") {
      el.billingTitle.textContent = "Marker betalt";
      el.billingHint.textContent = "Bruk bare når betaling på stedet faktisk er mottatt. Jobben lagres som betalt, ikke fakturert.";
      el.saveBillingButton.textContent = "Marker betalt";
    } else {
      el.billingTitle.textContent = "Marker faktura sendt";
      el.billingHint.textContent = "Bruk etter at faktura er sendt manuelt i eAccounting. Dette oppdaterer kundehistorikk og jobb.";
      el.saveBillingButton.textContent = "Marker fakturert";
    }
  }

  function openBillingDialog(id, options = {}) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row || !el.billingDialog) return;
    if (options.purpose === "price_basis" && !bookingCanHavePriceBasis(row)) {
      setSyncStatus("Befaringer skal normalt ikke faktureres. Bruk tilbud/oppfølging i stedet.", "error");
      return;
    }
    billingDialogBookingId = id;
    billingDialogPurpose = options.purpose || "billing";
    const defaultMode = defaultBillingModeForRow(row);
    const priceBasis = extractJobPriceBasis(row.booking.note);
    el.billingMode.value = defaultMode;
    el.billingDate.value = isoDate(new Date());
    if (el.billingPriceBasis) el.billingPriceBasis.value = priceBasis;
    if (el.openEaccountingButton) el.openEaccountingButton.href = eaccountingDashboardUrl;
    el.billingNote.value = "";
    el.billingSummary.innerHTML = `
      <strong>${customerStarHtml(row.customer)}${customerCashBadgeHtml(row.customer)}${escapeHtml(cleanDisplayName(row.customer))}</strong>
      <span>${escapeHtml(bookingJobLabel(row))} · Jobbdato ${formatDate(row.booking.date)} kl. ${escapeHtml(bookingTimeText(row.booking))} · ${escapeHtml(row.booking.resource || "")}</span>
      <em>${escapeHtml(bookingWorkKind(row).billing)}</em>
      <p>${billingDialogPurpose === "price_basis" ? "Kontroller hva som faktisk ble solgt eller utført før faktura lages." : defaultMode === "cash" ? "Kunden er merket for betaling på stedet. Velg faktura hvis denne jobben likevel skal faktureres." : "Faktura er standard. Velg betaling på stedet bare hvis dette faktisk ble betalt kontant."}</p>
    `;
    clearBillingDialogMessage();
    syncBillingDialogText();
    renderBillingPriceTotal();
    el.billingDialog.showModal();
  }

  async function saveBillingFromDialog() {
    if (!billingDialogBookingId) throw new Error("Fant ikke jobben som skulle oppdateres.");
    if (billingDialogPurpose === "price_basis") {
      await saveBookingPriceBasis(billingDialogBookingId, {
        priceBasis: el.billingPriceBasis?.value || "",
        note: el.billingNote.value,
      });
      billingDialogBookingId = "";
      billingDialogPurpose = "billing";
      el.billingDialog.close();
      return;
    }
    const mode = el.billingMode.value === "cash" ? "cash" : "invoice";
    await markBookingPaymentDone(billingDialogBookingId, {
      mode,
      date: el.billingDate.value || isoDate(new Date()),
      priceBasis: el.billingPriceBasis?.value || "",
      note: el.billingNote.value,
    });
    billingDialogBookingId = "";
    billingDialogPurpose = "billing";
    el.billingDialog.close();
  }

  function openPriceBasisDialog(id) {
    openBillingDialog(id, { purpose: "price_basis" });
  }

  async function saveBookingPriceBasis(id, options = {}) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke jobben.");
    if (!bookingCanHavePriceBasis(row)) throw new Error("Denne jobbtypen har ikke fakturagrunnlag. Bruk tilbud eller oppfølging.");
    const priceBasis = String(options.priceBasis || "").trim();
    const userNote = String(options.note || "").trim();
    const updatedBooking = {
      ...row.booking,
      note: noteWithJobPriceBasis(cleanBookingNote(row.booking.note), priceBasis),
    };
    await saveBookingRecord(id, updatedBooking);
    const linkedOrder = linkedOrderForBooking(id) || findOrder(row.booking.orderId);
    const linkedJob = linkedOrder ? jobForOrder(linkedOrder) : null;
    if (linkedOrder) {
      await saveOrderRecord(linkedOrder.id, {
        ...linkedOrder,
        note: noteWithJobPriceBasis(linkedOrder.note || cleanBookingNote(row.booking.note), priceBasis),
      }, { quiet: true });
    }
    await saveActivityRecord({
      customer_id: row.customer?.id || customerKey(row.customer),
      job_id: linkedJob?.id || "",
      activity_type: "job_price_basis_updated",
      summary: "Fakturagrunnlag endret",
      body: [
        `${bookingJobLabel(row)} ${formatDate(row.booking.date)}: fakturagrunnlag oppdatert.`,
        priceBasis ? `Prisgrunnlag/tillegg:\n${priceBasis}` : "Prisgrunnlag tømt.",
        userNote,
      ].filter(Boolean).join("\n"),
      metadata: {
        customer_key: customerKey(row.customer),
        booking_id: id,
        order_id: linkedOrder?.id || "",
      },
    });
    renderAll();
    setSyncStatus("Fakturagrunnlag lagret på jobben.", "ok");
  }

  async function markBookingNeedsMove(id, reason) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke bookingen.");
    const cleanReason = String(reason || "").trim() || "Må avtales på nytt";
    const today = isoDate(new Date());
    const event = {
      event_date: today,
      event_type: "Må flyttes",
      note: `${bookingJobLabel(row)} ${formatDate(row.booking.date)} kl. ${bookingTimeText(row.booking)} må flyttes. Årsak: ${cleanReason}.`,
    };
    const updatedBooking = {
      ...row.booking,
      note: `${cleanBookingNote(row.booking.note)}\n[Må flyttes ${today}: ${cleanReason}]`.trim(),
      needs_move: true,
    };
    if (store.isConfigured && store.markBookingNeedsMove) {
      const savedEvent = await store.markBookingNeedsMove(id, cleanReason, {
        markedAt: today,
        eventNote: event.note,
        customerId: row.customer.id || customerKey(row.customer),
      });
      bookings[id] = updatedBooking;
      addServiceEventToLocalCache(row.customer, savedEvent || event);
      renderAll();
      setSyncStatus("Jobb markert som må flyttes. Historikk er lagret på kundekortet.", "ok");
      return;
    }
    await saveBookingRecord(id, updatedBooking);
    await saveServiceEvent(row.customer, event);
    renderAll();
    setSyncStatus("Jobb markert som må flyttes. Historikk er lagret på kundekortet.", "ok");
  }

  function showMoveDialogMessage(message, type = "error") {
    if (!el.moveDialogMessage) return;
    el.moveDialogMessage.textContent = message || "";
    el.moveDialogMessage.className = `dialog-message ${type}`;
    el.moveDialogMessage.classList.toggle("hidden", !message);
  }

  function clearMoveDialogMessage() {
    showMoveDialogMessage("", "error");
  }

  function openMoveDialog(id) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row || !el.moveDialog) return;
    moveDialogBookingId = id;
    el.moveReasonPreset.value = "Kom ikke inn / fikk ikke tak i kunde";
    el.moveReasonNote.value = "";
    el.moveSummary.innerHTML = `
      <strong>${customerStarHtml(row.customer)}${customerCashBadgeHtml(row.customer)}${escapeHtml(cleanDisplayName(row.customer))}</strong>
      <span>${escapeHtml(bookingJobLabel(row))} · ${formatDate(row.booking.date)} kl. ${escapeHtml(bookingTimeText(row.booking))} · ${escapeHtml(row.booking.resource || "")}</span>
      ${row.booking.note ? `<p>${escapeHtml(cleanBookingNote(row.booking.note))}</p>` : ""}
    `;
    clearMoveDialogMessage();
    el.moveDialog.showModal();
  }

  async function saveMoveFromDialog() {
    if (!moveDialogBookingId) throw new Error("Fant ikke jobben som skulle merkes.");
    const preset = el.moveReasonPreset.value || "Må avtales på nytt";
    const note = el.moveReasonNote.value.trim();
    const reason = note ? `${preset}: ${note}` : preset;
    await markBookingNeedsMove(moveDialogBookingId, reason);
    moveDialogBookingId = "";
    el.moveDialog.close();
  }

  function openCompletedLeadFollowup(customer, lead, status) {
    if (!status) return false;
    selectedLeadId = lead?.id ? `lead:${lead.id}` : customerKey(customer);
    focusLeadQueueForStatus(status);
    setView("leads");
    const messages = {
      followup: "Befaring fullført. Saken ligger i Må kontaktes for senere oppfølging.",
      needs_offer: "Befaring fullført. Saken ligger i Tilbud / oppfølging, klar for tilbud.",
      offer_sent: "Befaring fullført. Saken ligger som Tilbud sendt / venter svar.",
      won: "Befaring fullført. Saken er merket vunnet. Opprett eller book jobb videre derfra.",
    };
    setSyncStatus(
      messages[status] || "Befaring fullført. Saken ligger i oppfølging.",
      "ok",
    );
    return true;
  }

  async function completeBookingFromDialog() {
    const row = bookingRows().find((item) => item.id === completingBookingId);
    if (!row) throw new Error("Fant ikke bookingen som skulle fullføres.");
    const customer = row.customer;
    const type = bookingDisplayType(row);
    const doneDate = el.completionDoneDate.value || row.booking.date || isoDate(new Date());
    const nextAction = el.completionNextAction.value;
    const interval = Number(el.completionInterval.value || 2);
    const nextServiceDate = el.completionNextDate.value || addYearsIso(doneDate, interval);
    const userNote = el.completionNote.value.trim();
    const paymentDone = Boolean(el.completionPaymentDone?.checked) && completionCanHavePayment(type);
    const billingStatus = completionBillingStatus(type, customer, paymentDone);
    const completionPaymentMode = defaultBillingModeForRow(row);
    const completionPaymentMarker = paymentDone ? billingModeMarker(completionPaymentMode, doneDate) : "";
    const priceBasis = completionPriceBasisText();
    const selectedInstallationId = el.completionInstallation?.value || "";
    const selectableInstallations = ["service", "installasjon"].includes(type)
      ? installationsForCustomer(customer).filter((installation) => installation.active !== false)
      : [];
    if (nextAction === "service_followup" && selectableInstallations.length > 1 && !selectedInstallationId) {
      throw new Error("Kunden har flere anlegg. Velg hvilket anlegg service gjelder før servicefrist oppdateres.");
    }
    const selectedInstallation = selectedInstallationId
      ? installationsForCustomer(customer).find((installation) => String(installation.id || "") === String(selectedInstallationId))
      : null;
    let completedLeadStatus = "";
    let completedLeadNote = "";
    const savedCompletionAttachments = await saveCompletionAttachments(row, selectedInstallation, doneDate);
    const eventLines = [
      `${bookingJobLabel(row)} fullført ${formatDate(doneDate)}.`,
      selectedInstallation ? `Anlegg: ${installationDisplayName(selectedInstallation)}.` : "",
      savedCompletionAttachments.length ? `${savedCompletionAttachments.length.toLocaleString("nb-NO")} bilder/vedlegg lagret på jobben.` : "",
      paymentDone ? (customer.pays_cash ? "Betaling markert mottatt ved fullføring." : "Faktura markert ferdig/sendt ved fullføring.") : "",
      priceBasis ? `Prisgrunnlag/tillegg:\n${priceBasis}` : "",
      userNote,
    ].filter(Boolean);
    const useAdminCompletionRpc = store.isConfigured && isAdmin() && store.completeBookingAsAdmin;

    if (store.isConfigured && !isAdmin()) {
      const technicianBookingNote = noteWithJobPriceBasis(noteWithoutMoveMarker(row.booking.note), priceBasis);
      await setBookingDone(completingBookingId, true, {
        completedAt: doneDate,
        note: eventLines.join("\n"),
        bookingNote: technicianBookingNote,
      });
      el.completionDialog.close();
      completingBookingId = "";
      completionFollowupBooking = null;
      renderTechnician();
      renderPlanning();
      setSyncStatus("Jobb markert utført. Kundekort, servicefrist og fakturering behandles av admin.", "ok");
      return;
    }

    let customerNoteLine = "";
    if (type === "service") {
      customer.last_service_date = doneDate;
      customer.service_dates = appendServiceDate(customer, doneDate);
      customer.service_status = "Service ok";
      if (selectedInstallation) {
        await saveInstallationAfterCompletion(customer, selectedInstallation.id, {
          last_service_at: doneDate,
          next_service_due: nextAction === "service_followup" ? nextServiceDate : null,
        }, { localOnly: useAdminCompletionRpc });
        recalculateCustomerServiceFromInstallations(customer);
      } else if (nextAction === "service_followup") customer.next_service_due = nextServiceDate;
      else if (nextAction === "none") customer.next_service_due = "";
    } else if (type === "installasjon") {
      if (!customer.first_install_date) customer.first_install_date = doneDate;
      customer.service_status = "Service ok";
      if (selectedInstallation) {
        await saveInstallationAfterCompletion(customer, selectedInstallation.id, {
          installed_at: selectedInstallation.installed_at || doneDate,
          next_service_due: nextAction === "service_followup" ? nextServiceDate : null,
        }, { localOnly: useAdminCompletionRpc });
        recalculateCustomerServiceFromInstallations(customer);
      } else if (nextAction === "service_followup") customer.next_service_due = nextServiceDate;
      else if (nextAction === "none") customer.next_service_due = "";
    } else if (type === "befaring") {
      if (nextAction === "book_installation") {
        completedLeadStatus = "won";
        customerNoteLine = `Befaring fullført ${formatDate(doneDate)}. Kunden sa ja - book installasjon.${userNote ? ` ${userNote}` : ""}`;
        completedLeadNote = customerNoteLine;
        customer.local_note = appendCustomerNote(customer, customerNoteLine);
        customer.tags = nextTagsWithLeadStatus(customer, completedLeadStatus);
        completionFollowupBooking = {
          customerId: customerKey(customer),
          note: `Installasjon etter befaring ${formatDate(doneDate)}.${userNote ? `\n${userNote}` : ""}`,
        };
      } else if (nextAction === "won_followup") {
        completedLeadStatus = "won";
        customerNoteLine = `Befaring fullført ${formatDate(doneDate)}. Kunden sa ja - planlegg jobb senere.${userNote ? ` ${userNote}` : ""}`;
        completedLeadNote = customerNoteLine;
        customer.local_note = appendCustomerNote(customer, customerNoteLine);
        customer.tags = nextTagsWithLeadStatus(customer, completedLeadStatus);
      } else if (nextAction === "offer_followup") {
        completedLeadStatus = "needs_offer";
        customerNoteLine = `Befaring fullført ${formatDate(doneDate)}. Tilbud må sendes.${userNote ? ` ${userNote}` : ""}`;
        completedLeadNote = customerNoteLine;
        customer.local_note = appendCustomerNote(customer, customerNoteLine);
        customer.tags = nextTagsWithLeadStatus(customer, completedLeadStatus);
      } else if (nextAction === "offer_sent_followup") {
        completedLeadStatus = "offer_sent";
        customerNoteLine = `Befaring fullført ${formatDate(doneDate)}. Tilbud er gitt muntlig eller sendt utenfor CRM - venter svar.${userNote ? ` ${userNote}` : ""}`;
        completedLeadNote = customerNoteLine;
        customer.local_note = appendCustomerNote(customer, customerNoteLine);
        customer.tags = nextTagsWithLeadStatus(customer, completedLeadStatus);
      } else if (nextAction === "followup_later") {
        completedLeadStatus = "followup";
        customerNoteLine = `Befaring fullført ${formatDate(doneDate)}. Må følges opp senere.${userNote ? ` ${userNote}` : ""}`;
        completedLeadNote = customerNoteLine;
        customer.local_note = appendCustomerNote(customer, customerNoteLine);
        customer.tags = nextTagsWithLeadStatus(customer, completedLeadStatus);
      }
    } else if (type === "blaseisolering") {
      customerNoteLine = `Blåseisolering fullført ${formatDate(doneDate)}.${userNote ? ` ${userNote}` : ""}`;
      customer.local_note = appendCustomerNote(customer, customerNoteLine);
    } else if (serviceWorkType(type)) {
      customerNoteLine = `Servicearbeid/timejobb fullført ${formatDate(doneDate)}.${userNote ? ` ${userNote}` : ""}`;
      customer.local_note = appendCustomerNote(customer, customerNoteLine);
    }

    const completedBooking = {
      ...row.booking,
      status: "done",
      needs_move: false,
      done_at: doneDate,
      note: noteWithJobPriceBasis([cleanBookingNote(row.booking.note), completionPaymentMarker].filter(Boolean).join("\n"), priceBasis),
      invoiced: paymentDone && completionPaymentMode === "invoice" ? true : row.booking.invoiced,
      paid_cash: paymentDone && completionPaymentMode === "cash" ? true : row.booking.paid_cash,
    };
    const completionEventType = `${bookingJobLabel(row)} fullført`;
    const completionEventNote = eventLines.join("\n");
    const orderNote = [
      userNote || cleanBookingNote(row.booking.note || ""),
      priceBasis ? `Prisgrunnlag/tillegg:\n${priceBasis}` : "",
    ].filter(Boolean).join("\n");

    if (useAdminCompletionRpc) {
      const linkedOrder = linkedOrderForBooking(completingBookingId);
      const rpcResult = await store.completeBookingAsAdmin(completingBookingId, {
        completedOn: doneDate,
        eventType: completionEventType,
        eventNote: completionEventNote,
        bookingNote: completedBooking.note,
        orderId: linkedOrder?.id || row.booking.orderId || "",
        orderNote,
        billingStatus,
        paymentMode: paymentDone ? completionPaymentMode : "",
        paymentDone,
        nextAction,
        nextServiceDate: nextAction === "service_followup" ? nextServiceDate : "",
        installationId: selectedInstallation?.id || "",
        customerNoteLine,
      });
      let savedCompletionCustomer = customer;
      let syncedCompletionLead = null;
      if (completedLeadStatus) {
        savedCompletionCustomer = await saveCustomerAfterCompletion(customer);
        syncedCompletionLead = await syncLeadRecord(savedCompletionCustomer || customer, completedLeadStatus, completedLeadNote);
      } else {
        updateCustomerInMemory(customer);
      }
      bookings[completingBookingId] = completedBooking;
      await ensureOrderForBooking(completingBookingId, completedBooking, {
        id: rpcResult.order_id || linkedOrder?.id,
        status: "completed",
        billingStatus,
        completedAt: doneDate,
        invoicedAt: paymentDone ? doneDate : "",
        note: orderNote,
      }, { localOnly: true });
      addServiceEventToLocalCache(customer, {
        id: rpcResult.service_event_id,
        customer_id: customer.id || customerKey(customer),
        event_date: doneDate,
        event_type: completionEventType,
        note: completionEventNote,
        created_at: new Date().toISOString(),
      });
      el.completionDialog.close();
      const shouldOpenInstallation = completionFollowupBooking;
      completingBookingId = "";
      completionFollowupBooking = null;
      const openedLeadFollowup = openCompletedLeadFollowup(savedCompletionCustomer || customer, syncedCompletionLead, completedLeadStatus);
      if (!openedLeadFollowup) {
        renderAll();
        setSyncStatus("Jobb fullført og kundekort oppdatert.", "ok");
      }
      if (shouldOpenInstallation) {
        openBookingDialog(shouldOpenInstallation.customerId);
        el.bookingType.value = "installasjon";
        el.bookingDuration.value = "180";
        renderResourceSelectOptions(el.bookingResource, defaultBookingResourceName());
        el.bookingNote.value = shouldOpenInstallation.note;
        renderBookingMonth();
      }
      return;
    }

    const savedCompletionCustomer = await saveCustomerAfterCompletion(customer);
    const syncedCompletionLead = completedLeadStatus
      ? await syncLeadRecord(savedCompletionCustomer || customer, completedLeadStatus, completedLeadNote)
      : null;
    await saveServiceEvent(customer, {
      event_date: doneDate,
      event_type: completionEventType,
      note: completionEventNote,
    });
    await saveBookingRecord(completingBookingId, completedBooking);
    await setBookingDone(completingBookingId, true, { completedAt: doneDate });
    await ensureOrderForBooking(completingBookingId, completedBooking, {
      status: "completed",
      billingStatus,
      completedAt: doneDate,
      note: orderNote,
    });
    el.completionDialog.close();
    const shouldOpenInstallation = completionFollowupBooking;
    completingBookingId = "";
    completionFollowupBooking = null;
    const openedLeadFollowup = openCompletedLeadFollowup(savedCompletionCustomer || customer, syncedCompletionLead, completedLeadStatus);
    if (!openedLeadFollowup) {
      renderAll();
      setSyncStatus("Jobb fullført og kundekort oppdatert.", "ok");
    }
    if (shouldOpenInstallation) {
      openBookingDialog(shouldOpenInstallation.customerId);
      el.bookingType.value = "installasjon";
      el.bookingDuration.value = "180";
      renderResourceSelectOptions(el.bookingResource, defaultBookingResourceName());
      el.bookingNote.value = shouldOpenInstallation.note;
      renderBookingMonth();
    }
  }

  function escapeHtml(value) {
    return repairTextEncoding(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  document.querySelectorAll("[data-login]").forEach((button) => button.addEventListener("click", () => setDemoUser(button.dataset.login)));
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll("[data-plan-tab-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.planTabView)));
  el.moreMenuButton?.addEventListener("click", () => {
    const shouldOpen = el.moreMenu?.classList.contains("hidden");
    closeFloatingMenus();
    el.moreMenu?.classList.toggle("hidden", !shouldOpen);
    el.moreMenuButton?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  });
  el.mobileMoreButton?.addEventListener("click", () => {
    const shouldOpen = el.mobileMoreMenu?.classList.contains("hidden");
    closeFloatingMenus();
    el.mobileMoreMenu?.classList.toggle("hidden", !shouldOpen);
    el.mobileMoreButton?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  });
  el.newActionButton?.addEventListener("click", () => {
    const shouldOpen = el.newActionMenu?.classList.contains("hidden");
    closeFloatingMenus();
    el.newActionMenu?.classList.toggle("hidden", !shouldOpen);
    el.newActionButton?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  });
  el.newActionMenu?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-new-action]");
    if (!button) return;
    handleNewAction(button.dataset.newAction);
  });
  document.querySelectorAll("[data-new-action]").forEach((button) => {
    if (button.closest("#newActionMenu")) return;
    button.addEventListener("click", () => handleNewAction(button.dataset.newAction));
  });
  document.querySelectorAll("[data-view-jump]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewJump)));
  document.querySelectorAll("[data-dashboard-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.dashboardAction;
    if (action === "service") {
      currentCustomerFilter = "due";
      if (el.statusFilter) el.statusFilter.value = "due";
      setView("customers");
      return;
    }
    if (action === "leads") {
      setLeadInboxTab("new");
      setView("leads");
      return;
    }
    if (action === "booking") {
      weekStart = startOfWeek(new Date());
      planningMonthCursor = new Date();
      setView("planning");
      return;
    }
    if (action === "move") {
      setView("dashboard");
      el.moveQueue?.closest(".panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "billing") {
      setView("dashboard");
      el.billingQueue?.closest(".panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "reminders") {
      setView("dashboard");
      el.reminderQueue?.closest(".panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }));
  document.querySelectorAll("[data-filter-shortcut]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.filterShortcut === "booked") {
      weekStart = startOfWeek(new Date());
      setView("planning");
      return;
    }
    currentCustomerFilter = button.dataset.filterShortcut === "booked" ? "all" : button.dataset.filterShortcut;
    el.statusFilter.value = currentCustomerFilter;
    setView("customers");
  }));
  document.querySelectorAll("[data-lead-status-shortcut]").forEach((button) => button.addEventListener("click", () => {
    currentLeadFilter = button.dataset.leadStatusShortcut || "followup";
    if (el.leadStatusFilter) el.leadStatusFilter.value = currentLeadFilter;
    setView("leads");
  }));
  document.querySelectorAll("[data-lead-inbox-tab]").forEach((button) => button.addEventListener("click", () => {
    setLeadInboxTab(button.dataset.leadInboxTab);
    setView("leads");
    renderLeads();
  }));
  document.querySelectorAll("[data-order-filter-shortcut]").forEach((button) => button.addEventListener("click", () => {
    currentOrderFilter = button.dataset.orderFilterShortcut || "all";
    if (el.orderStatusFilter) el.orderStatusFilter.value = currentOrderFilter;
    setView("orders");
  }));
  el.startWorklist?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-start-action]");
    if (!button) return;
    handleStartAction(button.dataset.startAction);
  });
  el.globalSearchInput?.addEventListener("input", () => {
    globalSearchQuery = el.globalSearchInput.value.trim();
    renderGlobalSearch();
  });
  el.globalSearchInput?.addEventListener("focus", () => {
    globalSearchQuery = el.globalSearchInput.value.trim();
    renderGlobalSearch();
  });
  el.globalSearchInput?.addEventListener("keydown", handleGlobalSearchKeydown);
  el.globalSearchResults?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-global-search-result]");
    if (!button) return;
    openGlobalSearchResult(button.dataset.globalSearchResult);
    hideGlobalSearchResults();
  });
  document.addEventListener("click", (event) => {
    const emailLink = event.target.closest("[data-open-customer-email]");
    if (!emailLink) return;
    event.preventDefault();
    openCustomerEmailDraft(emailLink.dataset.openCustomerEmail, emailLink.dataset.emailReference || "")
      .catch((error) => setSyncStatus(error.message || "Klarte ikke åpne e-postutkast.", "error"));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".top-search")) hideGlobalSearchResults();
    if (!event.target.closest(".new-action-wrap") && !event.target.closest(".more-nav-wrap") && !event.target.closest(".mobile-more-menu") && !event.target.closest("[data-mobile-more-toggle]")) closeFloatingMenus();
  });

  el.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      el.loginMessage.textContent = "Logger inn...";
      try {
        const remember = Boolean(el.loginRemember?.checked);
        localStorage.setItem(storage.rememberLogin, remember ? "true" : "false");
        store.setRememberLogin?.(remember);
        await store.signIn(el.loginEmail.value.trim(), el.loginPassword.value);
        currentView = "";
        const loaded = await refreshData("Innlogget.");
        if (loaded) el.loginMessage.textContent = "";
      } catch (error) {
        el.loginMessage.textContent = error.message || "Klarte ikke logge inn.";
      }
    }, { busyLabel: "Logger inn..." });
  });

  el.forgotPasswordButton?.addEventListener("click", requestPasswordReset);
  el.closePasswordResetDialog?.addEventListener("click", () => el.passwordResetDialog.close());
  el.cancelPasswordResetButton?.addEventListener("click", () => el.passwordResetDialog.close());
  el.passwordResetForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      showPasswordResetMessage("", "error");
      try {
        await savePasswordReset();
      } catch (error) {
        showPasswordResetMessage(error.message || "Klarte ikke lagre nytt passord.", "error");
      }
    });
  });

  async function handleLogout() {
    if (store.isConfigured) await store.signOut();
    currentUser = null;
    localStorage.removeItem(storage.user);
    renderApp();
  }

  el.logoutButton.addEventListener("click", handleLogout);
  el.mobileLogoutButton?.addEventListener("click", handleLogout);

  el.appView.addEventListener("click", async (event) => {
    const copyButton = event.target.closest("[data-copy-phone]");
    const copyEmailButton = event.target.closest("[data-copy-email]");
    const routeMessageButton = event.target.closest("[data-copy-route-message]");
    if (!copyButton && !copyEmailButton && !routeMessageButton) return;
    event.preventDefault();
    try {
      if (copyButton) await copyPhone(copyButton);
      else if (copyEmailButton) await copyEmail(copyEmailButton);
      else await copyRouteMessage(routeMessageButton.dataset.copyRouteMessage, routeMessageButton.dataset.routeMessageCustomer, routeMessageButton);
    } catch (error) {
      setSyncStatus(error.message || "Klarte ikke kopiere.", "error");
    }
  });

  el.importSeedButton.addEventListener("click", async () => {
    const ok = await askForConfirmation({
      title: "Importer startdata",
      message: "Importere dagens kunder og fakturametadata til Supabase? Dette erstatter fakturametadata fra forrige import.",
      confirmLabel: "Importer",
      tone: "danger",
    });
    if (!ok) return;
    try {
      el.importSeedButton.disabled = true;
      setSyncStatus("Importerer startdata...", "");
      const result = await store.importSeed(rawData);
      await refreshData(`Importert ${result.customers} kunder, ${result.invoices} fakturalinjer, ${result.installations || 0} varmepumper/anlegg og ${result.serviceEvents || 0} Lime Go-oppgaver.`);
    } catch (error) {
      setSyncStatus(error.message || "Import feilet.", "error");
    } finally {
      el.importSeedButton.disabled = false;
    }
  });

  window.addEventListener("numedal-import-progress", (event) => {
    setSyncStatus(event.detail || "Importerer...", "");
  });

  el.refreshProfilesButton?.addEventListener("click", () => refreshData("Brukerlisten er oppdatert."));
  el.profileList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-save-profile]");
    if (!button) return;
    saveProfileFromSettings(button.dataset.saveProfile)
      .catch((error) => setSyncStatus(error.message || "Klarte ikke lagre brukerprofil.", "error"));
  });
  el.offerTemplateSettings?.addEventListener("click", (event) => {
    const save = event.target.closest("[data-save-offer-settings]");
    if (save) {
      saveOfferSettingsFromSettings()
        .catch((error) => setSyncStatus(error.message || "Klarte ikke lagre tilbudsmaler.", "error"));
      return;
    }
    const reset = event.target.closest("[data-reset-offer-settings]");
    if (reset) resetOfferSettingsForm();
    const resetOne = event.target.closest("[data-reset-one-offer-template]");
    if (resetOne) {
      resetOneOfferTemplateForm(resetOne.dataset.resetOneOfferTemplate);
      setSyncStatus("Standardtekst fylt inn for valgt mal. Trykk Lagre for å bruke den videre.", "ok");
    }
  });
  el.eaccountingCatalogSettings?.addEventListener("click", (event) => {
    const download = event.target.closest("[data-download-eaccounting-products]");
    if (!download) return;
    downloadEaccountingProductCsv();
  });
  el.tagSettings?.addEventListener("click", (event) => {
    const rename = event.target.closest("[data-rename-tag]");
    if (rename) {
      const tag = rename.dataset.renameTag || "";
      const row = rename.closest("[data-tag-settings-row]");
      const next = row?.querySelector("[data-tag-rename-input]")?.value || "";
      renameCustomerTagFromSettings(tag, next)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre tagg.", "error"));
      return;
    }
    const remove = event.target.closest("[data-delete-tag]");
    if (remove) {
      deleteCustomerTagFromSettings(remove.dataset.deleteTag)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke slette tagg.", "error"));
    }
  });

  el.aiRegistrationParseButton?.addEventListener("click", parseAiRegistrationInput);
  el.aiRegistrationClearButton?.addEventListener("click", clearAiRegistration);
  el.aiRegistrationFileButton?.addEventListener("click", () => el.aiRegistrationFileInput?.click());
  el.aiRegistrationCameraButton?.addEventListener("click", () => el.aiRegistrationCameraInput?.click());
  el.aiRegistrationFileInput?.addEventListener("change", (event) => {
    addAiRegistrationFiles(event.target.files);
    event.target.value = "";
  });
  el.aiRegistrationCameraInput?.addEventListener("change", (event) => {
    addAiRegistrationFiles(event.target.files);
    event.target.value = "";
  });
  el.aiRegistrationPasteZone?.addEventListener("paste", (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageFiles = items.filter((item) => item.kind === "file" && /^image\//.test(item.type)).map((item) => item.getAsFile()).filter(Boolean);
    if (imageFiles.length) {
      addAiRegistrationFiles(imageFiles);
      setSyncStatus("Skjermbilde lagt ved som privat CRM-vedlegg.", "ok");
    }
  });
  el.aiRegistrationPasteZone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    el.aiRegistrationPasteZone.classList.add("dragging");
  });
  el.aiRegistrationPasteZone?.addEventListener("dragleave", () => {
    el.aiRegistrationPasteZone.classList.remove("dragging");
  });
  el.aiRegistrationPasteZone?.addEventListener("drop", (event) => {
    event.preventDefault();
    el.aiRegistrationPasteZone.classList.remove("dragging");
    addAiRegistrationFiles(event.dataTransfer?.files || []);
  });
  el.aiRegistrationAttachments?.addEventListener("click", (event) => {
    const removeAttachment = event.target.closest("[data-remove-ai-attachment]");
    if (!removeAttachment) return;
    const index = Number(removeAttachment.dataset.removeAiAttachment);
    const [removed] = aiRegistrationAttachments.splice(index, 1);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    renderAiRegistrationAttachments();
  });
  el.aiRegistrationDraft?.addEventListener("click", (event) => {
    if (handleCrmAttachmentClick(event)) return;
    const candidate = event.target.closest("[data-ai-candidate]");
    if (candidate) {
      clearAiRegistrationMessage();
      aiRegistrationSelectedCustomerId = candidate.dataset.aiCandidate;
      const actionSelect = document.getElementById("aiRegistrationAction");
      if (actionSelect) actionSelect.value = "append_existing";
      renderAiRegistrationCandidates();
      openCustomerQuickPanel(aiRegistrationSelectedCustomerId, "");
      return;
    }
    if (event.target.closest("[data-ai-clear-customer]")) {
      clearAiRegistrationMessage();
      aiRegistrationSelectedCustomerId = "";
      const actionSelect = document.getElementById("aiRegistrationAction");
      if (actionSelect && actionSelect.value === "append_existing") actionSelect.value = "create_customer";
      renderAiRegistrationCandidates();
      return;
    }
    const removeAttachment = event.target.closest("[data-remove-ai-attachment]");
    if (removeAttachment) {
      const index = Number(removeAttachment.dataset.removeAiAttachment);
      const [removed] = aiRegistrationAttachments.splice(index, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      renderAiRegistrationAttachments();
      return;
    }
    if (event.target.closest("#aiRegistrationSaveButton")) {
      clearAiRegistrationMessage();
      saveAiRegistrationDraft().catch((error) => {
        showAiRegistrationMessage(error.message || "Klarte ikke lagre Hurtigregistrering.", "error");
      });
      return;
    }
    if (event.target.closest("#aiRegistrationInboxButton")) {
      clearAiRegistrationMessage();
      saveAiRegistrationInboxDraft().catch((error) => {
        showAiRegistrationMessage(error.message || "Klarte ikke lagre i CRM-innboks.", "error");
      });
    }
  });
  el.aiRegistrationDraft?.addEventListener("input", (event) => {
    if (!event.target.closest("[data-ai-field]")) return;
    clearAiRegistrationMessage();
    if (event.target.id === "aiRegistrationType") {
      const values = aiRegistrationFormValues();
      const tagInput = document.getElementById("aiRegistrationTags");
      if (tagInput && (!tagInput.value.trim() || Object.values(aiRegistrationTypes).some((type) => tagInput.value.trim() === uniqueTags(type.tags)))) {
        tagInput.value = aiTagsForType(values.type);
      }
    }
    renderAiRegistrationCandidates();
  });

  el.newCustomerButton?.addEventListener("click", () => openCustomerDialog(""));
  el.newBookingButton?.addEventListener("click", () => openBookingDialog(""));
  el.customerSearch.addEventListener("input", () => {
    currentSearch = el.customerSearch.value.trim();
    selectedCustomerId = "";
    renderCustomers();
  });
  el.statusFilter.addEventListener("change", () => {
    currentCustomerFilter = el.statusFilter.value;
    selectedCustomerId = "";
    renderCustomers();
  });
  el.leadSearch?.addEventListener("input", () => {
    currentLeadSearch = el.leadSearch.value.trim();
    renderLeads();
  });
  el.leadStatusFilter?.addEventListener("change", () => {
    if (el.leadStatusFilter.value === "inbox_tab") setLeadInboxTab(currentLeadInboxTab);
    else currentLeadFilter = el.leadStatusFilter.value;
    renderLeads();
  });
  el.orderSearch?.addEventListener("input", () => {
    currentOrderSearch = el.orderSearch.value.trim();
    renderOrders();
  });
  el.orderStatusFilter?.addEventListener("change", () => {
    currentOrderFilter = el.orderStatusFilter.value;
    renderOrders();
  });
  el.leadList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lead-id]");
    if (!button) return;
    selectedLeadId = button.dataset.leadId;
    renderLeads();
    scrollPanelIntoMobileView(el.leadDetail);
  });
  el.websiteSubmissionInbox?.addEventListener("click", (event) => {
    const deleteSubmission = event.target.closest("[data-delete-website-submission]");
    if (deleteSubmission) {
      deleteWebsiteSubmission(deleteSubmission.dataset.deleteWebsiteSubmission)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke slette nettsideinnsending.", "error"));
      return;
    }
    const createServiceOrder = event.target.closest("[data-create-website-service-order]");
    if (createServiceOrder) {
      runBusyButton(createServiceOrder, () => createServiceOrderFromWebsiteSubmission(createServiceOrder.dataset.createWebsiteServiceOrder), "Klarte ikke lage serviceforespørsel fra nettsideinnsending.");
      return;
    }
    const createLead = event.target.closest("[data-create-website-lead]");
    if (createLead) {
      runBusyButton(createLead, () => createLeadFromWebsiteSubmission(createLead.dataset.createWebsiteLead), "Klarte ikke lage oppfølging fra nettsideinnsending.");
      return;
    }
    const statusButton = event.target.closest("[data-website-submission-status]");
    if (statusButton) {
      updateWebsiteSubmissionStatus(statusButton.dataset.websiteSubmissionId, statusButton.dataset.websiteSubmissionStatus)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke oppdatere nettsideinnsending.", "error"));
    }
  });
  el.orderList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-id]");
    if (!button) return;
    selectedOrderId = button.dataset.orderId;
    renderOrders();
    scrollPanelIntoMobileView(el.orderDetail);
  });
  el.orderList?.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-order-check]");
    if (!checkbox) return;
    if (checkbox.checked) selectedOrderIds.add(checkbox.dataset.orderCheck);
    else selectedOrderIds.delete(checkbox.dataset.orderCheck);
    updateOrderBulkActions(filteredOrders().slice(0, 250).map((row) => row.id));
  });
  el.orderSelectAll?.addEventListener("change", () => {
    const ids = filteredOrders().slice(0, 250).map((row) => row.id);
    if (el.orderSelectAll.checked) ids.forEach((id) => selectedOrderIds.add(id));
    else ids.forEach((id) => selectedOrderIds.delete(id));
    renderOrders();
  });
  el.deleteSelectedOrdersButton?.addEventListener("click", () => {
    openDeleteOrdersDialog();
  });
  el.customerList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-customer-id]");
    if (!button) return;
    selectedCustomerId = button.dataset.customerId;
    renderCustomers();
    scrollPanelIntoMobileView(el.customerDetail);
  });
  el.customerDetail.addEventListener("click", (event) => {
    if (handleCrmAttachmentClick(event)) return;
    const dismissDuplicate = event.target.closest("[data-dismiss-duplicate]");
    if (dismissDuplicate) {
      dismissDuplicateMatch(dismissDuplicate.dataset.dismissDuplicate, dismissDuplicate.dataset.dismissDuplicateOther)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke avvise dublettreff.", "error"));
      return;
    }
    const payment = event.target.closest("[data-payment-mode]");
    if (payment) {
      setCustomerPaymentMode(payment.dataset.paymentCustomer, payment.dataset.paymentMode)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre betaling.", "error"));
      return;
    }
    const customerStatus = event.target.closest("[data-toggle-customer-status]");
    if (customerStatus) {
      toggleCustomerStatus(customerStatus.dataset.toggleCustomerStatus)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre kundestatus.", "error"));
      return;
    }
    const editAccess = event.target.closest("[data-edit-access]");
    if (editAccess) {
      openAccessDialog(editAccess.dataset.editAccess, { prefill: editAccess.dataset.accessPrefill });
      return;
    }
    const promoteAccess = event.target.closest("[data-promote-access]");
    if (promoteAccess) {
      promoteCustomerAccessNote(promoteAccess.dataset.promoteAccess)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke lagre adkomstnotat.", "error"));
      return;
    }
    const insulation = event.target.closest("[data-toggle-insulation]");
    if (insulation) {
      toggleCustomerInsulation(insulation.dataset.toggleInsulation)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre blåseisolering.", "error"));
      return;
    }
    const star = event.target.closest("[data-toggle-star]");
    if (star) {
      toggleCustomerStar(star.dataset.toggleStar).catch((error) => setSyncStatus(error.message || "Klarte ikke endre stjerne.", "error"));
      return;
    }
    const edit = event.target.closest("[data-edit-customer]");
    if (edit) {
      openCustomerDialog(edit.dataset.editCustomer);
      return;
    }
    const newLead = event.target.closest("[data-new-lead-existing-customer]");
    if (newLead) {
      runBusyButton(newLead, () => createLeadForExistingCustomer(newLead.dataset.newLeadExistingCustomer, leadOptionsFromButton(newLead)), "Klarte ikke opprette oppfølging på kunden.");
      return;
    }
    const openLead = event.target.closest("[data-open-lead-entry]");
    if (openLead) {
      selectedLeadId = openLead.dataset.openLeadEntry;
      setView("leads");
      return;
    }
    const createOrderAndBook = event.target.closest("[data-create-order-and-book-from-lead]");
    if (createOrderAndBook) {
      openLeadStatusDialog(createOrderAndBook.dataset.createOrderAndBookFromLead, "won", { bookAfter: true });
      return;
    }
    const createOrder = event.target.closest("[data-create-order-from-lead]");
    if (createOrder) {
      openLeadStatusDialog(createOrder.dataset.createOrderFromLead, "won", { bookAfter: false });
      return;
    }
    const newInstallation = event.target.closest("[data-new-installation-customer]");
    if (newInstallation) {
      openInstallationFromButton(newInstallation);
      return;
    }
    const newReminder = event.target.closest("[data-new-reminder-customer]");
    if (newReminder) {
      openReminderDialog(newReminder.dataset.newReminderCustomer);
      return;
    }
    const editInstallation = event.target.closest("[data-edit-installation]");
    if (editInstallation) {
      openInstallationDialog(editInstallation.dataset.installationCustomer, editInstallation.dataset.editInstallation);
      return;
    }
    const installationFromEvent = event.target.closest("[data-installation-from-event]");
    if (installationFromEvent) {
      openInstallationFromServiceReminder(installationFromEvent.dataset.installationFromEvent, installationFromEvent.dataset.installationEventCustomer);
      return;
    }
    const newOrder = event.target.closest("[data-new-order-customer]");
    if (newOrder) {
      openOrderDialog(newOrder.dataset.newOrderCustomer);
      return;
    }
    const book = event.target.closest("[data-book-customer]");
    if (book) {
      openBookingFromButton(book);
      return;
    }
    const openCustomer = event.target.closest("[data-open-customer]");
    if (openCustomer) {
      openCustomerCard(openCustomer.dataset.openCustomer);
      return;
    }
    const order = event.target.closest("[data-open-order]");
    if (order) {
      selectedOrderId = order.dataset.openOrder;
      setView("orders");
    }
  });
  el.customerDetail.addEventListener("change", (event) => {
    const select = event.target.closest("[data-lead-status-customer]");
    if (!select) return;
    changeLeadStatusFromUi(select.dataset.leadStatusCustomer, select.value)
      .catch((error) => setSyncStatus(error.message || "Klarte ikke endre henvendelsesstatus.", "error"));
  });
  el.leadDetail?.addEventListener("change", (event) => {
    const offerTemplate = event.target.closest("[data-offer-template-select]");
    if (offerTemplate) {
      fillLeadOfferTemplate(offerTemplate.dataset.offerTemplateSelect, offerTemplate.value);
      focusLeadOfferFields(offerTemplate.dataset.offerTemplateSelect);
      setSyncStatus("Tilbudsmal fylt inn i tekstfeltet.", "ok");
      return;
    }
    const offerPriceList = event.target.closest("[data-offer-pricelist]");
    if (offerPriceList) {
      syncLeadOfferDocuments(offerPriceList.dataset.offerPricelist);
      return;
    }
    const offerLinePreset = event.target.closest("[data-offer-line-preset]");
    if (offerLinePreset) {
      syncOfferLinePreset(offerLinePreset.dataset.offerLinePreset);
      return;
    }
    const select = event.target.closest("[data-lead-status-customer]");
    if (!select) return;
    changeLeadStatusFromUi(select.dataset.leadStatusCustomer, select.value)
      .catch((error) => setSyncStatus(error.message || "Klarte ikke endre henvendelsesstatus.", "error"));
  });
  el.leadDetail?.addEventListener("input", (event) => {
    const offerLineSearch = event.target.closest("[data-offer-line-search]");
    if (offerLineSearch) {
      syncOfferLineSearch(offerLineSearch.dataset.offerLineSearch);
      return;
    }
    const lines = event.target.closest("[data-offer-lines]");
    if (lines) {
      renderOfferLinesTotal(lines.dataset.offerLines);
      return;
    }
    const lineField = event.target.closest("[data-offer-line-price], [data-offer-line-qty]");
    if (lineField) renderOfferLinesTotal(lineField.dataset.offerLinePrice || lineField.dataset.offerLineQty);
  });
  el.leadDetail?.addEventListener("click", (event) => {
    if (handleCrmAttachmentClick(event)) return;
    const focusOffer = event.target.closest("[data-focus-lead-offer]");
    if (focusOffer) {
      focusLeadOfferFields(focusOffer.dataset.focusLeadOffer);
      setSyncStatus("Tilbudsfeltet er klart. Velg mal eller skriv tilbudstekst.", "ok");
      return;
    }
    const fillOffer = event.target.closest("[data-fill-offer-template]");
    if (fillOffer) {
      fillLeadOfferTemplate(fillOffer.dataset.fillOfferTemplate);
      focusLeadOfferFields(fillOffer.dataset.fillOfferTemplate);
      setSyncStatus("Tilbudsmal fylt inn.", "ok");
      return;
    }
    const addLine = event.target.closest("[data-add-offer-line]");
    if (addLine) {
      try {
        addOfferLine(addLine.dataset.addOfferLine);
      } catch (error) {
        setSyncStatus(error.message || "Klarte ikke legge til tilbudslinje.", "error");
      }
      return;
    }
    const insertLines = event.target.closest("[data-insert-offer-lines]");
    if (insertLines) {
      insertOfferLinesIntoText(insertLines.dataset.insertOfferLines);
      return;
    }
    const clearLines = event.target.closest("[data-clear-offer-lines]");
    if (clearLines) {
      clearOfferLines(clearLines.dataset.clearOfferLines);
      return;
    }
    const copyOffer = event.target.closest("[data-copy-offer-draft]");
    if (copyOffer) {
      copyLeadOfferDraft(copyOffer.dataset.copyOfferDraft)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke kopiere tilbud.", "error"));
      return;
    }
    const openOfferMail = event.target.closest("[data-open-offer-mailto]");
    if (openOfferMail) {
      openLeadOfferMailDraft(openOfferMail.dataset.openOfferMailto)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke åpne e-postutkast.", "error"));
      return;
    }
    const sendOffer = event.target.closest("[data-send-offer-email]");
    if (sendOffer) {
      sendLeadOfferEmail(sendOffer.dataset.sendOfferEmail)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke sende tilbud.", "error"));
      return;
    }
    const markOfferManual = event.target.closest("[data-mark-offer-sent-manual]");
    if (markOfferManual) {
      markLeadOfferSentManually(markOfferManual.dataset.markOfferSentManual)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke markere tilbud sendt.", "error"));
      return;
    }
    const statusButton = event.target.closest("[data-lead-set-status]");
    if (statusButton) {
      changeLeadStatusFromUi(statusButton.dataset.leadStatusCustomer, statusButton.dataset.leadSetStatus)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre henvendelsesstatus.", "error"));
      return;
    }
    const deleteLead = event.target.closest("[data-delete-lead-entry]");
    if (deleteLead) {
      deleteLeadEntry(deleteLead.dataset.deleteLeadEntry)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke slette henvendelse.", "error"));
      return;
    }
    const template = event.target.closest("[data-copy-lead-template]");
    if (template) {
      const target = template.dataset.leadTemplateTarget || "";
      const fields = target ? leadOfferFields(target) : {};
      if (fields?.text) {
        fillLeadOfferTemplate(target, template.dataset.copyLeadTemplate);
        focusLeadOfferFields(target);
        setSyncStatus("Malen er lagt inn i tilbudsfeltet.", "ok");
        return;
      }
      copyLeadTemplate(template.dataset.copyLeadTemplate, template.dataset.leadTemplateCustomer)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke kopiere e-postmal.", "error"));
      return;
    }
    const saveNote = event.target.closest("[data-save-lead-note]");
    if (saveNote) {
      const customerId = saveNote.dataset.saveLeadNote;
      const textarea = el.leadDetail.querySelector(`[data-lead-note-text="${CSS.escape(customerId)}"]`);
      saveLeadNoteTarget(customerId, textarea?.value || "")
        .catch((error) => setSyncStatus(error.message || "Klarte ikke lagre leadnotat.", "error"));
      return;
    }
    const appendNote = event.target.closest("[data-append-lead-note]");
    if (appendNote) {
      const customerId = appendNote.dataset.appendLeadNote;
      const textarea = el.leadDetail.querySelector(`[data-lead-note-text="${CSS.escape(customerId)}"]`);
      appendLeadNoteTarget(customerId, textarea?.value || "")
        .catch((error) => setSyncStatus(error.message || "Klarte ikke legge til leadnotat.", "error"));
      return;
    }
    const inactivate = event.target.closest("[data-inactivate-lead]");
    if (inactivate) {
      setLeadInactive(inactivate.dataset.inactivateLead)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke sette lead inaktiv.", "error"));
      return;
    }
    const openOrder = event.target.closest("[data-open-order]");
    if (openOrder) {
      selectedOrderId = openOrder.dataset.openOrder;
      setView("orders");
      return;
    }
    const createOrderAndBook = event.target.closest("[data-create-order-and-book-from-lead]");
    if (createOrderAndBook) {
      openLeadStatusDialog(createOrderAndBook.dataset.createOrderAndBookFromLead, "won", { bookAfter: true });
      return;
    }
    const createOrder = event.target.closest("[data-create-order-from-lead]");
    if (createOrder) {
      openLeadStatusDialog(createOrder.dataset.createOrderFromLead, "won", { bookAfter: false });
      return;
    }
    const createCustomer = event.target.closest("[data-create-customer-from-lead]");
    if (createCustomer) {
      createCustomerFromLead(createCustomer.dataset.createCustomerFromLead)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke opprette kundekort fra henvendelse.", "error"));
      return;
    }
    const newLead = event.target.closest("[data-new-lead-existing-customer]");
    if (newLead) {
      runBusyButton(newLead, () => createLeadForExistingCustomer(newLead.dataset.newLeadExistingCustomer, leadOptionsFromButton(newLead)), "Klarte ikke opprette ny oppfølging på kunden.");
      return;
    }
    const editAccess = event.target.closest("[data-edit-access]");
    if (editAccess) {
      openAccessDialog(editAccess.dataset.editAccess, { prefill: editAccess.dataset.accessPrefill });
      return;
    }
    const promoteAccess = event.target.closest("[data-promote-access]");
    if (promoteAccess) {
      promoteCustomerAccessNote(promoteAccess.dataset.promoteAccess)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke lagre adkomstnotat.", "error"));
      return;
    }
    const newInstallation = event.target.closest("[data-new-installation-customer]");
    if (newInstallation) {
      openInstallationFromButton(newInstallation);
      return;
    }
    const newReminder = event.target.closest("[data-new-reminder-customer]");
    if (newReminder) {
      openReminderDialog(newReminder.dataset.newReminderCustomer);
      return;
    }
    const installationFromEvent = event.target.closest("[data-installation-from-event]");
    if (installationFromEvent) {
      openInstallationFromServiceReminder(installationFromEvent.dataset.installationFromEvent, installationFromEvent.dataset.installationEventCustomer);
      return;
    }
    const newOrder = event.target.closest("[data-new-order-customer]");
    if (newOrder) {
      openOrderDialog(newOrder.dataset.newOrderCustomer);
      return;
    }
    const editCustomer = event.target.closest("[data-edit-customer]");
    if (editCustomer) {
      openCustomerDialog(editCustomer.dataset.editCustomer);
      return;
    }
    const linkCustomer = event.target.closest("[data-link-lead-customer]");
    if (linkCustomer) {
      linkLeadToExistingCustomer(linkCustomer.dataset.linkLeadCustomer, linkCustomer.dataset.linkExistingCustomer)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke koble lead til kundekort.", "error"));
      return;
    }
    const open = event.target.closest("[data-open-lead-customer]");
    if (open) {
      openCustomerCard(open.dataset.openLeadCustomer);
      return;
    }
    const book = event.target.closest("[data-book-customer]");
    if (book) openBookingFromButton(book);
  });
  el.orderDetail?.addEventListener("click", async (event) => {
    if (handleCrmAttachmentClick(event)) return;
    const open = event.target.closest("[data-open-order-customer]");
    if (open) {
      openCustomerCard(open.dataset.openOrderCustomer);
      return;
    }
    const completeBooking = event.target.closest("[data-complete-booking]");
    if (completeBooking) {
      const id = completeBooking.dataset.completeBooking;
      const isDone = bookings[id]?.status === "done" || doneJobs.has(id);
      if (isDone) {
        const ok = await askForConfirmation({
          title: "Angre utført",
          message: "Angre at denne jobben er utført? Servicehistorikk på kundekortet blir ikke slettet automatisk.",
          confirmLabel: "Angre utført",
        });
        if (!ok) return;
        await setBookingDone(id, false);
        renderAll();
        setSyncStatus("Jobb markert som ikke utført.", "ok");
      } else {
        openCompletionDialog(id);
      }
      return;
    }
    const billingBooking = event.target.closest("[data-billing-booking]");
    if (billingBooking) {
      openBillingDialog(billingBooking.dataset.billingBooking);
      return;
    }
    const priceBasisBooking = event.target.closest("[data-price-basis-booking]");
    if (priceBasisBooking) {
      openPriceBasisDialog(priceBasisBooking.dataset.priceBasisBooking);
      return;
    }
    const moveBooking = event.target.closest("[data-move-booking]");
    if (moveBooking) {
      openMoveDialog(moveBooking.dataset.moveBooking);
      return;
    }
    const editBooking = event.target.closest("[data-edit-booking]");
    if (editBooking) {
      openBookingDialog("", editBooking.dataset.editBooking);
      return;
    }
    const editOrder = event.target.closest("[data-edit-order]");
    if (editOrder) {
      openOrderDialog("", editOrder.dataset.editOrder);
      return;
    }
    const deleteOrder = event.target.closest("[data-delete-one-order]");
    if (deleteOrder) {
      openDeleteOrdersDialog([deleteOrder.dataset.deleteOneOrder]);
      return;
    }
    const repairJob = event.target.closest("[data-repair-order-job]");
    if (repairJob) {
      repairOrderJobMirror(repairJob.dataset.repairOrderJob)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke opprette jobbspeil.", "error"));
      return;
    }
    const bookOrder = event.target.closest("[data-book-order]");
    if (bookOrder) {
      const order = findOrder(bookOrder.dataset.bookOrder);
      const customer = order ? findCustomer(orderCustomerId(order)) : null;
      if (!order || !customer) return;
      openBookingDialog(customerKey(customer), "", {
        orderId: order.id,
        type: order.type || "service",
        installationId: installationIdForOrder(order, jobForOrder(order)),
        note: order.note || "",
      });
      return;
    }
    const invoiced = event.target.closest("[data-mark-order-invoiced]");
    if (invoiced) {
      const order = findOrder(invoiced.dataset.markOrderInvoiced);
      if (!order) return;
      saveOrderRecord(order.id, { ...order, billingStatus: "sent", invoicedAt: isoDate(new Date()) })
        .then(() => {
          renderAll();
          setSyncStatus("Jobb markert fakturert.", "ok");
        })
        .catch((error) => setSyncStatus(error.message || "Klarte ikke markere jobb fakturert.", "error"));
    }
  });
  el.insulationAddLineButton?.addEventListener("click", addInsulationLine);
  el.insulationLines?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-insulation-line]");
    if (button) removeInsulationLine(button.dataset.removeInsulationLine);
  });
  [
    el.insulationKm,
    el.insulationToll,
    el.insulationRigPrep,
    el.insulationRigExtra,
    el.insulationRigLarge,
  ].filter(Boolean).forEach((input) => input.addEventListener("input", renderInsulationLines));
  el.insulationCopyOfferButton?.addEventListener("click", () => {
    copyInsulationOffer().catch((error) => setSyncStatus(error.message || "Klarte ikke kopiere kalkyle.", "error"));
  });
  el.insulationCustomerSelect?.addEventListener("change", () => {
    currentInsulationCustomerId = el.insulationCustomerSelect.value;
    renderInsulationSelectedCustomer();
  });
  el.insulationCreateOfferButton?.addEventListener("click", createInsulationOfferDraft);
  el.rentalCreateOfferButton?.addEventListener("click", createRentalOfferDraft);
  el.insulationModeButtons?.forEach((button) => button.addEventListener("click", () => setInsulationMode(button.dataset.insulationMode)));
  el.insulationWorkspaceTabs?.forEach((button) => button.addEventListener("click", () => setInsulationWorkspaceTab(button.dataset.insulationWorkspaceTab)));
  el.insulationCopyOfferTextButton?.addEventListener("click", () => {
    copyInsulationOfferDraft().catch((error) => setSyncStatus(error.message || "Klarte ikke kopiere tilbud.", "error"));
  });
  el.insulationClearButton?.addEventListener("click", clearInsulationCalc);
  el.insulationCustomerSearch?.addEventListener("input", renderInsulationCustomers);
  el.insulationNewCustomerButton?.addEventListener("click", () => openCustomerDialog("", { insulation: true }));
  el.insulationCustomers?.addEventListener("click", (event) => {
    const newLead = event.target.closest("[data-new-lead-existing-customer]");
    if (newLead) {
      runBusyButton(newLead, () => createLeadForExistingCustomer(newLead.dataset.newLeadExistingCustomer, leadOptionsFromButton(newLead)), "Klarte ikke opprette oppfølging på kunden.");
      return;
    }
    const select = event.target.closest("[data-select-insulation-customer]");
    if (select) {
      currentInsulationCustomerId = select.dataset.selectInsulationCustomer;
      if (el.insulationCustomerSelect) el.insulationCustomerSelect.value = currentInsulationCustomerId;
      renderInsulationSelectedCustomer();
      setSyncStatus("Kunde valgt til tilbud.", "ok");
      return;
    }
    const book = event.target.closest("[data-book-insulation-customer]");
    if (book) {
      openInsulationBooking(book.dataset.bookInsulationCustomer);
      return;
    }
    const order = event.target.closest("[data-new-insulation-order]");
    if (order) {
      openInsulationOrder(order.dataset.newInsulationOrder);
      return;
    }
    const jump = event.target.closest("[data-jump-customer]");
    if (jump) openCustomerCard(jump.dataset.jumpCustomer);
  });
  el.nextJobs.addEventListener("click", handleJobCardOpen);
  el.dueCustomers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-customer-id]");
    if (!button) return;
    openCustomerCard(button.dataset.customerId);
  });
  el.billingQueue?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-billing-customer]");
    if (!button) return;
    openCustomerQuickPanel(button.dataset.billingCustomer, button.dataset.billingBooking || "");
  });
  el.reminderQueue?.addEventListener("click", (event) => {
    const done = event.target.closest("[data-complete-reminder]");
    if (done) {
      completeReminder(done.dataset.completeReminder)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke markere påminnelse ferdig.", "error"));
      return;
    }
    const customerButton = event.target.closest("[data-open-reminder-customer]");
    if (customerButton) {
      openCustomerQuickPanel(customerButton.dataset.openReminderCustomer, "");
      return;
    }
    const card = event.target.closest("[data-reminder-customer]");
    if (card?.dataset.reminderCustomer) openCustomerQuickPanel(card.dataset.reminderCustomer, "");
  });
  el.moveQueue?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-move-booking]");
    if (editButton) {
      openBookingDialog("", editButton.dataset.editMoveBooking);
      return;
    }
    const showButton = event.target.closest("[data-show-move-booking]");
    if (showButton) {
      showBookingInPlanning(showButton.dataset.showMoveBooking);
    }
  });
  el.dataQualityList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-quality-filter]");
    if (!button) return;
    const filter = button.dataset.qualityFilter || "missing";
    currentCustomerFilter = filter;
    currentSearch = "";
    if (el.statusFilter) el.statusFilter.value = filter;
    if (el.customerSearch) el.customerSearch.value = "";
    setView("customers");
  });
  el.recentActivity?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-recent-kind]");
    if (!button) return;
    openRecentActivity(button);
  });
  el.intakeInbox?.addEventListener("click", (event) => {
    const loadButton = event.target.closest("[data-load-intake]");
    if (loadButton) {
      loadIntakeIntoAiRegistration(loadButton.dataset.loadIntake);
      return;
    }
    const discardButton = event.target.closest("[data-discard-intake]");
    if (discardButton) {
      discardIntakeItem(discardButton.dataset.discardIntake).catch((error) => {
        setSyncStatus(error.message || "Klarte ikke kaste innboksutkast.", "error");
      });
    }
  });
  el.closeCustomerQuickDialog.addEventListener("click", () => el.customerQuickDialog.close());
  el.customerQuickDialog.addEventListener("click", (event) => {
    if (event.target === el.customerQuickDialog) el.customerQuickDialog.close();
  });
  el.customerQuickContent.addEventListener("click", async (event) => {
    if (handleCrmAttachmentClick(event)) return;
    const payment = event.target.closest("[data-payment-mode]");
    if (payment) {
      setCustomerPaymentMode(payment.dataset.paymentCustomer, payment.dataset.paymentMode)
        .then(() => {
          if (el.customerQuickDialog.open) openCustomerQuickPanel(payment.dataset.paymentCustomer, "");
        })
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre betaling.", "error"));
      return;
    }
    const customerStatus = event.target.closest("[data-toggle-customer-status]");
    if (customerStatus) {
      toggleCustomerStatus(customerStatus.dataset.toggleCustomerStatus)
        .then(() => {
          if (el.customerQuickDialog.open) openCustomerQuickPanel(customerStatus.dataset.toggleCustomerStatus, "");
        })
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre kundestatus.", "error"));
      return;
    }
    const insulation = event.target.closest("[data-toggle-insulation]");
    if (insulation) {
      toggleCustomerInsulation(insulation.dataset.toggleInsulation)
        .then(() => {
          if (el.customerQuickDialog.open) openCustomerQuickPanel(insulation.dataset.toggleInsulation, "");
        })
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre blåseisolering.", "error"));
      return;
    }
    const star = event.target.closest("[data-toggle-star]");
    if (star) {
      toggleCustomerStar(star.dataset.toggleStar)
        .then(() => {
          if (el.customerQuickDialog.open) openCustomerQuickPanel(star.dataset.toggleStar, "");
        })
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre stjerne.", "error"));
      return;
    }
    const newOrder = event.target.closest("[data-new-order-customer]");
    if (newOrder) {
      el.customerQuickDialog.close();
      openOrderDialog(newOrder.dataset.newOrderCustomer);
      return;
    }
    const newLead = event.target.closest("[data-new-lead-existing-customer]");
    if (newLead) {
      el.customerQuickDialog.close();
      runBusyButton(newLead, () => createLeadForExistingCustomer(newLead.dataset.newLeadExistingCustomer, leadOptionsFromButton(newLead)), "Klarte ikke opprette oppfølging på kunden.");
      return;
    }
    const newInstallation = event.target.closest("[data-new-installation-customer]");
    if (newInstallation) {
      el.customerQuickDialog.close();
      openInstallationFromButton(newInstallation);
      return;
    }
    const newReminder = event.target.closest("[data-new-reminder-customer]");
    if (newReminder) {
      el.customerQuickDialog.close();
      openReminderDialog(newReminder.dataset.newReminderCustomer);
      return;
    }
    const editInstallation = event.target.closest("[data-edit-installation]");
    if (editInstallation) {
      el.customerQuickDialog.close();
      openInstallationDialog(editInstallation.dataset.installationCustomer, editInstallation.dataset.editInstallation);
      return;
    }
    const jump = event.target.closest("[data-jump-customer]");
    if (jump) {
      el.customerQuickDialog.close();
      openCustomerCard(jump.dataset.jumpCustomer);
      return;
    }
    const editCustomer = event.target.closest("[data-edit-customer]");
    if (editCustomer) {
      el.customerQuickDialog.close();
      openCustomerDialog(editCustomer.dataset.editCustomer);
      return;
    }
    const billing = event.target.closest("[data-billing-booking]");
    if (billing) {
      el.customerQuickDialog.close();
      openBillingDialog(billing.dataset.billingBooking);
      return;
    }
    const priceBasis = event.target.closest("[data-price-basis-booking]");
    if (priceBasis) {
      el.customerQuickDialog.close();
      openPriceBasisDialog(priceBasis.dataset.priceBasisBooking);
      return;
    }
    const move = event.target.closest("[data-move-booking]");
    if (move) {
      el.customerQuickDialog.close();
      openMoveDialog(move.dataset.moveBooking);
      return;
    }
    const complete = event.target.closest("[data-complete-booking]");
    if (complete) {
      const id = complete.dataset.completeBooking;
      const isDone = bookings[id]?.status === "done" || doneJobs.has(id);
      el.customerQuickDialog.close();
      if (isDone) {
        const ok = await askForConfirmation({
          title: "Angre utført",
          message: "Angre at denne jobben er utført? Servicehistorikk på kundekortet blir ikke slettet automatisk.",
          confirmLabel: "Angre utført",
        });
        if (!ok) return;
        await setBookingDone(id, false);
        renderAll();
        return;
      }
      openCompletionDialog(id);
      return;
    }
    const editBooking = event.target.closest("[data-edit-booking]");
    if (editBooking) {
      el.customerQuickDialog.close();
      openBookingDialog("", editBooking.dataset.editBooking);
      return;
    }
    const book = event.target.closest("[data-book-customer]");
    if (book) {
      el.customerQuickDialog.close();
      openBookingFromButton(book);
    }
  });
  el.closeCustomerDialog.addEventListener("click", () => el.customerDialog.close());
  el.formDifferentPostal?.addEventListener("change", syncPostalFieldsVisibility);
  el.formTags?.addEventListener("input", () => renderTagCatalog(currentFormTags()));
  el.formTagCatalog?.addEventListener("change", (event) => {
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (!checkbox) return;
    const tags = currentFormTags();
    const normalized = normalizeMatch(checkbox.value);
    const without = tags.filter((tag) => normalizeMatch(tag) !== normalized);
    if (checkbox.checked) without.push(checkbox.value);
    setFormTags(without);
  });
  el.closeInstallationDialog?.addEventListener("click", () => el.installationDialog.close());
  el.cancelInstallationDialog?.addEventListener("click", () => el.installationDialog.close());
  el.installationLocationSelect?.addEventListener("change", syncInstallationLocationFields);
  el.installationLastServiceAt?.addEventListener("change", () => syncInstallationNextServiceSuggestion(false));
  el.installationServiceInterval?.addEventListener("change", () => syncInstallationNextServiceSuggestion(true));
  el.installationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      showInstallationDialogMessage("", "error");
      try {
        await saveInstallationFromDialog();
      } catch (error) {
        showInstallationDialogMessage(error.message || "Klarte ikke lagre varmepumpe/anlegg.", "error");
      }
    });
  });
  el.customerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      clearCustomerDialogMessage();
      try {
        await saveCustomerFromDialog();
      } catch (error) {
        showCustomerDialogMessage(error.message || "Klarte ikke lagre kunde.", "error");
      }
    });
  });
  el.deleteCustomerButton.addEventListener("click", async () => {
    const customer = findCustomer(editingCustomerId);
    if (!customer) return;
    const ok = await askForConfirmation({
      title: "Sett kunde inaktiv",
      message: "Sette kunden inaktiv? Den forsvinner fra aktive lister, men slettes ikke historisk.",
      confirmLabel: "Sett inaktiv",
      tone: "danger",
    });
    if (!ok) return;
    try {
      if (store.isConfigured) await store.deleteCustomer(customer);
      else {
        requireLocalDemoStorage();
        deletedCustomers.add(editingCustomerId);
        localStorage.setItem(storage.deleted, JSON.stringify([...deletedCustomers]));
      }
      const index = customers.findIndex((item) => customerKey(item) === editingCustomerId);
      if (index >= 0) customers.splice(index, 1);
      selectedCustomerId = customerKey(customers[0]) || "";
      el.customerDialog.close();
      renderAll();
    } catch (error) {
      showCustomerDialogMessage(error.message || "Klarte ikke sette kunde inaktiv.", "error");
    }
  });

  el.closeOrderDialog?.addEventListener("click", () => el.orderDialog.close());
  el.cancelOrderDialog?.addEventListener("click", () => el.orderDialog.close());
  el.orderType?.addEventListener("change", syncOrderTitleFromType);
  el.orderPriceSearch?.addEventListener("input", syncOrderPriceSearch);
  el.orderPricePreset?.addEventListener("change", syncOrderPriceQuantity);
  el.orderAddPriceLine?.addEventListener("click", () => {
    try {
      addOrderPriceLine();
    } catch (error) {
      showOrderDialogMessage(error.message || "Klarte ikke legge til linje.", "error");
    }
  });
  el.orderPriceLines?.addEventListener("input", renderOrderPriceTotal);
  el.orderTitleInput?.addEventListener("input", () => {
    orderTitleManuallyEdited = true;
  });
  el.orderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      clearOrderDialogMessage();
      try {
        await saveOrderFromDialog();
      } catch (error) {
        showOrderDialogMessage(error.message || "Klarte ikke lagre jobb.", "error");
      }
    });
  });

  el.closeLeadStatusDialog?.addEventListener("click", closeLeadStatusDialog);
  el.cancelLeadStatusDialog?.addEventListener("click", closeLeadStatusDialog);
  el.leadStatusCreateOrder?.addEventListener("change", () => {
    if (!el.leadStatusCreateOrder.checked && el.leadStatusBookAfter) el.leadStatusBookAfter.checked = false;
  });
  el.leadStatusBookAfter?.addEventListener("change", () => {
    if (el.leadStatusBookAfter.checked && el.leadStatusCreateOrder) el.leadStatusCreateOrder.checked = true;
  });
  el.leadStatusForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      showLeadStatusDialogMessage("", "error");
      try {
        await saveLeadStatusFromDialog();
      } catch (error) {
        showLeadStatusDialogMessage(error.message || "Klarte ikke lagre neste steg.", "error");
      }
    }, { busyLabel: "Lagrer..." });
  });

  el.closeBookingDialog.addEventListener("click", () => el.bookingDialog.close());
  el.bookingCustomerSearch.addEventListener("input", () => {
    bookingSelectedCustomerId = "";
    el.bookingCustomer.value = "";
    clearBookingDialogMessage();
    renderBookingCustomerResults(el.bookingCustomerSearch.value, "");
  });
  el.bookingCustomerSearch.addEventListener("focus", () => {
    el.bookingCustomerSearch.select();
    renderBookingCustomerResults(el.bookingCustomerSearch.value, bookingSelectedCustomerId);
  });
  el.bookingForm.addEventListener("click", (event) => {
    if (!event.target.closest(".booking-customer-picker")) closeBookingCustomerResults();
  });
  el.bookingCustomerResults.addEventListener("click", (event) => {
    const button = event.target.closest("[data-booking-customer-id]");
    if (!button) return;
    const customer = findCustomer(button.dataset.bookingCustomerId);
    if (!customer) return;
    setBookingCustomerSelection(customer);
    clearBookingDialogMessage();
    closeBookingCustomerResults();
    syncBookingInstallationNoteFromSelect();
  });
  el.bookingCustomer.addEventListener("change", () => {
    const customer = findCustomer(el.bookingCustomer.value);
    if (customer) {
      setBookingCustomerSelection(customer);
      syncBookingInstallationNoteFromSelect();
    }
  });
  el.bookingInstallationSelect?.addEventListener("change", syncBookingInstallationNoteFromSelect);
  el.bookingDate.addEventListener("change", renderBookingMonth);
  el.bookingTime.addEventListener("input", renderBookingDayAgenda);
  el.bookingDuration.addEventListener("input", renderBookingDayAgenda);
  el.bookingResource.addEventListener("change", renderBookingDayAgenda);
  el.bookingDayAgenda?.addEventListener("click", (event) => {
    const slotButton = event.target.closest("[data-booking-slot-time]");
    if (!slotButton) return;
    el.bookingTime.value = slotButton.dataset.bookingSlotTime || "09:00";
    renderBookingDayAgenda();
  });
  el.bookingMonthPrev.addEventListener("click", () => shiftBookingMonth(-1));
  el.bookingMonthNext.addEventListener("click", () => shiftBookingMonth(1));
  el.bookingMonthGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-booking-date]");
    if (!button) return;
    el.bookingDate.value = button.dataset.bookingDate;
    renderBookingMonth();
  });
  el.bookingType.addEventListener("change", () => {
    el.bookingDuration.value = defaultBookingDuration(el.bookingType.value);
    renderBookingInstallationOptions(findCustomer(bookingSelectedCustomerId), el.bookingInstallationSelect?.value || "");
    syncBookingDialogTypeStyle();
    renderBookingMonth();
  });
  el.completionDoneDate.addEventListener("change", () => {
    if (el.completionNextAction.value === "service_followup") {
      el.completionNextDate.value = addYearsIso(el.completionDoneDate.value, el.completionInterval.value);
    }
  });
  el.completionInterval.addEventListener("change", () => {
    if (el.completionNextAction.value === "service_followup") {
      el.completionNextDate.value = addYearsIso(el.completionDoneDate.value, el.completionInterval.value);
    }
  });
  el.completionNextAction.addEventListener("change", syncCompletionFields);
  el.completionInstallation?.addEventListener("change", () => {
    syncCompletionIntervalFromInstallation();
    syncCompletionFields();
    renderCompletionAttachmentList();
  });
  el.completionPricePreset?.addEventListener("change", syncCompletionPriceQuantity);
  el.completionPriceSearch?.addEventListener("input", syncCompletionPriceSearch);
  el.completionAddPriceLine?.addEventListener("click", addCompletionPriceLine);
  el.completionPriceLines?.addEventListener("input", renderCompletionPriceTotal);
  el.completionAttachments?.addEventListener("change", renderCompletionAttachmentList);
  el.closeCompletionDialog.addEventListener("click", () => el.completionDialog.close());
  el.cancelCompletionButton.addEventListener("click", () => el.completionDialog.close());
  el.completionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      try {
        await completeBookingFromDialog();
      } catch (error) {
        setSyncStatus(error.message || "Klarte ikke fullføre jobb.", "error");
      }
    }, { busyLabel: "Fullfører..." });
  });
  el.closeBillingDialog?.addEventListener("click", () => el.billingDialog.close());
  el.cancelBillingButton?.addEventListener("click", () => el.billingDialog.close());
  el.billingMode?.addEventListener("change", syncBillingDialogText);
  el.billingPriceBasis?.addEventListener("input", renderBillingPriceTotal);
  el.copyBillingDraftButton?.addEventListener("click", () => {
    copyBillingDraftFromDialog().catch((error) => {
      showBillingDialogMessage(error.message || "Klarte ikke kopiere fakturagrunnlag.", "error");
      setSyncStatus(error.message || "Klarte ikke kopiere fakturagrunnlag.", "error");
    });
  });
  el.billingForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      clearBillingDialogMessage();
      try {
        await saveBillingFromDialog();
      } catch (error) {
        showBillingDialogMessage(error.message || "Klarte ikke lagre fakturering/betaling.", "error");
        setSyncStatus(error.message || "Klarte ikke lagre fakturering/betaling.", "error");
      }
    });
  });
  el.closeReminderDialog?.addEventListener("click", closeReminderDialog);
  el.cancelReminderButton?.addEventListener("click", closeReminderDialog);
  el.reminderCustomerSearch?.addEventListener("input", () => {
    renderReminderCustomerOptions(el.reminderCustomerSearch.value, el.reminderCustomer?.value || reminderDialogCustomerId);
  });
  el.reminderCustomer?.addEventListener("change", () => {
    reminderDialogCustomerId = el.reminderCustomer.value || "";
    const customer = findCustomer(reminderDialogCustomerId);
    if (customer && el.reminderCustomerSearch) el.reminderCustomerSearch.value = cleanDisplayName(customer);
    renderReminderCustomerOptions(el.reminderCustomerSearch?.value || "", reminderDialogCustomerId);
  });
  el.reminderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      showReminderDialogMessage("", "error");
      try {
        await saveReminderFromDialog();
      } catch (error) {
        showReminderDialogMessage(error.message || "Klarte ikke lagre påminnelse.", "error");
        setSyncStatus(error.message || "Klarte ikke lagre påminnelse.", "error");
      }
    }, { busyLabel: "Lagrer..." });
  });
  el.closeDeleteBookingDialog?.addEventListener("click", () => el.deleteBookingDialog.close());
  el.cancelDeleteBookingButton?.addEventListener("click", () => el.deleteBookingDialog.close());
  el.deleteBookingForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      clearDeleteBookingMessage();
      try {
        await deleteBookingFromDialog();
      } catch (error) {
        showDeleteBookingMessage(error.message || "Klarte ikke fjerne booking.", "error");
        setSyncStatus(error.message || "Klarte ikke fjerne booking.", "error");
      }
    }, { busyLabel: "Fjerner..." });
  });
  el.closeDeleteOrdersDialog?.addEventListener("click", () => el.deleteOrdersDialog.close());
  el.cancelDeleteOrdersButton?.addEventListener("click", () => el.deleteOrdersDialog.close());
  el.deleteOrdersForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      clearDeleteOrdersMessage();
      try {
        await deleteSelectedOrders({ cancelLinkedBookings: Boolean(el.deleteOrdersCancelBookings?.checked) });
        el.deleteOrdersDialog.close();
      } catch (error) {
        showDeleteOrdersMessage(error.message || "Klarte ikke slette jobb.", "error");
        setSyncStatus(error.message || "Klarte ikke slette jobb.", "error");
      }
    }, { busyLabel: "Sletter..." });
  });
  el.closeConfirmDialog?.addEventListener("click", () => {
    resolveConfirmDialog(false);
    el.confirmDialog.close();
  });
  el.confirmCancelButton?.addEventListener("click", () => {
    resolveConfirmDialog(false);
    el.confirmDialog.close();
  });
  el.confirmForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    resolveConfirmDialog(true);
    el.confirmDialog.close();
  });
  el.confirmDialog?.addEventListener("close", () => resolveConfirmDialog(false));
  el.closeMoveDialog?.addEventListener("click", () => el.moveDialog.close());
  el.cancelMoveButton?.addEventListener("click", () => el.moveDialog.close());
  el.moveForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      clearMoveDialogMessage();
      try {
        await saveMoveFromDialog();
      } catch (error) {
        showMoveDialogMessage(error.message || "Klarte ikke markere jobben som må flyttes.", "error");
        setSyncStatus(error.message || "Klarte ikke markere jobben som må flyttes.", "error");
      }
    }, { busyLabel: "Markerer..." });
  });
  el.bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runBusyForm(event.currentTarget, async () => {
      clearBookingDialogMessage();
      try {
        await saveBookingFromDialog();
      } catch (error) {
        const message = error.message || "Klarte ikke lagre booking.";
        showBookingDialogMessage(message, "error");
        setSyncStatus(message, "error");
      }
    });
  });
  el.deleteBookingButton.addEventListener("click", async () => {
    openDeleteBookingDialog(editingBookingId, { closeBookingDialog: true });
  });
  el.previousWeekButton.addEventListener("click", () => {
    if (planningMode === "month") {
      planningMonthCursor = new Date(planningMonthCursor.getFullYear(), planningMonthCursor.getMonth() - 1, 1);
    } else {
      weekStart = shiftDate(weekStart, -7);
      planningMonthCursor = new Date(weekStart);
    }
    renderPlanning();
  });
  el.nextWeekButton.addEventListener("click", () => {
    if (planningMode === "month") {
      planningMonthCursor = new Date(planningMonthCursor.getFullYear(), planningMonthCursor.getMonth() + 1, 1);
    } else {
      weekStart = shiftDate(weekStart, 7);
      planningMonthCursor = new Date(weekStart);
    }
    renderPlanning();
  });
  el.planningWeekModeButton?.addEventListener("click", () => {
    planningMode = "week";
    planningMonthCursor = new Date(weekStart);
    renderPlanning();
  });
  el.planningMonthModeButton?.addEventListener("click", () => {
    planningMode = "month";
    planningMonthCursor = new Date(weekStart);
    renderPlanning();
  });
  el.planningResourceFilter?.addEventListener("change", () => {
    planningResourceFilter = el.planningResourceFilter.value || "all";
    renderPlanning();
  });
  el.todayButton.addEventListener("click", () => {
    weekStart = startOfWeek(new Date());
    planningMonthCursor = new Date();
    renderPlanning();
  });
  el.planningMonthGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-planning-date]");
    if (!button) return;
    const date = new Date(`${button.dataset.planningDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;
    weekStart = startOfWeek(date);
    planningMonthCursor = date;
    renderPlanning();
  });
  el.copyDayPlanButton.addEventListener("click", async () => {
    try {
      await copyDayPlan();
    } catch (error) {
      setSyncStatus(error.message || "Klarte ikke kopiere dagsplan.", "error");
    }
  });
  el.downloadDayPlanButton?.addEventListener("click", downloadDayPlan);
  [
    el.routeArea,
    el.routeStatus,
    el.routeReplyFilter,
    el.routeMaxJobs,
    el.routeOrigin,
    el.routeBookingDate,
    el.routeStartTime,
    el.routeEndTime,
    el.routeDuration,
    el.routeResource,
    el.routeRequireLocation,
    el.routeStarredOnly,
  ].filter(Boolean).forEach((control) => control.addEventListener("input", renderRoutePlanner));
  [
    el.routeStatus,
    el.routeReplyFilter,
    el.routeDuration,
    el.routeResource,
    el.routeRequireLocation,
    el.routeStarredOnly,
  ].filter(Boolean).forEach((control) => control.addEventListener("change", renderRoutePlanner));
  el.routeRefreshButton?.addEventListener("click", renderRoutePlanner);
  el.routeMonthPrev?.addEventListener("click", () => shiftRouteMonth(-1));
  el.routeMonthNext?.addEventListener("click", () => shiftRouteMonth(1));
  el.routeMonthGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route-date]");
    if (!button) return;
    el.routeBookingDate.value = button.dataset.routeDate;
    renderRoutePlanner();
  });
  el.routeOpenMapsButton?.addEventListener("click", () => {
    const url = googleDirectionsUrlForRows(routePlannerRows);
    if (url) window.open(url, "_blank", "noopener");
  });
  el.routeBookDraftButton?.addEventListener("click", async () => {
    try {
      await saveRouteDraftBookings();
    } catch (error) {
      setSyncStatus(error.message || "Klarte ikke booke ruten.", "error");
    }
  });
  el.routeCampaignButton?.addEventListener("click", () => {
    copyRouteBulkSms().catch((error) => setSyncStatus(error.message || "Klarte ikke kopiere SMS-tekster.", "error"));
  });
  el.routeCustomerSearch?.addEventListener("input", renderRouteCustomerSearch);
  el.routeCustomerResults?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route-add-customer]");
    if (!button) return;
    routeSelectedCustomerIds.add(button.dataset.routeAddCustomer);
    el.routeCustomerSearch.value = "";
    renderRoutePlanner();
  });
  el.routeSelectedCustomers?.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-route-remove-selected]");
    if (!remove) return;
    routeSelectedCustomerIds.delete(remove.dataset.routeRemoveSelected);
    renderRoutePlanner();
  });
  el.routeClearSelectionButton?.addEventListener("click", () => {
    routeSelectedCustomerIds = new Set();
    renderRoutePlanner();
  });
  el.routeResults?.addEventListener("click", (event) => {
    const open = event.target.closest("[data-route-open-customer]");
    if (open) {
      openCustomerQuickPanel(open.dataset.routeOpenCustomer, "");
      return;
    }
    const book = event.target.closest("[data-book-customer]");
    if (book) {
      openBookingFromButton(book);
      return;
    }
    const overflow = event.target.closest("[data-route-overflow-customer]");
    if (overflow && !event.target.closest("a, button")) {
      openCustomerQuickPanel(overflow.dataset.routeOverflowCustomer, "");
      return;
    }
    const card = event.target.closest("[data-route-customer]");
    if (card && !event.target.closest("a, button")) openCustomerQuickPanel(card.dataset.routeCustomer, "");
  });
  el.routeMissing?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route-missing-customer]");
    if (!button) return;
    openCustomerQuickPanel(button.dataset.routeMissingCustomer, "");
  });
  function clearPlanningDropUi(keepDay = null) {
    el.planningBoard.querySelectorAll(".planning-day.drag-over").forEach((day) => {
      if (day !== keepDay) day.classList.remove("drag-over");
    });
    el.planningBoard.querySelectorAll(".timeline-drop-zone.active").forEach((slot) => slot.classList.remove("active"));
    el.planningBoard.querySelectorAll(".drop-hint[data-drop-label]").forEach((hint) => {
      if (!keepDay || !keepDay.contains(hint)) delete hint.dataset.dropLabel;
    });
  }

  let draggedBookingId = "";
  el.planningBoard.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".job-card[data-booking-id], .timeline-event[data-booking-id]");
    if (!card || !card.draggable) return;
    draggedBookingId = card.dataset.bookingId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedBookingId);
    card.classList.add("dragging");
  });
  el.planningBoard.addEventListener("dragend", (event) => {
    event.target.closest(".job-card, .timeline-event")?.classList.remove("dragging");
    clearPlanningDropUi();
    draggedBookingId = "";
  });
  el.planningBoard.addEventListener("dragover", (event) => {
    if (!draggedBookingId) return;
    const day = event.target.closest(".planning-day[data-planning-date]");
    if (!day) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearPlanningDropUi(day);
    const slot = event.target.closest("[data-planning-time]");
    if (slot && day.contains(slot)) slot.classList.add("active");
    const placement = planningDropPlacement(event, draggedBookingId, day);
    const hint = day.querySelector(".drop-hint");
    if (hint) hint.dataset.dropLabel = placement.label ? `Slipp: ${placement.label}` : "Slipp her";
    day.classList.add("drag-over");
  });
  el.planningBoard.addEventListener("dragleave", (event) => {
    const day = event.target.closest(".planning-day[data-planning-date]");
    if (day && !day.contains(event.relatedTarget)) {
      day.classList.remove("drag-over");
      const hint = day.querySelector(".drop-hint");
      if (hint) delete hint.dataset.dropLabel;
    }
  });
  el.planningBoard.addEventListener("drop", async (event) => {
    const day = event.target.closest(".planning-day[data-planning-date]");
    const bookingId = draggedBookingId || event.dataTransfer.getData("text/plain");
    if (!day || !bookingId) return;
    event.preventDefault();
    clearPlanningDropUi();
    try {
      const placement = planningDropPlacement(event, bookingId, day);
      await moveBookingToDate(bookingId, day.dataset.planningDate, {
        time: placement.time,
        placement: placement.label,
      });
    } catch (error) {
      setSyncStatus(error.message || "Klarte ikke flytte booking.", "error");
    }
  });
  el.planningBoard.addEventListener("click", async (event) => {
    if (handleJobCardOpen(event)) return;
    const billing = event.target.closest("[data-billing-booking]");
    if (billing) {
      openBillingDialog(billing.dataset.billingBooking);
      return;
    }
    const priceBasis = event.target.closest("[data-price-basis-booking]");
    if (priceBasis) {
      openPriceBasisDialog(priceBasis.dataset.priceBasisBooking);
      return;
    }
    const move = event.target.closest("[data-move-booking]");
    if (move) {
      openMoveDialog(move.dataset.moveBooking);
      return;
    }
    const edit = event.target.closest("[data-edit-booking]");
    if (edit) {
      openBookingDialog("", edit.dataset.editBooking);
      return;
    }
    const remove = event.target.closest("[data-delete-booking]");
    if (remove) {
      openDeleteBookingDialog(remove.dataset.deleteBooking);
      return;
    }
    const complete = event.target.closest("[data-complete-booking]");
    if (complete) {
      const id = complete.dataset.completeBooking;
      const isDone = bookings[id]?.status === "done" || doneJobs.has(id);
      if (isDone) {
        const ok = await askForConfirmation({
          title: "Angre utført",
          message: "Angre at denne jobben er utført? Servicehistorikk på kundekortet blir ikke slettet automatisk.",
          confirmLabel: "Angre utført",
        });
        if (!ok) return;
        await setBookingDone(id, false);
        renderAll();
        return;
      }
      openCompletionDialog(id);
      return;
    }
    handleJobCardOpen(event);
  });
  el.technicianDate.addEventListener("change", renderTechnician);
  el.technicianRouteButton?.addEventListener("click", () => {
    const url = googleDirectionsUrlForRows(personalRowsForDate(el.technicianDate.value || isoDate(new Date())));
    if (url) window.open(url, "_blank", "noopener");
  });
  el.technicianJobs.addEventListener("click", async (event) => {
    if (handleJobCardOpen(event)) return;
    const move = event.target.closest("[data-move-booking]");
    if (move) {
      openMoveDialog(move.dataset.moveBooking);
      return;
    }
    const button = event.target.closest("[data-done-booking]");
    if (!button) return;
    const id = button.dataset.doneBooking;
    const isDone = bookings[id]?.status === "done" || doneJobs.has(id);
    try {
      if (isDone) {
        const ok = await askForConfirmation({
          title: "Angre utført",
          message: "Angre at denne jobben er utført? Servicehistorikk på kundekortet blir ikke slettet automatisk.",
          confirmLabel: "Angre utført",
        });
        if (!ok) return;
        await setBookingDone(id, false);
      } else {
        openCompletionDialog(id);
        return;
      }
      renderTechnician();
      renderPlanning();
    } catch (error) {
      setSyncStatus(error.message || "Klarte ikke oppdatere jobb.", "error");
    }
  });

  store.onAuthStateChange?.((event) => {
    if (event === "PASSWORD_RECOVERY") {
      openPasswordResetDialog();
      return;
    }
    if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && !currentUser && !passwordRecoveryActive) {
      refreshData().catch((error) => setSyncStatus(error.message || "Klarte ikke gjenoppta innlogging.", "error"));
    }
    if (event === "SIGNED_OUT") {
      currentUser = null;
      renderApp();
    }
  });

  refreshData();
})();




