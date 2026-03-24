// ========== HELPLINE MANAGEMENT ==========

// Fetch all helplines from database
async function fetchHelplines() {
    try {
        console.log('Fetching helplines...');
        
        const { data, error } = await supabaseClient
            .from('helplines')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching helplines:', error);
        return [];
    }
}

// Add new helpline to database
async function addHelpline(name, number, category) {
    try {
        console.log('Adding helpline...');
        
        const { data, error } = await supabaseClient
            .from('helplines')
            .insert({
                name: name,
                number: number,
                category: category
            })
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding helpline:', error);
        throw error;
    }
}

// Delete helpline from database
async function deleteHelpline(helplineId) {
    try {
        console.log('Deleting helpline...');
        
        const { error } = await supabaseClient
            .from('helplines')
            .delete()
            .eq('id', helplineId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting helpline:', error);
        throw error;
    }
}

// ========== UI FUNCTIONS ==========

// Load and display helplines
async function loadHelplines() {
    try {
        const helplines = await fetchHelplines();
        renderHelplinesList(helplines);
        renderHelplinesGrid(helplines);
    } catch (error) {
        console.error('Error loading helplines:', error);
    }
}

// Render helplines list (sidebar)
function renderHelplinesList(helplines) {
    const listContainer = document.getElementById('helplinesList');
    listContainer.innerHTML = '';

    if (helplines.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 10px; font-size: 12px;">No helplines added</div>';
        return;
    }

    helplines.forEach(helpline => {
        const item = document.createElement('div');
        item.className = 'helpline-item';
        item.innerHTML = `
            <div class="helpline-item-header">
                <span>${helpline.name}</span>
                <button class="delete-helpline-btn" onclick="deleteHelplineItem('${helpline.id}')">DELETE</button>
            </div>
            <div class="helpline-item-phone">${helpline.number}</div>
            <div class="helpline-item-category">${helpline.category}</div>
        `;
        listContainer.appendChild(item);
    });
}

// Render helplines grid (main content)
function renderHelplinesGrid(helplines) {
    const gridContainer = document.getElementById('helplinesGrid');
    gridContainer.innerHTML = '';

    if (helplines.length === 0) {
        gridContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: #888; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">[PHONE]</div>
                <h3 style="color: #fff; margin-bottom: 8px;">No Helplines Added</h3>
                <p>Add emergency helplines to get started</p>
            </div>
        `;
        return;
    }

    helplines.forEach(helpline => {
        const card = document.createElement('div');
        card.className = 'helpline-card';
        card.innerHTML = `
            <div class="helpline-card-header">
                <div class="helpline-card-name">${helpline.name}</div>
                <div class="helpline-card-category">${helpline.category}</div>
            </div>
            <div class="helpline-card-phone">${helpline.number}</div>
            <div class="helpline-card-actions">
                <button class="helpline-card-btn call" onclick="callHelpline('${helpline.number}')">[CALL] CALL</button>
                <button class="helpline-card-btn delete" onclick="deleteHelplineItem('${helpline.id}')">[DELETE] DELETE</button>
            </div>
        `;
        gridContainer.appendChild(card);
    });
}

// Toggle helpline form visibility
function toggleHelplineForm() {
    const form = document.getElementById('helplineForm');
    const toggleBtn = document.getElementById('toggleHelpline');
    
    if (form.style.display === 'none') {
        form.style.display = 'block';
        toggleBtn.textContent = 'Hide Form';
    } else {
        hideHelplineForm();
    }
}

// Hide helpline form
function hideHelplineForm() {
    const form = document.getElementById('helplineForm');
    const toggleBtn = document.getElementById('toggleHelpline');
    
    form.style.display = 'none';
    toggleBtn.textContent = 'Add New';
    
    // Clear form fields
    document.getElementById('helplineName').value = '';
    document.getElementById('helplineNumber').value = '';
    document.getElementById('helplineCategory').value = 'emergency';
}

// Handle add helpline
async function handleAddHelpline() {
    const name = document.getElementById('helplineName').value.trim();
    const number = document.getElementById('helplineNumber').value.trim();
    const category = document.getElementById('helplineCategory').value;

    if (!name || !number) {
        alert('Please fill in both name and phone number');
        return;
    }

    try {
        await addHelpline(name, number, category);
        await loadHelplines(); // Refresh both list and grid
        hideHelplineForm(); // Hide form and clear fields
        console.log('Helpline added successfully');
    } catch (error) {
        console.error('Error adding helpline:', error);
        alert('Failed to add helpline. Please try again.');
    }
}

// Delete helpline item
async function deleteHelplineItem(helplineId) {
    if (!confirm('Are you sure you want to delete this helpline?')) {
        return;
    }

    try {
        await deleteHelpline(helplineId);
        await loadHelplines(); // Refresh both list and grid
        console.log('Helpline deleted successfully');
    } catch (error) {
        console.error('Error deleting helpline:', error);
        alert('Failed to delete helpline. Please try again.');
    }
}

// Call helpline
function callHelpline(number) {
    // Create a tel link to initiate phone call
    window.location.href = `tel:${number}`;
}

// ========== EVENT LISTENERS ==========

// Setup event listeners
function setupEventListeners() {
    // Helpline Management
    document.getElementById('toggleHelpline').addEventListener('click', toggleHelplineForm);
    document.getElementById('addHelplineBtn').addEventListener('click', handleAddHelpline);
    document.getElementById('cancelHelplineBtn').addEventListener('click', hideHelplineForm);
}

// ========== INITIALIZATION ==========

// Initialize the helplines page
async function initHelplinesPage() {
    console.log('SATEY Helplines Page initializing...');

    // Set up event listeners
    setupEventListeners();

    // Load helplines
    await loadHelplines();
}

// Initialize on load
window.addEventListener('load', initHelplinesPage);
