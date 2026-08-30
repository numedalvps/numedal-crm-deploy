(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NumedalNearbyPlanning = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function finitePoint(value) {
    const lat = Number(value?.lat);
    const lon = Number(value?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  function haversineKm(left, right) {
    const a = finitePoint(left);
    const b = finitePoint(right);
    if (!a || !b) return Number.POSITIVE_INFINITY;
    const toRadians = (value) => value * Math.PI / 180;
    const radiusKm = 6371;
    const latitudeDelta = toRadians(b.lat - a.lat);
    const longitudeDelta = toRadians(b.lon - a.lon);
    const firstLatitude = toRadians(a.lat);
    const secondLatitude = toRadians(b.lat);
    const value = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * radiusKm * Math.asin(Math.sqrt(value));
  }

  function distancePrecision(anchor, candidate) {
    const anchorArea = String(anchor?.areaKey || "").trim();
    const candidateArea = String(candidate?.areaKey || "").trim();
    const anchorQuality = String(anchor?.pointQuality || anchor?.quality || "").trim();
    const candidateQuality = String(candidate?.pointQuality || candidate?.quality || "").trim();
    if (
      anchorArea
      && anchorArea === candidateArea
      && anchorQuality !== "exact"
      && candidateQuality !== "exact"
    ) return "same_area";
    if (anchorQuality === "exact" && candidateQuality === "exact") return "exact";
    return "approximate";
  }

  function norwegianNumber(value, decimals) {
    return Number(value).toFixed(decimals).replace(".", ",");
  }

  function formatDistanceKm(value, precision = "approximate") {
    const distance = Number(value);
    if (!Number.isFinite(distance)) return "Ukjent avstand";
    if (precision === "same_area") return "Samme serviceområde · eksakt avstand mangler";
    if (distance < 0.005) return precision === "exact" ? "Samme kartpunkt" : "Samme omtrentlige kartpunkt";
    if (distance < 1) {
      const meters = precision === "exact"
        ? Math.max(10, Math.round(distance * 1000 / 10) * 10)
        : Math.max(100, Math.round(distance * 1000 / 100) * 100);
      return precision === "exact"
        ? `${meters} m luftlinje`
        : `ca. ${meters} m mellom kartpunkt`;
    }
    const formatted = norwegianNumber(distance, distance < 10 ? 1 : 0);
    return precision === "exact"
      ? `${formatted} km luftlinje`
      : `ca. ${formatted} km mellom kartpunkt`;
  }

  function serviceVisitMessage({ name = "", area = "området ditt", date = "", equipment = "varmepumpen" } = {}) {
    const customerName = String(name || "").trim();
    const serviceArea = String(area || "området ditt").trim();
    const serviceDate = String(date || "").trim();
    const serviceEquipment = String(equipment || "varmepumpen").trim();
    const greeting = customerName ? `Hei ${customerName}.` : "Hei.";
    const when = serviceDate ? ` ${serviceDate}` : "";
    return `${greeting} Vi planlegger service i ${serviceArea}${when} og samler flere jobber for å redusere reisekostnaden. Ønsker du service på ${serviceEquipment} denne dagen? Du trenger ikke være til stede hvis vi får nøkkel eller nøkkelbokskode. Vi kommer tilbake med ca. tidspunkt. Mvh Gunnar, Numedal Varmepumpeservice`;
  }

  function routeHomeDetourKm(anchor, candidate, home) {
    const directHome = haversineKm(anchor, home);
    const viaCandidate = haversineKm(anchor, candidate) + haversineKm(candidate, home);
    if (!Number.isFinite(directHome) || !Number.isFinite(viaCandidate)) return Number.POSITIVE_INFINITY;
    return Math.max(0, viaCandidate - directHome);
  }

  function routeInsertionDetourKm(previous, candidate, next) {
    const direct = haversineKm(previous, next);
    const viaCandidate = haversineKm(previous, candidate) + haversineKm(candidate, next);
    if (!Number.isFinite(direct) || !Number.isFinite(viaCandidate)) return Number.POSITIVE_INFINITY;
    return Math.max(0, viaCandidate - direct);
  }

  function slotFit(durationMinutes, slot) {
    const duration = Math.max(0, Number(durationMinutes) || 0);
    const available = Math.max(0, Number(slot?.end) - Number(slot?.start));
    return {
      durationMinutes: duration,
      availableMinutes: available,
      fits: Boolean(duration && available && duration <= available),
    };
  }

  function dueKind(value, now = new Date(), warningDays = 120) {
    if (!value) return "missing";
    const due = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(due.getTime())) return "missing";
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return "overdue";
    if (days < Math.max(1, Number(warningDays) || 120)) return "soon";
    return "later";
  }

  function serviceDueDays(value, now = new Date()) {
    if (!value) return null;
    const due = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(due.getTime())) return null;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  function serviceDueMatches(value, filter = "due", now = new Date(), warningDays = 120) {
    const days = serviceDueDays(value, now);
    const warning = Math.max(1, Number(warningDays) || 120);
    if (filter === "all") return true;
    if (filter === "missing") return days === null;
    if (days === null) return false;
    if (filter === "red") return days < 0;
    if (filter === "yellow") return days >= 0 && days < warning;
    if (filter === "green") return days >= warning;
    if (filter === "within_30") return days <= 30;
    if (filter === "within_90") return days <= 90;
    if (filter === "within_180") return days <= 180;
    return days < warning;
  }

  function sortServiceWorklist(candidates, mode = "oldest", now = new Date()) {
    const rows = [...(Array.isArray(candidates) ? candidates : [])];
    const categoryRank = { open_job: 0, service_need: 1 };
    const dateValue = (candidate) => {
      const days = serviceDueDays(candidate?.dueDate, now);
      if (days === null) return Number.POSITIVE_INFINITY;
      return mode === "nearest" ? Math.abs(days) : days;
    };
    return rows.sort((left, right) => {
      const leftPriority = candidatePriorityRank(left);
      const rightPriority = candidatePriorityRank(right);
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const leftCategory = categoryRank[left?.kind] ?? 9;
      const rightCategory = categoryRank[right?.kind] ?? 9;
      if (leftCategory !== rightCategory) return leftCategory - rightCategory;
      if (mode === "area") {
        const areaCompare = String(left?.areaLabel || "").localeCompare(String(right?.areaLabel || ""), "nb");
        if (areaCompare) return areaCompare;
      }
      if (mode === "name") {
        const nameCompare = String(left?.customerName || "").localeCompare(String(right?.customerName || ""), "nb");
        if (nameCompare) return nameCompare;
      } else {
        const leftDate = dateValue(left);
        const rightDate = dateValue(right);
        if (leftDate !== rightDate) return leftDate - rightDate;
      }
      return String(left?.customerName || left?.label || "")
        .localeCompare(String(right?.customerName || right?.label || ""), "nb");
    });
  }

  function pairKey(left, right) {
    return [String(left || "").trim(), String(right || "").trim()].sort().join("::");
  }

  function prohibitedAreaPair(relations, left, right) {
    const leftKey = String(left || "").trim();
    const rightKey = String(right || "").trim();
    if (!leftKey || !rightKey || leftKey === rightKey) return false;
    const wanted = pairKey(leftKey, rightKey);
    return (Array.isArray(relations) ? relations : []).some((relation) => (
      String(relation?.relation_kind || relation?.relationKind || "") === "prohibited"
      && pairKey(relation?.source_area_key || relation?.sourceAreaKey, relation?.target_area_key || relation?.targetAreaKey) === wanted
    ));
  }

  function sortCandidates(candidates, mode = "nearby") {
    const categoryRank = { open_job: 0, service: 1 };
    const dueRank = { overdue: 0, soon: 1, later: 2, missing: 3 };
    const timestamp = (value, missing = Number.POSITIVE_INFINITY) => {
      const parsed = Date.parse(String(value || ""));
      return Number.isFinite(parsed) ? parsed : missing;
    };
    return [...(Array.isArray(candidates) ? candidates : [])].sort((left, right) => {
      const leftPriority = candidatePriorityRank(left);
      const rightPriority = candidatePriorityRank(right);
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const leftDueAt = timestamp(left?.priorityDueAt || left?.dueDate);
      const rightDueAt = timestamp(right?.priorityDueAt || right?.dueDate);
      if (leftDueAt !== rightDueAt) return leftDueAt - rightDueAt;
      const leftWaitSince = timestamp(left?.priorityWaitSince || left?.createdAt || left?.created_at);
      const rightWaitSince = timestamp(right?.priorityWaitSince || right?.createdAt || right?.created_at);
      if (leftWaitSince !== rightWaitSince) return leftWaitSince - rightWaitSince;
      const leftCategory = categoryRank[left?.kind] ?? 9;
      const rightCategory = categoryRank[right?.kind] ?? 9;
      if (leftCategory !== rightCategory) return leftCategory - rightCategory;
      const leftDistance = Number(mode === "home" ? left?.homeDetourKm : left?.distanceKm);
      const rightDistance = Number(mode === "home" ? right?.homeDetourKm : right?.distanceKm);
      if (Number.isFinite(leftDistance) || Number.isFinite(rightDistance)) {
        if (!Number.isFinite(leftDistance)) return 1;
        if (!Number.isFinite(rightDistance)) return -1;
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      }
      const leftDue = dueRank[left?.dueKind] ?? 9;
      const rightDue = dueRank[right?.dueKind] ?? 9;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return String(left?.label || "").localeCompare(String(right?.label || ""), "nb");
    });
  }

  function candidatePriorityRank(candidate) {
    const explicit = Number(candidate?.priorityRank);
    if (Number.isFinite(explicit)) return explicit;
    const priorityClass = String(candidate?.priorityClass || "").toUpperCase();
    if (priorityClass === "P0") return 0;
    if (priorityClass === "P1") return 1;
    return 2;
  }

  return Object.freeze({
    haversineKm,
    distancePrecision,
    formatDistanceKm,
    serviceVisitMessage,
    routeHomeDetourKm,
    routeInsertionDetourKm,
    slotFit,
    dueKind,
    serviceDueDays,
    serviceDueMatches,
    sortServiceWorklist,
    prohibitedAreaPair,
    candidatePriorityRank,
    sortCandidates,
  });
});
