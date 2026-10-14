// ⚡ Supabase Configuration
const SUPABASE_URL = "https://vwmmekqsncajubsqoitd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_saFTZ0xJ4l1yoEUCeDNmZQ_2IonEsgU";

let currentSheet = "outstanding"; // Default table name
let allData = [];
let filteredData = [];
let sortDirection = false;

// ⚡ Performance Pagination & Debounce State
let currentPage = 1;
const rowsPerPage = 100;
let debounceTimer;

function switchSheet(tableName, btnElement) {
    // 🔒 Protection: Sirf 'Master_Sales_Data' button par password mangega
    if (tableName === 'Master_Sales_Data') {
        const password = prompt("🔒 Access Restricted! Enter Password to view Master Sales Data:");
        if (password !== "ascend") { 
            alert("❌ Incorrect Password! Access Denied.");
            return;
        }
    }

    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btnElement.classList.add("active");
    currentSheet = tableName;
    currentPage = 1;

    // 🟢 Dropdown visibility control: Sirf 'sku_master_data' par Brand & MRP dropdowns dikhenge
    const brandFilter = document.getElementById("brandFilter");
    const mrpFilter = document.getElementById("mrpFilter");

    if (currentSheet === "sku_master_data") {
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

    loadSheetData();
}

async function loadSheetData() {
    const tableBody = document.getElementById("tableBody");
    const tableHead = document.getElementById("tableHead");
    
    let targetTable = currentSheet;
    if (currentSheet.toLowerCase() === "outstanding") {
        targetTable = "Outstanding";
    }

    let displayName = targetTable === 'DA Sheet' ? 'DA Sheet (Automation)' : targetTable;
    tableBody.innerHTML = `<tr><td class="loading" colspan="15">Loading ${displayName} Data from Supabase...</td></tr>`;
    tableHead.innerHTML = "";

    try {
        const endpoint = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(targetTable)}?select=*&limit=50000`;
        
        const response = await fetch(endpoint, {
            method: "GET",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "Failed to fetch data from Supabase");
        }
        
        const data = await response.json();
        
        allData = data;
        filteredData = [...allData];

        populateUsers();
        populateDates();
        
        // Agar current sheet SKU Master Data hai toh dropdowns ki values populate karo
        if (currentSheet === "sku_master_data") {
            populateSkuDropdowns();
        }

        filterAndRender();
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td class="loading" style="color:red;" colspan="15">❌ Error fetching data: ${error.message}</td></tr>`;
    }
}

function populateUsers() {
    const userFilter = document.getElementById("userFilter");
    if (!userFilter) return;

    userFilter.innerHTML = `<option value="">All Users (GTM)</option>`;

    if (!allData.length) return;
    
    const userKey = Object.keys(allData[0]).find(k => k.toLowerCase().includes("user"));
    if (!userKey) return;

    const users = [...new Set(allData.map(row => String(row[userKey] || "").trim()).filter(u => u !== ""))].sort();

    users.forEach(user => {
        const opt = document.createElement("option");
        opt.value = user;
        opt.textContent = user;
        userFilter.appendChild(opt);
    });
}

function populateDates() {
    const dateFilter = document.getElementById("dateFilter");
    if (!dateFilter) return;

    dateFilter.innerHTML = `
        <option value="">All Dates</option>
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="this_month">This Month</option>
        <option value="custom">Custom Date Range 📅</option>
    `;
}

// 🟢 SKU Master Data ke liye Brand aur MRP values dropdown mein bhadne ka function
function populateSkuDropdowns() {
    const brandFilter = document.getElementById("brandFilter");
    const mrpFilter = document.getElementById("mrpFilter");

    if (!brandFilter || !mrpFilter) return;

    brandFilter.innerHTML = '<option value="">All Brands</option>';
    mrpFilter.innerHTML = '<option value="">All MRP (Per Pcs)</option>';

    let brands = new Set();
    let mrps = new Set();

    allData.forEach(row => {
        // Tumhare Supabase columns ke exact names ke according
        if (row.brand) brands.add(row.brand);
        if (row.mrp_per_pcs !== undefined && row.mrp_per_pcs !== null) mrps.add(row.mrp_per_pcs);
    });

    brands.forEach(b => {
        let opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        brandFilter.appendChild(opt);
    });

    Array.from(mrps).sort((a, b) => Number(a) - Number(b)).forEach(m => {
        let opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        mrpFilter.appendChild(opt);
    });
}

