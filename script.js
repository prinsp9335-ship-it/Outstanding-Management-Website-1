

// ⚡ Supabase Configuration
const SUPABASE_URL = "https://vwmmekqsncajubsqoitd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_saFTZ0xJ4l1yoEUCeDNmZQ_2IonEsgU";
const PAGE_SIZE = 100;

let allRows = [];
let filteredRows = [];
let currentPage = 1;
let currentSheet = "outstanding";
let sortKey = "";
let sortDirection = 1;

const $ = id => document.getElementById(id);

// 🔢 Helper Functions
function number(value) {
  const n = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return "₹" + number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function keyName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function get(row, names) {
  if (!row) return "";

  const keys = Object.keys(row);

  for (const name of names) {
    const key = keys.find(k => keyName(k) === keyName(name));

    if (
      key !== undefined &&
      row[key] !== "" &&
      row[key] !== null &&
      row[key] !== undefined
    ) {
      return row[key];
    }
  }

  return "";
}

function amount(row) {
  return number(get(row, [
    "Amount",
    "Bill Amount",
    "Bill_Amount",
    "Total Amount"
  ]));
}

function recovery(row) {
  const explicit = get(row, [
    "Recovery",
    "Recovery Amount",
    "Recovered Amount"
  ]);

  if (explicit !== "") return number(explicit);

  return (
    number(get(row, ["Cash"])) +
    number(get(row, ["Online"])) +
    number(get(row, ["Cheque", "Cheaque", "Cheques"]))
  );
}

function pending(row) {
  const explicit = get(row, [
    "Pending",
    "Pending.....",
    "Outstanding",
    "Balance"
  ]);

  if (explicit !== "") return number(explicit);

  return Math.max(0, amount(row) - recovery(row));
}

// 📅 Date Helpers
function parseDate(row) {
  const raw = get(row, [
    "Date",
    "Bill Date",
    "Sale Date",
    "Created Date",
    "created_at"
  ]);

  if (!raw) return null;

  const value = String(raw).trim();
  let match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);

  if (match) {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const month = months.findIndex(
      m => m.toLowerCase() === match[2].toLowerCase()
    );

    if (month >= 0) {
      return new Date(+match[3], month, +match[1]);
    }
  }

  match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (match) {
    return new Date(+match[3], +match[2] - 1, +match[1]);
  }

  match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (match) {
    return new Date(+match[1], +match[2] - 1, +match[3]);
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date) {
  if (!date) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekOf(date) {
  if (!date) return { key: "", label: "No date" };

  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const fmt = d => d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });

  return {
    key: dateKey(start),
    label: `${fmt(start)} – ${fmt(end)}`
  };
}

function weekday(row) {
  const saved = get(row, ["Weekday", "Day"]);

  if (saved) return String(saved);

  const d = parseDate(row);

  return d
    ? d.toLocaleDateString("en-IN", { weekday: "long" })
    : "";
}

// 💳 Payment Status
function status(row) {
  const s = String(
    get(row, ["Status", "Payment Status", "Bill Status"])
  ).toLowerCase();

  if (s.includes("part")) return "part";
  if (s.includes("paid") || pending(row) <= 0) return "paid";

  return "due";
}

function statusHTML(row) {
  const s = status(row);

  const label =
    s === "paid" ? "Paid" :
    s === "part" ? "Part Paid" : "Due";

  return `<span class="status-badge status-${s}">${label}</span>`;
}

