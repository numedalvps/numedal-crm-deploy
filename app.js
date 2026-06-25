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
  const users = {
    admin: { name: "Gunnar", role: "Admin", view: "dashboard", key: "admin" },
    tech: { name: "Hubert", role: "Tekniker", view: "technician", key: "tech" },
  };
  const hiddenDuplicateLimeIds = new Set(["2396394"]);
  const storage = {
    user: "numedalWebUser",
    bookings: "numedalWebBookings",
    orders: "numedalWebOrders",
    insulationCalc: "numedalWebInsulationCalc",
    edits: "numedalWebCustomerEdits",
    deleted: "numedalWebDeletedCustomers",
    doneJobs: "numedalWebDoneJobs",
  };
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
  let currentLeadFilter = "followup";
  let currentLeadSearch = "";
  let selectedLeadId = "";
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
  let intakeItems = [];
  let invoicesByCustomer = new Map();
  let serviceEventsByCustomer = new Map();
  let installationsByCustomer = new Map();
  let accessNotesByCustomer = new Map();
  let bookingSelectedCustomerId = "";
  let bookingPendingOrderId = "";
  let editingOrderId = "";
  let orderDialogCustomerId = "";
  let orderTitleManuallyEdited = false;
  let completingBookingId = "";
  let completionFollowupBooking = null;
  let billingDialogBookingId = "";
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
  let aiRegistrationDraft = null;
  let aiRegistrationSelectedCustomerId = "";
  let aiRegistrationAttachments = [];

  const el = {
    loginView: document.getElementById("loginView"),
    appView: document.getElementById("appView"),
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginMessage: document.getElementById("loginMessage"),
    loginIntro: document.getElementById("loginIntro"),
    currentUserName: document.getElementById("currentUserName"),
    currentUserRole: document.getElementById("currentUserRole"),
    dataModePill: document.getElementById("dataModePill"),
    syncStatus: document.getElementById("syncStatus"),
    logoutButton: document.getElementById("logoutButton"),
    viewTitle: document.getElementById("viewTitle"),
    viewSubtitle: document.getElementById("viewSubtitle"),
    importSeedButton: document.getElementById("importSeedButton"),
    newCustomerButton: document.getElementById("newCustomerButton"),
    newBookingButton: document.getElementById("newBookingButton"),
    redMetric: document.getElementById("redMetric"),
    yellowMetric: document.getElementById("yellowMetric"),
    greenMetric: document.getElementById("greenMetric"),
    bookedMetric: document.getElementById("bookedMetric"),
    dashboardServiceCount: document.getElementById("dashboardServiceCount"),
    dashboardLeadCount: document.getElementById("dashboardLeadCount"),
    dashboardBookingCount: document.getElementById("dashboardBookingCount"),
    dashboardMoveCount: document.getElementById("dashboardMoveCount"),
    dashboardBillingCount: document.getElementById("dashboardBillingCount"),
    nextJobs: document.getElementById("nextJobs"),
    moveQueue: document.getElementById("moveQueue"),
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
    technicianRouteButton: document.getElementById("technicianRouteButton"),
    technicianJobs: document.getElementById("technicianJobs"),
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
    formPaysCash: document.getElementById("formPaysCash"),
    formInsulation: document.getElementById("formInsulation"),
    formServiceDates: document.getElementById("formServiceDates"),
    formTags: document.getElementById("formTags"),
    formTagCatalog: document.getElementById("formTagCatalog"),
    formNote: document.getElementById("formNote"),
    orderDialog: document.getElementById("orderDialog"),
    orderForm: document.getElementById("orderForm"),
    orderDialogTitle: document.getElementById("orderDialogTitle"),
    closeOrderDialog: document.getElementById("closeOrderDialog"),
    cancelOrderDialog: document.getElementById("cancelOrderDialog"),
    orderDialogMessage: document.getElementById("orderDialogMessage"),
    orderCustomerName: document.getElementById("orderCustomerName"),
    orderType: document.getElementById("orderType"),
    orderTitleInput: document.getElementById("orderTitleInput"),
    orderBookNow: document.getElementById("orderBookNow"),
    orderNoteInput: document.getElementById("orderNoteInput"),
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
    completionDoneDate: document.getElementById("completionDoneDate"),
    completionNextAction: document.getElementById("completionNextAction"),
    completionInterval: document.getElementById("completionInterval"),
    completionIntervalLabel: document.getElementById("completionIntervalLabel"),
    completionNextDate: document.getElementById("completionNextDate"),
    completionNextDateLabel: document.getElementById("completionNextDateLabel"),
    completionPaymentDoneLabel: document.getElementById("completionPaymentDoneLabel"),
    completionPaymentDone: document.getElementById("completionPaymentDone"),
    completionPaymentHint: document.getElementById("completionPaymentHint"),
    completionNote: document.getElementById("completionNote"),
    billingDialog: document.getElementById("billingDialog"),
    billingForm: document.getElementById("billingForm"),
    billingTitle: document.getElementById("billingTitle"),
    billingSummary: document.getElementById("billingSummary"),
    billingDialogMessage: document.getElementById("billingDialogMessage"),
    closeBillingDialog: document.getElementById("closeBillingDialog"),
    cancelBillingButton: document.getElementById("cancelBillingButton"),
    billingDate: document.getElementById("billingDate"),
    billingMode: document.getElementById("billingMode"),
    billingHint: document.getElementById("billingHint"),
    billingNote: document.getElementById("billingNote"),
    saveBillingButton: document.getElementById("saveBillingButton"),
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
    if (isManualStarred(customer)) return "Gul stjerne: manuelt markert som god servicekunde / viktig kunde.";
    if (isAutoStarredCustomer(customer)) return "Gul stjerne: kunden har hatt service etter installasjon, eller servicepåminnelse ligger cirka 4 år etter installasjon.";
    return "Trykk for å stjernemerke kunden manuelt.";
  }

  function customerStarHtml(customer, options = {}) {
    if (!isStarredCustomer(customer) && !options.showEmpty) return "";
    const title = customerStarTitle(customer);
    const active = isStarredCustomer(customer);
    return `<span class="customer-star ${active ? "active" : "empty"}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">&#9733;</span>`;
  }

  function customerCashBadgeHtml(customer) {
    if (!customer?.pays_cash) return "";
    return `<span class="cash-badge" title="Cashkunde: kunden er merket med cashbetaling." aria-label="Cashkunde">$</span>`;
  }

  const leadStatuses = {
    followup: {
      label: "Nye leads - må kontaktes",
      help: "Ny eller gammel henvendelse som bør kontaktes først. Ikke blandes med ordinær servicebooking ennå.",
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
      label: "Vunnet - book jobb",
      help: "Kunden har takket ja. Neste steg er installasjon eller jobb i planning.",
    },
    lost: {
      label: "Tapt / ikke kjøpt",
      help: "Lead er avsluttet uten salg. Beholdes for historikk og eventuell senere serviceforespørsel.",
    },
  };

  const aiRegistrationTypes = {
    lead: {
      label: "Lead / ny henvendelse",
      eventType: "Hurtigregistrering - lead",
      tags: ["Lead", "Leadstatus: Nye leads - må kontaktes"],
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
      tags: ["Lead", "Befaring", "Leadstatus: Nye leads - må kontaktes"],
    },
    installasjon: {
      label: "Installasjon / montering",
      eventType: "Hurtigregistrering - installasjon",
      tags: ["Lead", "Leadstatus: Vunnet - book jobb"],
    },
    blaseisolering: {
      label: "Blåseisolering",
      eventType: "Hurtigregistrering - blåseisolering",
      tags: ["Blåseisolering", "Lead", "Leadstatus: Nye leads - må kontaktes"],
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
      label: "Ikke booket",
      help: "Ordren er avtalt eller vunnet, men ikke lagt i kalender ennå.",
    },
    scheduled: {
      label: "Booket",
      help: "Ordren har minst en booking i planningboardet.",
    },
    completed: {
      label: "Utført",
      help: "Jobben er markert utført. Service/installasjon bør normalt faktureres.",
    },
    cancelled: {
      label: "Avsluttet",
      help: "Ordren er lukket uten videre arbeid.",
    },
  };

  const billingStatuses = {
    not_ready: "Ikke klar",
    ready: "Må faktureres",
    sent: "Fakturert",
    paid: "Betalt",
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
          "Gi gjerne beskjed hvis du ønsker å gå videre, så finner vi en monteringsdato som passer.",
          "",
          "Mvh",
          "Gunnar",
          "Numedal Varmepumpeservice",
          "93436855",
        ].join("\n");
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

  function leadStatusLabel(status) {
    return leadStatuses[status]?.label || "Lead";
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

  function leadNoteFromDb(lead) {
    if (!lead) return "";
    const activity = latestActivityForLead(lead);
    return String(activity?.body || lead.product_interest || lead.source_detail || "").trim();
  }

  function leadStatusForCustomer(customer) {
    const dbLead = leadForCustomer(customer);
    const dbStatus = leadStatusFromDb(dbLead?.status);
    if (dbStatus) return dbStatus;
    const tagged = leadStatusFromTags(customer);
    if (tagged) return tagged;
    const preset = leadPreset(customer);
    if (preset?.status) return preset.status;
    if (/tapt/i.test(String(customer?.latest_deal_status || ""))) return "lost";
    const noteText = `${customer?.local_note || ""} ${customer?.latest_deal_name || ""}`;
    if (/skal ha tilbud|tilbud må sendes|tilbud ma sendes|send tilbud|lage tilbud|må sende tilbud|ma sende tilbud/i.test(noteText)) return "needs_offer";
    if (/tilbud sendt|venter svar|muntlig pris|fått tilbud|fatt tilbud/i.test(noteText)) return "offer_sent";
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
  }

  async function setLeadStatus(customerId, status) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const saved = await saveCustomerInline(customer, { tags: nextTagsWithLeadStatus(customer, status) }, "");
    await syncLeadRecord(saved || customer, status, `Leadstatus satt til: ${leadStatusLabel(status)}.`);
    await saveServiceEvent(customer, {
      event_date: isoDate(new Date()),
      event_type: "Leadstatus",
      note: `Leadstatus satt til: ${leadStatusLabel(status)}.`,
    });
    selectedLeadId = customerId;
    setSyncStatus(status ? `Lead satt til: ${leadStatusLabel(status)}.` : "Lead-status fjernet.", "ok");
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

  async function setLeadInactive(customerId) {
    const customer = findCustomer(customerId);
    if (!customer) return;
    const ok = await askForConfirmation({
      title: "Sett lead inaktiv",
      message: "Sette denne leaden inaktiv? Den slettes ikke permanent, men forsvinner fra aktive lister.",
      confirmLabel: "Sett inaktiv",
      tone: "danger",
    });
    if (!ok) return;
    if (store.isConfigured) await store.deleteCustomer(customer);
    else {
      requireLocalDemoStorage();
      deletedCustomers.add(customerId);
      localStorage.setItem(storage.deleted, JSON.stringify([...deletedCustomers]));
    }
    customers = customers.filter((item) => customerKey(item) !== customerId);
    selectedLeadId = leadEntryKey(allLeadEntries()[0]) || "";
    renderAll();
    setSyncStatus("Lead satt inaktiv.", "ok");
  }

  function leadStatusControlHtml(customer, statusOverride = "") {
    const key = customerKey(customer);
    const current = statusOverride || leadStatusForCustomer(customer);
    const options = Object.entries(leadStatuses).map(([value, info]) => (
      `<option value="${value}" ${current === value ? "selected" : ""}>${escapeHtml(info.label)}</option>`
    )).join("");
    return `
      <label class="lead-status-control">Leadstatus
        <select data-lead-status-customer="${escapeHtml(key)}" title="Velg neste steg for denne leaden.">
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
    if (explicit) return cleanAiLine(explicit.replace(/\b(mob|telefon|adresse|mailadresse|e-post)\b.*$/i, ""));
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
      analysis?.summary || "",
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
      action: type === "history" ? "append_existing" : "create_lead",
    };
  }

  function aiRegistrationFormValues() {
    return {
      action: document.getElementById("aiRegistrationAction")?.value || aiRegistrationDraft?.action || "create_lead",
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
      : "<strong>Ingen kunde valgt.</strong> Velg et treff hvis dette skal inn på et eksisterende kundekort.";
    if (!candidates.length) {
      list.innerHTML = `<div class="empty-state">Ingen sikre treff. Kan lagres som lead/forespørsel uten kundekort.</div>`;
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
      ["create_lead", "Opprett lead / forespørsel"],
      ["append_existing", "Legg på valgt kundekort"],
      ["create_customer", "Opprett kundekort nå"],
      ["history_only", "Kun historikk på valgt kundekort"],
    ];
    return options.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
  }

  function aiRegistrationWarningsHtml(analysis) {
    const warnings = analysis?.warnings || [];
    if (!warnings.length) {
      return `<div class="ai-warning-list ok"><strong>Ingen kritiske advarsler funnet.</strong><span>Kontroller likevel navn, telefon og adresse før lagring.</span></div>`;
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
    return `<small class="ai-field-meta">${escapeHtml(label)}: ${escapeHtml(intakeConfidenceLabel(intakeFieldConfidence(field)))}${field?.evidence ? ` · "${escapeHtml(String(field.evidence).slice(0, 120))}"` : ""}</small>`;
  }

  function renderAiRegistrationDraft() {
    if (!el.aiRegistrationDraft || !aiRegistrationDraft) return;
    const analysis = aiRegistrationDraft.analysis || null;
    const contact = analysis?.contacts?.[0] || {};
    const location = analysis?.locations?.[0] || {};
    const equipment = analysis?.equipment?.[0] || {};
    const suggestedAction = analysis?.recommendedAction || "manual_review";
    const parserLabel = /(server|supabase|edge)/i.test(analysis?.parser || "")
      ? "Serverbasert tekstgjenkjenning"
      : "Enkel lokal tekstgjenkjenning";
    el.aiRegistrationDraft.classList.remove("hidden");
    el.aiRegistrationDraft.innerHTML = `
      <div id="aiRegistrationMessage" class="dialog-message hidden"></div>
      <div class="ai-draft-summary">
        <div>
          <span>${escapeHtml(parserLabel)}</span>
          <h3>${escapeHtml(analysis?.summary || "Forslag laget fra innlimt tekst.")}</h3>
          <p>Forslag: ${escapeHtml(suggestedAction.replaceAll("_", " "))}. Bruk CRM-innboks hvis du vil behandle senere, eller lagre godkjent forslag når det er kontrollert.</p>
        </div>
        <strong>${escapeHtml(aiRegistrationTypeLabel(aiRegistrationDraft.type))}</strong>
      </div>
      ${aiRegistrationWarningsHtml(analysis)}
      <div class="ai-draft-grid">
        <div class="ai-draft-form">
          <label>Hva skal lagres?
            <select id="aiRegistrationAction" data-ai-field>${aiRegistrationActionOptions(aiRegistrationDraft.action || "create_lead")}</select>
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
            <input id="aiRegistrationTags" data-ai-field type="text" value="${escapeHtml(aiRegistrationDraft.tags)}" placeholder="Lead; Service; Blåseisolering" />
          </label>
          <label>Notat / historikk
            <textarea id="aiRegistrationNote" rows="8">${escapeHtml(aiRegistrationDraft.note)}</textarea>
          </label>
          <label class="checkbox-line">
            <input id="aiRegistrationKeepOriginal" type="checkbox" checked />
            Behold originaltekst i historikk
          </label>
          <div class="ai-save-row">
            <button id="aiRegistrationInboxButton" class="secondary" type="button" title="Legg forslaget i CRM-innboks uten å opprette kunde eller lead ennå.">Lagre i CRM-innboks</button>
            <button id="aiRegistrationSaveButton" type="button">Lagre godkjent forslag</button>
            <span>Innboks lagrer for senere kontroll. Godkjent forslag oppretter/kobler faktisk kunde, lead eller historikk.</span>
          </div>
        </div>
        <aside class="ai-match-panel">
          <h3>Mulige eksisterende kunder</h3>
          <p>Velg treff manuelt. Appen kobler ikke automatisk selv om treffet virker sikkert.</p>
          <div id="aiRegistrationSelectedCustomer" class="ai-selected-customer"></div>
          <div id="aiRegistrationCandidates" class="ai-candidate-list"></div>
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
        });
    intakeItems = [saved, ...intakeItems.filter((row) => row.id !== saved.id)];
    aiRegistrationDraft.intakeId = saved.id;
    renderDashboard();
    showAiRegistrationMessage("Lagret i CRM-innboks. Det er ikke opprettet kunde/lead ennå.", "ok");
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
          <small>Bildeanalyse/OCR kommer i serverfasen. Legg gjerne inn tekst manuelt foreløpig.</small>
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
      if (el.aiRegistrationDraft) {
        el.aiRegistrationDraft.classList.remove("hidden");
        const imageNote = aiRegistrationAttachments.length
          ? "Bilde er lagt ved, men OCR/bildeanalyse krever server-AI i neste fase. Lim inn tekst eller fyll ut manuelt foreløpig."
          : "Lim inn SMS/e-post før du lager forslag.";
        el.aiRegistrationDraft.innerHTML = `<div id="aiRegistrationMessage" class="dialog-message error">${escapeHtml(imageNote)}</div>`;
      }
      setSyncStatus(aiRegistrationAttachments.length ? "Bilde er lagt ved, men OCR er ikke aktivert ennå." : "Lim inn SMS/e-post før du lager forslag.", "error");
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
      tags: mergeAiTags(existing?.tags, values.tags, values.type),
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
    if (values.action === "create_lead" && !store.isConfigured) {
      const localLead = {
        id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        first_name: values.name.split(/\s+/)[0] || null,
        last_name: values.name.split(/\s+/).slice(1).join(" ") || null,
        phone: values.phone || null,
        email: values.email || null,
        postal_code: values.zip || null,
        address: values.street || null,
        city: values.city || null,
        source: "Hurtigregistrering",
        source_detail: "Lokal demo",
        product_interest: [values.brand, values.model, aiRegistrationTypeLabel(values.type)].filter(Boolean).join(" ") || null,
        status: "new",
        updated_at: new Date().toISOString(),
      };
      leads.unshift(localLead);
      selectedLeadId = `lead:${localLead.id}`;
      clearAiRegistration();
      setView("leads");
      setSyncStatus("Lead opprettet lokalt fra hurtigregistrering.", "ok");
      return;
    }
    if (values.action === "create_lead" && store.saveLeadDraft) {
      const savedLead = await store.saveLeadDraft({
        ...values,
        keepOriginal: values.keepOriginal && !sourceIntakeId,
        raw: sourceIntakeId ? "" : values.raw,
        source_intake_id: sourceIntakeId || null,
        parser: aiRegistrationDraft.analysis?.parser || "simple_text_recognition",
      });
      leads.unshift(savedLead);
      selectedLeadId = `lead:${savedLead.id}`;
      await markIntakeCommitted(sourceIntakeId, {
        linked_lead_id: savedLead.id,
        selected_action: values.action,
        final_json: aiRegistrationFinalJson(values),
      });
      clearAiRegistration();
      setView("leads");
      setSyncStatus("Lead/forespørsel opprettet fra hurtigregistrering.", "ok");
      return;
    }
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
    if (["lead", "befaring", "installasjon", "blaseisolering"].includes(values.type) || isLeadCustomer(saved)) {
      await syncLeadRecord(saved, leadStatusForCustomer(saved), values.note);
    }
    await markIntakeCommitted(sourceIntakeId, {
      linked_customer_id: saved?.id || "",
      selected_action: values.action,
      final_json: aiRegistrationFinalJson(values),
    });
    selectedCustomerId = customerKey(saved);
    currentCustomerFilter = "all";
    currentSearch = "";
    if (el.statusFilter) el.statusFilter.value = "all";
    if (el.customerSearch) el.customerSearch.value = "";
    clearAiRegistration();
    setView("customers");
    setSyncStatus(existing ? "Tekst lagret på eksisterende kundekort." : "Nytt kundekort lagret fra hurtigregistrering.", "ok");
  }

  function starToggleHtml(customer) {
    const key = customerKey(customer);
    const active = isStarredCustomer(customer);
    const title = active ? "Slå av stjerne på denne kunden." : "Slå på stjerne. Brukes for kunder som ofte svarer ja eller er gode servicekunder.";
    return `<button class="star-icon-toggle ${active ? "active" : ""}" data-toggle-star="${escapeHtml(key)}" type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><span aria-hidden="true">&#9733;</span></button>`;
  }

  function splitTags(value) {
    return String(value || "")
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function uniqueTags(tags) {
    return [...new Set(tags.filter(Boolean))].join("; ");
  }

  function knownCustomerTags() {
    const tags = new Set();
    for (const customer of customers || []) {
      for (const tag of splitTags(customer.tags)) tags.add(tag);
      if (customer.location_tag) tags.add(customer.location_tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b, "nb-NO"));
  }

  function deriveLocationTagFromTags(tagsValue) {
    const tags = splitTags(tagsValue);
    const location = tags.find((tag) => cabinAreaNames.some((area) => normalizeMatch(tag).includes(normalizeMatch(area))))
      || tags.find((tag) => /kongsberg|flesberg|svene|lampeland|veggli|blefjell|fagerfjell|skrim|rollag|rødberg|rodberg/i.test(tag));
    return location || "";
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
      .filter((tag) => !/^lead(status)?\s*:/i.test(tag));
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
        <button class="${cash ? "active" : ""}" data-payment-customer="${escapeHtml(key)}" data-payment-mode="cash" type="button" title="Marker at kunden betaler cash.">$ Cash</button>
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
      renderAll();
      if (message) setSyncStatus(message, "ok");
      return saved;
    }
    requireLocalDemoStorage();
    Object.assign(customer, updated);
    const key = customerKey(customer);
    customerEdits[key] = { ...(customerEdits[key] || {}), ...changes };
    saveLocalEdits();
    renderAll();
    if (message) setSyncStatus(message, "ok");
    return customer;
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

  function phoneForLink(value) {
    return String(value || "").replace(/[^\d+]/g, "");
  }

  function mapsUrl(customer) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(customer))}`;
  }

  function exactCoordinates(customer) {
    return parseCoordinateText(customer?.gps_coordinates) || parseCoordinateText(customer?.google_maps);
  }

  function routeLocationText(customer) {
    const exact = exactCoordinates(customer);
    if (exact) return `${exact.lat},${exact.lon}`;
    return siteLocationText(customer);
  }

  function hasRouteLocation(customer) {
    return Boolean(routeLocationText(customer));
  }

  function routeLocationLabel(customer) {
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

  function routePointDetails(customer, areaIndex = routeAreaPointIndex()) {
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
    const text = normalizeMatch([
      customer.location_tag,
      customer.visit_city,
      customer.visit_zip,
      customer.postal_city,
      customer.postal_zip,
      customer.visit_street,
      customer.tags,
    ].filter(Boolean).join(" "));
    if (!text) return null;
    for (const [key, point] of knownPlacePoints) {
      if (text.includes(key)) return { ...point, estimated: true };
    }
    return null;
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
    ].join(" ");
  }

  function googleDirectionsUrlForRows(rows) {
    const points = rows.map((row) => routeLocationText(row.customer)).filter(Boolean);
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
    const statusRank = { red: 0, yellow: 1, green: 3, missing: 8 };
    const statusScore = statusRank[statusKind(customer)] ?? 5;
    const due = nextServiceDueForCustomer(customer) || "9999-99-99";
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
    const areaTerms = normalizeMatch(el.routeArea?.value || "").split(" ").filter(Boolean);
    const statusFilter = el.routeStatus?.value || "due";
    const replyFilter = el.routeReplyFilter?.value || "all";
    const requireLocation = el.routeRequireLocation?.checked;
    const starredOnly = Boolean(el.routeStarredOnly?.checked);
    return customers
      .filter((customer) => !customer.is_inactive)
      .filter((customer) => {
        const kind = statusKind(customer);
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
    return routePlannerRows.map((row) => {
      const booking = {
        customerId: customerKey(row.customer),
        date,
        time: normalizeBookingTime(row.startTime || el.routeStartTime?.value || "08:00", "08:00"),
        type: "service",
        duration: String(duration),
        resource: el.routeResource?.value || "Hubert",
        status: "booked",
        note: [
          "Utkast fra ruteplanlegger.",
          `Rute #${row.index}.`,
          routeReplyLabel(row.customer),
          row.driveLeg?.totalMinutes ? routeDriveText(row.driveLeg) : "",
          accessInfo(row.customer) ? `Adkomst: ${accessInfo(row.customer)}` : "",
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
    if (!el.routeBookingDate.value) el.routeBookingDate.value = isoDate(new Date());
    updateRouteAreaOptions();
    const starredOnly = Boolean(el.routeStarredOnly?.checked);
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
        const areaTerms = normalizeMatch(el.routeArea?.value || "").split(" ").filter(Boolean);
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
      <strong>${routePlannerRows.length} kunder foreslått</strong>
      <span>Start: ${escapeHtml(routeOriginQuery())}. ${candidates.length} aktuelle treff. ${routePlannerRows.filter((row) => routePoint(row.customer)).length} med kartgrunnlag. Rekkefølgen er optimalisert for kortere avstand fra Svene. Reisetid i appen er estimert fra kartpunkt/område, ikke faktisk Google Maps-tid. ${dayPlan.overflow.length ? `${dayPlan.overflow.length} får ikke plass i valgt tidsrom.` : "Alle får plass i valgt tidsrom."}</span>
      <small>Åpne ruten i Google Maps for faktisk kjøretid og siste justering av rekkefølgen. Ekte Maps-tid inne i appen krever Google Routes/Distance Matrix API senere.</small>
    `;
    if (!routePlannerRows.length) {
      el.routeResults.innerHTML = `<div class="empty-state">Ingen kunder passet filteret. Prøv et annet område eller slå av kravet om adresse/koordinater.</div>`;
    } else {
      el.routeResults.innerHTML = routePlannerRows.map((row) => {
        const customer = row.customer;
        const access = accessInfo(customer);
        return `
          <article class="route-card" data-route-customer="${escapeHtml(customerKey(customer))}">
            <div class="route-number">${row.index}</div>
            <div>
              <div class="route-title">
                <span class="dot ${statusKind(customer)}"></span>
                <strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong>
                <em>${escapeHtml(statusLabel(customer))}</em>
              </div>
              <p>${escapeHtml(siteLocationText(customer) || "Adresse mangler")}</p>
              <small>${escapeHtml(row.startTime || "")}-${escapeHtml(row.endTime || "")} · ${escapeHtml(routeLocationLabel(customer))} · ${escapeHtml(routeReplyLabel(customer))} · Neste service ${formatDate(nextServiceDueForCustomer(customer))}</small>
              ${routeDriveHtml(row.driveLeg)}
              ${isLikelyHomeAddress(customer) ? `<p class="route-access">Mulig hjemmeadresse: kontroller koordinater/anleggsadresse for booking.</p>` : ""}
              ${access ? `<p class="route-access">${escapeHtml(access)}</p>` : ""}
            </div>
            <div class="route-card-actions">
              ${customer.phone ? `<a href="tel:${escapeHtml(phoneForLink(customer.phone))}">Ring</a>${copyPhoneButton(customer.phone, "Kopier")}` : ""}
              ${hasRouteLocation(customer) ? `<a href="${escapeHtml(mapsUrl(customer))}" target="_blank" rel="noreferrer">Kart</a>` : ""}
              ${routeMessageButtons(customer)}
              <button class="book-primary" data-book-customer="${escapeHtml(customerKey(customer))}" type="button">Book</button>
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
                <button data-book-customer="${escapeHtml(customerKey(row.customer))}" type="button">Book</button>
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
    if (customer.phone) links.push(`<a href="tel:${escapeHtml(phoneForLink(customer.phone))}">Ring</a>`);
    if (customer.email) links.push(`<a href="${escapeHtml(emailUrl(customer))}" target="_blank" rel="noreferrer">E-post</a>`);
    if (mapQuery(customer)) links.push(`<a href="${escapeHtml(mapsUrl(customer))}" target="_blank" rel="noreferrer">Kart</a>`);
    return links.join("");
  }

  function emailUrl(customer) {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customer.email || "")}`;
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
    if (kind === "red") return "Service nå";
    if (kind === "yellow") return "Snart service";
    if (kind === "green") return "Service ok";
    return "Mangler data";
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

  function nextServiceDueForCustomer(customer) {
    const dates = [
      customer?.next_service_due,
      ...installationsForCustomer(customer).map((installation) => installation.next_service_due),
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
        installation.notes,
      ].filter(Boolean).join(" "))
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
      ["#newCustomerButton", "Opprett et nytt kundekort manuelt. Brukes for nye leads, befaringer og kunder som ikke finnes fra import."],
      ["#newBookingButton", "Book service, befaring eller installasjon i planningboardet."],
      ["#aiRegistrationInput", "Lim inn SMS, e-post eller notater fra kunde. Appen lager et forslag du kan rette før lagring."],
      ["#aiRegistrationParseButton", "Lager forslag til kunde, leadtype og historikk fra teksten. Ingenting lagres før du godkjenner."],
      ["#aiRegistrationClearButton", "Tømmer hurtigregistrering-feltet uten å lagre noe."],
      ['[data-filter-shortcut="red"]', "Service nå: kunder som er over frist eller bør kontaktes/bookes først."],
      ['[data-filter-shortcut="yellow"]', "Snart service: kunder som nærmer seg servicefrist og kan kontaktes når du samler område."],
      ['[data-filter-shortcut="green"]', "Service ok: kunder som nylig har hatt service eller har servicefrist lenger frem."],
      ['[data-filter-shortcut="booked"]', "Booket: jobber som ligger i planningboardet."],
      ["#customerSearch", "Søk på navn, telefon, adresse, sted, merke eller annen kundetekst."],
      ["#statusFilter", "Filtrer kundelisten etter service-status, blåseisolering eller manglende data."],
      ["#leadSearch", "Søk i leads etter navn, telefon, sted, produkt, tags og lead-notat."],
      ["#leadStatusFilter", "Filtrer leads etter neste steg, for eksempel tilbud må sendes eller venter på svar."],
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
      ["#routeArea", "Brukes når du vil finne aktuelle servicekunder i et område, for eksempel Vegglifjell eller Blefjell."],
      ["#routeStatus", "Velg hvilke service-statuser som skal tas med i ruteplanen."],
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
      ["#bookingCustomerSearch", "Søk og velg kunden jobben skal bookes på. Fra kundekort skal kunden allerede være valgt."],
      ["#bookingDate", "Dato jobben skal ligge i planningboardet."],
      ["#bookingTime", "Starttid for jobben. Bruk 15-minutters intervaller."],
      ["#bookingType", "Velg type jobb: vanlig service, servicearbeid/timejobb, befaring, installasjon eller blåseisolering."],
      ["#bookingDuration", "Hvor lang tid jobben settes av i kalenderen/planningboardet."],
      ["#bookingResource", "Hvem som skal utføre jobben."],
      ["#deleteBookingButton", "Fjerner bookingen fra planningboardet. Hvis den har ordre, får du spørsmål om ordren også skal slettes."],
      ["#formDifferentPostal", "Huk av bare hvis kunden har annen faktura-/bostedsadresse enn adressen der varmepumpen/anlegget er."],
      ["#formPaysCash", "Marker hvis kunden normalt betaler cash i stedet for faktura."],
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
      ["#technicianDate", "Velg datoen du vil se dagsplan for."],
      ["#technicianRouteButton", "Åpner dagens jobber som kjørerute i Google Maps."],
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
    customers = rawData.customers
      .filter((customer) => !deletedCustomers.has(customer.lime_id))
      .filter((customer) => !hiddenDuplicateLimeIds.has(String(customer.lime_id || customer.legacy_lime_id || "")))
      .map((customer) => ({ ...customer, ...(customerEdits[customer.lime_id] || {}) }));
    applyLimeEnrichmentToCustomers(customers);
    applyKnownCustomerCorrections(customers);
    buildInvoices(rawData.invoices || []);
    buildServiceEvents(localServiceEvents());
    buildInstallations(localInstallations());
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
      buildInvoices([]);
      buildServiceEvents([]);
      buildInstallations([]);
      buildAccessNotes([]);
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
    intakeItems = loaded.intakeItems || [];
    buildInvoices(loaded.invoices || []);
    buildServiceEvents(loaded.serviceEvents || []);
    buildInstallations(loaded.installations || []);
    buildAccessNotes(loaded.accessNotes || []);
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
      if (store.isConfigured) await supabaseLoad();
      else if (canUseLocalDemo()) localLoad();
      else throw new Error(databaseUnavailableMessage);
      const repairedOrders = await ensureOrdersForLoadedBookings();
      renderApp();
      if (message) setSyncStatus(message, "ok");
      else if (repairedOrders) setSyncStatus(`Fant ${repairedOrders} booking${repairedOrders === 1 ? "" : "er"} uten ordre og opprettet ordre automatisk.`, "ok");
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

  function linkedOrderForBooking(bookingId) {
    const id = normalizeOrderId(bookingId);
    if (!id) return null;
    return Object.values(orders).find((order) => bookingIdsForOrder(order).includes(id)) || null;
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
        return {
          id: normalized.id,
          order: normalized,
          customer: findCustomer(normalized.customerId),
        };
      })
      .filter((row) => row.order && row.customer)
      .sort((a, b) => {
        const rank = { unscheduled: 0, scheduled: 1, completed: 2, cancelled: 9 };
        const aBilling = a.order.billingStatus || a.order.billing_status;
        const bBilling = b.order.billingStatus || b.order.billing_status;
        const billingRank = (status) => status === "ready" ? -1 : status === "sent" ? 4 : 0;
        return billingRank(aBilling) - billingRank(bBilling)
          || (rank[a.order.status] ?? 5) - (rank[b.order.status] ?? 5)
          || String(a.order.scheduledDate || a.order.scheduled_date || a.order.completedAt || a.order.completed_at || a.order.created_at || "").localeCompare(String(b.order.scheduledDate || b.order.scheduled_date || b.order.completedAt || b.order.completed_at || b.order.created_at || ""))
          || cleanDisplayName(a.customer).localeCompare(cleanDisplayName(b.customer), "nb");
      });
  }

  function orderStatusLabel(status) {
    return orderStatuses[status]?.label || "Ordre";
  }

  function orderStatusHelp(status) {
    return orderStatuses[status]?.help || "Arbeidsordre knyttet til kundekortet.";
  }

  function billingStatusLabel(status) {
    return billingStatuses[status || "not_ready"] || "Ikke klar";
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
    if (scheduled) return `Booket ${formatDate(scheduled)}${order.scheduledTime || order.scheduled_time ? ` kl. ${escapeHtml(normalizeBookingTime(order.scheduledTime || order.scheduled_time))}` : ""}`;
    if (completed) return `Utført ${formatDate(completed)}`;
    return "Ikke booket";
  }

  function orderSearchText(row) {
    const order = row.order;
    const customer = row.customer;
    return normalizeMatch([
      order.title,
      order.note,
      order.type,
      order.status,
      order.billingStatus || order.billing_status,
      cleanDisplayName(customer),
      customer.phone,
      customer.email,
      customer.visit_street,
      customer.visit_city,
      customer.location_tag,
    ].filter(Boolean).join(" "));
  }

  function orderStatusBadge(order) {
    const status = order.status || "unscheduled";
    return `<span class="order-badge ${escapeHtml(status)}" title="${escapeHtml(orderStatusHelp(status))}">${escapeHtml(orderStatusLabel(status))}</span>`;
  }

  function orderBillingBadge(order) {
    const status = order.billingStatus || order.billing_status || "not_ready";
    if (status === "not_ready") return "";
    return `<span class="order-badge billing ${escapeHtml(status)}" title="Fakturastatus for ordren.">${escapeHtml(billingStatusLabel(status))}</span>`;
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
      workflowStep("Ordre", "done", "Ordre/jobben finnes i systemet."),
      workflowStep("Booket", "done", "Jobben ligger i planningboardet."),
      workflowStep("Utført", done ? "done" : needsMove || bookingNeedsCompletion(row) ? "warn" : "current", done ? "Jobben er markert utført." : "Trykk Fullfør når jobben er gjort."),
      workflowStep(isCash ? "Cash" : "Faktura", "pending", isCash ? "Cash må registreres mottatt." : "Faktura må sendes manuelt og markeres her."),
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
        heading: overdue ? `${workKind.label}: dato passert` : `${workKind.label}: booket`,
        next: overdue ? "Trykk Fullfør hvis jobben er gjort, ellers Må flyttes." : "Neste steg er å utføre jobben og trykke Fullfør.",
        help: `${workKind.help} Jobben er ikke markert utført ennå.`,
        steps,
      };
    }

    steps[2] = workflowStep("Utført", "done", "Jobben er markert utført.");

    if (!isBillable) {
      steps[3] = workflowStep("Oppfølging", "current", "Befaring/annet arbeid kan trenge tilbud eller ny ordre.");
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
      steps[3] = workflowStep(isCash ? "Cash mangler" : "Må faktureres", "warn", isCash ? "Cash er ikke markert mottatt." : "Faktura er ikke markert sendt.");
      return {
        kind: "billing",
        heading: isCash ? "Utført - cash ikke registrert" : "Utført - må faktureres",
        next: isCash ? "Marker Betalt cash når pengene er mottatt." : "Send faktura i eAccounting og marker Fakturert her.",
        help: "Jobben er utført, men betaling/faktura mangler.",
        steps,
      };
    }

    if (paymentMode === "cash" || billingStatus === "paid") {
      steps[3] = workflowStep("Betalt cash", "done", "Cash er registrert mottatt.");
      steps[4] = workflowStep("Ferdig", "done", "Jobben er ferdig behandlet.");
      return {
        kind: "complete",
        heading: "Ferdig - betalt cash",
        next: "Ingen handling nødvendig.",
        help: "Jobben er utført og cash er registrert.",
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

    steps[3] = workflowStep(isCash ? "Cash" : "Faktura", "current", "Avklar betaling/faktura.");
    return {
      kind: "billing",
      heading: "Utført - avklar betaling",
      next: isCash ? "Marker Betalt cash hvis kunden har betalt." : "Marker Fakturert når faktura er sendt.",
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

    const status = order.status || "unscheduled";
    const billing = order.billingStatus || order.billing_status || "not_ready";
    const billable = billableJobType(order.type || "service");
    const steps = [
      workflowStep("Ordre", "done", "Ordren finnes på kundekortet."),
      workflowStep("Booket", status === "unscheduled" ? "current" : "done", "Ordren må bookes i planningboardet."),
      workflowStep("Utført", status === "completed" ? "done" : "pending", "Jobben markeres utført etter arbeid."),
      workflowStep("Faktura", billing === "ready" ? "warn" : billing === "sent" || billing === "paid" ? "done" : "pending", "Faktura/betaling avklares etter utført jobb."),
      workflowStep("Ferdig", billing === "sent" || billing === "paid" || (status === "completed" && !billable) ? "done" : "pending", "Ferdig når arbeid og betaling er avklart."),
    ];

    if (status === "cancelled") {
      return {
        kind: "move",
        heading: "Avsluttet",
        next: "Ingen aktiv jobb. Lag ny ordre hvis kunden skal følges opp igjen.",
        help: "Ordren er avsluttet.",
        steps: [workflowStep("Avsluttet", "warn", "Ordren er lukket uten videre arbeid.")],
      };
    }
    if (billing === "ready") {
      return {
        kind: "billing",
        heading: "Utført - må faktureres",
        next: "Send faktura i eAccounting og marker Fakturert.",
        help: "Ordren er utført, men faktura mangler.",
        steps,
      };
    }
    if (billing === "sent" || billing === "paid") {
      return {
        kind: "complete",
        heading: billing === "paid" ? "Ferdig - betalt" : "Ferdig - fakturert",
        next: "Ingen handling nødvendig.",
        help: "Ordren er ferdig behandlet.",
        steps,
      };
    }
    if (status === "completed") {
      return {
        kind: billable ? "billing" : "done",
        heading: billable ? "Utført - avklar faktura" : "Utført",
        next: billable ? "Marker fakturert når faktura er sendt." : "Sjekk om det trengs videre oppfølging.",
        help: "Ordren er utført.",
        steps,
      };
    }
    if (status === "scheduled") {
      return {
        kind: "scheduled",
        heading: "Booket - ikke utført",
        next: "Utfør jobben og trykk Fullfør i planningboardet.",
        help: "Ordren ligger i kalenderen.",
        steps,
      };
    }
    return {
      kind: "unscheduled",
      heading: "Ordre - ikke booket",
      next: "Trykk Book ordre og legg jobben i planningboardet.",
      help: "Ordren finnes, men den ligger ikke i kalenderen ennå.",
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
    const paymentActionLabel = row.customer?.pays_cash ? "Betalt cash" : "Fakturert";
    return [
      !done ? `<button data-complete-booking="${escapeHtml(row.id)}" type="button">Fullfør jobb</button>` : "",
      done && bookingNeedsPaymentAction(row) ? `<button data-billing-booking="${escapeHtml(row.id)}" type="button">${escapeHtml(paymentActionLabel)}</button>` : "",
      !done && !needsMove ? `<button class="secondary" data-move-booking="${escapeHtml(row.id)}" type="button">Må flyttes</button>` : "",
      options.includeEdit ? `<button class="secondary" data-edit-booking="${escapeHtml(row.id)}" type="button">Endre booking</button>` : "",
    ].filter(Boolean).join("");
  }

  function bookingQuickFocusHtml(row, linkedOrder = null) {
    if (!row) return "";
    const workKind = bookingWorkKind(row);
    const flow = bookingWorkflowState(row, linkedOrder);
    const done = row.booking.status === "done" || doneJobs.has(row.id);
    const needsMove = bookingNeedsMove(row);
    const statusLine = bookingNeedsPaymentAction(row)
      ? (row.customer?.pays_cash ? "Utført, men cash er ikke registrert." : "Utført, men faktura er ikke markert sendt.")
      : needsMove
        ? "Jobben må avtales på nytt eller flyttes."
        : bookingNeedsCompletion(row)
          ? "Datoen er passert. Fullfør jobben hvis den er gjort, ellers flytt den."
          : done
            ? "Jobben er markert utført."
            : "Jobben er booket, men ikke markert utført.";
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
      completedAt: overrides.completedAt || (isDone ? booking.done_at || booking.date || "" : ""),
      note: overrides.note ?? cleanBookingNote(booking.note || ""),
      created_at: overrides.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, [bookingId]);
  }

  async function saveOrderRecord(id, order, options = {}) {
    const nextId = normalizeOrderId(id || order.id) || `order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const record = {
      ...order,
      id: nextId,
      customerId: order.customerId || order.customer_id || "",
      type: order.type || "service",
      status: order.status || "unscheduled",
      billingStatus: order.billingStatus || order.billing_status || "not_ready",
      updated_at: new Date().toISOString(),
    };
    setBookingIdsForOrder(record, bookingIdsForOrder(record));
    if (store.isConfigured && store.saveOrder && !options.localOnly) {
      const saved = await store.saveOrder(nextId, record);
      orders[saved.id] = saved;
      if (nextId !== saved.id) delete orders[nextId];
      return saved;
    }
    if (store.isConfigured && options.localOnly) {
      orders[nextId] = record;
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
        return `<li>${escapeHtml(order?.title || "Ordre")} · ${escapeHtml(customer ? cleanDisplayName(customer) : "Ukjent kunde")}</li>`;
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
      <strong>${realIds.length} ordre valgt</strong>
      <span>${linkedBookingCount ? `${linkedBookingCount} booking${linkedBookingCount === 1 ? "" : "er"} er koblet til valgte ordre.` : "Ingen aktive bookinger er koblet til valgte ordre."}</span>
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
    setSyncStatus(`${ids.length} ordre slettet.`, "ok");
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

  async function createOrderFromLead(customerId) {
    const customer = findCustomer(customerId);
    if (!customer) throw new Error("Fant ikke lead/kunde.");
    const note = leadNoteForCustomer(customer);
    const type = /service/i.test(note) ? "service" : "installasjon";
    const order = await saveOrderRecord("", {
      customerId: customerKey(customer),
      title: `${orderTypeLabel(type)} - ${cleanDisplayName(customer)}`,
      type,
      status: "unscheduled",
      billingStatus: "not_ready",
      source: "lead",
      note: note || `Opprettet fra leadstatus: ${leadStatusLabel(leadStatusForCustomer(customer))}.`,
      created_at: new Date().toISOString(),
    });
    await saveServiceEvent(customer, {
      event_date: isoDate(new Date()),
      event_type: "Ordre opprettet",
      note: `${orderTypeLabel(type)} opprettet fra lead. ${note || ""}`.trim(),
    });
    selectedOrderId = order.id;
    setView("orders");
    setSyncStatus("Ordre opprettet fra lead.", "ok");
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

  function openOrderDialog(customerId, orderId = "", options = {}) {
    const order = findOrder(orderId);
    const customer = findCustomer(order ? orderCustomerId(order) : customerId);
    if (!customer) {
      setSyncStatus("Velg eller opprett kunde før du lager ordre.", "error");
      return;
    }
    editingOrderId = order?.id || "";
    orderDialogCustomerId = customerKey(customer);
    orderTitleManuallyEdited = Boolean(order?.title);
    clearOrderDialogMessage();
    el.orderDialogTitle.textContent = order ? "Rediger ordre" : "Ny ordre";
    el.orderCustomerName.value = cleanDisplayName(customer);
    el.orderType.value = serviceWorkType(order?.type || options.type) ? "reparasjon" : (order?.type || options.type || "service");
    el.orderTitleInput.value = order?.title || defaultOrderTitle(customer, el.orderType.value);
    el.orderBookNow.checked = false;
    el.orderNoteInput.value = order?.note || "";
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
    if (!customer) throw new Error("Fant ikke kunden for ordren.");
    return {
      customer,
      type: el.orderType.value || "service",
      title: el.orderTitleInput.value.trim() || defaultOrderTitle(customer, el.orderType.value),
      note: el.orderNoteInput.value.trim(),
      bookNow: Boolean(el.orderBookNow.checked),
    };
  }

  async function saveOrderFromDialog() {
    const values = orderFormValues();
    const existing = findOrder(editingOrderId);
    const order = await saveOrderRecord(editingOrderId, {
      ...existing,
      customerId: customerKey(values.customer),
      title: values.title,
      type: values.type,
      status: existing?.status || "unscheduled",
      billingStatus: existing?.billingStatus || existing?.billing_status || "not_ready",
      source: existing?.source || "manual",
      note: values.note,
      created_at: existing?.created_at || new Date().toISOString(),
    });
    await saveServiceEvent(values.customer, {
      event_date: isoDate(new Date()),
      event_type: existing ? "Ordre endret" : "Ordre opprettet",
      note: `${orderTypeLabel(values.type)}-ordre ${existing ? "endret" : "opprettet"} direkte på kundekort.${values.note ? `\n${values.note}` : ""}`,
    });
    selectedOrderId = order.id;
    const shouldBook = values.bookNow;
    const customerId = customerKey(values.customer);
    el.orderDialog.close();
    renderAll();
    setSyncStatus(existing ? "Ordre oppdatert." : "Ordre opprettet direkte fra kundekort.", "ok");
    if (shouldBook) {
      openBookingDialog(customerId, "", {
        orderId: order.id,
        type: values.type === "annet" ? "service" : values.type,
        note: values.note,
      });
    }
  }

  function knownPlanningResources(rows = bookingRows()) {
    const resources = new Set(["Gunnar", "Hubert", "Gunnar og Hubert"]);
    if (currentUser?.name && !/bruker/i.test(currentUser.name)) resources.add(currentUser.name);
    for (const row of rows) {
      const resource = String(row.booking.resource || "").trim();
      if (resource) resources.add(resource);
    }
    return [...resources].sort((a, b) => {
      const rank = (value) => {
        if (value === "Gunnar") return 1;
        if (value === "Hubert") return 2;
        if (value === "Gunnar og Hubert") return 3;
        return 10;
      };
      return rank(a) - rank(b) || a.localeCompare(b, "nb-NO");
    });
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
    return /\[Betalt cash[^\]]*\]/i;
  }

  function paymentMarkerRegex() {
    return /\[(Fakturert|Betalt cash)[^\]]*\]/i;
  }

  function paymentMarkersRegex() {
    return /\[(Fakturert|Betalt cash)[^\]]*\]/gi;
  }

  function moveMarkerRegex() {
    return /\[Må flyttes[^\]]*\]/gi;
  }

  function markerText(note, regex) {
    return String(note || "").match(regex)?.[0] || "";
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
    currentUser = users[userKey];
    localStorage.setItem(storage.user, JSON.stringify(currentUser));
    currentView = currentUser.view;
    renderApp();
  }

  function setView(view) {
    currentView = view;
    document.querySelectorAll("nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    document.querySelectorAll(".view").forEach((panel) => panel.classList.add("hidden"));
    document.getElementById(`${view}View`)?.classList.remove("hidden");
    const titles = {
      dashboard: ["Oversikt", "Nøkkeltall, neste jobber og serviceklar liste."],
      customers: ["Kunder", "Søk, rediger og book kunder."],
      leads: ["Leads", "Følg opp befaringer, tilbud og gamle henvendelser."],
      orders: ["Ordre", "Arbeidsordre fra lead, booking og utførte jobber."],
      insulation: ["Blåseisolering", "Kalkyle, dokumenter og kunder for iSOBYGG Buskerud."],
      planning: ["Plan", "Felles planningboard for Gunnar og Hubert."],
      routeplanner: ["Planlegg servicedag", "Lag kjørbar rute av kunder som har svart ja."],
      technician: ["Min dag", "Jobbene dine på mobil."],
    };
    el.viewTitle.textContent = titles[view]?.[0] || "CRM";
    el.viewSubtitle.textContent = titles[view]?.[1] || "";
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

  function renderApp() {
    installHelpText();
    const missingProductionDatabase = !store.isConfigured && !demoEnabled;
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
      return;
    }
    el.loginView.classList.add("hidden");
    el.appView.classList.remove("hidden");
    el.currentUserName.textContent = currentUser.name;
    el.currentUserRole.textContent = currentUser.role;
    el.dataModePill.textContent = store.isConfigured ? "Supabase database" : "Lokal utviklingsdemo";
    el.dataModePill.classList.toggle("online", store.isConfigured);
    el.importSeedButton.classList.toggle("hidden", !(store.isConfigured && browserImportEnabled && isAdmin() && (rawData.customers || []).length));
    const technician = currentUser.role === "Tekniker";
    el.newCustomerButton.classList.toggle("hidden", technician);
    el.newBookingButton.classList.toggle("hidden", technician);
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
  }

  function renderDashboard() {
    const activeCustomers = customers.filter((customer) => customer && !customer.is_inactive);
    const redCount = activeCustomers.filter((customer) => statusKind(customer) === "red").length;
    const yellowCount = activeCustomers.filter((customer) => statusKind(customer) === "yellow").length;
    const greenCount = activeCustomers.filter((customer) => statusKind(customer) === "green").length;
    const upcomingBookings = bookingRows().filter((row) => row.booking.date >= isoDate(new Date())).length;
    const moveRows = moveQueueRows();
    const billingRows = billingQueueRows();
    el.redMetric.textContent = redCount.toLocaleString("nb-NO");
    el.yellowMetric.textContent = yellowCount.toLocaleString("nb-NO");
    el.greenMetric.textContent = greenCount.toLocaleString("nb-NO");
    el.bookedMetric.textContent = bookingRows().length.toLocaleString("nb-NO");
    if (el.dashboardServiceCount) el.dashboardServiceCount.textContent = (redCount + yellowCount).toLocaleString("nb-NO");
    if (el.dashboardLeadCount) el.dashboardLeadCount.textContent = allLeadEntries().filter((entry) => !["won", "lost"].includes(leadStatusForEntry(entry))).length.toLocaleString("nb-NO");
    if (el.dashboardBookingCount) el.dashboardBookingCount.textContent = upcomingBookings.toLocaleString("nb-NO");
    if (el.dashboardMoveCount) el.dashboardMoveCount.textContent = moveRows.length.toLocaleString("nb-NO");
    if (el.dashboardBillingCount) el.dashboardBillingCount.textContent = billingRows.length.toLocaleString("nb-NO");

    renderNextJobs();
    renderMoveQueue(moveRows);

    el.dueCustomers.innerHTML = "";
    const dueList = activeCustomers
      .filter((item) => ["red", "yellow"].includes(statusKind(item)))
      .sort((a, b) => String(a.next_service_due || "9999-99-99").localeCompare(String(b.next_service_due || "9999-99-99")));
    for (const customer of dueList.slice(0, 12)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.customerId = customerKey(customer);
      button.innerHTML = `<span class="dot ${statusKind(customer)}"></span><strong>${customerStarHtml(customer)}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</strong><span>${escapeHtml(customer.location_tag || customer.visit_city || "")}</span>`;
      el.dueCustomers.appendChild(button);
    }
    renderBillingQueue();
    renderDataQuality();
    renderRecentActivity();
    renderIntakeInbox();
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
      const label = bookingNeedsCashPayment(row) ? "Cash ikke registrert" : bookingNeedsInvoice(row) ? "Må faktureres" : "Dato passert";
      const kind = bookingNeedsPaymentAction(row) ? "yellow" : "red";
      button.innerHTML = `
        <span class="dot ${kind}"></span>
        <strong>${escapeHtml(cleanDisplayName(row.customer))}</strong>
        <span>${escapeHtml(label)} · ${formatDate(row.booking.date)} · ${escapeHtml(bookingJobLabel(row))}</span>
      `;
      el.billingQueue.appendChild(button);
    }
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
    return [
      final.type ? aiRegistrationTypeLabel(final.type) : "",
      final.phone || "",
      final.email || "",
      [final.street, final.zip, final.city].filter(Boolean).join(", "),
      row?.status || "needs_review",
    ].filter(Boolean).join(" · ") || String(row?.raw_text || row?.extracted_text || "").slice(0, 140);
  }

  function renderIntakeInbox() {
    if (!el.intakeInbox) return;
    const rows = (intakeItems || []).filter((row) => ["draft", "needs_review", "ready", "failed"].includes(row.status || "needs_review"));
    el.intakeInbox.classList.toggle("hidden", !rows.length);
    if (!rows.length) {
      el.intakeInbox.innerHTML = "";
      return;
    }
    el.intakeInbox.innerHTML = `
      <div class="section-head compact">
        <div>
          <h3>CRM-innboks</h3>
          <p>Tekst lagret fra Hurtigregistrering. Behandles manuelt før noe blir kunde, lead eller historikk.</p>
        </div>
        <strong>${rows.length.toLocaleString("nb-NO")}</strong>
      </div>
      <div class="intake-inbox-list">
        ${rows.slice(0, 8).map((row) => `
          <article>
            <div>
              <strong>${escapeHtml(intakeItemTitle(row))}</strong>
              <span>${escapeHtml(intakeItemSummary(row))}</span>
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
    };
    aiRegistrationSelectedCustomerId = row.linked_customer_id || "";
    if (currentView !== "dashboard") setView("dashboard");
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
    if (email.includes("@")) parts.push(`email:${email}`);
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
    return `
      <section class="detail-section attention compact-warning">
        <h3>Mulig dublett</h3>
        <p>Fant andre kundekort med likt navn, e-post, telefon eller adresse. Ikke slå sammen automatisk, men sjekk før du redigerer.</p>
        <div class="duplicate-links">
          ${matches.map((row) => `
            <button data-open-customer="${escapeHtml(customerKey(row.customer))}" type="button" title="Åpne mulig dublett i kundelisten.">
              <strong>${escapeHtml(cleanDisplayName(row.customer))}</strong>
              <span>${escapeHtml(row.label)} · ${escapeHtml([row.customer.visit_city, row.customer.phone, row.customer.email].filter(Boolean).join(" · "))}</span>
            </button>
          `).join("")}
        </div>
      </section>
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

  function qualityIssueForCustomer(customer, issue, duplicateKeys = duplicateNameKeys()) {
    if (!customer) return false;
    if (customer.is_inactive) return false;
    if (issue === "quality_phone") return !compactPhone(customer.phone);
    if (issue === "quality_email") return !String(customer.email || "").includes("@");
    if (issue === "quality_address") return !addressFor(customer) && !exactCoordinates(customer);
    if (issue === "quality_duplicate") return duplicateIdentityParts(customer).some((part) => duplicateKeys.has(part));
    if (issue === "quality_home_address") return looksLikeHomeAddressOnCabinCustomer(customer);
    if (issue === "quality_multi_pump") return hasMultiplePumpSignal(customer) && !hasConfirmedMultiplePumps(customer);
    if (issue === "quality_due") return statusKind(customer) === "missing" || !nextServiceDueForCustomer(customer);
    return false;
  }

  function dataQualityRows() {
    const duplicateKeys = duplicateNameKeys();
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
      const matches = customers.filter((customer) => qualityIssueForCustomer(customer, id, duplicateKeys));
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

  function allServiceEvents() {
    const seen = new Set();
    const rows = [];
    for (const list of serviceEventsByCustomer.values()) {
      for (const event of list) {
        const key = event.id || `${event.customer_id || event.lime_id || ""}-${event.event_date || ""}-${event.event_type || ""}-${event.note || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(event);
      }
    }
    return rows;
  }

  function activityTime(value, fallbackDate = "") {
    const text = value || (fallbackDate ? `${fallbackDate}T00:00:00` : "");
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
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
      items.push({
        time,
        kind: "order",
        customerId: customerKey(row.customer),
        orderId: row.id,
        title: "Ordre",
        customer: row.customer?.name || "Uten navn",
        text: `${orderStatusLabel(row.order.status || "unscheduled")} · ${orderTypeLabel(row.order.type)} · ${orderDateText(row.order)}`,
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
    const duplicateKeys = duplicateNameKeys();
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
          || qualityIssueForCustomer(customer, filter, duplicateKeys);
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
    const name = lead?.company_name || [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Lead uten navn";
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
    return leadStatusFromDb(entry?.lead?.status) || leadStatusForCustomer(entry?.customer);
  }

  function leadNoteForEntry(entry) {
    return leadNoteFromDb(entry?.lead) || leadNoteForCustomer(entry?.customer);
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

  function filteredLeads() {
    const search = currentLeadSearch;
    const filter = currentLeadFilter === "all" || leadStatuses[currentLeadFilter] ? currentLeadFilter : "followup";
    return allLeadEntries()
      .filter((entry) => {
        const status = leadStatusForEntry(entry);
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
    renderWebsiteSubmissionInbox();
    const selectedFilter = el.leadStatusFilter?.value || "";
    currentLeadFilter = selectedFilter || (currentLeadFilter === "all" || leadStatuses[currentLeadFilter] ? currentLeadFilter : "followup");
    if (el.leadStatusFilter && !selectedFilter) el.leadStatusFilter.value = currentLeadFilter;
    currentLeadSearch = el.leadSearch?.value?.trim() || "";
    const all = allLeadEntries();
    el.leadFollowupMetric.textContent = all.filter((entry) => leadStatusForEntry(entry) === "followup").length.toLocaleString("nb-NO");
    el.leadNeedsOfferMetric.textContent = all.filter((entry) => leadStatusForEntry(entry) === "needs_offer").length.toLocaleString("nb-NO");
    el.leadOfferSentMetric.textContent = all.filter((entry) => leadStatusForEntry(entry) === "offer_sent").length.toLocaleString("nb-NO");
    el.leadLostMetric.textContent = all.filter((entry) => leadStatusForEntry(entry) === "lost").length.toLocaleString("nb-NO");
    const list = filteredLeads();
    if (!selectedLeadId || !selectedLeadEntry(list)) selectedLeadId = leadEntryKey(list[0]) || "";
    el.leadList.innerHTML = "";
    if (!list.length) {
      el.leadList.innerHTML = `<div class="empty-state">Ingen leads i dette filteret.</div>`;
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
        <span>${escapeHtml(leadNoteForEntry(entry) || customer.tags || "Ingen notat ennå").slice(0, 150)}</span>
      `;
      el.leadList.appendChild(button);
    }
    renderLeadDetail();
  }

  function renderWebsiteSubmissionInbox() {
    if (!el.websiteSubmissionInbox) return;
    const rows = (websiteSubmissions || []).filter((row) => ["new", "duplicate_possible", "failed"].includes(row.processing_status || "new"));
    el.websiteSubmissionInbox.classList.toggle("hidden", !rows.length);
    if (!rows.length) {
      el.websiteSubmissionInbox.innerHTML = "";
      return;
    }
    el.websiteSubmissionInbox.innerHTML = `
      <div class="section-head compact">
        <div>
          <h3>Nettsideinnsendinger</h3>
          <p>Nye skjema fra nettsiden skal kontrolleres før de blir lead eller jobb.</p>
        </div>
        <strong>${rows.length.toLocaleString("nb-NO")}</strong>
      </div>
      <div class="website-submission-list">
        ${rows.slice(0, 6).map((row) => {
          const name = websiteSubmissionName(row);
          const message = websiteSubmissionMessage(row);
          const date = row.received_at ? formatDate(isoDate(new Date(row.received_at))) : "";
          const text = [websiteSubmissionTypeLabel(row), row.normalized_phone, row.normalized_email, date].filter(Boolean).join(" · ");
          const duplicateHints = websiteSubmissionDuplicateHints(row, rows);
          const customerHint = websiteSubmissionCustomerMatchHint(row);
          const canCreateServiceOrder = websiteSubmissionCanCreateServiceOrder(row);
          return `
            <article title="Rå innsending beholdes uendret til den behandles server-side.">
              <div>
                <strong>${escapeHtml(name || "Ukjent innsending")}</strong>
                <span>${escapeHtml(text || "Ny innsending")}</span>
                ${message ? `<small>${escapeHtml(message).slice(0, 180)}</small>` : ""}
                ${duplicateHints.length ? `<small class="website-duplicate-hint">Mulig duplikat: ${escapeHtml(duplicateHints.join(", "))}</small>` : ""}
                ${customerHint ? `<small class="website-duplicate-hint">${escapeHtml(customerHint)}</small>` : ""}
              </div>
              <div class="mini-action-row">
                ${canCreateServiceOrder ? `<button data-create-website-service-order="${escapeHtml(row.id)}" type="button" title="Opprett kundekort og serviceordre fra denne nettsideinnsendingen.">Lag serviceordre</button>` : ""}
                <button data-create-website-lead="${escapeHtml(row.id)}" type="button" title="Opprett lead fra denne nettsideinnsendingen.">Lag lead</button>
                <button class="secondary" data-website-submission-status="read" data-website-submission-id="${escapeHtml(row.id)}" type="button" title="Skjul fra innboksen uten å opprette lead.">Marker lest</button>
                <button class="secondary" data-website-submission-status="spam" data-website-submission-id="${escapeHtml(row.id)}" type="button" title="Marker som spam/ugyldig og skjul fra innboksen.">Spam</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function websiteSubmissionDuplicateHints(row, rows = websiteSubmissions || []) {
    const phone = compactPhone(firstFilled(row?.normalized_phone, websiteSubmissionCustomer(row).phone));
    const email = String(firstFilled(row?.normalized_email, websiteSubmissionCustomer(row).email)).trim().toLowerCase();
    const name = normalizeMatch(websiteSubmissionName(row));
    const reasons = new Set();
    for (const other of rows) {
      if (!other || other.id === row?.id) continue;
      const otherPhone = compactPhone(firstFilled(other.normalized_phone, websiteSubmissionCustomer(other).phone));
      const otherEmail = String(firstFilled(other.normalized_email, websiteSubmissionCustomer(other).email)).trim().toLowerCase();
      const otherName = normalizeMatch(websiteSubmissionName(other));
      if (phone && otherPhone && phone === otherPhone) reasons.add("samme telefon");
      if (email && otherEmail && email === otherEmail) reasons.add("samme e-post");
      if (name && otherName && name === otherName) reasons.add("samme navn");
    }
    return [...reasons];
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

  function websiteSubmissionPayload(row) {
    return plainObject(row?.payload);
  }

  function websiteSubmissionCustomer(row) {
    const payload = websiteSubmissionPayload(row);
    return plainObject(payload.customer);
  }

  function websiteSubmissionRequest(row) {
    const payload = websiteSubmissionPayload(row);
    return plainObject(payload.request);
  }

  function websiteSubmissionSupport(row) {
    const payload = websiteSubmissionPayload(row);
    return plainObject(payload.support);
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
    return firstFilled(customer.name, payload.name, payload.navn, payload.fullName, row?.normalized_email, row?.normalized_phone, row?.public_reference);
  }

  function websiteSubmissionMessage(row) {
    const payload = websiteSubmissionPayload(row);
    const request = websiteSubmissionRequest(row);
    return firstFilled(request.message, payload.message, payload.melding, payload.note, payload.notes);
  }

  function websiteSubmissionTypeLabel(row) {
    const type = String(row?.submission_type || websiteSubmissionPayload(row).submission_type || "").toLowerCase();
    const labels = {
      lead: "Lead",
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

  function websiteSubmissionLeadValues(row) {
    const payload = websiteSubmissionPayload(row);
    const customer = websiteSubmissionCustomer(row);
    const request = websiteSubmissionRequest(row);
    const support = websiteSubmissionSupport(row);
    const postalCode = firstFilled(customer.postal_code, customer.zip, payload.postal_code, payload.zip);
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
      phone: firstFilled(customer.phone, payload.phone, row?.normalized_phone),
      email: firstFilled(customer.email, payload.email, row?.normalized_email),
      postal_code: postalCode,
      zip: postalCode,
      address: firstFilled(customer.address, payload.address, request.address),
      street: firstFilled(customer.address, payload.address, request.address),
      city: firstFilled(customer.city, payload.city, postalCityByZip[postalCode]),
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

  function websiteSubmissionIsService(row) {
    const type = String(row?.submission_type || websiteSubmissionPayload(row).submission_type || "").toLowerCase();
    if (["service_request", "support_request"].includes(type)) return true;
    const text = websiteSubmissionServiceText(row);
    return /\b(service|support|reparasjon|reklamasjon|garanti|feil|hjelp|problem|problemer|lekker|lekkasje|drypp|støy|lyd|lukter|fungerer ikke|is|vann|rens|vedlikehold|timejobb|flytte|demonter|monter)\b/i.test(text);
  }

  function websiteSubmissionCanCreateServiceOrder(row) {
    return websiteSubmissionIsService(row) && !row?.created_job_id;
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

  function websiteSubmissionCustomerDraft(row) {
    const values = websiteSubmissionLeadValues(row);
    const type = websiteSubmissionOrderType(row);
    const fallbackName = `Ukjent kunde ${values.phone || values.email || ""}`.trim();
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
      tags: uniqueTags(["Nettside", type === "service" ? "Service" : "Servicearbeid"]),
      local_note: [
        `${weekdayDate(isoDate(new Date()), { long: true })}: Kundekort opprettet fra nettsideinnsending.`,
        websiteSubmissionOrderNote(row),
      ].filter(Boolean).join("\n"),
    };
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
    if (!store.saveLeadDraft || !store.updateWebsiteSubmission) {
      throw new Error("Nettsideinnsendinger krever Supabase og oppdatert adapter.");
    }
    const row = (websiteSubmissions || []).find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke nettsideinnsendingen.");
    const values = websiteSubmissionLeadValues(row);
    if (!values.name && !values.phone && !values.email && !values.address) {
      throw new Error("Nettsideinnsendingen mangler nok kontaktinfo til å lage lead.");
    }
    const savedLead = await store.saveLeadDraft(values);
    leads.unshift(savedLead);
    const updated = await store.updateWebsiteSubmission(id, {
      processing_status: "processed",
      created_lead_id: savedLead.id,
    });
    mergeWebsiteSubmission(id, { processing_status: "processed", created_lead_id: savedLead.id }, updated);
    selectedLeadId = `lead:${savedLead.id}`;
    currentLeadFilter = "followup";
    if (el.leadStatusFilter) el.leadStatusFilter.value = currentLeadFilter;
    renderLeads();
    setSyncStatus("Lead opprettet fra nettsideinnsending.", "ok");
  }

  async function createServiceOrderFromWebsiteSubmission(id) {
    if (!store.saveCustomer || !store.saveOrder || !store.updateWebsiteSubmission) {
      throw new Error("Serviceordre fra nettside krever Supabase og oppdatert adapter.");
    }
    const row = (websiteSubmissions || []).find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke nettsideinnsendingen.");
    if (!websiteSubmissionIsService(row)) {
      throw new Error("Denne innsendingen ser ikke ut som service. Bruk Lag lead hvis den skal følges opp som salg.");
    }
    const values = websiteSubmissionLeadValues(row);
    if (!values.name && !values.phone && !values.email && !values.address && !values.street) {
      throw new Error("Nettsideinnsendingen mangler nok kontaktinfo til å lage serviceordre.");
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
    const updatedPatch = {
      processing_status: "processed",
      created_customer_id: customer.id || customerKey(customer),
    };
    if (order.jobId || order.job_id) updatedPatch.created_job_id = order.jobId || order.job_id;
    const updated = await store.updateWebsiteSubmission(id, updatedPatch);
    mergeWebsiteSubmission(id, updatedPatch, updated);
    await saveServiceEvent(customer, {
      event_date: isoDate(new Date()),
      event_type: created ? "Serviceordre fra nettside" : "Serviceordre fra nettside på eksisterende kundekort",
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
    setSyncStatus("Serviceordre opprettet fra nettsideinnsending.", "ok");
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
    renderLeads();
    setSyncStatus(status === "read" ? "Nettsideinnsending markert lest." : "Nettsideinnsending markert som spam.", "ok");
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
    return `
      <section class="detail-section attention compact-warning">
        <h3>Mulig eksisterende kundekort</h3>
        <p>Fant aktive kundekort som ligner. Koble til eksisterende kunde hvis dette er samme person, ellers kan du opprette nytt kundekort.</p>
        <div class="lead-match-list">
          ${candidates.map(({ customer, score, reasons }) => {
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
      </section>
    `;
  }

  function leadCustomerDraft(entry) {
    const lead = entry?.lead || {};
    const customer = entry?.customer || leadCustomerFromRow(lead);
    const status = leadStatusForEntry(entry);
    const note = leadNoteForEntry(entry);
    const source = lead.source || customer.lead_source || "Lead";
    const sourceDetail = lead.source_detail || customer.source || "";
    const tags = uniqueTags([
      "Lead",
      `Leadstatus: ${leadStatusLabel(status)}`,
      source === "Nettside" ? "Nettside" : "",
    ]);
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
        `${weekdayDate(isoDate(new Date()), { long: true })}: Kundekort opprettet fra lead.`,
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
    if (!store.updateLead) throw new Error("Kobling av lead krever oppdatert Supabase-adapter.");
    const entry = allLeadEntries().find((item) => leadEntryKey(item) === entryKey);
    if (!entry?.lead) throw new Error("Fant ikke leaden.");
    const customer = findCustomer(customerId);
    if (!customer) throw new Error("Fant ikke kundekortet som skulle kobles.");
    const updatedLead = await store.updateLead(entry.lead.id, { existing_customer_id: customerKey(customer) });
    const leadIndex = leads.findIndex((lead) => lead.id === updatedLead.id);
    if (leadIndex >= 0) leads[leadIndex] = updatedLead;
    else leads.unshift(updatedLead);
    await linkWebsiteSubmissionToCustomerFromLead(updatedLead, customerKey(customer));
    await saveServiceEvent(customer, {
      event_date: isoDate(new Date()),
      event_type: "Lead koblet til kundekort",
      note: leadNoteForEntry({ ...entry, lead: updatedLead, customer }) || "Lead koblet til eksisterende kundekort.",
    });
    selectedLeadId = `lead:${updatedLead.id}`;
    selectedCustomerId = customerKey(customer);
    currentLeadFilter = leadStatusForEntry({ ...entry, lead: updatedLead, customer }) || "followup";
    if (el.leadStatusFilter) el.leadStatusFilter.value = currentLeadFilter;
    renderAll();
    setView("leads");
    setSyncStatus("Lead koblet til eksisterende kundekort. Du kan nå sette status, booke eller opprette ordre.", "ok");
  }

  async function createCustomerFromLead(entryKey) {
    if (!store.saveCustomer || !store.updateLead) throw new Error("Opprett kundekort fra lead krever oppdatert Supabase-adapter.");
    const entry = allLeadEntries().find((item) => leadEntryKey(item) === entryKey);
    if (!entry?.lead) throw new Error("Fant ikke leaden.");
    const existingCustomerId = leadCustomerId(entry.lead);
    if (existingCustomerId && findCustomer(existingCustomerId)) {
      selectedCustomerId = existingCustomerId;
      setView("customers");
      setSyncStatus("Leaden er allerede koblet til kundekort.", "ok");
      return;
    }
    const strongCandidate = strongLeadCustomerCandidate(entry);
    if (strongCandidate) {
      setSyncStatus(`Fant mulig eksisterende kundekort: ${cleanDisplayName(strongCandidate.customer)}. Bruk Koble kundekort hvis dette er samme kunde.`, "ok");
      renderLeadDetail();
      return;
    }
    const draft = leadCustomerDraft(entry);
    if (!draft.name && !draft.phone && !draft.email) throw new Error("Leaden mangler nok kontaktinfo til å opprette kundekort.");
    const savedCustomer = await store.saveCustomer(draft);
    const index = customers.findIndex((customer) => customerKey(customer) === customerKey(savedCustomer));
    if (index >= 0) customers[index] = savedCustomer;
    else customers.unshift(savedCustomer);

    const updatedLead = await store.updateLead(entry.lead.id, { existing_customer_id: savedCustomer.id });
    const leadIndex = leads.findIndex((lead) => lead.id === updatedLead.id);
    if (leadIndex >= 0) leads[leadIndex] = updatedLead;
    else leads.unshift(updatedLead);

    await linkWebsiteSubmissionToCustomerFromLead(updatedLead, savedCustomer.id);

    await saveServiceEvent(savedCustomer, {
      event_date: isoDate(new Date()),
      event_type: "Lead konvertert til kundekort",
      note: leadNoteForEntry({ ...entry, lead: updatedLead, customer: savedCustomer }) || "Kundekort opprettet fra lead.",
    });
    selectedLeadId = `lead:${updatedLead.id}`;
    selectedCustomerId = customerKey(savedCustomer);
    currentLeadFilter = "followup";
    if (el.leadStatusFilter) el.leadStatusFilter.value = currentLeadFilter;
    renderAll();
    setView("leads");
    setSyncStatus("Kundekort opprettet fra lead. Du kan nå sette status, opprette ordre eller booke.", "ok");
  }

  function leadTemplateButtons(customer) {
    const key = customerKey(customer);
    return Object.entries(leadTemplates).map(([id, template]) => (
      `<button data-copy-lead-template="${escapeHtml(id)}" data-lead-template-customer="${escapeHtml(key)}" type="button" title="Kopier e-postmalen til utklippstavlen.">${escapeHtml(template.title)}</button>`
    )).join("");
  }

  function leadSourceText(customer) {
    return [customer.source, customer.lead_source, customer.tags]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 220);
  }

  function renderLeadDetail() {
    const entry = selectedLeadEntry();
    const customer = entry?.customer || null;
    if (!customer) {
      el.leadDetail.innerHTML = `<div class="empty-state">Velg en lead.</div>`;
      return;
    }
    const key = customerKey(customer);
    const realCustomer = Boolean(findCustomer(key));
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
      <div class="action-row">
        ${customerActionLinks(customer)}
        ${realCustomer ? `<button data-book-customer="${escapeHtml(key)}" type="button">Book</button>` : ""}
        ${status === "won" && realCustomer ? `<button class="order-primary" data-create-order-from-lead="${escapeHtml(key)}" type="button">Opprett ordre</button>` : ""}
        ${realCustomer ? `<button data-open-lead-customer="${escapeHtml(key)}" type="button">Åpne kundekort</button>` : ""}
        ${!realCustomer && entry?.lead ? `<button class="order-primary" data-create-customer-from-lead="${escapeHtml(leadEntryKey(entry))}" type="button">Opprett kundekort</button>` : ""}
      </div>
      ${!realCustomer && entry?.lead ? leadCustomerMatchHtml(entry) : ""}
      <section class="detail-section">
        <h3>Oppfølging</h3>
        ${realCustomer ? leadStatusControlHtml(customer, status) : `<p class="muted">Denne leaden ligger som henvendelse. Opprett kundekort først når saken er reell og skal følges opp videre.</p>`}
        <div class="lead-status-actions">
          ${realCustomer ? `<button data-lead-set-status="needs_offer" data-lead-status-customer="${escapeHtml(key)}" type="button">Tilbud må sendes</button>
          <button data-lead-set-status="offer_sent" data-lead-status-customer="${escapeHtml(key)}" type="button">Tilbud sendt</button>
          <button data-lead-set-status="won" data-lead-status-customer="${escapeHtml(key)}" type="button">Vunnet</button>
          <button data-lead-set-status="lost" data-lead-status-customer="${escapeHtml(key)}" type="button">Tapt</button>
          <button class="secondary" data-inactivate-lead="${escapeHtml(key)}" type="button">Sett inaktiv</button>` : ""}
        </div>
        <label class="lead-note-editor">Notat
          <textarea data-lead-note-text="${escapeHtml(key)}" rows="4" placeholder="Hva er gjort, hva venter vi på, og hva er neste steg?">${escapeHtml(note)}</textarea>
        </label>
        ${realCustomer ? `<button data-save-lead-note="${escapeHtml(key)}" type="button">Lagre notat</button>` : ""}
      </section>
      <section class="detail-section lead-template-section">
        <h3>E-postmaler</h3>
        <p>Kopierer emne og tekst. Sending kobles på senere når Gmail/Workspace er klart.</p>
        <div class="lead-template-buttons">${leadTemplateButtons(customer)}</div>
      </section>
      <dl class="facts">
        <div><dt>Telefon</dt><dd class="copy-field">${phoneField(customer.phone)}</dd></div>
        <div><dt>E-post</dt><dd class="copy-field">${emailField(customer.email)}</dd></div>
        <div><dt>Kilde/tags</dt><dd>${escapeHtml(leadSourceText(customer) || "Ikke registrert")}</dd></div>
        <div><dt>Merke/modell</dt><dd>${escapeHtml([customer.brand, customer.model_or_note].filter(Boolean).join(" · ") || "Ikke registrert")}</dd></div>
      </dl>
    `;
  }

  function filteredOrders() {
    const search = normalizeMatch(currentOrderSearch);
    const filter = currentOrderFilter || "all";
    return orderRows()
      .filter((row) => {
        const billing = row.order.billingStatus || row.order.billing_status || "not_ready";
        if (filter === "all") return true;
        if (filter === "billing_ready") return billing === "ready";
        if (filter === "invoiced") return billing === "sent" || billing === "paid";
        return row.order.status === filter;
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
        ? `${selectedOrderIds.size} ordre valgt`
        : "Ingen valgt";
    }
  }

  function renderOrders() {
    if (!el.orderList || !el.orderDetail) return;
    currentOrderSearch = el.orderSearch?.value?.trim() || "";
    currentOrderFilter = el.orderStatusFilter?.value || currentOrderFilter || "all";
    const rows = orderRows();
    if (el.orderUnscheduledMetric) el.orderUnscheduledMetric.textContent = rows.filter((row) => row.order.status === "unscheduled").length.toLocaleString("nb-NO");
    if (el.orderScheduledMetric) el.orderScheduledMetric.textContent = rows.filter((row) => row.order.status === "scheduled").length.toLocaleString("nb-NO");
    if (el.orderBillingMetric) el.orderBillingMetric.textContent = rows.filter((row) => (row.order.billingStatus || row.order.billing_status) === "ready").length.toLocaleString("nb-NO");
    if (el.orderCompletedMetric) el.orderCompletedMetric.textContent = rows.filter((row) => row.order.status === "completed").length.toLocaleString("nb-NO");
    const list = filteredOrders();
    const visibleRows = list.slice(0, 250);
    const visibleIds = visibleRows.map((row) => row.id);
    selectedOrderIds = new Set([...selectedOrderIds].filter((id) => orders[id]));
    if (!selectedOrderId || !list.some((row) => row.id === selectedOrderId)) selectedOrderId = list[0]?.id || "";
    el.orderList.innerHTML = "";
    if (!list.length) {
      el.orderList.innerHTML = `<div class="empty-state">Ingen ordre i dette filteret.</div>`;
    }
    for (const row of visibleRows) {
      const item = document.createElement("article");
      item.className = `order-list-row ${row.id === selectedOrderId ? "active" : ""}`;
      item.innerHTML = `
        <label class="order-select" title="Velg ordre for sletting.">
          <input data-order-check="${escapeHtml(row.id)}" type="checkbox" ${selectedOrderIds.has(row.id) ? "checked" : ""} />
          <span>Velg</span>
        </label>
      `;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.orderId = row.id;
      button.innerHTML = `
        <strong>${orderStatusBadge(row.order)}${orderBillingBadge(row.order)}${escapeHtml(row.order.title || orderTitleFromBooking(row.customer, row.order))}</strong>
        <small>${escapeHtml(cleanDisplayName(row.customer))} · ${escapeHtml(orderTypeLabel(row.order.type))} · ${escapeHtml(orderDateText(row.order))}</small>
        <span>${escapeHtml(row.order.note || addressFor(row.customer) || row.customer.location_tag || "Ingen notat").slice(0, 150)}</span>
      `;
      item.appendChild(button);
      el.orderList.appendChild(item);
    }
    updateOrderBulkActions(visibleIds);
    renderOrderDetail();
  }

  function renderOrderDetail() {
    const order = findOrder(selectedOrderId);
    const customer = order ? findCustomer(orderCustomerId(order)) : null;
    if (!order || !customer) {
      el.orderDetail.innerHTML = `<div class="empty-state">Velg en ordre.</div>`;
      return;
    }
    const key = customerKey(customer);
    const linkedBookings = bookingIdsForOrder(order)
      .map((id) => bookingRows().find((row) => row.id === id))
      .filter(Boolean);
    const flow = orderWorkflowState(order, linkedBookings);
    el.orderDetail.innerHTML = `
      <div class="customer-title">
        <div class="title-pills">${orderStatusBadge(order)}${orderBillingBadge(order)}</div>
        <h2>${customerStarHtml(customer, { showEmpty: true })}${customerCashBadgeHtml(customer)}${escapeHtml(order.title || orderTitleFromBooking(customer, order))}</h2>
        <p>${escapeHtml(cleanDisplayName(customer))} · ${escapeHtml(addressFor(customer) || customer.location_tag || "Adresse mangler")}</p>
      </div>
      ${workflowHtml(flow, { title: "Hvor er ordren?" })}
      <div class="action-row">
        ${customerActionLinks(customer)}
        <button data-book-order="${escapeHtml(order.id)}" type="button">Book ordre</button>
        <button data-edit-order="${escapeHtml(order.id)}" type="button">Rediger ordre</button>
        <button class="secondary" data-delete-one-order="${escapeHtml(order.id)}" type="button">Slett ordre</button>
        <button data-open-order-customer="${escapeHtml(key)}" type="button">Åpne kundekort</button>
        ${order.billingStatus === "ready" || order.billing_status === "ready" ? `<button data-mark-order-invoiced="${escapeHtml(order.id)}" type="button">Marker fakturert</button>` : ""}
      </div>
      <dl class="facts">
        <div><dt>Kunde</dt><dd>${escapeHtml(cleanDisplayName(customer))}</dd></div>
        <div><dt>Type</dt><dd>${escapeHtml(orderTypeLabel(order.type))}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(orderStatusLabel(order.status || "unscheduled"))}</dd></div>
        <div><dt>Faktura</dt><dd>${escapeHtml(billingStatusLabel(order.billingStatus || order.billing_status))}</dd></div>
        <div><dt>Dato</dt><dd>${escapeHtml(orderDateText(order))}</dd></div>
        <div><dt>Telefon</dt><dd class="copy-field">${phoneField(customer.phone)}</dd></div>
      </dl>
      <section class="detail-section">
        <h3>Booking</h3>
        ${linkedBookings.length ? `<div class="order-booking-list">${linkedBookings.map((row) => `
          <article>
            <strong>${weekdayDate(row.booking.date, { long: true })} kl. ${escapeHtml(bookingTimeText(row.booking))}</strong>
            <span>${escapeHtml(row.booking.resource || "")} · ${escapeHtml(bookingJobLabel(row))}</span>
            ${workflowInlineHtml(bookingWorkflowState(row, order))}
            <button data-edit-booking="${escapeHtml(row.id)}" type="button">Endre</button>
          </article>
        `).join("")}</div>` : `<div class="empty-state">Ordren er ikke booket ennå.</div>`}
      </section>
      ${order.note ? `<section class="detail-section"><h3>Ordrenotat</h3><div class="note-box">${escapeHtml(order.note).replaceAll("\n", "<br>")}</div></section>` : ""}
    `;
  }

  function renderCustomerOrders(customer) {
    const rows = customerOrders(customer).slice(0, 8);
    if (!rows.length) {
      return `<section class="detail-section"><h3>Ordre / jobber</h3><div class="empty-state">Ingen ordre opprettet ennå. Bruk Ny ordre hvis kunden ringer og vil ha service, befaring eller installasjon direkte.</div></section>`;
    }
    return `
      <section class="detail-section">
        <h3>Ordre / jobber</h3>
        <div class="customer-order-list">
          ${rows.map((order) => `
            <article>
              <div>
                <strong>${orderStatusBadge(order)}${orderBillingBadge(order)}${escapeHtml(order.title || orderTypeLabel(order.type))}</strong>
                <span>${escapeHtml(orderDateText(order))} · ${escapeHtml(billingStatusLabel(order.billingStatus || order.billing_status))}</span>
                ${workflowInlineHtml(orderWorkflowState(order))}
              </div>
              <button data-open-order="${escapeHtml(order.id)}" type="button">Åpne ordre</button>
            </article>
          `).join("")}
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
    el.insulationDocuments.innerHTML = insulationDocuments.map((doc) => `
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
            ${customer.phone ? `<a href="tel:${escapeHtml(phoneForLink(customer.phone))}">Ring</a>${copyPhoneButton(customer.phone, "Kopier")}` : ""}
            ${customer.email ? `<a href="${escapeHtml(emailUrl(customer))}" target="_blank" rel="noreferrer">E-post</a>` : ""}
            <button data-select-insulation-customer="${escapeHtml(key)}" type="button">Velg til tilbud</button>
            <button data-book-insulation-customer="${escapeHtml(key)}" type="button">Book blåsejobb</button>
            <button data-new-insulation-order="${escapeHtml(key)}" type="button">Ny ordre</button>
            <button data-jump-customer="${escapeHtml(key)}" type="button">Kundekort</button>
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

  function setInsulationMode(mode) {
    insulationMode = mode === "rental" ? "rental" : "insulation";
    syncInsulationMode();
  }

  function renderInsulation() {
    syncInsulationMode();
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
    return `Emne: ${template.subject}\n\n${template.body(customer)}`;
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
    if (!visible.length) {
      return `<section class="detail-section"><h3>Varmepumper / anlegg</h3><div class="empty-state">Ingen varmepumpeinfo funnet fra Lime-deals ennå.</div></section>`;
    }
    return `
      <section class="detail-section">
        <h3>Varmepumper / anlegg</h3>
        <div class="installation-list">
          ${visible.map((installation) => {
            const dueKind = statusKindForDueDate(installation.next_service_due);
            const title = [installation.brand, installation.model].filter(Boolean).join(" · ") || "Modell ikke tolket";
            const dates = installationDateFacts(installation);
            const note = String(installation.notes || "").replace(/\n?Kilde:.*$/is, "").trim();
            return `
              <article class="installation-card ${dueKind}">
                <div>
                  <strong>${escapeHtml(installation.label || "Anlegg")}</strong>
                  <span>${escapeHtml(installationKindLabel(installation.kind))}</span>
                </div>
                <p>${escapeHtml(title)}</p>
                ${dates.length ? `<small>${escapeHtml(dates.join(" · "))}</small>` : `<small>Datoer mangler</small>`}
                ${note ? `<details><summary>Vis Lime-info</summary><p>${escapeHtml(note).replaceAll("\n", "<br>")}</p></details>` : ""}
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
    const hasMap = Boolean(mapQuery(customer));
    el.customerDetail.innerHTML = `
      <div class="customer-title">
        <div class="title-pills">
          <span class="status ${statusKind(customer)}">${statusLabel(customer)}</span>
          ${isInsulationCustomer(customer) ? `<span class="soft-pill">Blåseisolering</span>` : ""}
          ${leadBadgeHtml(customer)}
        </div>
        <h2>${isAdmin() ? starToggleHtml(customer) : customerStarHtml(customer, { showEmpty: true })}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</h2>
        <p>${escapeHtml(addressFor(customer) || "Adresse mangler")}</p>
      </div>
      <div class="action-row">
        ${customerActionLinks(customer)}
        ${isAdmin() ? `${!customer.is_inactive ? `<button class="order-primary" data-new-order-customer="${escapeHtml(key)}" type="button" title="Lag serviceordre, installasjonsordre eller annet arbeid direkte fra kundekortet.">Ny ordre</button><button class="book-primary" data-book-customer="${escapeHtml(key)}" type="button">Book</button>` : ""}<button data-edit-customer="${escapeHtml(key)}" type="button">Rediger</button>` : ""}
      </div>
      ${booking ? workflowHtml(bookingWorkflowState(booking), { title: "Aktiv jobbstatus", compact: true }) : ""}
      ${lookupMissingDataSection(customer)}
      ${isAdmin() ? `<div class="customer-controls">${leadStatusControlHtml(customer)}${insulationToggleHtml(customer)}</div>` : ""}
      ${renderDuplicateWarning(customer)}
      ${isLikelyHomeAddress(customer) ? `<section class="detail-section attention compact-warning"><h3>Mulig hjemmeadresse</h3><p>Kunden er tagget med ${escapeHtml(cabinAreaTag(customer) || "hytteområde")}, men adressen ligger i ${escapeHtml(customer.visit_city || "annet sted")}. Bruk koordinater eller kontroller anleggsadresse for rute.</p></section>` : ""}
      <dl class="facts">
        <div><dt>Telefon</dt><dd class="copy-field">${phoneField(customer.phone)}</dd></div>
        <div><dt>E-post</dt><dd class="copy-field">${emailField(customer.email)}</dd></div>
        <div><dt>Postadresse</dt><dd>${escapeHtml(postalAddressFor(customer) || "Ikke registrert")}</dd></div>
        <div><dt>Adkomst</dt><dd>${escapeHtml(accessInfo(customer) || "Ikke registrert")}</dd></div>
        <div><dt>Merke</dt><dd>${escapeHtml(customer.brand || "Ukjent")}</dd></div>
        <div><dt>Modell</dt><dd>${escapeHtml(customer.model_or_note || "Ikke registrert")}</dd></div>
        <div><dt>Installert</dt><dd>${formatDate(customer.first_install_date)}</dd></div>
        <div><dt>Neste service</dt><dd>${formatDate(nextServiceDueForCustomer(customer))}</dd></div>
        <div><dt>Siste service</dt><dd>${escapeHtml(lastServiceText(customer, events))}</dd></div>
        <div><dt>GPS/kart</dt><dd>${escapeHtml(customer.gps_coordinates || customer.google_maps ? "Registrert" : "Ikke registrert")}</dd></div>
        <div><dt>Tags</dt><dd>${escapeHtml(customer.tags || "Ikke registrert")}</dd></div>
        <div><dt>Fakturaer</dt><dd>${invoices.length.toLocaleString("nb-NO")} koblet</dd></div>
        <div><dt>Booking</dt><dd>${booking ? `${formatDate(booking.booking.date)} ${booking.booking.time || ""} · ${escapeHtml(booking.booking.resource || "")}` : "Ikke booket"}</dd></div>
      </dl>
      ${renderInstallationList(customer, installations)}
      ${renderCustomerOrders(customer)}
      ${accessInfo(customer) ? `<section class="detail-section attention"><h3>Adkomst / nøkkel</h3><p>${escapeHtml(accessInfo(customer)).replaceAll("\n", "<br>")}</p></section>` : ""}
      ${renderServiceHistory(events)}
      ${renderInvoiceList(invoices, customer)}
      ${renderNoteSection(customer)}
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

  function renderServiceHistory(events) {
    const visible = (events || []).slice(0, 6);
    if (!visible.length) {
      return `<section class="detail-section"><h3>Historikk / servicepåminnelser</h3><div class="empty-state">Ingen historikk importert på denne kunden ennå.</div></section>`;
    }
    return `
      <section class="detail-section">
        <h3>Historikk / servicepåminnelser</h3>
        <div class="timeline-list">
          ${visible.map((event) => `
            <article>
              <time>${formatDate(event.event_date)}</time>
              <strong>${escapeHtml(event.event_type || "Historikk")}</strong>
              <p>${escapeHtml(shortEventNote(event.note || "")).replaceAll("\n", "<br>")}</p>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function shortEventNote(note) {
    return String(note || "")
      .replace(/\n?Kilde:.*$/is, "")
      .replace(/Service burde vært gjort \/ følges opp\.\s*/i, "")
      .trim()
      .slice(0, 360);
  }

  function renderInvoiceList(invoices, customer) {
    const visible = (invoices || []).slice(0, 6);
    const paymentBlock = isAdmin() && customer ? `
      <div class="invoice-payment-row">
        <div>
          <strong>Betaling</strong>
          <span>Faktura er standard. Bruk Cash bare når kunden normalt betaler kontant.</span>
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
      column.className = `planning-day ${today ? "today" : ""}`;
      column.dataset.planningDate = dayIso;
      column.innerHTML = `
        <div class="day-head">
          <strong>${new Intl.DateTimeFormat("nb-NO", { weekday: "short" }).format(day)}</strong>
          <span>${formatDate(dayIso)}</span>
          ${today ? `<small>I dag</small>` : ""}
          <em>${dayRows.length} jobb${dayRows.length === 1 ? "" : "er"}</em>
        </div>
        <div class="drop-hint">Slipp her for å flytte jobben til ${formatDate(dayIso)}</div>
        ${planningDayTimeline(dayRows)}
        <div class="day-jobs"></div>
      `;
      const list = column.querySelector(".day-jobs");
      if (!dayRows.length) list.innerHTML = `<div class="empty-state">Ledig</div>`;
      for (const row of dayRows) list.appendChild(jobCard(row, true));
      el.planningBoard.appendChild(column);
    }
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

  function planningDayTimeline(rows) {
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
      const draggable = Boolean(isAdmin() && !done);
      const overlap = bookingOverlapForRow(row, sorted);
      const needsMove = bookingNeedsMove(row);
      const paymentMode = bookingPaymentMode(row);
      const statusBits = [];
      if (overlap) statusBits.push("Overlapp");
      if (needsMove) statusBits.push("Må flyttes");
      if (done) statusBits.push("Utført");
      if (bookingNeedsInvoice(row)) statusBits.push("Må faktureres");
      if (bookingNeedsCashPayment(row)) statusBits.push("Cash ikke registrert");
      if (paymentMode === "invoice") statusBits.push("Fakturert");
      if (paymentMode === "cash") statusBits.push("Betalt cash");
      if (bookingNeedsCompletion(row)) statusBits.push("Dato passert");
      const statusText = statusBits.join(" · ");
      const title = `${statusText ? `${statusText}: ` : ""}${bookingJobLabel(row)} ${timeRangeText(bookingRowStartMinutes(row), bookingRowEndMinutes(row))}: ${cleanDisplayName(row.customer)}`;
      return `
        <article
          class="timeline-event ${escapeHtml(type)} ${done ? "done" : ""} ${needsMove ? "needs-move" : ""} ${overlap ? "overlap" : ""}"
          style="top:${top.toFixed(2)}%;height:${height.toFixed(2)}%"
          data-customer-id="${escapeHtml(customerKey(row.customer))}"
          data-booking-id="${escapeHtml(row.id)}"
          draggable="${draggable ? "true" : "false"}"
          title="${escapeHtml(title)}"
        >
          <strong>${timeRangeText(bookingRowStartMinutes(row), bookingRowEndMinutes(row))}</strong>
          <span>${escapeHtml(bookingJobLabel(row))} · ${escapeHtml(cleanDisplayName(row.customer))}</span>
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
    const needsMove = bookingNeedsMove(row);
    const moveReason = bookingMoveReason(row);
    const overlap = bookingOverlapForRow(row);
    const type = bookingDisplayType(row);
    const paymentMode = bookingPaymentMode(row);
    const linkedOrder = linkedOrderForBooking(row.id) || findOrder(row.booking.orderId);
    const flow = bookingWorkflowState(row, linkedOrder);
    const paymentActionLabel = row.customer?.pays_cash ? "Betalt cash" : "Fakturert";
    const paymentActionTitle = row.customer?.pays_cash
      ? "Marker at cash er mottatt for denne jobben."
      : "Marker at faktura er sendt manuelt i eAccounting.";
    const headerParts = options.showDate
      ? [weekdayDate(row.booking.date, { long: true }), `kl. ${bookingTimeText(row.booking)}`, row.booking.resource || "", bookingJobLabel(row)]
      : [bookingTimeText(row.booking), row.booking.resource || "", bookingJobLabel(row)];
    card.className = `job-card ${type} ${done ? "done" : ""} ${needsMove ? "needs-move" : ""} ${overlap ? "overlap" : ""}`;
    card.dataset.bookingId = row.id;
    card.dataset.customerId = customerKey(row.customer);
    card.draggable = Boolean(editable && isAdmin() && !done);
    card.title = card.draggable
      ? "Dra jobben til en annen dag i kalenderen. Klokkeslett og tekniker beholdes."
      : done
        ? "Utført jobb kan ikke flyttes med dra-og-slipp."
        : "Åpne kundekort eller bruk knappene for å endre jobben.";
    card.innerHTML = `
      <span class="job-meta">${escapeHtml(headerParts.filter(Boolean).join(" · "))}</span>
      ${done ? `<span class="done-pill">Utført</span>` : ""}
      ${overlap ? `<span class="invoice-pill overlap">Overlapp</span>` : ""}
      ${needsMove ? `<span class="invoice-pill move">Må flyttes</span>` : ""}
      ${bookingNeedsCompletion(row) ? `<span class="invoice-pill overdue">Dato passert - fullfør</span>` : ""}
      ${bookingNeedsInvoice(row) ? `<span class="invoice-pill">Må faktureres</span>` : ""}
      ${bookingNeedsCashPayment(row) ? `<span class="invoice-pill">Cash ikke registrert</span>` : ""}
      ${paymentMode === "invoice" ? `<span class="invoice-pill invoiced">Fakturert</span>` : ""}
      ${paymentMode === "cash" ? `<span class="invoice-pill paid">Betalt cash</span>` : ""}
      <strong>${customerStarHtml(row.customer)}${customerCashBadgeHtml(row.customer)}${escapeHtml(cleanDisplayName(row.customer))}</strong>
      ${workflowInlineHtml(flow)}
      <span class="job-type-pill ${escapeHtml(type)}">${escapeHtml(bookingJobLabel(row))}</span>
      <small>${escapeHtml(addressFor(row.customer) || row.customer.location_tag || row.customer.visit_city || "Adresse mangler")}</small>
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
        ${editable && isAdmin() && !done && !needsMove ? `<button data-move-booking="${escapeHtml(row.id)}" type="button" title="Marker at jobben må flyttes fordi kunden ikke var tilgjengelig, dere ikke kom inn, eller tidspunkt må avtales på nytt.">Må flyttes</button>` : ""}
        ${editable && isAdmin() && bookingNeedsPaymentAction(row) ? `<button data-billing-booking="${escapeHtml(row.id)}" type="button" title="${escapeHtml(paymentActionTitle)}">${escapeHtml(paymentActionLabel)}</button>` : ""}
        ${editable && isAdmin() ? `<button data-delete-booking="${escapeHtml(row.id)}" type="button" title="Fjern bookingen fra planning uten å slette kundehistorikk.">Fjern</button>` : ""}
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
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
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

  function downloadDayPlan() {
    const text = dayPlanText();
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `dagsplan-${isoDate(new Date())}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSyncStatus(`Dagsplan lastet ned (${todaysPersonalRows().length} jobber).`, "ok");
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
    const hasMap = Boolean(mapQuery(customer));
    el.customerQuickContent.innerHTML = `
      ${bookingRow ? bookingQuickFocusHtml(bookingRow, linkedOrder) : ""}
      <div class="quick-title">
        <span class="status ${statusKind(customer)}">${statusLabel(customer)}</span>
        <h3>${isAdmin() ? starToggleHtml(customer) : customerStarHtml(customer, { showEmpty: true })}${customerCashBadgeHtml(customer)}${escapeHtml(cleanDisplayName(customer))}</h3>
        <p>${escapeHtml(addressFor(customer) || "Adresse mangler")}</p>
      </div>
      <div class="action-row">${customerActionLinks(customer)}${isAdmin() && !customer.is_inactive ? `<button class="order-primary" data-new-order-customer="${escapeHtml(key)}" type="button">Ny ordre</button><button class="book-primary" data-book-customer="${escapeHtml(key)}" type="button">Book</button>` : ""}</div>
      ${lookupMissingDataSection(customer, true)}
      ${isLikelyHomeAddress(customer) ? `<section class="quick-block attention"><strong>Mulig hjemmeadresse</strong><p>Tagg/område tyder på hytte/anlegg, men adressen kan være hjemmeadresse. Kontroller koordinater for rute.</p></section>` : ""}
      ${isAdmin() ? `<div class="customer-controls compact">${insulationToggleHtml(customer)}</div>` : ""}
      <dl class="quick-facts">
        <div><dt>Telefon</dt><dd class="copy-field">${phoneField(customer.phone)}</dd></div>
        <div><dt>E-post</dt><dd class="copy-field">${emailField(customer.email)}</dd></div>
        <div><dt>Postadresse</dt><dd>${escapeHtml(postalAddressFor(customer) || "Ikke registrert")}</dd></div>
        <div><dt>Merke/modell</dt><dd>${escapeHtml([customer.brand, customer.model_or_note].filter(Boolean).join(" · ") || "Ikke registrert")}</dd></div>
        <div><dt>Neste service</dt><dd>${formatDate(nextServiceDueForCustomer(customer))}</dd></div>
        <div><dt>Siste service</dt><dd>${escapeHtml(lastServiceText(customer, events))}</dd></div>
        <div><dt>Betaling</dt><dd>${customer.pays_cash ? "Cash" : "Faktura"}</dd></div>
        <div><dt>Tags</dt><dd>${escapeHtml(customer.tags || "Ikke registrert")}</dd></div>
        <div><dt>Fakturaer</dt><dd>${invoices.length.toLocaleString("nb-NO")} koblet</dd></div>
      </dl>
      ${renderInstallationList(customer, installations)}
      ${accessInfo(customer) ? `<section class="quick-block attention"><strong>Adkomst / nøkkel</strong><p>${escapeHtml(accessInfo(customer)).replaceAll("\n", "<br>")}</p></section>` : ""}
      ${customer.local_note ? `<section class="quick-block"><strong>Notat</strong><p>${escapeHtml(customer.local_note)}</p></section>` : ""}
      <div class="quick-actions">
        <button data-jump-customer="${escapeHtml(key)}" type="button">Åpne kundekort</button>
        ${isAdmin() && !customer.is_inactive ? `<button class="secondary" data-new-order-customer="${escapeHtml(key)}" type="button">Ny ordre</button>` : ""}
        ${isAdmin() ? `<button class="secondary" data-edit-customer="${escapeHtml(key)}" type="button">Rediger kunde</button>` : ""}
        ${bookingId && isAdmin() ? `<button class="secondary" data-edit-booking="${escapeHtml(bookingId)}" type="button">Endre booking</button>` : ""}
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

  function renderTechnician() {
    if (!el.technicianDate.value) el.technicianDate.value = isoDate(new Date());
    const rows = personalRowsForDate(el.technicianDate.value);
    if (el.technicianHeading) el.technicianHeading.textContent = `${currentUser?.name || "Min"} sin dagsplan`;
    if (el.technicianRouteButton) el.technicianRouteButton.disabled = !googleDirectionsUrlForRows(rows);
    el.technicianJobs.innerHTML = "";
    if (!rows.length) {
      el.technicianJobs.innerHTML = `<div class="empty-state">Ingen jobber for ${escapeHtml(currentUser?.name || "deg")} denne dagen.</div>`;
      return;
    }
    for (const row of rows) {
      const card = jobCard(row, false);
      const done = row.booking.status === "done" || doneJobs.has(row.id);
      const needsMove = bookingNeedsMove(row);
      const doneButton = document.createElement("button");
      doneButton.type = "button";
      doneButton.dataset.doneBooking = row.id;
      doneButton.textContent = done ? "Utført" : "Marker ferdig";
      if (done && !isAdmin()) {
        doneButton.disabled = true;
        doneButton.title = "Jobben er markert utført. Kontakt admin hvis dette må angres.";
      }
      card.querySelector(".job-actions").appendChild(doneButton);
      if (!done && !needsMove) {
        const moveButton = document.createElement("button");
        moveButton.type = "button";
        moveButton.dataset.moveBooking = row.id;
        moveButton.title = "Marker at jobben må flyttes fordi kunden ikke var tilgjengelig eller dere ikke kom inn.";
        moveButton.textContent = "Må flyttes";
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
    el.formAccess.value = customer ? accessInfo(customer) : "";
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
  }

  function customerFormValues() {
    const tags = nextTagsWithInsulation(el.formTags.value.trim(), Boolean(el.formInsulation.checked));
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

  function openBookingDialog(customerId, bookingId, options = {}) {
    editingBookingId = bookingId || "";
    const booking = bookings[bookingId] || null;
    const selectedId = booking?.customerId || customerId || "";
    const selectedCustomer = findCustomer(selectedId);
    bookingSelectedCustomerId = selectedCustomer ? customerKey(selectedCustomer) : "";
    bookingPendingOrderId = options.orderId || booking?.orderId || linkedOrderForBooking(bookingId)?.id || "";
    clearBookingDialogMessage();
    setSyncStatus("", "");
    el.bookingCustomerSearch.value = selectedCustomer ? searchDisplayText(selectedCustomer) : "";
    setBookingCustomerSelection(selectedCustomer);
    closeBookingCustomerResults();
    el.bookingDate.value = booking?.date || isoDate(new Date());
    el.bookingTime.value = normalizeBookingTime(booking?.time, "09:00");
    const dialogType = serviceWorkType(booking?.type || options.type) ? "reparasjon" : (booking?.type || options.type || "service");
    el.bookingType.value = dialogType;
    el.bookingDuration.value = booking?.duration || defaultBookingDuration(el.bookingType.value);
    el.bookingResource.value = booking?.resource || "Hubert";
    el.bookingNote.value = cleanBookingNote(booking?.note || options.note || "");
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

  function setBookingCustomerSelection(customer) {
    if (!customer) {
      bookingSelectedCustomerId = "";
      el.bookingCustomer.innerHTML = `<option value="">Velg kunde</option>`;
      el.bookingCustomer.value = "";
      return;
    }
    const key = customerKey(customer);
    bookingSelectedCustomerId = key;
    el.bookingCustomer.innerHTML = `<option value="${escapeHtml(key)}">${escapeHtml(bookingOptionLabel(customer))}</option>`;
    el.bookingCustomer.value = key;
    el.bookingCustomerSearch.value = searchDisplayText(customer);
  }

  function renderBookingCustomerResults(searchText = "", selectedId = bookingSelectedCustomerId) {
    const selectedCustomer = selectedId ? findCustomer(selectedId) : null;
    if (selectedCustomer && searchText === searchDisplayText(selectedCustomer)) {
      setBookingCustomerSelection(selectedCustomer);
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
    const rows = bookingRows()
      .filter((row) => row.booking.date === date)
      .sort((a, b) => bookingRowStartMinutes(a) - bookingRowStartMinutes(b));
    const slots = freeSlotsForDay(rows);
    const jobHtml = rows.length ? rows.map((row) => `
      <article class="day-agenda-job ${escapeHtml(bookingDisplayType(row))}">
        <strong>${timeRangeText(bookingRowStartMinutes(row), bookingRowEndMinutes(row))} · ${escapeHtml(bookingJobLabel(row))}</strong>
        <span>${escapeHtml(cleanDisplayName(row.customer))} · ${escapeHtml(siteLocationText(row.customer) || "Adresse mangler")}</span>
      </article>
    `).join("") : `<div class="empty-state">Ingen jobber booket denne dagen.</div>`;
    const slotHtml = slots.length ? slots.map((slot) => `
      <span class="free-slot">${timeRangeText(slot.start, slot.end)} ledig</span>
    `).join("") : `<span class="free-slot busy">Ingen tydelige ledige hull 08-18</span>`;
    el.bookingDayAgenda.innerHTML = `
      <div class="day-agenda-head">
        <strong>${formatDate(date)}</strong>
        <span>${rows.length} jobb${rows.length === 1 ? "" : "er"}</span>
      </div>
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
    const paymentMarker = markerText(existing?.note, paymentMarkerRegex());
    const note = [
      el.bookingNote.value.trim(),
      paymentMarker,
    ].filter(Boolean).join("\n");
    return {
      customerId: el.bookingCustomer.value,
      date: el.bookingDate.value,
      time: normalizeBookingTime(el.bookingTime.value),
      type: el.bookingType.value,
      duration: el.bookingDuration.value,
      resource: el.bookingResource.value,
      note,
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
      setSyncStatus("Kunde lagret i Supabase.", "ok");
    } else if (editingCustomerId) {
      requireLocalDemoStorage();
      const customer = findCustomer(editingCustomerId);
      Object.assign(customer, values);
      customerEdits[editingCustomerId] = { ...(customerEdits[editingCustomerId] || {}), ...values };
      selectedCustomerId = editingCustomerId;
      saveLocalEdits();
    } else {
      requireLocalDemoStorage();
      const customer = { lime_id: `manual-${Date.now()}`, source: "Manuell", ...values };
      customers.unshift(customer);
      customerEdits[customer.lime_id] = customer;
      selectedCustomerId = customer.lime_id;
      saveLocalEdits();
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
    if (!values.customerId) throw new Error("Velg en kunde før du lagrer booking.");
    const conflict = bookingConflict(values, editingBookingId);
    if (conflict) {
      throw new Error(`Konflikt: ${conflict.booking.resource || "Ansatt"} er allerede booket ${formatDate(conflict.booking.date)} kl. ${bookingTimeText(conflict.booking)} hos ${cleanDisplayName(conflict.customer)}.`);
    }
    const savedMessage = store.isConfigured ? "Booking lagret i Supabase." : "Booking lagret i lokal utviklingsdemo.";
    let savedId = editingBookingId;
    if (store.isConfigured) {
      const saved = await store.saveBooking(editingBookingId, values);
      bookings[saved.id] = saved.booking;
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
        note: order.note || cleanBookingNote(values.note || ""),
      }, [...bookingIdsForOrder(order), savedId]);
      const savedOrder = await saveOrderRecord(order.id, scheduledOrder, { quiet: true });
      if (bookings[savedId]) {
        bookings[savedId].orderId = savedOrder.id;
        if (!store.isConfigured) saveLocalBookings();
      }
    } else {
      await ensureOrderForBooking(savedId, bookings[savedId] || values);
    }
    bookingPendingOrderId = "";
    if (values.date) weekStart = startOfWeek(new Date(`${values.date}T00:00:00`));
    el.bookingDialog.close();
    renderAll();
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
      message: `Booke ${drafts.length} servicejobber som utkast på ${formatDate(drafts[0].date)}?\n\nDette legger jobbene i planningboardet og oppretter ordreutkast på kundene.`,
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
      ${order ? `<p>Koblet til ordre: ${escapeHtml(order.title || "Ordre")}</p>` : `<p>Ingen tilknyttet ordre funnet. Kun bookingen fjernes fra kalenderen.</p>`}
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
    setSyncStatus(deleteLinkedOrder ? "Booking og tilknyttet ordre slettet." : "Booking fjernet fra kalenderen.", "ok");
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
        ["book_installation", "Book installasjon etterpå"],
        ["offer_followup", "Tilbud/oppfølging senere"],
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

  function openCompletionDialog(id) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row) return;
    completingBookingId = id;
    completionFollowupBooking = null;
    const type = bookingDisplayType(row);
    el.completionTitle.textContent = `Fullfør ${bookingJobLabel(row).toLowerCase()}`;
    el.completionSummary.innerHTML = `
      <strong>${customerStarHtml(row.customer)}${customerCashBadgeHtml(row.customer)}${escapeHtml(cleanDisplayName(row.customer))}</strong>
      <span>${formatDate(row.booking.date)} kl. ${escapeHtml(bookingTimeText(row.booking))} · ${escapeHtml(row.booking.resource || "")}</span>
      <em>${escapeHtml(bookingWorkKind(row).help)}</em>
      ${row.booking.note ? `<p>${escapeHtml(row.booking.note)}</p>` : ""}
    `;
    el.completionDoneDate.value = row.booking.date || isoDate(new Date());
    const nextOptions = isAdmin() ? completionOptions(type) : [["none", "Ingen neste steg nå"]];
    el.completionNextAction.innerHTML = nextOptions
      .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
      .join("");
    el.completionInterval.value = "2";
    el.completionNextDate.value = type === "befaring" || serviceWorkType(type) ? "" : addYearsIso(el.completionDoneDate.value, 2);
    setupCompletionInstallationField(row);
    setupCompletionPaymentFields(row);
    el.completionNote.value = "";
    syncCompletionFields();
    el.completionDialog.showModal();
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
    const installations = relevant ? installationsForCustomer(row.customer) : [];
    el.completionInstallation.innerHTML = "";
    if (!installations.length) {
      el.completionInstallationLabel.classList.add("hidden");
      return;
    }
    const options = [
      `<option value="">Kundekortets hovedfrist</option>`,
      ...installations.map((installation) => `<option value="${escapeHtml(installation.id || "")}">${escapeHtml(installationDisplayName(installation))}</option>`),
    ];
    el.completionInstallation.innerHTML = options.join("");
    const dueInstallation = installations.find((installation) => installation.next_service_due === nextServiceDueForCustomer(row.customer)) || installations[0];
    el.completionInstallation.value = dueInstallation?.id || "";
    el.completionInstallationLabel.classList.toggle("hidden", installations.length < 2 && !dueInstallation);
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
      ? "Cash er mottatt"
      : "Faktura er sendt";
    const labelSpan = el.completionPaymentDoneLabel.querySelector("span");
    if (labelSpan) labelSpan.textContent = labelText;
    if (el.completionPaymentHint) {
      el.completionPaymentHint.textContent = row.customer?.pays_cash
        ? "La stå av hvis jobben er utført, men cash ikke er mottatt ennå."
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

  async function moveBookingToDate(id, targetDate) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row) throw new Error("Fant ikke bookingen som skulle flyttes.");
    if (row.booking.status === "done" || doneJobs.has(id)) {
      throw new Error("Utførte jobber kan ikke flyttes direkte. Angre fullføring først hvis datoen er feil.");
    }
    if (!targetDate || row.booking.date === targetDate) return;
    const updated = {
      ...row.booking,
      date: targetDate,
      needs_move: false,
      note: noteWithoutMoveMarker(row.booking.note),
      status: row.booking.status || "booked",
    };
    const conflict = bookingConflict(updated, id);
    if (conflict) {
      throw new Error(`Kan ikke flytte: ${conflict.booking.resource || "Ansatt"} er allerede booket ${formatDate(conflict.booking.date)} kl. ${bookingTimeText(conflict.booking)} hos ${cleanDisplayName(conflict.customer)}.`);
    }
    const saved = await saveBookingRecord(id, updated);
    const savedId = saved.id || id;
    await ensureOrderForBooking(savedId, bookings[savedId] || updated, {
      status: "scheduled",
      scheduledDate: targetDate,
      scheduledTime: updated.time,
    });
    renderAll();
    setSyncStatus(`Booking flyttet til ${formatDate(targetDate)}.`, "ok");
  }

  function billingModeLabel(mode) {
    return mode === "cash" ? "Betalt cash" : "Fakturert";
  }

  function billingModeMarker(mode, date) {
    return mode === "cash" ? `[Betalt cash ${date}]` : `[Fakturert ${date}]`;
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
    const updatedBooking = {
      ...row.booking,
      note: [cleanBookingNote(row.booking.note), marker, paymentNote].filter(Boolean).join("\n"),
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
        `Installasjon ${mode === "cash" ? "betalt cash" : "fakturert"} ${formatDate(billingDate)}. Neste service satt til ${formatDate(customer.next_service_due)} basert på installasjonsdato ${formatDate(installDate)}.`,
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
        `${bookingJobLabel(row)} markert ${mode === "cash" ? "betalt cash" : "fakturert"}.`,
        `Jobbdato/installasjonsdato: ${formatDate(installDate)}.`,
        userNote,
      ].filter(Boolean).join(" "),
    });
    await markOrderBillingForBooking(id, mode === "cash" ? "paid" : "sent", billingDate);
    renderAll();
    setSyncStatus(mode === "cash" ? "Jobb markert betalt cash og kundekort oppdatert." : "Jobb markert fakturert og kundekort oppdatert.", "ok");
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
    const mode = el.billingMode.value === "cash" ? "cash" : "invoice";
    if (mode === "cash") {
      el.billingTitle.textContent = "Marker betalt cash";
      el.billingHint.textContent = "Bruk bare når cash faktisk er mottatt. Jobben lagres som betalt, ikke fakturert.";
      el.saveBillingButton.textContent = "Marker betalt cash";
    } else {
      el.billingTitle.textContent = "Marker faktura sendt";
      el.billingHint.textContent = "Bruk etter at faktura er sendt manuelt i eAccounting. Dette oppdaterer kundehistorikk og ordre.";
      el.saveBillingButton.textContent = "Marker fakturert";
    }
  }

  function openBillingDialog(id) {
    const row = bookingRows().find((item) => item.id === id);
    if (!row || !el.billingDialog) return;
    billingDialogBookingId = id;
    const defaultMode = defaultBillingModeForRow(row);
    el.billingMode.value = defaultMode;
    el.billingDate.value = isoDate(new Date());
    el.billingNote.value = "";
    el.billingSummary.innerHTML = `
      <strong>${customerStarHtml(row.customer)}${customerCashBadgeHtml(row.customer)}${escapeHtml(cleanDisplayName(row.customer))}</strong>
      <span>${escapeHtml(bookingJobLabel(row))} · Jobbdato ${formatDate(row.booking.date)} kl. ${escapeHtml(bookingTimeText(row.booking))} · ${escapeHtml(row.booking.resource || "")}</span>
      <em>${escapeHtml(bookingWorkKind(row).billing)}</em>
      <p>${defaultMode === "cash" ? "Kunden er merket som cashkunde. Velg faktura hvis denne jobben likevel skal faktureres." : "Faktura er standard. Velg cash bare hvis dette faktisk ble betalt kontant."}</p>
    `;
    clearBillingDialogMessage();
    syncBillingDialogText();
    el.billingDialog.showModal();
  }

  async function saveBillingFromDialog() {
    if (!billingDialogBookingId) throw new Error("Fant ikke jobben som skulle oppdateres.");
    const mode = el.billingMode.value === "cash" ? "cash" : "invoice";
    await markBookingPaymentDone(billingDialogBookingId, {
      mode,
      date: el.billingDate.value || isoDate(new Date()),
      note: el.billingNote.value,
    });
    billingDialogBookingId = "";
    el.billingDialog.close();
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
    const selectedInstallationId = el.completionInstallation?.value || "";
    const selectedInstallation = selectedInstallationId
      ? installationsForCustomer(customer).find((installation) => String(installation.id || "") === String(selectedInstallationId))
      : null;
    const eventLines = [
      `${bookingJobLabel(row)} fullført ${formatDate(doneDate)}.`,
      selectedInstallation ? `Anlegg: ${installationDisplayName(selectedInstallation)}.` : "",
      paymentDone ? (customer.pays_cash ? "Cash markert mottatt ved fullføring." : "Faktura markert ferdig/sendt ved fullføring.") : "",
      userNote,
    ].filter(Boolean);
    const useAdminCompletionRpc = store.isConfigured && isAdmin() && store.completeBookingAsAdmin;

    if (store.isConfigured && !isAdmin()) {
      await setBookingDone(completingBookingId, true, {
        completedAt: doneDate,
        note: eventLines.join("\n"),
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
        completionFollowupBooking = {
          customerId: customerKey(customer),
          note: `Installasjon etter befaring ${formatDate(doneDate)}.${userNote ? `\n${userNote}` : ""}`,
        };
      } else if (nextAction === "offer_followup") {
        customerNoteLine = `Befaring fullført ${formatDate(doneDate)}. Trenger tilbud/oppfølging.${userNote ? ` ${userNote}` : ""}`;
        customer.local_note = appendCustomerNote(customer, customerNoteLine);
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
      note: [cleanBookingNote(row.booking.note), completionPaymentMarker].filter(Boolean).join("\n"),
      invoiced: paymentDone && completionPaymentMode === "invoice" ? true : row.booking.invoiced,
      paid_cash: paymentDone && completionPaymentMode === "cash" ? true : row.booking.paid_cash,
    };
    const completionEventType = `${bookingJobLabel(row)} fullført`;
    const completionEventNote = eventLines.join("\n");
    const orderNote = userNote || cleanBookingNote(row.booking.note || "");

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
      updateCustomerInMemory(customer);
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
      renderAll();
      setSyncStatus("Jobb fullført og kundekort oppdatert.", "ok");
      if (shouldOpenInstallation) {
        openBookingDialog(shouldOpenInstallation.customerId);
        el.bookingType.value = "installasjon";
        el.bookingDuration.value = "180";
        el.bookingResource.value = "Hubert";
        el.bookingNote.value = shouldOpenInstallation.note;
        renderBookingMonth();
      }
      return;
    }

    await saveCustomerAfterCompletion(customer);
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
    renderAll();
    setSyncStatus("Jobb fullført og kundekort oppdatert.", "ok");
    if (shouldOpenInstallation) {
      openBookingDialog(shouldOpenInstallation.customerId);
      el.bookingType.value = "installasjon";
      el.bookingDuration.value = "180";
      el.bookingResource.value = "Hubert";
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
  document.querySelectorAll("nav button").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
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
      currentLeadFilter = "followup";
      if (el.leadStatusFilter) el.leadStatusFilter.value = currentLeadFilter;
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
  document.querySelectorAll("[data-order-filter-shortcut]").forEach((button) => button.addEventListener("click", () => {
    currentOrderFilter = button.dataset.orderFilterShortcut || "all";
    if (el.orderStatusFilter) el.orderStatusFilter.value = currentOrderFilter;
    setView("orders");
  }));

  el.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    el.loginMessage.textContent = "Logger inn...";
    try {
      await store.signIn(el.loginEmail.value.trim(), el.loginPassword.value);
      currentView = "";
      const loaded = await refreshData("Innlogget.");
      if (loaded) el.loginMessage.textContent = "";
    } catch (error) {
      el.loginMessage.textContent = error.message || "Klarte ikke logge inn.";
    }
  });

  el.logoutButton.addEventListener("click", async () => {
    if (store.isConfigured) await store.signOut();
    currentUser = null;
    localStorage.removeItem(storage.user);
    renderApp();
  });

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
      setSyncStatus("Skjermbilde lagt ved. OCR/bildeanalyse kommer i serverfasen.", "ok");
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
      if (actionSelect && actionSelect.value === "append_existing") actionSelect.value = "create_lead";
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

  el.newCustomerButton.addEventListener("click", () => openCustomerDialog(""));
  el.newBookingButton.addEventListener("click", () => openBookingDialog(""));
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
    currentLeadFilter = el.leadStatusFilter.value;
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
  });
  el.websiteSubmissionInbox?.addEventListener("click", (event) => {
    const createServiceOrder = event.target.closest("[data-create-website-service-order]");
    if (createServiceOrder) {
      createServiceOrderFromWebsiteSubmission(createServiceOrder.dataset.createWebsiteServiceOrder)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke lage serviceordre fra nettsideinnsending.", "error"));
      return;
    }
    const createLead = event.target.closest("[data-create-website-lead]");
    if (createLead) {
      createLeadFromWebsiteSubmission(createLead.dataset.createWebsiteLead)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke lage lead fra nettsideinnsending.", "error"));
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
  });
  el.customerDetail.addEventListener("click", (event) => {
    const payment = event.target.closest("[data-payment-mode]");
    if (payment) {
      setCustomerPaymentMode(payment.dataset.paymentCustomer, payment.dataset.paymentMode)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre betaling.", "error"));
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
    const newOrder = event.target.closest("[data-new-order-customer]");
    if (newOrder) {
      openOrderDialog(newOrder.dataset.newOrderCustomer);
      return;
    }
    const book = event.target.closest("[data-book-customer]");
    if (book) {
      openBookingDialog(book.dataset.bookCustomer);
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
    setLeadStatus(select.dataset.leadStatusCustomer, select.value)
      .catch((error) => setSyncStatus(error.message || "Klarte ikke endre leadstatus.", "error"));
  });
  el.leadDetail?.addEventListener("change", (event) => {
    const select = event.target.closest("[data-lead-status-customer]");
    if (!select) return;
    setLeadStatus(select.dataset.leadStatusCustomer, select.value)
      .catch((error) => setSyncStatus(error.message || "Klarte ikke endre leadstatus.", "error"));
  });
  el.leadDetail?.addEventListener("click", (event) => {
    const statusButton = event.target.closest("[data-lead-set-status]");
    if (statusButton) {
      setLeadStatus(statusButton.dataset.leadStatusCustomer, statusButton.dataset.leadSetStatus)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre leadstatus.", "error"));
      return;
    }
    const template = event.target.closest("[data-copy-lead-template]");
    if (template) {
      copyLeadTemplate(template.dataset.copyLeadTemplate, template.dataset.leadTemplateCustomer)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke kopiere e-postmal.", "error"));
      return;
    }
    const saveNote = event.target.closest("[data-save-lead-note]");
    if (saveNote) {
      const customerId = saveNote.dataset.saveLeadNote;
      const textarea = el.leadDetail.querySelector(`[data-lead-note-text="${CSS.escape(customerId)}"]`);
      saveLeadNote(customerId, textarea?.value || "")
        .catch((error) => setSyncStatus(error.message || "Klarte ikke lagre leadnotat.", "error"));
      return;
    }
    const inactivate = event.target.closest("[data-inactivate-lead]");
    if (inactivate) {
      setLeadInactive(inactivate.dataset.inactivateLead)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke sette lead inaktiv.", "error"));
      return;
    }
    const createOrder = event.target.closest("[data-create-order-from-lead]");
    if (createOrder) {
      createOrderFromLead(createOrder.dataset.createOrderFromLead)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke opprette ordre.", "error"));
      return;
    }
    const createCustomer = event.target.closest("[data-create-customer-from-lead]");
    if (createCustomer) {
      createCustomerFromLead(createCustomer.dataset.createCustomerFromLead)
        .catch((error) => setSyncStatus(error.message || "Klarte ikke opprette kundekort fra lead.", "error"));
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
    if (book) openBookingDialog(book.dataset.bookCustomer);
  });
  el.orderDetail?.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-order-customer]");
    if (open) {
      openCustomerCard(open.dataset.openOrderCustomer);
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
    const bookOrder = event.target.closest("[data-book-order]");
    if (bookOrder) {
      const order = findOrder(bookOrder.dataset.bookOrder);
      const customer = order ? findCustomer(orderCustomerId(order)) : null;
      if (!order || !customer) return;
      openBookingDialog(customerKey(customer), "", {
        orderId: order.id,
        type: order.type || "service",
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
          setSyncStatus("Ordre markert fakturert.", "ok");
        })
        .catch((error) => setSyncStatus(error.message || "Klarte ikke markere ordre fakturert.", "error"));
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
  el.insulationCopyOfferTextButton?.addEventListener("click", () => {
    copyInsulationOfferDraft().catch((error) => setSyncStatus(error.message || "Klarte ikke kopiere tilbud.", "error"));
  });
  el.insulationClearButton?.addEventListener("click", clearInsulationCalc);
  el.insulationCustomerSearch?.addEventListener("input", renderInsulationCustomers);
  el.insulationNewCustomerButton?.addEventListener("click", () => openCustomerDialog("", { insulation: true }));
  el.insulationCustomers?.addEventListener("click", (event) => {
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
    const payment = event.target.closest("[data-payment-mode]");
    if (payment) {
      setCustomerPaymentMode(payment.dataset.paymentCustomer, payment.dataset.paymentMode)
        .then(() => {
          if (el.customerQuickDialog.open) openCustomerQuickPanel(payment.dataset.paymentCustomer, "");
        })
        .catch((error) => setSyncStatus(error.message || "Klarte ikke endre betaling.", "error"));
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
      openBookingDialog(book.dataset.bookCustomer);
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
  el.customerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearCustomerDialogMessage();
    try {
      await saveCustomerFromDialog();
    } catch (error) {
      showCustomerDialogMessage(error.message || "Klarte ikke lagre kunde.", "error");
    }
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
  el.orderTitleInput?.addEventListener("input", () => {
    orderTitleManuallyEdited = true;
  });
  el.orderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearOrderDialogMessage();
    try {
      await saveOrderFromDialog();
    } catch (error) {
      showOrderDialogMessage(error.message || "Klarte ikke lagre ordre.", "error");
    }
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
  });
  el.bookingCustomer.addEventListener("change", () => {
    const customer = findCustomer(el.bookingCustomer.value);
    if (customer) setBookingCustomerSelection(customer);
  });
  el.bookingDate.addEventListener("change", renderBookingMonth);
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
  el.closeCompletionDialog.addEventListener("click", () => el.completionDialog.close());
  el.cancelCompletionButton.addEventListener("click", () => el.completionDialog.close());
  el.completionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await completeBookingFromDialog();
    } catch (error) {
      setSyncStatus(error.message || "Klarte ikke fullføre jobb.", "error");
    }
  });
  el.closeBillingDialog?.addEventListener("click", () => el.billingDialog.close());
  el.cancelBillingButton?.addEventListener("click", () => el.billingDialog.close());
  el.billingMode?.addEventListener("change", syncBillingDialogText);
  el.billingForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearBillingDialogMessage();
    try {
      await saveBillingFromDialog();
    } catch (error) {
      showBillingDialogMessage(error.message || "Klarte ikke lagre fakturering/betaling.", "error");
      setSyncStatus(error.message || "Klarte ikke lagre fakturering/betaling.", "error");
    }
  });
  el.closeDeleteBookingDialog?.addEventListener("click", () => el.deleteBookingDialog.close());
  el.cancelDeleteBookingButton?.addEventListener("click", () => el.deleteBookingDialog.close());
  el.deleteBookingForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearDeleteBookingMessage();
    try {
      await deleteBookingFromDialog();
    } catch (error) {
      showDeleteBookingMessage(error.message || "Klarte ikke fjerne booking.", "error");
      setSyncStatus(error.message || "Klarte ikke fjerne booking.", "error");
    }
  });
  el.closeDeleteOrdersDialog?.addEventListener("click", () => el.deleteOrdersDialog.close());
  el.cancelDeleteOrdersButton?.addEventListener("click", () => el.deleteOrdersDialog.close());
  el.deleteOrdersForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearDeleteOrdersMessage();
    try {
      await deleteSelectedOrders({ cancelLinkedBookings: Boolean(el.deleteOrdersCancelBookings?.checked) });
      el.deleteOrdersDialog.close();
    } catch (error) {
      showDeleteOrdersMessage(error.message || "Klarte ikke slette ordre.", "error");
      setSyncStatus(error.message || "Klarte ikke slette ordre.", "error");
    }
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
    clearMoveDialogMessage();
    try {
      await saveMoveFromDialog();
    } catch (error) {
      showMoveDialogMessage(error.message || "Klarte ikke markere jobben som må flyttes.", "error");
      setSyncStatus(error.message || "Klarte ikke markere jobben som må flyttes.", "error");
    }
  });
  el.bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearBookingDialogMessage();
    try {
      await saveBookingFromDialog();
    } catch (error) {
      const message = error.message || "Klarte ikke lagre booking.";
      showBookingDialogMessage(message, "error");
      setSyncStatus(message, "error");
    }
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
      openBookingDialog(book.dataset.bookCustomer);
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
    el.planningBoard.querySelectorAll(".planning-day.drag-over").forEach((day) => day.classList.remove("drag-over"));
    draggedBookingId = "";
  });
  el.planningBoard.addEventListener("dragover", (event) => {
    if (!draggedBookingId) return;
    const day = event.target.closest(".planning-day[data-planning-date]");
    if (!day) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    el.planningBoard.querySelectorAll(".planning-day.drag-over").forEach((item) => {
      if (item !== day) item.classList.remove("drag-over");
    });
    day.classList.add("drag-over");
  });
  el.planningBoard.addEventListener("dragleave", (event) => {
    const day = event.target.closest(".planning-day[data-planning-date]");
    if (day && !day.contains(event.relatedTarget)) day.classList.remove("drag-over");
  });
  el.planningBoard.addEventListener("drop", async (event) => {
    const day = event.target.closest(".planning-day[data-planning-date]");
    const bookingId = draggedBookingId || event.dataTransfer.getData("text/plain");
    if (!day || !bookingId) return;
    event.preventDefault();
    day.classList.remove("drag-over");
    try {
      await moveBookingToDate(bookingId, day.dataset.planningDate);
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

  refreshData();
})();




