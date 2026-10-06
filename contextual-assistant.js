(function initContextualAssistant(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NumedalContextualAssistant = api;
})(typeof globalThis === "object" ? globalThis : this, function contextualAssistantFactory() {
  "use strict";

  const OPEN_STATUSES = new Set(["needs_review", "approved", "executing", "failed"]);
  const ACTION_TYPES = new Set([
    "email_reply", "sms_reply", "offer_draft", "booking_proposal", "reminder_proposal",
    "invoice_draft", "customer_enrichment", "customer_create_proposal",
  ]);
  const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const ID_FIELDS = {
    customer: ["customerId", "customer_id"],
    lead: ["leadId", "lead_id"],
    job: ["jobId", "job_id"],
    order: ["orderId", "order_id"],
  };

  function record(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function absent(value) {
    return value === undefined || value === null || value === "";
  }

  function canonicalId(value) {
    return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : "";
  }

  function entityIndex(rows) {
    const index = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = record(row) && canonicalId(row.id);
      if (!id) continue;
      // An ambiguous snapshot must not silently choose an owner.
      index.set(id, index.has(id) ? null : row);
    }
    return index;
  }

  function oneId(values) {
    let selected = "";
    for (const value of values) {
      if (absent(value)) continue;
      const id = canonicalId(value);
      if (!id || (selected && selected !== id)) return null;
      selected = id;
    }
    return selected;
  }

  function ownedEntity(index, id, customerId, fields) {
    const entity = index.get(id);
    return entity && oneId(fields.map((key) => entity[key])) === customerId ? entity : null;
  }

  function orderForJob(job, indexes, customerId) {
    if (job.source_table !== "orders") return "";
    const orderId = canonicalId(job.source_id);
    return orderId && ownedEntity(indexes.order, orderId, customerId, ID_FIELDS.customer) ? orderId : null;
  }

  function jobForOrder(order, indexes, customerId) {
    const jobId = oneId(ID_FIELDS.job.map((key) => order[key]));
    if (jobId === null) return null;
    return !jobId || ownedEntity(indexes.job, jobId, customerId, ["customer_id"]) ? jobId : null;
  }

  function referencesValid(refs, indexes, customerId) {
    if (refs.customer !== customerId) return false;
    if (refs.lead && !ownedEntity(indexes.lead, refs.lead, customerId, ["existing_customer_id", "converted_customer_id"])) return false;
    const job = refs.job && ownedEntity(indexes.job, refs.job, customerId, ["customer_id"]);
    const order = refs.order && ownedEntity(indexes.order, refs.order, customerId, ID_FIELDS.customer);
    if ((refs.job && !job) || (refs.order && !order)) return false;
    const jobOrder = job ? orderForJob(job, indexes, customerId) : "";
    const orderJob = order ? jobForOrder(order, indexes, customerId) : "";
    if (jobOrder === null || orderJob === null) return false;
    // Check both directions even when only one ID was supplied. Otherwise an
    // inconsistent order.jobId could make an unrelated job appear in this case.
    if (jobOrder) {
      const sourceOrderJob = jobForOrder(indexes.order.get(jobOrder), indexes, customerId);
      if (sourceOrderJob === null || (sourceOrderJob && sourceOrderJob !== refs.job)) return false;
    }
    if (orderJob) {
      const pointedJobOrder = orderForJob(indexes.job.get(orderJob), indexes, customerId);
      if (pointedJobOrder === null || (pointedJobOrder && pointedJobOrder !== refs.order)) return false;
    }
    if (job && order && !(jobOrder === refs.order || orderJob === refs.job)) return false;
    if ((jobOrder && refs.order && jobOrder !== refs.order) || (orderJob && refs.job && orderJob !== refs.job)) return false;
    if (refs.lead) {
      // Owning the same customer does not make another case part of this job.
      // Include the canonical counterpart when an action supplies only one work ID.
      for (const work of [job, order, jobOrder && indexes.order.get(jobOrder), orderJob && indexes.job.get(orderJob)]) {
        if (!work) continue;
        const workLead = oneId(ID_FIELDS.lead.map((key) => work[key]));
        if (workLead === null || (workLead && workLead !== refs.lead)) return false;
      }
    }
    return true;
  }

  function actionReferences(action) {
    const payload = record(action.payload_json) ? action.payload_json : {};
    const booking = record(payload.booking) ? payload.booking : {};
    const planning = record(payload.planning) ? payload.planning : {};
    const refs = {};
    for (const [kind, keys] of Object.entries(ID_FIELDS)) {
      const values = [action[`linked_${kind}_id`]];
      // Only these documented ID fields are identity evidence. Text and opaque
      // source references cannot associate a proposal with a customer or case.
      for (const container of [payload, booking, planning]) {
        for (const key of keys) values.push(container[key]);
      }
      refs[kind] = oneId(values);
      if (refs[kind] === null) return null;
    }
    if (action.source_kind === "invoice_basis_revision_v1"
      && (!canonicalId(action.linked_job_id) || canonicalId(action.source_ref) !== canonicalId(action.linked_job_id))) return null;
    return refs;
  }

  function belongsToJobScope(action, refs, scope, indexes, customerId) {
    const linkedJob = canonicalId(action.linked_job_id);
    const linkedOrder = canonicalId(action.linked_order_id);
    if (!linkedJob && !linkedOrder) return false;
    if ((scope.job && refs.job && scope.job !== refs.job) || (scope.order && refs.order && scope.order !== refs.order)) return false;
    if ((scope.job && linkedJob === scope.job) || (scope.order && linkedOrder === scope.order)) return true;
    if (scope.job && linkedOrder) {
      const job = indexes.job.get(scope.job);
      const order = indexes.order.get(linkedOrder);
      if (orderForJob(job, indexes, customerId) === linkedOrder || jobForOrder(order, indexes, customerId) === scope.job) return true;
    }
    if (scope.order && linkedJob) {
      const job = indexes.job.get(linkedJob);
      const order = indexes.order.get(scope.order);
      if (orderForJob(job, indexes, customerId) === scope.order || jobForOrder(order, indexes, customerId) === linkedJob) return true;
    }
    return false;
  }

  function validatedScope(options) {
    if (!record(options)) return null;
    const customerId = canonicalId(options.customerId);
    if (!customerId) return null;
    const indexes = {
      lead: entityIndex(options.leads), job: entityIndex(options.jobs), order: entityIndex(options.orders),
    };
    const scope = { customer: customerId };
    for (const kind of ["lead", "job", "order"]) {
      scope[kind] = oneId([options[`${kind}Id`]]);
      if (scope[kind] === null) return null;
    }
    return referencesValid(scope, indexes, customerId) ? { customerId, indexes, scope } : null;
  }

  // Shortcuts and assistant context need the same ownership checks even when
  // there are no pending actions to select. No action or queue state is required.
  function isScopeValid(options = {}) {
    return Boolean(validatedScope(options));
  }

  // Stateless view selection only. Callers retain the shared review/display/send
  // path and supply its already-sorted assistant_actions rows and entity snapshot.
  function selectActions(options = {}) {
    const validated = validatedScope(options);
    if (!validated || !Array.isArray(options.actions)) return [];
    const now = options.now === undefined ? Date.now() : new Date(options.now).getTime();
    if (!Number.isFinite(now)) return [];
    const { customerId, indexes, scope } = validated;
    return options.actions.filter((action) => {
      if (!record(action) || !canonicalId(action.id) || !OPEN_STATUSES.has(action.status) || !ACTION_TYPES.has(action.action_type)) return false;
      if (canonicalId(action.linked_customer_id) !== customerId) return false;
      if (!absent(action.expires_at)) {
        const expiresAt = new Date(action.expires_at).getTime();
        if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
      }
      const refs = actionReferences(action);
      if (!refs || !referencesValid(refs, indexes, customerId)) return false;
      if (scope.lead && canonicalId(action.linked_lead_id) !== scope.lead) return false;
      return !scope.job && !scope.order || belongsToJobScope(action, refs, scope, indexes, customerId);
    });
  }

  return Object.freeze({ selectActions, isScopeValid });
});