// 🛡️ HTML Safety
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// 📍 LOCATION LINK FIX
function locationHTML(value) {
  const raw = String(value ?? "").trim();

  if (!raw) return "—";

  // Google Maps links and other direct HTTP/HTTPS URLs
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        return escapeHTML(raw);
      }

      return `<a href="${escapeHTML(parsed.href)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open location in a new tab">📍 Open Location</a>`;
    } catch (_) {
      return escapeHTML(raw);
    }
  }

  // Google Maps short links or maps.google.com links without a scheme
  if (/^(www\.)?(google\.[^/]+\/maps|maps\.google\.[^/]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(raw)) {
    return `<a href="https://${escapeHTML(raw)}"
                target="_blank"
                rel="noopener noreferrer">📍 Open Location</a>`;
  }

  // Coordinates such as 28.4595,77.0266
  const coordinates = raw.match(
    /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/
  );

  if (coordinates) {
    const lat = Number(coordinates[1]);
    const lon = Number(coordinates[2]);

    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      const mapURL =
        `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}`;

      return `<a href="${mapURL}"
                  target="_blank"
                  rel="noopener noreferrer">📍 Open Location</a>`;
    }
  }

  // Plain address or location text
  const searchURL =
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;

  return `<a href="${searchURL}"
              target="_blank"
              rel="noopener noreferrer">📍 Search Location</a>`;
}

function showToast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  setTimeout(() => el.classList.remove("show"), 2500);
}

// 🔒 Switch Sheet
function switchSheet(tableName, btnElement) {
  if (tableName.toLowerCase() === "master_sales_data") {
    const password = prompt(
      "Access Restricted! Enter Password to view Master Sales Data:"
    );

    if (password !== "ascend") {
      alert("Incorrect Password! Access Denied.");
      return;
    }
  }

  document.querySelectorAll(".tab-btn, [data-sheet]")
    .forEach(b => b.classList.remove("active"));

  if (btnElement) btnElement.classList.add("active");

  currentSheet = tableName;
  currentPage = 1;
  sortKey = "";
  sortDirection = 1;

  const brandFilter = $("brandFilter");
  const mrpFilter = $("mrpFilter");

  if (currentSheet.toLowerCase() === "sku_master_data") {
    if (brandFilter) brandFilter.style.display = "inline-block";
    if (mrpFilter) mrpFilter.style.display = "inline-block";
  } else {
    if (brandFilter) {
      brandFilter.style.display = "none";
      brandFilter.value = "";
    }

    if (mrpFilter) {
      mrpFilter.style.display = "none";
      mrpFilter.value = "";
    }
  }

  if ($("pageTitle")) {
    $("pageTitle").textContent =
      currentSheet.replace(/_/g, " ") + " Overview";
  }

  if ($("tableTitle")) {
    $("tableTitle").textContent =
      currentSheet.replace(/_/g, " ") + " Bills";
  }

  loadSheetData();
}

// 📡 Load Data from Supabase
async function loadSheetData() {
  const tableBody = $("tableBody");
  const tableHead = $("tableHead");

  let targetTable = currentSheet;

  if (currentSheet.toLowerCase() === "outstanding") {
    targetTable = "Outstanding";
  }

  const displayName =
    targetTable === "DA Sheet"
      ? "DA Sheet (Automation)"
      : targetTable;

  if (tableBody) {
    tableBody.innerHTML =
      `<tr><td class="loading" colspan="18">Loading ${escapeHTML(displayName)} Data from Supabase...</td></tr>`;
  }

  if (tableHead) tableHead.innerHTML = "";

  try {
    const endpoint =
      `${SUPABASE_URL}/rest/v1/${encodeURIComponent(targetTable)}?select=*&limit=50000`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch data from Supabase";

      try {
        const errData = await response.json();
        errorMessage = errData.message || errData.details || errorMessage;
      } catch (_) {}

      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Supabase response is not a data array.");
    }

    allRows = data;

    populateUsers();
    populateWeeks();

    if (currentSheet.toLowerCase() === "sku_master_data") {
      populateSkuDropdowns();
    }

    filterAndRender();

    showToast(`${allRows.length} records loaded successfully!`);
  } catch (error) {
    console.error("Supabase loading error:", error);

    if (tableBody) {
      tableBody.innerHTML =
        `<tr><td class="loading" style="color:red" colspan="18">Error fetching data: ${escapeHTML(error.message)}</td></tr>`;
    }
  }
}

