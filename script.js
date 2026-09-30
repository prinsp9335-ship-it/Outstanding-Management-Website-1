// ⚡ Supabase Configuration
const SUPABASE_URL = "https://vwmmekqsncajubsqoitd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_saFTZ0xJ4l1yoEUCeDNmZQ_2IonEsgU";

let currentSheet = "outstanding"; // Default table name
let allData = [];
let filteredData = [];
let sortDirection = false;

function switchSheet(tableName, btnElement) {
    // 🔒 Specific Protection: Sirf 'Master_Sales_Data' button par password mangega
    if (tableName === 'Master_Sales_Data') {
        const password = prompt("🔒 Access Restricted! Enter Password to view Master Sales Data:");
        
        // Yahan apna man-pasand password set kar sakte ho (e.g., "1234" ya "admin123")
        if (password !== "ascend") { 
            alert("❌ Incorrect Password! Access Denied.");
            return; // Galat password par tab switch nahi hoga
        }
    }

    // Pass password, tab normal switch karega
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btnElement.classList.add("active");
    currentSheet = tableName;
    loadSheetData();
}

async function loadSheetData() {
    const tableBody = document.getElementById("tableBody");
    const tableHead = document.getElementById("tableHead");
    
    // 🔍 Target Table Declaration & Case Sensitivity Fix
    let targetTable = currentSheet;
    if (currentSheet.toLowerCase() === "outstanding") {
        targetTable = "Outstanding";
    }

    let displayName = targetTable === 'DA Sheet' ? 'DA Sheet (Automation)' : targetTable;
    tableBody.innerHTML = `<tr><td class="loading" colspan="15">Loading ${displayName} Data from Supabase...</td></tr>`;
    tableHead.innerHTML = "";

    try {
        // 🚀 URL Encoding + 50,000 Row Limit (Override 1000 limit)
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
        filterAndRender();
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td class="loading" style="color:red;" colspan="15">❌ Error fetching data from Supabase: ${error.message}</td></tr>`;
    }
}

function populateUsers() {
    const userFilter = document.getElementById("userFilter");
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

function filterAndRender() {
    const searchVal = document.getElementById("searchBox").value.toLowerCase().trim();
    const selectedUser = document.getElementById("userFilter").value;
    
    if (!allData.length) {
        renderTable([]);
        return;
    }

    const userKey = Object.keys(allData[0]).find(k => k.toLowerCase().includes("user"));

    filteredData = allData.filter(row => {
        const matchesSearch = searchVal === "" || Object.values(row).some(val => String(val).toLowerCase().includes(searchVal));
        const matchesUser = !selectedUser || (userKey && String(row[userKey]).trim() === selectedUser);
        return matchesSearch && matchesUser;
    });

    renderTable(filteredData);
}

// 📅 Date Formatter (dd-mmm-yyyy)
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

// 📊 Stats Calculation & Update Function
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

    document.getElementById("totalAmountSum").textContent = "₹ " + totalAmount.toLocaleString('en-IN');
    document.getElementById("totalPendingSum").textContent = "₹ " + totalPending.toLocaleString('en-IN');
    document.getElementById("totalBillsCount").textContent = billCount.toLocaleString('en-IN');
}

function renderTable(data) {
    const tableHead = document.getElementById("tableHead");
    const tableBody = document.getElementById("tableBody");
    
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    updateStats(data);

    if (!data.length) {
        tableBody.innerHTML = `<tr><td class="loading" colspan="15">No Data Found</td></tr>`;
        return;
    }

    // Auto-generated 'id' field ko table view se hidden rakhne ke liye filter
    const headers = Object.keys(data[0]).filter(h => h !== "id");

    // Headers Row Setup
    let headerRow = document.createElement("tr");
    headers.forEach(header => {
        let th = document.createElement("th");
        th.textContent = header.replace(/_/g, " ");
        th.onclick = () => sortTable(header);
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Data Rows Setup
    data.forEach(row => {
        let tr = document.createElement("tr");
        headers.forEach(header => {
            let td = document.createElement("td");
            let val = row[header];

            if (val !== undefined && val !== null && val !== "") {
                let stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                let lowerHeader = header.toLowerCase();

                // 📅 Date Formatting
                if (lowerHeader.includes("date")) {
                    td.textContent = formatDate(stringVal);
                } 
                // Links/Map Detection
                else if (lowerHeader.includes("location") || stringVal.startsWith("http://") || stringVal.startsWith("https://")) {
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
        tableBody.appendChild(tr);
    });
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
    document.getElementById("searchBox").value = "";
    document.getElementById("userFilter").value = "";
    filterAndRender();
}

// App Initialization
currentSheet = "outstanding";
loadSheetData();