function toggleCustomDateInputs() {
    const dateFilter = document.getElementById("dateFilter");
    const customContainer = document.getElementById("customDateContainer");
    if (dateFilter && customContainer) {
        customContainer.style.display = (dateFilter.value === "custom") ? "inline-flex" : "none";
    }
}

// ⚡ Fast Typing Debounce Function
function debouncedFilter() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        currentPage = 1;
        filterAndRender();
    }, 300);
}

function filterAndRender() {
    const searchVal = (document.getElementById("searchBox")?.value || "").toLowerCase().trim();
    const selectedUser = document.getElementById("userFilter")?.value || "";
    const selectedDateFilter = document.getElementById("dateFilter")?.value || "";
    const selectedBrand = document.getElementById("brandFilter")?.value || "";
    const selectedMrp = document.getElementById("mrpFilter")?.value || "";

    if (!allData.length) {
        renderTable([]);
        return;
    }

    const userKey = Object.keys(allData[0]).find(k => k.toLowerCase().includes("user"));
    const dateKey = Object.keys(allData[0]).find(k => k.toLowerCase().includes("date"));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let customStart = null;
    let customEnd = null;
    if (selectedDateFilter === "custom") {
        const sVal = document.getElementById("startDate")?.value;
        const eVal = document.getElementById("endDate")?.value;
        if (sVal) customStart = new Date(sVal);
        if (eVal) {
            customEnd = new Date(eVal);
            customEnd.setHours(23, 59, 59, 999);
        }
    }

    filteredData = allData.filter(row => {
        const matchesSearch = searchVal === "" || Object.values(row).some(val => String(val).toLowerCase().includes(searchVal));
        const matchesUser = !selectedUser || (userKey && String(row[userKey]).trim() === selectedUser);

        // SKU Master Specific Dropdown Filters
        let matchesBrand = true;
        let matchesMrp = true;
        if (currentSheet === "sku_master_data") {
            if (selectedBrand && String(row.brand || "").trim() !== selectedBrand) matchesBrand = false;
            if (selectedMrp && String(row.mrp_per_pcs ?? "") !== selectedMrp) matchesMrp = false;
        }

        let matchesDate = true;
        if (selectedDateFilter && dateKey && row[dateKey]) {
            const rowDate = new Date(row[dateKey]);
            rowDate.setHours(0, 0, 0, 0);

            if (!isNaN(rowDate.getTime())) {
                if (selectedDateFilter === "today") {
                    matchesDate = rowDate.getTime() === today.getTime();
                } else if (selectedDateFilter === "yesterday") {
                    matchesDate = rowDate.getTime() === yesterday.getTime();
                } else if (selectedDateFilter === "this_month") {
                    matchesDate = rowDate >= startOfMonth && rowDate <= today;
                } else if (selectedDateFilter === "custom") {
                    if (customStart && rowDate < customStart) matchesDate = false;
                    if (customEnd && rowDate > customEnd) matchesDate = false;
                }
            }
        }

        return matchesSearch && matchesUser && matchesBrand && matchesMrp && matchesDate;
    });

    renderTable(filteredData);
}

// 📅 Date Formatter
function formatDate(dateString) {
    if (!dateString) return "";
    let d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    
    let day = String(d.getDate()).padStart(2, '0');
    let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let month = months[d.getMonth()];
    let year = d.getFullYear();
    
    return `${day}-${month}-${year}`;
}

// 📊 Stats Calculation
function updateStats(data) {
    let totalAmount = 0;
    let totalPending = 0;
    let billCount = data.length;

    if (data.length > 0) {
        const headers = Object.keys(data[0]);
        
        const amountKey = headers.find(h => h.toLowerCase().includes("amount"));
        const pendingKey = headers.find(h => h.toLowerCase().includes("pending") || h.toLowerCase().includes("balance"));

        data.forEach(row => {
            if (amountKey) {
                let amt = parseFloat(row[amountKey]);
                if (!isNaN(amt)) totalAmount += amt;
            }
            if (pendingKey) {
                let pend = parseFloat(row[pendingKey]);
                if (!isNaN(pend)) totalPending += pend;
            }
        });
    }

    const amtElem = document.getElementById("totalAmountSum");
    const pendElem = document.getElementById("totalPendingSum");
    const countElem = document.getElementById("totalBillsCount");

    if (amtElem) amtElem.textContent = "₹ " + totalAmount.toLocaleString('en-IN');
    if (pendElem) pendElem.textContent = "₹ " + totalPending.toLocaleString('en-IN');
    if (countElem) countElem.textContent = billCount.toLocaleString('en-IN');
}