// 👥 User / GTM Filter
function populateUsers() {
  const select = $("userFilter");

  if (!select) return;

  const previous = select.value;

  const userKey = allRows.length
    ? Object.keys(allRows[0]).find(
        k => k.toLowerCase().includes("user") ||
             k.toLowerCase().includes("gtm")
      )
    : null;

  const values = userKey
    ? [...new Set(
        allRows.map(r => String(r[userKey] || "").trim()).filter(Boolean)
      )].sort()
    : [];

  select.innerHTML =
    '<option value="">All Users / GTM</option>' +
    values.map(v =>
      `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`
    ).join("");

  select.value = values.includes(previous) ? previous : "";
}

// 📅 Week Filter
function populateWeeks() {
  const select = $("weekFilter");

  if (!select) return;

  const previous = select.value;
  const weeks = new Map();

  allRows.forEach(row => {
    const w = weekOf(parseDate(row));
    if (w.key) weeks.set(w.key, w.label);
  });

  const ordered = [...weeks.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]));

  select.innerHTML =
    '<option value="">All Weeks</option>' +
    ordered.map(([key, label]) =>
      `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`
    ).join("");

  if (weeks.has(previous)) select.value = previous;
}

// 📦 SKU Dropdowns
function populateSkuDropdowns() {
  const brandFilter = $("brandFilter");
  const mrpFilter = $("mrpFilter");

  if (!brandFilter || !mrpFilter) return;

  brandFilter.innerHTML = '<option value="">All Brands</option>';
  mrpFilter.innerHTML = '<option value="">All MRP (Per Pcs)</option>';

  const brands = new Set();
  const mrps = new Set();

  allRows.forEach(row => {
    const brand = get(row, ["brand", "Brand"]);
    const mrp = get(row, ["mrp_per_pcs", "MRP Per Pcs"]);

    if (brand !== "") brands.add(String(brand));
    if (mrp !== "") mrps.add(String(mrp));
  });

  [...brands].sort().forEach(b => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    brandFilter.appendChild(opt);
  });

  [...mrps].sort((a, b) => number(a) - number(b)).forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    mrpFilter.appendChild(opt);
  });
}

// 📆 Date Filter
function passesDate(row) {
  const dateFilter = $("dateFilter");

  if (!dateFilter) return true;

  const mode = dateFilter.value;

  if (!mode || mode === "all") return true;

  const d = parseDate(row);

  if (!d) return false;

  const day = new Date();
  day.setHours(0, 0, 0, 0);

  const date = new Date(d);
  date.setHours(0, 0, 0, 0);

  if (mode === "today") {
    return date.getTime() === day.getTime();
  }

  if (mode === "yesterday") {
    const yest = new Date(day);
    yest.setDate(yest.getDate() - 1);
    return date.getTime() === yest.getTime();
  }

  if (mode === "this_month") {
    const startOfMonth = new Date(
      day.getFullYear(),
      day.getMonth(),
      1
    );

    return date >= startOfMonth && date <= day;
  }

  if (mode === "7" || mode === "30") {
    const from = new Date(day);
    from.setDate(from.getDate() - Number(mode) + 1);

    return date >= from && date <= day;
  }

  if (mode === "custom") {
    const from = $("startDate")?.value
      ? new Date($("startDate").value + "T00:00:00")
      : null;

    const to = $("endDate")?.value
      ? new Date($("endDate").value + "T23:59:59")
      : null;

    return (!from || date >= from) && (!to || date <= to);
  }

  return true;
}

