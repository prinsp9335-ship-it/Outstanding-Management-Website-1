// 🔥 YAHAN APNA NAYA WEB APP URL DAALNA
const BASE_URL = "https://script.google.com/macros/s/AKfycbwlOHe0b8KaH6j5oZHWRutjRN2uquNFYVIhGNfBQuHHMobkI9ReFhhaLhG3WJ6ECBphpA/exec"; 

let currentSheet = "Final Data";
let allData = [];
let filteredData = [];
let sortDirection = false;

function switchSheet(sheetName, btnElement) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btnElement.classList.add("active");
    currentSheet = sheetName;
    loadSheetData();
}

async function loadSheetData() {
    const tableBody = document.getElementById("tableBody");
    const tableHead = document.getElementById("tableHead");
    
    let displayName = currentSheet === 'DA Sheet' ? 'DA Sheet (Automation)' : currentSheet;
    tableBody.innerHTML = `<tr><td class="loading" colspan="15">Loading ${displayName} Data...</td></tr>`;
    tableHead.innerHTML = "";

    try {
        const response = await fetch(`${BASE_URL}?sheet=${encodeURIComponent(currentSheet)}`);
        if (!response.ok) throw new Error("Network error");
        
        const data = await response.json();
        
        if (data.error) {
            tableBody.innerHTML = `<tr><td class="loading" style="color:red;" colspan="15">❌ ${data.error}</td></tr>`;
            return;
        }

        allData = data;
        filteredData = [...allData];

        populateUsers();
        filterAndRender();
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td class="loading" style="color:red;" colspan="15">❌ Error fetching data. URL check karo.</td></tr>`;
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

// 📅 Naya Date Formatter Function (dd-mmm-yyyy)
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

// 📊 Stats Calculation & Update Function (Updated for Pending column)
function updateStats(data) {
    let totalAmount = 0;
    let totalPending = 0;
    let billCount = data.length;

    if (data.length > 0) {
        const headers = Object.keys(data[0]);
        
        // Find keys dynamically (ab yeh 'pending' word ko bhi pakad lega)
        const amountKey = headers.find(h => h.toLowerCase().includes("amount"));
        const pendingKey = headers.find(h => h.toLowerCase().includes("pending") || h.toLowerCase().includes("") || h.toLowerCase().includes("balance"));

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

    // Update the summary cards whenever table renders
    updateStats(data);

    if (!data.length) {
        tableBody.innerHTML = `<tr><td class="loading" colspan="15">No Data Found</td></tr>`;
        return;
    }

    const headers = Object.keys(data[0]);

    // Headers Row setup
    let headerRow = document.createElement("tr");
    headers.forEach(header => {
        let th = document.createElement("th");
        // Clean header view if it's auto-generated
        th.textContent = header.replace(/_/g, " ");
        th.onclick = () => sortTable(header);
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Data Rows setup
    data.forEach(row => {
        let tr = document.createElement("tr");
        headers.forEach(header => {
            let td = document.createElement("td");
            let val = row[header];

            if (val !== undefined && val !== null && val !== "") {
                let stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                let lowerHeader = header.toLowerCase();

                // 📅 Date Check & Format (dd-mmm-yyyy)
                if (lowerHeader.includes("date")) {
                    td.textContent = formatDate(stringVal);
                } 
                // Links Detect
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

// Start
loadSheetData();