// ⚡ Ultra-Fast DOM DocumentFragment Render Function
function renderTable(data) {
    const tableHead = document.getElementById("tableHead");
    const tableBody = document.getElementById("tableBody");
    
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    updateStats(data);

    if (!data.length) {
        tableBody.innerHTML = `<tr><td class="loading" colspan="15">No Data Found</td></tr>`;
        renderPagination(0);
        return;
    }

    const headers = Object.keys(data[0]).filter(h => h !== "id");

    // Header Setup
    let headerRow = document.createElement("tr");
    headers.forEach(header => {
        let th = document.createElement("th");
        th.textContent = header.replace(/_/g, " ");
        th.onclick = () => sortTable(header);
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // ⚡ Pagination Slicing
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedData = data.slice(startIndex, startIndex + rowsPerPage);

    // ⚡ Background Fragment Painting (No Browser Freeze)
    const fragment = document.createDocumentFragment();

    paginatedData.forEach(row => {
        let tr = document.createElement("tr");
        headers.forEach(header => {
            let td = document.createElement("td");
            let val = row[header];

            if (val !== undefined && val !== null && val !== "") {
                let stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                let lowerHeader = header.toLowerCase();

                if (lowerHeader.includes("date")) {
                    td.textContent = formatDate(stringVal);
                } else if (lowerHeader.includes("location") || stringVal.startsWith("http://") || stringVal.startsWith("https://")) {
                    let a = document.createElement("a");
                    a.href = stringVal;
                    a.textContent = "📍 Open Map";
                    a.target = "_blank";
                    td.appendChild(a);
                } else {
                    td.textContent = stringVal;
                }
            } else {
                td.textContent = "";
            }

            tr.appendChild(td);
        });
        fragment.appendChild(tr);
    });

    tableBody.appendChild(fragment);
    renderPagination(data.length);
}

// 📄 Pagination Controls Generator
function renderPagination(totalRows) {
    let paginationContainer = document.getElementById("paginationControls");
    
    if (!paginationContainer) {
        paginationContainer = document.createElement("div");
        paginationContainer.id = "paginationControls";
        paginationContainer.style.cssText = "display: flex; gap: 10px; align-items: center; justify-content: center; margin: 15px 0;";
        const table = document.querySelector("table");
        if (table && table.parentNode) {
            table.parentNode.insertBefore(paginationContainer, table.nextSibling);
        }
    }

    const totalPages = Math.ceil(totalRows / rowsPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
    }

    paginationContainer.innerHTML = `
        <button onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}>◀ Prev</button>
        <span>Page <strong>${currentPage}</strong> of <strong>${totalPages}</strong></span>
        <button onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}>Next ▶</button>
    `;
}

function changePage(step) {
    currentPage += step;
    renderTable(filteredData);
}

function sortTable(column) {
    sortDirection = !sortDirection;
    filteredData.sort((a, b) => {
        let valA = a[column] !== undefined ? a[column] : "";
        let valB = b[column] !== undefined ? b[column] : "";

        if (!isNaN(valA) && valA !== "" && !isNaN(valB) && valB !== "") {
            return sortDirection ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
        }
        return sortDirection ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
    renderTable(filteredData);
}

function clearAllFilters() {
    const searchBox = document.getElementById("searchBox");
    const userFilter = document.getElementById("userFilter");
    const dateFilter = document.getElementById("dateFilter");
    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");
    const brandFilter = document.getElementById("brandFilter");
    const mrpFilter = document.getElementById("mrpFilter");

    if (searchBox) searchBox.value = "";
    if (userFilter) userFilter.value = "";
    if (dateFilter) dateFilter.value = "";
    if (startDate) startDate.value = "";
    if (endDate) endDate.value = "";
    if (brandFilter) brandFilter.value = "";
    if (mrpFilter) mrpFilter.value = "";

    toggleCustomDateInputs();
    currentPage = 1;
    filterAndRender();
}

// App Initialization
currentSheet = "outstanding";
loadSheetData();