// 🔍 Filters + Sorting
function filterAndRender() {
  const query = ($("searchBox")?.value || "").trim().toLowerCase();
  const user = $("userFilter")?.value || "";
  const day = $("weekdayFilter")?.value || "";
  const week = $("weekFilter")?.value || "";
  const payment = $("statusFilter")?.value || "";
  const selectedBrand = $("brandFilter")?.value || "";
  const selectedMrp = $("mrpFilter")?.value || "";

  filteredRows = allRows.filter(row => {
    if (
      query &&
      !Object.values(row).join(" ").toLowerCase().includes(query)
    ) {
      return false;
    }

    if (
      user &&
      String(get(row, ["User", "GTM", "Salesperson", "Sales Person"])).trim() !== user
    ) {
      return false;
    }

    if (day && weekday(row).toLowerCase() !== day.toLowerCase()) {
      return false;
    }

    if (week && weekOf(parseDate(row)).key !== week) {
      return false;
    }

    if (payment && status(row) !== payment) {
      return false;
    }

    if (currentSheet.toLowerCase() === "sku_master_data") {
      if (
        selectedBrand &&
        String(get(row, ["brand", "Brand"])).trim() !== selectedBrand
      ) {
        return false;
      }

      if (
        selectedMrp &&
        String(get(row, ["mrp_per_pcs", "MRP Per Pcs"])) !== selectedMrp
      ) {
        return false;
      }
    }

    if (!passesDate(row)) return false;

    return true;
  });
// Yeh rahi wo 1 line jo yahan lagani hai:
  if (!sortKey && filteredRows.length > 0) { sortKey = Object.keys(filteredRows[0]).find(k => ["bill_no", "billno", "bill number", "bill no"].includes(keyName(k))) || ""; sortDirection = 1; }
  if (sortKey) {
    filteredRows.sort((a, b) => {
      const av = get(a, [sortKey]);
      const bv = get(b, [sortKey]);

      const an = Number(av);
      const bn = Number(bv);

      if (
        av !== "" &&
        bv !== "" &&
        Number.isFinite(an) &&
        Number.isFinite(bn)
      ) {
        return (an - bn) * sortDirection;
      }

      return String(av ?? "").localeCompare(
        String(bv ?? ""),
        undefined,
        { numeric: true }
      ) * sortDirection;
    });
  }

  currentPage = 1;

  updateSummary();
  renderTable();
}

// 📊 Summary Cards
function updateSummary() {
  if ($("totalAmountSum")) {
    $("totalAmountSum").textContent =
      money(filteredRows.reduce((s, r) => s + amount(r), 0));
  }

  if ($("totalRecoverySum")) {
    $("totalRecoverySum").textContent =
      money(filteredRows.reduce((s, r) => s + recovery(r), 0));
  }

  if ($("totalPendingSum")) {
    $("totalPendingSum").textContent =
      money(filteredRows.reduce((s, r) => s + pending(r), 0));
  }

  if ($("totalBillsCount")) {
    $("totalBillsCount").textContent =
      filteredRows.length.toLocaleString("en-IN");
  }
}

// 📋 Default Columns — Other Tabs
const defaultColumns = [
  ["Distributor", ["Distributor"], "text"],
  ["Delivery Date", ["Delivery Date"], "text"],
  ["Date", ["Date", "Bill Date", "Sale Date"], "date"],
  ["Weekday", [], "weekday"],
  ["GTM / User", ["User", "GTM", "Salesperson", "Sales Person"], "text"],
  ["Outlet Name", ["Outlet_Name", "Outlet Name", "Outlet"], "text"],
  [
    "Outlet ID",
    [
      "Outlet_ID",
      "Outlet ID",
      "Outlet Id",
      "OutletID",
      "OutletId",
      "Outlet Code",
      "Outlet_Code",
      "Customer Outlet ID"
    ],
    "text"
  ],
  ["Bill No", ["Bill_No", "Bill No", "Bill Number"], "text"],
  ["Bill Amount", ["Amount", "Bill Amount", "Bill_Amount", "Total Amount"], "amount"],
  ["Recovery", ["Recovery", "Recovery Amount", "Recovered Amount"], "recovery"],
  ["Pending", ["Pending", "Pending Amount", "Outstanding", "Balance"], "pending"],
  ["Rider", ["Rider Name", "Rider_Name", "Rider", "DA"], "text"],
  ["Status", ["Status", "Payment Status", "Bill Status"], "status"],
  ["Description", ["Description", "Description", "Description"]],
   ["Reating", ["Reating", "Reating.", "Outlet Rating","Reting..."], "text"]
];

