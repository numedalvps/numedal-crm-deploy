(function () {
  const config = window.NUMEDAL_SUPABASE || {};
  const appEnv = config.appEnv || config.APP_ENV || "production";
  const browserImportEnabled = appEnv === "development" && config.enableBrowserImport === true;
  const databaseUnavailableMessage = "CRM-et fikk ikke kontakt med databasen. Ingen endringer er lagret. Prøv igjen eller kontakt administrator.";
  const isConfigured = Boolean(config.url && config.anonKey && window.supabase);
  const client = isConfigured ? window.supabase.createClient(config.url, config.anonKey) : null;

  function isDuplicateLegacyLimeError(error) {
    return error?.code === "23505" && /customers_legacy_lime_id_key|legacy_lime_id/i.test(error.message || "");
  }

  function normalizeDate(value) {
    if (!value) return null;
    const text = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function localIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function enrichedCustomers(seedCustomers) {
    const customers = (seedCustomers || []).map((customer) => ({ ...customer }));
    const enrichment = window.CRM_LIME_ENRICHMENT || { records: [] };
    const byName = new Map();
    const byEaccountingNumber = new Map();
    for (const customer of customers) {
      byName.set(normalizeMatch(customer.name), customer);
      if (customer.original_lime_name) byName.set(normalizeMatch(customer.original_lime_name), customer);
      if (customer.matched_eaccounting_customer_number) byEaccountingNumber.set(String(customer.matched_eaccounting_customer_number), customer);
    }
    for (const invoice of window.CRM_DATA?.invoices || []) {
      if (!invoice.customer_number || !invoice.lime_id) continue;
      const customer = customers.find((item) => item.lime_id === invoice.lime_id || item.legacy_lime_id === invoice.lime_id);
      if (customer) byEaccountingNumber.set(String(invoice.customer_number), customer);
    }
    for (const record of enrichment.records || []) {
      let customer = (record.limeId && customers.find((item) => item.lime_id === record.limeId || item.legacy_lime_id === record.limeId))
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
        customers.push(customer);
        byName.set(normalizeMatch(customer.name), customer);
        byEaccountingNumber.set(String(record.eaccountingCustomerNumber), customer);
      }
      if (!customer) continue;
      for (const [key, value] of Object.entries(record.fields || {})) {
        if (!value) continue;
        if (key === "next_service_due") {
          const today = localIsoDate(new Date());
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
    for (const customer of customers) applyModelDictionary(customer);
    return customers;
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

  function customerToDb(customer) {
    return {
      legacy_lime_id: customer.lime_id || customer.legacy_lime_id || null,
      source: customer.source || null,
      name: customer.name || "Uten navn",
      phone: customer.phone || null,
      email: customer.email || null,
      organization_number: customer.organization_number || null,
      visit_street: customer.visit_street || null,
      visit_zip: customer.visit_zip || null,
      visit_city: customer.visit_city || null,
      postal_street: customer.postal_street || null,
      postal_zip: customer.postal_zip || null,
      postal_city: customer.postal_city || null,
      location_tag: customer.location_tag || null,
      gps_coordinates: customer.gps_coordinates || null,
      google_maps: customer.google_maps || null,
      access_note: customer.access_note || null,
      brand: customer.brand || null,
      model_or_note: customer.model_or_note || null,
      first_install_date: normalizeDate(customer.first_install_date),
      last_service_date: normalizeDate(customer.last_service_date),
      next_service_due: normalizeDate(customer.next_service_due),
      pays_cash: Boolean(customer.pays_cash),
      service_status: customer.service_status || null,
      service_dates: customer.service_dates || null,
      tags: customer.tags || null,
      local_note: customer.local_note || customer.latest_deal_name || null,
      is_inactive: Boolean(customer.is_inactive),
    };
  }

  function customerFromDb(row) {
    return {
      ...row,
      lime_id: row.legacy_lime_id || row.id,
      first_install_date: row.first_install_date || "",
      last_service_date: row.last_service_date || "",
      next_service_due: row.next_service_due || "",
    };
  }

  function invoiceToDb(invoice, customerIdByLegacyId, customerIdByEaccountingNumber) {
    return {
      customer_id: customerIdByLegacyId.get(invoice.lime_id) || customerIdByEaccountingNumber.get(String(invoice.customer_number || "")) || null,
      legacy_lime_id: invoice.lime_id || null,
      source: invoice.source || null,
      invoice_number: invoice.invoice_number || null,
      voucher_number: invoice.voucher_number || null,
      invoice_date: normalizeDate(invoice.date),
      due_date: normalizeDate(invoice.due_date),
      amount: Number.isFinite(Number(invoice.amount)) ? Number(invoice.amount) : null,
      customer_name: invoice.customer_name || null,
      address: invoice.address || null,
      postal_code: invoice.postal_code || null,
      city: invoice.city || null,
      description: invoice.description || null,
      file_name: invoice.file_name || null,
      file_url: invoice.file_url || null,
    };
  }

  function installationToDb(installation, customerId) {
    const row = {
      customer_id: customerId,
      label: installation.label || "Anlegg",
      brand: installation.brand || null,
      model: installation.model || null,
      serial_number: installation.serial_number || null,
      installed_at: normalizeDate(installation.installed_at),
      last_service_at: normalizeDate(installation.last_service_at),
      next_service_due: normalizeDate(installation.next_service_due),
      notes: installation.notes || null,
    };
    if (isUuid(installation.location_id || installation.locationId)) row.location_id = installation.location_id || installation.locationId;
    if ("indoor_unit_model" in installation || "indoorUnitModel" in installation) row.indoor_unit_model = installation.indoor_unit_model || installation.indoorUnitModel || null;
    if ("outdoor_unit_model" in installation || "outdoorUnitModel" in installation) row.outdoor_unit_model = installation.outdoor_unit_model || installation.outdoorUnitModel || null;
    if ("indoor_serial_number" in installation || "indoorSerialNumber" in installation) row.indoor_serial_number = installation.indoor_serial_number || installation.indoorSerialNumber || null;
    if ("outdoor_serial_number" in installation || "outdoorSerialNumber" in installation) row.outdoor_serial_number = installation.outdoor_serial_number || installation.outdoorSerialNumber || null;
    if ("service_interval_months" in installation || "serviceIntervalMonths" in installation) {
      const months = Number(installation.service_interval_months || installation.serviceIntervalMonths || 0);
      row.service_interval_months = Number.isFinite(months) && months >= 0 ? months : 24;
    }
    if ("active" in installation) row.active = installation.active !== false;
    row.updated_at = new Date().toISOString();
    return row;
  }

  function locationToDb(location, customerId) {
    return {
      customer_id: customerId,
      location_name: location.location_name || location.locationName || "Anlegg",
      address: location.address || null,
      postal_code: location.postal_code || location.postalCode || null,
      city: location.city || null,
      location_type: location.location_type || location.locationType || "unknown",
      directions: location.directions || null,
      is_primary: Boolean(location.is_primary || location.isPrimary),
      updated_at: new Date().toISOString(),
    };
  }

  function bookingFromDb(row) {
    const starts = new Date(row.starts_at);
    const note = row.note || "";
    const isBefaring = /^\[Befaring\]/i.test(note);
    const isInsulation = /^\[(Blåseisolering|BlÃ¥seisolering|Blaseisolering)\]/i.test(note);
    const cleanNote = note.replace(/^\[(Befaring|Blåseisolering|BlÃ¥seisolering|Blaseisolering)\]\s*/i, "").trim();
    return {
      id: row.id,
      customerId: row.customer_id,
      date: Number.isNaN(starts.getTime()) ? "" : localIsoDate(starts),
      time: Number.isNaN(starts.getTime()) ? "" : starts.toTimeString().slice(0, 5),
      type: isInsulation ? "blaseisolering" : isBefaring ? "befaring" : row.job_type,
      duration: String(row.duration_minutes || 60),
      resource: row.assigned_name || "Hubert",
      note: isBefaring || isInsulation ? cleanNote : note,
      status: row.status || "booked",
      assigned_to: row.assigned_to || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      done_at: row.done_at || null,
    };
  }

  function bookingToDb(booking) {
    const startsAt = `${booking.date}T${booking.time || "09:00"}:00`;
    const jobType = jobTypeFor(booking.type || "service");
    return {
      customer_id: booking.customerId,
      assigned_name: booking.resource || "Hubert",
      job_type: jobType,
      starts_at: startsAt,
      duration_minutes: Number(booking.duration || 60),
      note: booking.note || null,
      status: booking.status || "booked",
    };
  }

  function bookingIdsForOrder(order) {
    if (Array.isArray(order?.bookingIds)) return order.bookingIds.map(String).filter(Boolean);
    if (Array.isArray(order?.booking_ids)) return order.booking_ids.map(String).filter(Boolean);
    return [];
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function jobTypeFor(value) {
    const type = String(value || "service").toLowerCase();
    if (type === "servicearbeid") return "reparasjon";
    if (["befaring", "installasjon", "service", "reparasjon", "reklamasjon", "blaseisolering", "utleie"].includes(type)) return type;
    if (type.includes("blase") || type.includes("bl")) return "blaseisolering";
    return "annet";
  }

  function workStatusForOrder(status) {
    if (status === "completed") return "completed";
    if (status === "cancelled") return "cancelled";
    if (status === "scheduled") return "planned";
    return "draft";
  }

  function billingStatusForJob(status) {
    if (status === "ready") return "ready_for_invoice";
    if (status === "sent") return "invoiced";
    if (status === "paid") return "not_ready";
    return "not_ready";
  }

  function paymentStatusForJob(status) {
    if (status === "paid") return "paid_on_site";
    if (status === "sent") return "unpaid";
    return "unknown";
  }

  function appointmentStatusForBooking(status) {
    if (status === "done") return "done";
    if (status === "cancelled") return "cancelled";
    return "planned";
  }

  function dateToTimestamp(value) {
    const date = normalizeDate(value);
    return date ? `${date}T00:00:00` : null;
  }

  function addMinutesToTimestamp(value, minutes) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setMinutes(date.getMinutes() + Number(minutes || 60));
    return date.toISOString();
  }

  function orderFromDb(row) {
    const bookingIds = Array.isArray(row.booking_ids) ? row.booking_ids : [];
    const note = row.note || "";
    const isInsulation = /^\[(Blåseisolering|BlÃ¥seisolering|Blaseisolering)\]/i.test(note);
    return {
      id: row.id,
      customerId: row.customer_id,
      customer_id: row.customer_id,
      title: row.title || "",
      type: isInsulation ? "blaseisolering" : row.job_type || "service",
      status: row.status || "unscheduled",
      billingStatus: row.billing_status || "not_ready",
      billing_status: row.billing_status || "not_ready",
      source: row.source || "manual",
      bookingIds,
      booking_ids: bookingIds,
      scheduledDate: row.scheduled_date || "",
      scheduledTime: row.scheduled_time || "",
      completedAt: row.completed_at || "",
      invoicedAt: row.invoiced_at || "",
      resource: row.resource || "",
      note: isInsulation ? note.replace(/^\[(Blåseisolering|BlÃ¥seisolering|Blaseisolering)\]\s*/i, "").trim() : note,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  }

  function orderToDb(order) {
    const type = order.type || order.job_type || "service";
    const note = order.note || "";
    return {
      customer_id: order.customerId || order.customer_id,
      title: order.title || "Ordre",
      job_type: jobTypeFor(type),
      status: order.status || "unscheduled",
      billing_status: order.billingStatus || order.billing_status || "not_ready",
      source: order.source || "manual",
      booking_ids: bookingIdsForOrder(order),
      scheduled_date: normalizeDate(order.scheduledDate || order.scheduled_date),
      scheduled_time: order.scheduledTime || order.scheduled_time || null,
      completed_at: normalizeDate(order.completedAt || order.completed_at),
      invoiced_at: normalizeDate(order.invoicedAt || order.invoiced_at),
      resource: order.resource || null,
      note: note || null,
    };
  }

  function leadStatusToDb(status) {
    if (status === "needs_offer") return "quote_needed";
    if (status === "offer_sent") return "quote_sent";
    if (status === "followup") return "follow_up";
    if (status === "won") return "won";
    if (status === "lost") return "lost";
    return "new";
  }

  function customerNameParts(customer) {
    const name = String(customer?.name || "").trim();
    if (!name) return { first_name: null, last_name: null, company_name: null };
    if (/\b(as|asa|enk|ans|da|ba)\b/i.test(name)) return { first_name: null, last_name: null, company_name: name };
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { first_name: parts[0] || null, last_name: null, company_name: null };
    return { first_name: parts[0], last_name: parts.slice(1).join(" "), company_name: null };
  }

  function leadFromCustomerToDb(customer, status, note) {
    const names = customerNameParts(customer);
    return {
      existing_customer_id: customer.id || null,
      ...names,
      phone: customer.phone || null,
      email: customer.email || null,
      postal_code: customer.visit_zip || customer.postal_zip || null,
      address: customer.visit_street || null,
      city: customer.visit_city || customer.location_tag || null,
      source: customer.source || "CRM",
      source_detail: "CRM lead-fane",
      product_interest: [customer.brand, customer.model_or_note].filter(Boolean).join(" ") || null,
      preferred_brand: customer.brand || null,
      status: leadStatusToDb(status),
      last_contact_at: new Date().toISOString(),
      won_at: status === "won" ? new Date().toISOString() : null,
      converted_customer_id: status === "won" ? customer.id || null : null,
    };
  }

  function orderToJobDb(orderId, order) {
    const billingStatus = order.billingStatus || order.billing_status || "not_ready";
    return {
      customer_id: order.customerId || order.customer_id || null,
      title: order.title || "Jobb",
      job_type: jobTypeFor(order.type || order.job_type),
      work_status: workStatusForOrder(order.status),
      billing_status: billingStatusForJob(billingStatus),
      payment_status: paymentStatusForJob(billingStatus),
      description: order.note || null,
      source_table: "orders",
      source_id: orderId,
      completed_at: dateToTimestamp(order.completedAt || order.completed_at),
      cancelled_at: order.status === "cancelled" ? new Date().toISOString() : null,
    };
  }

  async function findSingleBySource(supabase, table, sourceTable, sourceId) {
    if (!isUuid(sourceId)) return null;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }

  async function syncAppointmentsForJob(supabase, job, order) {
    if (!job?.id) return;
    const wantedBookingIds = bookingIdsForOrder(order).filter(isUuid);
    const { data: existingAppointments, error: appointmentError } = await supabase
      .from("appointments")
      .select("*")
      .eq("job_id", job.id)
      .eq("source_table", "bookings");
    if (appointmentError) throw appointmentError;

    const existingBySource = new Map((existingAppointments || []).map((row) => [String(row.source_id), row]));
    const wanted = new Set(wantedBookingIds);
    for (const row of existingAppointments || []) {
      if (wanted.has(String(row.source_id))) continue;
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
    }
    if (!wantedBookingIds.length) return;

    const { data: bookingRows, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .in("id", wantedBookingIds);
    if (bookingError) throw bookingError;

    for (const booking of bookingRows || []) {
      const startAt = booking.starts_at;
      const endAt = addMinutesToTimestamp(startAt, booking.duration_minutes);
      if (!startAt || !endAt) continue;
      const dbAppointment = {
        job_id: job.id,
        resource_profile_id: booking.assigned_to || null,
        start_at: startAt,
        end_at: endAt,
        status: appointmentStatusForBooking(booking.status),
        move_reason: null,
        source_table: "bookings",
        source_id: booking.id,
      };
      const existing = existingBySource.get(String(booking.id));
      const query = existing
        ? supabase.from("appointments").update(dbAppointment).eq("id", existing.id).select("*").single()
        : supabase.from("appointments").insert(dbAppointment).select("*").single();
      const { error } = await query;
      if (error) throw error;
    }
  }

  async function syncJobForOrder(supabase, orderId, order) {
    if (!isUuid(orderId)) return null;
    const dbJob = orderToJobDb(orderId, order);
    const existing = await findSingleBySource(supabase, "jobs", "orders", orderId);
    const query = existing
      ? supabase.from("jobs").update(dbJob).eq("id", existing.id).select("*").single()
      : supabase.from("jobs").insert(dbJob).select("*").single();
    const { data, error } = await query;
    if (error) throw error;
    await syncAppointmentsForJob(supabase, data, order);
    return data;
  }

  async function cancelAppointmentsForBooking(supabase, bookingId) {
    if (!isUuid(bookingId)) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("source_table", "bookings")
      .eq("source_id", bookingId);
    if (error) throw error;
  }

  async function cancelJobForOrder(supabase, orderId) {
    if (!isUuid(orderId)) return;
    const job = await findSingleBySource(supabase, "jobs", "orders", orderId);
    if (!job) return;
    const now = new Date().toISOString();
    const { error: appointmentError } = await supabase
      .from("appointments")
      .update({ status: "cancelled", updated_at: now })
      .eq("job_id", job.id);
    if (appointmentError) throw appointmentError;
    const { error: jobError } = await supabase
      .from("jobs")
      .update({ work_status: "cancelled", cancelled_at: now, updated_at: now })
      .eq("id", job.id);
    if (jobError) throw jobError;
  }

  async function syncAccessNote(supabase, customerId, note) {
    if (!isUuid(customerId)) return;
    const cleanNote = String(note || "").trim();
    const { data: existingRows, error: existingError } = await supabase
      .from("access_notes")
      .select("*")
      .eq("customer_id", customerId)
      .eq("note_type", "adkomst")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (existingError) throw existingError;
    const existing = existingRows?.[0] || null;
    const extra = (existingRows || []).slice(1);
    for (const row of extra) {
      const { error } = await supabase.from("access_notes").update({ active: false }).eq("id", row.id);
      if (error) throw error;
    }
    if (!cleanNote) {
      if (existing) {
        const { error } = await supabase.from("access_notes").update({ active: false }).eq("id", existing.id);
        if (error) throw error;
      }
      return;
    }
    const payload = { customer_id: customerId, note_type: "adkomst", note: cleanNote, active: true };
    const query = existing
      ? supabase.from("access_notes").update(payload).eq("id", existing.id)
      : supabase.from("access_notes").insert(payload);
    const { error } = await query;
    if (error) throw error;
  }

  function isOptionalOrdersError(error) {
    return error && (
      error.code === "42P01"
      || error.code === "42501"
      || /relation .* does not exist/i.test(error.message || "")
      || /Could not find the table/i.test(error.message || "")
      || /permission denied for table orders/i.test(error.message || "")
      || /orders/i.test(error.message || "") && /schema cache/i.test(error.message || "")
    );
  }

  function isOptionalIntakeError(error) {
    return error && (
      error.code === "42P01"
      || error.code === "42501"
      || /relation .* does not exist/i.test(error.message || "")
      || /Could not find the table/i.test(error.message || "")
      || /permission denied for table intake_items/i.test(error.message || "")
      || /intake_items/i.test(error.message || "") && /schema cache/i.test(error.message || "")
    );
  }

  function isBookingOverlapError(error) {
    return error && (
      error.code === "23P01"
      || /Booking overlap/i.test(error.message || "")
      || /Booking overlap/i.test(error.details || "")
    );
  }

  function bookingOverlapMessage(error) {
    const raw = `${error?.message || ""} ${error?.details || ""}`;
    const resource = raw.match(/Booking overlap:\s*([^\n]+?)\s+already has booking/i)?.[1]?.trim();
    return `Kan ikke lagre booking${resource ? ` for ${resource}` : ""}: tidspunktet overlapper med en annen jobb. Velg et ledig tidspunkt eller flytt den andre bookingen først.`;
  }

  async function requireClient() {
    if (!client) throw new Error(databaseUnavailableMessage);
    return client;
  }

  function withTimeout(promise, message, ms = 15000) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function fetchAllRows(queryFactory, pageSize = 1000, maxRows = 20000) {
    const rows = [];
    for (let from = 0; from < maxRows; from += pageSize) {
      const { data, error } = await queryFactory().range(from, from + pageSize - 1);
      if (error) return { data: rows, error };
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return { data: rows, error: null };
  }

  window.NumedalStore = {
    isConfigured,
    client,
    customerToDb,
    customerFromDb,
    bookingFromDb,
    bookingToDb,
    async session() {
      if (!client) return null;
      const { data } = await withTimeout(
        client.auth.getSession(),
        "Supabase svarer ikke på sesjonssjekk. Sjekk nett/refresh siden.",
      );
      return data.session || null;
    },
    async signIn(email, password) {
      const supabase = await requireClient();
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        "Innlogging mot Supabase svarer ikke. Sjekk at e-post/passord er riktig og at Supabase-prosjektet er aktivt.",
      );
      if (error) throw error;
      return data.session;
    },
    async signOut() {
      if (!client) return;
      await client.auth.signOut();
    },
    onAuthStateChange(callback) {
      if (!client || !callback) return { data: { subscription: { unsubscribe() {} } } };
      return client.auth.onAuthStateChange(callback);
    },
    async resetPassword(email, redirectTo) {
      const supabase = await requireClient();
      const { data, error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, { redirectTo }),
        "Supabase svarer ikke på passordreset. Prøv igjen eller kontakt administrator.",
      );
      if (error) throw error;
      return data;
    },
    async updatePassword(password) {
      const supabase = await requireClient();
      const { data, error } = await withTimeout(
        supabase.auth.updateUser({ password }),
        "Supabase svarer ikke på passordoppdatering. Prøv igjen eller kontakt administrator.",
      );
      if (error) throw error;
      return data;
    },
    async profile() {
      const supabase = await requireClient();
      const { data: userData, error: userError } = await withTimeout(
        supabase.auth.getUser(),
        "Supabase svarer ikke på brukeroppslag.",
      );
      if (userError) throw userError;
      const user = userData.user;
      if (!user) return null;
      const { data, error } = await withTimeout(
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        "Supabase svarer ikke på profiloppslag.",
      );
      if (error) throw error;
      if (!data || data.active === false) {
        throw new Error("Brukeren har ikke aktiv CRM-profil. Kontakt administrator.");
      }
      return data;
    },
    async loadAll() {
      const supabase = await requireClient();
      const orderRequest = supabase.from("orders").select("*").order("updated_at", { ascending: false });
      const [
        { data: customerRows, error: customerError },
        { data: bookingRows, error: bookingError },
        { data: invoiceRows, error: invoiceError },
        { data: serviceEventRows, error: serviceEventError },
        { data: installationRows, error: installationError },
        { data: locationRows, error: locationError },
        orderResult,
        { data: leadRows, error: leadError },
        { data: activityRows, error: activityError },
        { data: jobRows, error: jobError },
        { data: appointmentRows, error: appointmentError },
        { data: accessNoteRows, error: accessNoteError },
        { data: websiteSubmissionRows, error: websiteSubmissionError },
        { data: profileRows, error: profileError },
        intakeResult,
      ] = await Promise.all([
        fetchAllRows(() => supabase.from("customers").select("*").order("name")),
        fetchAllRows(() => supabase.from("bookings").select("*").neq("status", "cancelled").order("starts_at")),
        fetchAllRows(() => supabase.from("invoice_metadata").select("*").order("invoice_date", { ascending: false }), 1000, 10000),
        fetchAllRows(() => supabase.from("service_events").select("*").order("event_date", { ascending: false }), 1000, 20000),
        fetchAllRows(() => supabase.from("installations").select("*").order("created_at")),
        fetchAllRows(() => supabase.from("customer_locations").select("*").order("created_at")),
        orderRequest,
        supabase.from("leads").select("*").order("updated_at", { ascending: false }).limit(2000),
        supabase.from("activities").select("*").order("occurred_at", { ascending: false }).limit(2000),
        supabase.from("jobs").select("*").neq("work_status", "cancelled").order("updated_at", { ascending: false }).limit(2000),
        supabase.from("appointments").select("*").neq("status", "cancelled").order("start_at", { ascending: true }).limit(2000),
        supabase.from("access_notes").select("*").eq("active", true).order("updated_at", { ascending: false }).limit(2000),
        supabase.from("website_submissions").select("*").order("received_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("*").order("display_name"),
        supabase.from("intake_items").select("*").in("status", ["draft", "needs_review", "ready", "failed"]).order("created_at", { ascending: false }).limit(100),
      ]);
      if (customerError) throw customerError;
      if (bookingError) throw bookingError;
      if (invoiceError) throw invoiceError;
      if (serviceEventError) throw serviceEventError;
      if (installationError) throw installationError;
      if (locationError) throw locationError;
      if (orderResult.error && !isOptionalOrdersError(orderResult.error)) throw orderResult.error;
      if (leadError) throw leadError;
      if (activityError) throw activityError;
      if (jobError) throw jobError;
      if (appointmentError) throw appointmentError;
      if (accessNoteError) throw accessNoteError;
      if (websiteSubmissionError) throw websiteSubmissionError;
      if (profileError) throw profileError;
      if (intakeResult.error && !isOptionalIntakeError(intakeResult.error)) throw intakeResult.error;
      return {
        customers: (customerRows || []).map(customerFromDb),
        bookings: Object.fromEntries((bookingRows || []).map((row) => [row.id, bookingFromDb(row)])),
        orders: orderResult.error ? null : Object.fromEntries((orderResult.data || []).map((row) => [row.id, orderFromDb(row)])),
        invoices: (invoiceRows || []).map((row) => ({
          ...row,
          lime_id: row.legacy_lime_id,
          date: row.invoice_date,
        })),
        serviceEvents: serviceEventRows || [],
        installations: installationRows || [],
        customerLocations: locationRows || [],
        leads: leadRows || [],
        activities: activityRows || [],
        jobs: jobRows || [],
        appointments: appointmentRows || [],
        accessNotes: accessNoteRows || [],
        websiteSubmissions: websiteSubmissionRows || [],
        profiles: profileRows || [],
        intakeItems: intakeResult.error ? [] : intakeResult.data || [],
      };
    },
    async saveProfile(id, patch) {
      const supabase = await requireClient();
      if (!isUuid(id)) throw new Error("Ugyldig brukerprofil.");
      const dbPatch = {};
      if ("display_name" in patch) dbPatch.display_name = String(patch.display_name || "").trim();
      if ("full_name" in patch) dbPatch.full_name = String(patch.full_name || "").trim() || null;
      if ("phone" in patch) dbPatch.phone = String(patch.phone || "").trim() || null;
      if ("role" in patch) dbPatch.role = patch.role === "admin" ? "admin" : "technician";
      if ("active" in patch) dbPatch.active = Boolean(patch.active);
      dbPatch.updated_at = new Date().toISOString();
      if (!dbPatch.display_name && "display_name" in dbPatch) throw new Error("Navn kan ikke være tomt.");
      const { data, error } = await supabase.from("profiles").update(dbPatch).eq("id", id).select("*").single();
      if (error) throw error;
      return data;
    },
    async saveOrder(id, order) {
      const supabase = await requireClient();
      const dbOrder = orderToDb(order);
      const query = id && !String(id).startsWith("order-")
        ? supabase.from("orders").update(dbOrder).eq("id", id).select("*").single()
        : supabase.from("orders").insert(dbOrder).select("*").single();
      const { data, error } = await query;
      if (error) throw error;
      const saved = orderFromDb(data);
      const job = await syncJobForOrder(supabase, data.id, saved);
      if (job?.id) {
        saved.jobId = job.id;
        saved.job_id = job.id;
      }
      return saved;
    },
    async repairOrderJobMirror(id, order) {
      const supabase = await requireClient();
      if (!isUuid(id)) throw new Error("Kan ikke opprette jobbspeil for ordre uten database-id.");
      return syncJobForOrder(supabase, id, { ...order, id });
    },
    async deleteOrder(id) {
      const supabase = await requireClient();
      await cancelJobForOrder(supabase, id);
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    async saveCustomer(customer) {
      const supabase = await requireClient();
      const dbCustomer = customerToDb(customer);
      const customerId = String(customer.id || "");
      const isSupabaseId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerId);
      let query;
      if (isSupabaseId) {
        const updateCustomer = { ...dbCustomer };
        delete updateCustomer.legacy_lime_id;
        query = supabase.from("customers").update(updateCustomer).eq("id", customer.id).select("*").single();
      } else if (dbCustomer.legacy_lime_id) {
        query = supabase.from("customers").upsert(dbCustomer, { onConflict: "legacy_lime_id" }).select("*").single();
      } else {
        query = supabase.from("customers").insert(dbCustomer).select("*").single();
      }
      const { data, error } = await query;
      if (error) {
        if (isDuplicateLegacyLimeError(error) && dbCustomer.legacy_lime_id) {
          const { data: existing, error: lookupError } = await supabase
            .from("customers")
            .select("id")
            .eq("legacy_lime_id", dbCustomer.legacy_lime_id)
            .maybeSingle();
          if (!lookupError && existing?.id) {
            const updateCustomer = { ...dbCustomer };
            delete updateCustomer.legacy_lime_id;
            const { data: retryData, error: retryError } = await supabase
              .from("customers")
              .update(updateCustomer)
              .eq("id", existing.id)
              .select("*")
              .single();
            if (retryError) throw retryError;
            await syncAccessNote(supabase, retryData.id, dbCustomer.access_note);
            return customerFromDb(retryData);
          }
        }
        throw error;
      }
      await syncAccessNote(supabase, data.id, dbCustomer.access_note);
      return customerFromDb(data);
    },
    async deleteCustomer(customer) {
      const supabase = await requireClient();
      const id = customer.id || customer.lime_id;
      const { error } = await supabase.from("customers").update({ is_inactive: true }).eq("id", id);
      if (error) throw error;
    },
    async saveBooking(id, booking) {
      const supabase = await requireClient();
      const dbBooking = bookingToDb(booking);
      const query = id && !String(id).startsWith("booking-")
        ? supabase.from("bookings").update(dbBooking).eq("id", id).select("*").single()
        : supabase.from("bookings").insert(dbBooking).select("*").single();
      const { data, error } = await query;
      if (error) {
        if (isBookingOverlapError(error)) throw new Error(bookingOverlapMessage(error));
        throw error;
      }
      return { id: data.id, booking: bookingFromDb(data) };
    },
    async saveCustomerLocation(customerId, location) {
      const supabase = await requireClient();
      if (!isUuid(customerId)) throw new Error("Ugyldig kunde for anleggsadresse.");
      const dbLocation = locationToDb(location, customerId);
      const id = location?.id || "";
      const query = isUuid(id)
        ? supabase.from("customer_locations").update(dbLocation).eq("id", id).select("*").single()
        : supabase.from("customer_locations").insert(dbLocation).select("*").single();
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    async saveInstallation(customerId, installation) {
      const supabase = await requireClient();
      if (!isUuid(customerId)) throw new Error("Ugyldig kunde for varmepumpe/anlegg.");
      const dbInstallation = installationToDb(installation, customerId);
      const id = installation?.id || "";
      const query = isUuid(id)
        ? supabase.from("installations").update(dbInstallation).eq("id", id).select("*").single()
        : supabase.from("installations").insert(dbInstallation).select("*").single();
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    async saveInstallationPatch(id, patch) {
      const supabase = await requireClient();
      const dbPatch = {};
      if ("location_id" in patch || "locationId" in patch) {
        const locationId = patch.location_id || patch.locationId;
        dbPatch.location_id = isUuid(locationId) ? locationId : null;
      }
      if ("label" in patch) dbPatch.label = patch.label || "Anlegg";
      if ("brand" in patch) dbPatch.brand = patch.brand || null;
      if ("model" in patch) dbPatch.model = patch.model || null;
      if ("serial_number" in patch || "serialNumber" in patch) dbPatch.serial_number = patch.serial_number || patch.serialNumber || null;
      if ("installed_at" in patch) dbPatch.installed_at = normalizeDate(patch.installed_at);
      if ("last_service_at" in patch) dbPatch.last_service_at = normalizeDate(patch.last_service_at);
      if ("next_service_due" in patch) dbPatch.next_service_due = normalizeDate(patch.next_service_due);
      if ("service_interval_months" in patch || "serviceIntervalMonths" in patch) {
        const months = Number(patch.service_interval_months || patch.serviceIntervalMonths || 0);
        dbPatch.service_interval_months = Number.isFinite(months) && months >= 0 ? months : 24;
      }
      if ("active" in patch) dbPatch.active = patch.active !== false;
      if ("notes" in patch) dbPatch.notes = patch.notes || null;
      dbPatch.updated_at = new Date().toISOString();
      if (!Object.keys(dbPatch).length) return { id };
      const { data, error } = await supabase
        .from("installations")
        .update(dbPatch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async cancelBooking(id) {
      const supabase = await requireClient();
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      await cancelAppointmentsForBooking(supabase, id);
    },
    async markBookingDone(id, done, options = {}) {
      const supabase = await requireClient();
      const completedAt = options.completedAt || new Date().toISOString();
      if (done) {
        const { error } = await supabase.rpc("complete_job", {
          p_booking_id: id,
          p_note: options.note || null,
          p_completed_at: completedAt,
        });
        if (!error) return;
        if (!/function .*complete_job/i.test(error.message || "")) throw error;
      }
      const { error } = await supabase.from("bookings").update({
        status: done ? "done" : "booked",
        done_at: done ? completedAt : null,
      }).eq("id", id);
      if (error) throw error;
      const status = done ? "done" : "planned";
      const { data: appointmentRows, error: appointmentError } = await supabase
        .from("appointments")
        .select("id, job_id")
        .eq("source_table", "bookings")
        .eq("source_id", id);
      if (appointmentError) throw appointmentError;
      for (const appointment of appointmentRows || []) {
        const { error: updateAppointmentError } = await supabase
          .from("appointments")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", appointment.id);
        if (updateAppointmentError) throw updateAppointmentError;
        if (appointment.job_id) {
          const { error: updateJobError } = await supabase
            .from("jobs")
            .update({ work_status: done ? "completed" : "planned", completed_at: done ? completedAt : null })
            .eq("id", appointment.job_id);
          if (updateJobError) throw updateJobError;
        }
      }
    },
    async completeBookingAsAdmin(id, options = {}) {
      const supabase = await requireClient();
      const completedOn = normalizeDate(options.completedOn || options.completedAt) || localIsoDate(new Date());
      const { data, error } = await supabase.rpc("complete_booking_as_admin", {
        p_booking_id: id,
        p_completed_on: completedOn,
        p_event_type: options.eventType || null,
        p_event_note: options.eventNote || null,
        p_booking_note: options.bookingNote || null,
        p_order_id: isUuid(options.orderId) ? options.orderId : null,
        p_order_note: options.orderNote || null,
        p_billing_status: options.billingStatus || "not_ready",
        p_payment_mode: options.paymentMode || null,
        p_payment_done: Boolean(options.paymentDone),
        p_next_action: options.nextAction || "none",
        p_next_service_due: normalizeDate(options.nextServiceDate),
        p_installation_id: isUuid(options.installationId) ? options.installationId : null,
        p_customer_note_line: options.customerNoteLine || null,
      });
      if (error) throw error;
      return data || {};
    },
    async markBookingNeedsMove(id, reason, options = {}) {
      const supabase = await requireClient();
      const markedAt = normalizeDate(options.markedAt || options.date) || localIsoDate(new Date());
      const eventNote = options.eventNote || null;
      const { data, error } = await supabase.rpc("mark_booking_needs_move", {
        p_booking_id: id,
        p_reason: reason || null,
        p_marked_at: markedAt,
        p_event_note: eventNote,
      });
      if (error) throw error;
      return {
        id: data,
        customer_id: options.customerId || null,
        event_date: markedAt,
        event_type: "Må flyttes",
        note: eventNote,
        created_at: new Date().toISOString(),
      };
    },
    async saveServiceEvent(event) {
      const supabase = await requireClient();
      const customerId = event.customerId || event.customer_id;
      const rpcResult = await supabase.rpc("add_service_event", {
        p_customer_id: customerId,
        p_event_date: normalizeDate(event.event_date),
        p_event_type: event.event_type || "Historikk",
        p_note: event.note || null,
      });
      if (!rpcResult.error && rpcResult.data) {
        return {
          id: rpcResult.data,
          customer_id: customerId,
          event_date: normalizeDate(event.event_date),
          event_type: event.event_type || "Historikk",
          note: event.note || null,
          created_at: new Date().toISOString(),
        };
      }
      if (rpcResult.error && !/function .*add_service_event/i.test(rpcResult.error.message || "")) throw rpcResult.error;
      const { data, error } = await supabase
        .from("service_events")
        .insert({
          customer_id: customerId,
          event_date: normalizeDate(event.event_date),
          event_type: event.event_type || "Historikk",
          note: event.note || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async saveLeadFromCustomer(customer, status, note) {
      const supabase = await requireClient();
      if (!customer?.id || !isUuid(customer.id)) return null;
      const dbLead = leadFromCustomerToDb(customer, status, note);
      const { data: existingRows, error: existingError } = await supabase
        .from("leads")
        .select("*")
        .eq("existing_customer_id", customer.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (existingError) throw existingError;
      const existing = existingRows?.[0] || null;
      const query = existing
        ? supabase.from("leads").update(dbLead).eq("id", existing.id).select("*").single()
        : supabase.from("leads").insert(dbLead).select("*").single();
      const { data, error } = await query;
      if (error) throw error;
      const { error: activityError } = await supabase.from("activities").insert({
        customer_id: customer.id,
        lead_id: data.id,
        activity_type: "status_change",
        summary: `Lead: ${data.status}`,
        body: note || null,
        metadata: { crm_status: status || "new" },
      });
      if (activityError) throw activityError;
      return data;
    },
    async saveLeadDraft(values) {
      const supabase = await requireClient();
      const name = String(values?.name || "").trim();
      const isCompany = /\b(as|asa|enk|ans|da|ba)\b/i.test(name);
      const parts = isCompany ? [] : name.split(/\s+/).filter(Boolean);
      const dbLead = {
        existing_customer_id: values?.customer_id || null,
        first_name: isCompany ? null : parts[0] || null,
        last_name: isCompany ? null : parts.slice(1).join(" ") || null,
        company_name: isCompany ? name : null,
        phone: values?.phone || null,
        email: values?.email || null,
        postal_code: values?.zip || values?.postal_code || null,
        address: values?.street || values?.address || null,
        city: values?.city || null,
        location_type: values?.location_type || null,
        source: values?.source || "Hurtigregistrering",
        source_detail: values?.source_detail || "Kontrollert hurtigregistrering",
        product_interest: [values?.brand, values?.model, values?.type].filter(Boolean).join(" ") || values?.note || null,
        preferred_brand: values?.brand || null,
        raw_submission_id: isUuid(values?.raw_submission_id) ? values.raw_submission_id : null,
        status: leadStatusToDb(values?.lead_status || "followup"),
        last_contact_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("leads").insert(dbLead).select("*").single();
      if (error) throw error;
      const { error: activityError } = await supabase.from("activities").insert({
        customer_id: isUuid(values?.customer_id) ? values.customer_id : null,
        lead_id: data.id,
        activity_type: "intake",
        summary: "Lead opprettet fra hurtigregistrering",
        body: values?.note || null,
        metadata: {
          intake_source: "hurtigregistrering",
          action: values?.action || "create_lead",
          parser: values?.parser || "simple_text_recognition",
          source_intake_id: values?.source_intake_id || null,
          original_kept: Boolean(values?.keepOriginal),
          original_text: values?.keepOriginal ? values?.raw || null : null,
        },
      });
      if (activityError) throw activityError;
      return data;
    },
    async saveActivity(activity = {}) {
      const supabase = await requireClient();
      const dbActivity = {
        customer_id: isUuid(activity.customer_id || activity.customerId) ? (activity.customer_id || activity.customerId) : null,
        lead_id: isUuid(activity.lead_id || activity.leadId) ? (activity.lead_id || activity.leadId) : null,
        location_id: isUuid(activity.location_id || activity.locationId) ? (activity.location_id || activity.locationId) : null,
        installation_id: isUuid(activity.installation_id || activity.installationId) ? (activity.installation_id || activity.installationId) : null,
        job_id: isUuid(activity.job_id || activity.jobId) ? (activity.job_id || activity.jobId) : null,
        actor_profile_id: isUuid(activity.actor_profile_id || activity.actorProfileId) ? (activity.actor_profile_id || activity.actorProfileId) : null,
        activity_type: activity.activity_type || activity.activityType || "note",
        summary: activity.summary || "CRM-aktivitet",
        body: activity.body || null,
        metadata: activity.metadata && typeof activity.metadata === "object" ? activity.metadata : {},
        occurred_at: activity.occurred_at || activity.occurredAt || new Date().toISOString(),
      };
      const { data, error } = await supabase.from("activities").insert(dbActivity).select("*").single();
      if (error) throw error;
      return data;
    },
    async updateLead(id, patch = {}) {
      const supabase = await requireClient();
      if (!isUuid(id)) throw new Error("Ugyldig lead-id.");
      const dbPatch = {};
      if ("existing_customer_id" in patch) dbPatch.existing_customer_id = isUuid(patch.existing_customer_id) ? patch.existing_customer_id : null;
      if ("converted_customer_id" in patch) dbPatch.converted_customer_id = isUuid(patch.converted_customer_id) ? patch.converted_customer_id : null;
      if ("status" in patch) {
        dbPatch.status = leadStatusToDb(patch.status);
        if (patch.status === "won") dbPatch.won_at = new Date().toISOString();
        if (patch.status === "lost") dbPatch.lost_reason = patch.lost_reason || null;
      }
      if ("product_interest" in patch) dbPatch.product_interest = patch.product_interest || null;
      if ("source_detail" in patch) dbPatch.source_detail = patch.source_detail || null;
      if (!Object.keys(dbPatch).length) throw new Error("Ingen lead-endringer å lagre.");
      dbPatch.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from("leads").update(dbPatch).eq("id", id).select("*").single();
      if (error) throw error;
      return data;
    },
    async updateWebsiteSubmission(id, patch = {}) {
      const supabase = await requireClient();
      if (!isUuid(id)) throw new Error("Ugyldig nettsideinnsending-id.");
      const dbPatch = {};
      const statuses = ["new", "read", "duplicate_possible", "processed", "invalid", "spam", "failed"];
      if ("processing_status" in patch && statuses.includes(patch.processing_status)) {
        dbPatch.processing_status = patch.processing_status;
      }
      for (const key of ["created_lead_id", "created_customer_id", "created_job_id", "created_activity_id"]) {
        if (key in patch) dbPatch[key] = isUuid(patch[key]) ? patch[key] : null;
      }
      if (!Object.keys(dbPatch).length) return null;
      const { data, error } = await supabase
        .from("website_submissions")
        .update(dbPatch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async analyzeIntake(payload) {
      const supabase = await requireClient();
      const { data, error } = await supabase.functions.invoke("analyze-intake", {
        body: {
          text: payload?.text || "",
          source_kind: payload?.source_kind || "pasted_text",
          attachment_count: Number(payload?.attachment_count || 0),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.analysis || data;
    },
    async saveIntakeDraft(values) {
      const supabase = await requireClient();
      const raw = String(values?.raw || values?.text || "").trim();
      if (!raw) throw new Error("Mangler tekst for innboks-utkast.");
      const selectedCustomerId = isUuid(values?.customer_id) ? values.customer_id : null;
      const analysis = values?.analysis || {};
      const finalJson = {
        action: values?.action || null,
        type: values?.type || null,
        name: values?.name || null,
        phone: values?.phone || null,
        email: values?.email || null,
        street: values?.street || null,
        zip: values?.zip || null,
        city: values?.city || null,
        tags: values?.tags || null,
        brand: values?.brand || null,
        model: values?.model || null,
        note: values?.note || null,
        keepOriginal: Boolean(values?.keepOriginal),
      };
      const { data, error } = await supabase
        .from("intake_items")
        .insert({
          source_kind: values?.source_kind || analysis?.source?.kind || "pasted_text",
          source_channel: values?.source_channel || "crm_hurtigregistrering",
          source_subject: values?.source_subject || null,
          raw_text: raw,
          extracted_text: raw,
          status: "needs_review",
          analysis_json: analysis || {},
          final_json: finalJson,
          suggested_action: analysis?.recommendedAction || values?.action || null,
          selected_action: values?.action || null,
          linked_customer_id: selectedCustomerId,
          schema_version: analysis?.schemaVersion || "local-1",
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async updateIntakeItem(id, patch = {}) {
      const supabase = await requireClient();
      if (!isUuid(id)) throw new Error("Ugyldig innboks-id.");
      const dbPatch = {};
      if ("status" in patch) dbPatch.status = patch.status;
      if ("selected_action" in patch) dbPatch.selected_action = patch.selected_action || null;
      if ("linked_customer_id" in patch) dbPatch.linked_customer_id = isUuid(patch.linked_customer_id) ? patch.linked_customer_id : null;
      if ("linked_lead_id" in patch) dbPatch.linked_lead_id = isUuid(patch.linked_lead_id) ? patch.linked_lead_id : null;
      if ("linked_job_id" in patch) dbPatch.linked_job_id = isUuid(patch.linked_job_id) ? patch.linked_job_id : null;
      if ("linked_quote_id" in patch) dbPatch.linked_quote_id = isUuid(patch.linked_quote_id) ? patch.linked_quote_id : null;
      if ("final_json" in patch) dbPatch.final_json = patch.final_json || {};
      if ("analysis_json" in patch) dbPatch.analysis_json = patch.analysis_json || {};
      if ("corrections_json" in patch) dbPatch.corrections_json = patch.corrections_json || {};
      if (patch.status === "committed") dbPatch.committed_at = new Date().toISOString();
      if (patch.status === "discarded") dbPatch.discarded_at = new Date().toISOString();
      if (!Object.keys(dbPatch).length) return null;
      const { data, error } = await supabase
        .from("intake_items")
        .update(dbPatch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    async discardIntakeItem(id) {
      return this.updateIntakeItem(id, { status: "discarded" });
    },
    async importSeed(seedData) {
      const supabase = await requireClient();
      if (!browserImportEnabled) {
        throw new Error("Nettleserimport er deaktivert i produksjon. Bruk kontrollert server-side import/migrering.");
      }
      const seedCustomers = enrichedCustomers(seedData.customers || []);
      const customers = seedCustomers.map(customerToDb);
      const insertedCustomers = [];
      for (let start = 0; start < customers.length; start += 250) {
        window.dispatchEvent(new CustomEvent("numedal-import-progress", { detail: `Importerer kunder ${start + 1}-${Math.min(start + 250, customers.length)} av ${customers.length}` }));
        const chunk = customers.slice(start, start + 250);
        const { data, error } = await supabase
          .from("customers")
          .upsert(chunk, { onConflict: "legacy_lime_id" })
          .select("id, legacy_lime_id");
        if (error) throw error;
        insertedCustomers.push(...(data || []));
      }
      const customerIdByLegacyId = new Map(insertedCustomers.map((row) => [row.legacy_lime_id, row.id]));
      const customerIdByName = new Map();
      const customerIdByEaccountingNumber = new Map();
      for (const customer of seedCustomers) {
        const id = customerIdByLegacyId.get(customer.lime_id || customer.legacy_lime_id);
        if (id) customerIdByName.set(normalizeMatch(customer.name), id);
        if (id && customer.original_lime_name) customerIdByName.set(normalizeMatch(customer.original_lime_name), id);
        if (id && customer.matched_eaccounting_customer_number) customerIdByEaccountingNumber.set(String(customer.matched_eaccounting_customer_number), id);
        const eaccountingId = String(customer.lime_id || customer.legacy_lime_id || "").match(/^eaccounting-(.+)$/);
        if (id && eaccountingId) customerIdByEaccountingNumber.set(eaccountingId[1], id);
      }
      const invoices = (seedData.invoices || []).map((invoice) => invoiceToDb(invoice, customerIdByLegacyId, customerIdByEaccountingNumber));
      const { error: deleteInvoiceError } = await supabase
        .from("invoice_metadata")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (deleteInvoiceError) throw deleteInvoiceError;
      for (let start = 0; start < invoices.length; start += 500) {
        window.dispatchEvent(new CustomEvent("numedal-import-progress", { detail: `Importerer fakturaer ${start + 1}-${Math.min(start + 500, invoices.length)} av ${invoices.length}` }));
        const chunk = invoices.slice(start, start + 500);
        const { error } = await supabase.from("invoice_metadata").insert(chunk);
        if (error) throw error;
      }
      const installationEnrichment = window.CRM_LIME_INSTALLATIONS || { records: [] };
      const installations = [];
      for (const record of installationEnrichment.records || []) {
        const customerId = (record.limeId && customerIdByLegacyId.get(record.limeId))
          || customerIdByName.get(normalizeMatch(record.matchName));
        if (!customerId) continue;
        for (const installation of record.installations || []) {
          installations.push(installationToDb(installation, customerId));
        }
      }
      const { error: deleteInstallationError } = await supabase
        .from("installations")
        .delete()
        .like("notes", "%Kilde: Lime Go-deal%");
      if (deleteInstallationError) throw deleteInstallationError;
      for (let start = 0; start < installations.length; start += 500) {
        window.dispatchEvent(new CustomEvent("numedal-import-progress", { detail: `Importerer varmepumper/anlegg ${start + 1}-${Math.min(start + 500, installations.length)} av ${installations.length}` }));
        const chunk = installations.slice(start, start + 500);
        if (!chunk.length) continue;
        const { error } = await supabase.from("installations").insert(chunk);
        if (error) throw error;
      }
      const enrichment = window.CRM_LIME_ENRICHMENT || { records: [] };
      const serviceEvents = [];
      for (const record of enrichment.records || []) {
        const customerId = (record.limeId && customerIdByLegacyId.get(record.limeId))
          || customerIdByName.get(normalizeMatch(record.matchName));
        if (!customerId) continue;
        for (const entry of record.history || []) {
          serviceEvents.push({
            customer_id: customerId,
            event_date: normalizeDate(entry.event_date),
            event_type: entry.event_type || "Lime Go oppgave",
            note: `${entry.title || "Lime Go oppgave"}\n${entry.description || ""}\nKilde: ${record.source || enrichment.source || "Lime Go"}`.trim(),
          });
        }
      }
      const { error: deleteServiceEventError } = await supabase
        .from("service_events")
        .delete()
        .like("note", "%Kilde: Lime Go%");
      if (deleteServiceEventError) throw deleteServiceEventError;
      for (let start = 0; start < serviceEvents.length; start += 500) {
        window.dispatchEvent(new CustomEvent("numedal-import-progress", { detail: `Importerer historikk ${start + 1}-${Math.min(start + 500, serviceEvents.length)} av ${serviceEvents.length}` }));
        const chunk = serviceEvents.slice(start, start + 500).filter((entry) => entry.event_date);
        if (!chunk.length) continue;
        const { error } = await supabase.from("service_events").insert(chunk);
        if (error) throw error;
      }
      return { customers: customers.length, invoices: invoices.length, serviceEvents: serviceEvents.length, installations: installations.length };
    },
  };
})();

