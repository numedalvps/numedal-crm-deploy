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
    return [...(Array.isArray(candidates) ? candidates : [])].sort((left, right) => {
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

  return Object.freeze({
    haversineKm,
    routeHomeDetourKm,
    routeInsertionDetourKm,
    slotFit,
    dueKind,
    serviceDueDays,
    serviceDueMatches,
    sortServiceWorklist,
    prohibitedAreaPair,
    sortCandidates,
  });
});