// 🧾 Master_Sales_Data — EXACT 18 COLUMNS
const masterSalesColumns = [
  ["Delivery Date", ["Delivery Date"], "text"],
  ["Sale Date", ["Sale Date"], "date"],
  ["User", ["User"], "text"],
  ["Outlet_Name", ["Outlet_Name", "Outlet Name"], "text"],
  [
    "Outlet_ID",
    ["Outlet_ID", "Outlet ID", "Outlet Id", "OutletID", "Outlet Code"],
    "text"
  ],
  ["Bill_No", ["Bill_No", "Bill No", "Bill Number"], "text"],
  ["Amount", ["Amount"], "amount"],
  ["Cash", ["Cash"], "text"],
  ["Online", ["Online"], "text"],
  ["Credit", ["Credit"], "text"],
  ["Cheaque", ["Cheaque", "Cheque", "Cheques"], "text"],
  ["Rider", ["Rider"], "text"],
  ["Status", ["Status"], "text"],
  ["Panel status", ["Panel status", "Panel_Status", "PanelStatus"], "text"],
  ["Diff", ["Diff"], "text"],
  ["Category", ["Category"], "text"],
  ["Expire", ["Expire"], "text"],
  ["Description", ["Description"], "text"],
  ["Reating", ["Reating", "Reating.", "Outlet Rating","Reting..."], "text"]
];

// 🚚 DA Sheet — FIXED 14 COLUMNS
const daSheetColumns = [
  ["Sale Date", ["Sale Date"], "date"],
  ["User", ["User"], "text"],
  ["Outlet name", ["Outlet_Name", "Outlet name", "Outlet Name"], "text"],
  ["Bill_No", ["Bill_No", "Bill No", "Bill Number"], "text"],
  ["Amount", ["Amount"], "amount"],
  ["Cash", ["Cash"], "text"],
  ["Online", ["Online"], "text"],
  ["Credit", ["Credit"], "text"],
  ["Pending", ["Pending", "Pending Amount", "Outstanding", "Balance"], "pending"],
  ["Credit Allow", ["Credit Allow", "Credit_Allow", "Credit Allowance"], "text"],
  ["Status", ["Status"], "text"],
  ["Location", ["Location", "Map Link", "Location Link"], "location"],
  ["Rider", ["Rider", "Rider Name", "Rider_Name", "DA"], "text"],
  ["Reating", ["Reating", "Reating.", "Outlet Rating"], "text"]
];
const finalDataColumns = [
  ["Distributor", ["Distributor"], "text"],
  ["Date", ["Date", "Sale Date"], "date"],
  ["User", ["User"], "text"],
  ["Outlet name", ["Outlet name", "Outlet_Name", "Outlet Name"], "text"],
  ["Outlet_ID", ["Outlet_ID", "Outlet ID", "Outlet Id"], "text"],
  ["Bill_No", ["Bill_No", "Bill No", "Bill Number"], "text"],
  ["Amount", ["Amount"], ],
  ["Cash", ["Cash"], ],
  ["Online", ["Online"], ],
  ["Credit", ["Credit"], ],
  ["Cheques", ["Cheques", "Cheque", "Check"], ],
  ["Rider name", ["Rider name", "Rider_Name", "Rider", "DA"], "text"],
  ["Remark", ["Remark", "Remarks"], "text"],
  ["Recovery", ["Recovery"], "amount"],
  ["Pending.....", ["Pending.....", "Pending", "Pending Amount", "Outstanding"], "pending"],
  ["CN", ["CN"], "text"],
  ["Description", ["Description"], "text"],
  ["No", ["No"], "text"],
  ["Mon", ["Mon"], "text"],
  ["Reating.", ["Reating.", "Reating", "Rating"], "text"]
];

