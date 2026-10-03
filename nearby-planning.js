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
      if (mode === "recommended" && left?.kind === "service_need" && right?.kind === "service_need") {
        const leftServicePriority = Number(left?.servicePriorityRank || 99);
        const rightServicePriority = Number(right?.servicePriorityRank || 99);
        if (leftServicePriority !== rightServicePriority) return leftServicePriority - rightServicePriority;
      }
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

  // Route advice uses reviewed service-area keys, never a customer's invoice
  // address or a straight-line distance presented as driving time.
  function assessDayRouteInsertion(dayStops, candidate, window, relations = []) {
    const areaKey = String(candidate?.areaKey || "").trim();
    const branch = (key) => ["vegglifjell_nord", "vegglifjell_sor"].includes(key) ? key : "";
    const corridor = ["veggli", "rollag", "flesberg", "lampeland", "svene"];
    const rank = (key) => corridor.indexOf(key);
    const stops = (Array.isArray(dayStops) ? dayStops : [])
      .filter((stop) => stop && String(stop.id || "") !== String(candidate?.id || "__new__"))
      .filter((stop) => Number.isFinite(stop.start) && Number.isFinite(stop.end) && stop.end > stop.start)
      .map((stop) => ({ ...stop, areaKey: String(stop.areaKey || "").trim() }))
      .sort((left, right) => left.start - right.start || left.end - right.end);
    const start = Number.isFinite(window?.start) ? window.start : null;
    const end = Number.isFinite(window?.end) ? window.end : null;
    const before = start === null ? [] : stops.filter((stop) => stop.end <= start);
    const after = end === null ? [] : stops.filter((stop) => stop.start >= end);
    const previous = before.at(-1) || null;
    const next = after[0] || null;
    let minimumStart = previous?.end ?? null;
    let maximumEnd = next?.start ?? null;
    const issues = [];
    const add = (code, left = previous, right = next, requiredMinutes = null, availableMinutes = null) => {
      const issue = { code, previousId: left?.id || "", nextId: right?.id || "", requiredMinutes, availableMinutes };
      const existing = issues.findIndex((item) => item.code === code);
      if (existing < 0) issues.push(issue);
      else if (availableMinutes !== null && (issues[existing].availableMinutes === null || availableMinutes < issues[existing].availableMinutes)) issues[existing] = issue;
    };
    if (!areaKey || areaKey === "vegglifjell_uavklart" || stops.some((stop) => !stop.areaKey || stop.areaKey === "vegglifjell_uavklart")) {
      add("area_unknown");
    }
    const candidateBranch = branch(areaKey);
    const opposite = candidateBranch ? stops.find((stop) => branch(stop.areaKey) && stop.areaKey !== areaKey) : null;
    // A new branch makes the whole day inefficient even when the neighboring
    // valley stop hides the branch change. An already mixed day can still be
    // improved by adding stops on its existing branches.
    if (opposite && !stops.some((stop) => stop.areaKey === areaKey)) add("mountain_branch_change", opposite, null, 45);
    for (const [neighbor, outgoing] of [[previous, false], [next, true]]) {
      if (!neighbor || !areaKey || !neighbor.areaKey) continue;
      const branchChange = candidateBranch && branch(neighbor.areaKey) && neighbor.areaKey !== areaKey;
      if (branchChange) {
        const available = outgoing ? neighbor.start - end : start - neighbor.end;
        add("mountain_branch_change", outgoing ? previous : neighbor, outgoing ? neighbor : next, 45, available);
        if (outgoing) maximumEnd = neighbor.start - 45;
        else minimumStart = neighbor.end + 45;
      } else if (prohibitedAreaPair(relations, areaKey, neighbor.areaKey)) {
        add("prohibited_area_pair", outgoing ? previous : neighbor, outgoing ? neighbor : next);
      }
    }
    const mountainsBefore = before.filter((stop) => branch(stop.areaKey));
    const mountainsAfter = after.filter((stop) => branch(stop.areaKey));
    if (rank(areaKey) >= 0 && mountainsBefore.length && mountainsAfter.length) {
      add("valley_between_mountain_stops", mountainsBefore.at(-1), mountainsAfter[0]);
    }
    if (candidateBranch) {
      const lastMountain = mountainsBefore.at(-1);
      const descended = lastMountain && before.some((stop) => stop.start >= lastMountain.end && rank(stop.areaKey) >= 0);
      if (descended) add("mountain_after_descent", lastMountain, next);
      // A mountain stop before an existing valley->mountain pair turns that
      // previously sensible outbound visit into a trip down and back up.
      if (mountainsAfter.length && after.some((stop) => rank(stop.areaKey) >= 0 && stop.end <= mountainsAfter[0].start)) {
        add("valley_between_mountain_stops", previous, mountainsAfter[0]);
      }
    }
    if (rank(areaKey) >= 0 && mountainsBefore.length && !mountainsAfter.length) {
      const lastMountain = mountainsBefore.at(-1);
      const returnBefore = before.filter((stop) => stop.start >= lastMountain.end && rank(stop.areaKey) >= 0);
      const returnAfter = after.filter((stop) => rank(stop.areaKey) >= 0);
      if (returnBefore.some((stop) => rank(stop.areaKey) > rank(areaKey))
        || returnAfter.some((stop) => rank(stop.areaKey) < rank(areaKey))) {
        add("return_corridor_backtrack", returnBefore.at(-1) || lastMountain, returnAfter[0]);
      }
    }
    return {
      suitable: !issues.some((issue) => issue.code !== "area_unknown"),
      issues, minimumStart, maximumEnd, corridorRank: rank(areaKey),
      returning: mountainsBefore.length > 0 && mountainsAfter.length === 0,
    };
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
      if (mode === "home" && left?.routeAssessment?.returning && right?.routeAssessment?.returning) {
        const leftRouteRank = Number(left.routeAssessment.corridorRank);
        const rightRouteRank = Number(right.routeAssessment.corridorRank);
        if (leftRouteRank >= 0 && rightRouteRank >= 0 && leftRouteRank !== rightRouteRank) return leftRouteRank - rightRouteRank;
      }
      if (left?.kind === "service" && right?.kind === "service") {
        const leftServicePriority = Number(left?.servicePriorityRank || 99);
        const rightServicePriority = Number(right?.servicePriorityRank || 99);
        if (leftServicePriority !== rightServicePriority) return leftServicePriority - rightServicePriority;
      }
      const ageOrder = () => {
        const leftDueAt = timestamp(left?.priorityDueAt || left?.dueDate);
        const rightDueAt = timestamp(right?.priorityDueAt || right?.dueDate);
        if (leftDueAt !== rightDueAt) return leftDueAt - rightDueAt;
        const leftWaitSince = timestamp(left?.priorityWaitSince || left?.createdAt || left?.created_at);
        const rightWaitSince = timestamp(right?.priorityWaitSince || right?.createdAt || right?.created_at);
        return leftWaitSince !== rightWaitSince ? leftWaitSince - rightWaitSince : 0;
      };
      // Urgent deadlines retain their order. Routine work is grouped by actual
      // site proximity before age, rather than criss-crossing one large area.
      if (leftPriority < 2) { const urgentAge = ageOrder(); if (urgentAge) return urgentAge; }
      const leftCategory = categoryRank[left?.kind] ?? 9;
      const rightCategory = categoryRank[right?.kind] ?? 9;
      if (leftCategory !== rightCategory) return leftCategory - rightCategory;
      const distanceValue = candidate => {
        const value = mode === "home" ? candidate?.homeDetourKm : candidate?.distanceKm;
        return value == null || value === "" ? Infinity : Number(value);
      };
      const leftDistance = distanceValue(left);
      const rightDistance = distanceValue(right);
      if (Number.isFinite(leftDistance) || Number.isFinite(rightDistance)) {
        if (!Number.isFinite(leftDistance)) return 1;
        if (!Number.isFinite(rightDistance)) return -1;
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      }
      const remainingAge = ageOrder();
      if (remainingAge) return remainingAge;
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

  const nearbyRoadDistanceLimit = 2000000;
  const nearbyRoadDurationLimit = 172800;

  function nonnegativeTravelNumber(value, limit = Number.POSITIVE_INFINITY) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= limit ? value : null;
  }

  function validNearbyRoadComparison(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      && nonnegativeTravelNumber(value.distanceMeters, nearbyRoadDistanceLimit) !== null
      && nonnegativeTravelNumber(value.durationSeconds, nearbyRoadDurationLimit) !== null
      && nonnegativeTravelNumber(value.addedDistanceMeters, nearbyRoadDistanceLimit * 2) !== null
      && nonnegativeTravelNumber(value.addedDurationSeconds, nearbyRoadDurationLimit * 2) !== null
      && typeof value.furtherFromHome === "boolean";
  }

  // This is the explicit travel ordering used by Nearby. Operational priority
  // stays visible, but must not silently replace the selected distance order.
  // Checked road figures and geometric preselection are separate groups.
  function sortNearbyByTravel(candidates, mode = "nearby") {
    const home = mode === "home";
    const compareNumber = (left, right) => {
      const a = nonnegativeTravelNumber(left);
      const b = nonnegativeTravelNumber(right);
      if (a === null) return b === null ? 0 : 1;
      if (b === null) return -1;
      return a - b;
    };
    return [...(Array.isArray(candidates) ? candidates : [])].sort((left, right) => {
      const leftRoad = validNearbyRoadComparison(left?.roadComparison);
      const rightRoad = validNearbyRoadComparison(right?.roadComparison);
      if (Boolean(leftRoad) !== Boolean(rightRoad)) return leftRoad ? -1 : 1;
      if (leftRoad && rightRoad) {
        const keys = home
          ? ["addedDurationSeconds", "addedDistanceMeters", "distanceMeters"]
          : ["distanceMeters", "durationSeconds"];
        for (const key of keys) {
          const order = compareNumber(left.roadComparison[key], right.roadComparison[key]);
          if (order) return order;
        }
      } else {
        const key = home ? "homeDetourKm" : "distanceKm";
        const order = compareNumber(left?.[key], right?.[key]);
        if (order) return order;
      }
      const labelOrder = String(left?.label || "").localeCompare(String(right?.label || ""), "nb");
      return labelOrder || String(left?.id || "").localeCompare(String(right?.id || ""), "nb");
    });
  }

  function strictZonedIsoTime(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match) return null;
    const [, year, month, day, hour, minute, second] = match.map((part, index) => index ? Number(part) : part);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day
      || hour > 23 || minute > 59 || second > 59) return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  // Validate the exact preview that was requested before attaching road figures
  // to candidates. No null coercion, missing entry or mixed home/next-site
  // context may turn an unchecked candidate into a checked road suggestion.
  function validateNearbyRoadComparisonResponse(result, payload, now = Date.now()) {
    if (!result || typeof result !== "object" || Array.isArray(result)
      || !payload || typeof payload !== "object" || Array.isArray(payload)
      || typeof now !== "number" || !Number.isFinite(now)
      || result.ok !== true || result.action !== "assess_nearby_routes"
      || !["google_routes_matrix", "statens_vegvesen_nvdb"].includes(result.source)
      || !Object.prototype.hasOwnProperty.call(payload, "nextSite")) return false;
    const nextSite = payload.nextSite;
    if (nextSite !== null && (!nextSite || typeof nextSite !== "object" || Array.isArray(nextSite))) return false;
    if (result.context !== (nextSite === null ? "home" : "between")) return false;
    const verified = strictZonedIsoTime(result.verifiedAt);
    const departure = strictZonedIsoTime(result.departureTime);
    if (verified === null || now - verified > 300000 || verified - now > 30000
      || departure === null || typeof payload.date !== "string"
      || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      || strictZonedIsoTime(`${payload.date}T00:00:00Z`) === null
      || !Number.isInteger(payload.departureMinute) || payload.departureMinute < 0 || payload.departureMinute >= 1440) return false;
    const departureFields = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(departure)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    if (`${departureFields.year}-${departureFields.month}-${departureFields.day}` !== payload.date
      || Number(departureFields.hour) * 60 + Number(departureFields.minute) + Number(departureFields.second) / 60 < payload.departureMinute) return false;
    const baselineDistance = nonnegativeTravelNumber(result.baselineDistanceMeters, nearbyRoadDistanceLimit);
    const baselineDuration = nonnegativeTravelNumber(result.baselineDurationSeconds, nearbyRoadDurationLimit);
    if (baselineDistance === null || baselineDuration === null
      || !Array.isArray(result.warnings) || result.warnings.some((warning) => typeof warning !== "string")
      || !Array.isArray(payload.candidates) || !payload.candidates.length || payload.candidates.length > 10
      || !Array.isArray(result.results) || result.results.length !== payload.candidates.length) return false;
    const requested = new Set();
    for (const candidate of payload.candidates) {
      const id = candidate?.id;
      if (typeof id !== "string" || !id.trim() || id !== id.trim() || requested.has(id)) return false;
      requested.add(id);
    }
    const returned = new Set();
    const sameMetric = (left, right) => Math.abs(left - right) <= 0.000001;
    for (const row of result.results) {
      if (!row || typeof row !== "object" || Array.isArray(row)
        || !requested.has(row.id) || returned.has(row.id)) return false;
      returned.add(row.id);
      if (Object.prototype.hasOwnProperty.call(row, "unavailable")) {
        if (row.unavailable !== true || Object.keys(row).some((key) => key !== "id" && key !== "unavailable")) return false;
        continue;
      }
      if (!validNearbyRoadComparison(row)) return false;
      const onwardDistance = nonnegativeTravelNumber(row.onwardDistanceMeters, nearbyRoadDistanceLimit);
      const onwardDuration = nonnegativeTravelNumber(row.onwardDurationSeconds, nearbyRoadDurationLimit);
      if (onwardDistance === null || onwardDuration === null
        || !sameMetric(row.addedDistanceMeters, Math.max(0, row.distanceMeters + onwardDistance - baselineDistance))
        || !sameMetric(row.addedDurationSeconds, Math.max(0, row.durationSeconds + onwardDuration - baselineDuration))
        || row.furtherFromHome !== (result.context === "home" && onwardDistance > baselineDistance + 1000)) return false;
    }
    return returned.size === requested.size;
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
    assessDayRouteInsertion,
    candidatePriorityRank,
    sortCandidates,
    sortNearbyByTravel,
    validateNearbyRoadComparisonResponse,
  });
});
