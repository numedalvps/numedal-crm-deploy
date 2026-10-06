(function (root) {
  "use strict";
  const contentKeys = ["action_type", "channel", "approval_required", "recipient", "subject", "body", "payload_json", "evidence_json", "blockers_json", "source_kind", "source_intake_id", "linked_customer_id", "linked_lead_id", "linked_job_id", "linked_order_id"];
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const content = row => Object.fromEntries(contentKeys.map(key => [key, row[key] ?? (["payload_json", "evidence_json"].includes(key) ? {} : key === "blockers_json" ? [] : null)]));
  const snapshot = row => JSON.stringify(canonical({...content(row), id:row.id, status:row.status, review_revision:row.review_revision,
    review_content_hash:row.review_content_hash, updated_at:row.updated_at, source_ref:row.source_ref ?? null,
    approved_by:row.approved_by ?? null, approved_at:row.approved_at ?? null, external_id:row.external_id ?? null,
    expires_at:row.expires_at ?? null, not_before:row.not_before ?? null}));

  function create(bridge) {
    // Only unsaved form text and in-flight review bookkeeping live here. The
    // shared proposal and its execution status remain canonical Supabase rows.
    const forms = new Map();
    let epoch = 0;
    const sameSession = state => state.epoch === epoch && bridge.sessionMatches(state.actorId, state.generation);
    const active = state => sameSession(state) && bridge.contextActive(state.context);
    const editable = state => ["needs_review", "approved"].includes(state.action?.status);
    const completedMessage = state => state.handled ? "Svarforslaget er allerede behandlet. Se kundehistorikken før du følger opp." : "Svaret er registrert sendt i kundehistorikken.";
    const unknown = state => Boolean(state.reviewUnknown || (state.action && bridge.sendUnknown(state.action.id)));
    const blockers = state => Array.isArray(state.action?.blockers_json) ? state.action.blockers_json.filter(Boolean) : [];
    const host = state => active(state) ? bridge.host(state.context) : null;
    const requireActive = state => { if (!active(state)) throw new Error("Saken eller CRM-brukeren er endret. Åpne saken på nytt."); };
    const validate = (state, action) => {
      const p = action?.payload_json || {};
      const handledLegacy = state.handled && !["needs_review", "approved"].includes(action?.status);
      if (!action?.id || action.action_type !== "email_reply" || action.channel !== "email"
        || action.linked_lead_id !== state.context.leadId || action.linked_customer_id !== state.context.customerId
        || action.source_kind !== "crm_assistant_email_triage" || !action.source_ref
        || (!handledLegacy && (p.customerReplyContract !== "case_email_reply_v1" || p.inlineCustomerReplyVersion !== "inline-customer-reply-v1"
          || p.customerReplySourceActivityId !== state.context.sourceActivityId))
        || (state.context.sourceIntakeId && action.source_intake_id !== state.context.sourceIntakeId)
        || (!handledLegacy && (!/^[a-f0-9]{64}$/.test(p.customerReplyContextHash || "") || !/^[a-f0-9]{64}$/.test(p.sourceContextHash || "")))
        || !Number.isSafeInteger(action.review_revision) || action.review_revision < 1
        || !/^[a-f0-9]{64}$/.test(action.review_content_hash || "")
        || !action.updated_at || Number.isNaN(Date.parse(action.updated_at))) {
        throw new Error("Svarutkastet kunne ikke knyttes sikkert til denne kundemeldingen. Hent utkastet på nytt.");
      }
      return action;
    };
    function accept(state, row) {
      validate(state, row);
      if (!sameSession(state)) return;
      const changed = state.action && snapshot(state.action) !== snapshot(row);
      state.action = row;
      if (!state.dateEdited) {
        const payload = row.payload_json || {};
        const date = Object.prototype.hasOwnProperty.call(payload, "customerReplyProposedDate")
          ? payload.customerReplyProposedDate : payload.proposedDate;
        state.date = String(date || "");
      }
      if (changed) state.display = null;
      bridge.accept(row);
    }
    function capture(state) {
      const node = host(state);
      // A previously rendered host can become visible before mount transfers
      // this case's current draft into it. Its old fields must not replace it.
      if (!node || node !== state.renderedHost || !state.action || !editable(state)) return;
      const subject = node.querySelector("[data-lead-reply-subject]");
      const body = node.querySelector("[data-lead-reply-body]");
      if (!subject || !body) return;
      const focused = document.activeElement;
      if (focused === subject || focused === body) state.focus = {field:focused === body ? "body" : "subject", start:focused.selectionStart, end:focused.selectionEnd};
      if (subject.value === String(state.action.subject || "") && body.value === String(state.action.body || "")) state.draft = null;
      else state.draft = {subject:subject.value, body:body.value};
    }
    function controls(state) {
      const node = host(state); if (!node) return;
      const subject = node.querySelector("[data-lead-reply-subject]");
      const body = node.querySelector("[data-lead-reply-body]");
      const locked = state.busy || unknown(state) || !editable(state);
      for (const field of [subject, body]) if (field) field.readOnly = locked;
      const send = node.querySelector("[data-lead-reply-send]");
      if (send) send.disabled = Boolean(locked || !state.display || blockers(state).length || !subject?.value.trim() || !body?.value.trim());
      const refresh = node.querySelector("[data-lead-reply-refresh]"); if (refresh) refresh.disabled = state.busy;
      const generate = node.querySelector("[data-lead-reply-generate]"); if (generate) generate.disabled = locked;
      const date = node.querySelector("[data-lead-reply-date]"); if (date) date.disabled = locked;
      const restore = node.querySelector("[data-lead-reply-restore]"); if (restore) restore.disabled = locked;
      const regenerate = node.querySelector("[data-lead-reply-regenerate]"); if (regenerate) regenerate.disabled = state.busy || unknown(state) || state.action?.status !== "needs_review";
      const status = node.querySelector("[data-lead-reply-status]");
      if (status) status.textContent = state.message || (state.action?.status === "completed" ? completedMessage(state)
        : blockers(state).length ? `Må avklares: ${blockers(state).join(" · ")}`
        : unknown(state) ? "Resultatet er ikke avklart. Hent sendestatus før du gjør noe mer."
        : state.action ? "Kontroller teksten. Send lagrer endringene dine og sender dette svaret." : "Henter svarutkast …");
    }
    function paint(state) {
      const node = host(state); if (!node) return;
      const value = state.draft || state.action || {};
      state.renderedHost = node;
      node.innerHTML = `<div class="customer-reply-heading"><strong>Svar kunden</strong><span>Assistentens forslag · du kan redigere</span></div>
        ${state.action ? `<p class="customer-reply-recipient">Til: ${escape(state.action.recipient)}</p>
        <label>Emne<input data-lead-reply-subject value="${escape(value.subject)}" /></label>
        <label>Din melding<textarea data-lead-reply-body rows="7">${escape(value.body)}</textarea></label>
        ${state.showStored && state.draft ? `<div class="customer-reply-stored"><strong>Sist lagrede svar</strong><small>Endringene dine er beholdt i feltet over. Send lagrer dem som en ny revisjon.</small><p>${escape(state.action.subject)}</p><pre>${escape(state.action.body)}</pre></div>` : ""}
        ${state.retained ? `<details class="customer-reply-stored"><summary>Teksten min før nytt forslag</summary><pre>${escape(state.retained.body)}</pre><button type="button" class="secondary" data-lead-reply-restore>Gjenopprett min tekst</button></details>` : ""}
        <details class="customer-reply-date-options"><summary>Legg til datoforslag</summary><div><label>Dato som skal foreslås<input type="date" data-lead-reply-date value="${escape(state.date || "")}" /></label><button type="button" class="secondary" data-lead-reply-generate>Legg dato til teksten</button></div><small>Dette foreslår en dag til kunden. Jobben bookes senere i Planning.</small></details>` : ""}
        <p class="customer-reply-status" data-lead-reply-status role="status" aria-live="polite"></p>
        <div class="customer-reply-actions"><button type="button" class="order-primary" data-lead-reply-send>Send e-post</button><button type="button" class="secondary" data-lead-reply-refresh>${unknown(state) ? "Hent sendestatus" : "Hent utkast på nytt"}</button></div>
        ${state.action?.status === "needs_review" ? `<details class="customer-reply-date-options"><summary>Trenger du et nytt forslag?</summary><small>Assistenten bruker den ferske kundemeldingen og tilbudet. Teksten din beholdes som kopi.</small><button type="button" class="secondary" data-lead-reply-regenerate>Lag nytt svarforslag</button></details>` : ""}`;
      node.oninput = event => {
        if (event.target.matches("[data-lead-reply-body],[data-lead-reply-subject]")) {capture(state); state.message = ""; controls(state);}
        if (event.target.matches("[data-lead-reply-date]")) {state.date = event.target.value; state.dateEdited = true;}
      };
      node.onclick = event => {
        if (event.target.closest("[data-lead-reply-send]")) void send(state);
        if (event.target.closest("[data-lead-reply-refresh]")) void refresh(state);
        if (event.target.closest("[data-lead-reply-generate]")) addDate(state);
        if (event.target.closest("[data-lead-reply-regenerate]")) void regenerate(state);
        if (event.target.closest("[data-lead-reply-restore]") && !state.busy && !unknown(state) && editable(state)) {
          state.draft = {...state.retained}; state.retained = null; state.message = "Teksten din er gjenopprettet. Kontroller pris og dato før sending."; paint(state);
        }
      };
      controls(state);
      if (state.focus && !state.busy) {
        const field = node.querySelector(`[data-lead-reply-${state.focus.field}]`);
        field?.focus({preventScroll:true}); field?.setSelectionRange(state.focus.start, state.focus.end);
        state.focus = null;
      }
    }
    function addDate(state) {
      if (state.busy || unknown(state) || !editable(state)) return;
      capture(state);
      const date = state.date && new Date(`${state.date}T12:00:00`);
      if (!date || Number.isNaN(date.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(state.date)) {state.message = "Velg datoen du vil foreslå."; controls(state); return;}
      const label = date.toLocaleDateString("nb-NO", {weekday:"long", day:"numeric", month:"long"});
      const value = state.draft || state.action;
      state.draft = {subject:String(value.subject || ""), body:`${String(value.body || "").trim()}\n\nPasser ${label}? Vi avtaler tidspunktet nærmere.`};
      state.message = "Datoforslaget er lagt til. Kontroller teksten før sending.";
      paint(state);
    }
    async function display(state) {
      state.display = null;
      if (!editable(state) || unknown(state)) {state.display = null; return;}
      const action = state.action;
      if (state.draft) state.showStored = true;
      // Audit only a revision already rendered, including a freshly read
      // canonical revision while a local edit is shown separately.
      paint(state);
      const result = await bridge.display(action, content(action));
      requireActive(state);
      if (result?.action?.id !== action.id || snapshot(result.action) !== snapshot(action)
        || result.actor_profile_id !== state.actorId || !result.receipt_id || result.send_authorized !== false) {
        throw new Error("Serveren bekreftet ikke den viste versjonen. Hent utkastet på nytt.");
      }
      state.display = {receiptId:result.receipt_id, snapshot:snapshot(action)};
    }
    async function ensure(state) {
      const result = await bridge.ensure(state.context);
      requireActive(state);
      if (result?.ok !== true || result.sourceActivityId !== state.context.sourceActivityId
        || (state.context.sourceIntakeId && result.sourceIntakeId !== state.context.sourceIntakeId)) {
        throw new Error("Serveren bekreftet ikke riktig kundemelding.");
      }
      state.handled = result.alreadyHandled === true;
      accept(state, result.assistantAction);
      paint(state);
      await display(state);
    }
    async function regenerate(state) {
      if (!active(state) || state.busy || unknown(state) || state.action?.status !== "needs_review") return;
      capture(state);
      const before = state.action;
      state.retained = {...(state.draft || state.retained || {subject:before.subject || "", body:before.body || ""})};
      state.busy = true; state.message = "Lager et nytt svarforslag …"; controls(state);
      try {
        const result = await bridge.ensure({...state.context, regenerate:true, expectedActionId:before.id,
          expectedRevision:before.review_revision, expectedContentHash:before.review_content_hash,
          ...(state.date ? {proposedDate:state.date} : {})});
        requireActive(state);
        if (result?.ok !== true || result.sourceActivityId !== state.context.sourceActivityId
          || result.assistantAction?.id !== before.id || result.assistantAction?.status !== "needs_review") {
          throw new Error("Serveren bekreftet ikke det nye forslaget på samme kundemelding.");
        }
        accept(state, result.assistantAction); state.draft = null; state.display = null; state.showStored = false;
        paint(state); await display(state);
        state.message = "Nytt forslag er klart. Kontroller teksten; den er ikke sendt.";
      } catch (error) {if (sameSession(state)) {
        state.display = null;
        if (!error.generationNotApplied) state.reviewUnknown = {revision:before.review_revision};
        state.message = error.message || "Kunne ikke bekrefte nytt forslag. Hent lagret utkast før du prøver igjen.";
      }}
      finally {if (sameSession(state)) {state.busy = false; paint(state);}}
    }
    async function refresh(state) {
      if (state.busy || !active(state)) return;
      capture(state); state.busy = true; state.message = "Henter fersk status …"; controls(state);
      try {
        if (!state.action) await ensure(state);
        else {
          const row = await bridge.read(state.action.id); requireActive(state);
          accept(state, row);
          // An unchanged row cannot prove that a timed-out review rolled back.
          if (state.reviewUnknown && row.review_revision > state.reviewUnknown.revision) state.reviewUnknown = null;
          await display(state);
        }
        state.message = unknown(state) ? "Resultatet er fortsatt ikke avklart. Ingen ny sending er startet."
          : state.action?.status === "completed" ? completedMessage(state)
          : !editable(state) ? "Svarforslaget er allerede behandlet. Se historikken før du følger opp videre."
          : "Ferskt utkast er hentet. Kontroller teksten før sending.";
      } catch (error) {if (sameSession(state)) state.message = error.message || "Kunne ikke hente utkastet.";}
      finally {if (sameSession(state)) {state.busy = false; paint(state);}}
    }
    async function review(state, eventType, patch = {}) {
      const before = state.action;
      try {
        const row = await bridge.review(before, {eventType, expectedStatus:before.status, subject:before.subject || "", body:before.body || "", ...patch});
        requireActive(state); validate(state, row);
        const expected = {...content(before), ...patch}; delete expected.reasonCode;
        if (row.review_revision <= before.review_revision || row.status !== (eventType === "approved" ? "approved" : "needs_review")
          || JSON.stringify(canonical(content(row))) !== JSON.stringify(canonical(expected))) {
          throw new Error("Den lagrede revisjonen avviker fra teksten du kontrollerte.");
        }
        accept(state, row); state.draft = null; state.reviewUnknown = null;
      } catch (error) {
        if (sameSession(state)) state.reviewUnknown = {revision:before.review_revision};
        throw error;
      }
    }
    async function send(state) {
      if (!active(state) || state.busy || unknown(state) || !editable(state) || !state.display || blockers(state).length) return;
      capture(state);
      const draft = state.draft || state.action;
      if (!String(draft.subject || "").trim() || !String(draft.body || "").trim()) return;
      state.busy = true; state.message = "Kontrollerer og sender …"; controls(state);
      try {
        const old = snapshot(state.action);
        const fresh = await bridge.read(state.action.id); requireActive(state); accept(state, fresh);
        if (snapshot(fresh) !== old) {
          await display(state); state.message = "Utkastet er endret. Kontroller det ferske svaret og trykk Send på nytt."; return;
        }
        if (state.display.snapshot !== old) throw new Error("Kontrollen er utdatert. Hent utkastet på nytt.");
        if (state.draft) {
          const patch = {subject:state.draft.subject.trim(), body:state.draft.body.trim(), reasonCode:"other"};
          await review(state, state.action.status === "approved" ? "reopened" : "edited", patch);
          paint(state); await display(state);
        }
        if (state.action.status === "needs_review") {
          await review(state, "approved");
          if (state.action.approved_by !== state.actorId) throw new Error("Godkjenningen tilhører en annen bruker.");
          paint(state); await display(state);
        }
        requireActive(state);
        const checked = snapshot(state.action), receipt = state.display?.receiptId;
        const preflight = await bridge.preflight(state.action.id); requireActive(state);
        if (preflight?.transport_verified !== true || preflight.sent === true) throw new Error("E-postoppsettet kunne ikke bekreftes. Ingen sending er startet.");
        const latest = await bridge.read(state.action.id); requireActive(state); accept(state, latest);
        if (snapshot(latest) !== checked) {
          await display(state); state.message = "Svaret er endret etter kontrollen. Kontroller teksten og trykk Send på nytt."; return;
        }
        const outcome = await bridge.send(latest, {expected_revision:latest.review_revision,
          expected_content_hash:latest.review_content_hash, expected_updated_at:latest.updated_at,
          expected_source_ref:latest.source_ref ?? null, expected_snapshot:content(latest), display_receipt_id:receipt});
        requireActive(state); accept(state, outcome.action); state.display = null;
        state.message = "E-posten er sendt og lagret i kundehistorikken.";
      } catch (error) {
        if (!sameSession(state)) return;
        state.message = error.message || "Sendingen kunne ikke avklares. Hent sendestatus.";
        if (state.action && !state.reviewUnknown) {
          try {
            const row = await bridge.read(state.action.id); requireActive(state); accept(state, row);
            if (row.status === "completed") {state.display = null; state.message = completedMessage(state);}
            else if (!unknown(state)) await display(state);
          } catch (_) { /* Keep the existing uncertainty lock and exact form text. */ }
        }
      } finally {if (sameSession(state)) {state.busy = false; paint(state);}}
    }
    return {
      capture() {for (const state of forms.values()) capture(state);},
      mount(context) {
        const key = `${context.leadId}:${context.sourceActivityId}`;
        let state = forms.get(key);
        if (!state) {state = {context, actorId:bridge.actorId(), generation:bridge.generation(), epoch,
          action:null, draft:null, display:null, date:"", busy:false, reviewUnknown:null, message:""}; forms.set(key, state);}
        if (!state.started && bridge.cached) {
          const cached = bridge.cached(context);
          if (cached) {try {accept(state, cached);} catch (_) { /* Unverified cached rows cannot become editable send candidates. */ }}
        }
        if (!active(state)) return;
        paint(state);
        if (!state.started) {state.started = true; void refresh(state);}
      },
      reset() {epoch += 1; forms.clear();},
    };
  }
  root.NumedalCustomerReply = {create};
})(globalThis);