// 🧱 Render Cell
function cell(row, column) {
  const [label, aliases, type] = column;
  const value = get(row, aliases.length ? aliases : [label]);

  if (type === "location") {
    return `<td>${locationHTML(value)}</td>`;
  }

  if (type === "date") {
    const d = parseDate(row);

    return `<td>${
      d
        ? escapeHTML(d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          }))
        : escapeHTML(value || "—")
    }</td>`;
  }

  if (type === "week") {
    return `<td><span class="week-badge">${escapeHTML(weekOf(parseDate(row)).label)}</span></td>`;
  }

  if (type === "weekday") {
    return `<td>${escapeHTML(weekday(row) || "—")}</td>`;
  }

  if (type === "amount") {
    return `<td class="amount-cell">${money(amount(row))}</td>`;
  }

  if (type === "recovery") {
    return `<td class="recovery-cell">${money(recovery(row))}</td>`;
  }

  if (type === "pending") {
    return `<td class="pending-cell">${money(pending(row))}</td>`;
  }

  if (type === "status") {
    return `<td>${statusHTML(row)}</td>`;
  }

  const stringVal = String(value ?? "").trim();

  // Make URLs clickable in other tabs too
  if (/^https?:\/\//i.test(stringVal)) {
    return `<td><a href="${escapeHTML(stringVal)}" target="_blank" rel="noopener noreferrer">📍 Open Link</a></td>`;
  }

  return `<td>${escapeHTML(stringVal || "—")}</td>`;
}

// 📊 Main Table Rendering
function renderTable() {
  const tableHead = $("tableHead");
  const tableBody = $("tableBody");

  if (!tableHead || !tableBody) return;

  let activeColumns = defaultColumns;
  const sheetName = currentSheet.toLowerCase();

  if (sheetName === "master_sales_data") {
  activeColumns = masterSalesColumns;

} else if (sheetName === "da sheet") {
  activeColumns = daSheetColumns;

} else if (sheetName === "final data") {
  activeColumns = finalDataColumns;

} else if (sheetName === "sku_master_data") {
  if (filteredRows.length > 0) {
    const keys = Object.keys(filteredRows[0])
      .filter(k => k !== "id");

      activeColumns = keys.map(k => [
        k.replace(/_/g, " "),
        [k],
        "text"
      ]);
    }
  } else if (
    filteredRows.length > 0 &&
    !get(filteredRows[0], ["Amount", "Bill Amount", "Bill_Amount"])
  ) {
    const keys = Object.keys(filteredRows[0])
      .filter(k => k !== "id");

    activeColumns = keys.map(k => [
      k.replace(/_/g, " "),
      [k],
      "text"
    ]);
  }

  tableHead.innerHTML =
    "<tr>" +
    activeColumns.map((c, i) =>
      `<th data-index="${i}">${escapeHTML(c[0])} ↕</th>`
    ).join("") +
    "</tr>";

  tableHead.querySelectorAll("th").forEach(th => {
    th.onclick = () => {
      const col = activeColumns[Number(th.dataset.index)];
      const newKey = col[1][0] || col[0];

      if (sortKey === newKey) {
        sortDirection *= -1;
      } else {
        sortKey = newKey;
        sortDirection = 1;
      }

      filterAndRender();
    };
  });

  const pages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  currentPage = Math.min(currentPage, pages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filteredRows.slice(start, start + PAGE_SIZE);

  tableBody.innerHTML = visible.length
    ? visible.map(row =>
        `<tr>${activeColumns.map(col => cell(row, col)).join("")}</tr>`
      ).join("")
    : `<tr><td class="loading" colspan="${activeColumns.length}">No matching records found.</td></tr>`;

  if ($("recordCount")) {
    $("recordCount").textContent =
      `Showing ${visible.length ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, filteredRows.length)} of ${filteredRows.length} records`;
  }

  if ($("pageInfo")) {
    $("pageInfo").textContent = `Page ${currentPage} of ${pages}`;
  }

  if ($("prevPage")) $("prevPage").disabled = currentPage <= 1;
  if ($("nextPage")) $("nextPage").disabled = currentPage >= pages;
}

// 🧹 Clear Filters
function clearFilters() {
  if ($("searchBox")) $("searchBox").value = "";
  if ($("userFilter")) $("userFilter").value = "";
  if ($("dateFilter")) $("dateFilter").value = "all";
  if ($("weekdayFilter")) $("weekdayFilter").value = "";
  if ($("weekFilter")) $("weekFilter").value = "";
  if ($("statusFilter")) $("statusFilter").value = "";
  if ($("startDate")) $("startDate").value = "";
  if ($("endDate")) $("endDate").value = "";
  if ($("brandFilter")) $("brandFilter").value = "";
  if ($("mrpFilter")) $("mrpFilter").value = "";

  if ($("customDates")) $("customDates").classList.add("hidden");

  if ($("customDateContainer")) {
    $("customDateContainer").style.display = "none";
  }

  filterAndRender();
}

// 📤 Export CSV
function exportCSV() {
  if (!filteredRows.length) {
    showToast("No data to export");
    return;
  }

  const headings = Object.keys(filteredRows[0])
    .filter(k => k !== "id");

  const data = filteredRows.map(row =>
    headings.map(k => row[k])
  );

  const csv = [headings, ...data].map(row =>
    row.map(v =>
      `"${String(v ?? "").replace(/"/g, '""')}"`
    ).join(",")
  ).join("\r\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `${currentSheet.replace(/[^a-z0-9_-]/gi, "_")}_export.csv`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

// 📱 Sidebar
function toggleSidebar() {
  if ($("sidebar")) $("sidebar").classList.toggle("open");
  if ($("overlay")) $("overlay").classList.toggle("active");
}

// 🚀 Initialize Dashboard
document.addEventListener("DOMContentLoaded", () => {
  if ($("searchBox")) {
    $("searchBox").addEventListener("input", filterAndRender);
  }

  [
    "userFilter",
    "dateFilter",
    "weekdayFilter",
    "weekFilter",
    "statusFilter",
    "startDate",
    "endDate",
    "brandFilter",
    "mrpFilter"
  ].forEach(id => {
    if ($(id)) {
      $(id).addEventListener("change", () => {
        if (id === "dateFilter") {
          const isCustom = $(id).value === "custom";

          if ($("customDates")) {
            $("customDates").classList.toggle("hidden", !isCustom);
          }

          if ($("customDateContainer")) {
            $("customDateContainer").style.display =
              isCustom ? "inline-flex" : "none";
          }
        }

        filterAndRender();
      });
    }
  });

  if ($("clearBtn")) {
    $("clearBtn").addEventListener("click", clearFilters);
  }

  if ($("toggleFiltersBtn")) {
    $("toggleFiltersBtn").addEventListener("click", () => {
      const filters = $("filters");

      if (!filters) return;

      const hidden = filters.classList.toggle("filters-hidden");

      $("toggleFiltersBtn").textContent =
        hidden ? "Show Filters" : "Hide Filters";
    });
  }

  if ($("compactToggle")) {
    $("compactToggle").addEventListener("change", e => {
      document.body.classList.toggle(
        "compact-off",
        !e.target.checked
      );
    });
  }

  if ($("prevPage")) {
    $("prevPage").addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
  }

  if ($("nextPage")) {
    $("nextPage").addEventListener("click", () => {
      if (currentPage < Math.ceil(filteredRows.length / PAGE_SIZE)) {
        currentPage++;
        renderTable();
      }
    });
  }

  if ($("exportBtn")) {
    $("exportBtn").addEventListener("click", exportCSV);
  }

  if ($("darkModeBtn")) {
    $("darkModeBtn").addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
    });
  }

  document.querySelectorAll("[data-sheet], .tab-btn").forEach(button => {
    button.addEventListener("click", () => {
      const targetSheet =
        button.dataset.sheet ||
        button.getAttribute("onclick")?.match(/'([^']+)'/)?.[1] ||
        button.textContent.trim();

      switchSheet(targetSheet, button);
    });
  });

  currentSheet = "outstanding";
  loadSheetData();
});
