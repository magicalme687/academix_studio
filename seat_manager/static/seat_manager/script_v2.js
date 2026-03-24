document.addEventListener('DOMContentLoaded', () => {
    window.tableDataMap = {};
    window.isEditMode = false;
    // --- Theme Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    // Check local storage or system preference
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeIcon) {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            console.log("Theme toggle clicked!");
            let theme = document.documentElement.getAttribute('data-theme');
            console.log("Current theme attribute:", theme);
            if (theme === 'light') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'dark');
                themeIcon.classList.replace('fa-moon', 'fa-sun');
                console.log("Switched to dark mode.");
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                themeIcon.classList.replace('fa-sun', 'fa-moon');
                console.log("Switched to light mode.");
            }
        });
    }

    // --- Help Modal ---
    const helpModal = document.getElementById('help-modal');
    document.getElementById('help-btn')?.addEventListener('click', () => {
        helpModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    });
    const closeHelp = () => {
        helpModal.style.display = 'none';
        document.body.style.overflow = '';
    };
    document.getElementById('help-close-btn')?.addEventListener('click', closeHelp);
    document.getElementById('help-got-it-btn')?.addEventListener('click', closeHelp);
    helpModal?.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

    // --- History Modal ---
    const historyModal = document.getElementById('history-modal');
    document.getElementById('history-btn')?.addEventListener('click', () => {
        historyModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        renderHistoryList();
    });
    const closeHistory = () => {
        historyModal.style.display = 'none';
        document.body.style.overflow = '';
    };
    document.getElementById('history-close-btn')?.addEventListener('click', closeHistory);
    historyModal?.addEventListener('click', (e) => { if (e.target === historyModal) closeHistory(); });

    // --- Fill Seat Modal ---
    const fillSeatModal = document.getElementById('fill-seat-modal');
    const fillSeatForm = document.getElementById('fill-seat-form');
    let targetEmptySeat = null;

    const closeFillSeat = () => {
        fillSeatModal.style.display = 'none';
        document.body.style.overflow = '';
        fillSeatForm.reset();
        targetEmptySeat = null;
    };
    document.getElementById('fill-seat-close-btn')?.addEventListener('click', closeFillSeat);
    fillSeatModal?.addEventListener('click', (e) => { if (e.target === fillSeatModal) closeFillSeat(); });

    fillSeatForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!targetEmptySeat) return;

        const enrollment = document.getElementById('fill-seat-enrollment').value.trim();
        const name = document.getElementById('fill-seat-name').value.trim();
        const year = document.getElementById('fill-seat-year').value;

        // Transform the empty seat into an occupied seat
        targetEmptySeat.classList.remove('empty-seat');
        targetEmptySeat.classList.add('occupied-seat');
        targetEmptySeat.dataset.enrollment = enrollment;
        targetEmptySeat.dataset.name = name;
        targetEmptySeat.dataset.year = year;
        const titleText = name ? `${enrollment} - ${name}\nDrag to rearrange.` : `${enrollment}\nDrag to rearrange.`;
        targetEmptySeat.setAttribute('title', titleText);

        targetEmptySeat.innerHTML = `
            <div class="student-id">${enrollment}</div>
            <div class="year-badge ${year.replace(' ', '-')}">${year}</div>
        `;

        // Provide a quick feedback highlight
        targetEmptySeat.classList.add('highlight-drop');
        setTimeout(() => targetEmptySeat.classList.remove('highlight-drop'), 500);

        closeFillSeat();

        if (window.syncSeatingDOMToGlobalData) {
            window.syncSeatingDOMToGlobalData();
        }
    });

    // Delegated click listener for empty seats
    document.addEventListener('click', (e) => {
        const emptySeat = e.target.closest('.empty-seat');
        if (emptySeat) {
            targetEmptySeat = emptySeat;
            fillSeatModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            setTimeout(() => document.getElementById('fill-seat-enrollment').focus(), 100);
        }
    });

    // --- Buffer Edit Mode Logic ---
    const editSeatingBtn = document.getElementById('edit-seating-btn');
    const confirmSeatingBtn = document.getElementById('confirm-seating-btn');
    const cancelSeatingBtn = document.getElementById('cancel-seating-btn');
    const dragBufferTray = document.getElementById('drag-buffer');
    const bufferWarning = document.getElementById('buffer-warning');
    const bufferDropzone = document.getElementById('buffer-dropzone');
    const bufferPlaceholder = document.getElementById('buffer-placeholder');

    // Map from buffer seat DOM element → original empty seat DOM element
    window._bufferOriginMap = new Map();
    // DOM snapshot of the full seating tab for cancel-restore
    window._seatingSnapshot = null;

    function exitEditMode() {
        window.isEditMode = false;
        bufferWarning.classList.add('hidden');
        confirmSeatingBtn.classList.add('hidden');
        dragBufferTray.classList.add('hidden');
        editSeatingBtn.classList.remove('hidden');
        document.querySelectorAll('.seating-table').forEach(t => t.classList.remove('edit-mode-active'));

        // Convert col-header-input fields back to plain text
        document.querySelectorAll('#tab-seating .seating-table thead th .col-header-input').forEach(input => {
            const th = input.parentElement;
            th.textContent = input.value.trim();
        });

        // Clear buffer map
        window._bufferOriginMap = new Map();
        window._seatingSnapshot = null;
    }

    if (editSeatingBtn) {
        editSeatingBtn.addEventListener('click', () => {
            window.isEditMode = true;
            editSeatingBtn.classList.add('hidden');
            confirmSeatingBtn.classList.remove('hidden');
            dragBufferTray.classList.remove('hidden');
            bufferWarning.classList.add('hidden');

            // Snapshot the seating tab so we can restore on Cancel
            window._seatingSnapshot = document.getElementById('tab-seating').innerHTML;

            // Add a visual cue to the tables
            document.querySelectorAll('.seating-table').forEach(t => t.classList.add('edit-mode-active'));

            // Convert column header <th> cells into editable inputs
            document.querySelectorAll('#tab-seating .seating-table thead th').forEach(th => {
                const currentText = th.textContent.trim();
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentText;
                input.className = 'col-header-input';
                input.style.cssText = [
                    'width: 100%',
                    'background: transparent',
                    'border: none',
                    'border-bottom: 1px dashed var(--primary-color)',
                    'color: var(--text-main)',
                    'font-family: inherit',
                    'font-size: inherit',
                    'font-weight: 600',
                    'text-align: center',
                    'outline: none',
                    'padding: 2px 4px',
                    'min-width: 60px',
                    'cursor: text'
                ].join(';');
                input.title = 'Click to edit column year label (e.g. II Yr, II/III Yr)';
                th.innerHTML = '';
                th.appendChild(input);
            });
        });
    }

    if (confirmSeatingBtn) {
        confirmSeatingBtn.addEventListener('click', () => {
            // Check if buffer is empty
            const hasStudentsInBuffer = bufferDropzone.querySelectorAll('.chart-seat').length > 0;
            if (hasStudentsInBuffer) {
                bufferWarning.classList.remove('hidden');
                return;
            }

            // Valid to confirm — sync data and exit
            exitEditMode();

            if (window.syncSeatingDOMToGlobalData) {
                window.syncSeatingDOMToGlobalData();
            }
        });
    }

    if (cancelSeatingBtn) {
        cancelSeatingBtn.addEventListener('click', () => {
            if (!confirm('Cancel all seating changes? This will revert everything back to before you clicked "Edit Seating".')) return;

            // Restore the seating tab to the snapshot taken at edit start
            if (window._seatingSnapshot !== null) {
                document.getElementById('tab-seating').innerHTML = window._seatingSnapshot;
                // Re-init drag-and-drop references since DOM was replaced
                if (typeof initializeDragAndDrop === 'function') {
                    setTimeout(initializeDragAndDrop, 50);
                }
            }

            // Clear buffer dropzone
            bufferDropzone.querySelectorAll('.chart-seat').forEach(s => s.remove());
            if (bufferPlaceholder) bufferPlaceholder.style.display = 'block';

            exitEditMode();
        });
    }

    // Initialize Buffer Dropzone Actions
    if (bufferDropzone) {
        bufferDropzone.addEventListener('dragover', function (e) {
            if (!window.isEditMode) return;
            if (window.draggedSeat) {
                e.preventDefault();
                this.classList.add('drag-over-buffer');
            }
        });

        bufferDropzone.addEventListener('dragleave', function (e) {
            this.classList.remove('drag-over-buffer');
        });

        bufferDropzone.addEventListener('drop', function (e) {
            if (!window.isEditMode) return;
            e.preventDefault();
            this.classList.remove('drag-over-buffer');

            if (window.draggedSeat && window.draggedSeat.closest('table')) {
                // Moving from a table to the buffer.
                const originalSeatEl = window.draggedSeat; // keep reference before we clear it

                // Hide placeholder
                bufferPlaceholder.style.display = 'none';

                // Create a buffer seat element
                const bufferSeat = document.createElement('div');
                bufferSeat.className = 'chart-seat ' + [...window.draggedSeat.classList].filter(c => !['chart-seat', 'dragging', 'drag-over', 'highlight-drop'].includes(c)).join(' ');
                bufferSeat.style.position = 'relative'; // needed for close btn positioning
                bufferSeat.innerHTML = window.draggedSeat.innerHTML;
                Object.keys(window.draggedSeat.dataset).forEach(k => bufferSeat.dataset[k] = window.draggedSeat.dataset[k]);
                bufferSeat.draggable = true;
                bufferSeat.style.minWidth = '120px';
                bufferSeat.style.cursor = 'grab';

                // ✕ Close button — returns student to their original seat
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '&times;';
                closeBtn.title = 'Remove from buffer & return to original seat';
                closeBtn.style.cssText = `
                    position: absolute; top: 2px; right: 2px;
                    background: rgba(239,68,68,0.85); color: white;
                    border: none; border-radius: 50%;
                    width: 18px; height: 18px; font-size: 12px; line-height: 1;
                    cursor: pointer; display: flex; align-items: center; justify-content: center;
                    z-index: 10; padding: 0;
                `;
                closeBtn.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    // Retrieve the original seat reference from the map
                    const origin = window._bufferOriginMap.get(bufferSeat);
                    if (origin) {
                        // Restore student data and appearance back to the original seat
                        origin.innerHTML = bufferSeat.innerHTML;
                        // Remove the close button from restored HTML (it's inside bufferSeat, not origin)
                        const closeBtnInOrigin = origin.querySelector('button[title="Remove from buffer & return to original seat"]');
                        if (closeBtnInOrigin) closeBtnInOrigin.remove();
                        origin.className = 'chart-seat ' + [...bufferSeat.classList]
                            .filter(c => !['chart-seat', 'dragging', 'drag-over'].includes(c)).join(' ');
                        Object.keys(bufferSeat.dataset).forEach(k => origin.dataset[k] = bufferSeat.dataset[k]);
                        origin.draggable = true;
                    }
                    window._bufferOriginMap.delete(bufferSeat);
                    bufferSeat.remove();
                    // Show placeholder if buffer is now empty
                    if (bufferDropzone.querySelectorAll('.chart-seat').length === 0) {
                        if (bufferPlaceholder) bufferPlaceholder.style.display = 'block';
                    }
                });
                bufferSeat.appendChild(closeBtn);

                // Store origin seat reference in the map
                window._bufferOriginMap.set(bufferSeat, originalSeatEl);

                // Attach drag events to this new buffer seat
                bufferSeat.addEventListener('dragstart', function (e) {
                    if (!window.isEditMode) return;
                    window.draggedSeat = this;
                    e.dataTransfer.effectAllowed = 'move';
                    this.classList.add('dragging');
                });
                bufferSeat.addEventListener('dragend', function (e) {
                    this.classList.remove('dragging');
                    document.querySelectorAll('.chart-seat').forEach(s => s.classList.remove('drag-over'));
                    window.draggedSeat = null;
                });

                bufferDropzone.appendChild(bufferSeat);

                // Clear the original seat in the table and make it an empty seat
                window.draggedSeat.innerHTML = '';
                window.draggedSeat.className = 'chart-seat empty-seat';
                Object.keys(window.draggedSeat.dataset).forEach(k => delete window.draggedSeat.dataset[k]);

                // Keep the dropped seat draggable so things can be dragged into it
                window.draggedSeat.draggable = true;
            }
        });
    }

    // --- Add Room Modal ---
    const addRoomModal = document.getElementById('add-room-modal');
    const addRoomForm = document.getElementById('add-room-form');

    document.getElementById('add-room-btn')?.addEventListener('click', () => {
        addRoomModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    });

    const closeAddRoom = () => {
        addRoomModal.style.display = 'none';
        document.body.style.overflow = '';
        addRoomForm.reset();
        document.getElementById('add-room-error').style.display = 'none';
    };
    document.getElementById('add-room-close-btn')?.addEventListener('click', closeAddRoom);
    addRoomModal?.addEventListener('click', (e) => { if (e.target === addRoomModal) closeAddRoom(); });

    addRoomForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Ensure we have active configuration to append to
        if (!window.activePreset || !window.globalSeatingData) {
            alert("No active session configuration found. Please generate the master chart first.");
            return;
        }

        const submitBtn = document.getElementById('generate-extra-room-btn');
        const errorDiv = document.getElementById('add-room-error');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        submitBtn.disabled = true;
        errorDiv.style.display = 'none';

        try {
            const formData = new FormData();

            // 1. Base details
            formData.append('branch_name', document.getElementById('department-name').value.trim() || 'General');

            // 2. Schedule Config (Must match the existing active session perfectly)
            formData.append('schedule_config', window.activePreset.scheduleConfigStr);

            // 3. Room Config (Just this single extra room)
            const newRoomConfig = [{
                name: document.getElementById('add-room-name').value.trim(),
                rows: document.getElementById('add-room-rows').value,
                cols: document.getElementById('add-room-cols').value,
                seating_pattern: document.getElementById('add-room-pattern').value
            }];
            formData.append('room_config', JSON.stringify(newRoomConfig));
            formData.append('is_append_room', 'true');

            // 4. Student Data (File or Empty map)
            const fileInput = document.getElementById('add-room-student-file');
            if (fileInput.files.length > 0) {
                formData.append('student_file', fileInput.files[0]);
            } else {
                // To get empty seats, we just send empty year arrays
                formData.append('student_data', JSON.stringify({ "I Yr": [], "II Yr": [], "III Yr": [], "IV Yr": [] }));
            }

            const response = await fetch('/seat_manager/generate/', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Server error occurred during generation.');
            }

            // MERGE results into global data
            // Append Seating Plans
            window.globalSeatingData.seating_plans.push(...data.seating_plans);

            // Append Room Attendance
            if (data.room_attendance_data) {
                window.globalSeatingData.room_attendance_data.push(...data.room_attendance_data);
            }

            // Merge Master Attendance
            if (data.attendance_data) {
                for (const year of ['I Yr', 'II Yr', 'III Yr', 'IV Yr']) {
                    if (data.attendance_data[year] && data.attendance_data[year].length > 0) {
                        if (!window.globalSeatingData.attendance_data[year]) window.globalSeatingData.attendance_data[year] = [];
                        window.globalSeatingData.attendance_data[year].push(...data.attendance_data[year]);
                    }
                }
            }

            closeAddRoom();

            // Re-render
            const instituteName = document.getElementById('institute-name').value.trim();
            const departmentName = document.getElementById('department-name').value.trim();
            renderResults(window.globalSeatingData, instituteName, window.lastLogoBase64 || '', departmentName);

        } catch (error) {
            errorDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error: ${error.message}`;
            errorDiv.style.display = 'flex';
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // --- Preset Loading & Saving ---
    window.activePreset = null; // Stores preset data if loaded

    function renderHistoryList() {
        const container = document.getElementById('history-list-container');
        if (!container) return;
        container.innerHTML = '';

        let presets = [];
        try {
            presets = JSON.parse(localStorage.getItem('examSeatingPresets')) || [];
        } catch (e) { }

        if (presets.length === 0) {
            container.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 2rem;">No saved configurations found. Generate a chart to save one!</div>';
            return;
        }

        presets.forEach((preset, index) => {
            const presetDiv = document.createElement('div');
            presetDiv.style.background = 'rgba(139,92,246,0.08)';
            presetDiv.style.border = '1px solid rgba(139,92,246,0.25)';
            presetDiv.style.borderRadius = '12px';
            presetDiv.style.padding = '1rem';
            presetDiv.style.display = 'flex';
            presetDiv.style.justifyContent = 'space-between';
            presetDiv.style.alignItems = 'center';
            presetDiv.innerHTML = `
                <div>
                    <h4 style="margin: 0; color: var(--text-main); font-size: 1.1rem;">${preset.name || 'Configuration ' + (presets.length - index)}</h4>
                    <p style="margin: 0.3rem 0 0; font-size: 0.85rem; color: var(--text-muted);">
                        <i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${preset.dateStr}<br>
                        Rooms: ${preset.roomsCount} | Shifts: ${preset.shiftsCount}
                    </p>
                </div>
                <button class="btn outline-btn" style="padding: 0.5rem 1rem;" onclick="restorePreset(${index})">
                    Restore <i class="fa-solid fa-arrow-right-long" style="margin-left: 5px;"></i>
                </button>
            `;
            container.appendChild(presetDiv);
        });
    }

    window.restorePreset = function (index) {
        let presets = [];
        try { presets = JSON.parse(localStorage.getItem('examSeatingPresets')) || []; } catch (e) { }
        const preset = presets[index];
        if (!preset) return;

        // Populate base config
        document.getElementById('institute-name').value = preset.instituteName || '';
        document.getElementById('department-name').value = preset.departmentSelect || '';
        if (preset.departmentSelect === 'Custom') {
            document.getElementById('custom-department-wrapper').classList.remove('hidden');
            document.getElementById('custom-department-name').value = preset.customDepartment || '';
        } else {
            document.getElementById('custom-department-wrapper').classList.add('hidden');
        }
        document.getElementById('mid-sem').value = preset.midSem || '1';

        // Subject source
        const srcExcel = document.getElementById('src-excel');
        const srcManual = document.getElementById('src-manual');
        if (preset.subjectSource === 'excel') {
            if (srcExcel) srcExcel.checked = true;
        } else {
            if (srcManual) srcManual.checked = true;
        }
        // Trigger subject source change event
        srcExcel?.dispatchEvent(new Event('change', { bubbles: true }));
        srcManual?.dispatchEvent(new Event('change', { bubbles: true }));

        if (preset.subjectSource === 'manual') {
            const manualConfig = preset.subjectCodes || { "I Yr": [], "II Yr": [], "III Yr": [], "IV Yr": [] };
            document.getElementById('manual-subj-i').value = manualConfig["I Yr"].join(', ');
            document.getElementById('manual-subj-ii').value = manualConfig["II Yr"].join(', ');
            document.getElementById('manual-subj-iii').value = manualConfig["III Yr"].join(', ');
            document.getElementById('manual-subj-iv').value = manualConfig["IV Yr"].join(', ');
            updateManualSubjects();
        } else {
            // Restore window.subjectCodes directly if it was from Excel
            window.subjectCodes = preset.subjectCodes || { "I Yr": [], "II Yr": [], "III Yr": [], "IV Yr": [] };
            // Note: the file input itself remains empty, but we have the parsed data.
            // We should ideally show a label that subject data is loaded from preset.
            const subjectLabel = document.querySelector('label[for="subject-file"]');
            if (subjectLabel) subjectLabel.innerHTML = 'Subject Codes <b>(Loaded from preset)</b>';
        }

        // We can't set student-file input, so we save preset globally and rely on `studentDataStr`
        window.activePreset = preset;
        const studentLabel = document.querySelector('label[for="student-file"]');
        if (studentLabel) studentLabel.innerHTML = 'Student List <b>(Loaded from preset)</b>';
        document.getElementById('student-file').required = false;

        // Restore Timetable Setup
        datesContainer.innerHTML = '';
        dateCount = 0;

        const schedule = JSON.parse(preset.scheduleConfigStr || '[]');
        if (schedule.length > 0) {
            schedule.forEach(dt => {
                createDateBlock();
                const currentBlock = datesContainer.lastElementChild;
                const dInput = currentBlock.querySelector('.date-input');
                if (dInput) dInput.value = dt.date;

                const shiftsCont = currentBlock.querySelector('.shifts-container');
                shiftsCont.innerHTML = '';

                dt.shifts.forEach((sh, shIdx) => {
                    createShiftBlock(`date-${Date.now()}-${shIdx}`, shIdx + 1, shiftsCont);
                    const currentShiftBlock = shiftsCont.lastElementChild;

                    // Parse "HH:MM AM - HH:MM PM" string
                    try {
                        const parts = sh.time.split('-');
                        const startParts = parts[0].trim().split(' ');
                        const [sHr, sMin] = startParts[0].split(':');
                        const sAmPm = startParts[1];
                        currentShiftBlock.querySelector('.shift-start-hr').value = String(sHr).padStart(2, '0');
                        currentShiftBlock.querySelector('.shift-start-min').value = String(sMin).padStart(2, '0');
                        currentShiftBlock.querySelector('.shift-start-ampm').value = sAmPm;

                        const endParts = parts[1].trim().split(' ');
                        const [eHr, eMin] = endParts[0].split(':');
                        const eAmPm = endParts[1];
                        currentShiftBlock.querySelector('.shift-end-hr').value = String(eHr).padStart(2, '0');
                        currentShiftBlock.querySelector('.shift-end-min').value = String(eMin).padStart(2, '0');
                        currentShiftBlock.querySelector('.shift-end-ampm').value = eAmPm;
                    } catch (ex) { console.error("Could not parse shift time", ex); }

                    // Set Year Checkboxes and Selects
                    const selectedYears = sh.years || []; // array of {year, subject}
                    const yearMap = {};
                    selectedYears.forEach(y => yearMap[y.year] = y.subject);

                    currentShiftBlock.querySelectorAll('.year-checkbox').forEach(cb => {
                        const yr = cb.dataset.year;
                        if (yearMap[yr]) {
                            cb.checked = true;
                            cb.dispatchEvent(new Event('change'));
                            const sel = currentShiftBlock.querySelector(`.subject-select[data-year="${yr}"]`);
                            if (sel) sel.value = yearMap[yr];
                        }
                    });
                });
            });
            updateSubjectOptions();
        } else {
            createDateBlock();
        }

        // Restore Rooms Setup
        const roomsCfg = JSON.parse(preset.roomConfigStr || '[]');
        document.getElementById('room-count').value = roomsCfg.length;
        if (roomsCfg.length > 0) {
            initializeRooms(roomsCfg.length);
            mainContent.classList.remove('hidden');

            roomsCfg.forEach((rc, rIdx) => {
                const id = rIdx + 1; // Room id in roomData is 1-indexed (1, 2, 3...)
                document.getElementById(`room-name-input-${id}`).value = rc.name;
                document.getElementById(`rows-${id}`).value = rc.rows;
                document.getElementById(`cols-${id}`).value = rc.cols;
                document.getElementById(`door-${id}`).value = rc.door || 'top-right';
                document.getElementById(`pattern-${id}`).value = rc.seating_pattern || 'IV Yr, III Yr, II Yr, I Yr';
                updateRoomPreview(id);
            });
        }

        closeHistory();

        // Show success flash
        const hcBtn = document.getElementById('history-btn');
        if (hcBtn) {
            const org = hcBtn.innerHTML;
            hcBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            hcBtn.style.background = 'var(--success-color)';
            hcBtn.style.color = 'white';
            setTimeout(() => {
                hcBtn.innerHTML = org;
                hcBtn.style.background = '';
                hcBtn.style.color = '';
            }, 1500);
        }
    };

    // --- Elements ---
    const roomCountInput = document.getElementById('room-count');
    const generateRoomsBtn = document.getElementById('generate-rooms-btn');
    const setupError = document.getElementById('setup-error');

    const mainContent = document.getElementById('main-content');
    const batchRoomCheckboxes = document.getElementById('batch-room-checkboxes');
    const roomsContainer = document.getElementById('rooms-container');

    // Batch Config Elements
    const batchRowsInput = document.getElementById('batch-rows');
    const batchColsInput = document.getElementById('batch-cols');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const applyBatchBtn = document.getElementById('apply-batch-btn');
    const batchError = document.getElementById('batch-error');

    // Final Generate Elements
    const finalGenerateBtn = document.getElementById('final-generate-btn');
    const finalError = document.getElementById('final-error');
    const outputContent = document.getElementById('output-content');
    const seatingResultsContainer = document.getElementById('seating-results-container');
    const backToConfigBtn = document.getElementById('back-to-config');

    let roomData = [];

    // --- Tab Navigation Setup ---
    const seatingOnlyBtns = ['edit-seating-btn', 'confirm-seating-btn', 'add-room-btn'];

    function updateSeatingButtons(targetId) {
        const isSeatingTab = targetId === 'tab-seating';
        seatingOnlyBtns.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (isSeatingTab) {
                    // For confirm-seating-btn, only show if edit mode is active
                    if (id === 'confirm-seating-btn') {
                        el.classList.toggle('hidden', !window.isEditMode);
                    } else if (id === 'edit-seating-btn') {
                        // Only show edit btn when not in edit mode
                        el.classList.toggle('hidden', window.isEditMode);
                    } else {
                        el.classList.remove('hidden');
                    }
                } else {
                    el.classList.add('hidden');
                }
            }
        });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all tabs
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

            // Set clicked as active
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');

            // Toggle seating-specific buttons
            updateSeatingButtons(targetId);
        });
    });

    // Hide seating-only buttons on initial load (timetable tab is shown first)
    updateSeatingButtons('tab-timetable');

    // --- Subject Parsing logic ---
    window.subjectCodes = {
        "I Yr": [],
        "II Yr": [],
        "III Yr": [],
        "IV Yr": []
    };

    const subjectFileInput = document.getElementById('subject-file');
    if (subjectFileInput) {
        subjectFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    // Clear previous
                    window.subjectCodes = { "I Yr": [], "II Yr": [], "III Yr": [], "IV Yr": [] };

                    // Skip row 0 — it's the header row (e.g. "I Yr", "II Yr", etc.)
                    json.slice(1).forEach(row => {
                        // Combines Subject Code and Name into a single string if available
                        if (row[0]) {
                            let txt = String(row[0]).trim();
                            if (row[1]) txt += " - " + String(row[1]).trim();
                            window.subjectCodes["I Yr"].push(txt);
                        }
                        if (row[2]) {
                            let txt = String(row[2]).trim();
                            if (row[3]) txt += " - " + String(row[3]).trim();
                            window.subjectCodes["II Yr"].push(txt);
                        }
                        if (row[4]) {
                            let txt = String(row[4]).trim();
                            if (row[5]) txt += " - " + String(row[5]).trim();
                            window.subjectCodes["III Yr"].push(txt);
                        }
                        if (row[6]) {
                            let txt = String(row[6]).trim();
                            if (row[7]) txt += " - " + String(row[7]).trim();
                            window.subjectCodes["IV Yr"].push(txt);
                        }
                    });

                    // Filter out likely headers (like "1st year") if needed... but just relying on user format.
                    console.log("Parsed Subject Codes:", window.subjectCodes);
                    alert("Subject Codes Loaded Successfully!");

                    // Re-populate any active session dropdowns
                    document.querySelectorAll('.subject-select').forEach(select => {
                        const yr = select.dataset.year;
                        populateDropdown(select, yr);
                    });

                } catch (err) {
                    console.error("Error parsing subjects excel:", err);
                    alert("Failed to parse Subject Excel file.");
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Toggle Subject Source
    const subjectSourceRadios = document.querySelectorAll('input[name="subject-source"]');
    const excelSourceDiv = document.querySelector('.subject-source-excel');
    const manualSourceDiv = document.querySelector('.subject-source-manual');
    const subjectFile = document.getElementById('subject-file');

    // Update pill toggle visual state
    const pillExcel = document.getElementById('pill-excel');
    const pillManual = document.getElementById('pill-manual');
    const ACTIVE_PILL_STYLE = 'background:linear-gradient(135deg,var(--primary-color),var(--primary-hover));color:white;box-shadow:0 2px 8px rgba(139,92,246,0.35);';
    const INACTIVE_PILL_STYLE = 'background:transparent;color:var(--text-muted);box-shadow:none;';

    function updatePillStyles() {
        const val = document.querySelector('input[name="subject-source"]:checked')?.value;
        if (pillExcel && pillManual) {
            pillExcel.style.cssText += val === 'excel' ? ACTIVE_PILL_STYLE : INACTIVE_PILL_STYLE;
            pillManual.style.cssText += val === 'manual' ? ACTIVE_PILL_STYLE : INACTIVE_PILL_STYLE;
        }
    }
    updatePillStyles(); // Set correct state on load

    subjectSourceRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updatePillStyles();
            if (e.target.value === 'excel') {
                excelSourceDiv.classList.remove('hidden');
                manualSourceDiv.classList.add('hidden');
                subjectFile.required = true;
                if (subjectFile.files.length > 0) processSubjectExcel(subjectFile.files[0]);
            } else {
                excelSourceDiv.classList.add('hidden');
                manualSourceDiv.classList.remove('hidden');
                subjectFile.required = false;
                subjectFile.value = ''; // clear input
                // Populate from manual inputs on blur
                updateManualSubjects();
            }
        });
    });

    const manualInputs = ['manual-subj-i', 'manual-subj-ii', 'manual-subj-iii', 'manual-subj-iv'];
    manualInputs.forEach(id => {
        document.getElementById(id).addEventListener('blur', updateManualSubjects);
    });

    function updateManualSubjects() {
        if (document.querySelector('input[name="subject-source"]:checked').value !== 'manual') return;

        window.subjectCodes = {
            "I Yr": [], "II Yr": [], "III Yr": [], "IV Yr": []
        };

        const map = {
            'manual-subj-i': 'I Yr',
            'manual-subj-ii': 'II Yr',
            'manual-subj-iii': 'III Yr',
            'manual-subj-iv': 'IV Yr'
        };

        manualInputs.forEach(id => {
            const val = document.getElementById(id).value;
            if (val.trim()) {
                window.subjectCodes[map[id]] = val.split(',').map(s => s.trim()).filter(s => s !== '');
            }
        });

        // re-populate all dropdowns if active
        document.querySelectorAll('.subject-select').forEach(select => {
            const yr = select.dataset.year;
            populateDropdown(select, yr);
        });
    }

    // Department Selection Logic
    const departmentSelect = document.getElementById('department-name');
    const customDepartmentWrapper = document.getElementById('custom-department-wrapper');
    const customDepartmentInput = document.getElementById('custom-department-name');

    departmentSelect.addEventListener('change', (e) => {
        if (e.target.value === 'Custom') {
            customDepartmentWrapper.classList.remove('hidden');
            customDepartmentInput.required = true;
        } else {
            customDepartmentWrapper.classList.add('hidden');
            customDepartmentInput.required = false;
            customDepartmentInput.value = ''; // clear custom text
        }
    });

    // --- Timetable Builder Logic ---
    const datesContainer = document.getElementById('dates-container');
    const addDateBtn = document.getElementById('add-date-btn');
    let dateCount = 0;

    function populateDropdown(selectEl, year) {
        const val = selectEl.value;
        // Clear and rebuild — no disabled placeholder option
        selectEl.innerHTML = '';
        if (window.subjectCodes[year] && window.subjectCodes[year].length > 0) {
            window.subjectCodes[year].forEach(code => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = code;
                selectEl.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '— No subjects loaded —';
            opt.disabled = true;
            opt.selected = true;
            selectEl.appendChild(opt);
        }

        if (val) {
            // Restore previous selection
            selectEl.value = val;
        } else {
            // Auto-select the first subject not already used in any other active dropdown
            const usedValues = new Set();
            document.querySelectorAll('.subject-select').forEach(other => {
                if (other !== selectEl) {
                    const w = other.closest('.input-wrapper');
                    if (w && !w.classList.contains('hidden') && other.value) {
                        usedValues.add(other.value);
                    }
                }
            });
            const firstAvailable = Array.from(selectEl.options).find(o => o.value && !usedValues.has(o.value));
            if (firstAvailable) {
                selectEl.value = firstAvailable.value;
            } else {
                // All subjects exhausted — insert disabled placeholder so browser doesn't auto-pick first
                const ph = document.createElement('option');
                ph.value = '';
                ph.textContent = '\u2014 All subjects scheduled \u2014';
                ph.disabled = true;
                ph.selected = true;
                selectEl.insertBefore(ph, selectEl.firstChild);
                selectEl.value = '';
            }
        }
    }

    // Once a subject is selected anywhere, disable it everywhere else
    // (an exam that happened in one shift can't be scheduled again in another)
    function updateSubjectOptions() {
        const allSelects = document.querySelectorAll('.subject-select');
        const selectedValues = new Set();

        // Collect all currently selected subjects across all shifts/dates
        allSelects.forEach(select => {
            const wrapper = select.closest('.input-wrapper');
            if (wrapper && !wrapper.classList.contains('hidden') && select.value) {
                selectedValues.add(select.value);
            }
        });

        // Disable those subjects in every other dropdown
        allSelects.forEach(select => {
            select.querySelectorAll('option').forEach(opt => {
                if (opt.value && opt.value !== select.value) {
                    opt.disabled = selectedValues.has(opt.value);
                }
            });
        });

        // Disable year checkboxes whose entire subject list is exhausted
        // (only disable unchecked checkboxes — already-selected ones stay active)
        document.querySelectorAll('.year-checkbox').forEach(cb => {
            if (cb.checked) return; // don't touch already-selected years
            const yr = cb.dataset.year;
            const subjectsForYear = window.subjectCodes?.[yr] || [];
            if (subjectsForYear.length === 0) return; // no subjects loaded yet

            const allUsed = subjectsForYear.every(code => selectedValues.has(code));
            const yrRow = cb.closest('.yr-card'); // reliably targets the year card
            if (allUsed) {
                cb.disabled = true;
                if (yrRow) {
                    yrRow.style.opacity = '0.45';
                    yrRow.title = `All ${yr} subjects already scheduled`;
                }
            } else {
                cb.disabled = false;
                if (yrRow) {
                    yrRow.style.opacity = '';
                    yrRow.title = '';
                }
            }
        });
    }

    function createShiftBlock(dateId, shiftCount, shiftsContainer) {
        const shiftId = `${dateId}-shift-${Date.now()}`;
        const shiftDiv = document.createElement('div');
        shiftDiv.className = 'shift-block';
        shiftDiv.style.background = 'rgba(0, 0, 0, 0.2)';
        shiftDiv.style.border = '1px solid var(--border-color)';
        shiftDiv.style.borderRadius = '8px';
        shiftDiv.style.padding = '1rem';
        shiftDiv.style.marginBottom = '1rem';
        shiftDiv.style.position = 'relative';

        shiftDiv.innerHTML = `
            <button type="button" class="btn text-btn remove-shift-btn" style="position: absolute; top:0.5rem; right:0.5rem; color: var(--error-color); padding: 5px;">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <h4 style="margin-bottom: 1rem; font-size: 1rem; color: var(--text-main);">Shift Timing</h4>
            
            <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; align-items: flex-end;">
                <div style="flex: 1;">
                    <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 5px;"><i class="fa-regular fa-clock" style="margin-right:3px;"></i>Start Time</label>
                    <div style="display: flex; gap: 5px;">
                        <select class="shift-start-hr" required style="flex:1; padding: 0.5rem; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main);">
                            <option value="" disabled selected>HH</option>
                            ${Array.from({ length: 12 }, (_, i) => `<option value="${String(i + 1).padStart(2, '0')}">${String(i + 1).padStart(2, '0')}</option>`).join('')}
                        </select>
                        <select class="shift-start-min" required style="flex:1; padding: 0.5rem; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main);">
                            <option value="" disabled selected>MM</option>
                            ${Array.from({ length: 12 }, (_, i) => `<option value="${String(i * 5).padStart(2, '0')}">${String(i * 5).padStart(2, '0')}</option>`).join('')}
                        </select>
                        <select class="shift-start-ampm" required style="flex:1; padding: 0.5rem; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main);">
                            <option value="AM" selected>AM</option>
                            <option value="PM">PM</option>
                        </select>
                    </div>
                </div>
                <div style="color: var(--text-muted); font-size: 1.2rem; padding-bottom: 0.4rem; flex-shrink: 0;">→</div>
                <div style="flex: 1;">
                    <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 5px;"><i class="fa-regular fa-clock" style="margin-right:3px;"></i>End Time</label>
                    <div style="display: flex; gap: 5px;">
                        <select class="shift-end-hr" required style="flex:1; padding: 0.5rem; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main);">
                            <option value="" disabled selected>HH</option>
                            ${Array.from({ length: 12 }, (_, i) => `<option value="${String(i + 1).padStart(2, '0')}">${String(i + 1).padStart(2, '0')}</option>`).join('')}
                        </select>
                        <select class="shift-end-min" required style="flex:1; padding: 0.5rem; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main);">
                            <option value="" disabled selected>MM</option>
                            ${Array.from({ length: 12 }, (_, i) => `<option value="${String(i * 5).padStart(2, '0')}">${String(i * 5).padStart(2, '0')}</option>`).join('')}
                        </select>
                        <select class="shift-end-ampm" required style="flex:1; padding: 0.5rem; border-radius: 8px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main);">
                            <option value="AM">AM</option>
                            <option value="PM" selected>PM</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-muted);"><i class="fa-solid fa-users" style="margin-right:5px;"></i>Participating Years</h4>
            <div class="years-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <!-- Dynamically added year rows here... -->
            </div>
        `;

        const yearsContainer = shiftDiv.querySelector('.years-container');
        const years = ["I Yr", "II Yr", "III Yr", "IV Yr"];

        years.forEach((yr, idx) => {
            const yrId = `${shiftId}-yr-${idx}`;
            const yrRow = document.createElement('div');
            yrRow.className = 'yr-card';
            yrRow.style.display = 'flex';
            yrRow.style.flexDirection = 'column';
            yrRow.style.gap = '0.4rem';
            yrRow.style.background = 'rgba(0,0,0,0.15)';
            yrRow.style.border = '1px solid var(--border-color)';
            yrRow.style.borderRadius = '8px';
            yrRow.style.padding = '0.5rem 0.75rem';

            yrRow.innerHTML = `
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.95rem; font-weight: 600; color: var(--text-muted); transition: color 0.2s;" class="yr-label">
                    <input type="checkbox" class="year-checkbox" data-year="${yr}" style="accent-color: var(--primary-color); width: 15px; height: 15px; cursor: pointer; flex-shrink:0;"> ${yr}
                </label>
                <div class="input-wrapper subject-wrapper hidden" style="margin-bottom: 0;">
                    <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 3px;">Select Subject</span>
                    <select class="subject-select" data-year="${yr}" style="width: 100%; padding: 0.4rem 0.6rem; border-radius: 7px; background: rgba(0,0,0,0.3); border: 1px solid rgba(139,92,246,0.4); color: var(--text-main); font-size: 0.85rem; outline: none;">
                    </select>
                </div>
            `;

            yearsContainer.appendChild(yrRow);

            const cb = yrRow.querySelector('.year-checkbox');
            const subWrapper = yrRow.querySelector('.subject-wrapper');
            const subSelect = yrRow.querySelector('.subject-select');

            populateDropdown(subSelect, yr);

            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    subWrapper.classList.remove('hidden');
                    subSelect.required = true;
                    // Activate card style
                    yrRow.style.background = 'rgba(139,92,246,0.12)';
                    yrRow.style.borderColor = 'var(--primary-color)';
                    yrRow.style.boxShadow = '0 0 0 1px rgba(139,92,246,0.3)';
                    yrRow.querySelector('.yr-label').style.color = 'var(--text-main)';
                } else {
                    subWrapper.classList.add('hidden');
                    subSelect.required = false;
                    subSelect.value = "";
                    // Reset card style
                    yrRow.style.background = 'rgba(0,0,0,0.15)';
                    yrRow.style.borderColor = 'var(--border-color)';
                    yrRow.style.boxShadow = 'none';
                    yrRow.querySelector('.yr-label').style.color = 'var(--text-muted)';
                }
                updateSubjectOptions();
            });

            subSelect.addEventListener('change', updateSubjectOptions);
        });

        shiftDiv.querySelector('.remove-shift-btn').addEventListener('click', () => {
            shiftDiv.remove();
            updateSubjectOptions();
        });

        // --- Auto-fill End Time from Start Time + Global Exam Duration ---
        const autoFillEndTime = () => {
            const durHr = parseInt(document.getElementById('exam-dur-hr')?.value || '0', 10);
            const durMin = parseInt(document.getElementById('exam-dur-min')?.value || '0', 10);
            const totalDurMins = durHr * 60 + durMin;
            if (totalDurMins === 0) return; // No duration set, skip

            const sHr = shiftDiv.querySelector('.shift-start-hr').value;
            const sMin = shiftDiv.querySelector('.shift-start-min').value;
            const sAmPm = shiftDiv.querySelector('.shift-start-ampm').value;
            if (!sHr || !sMin || !sAmPm) return; // Start time incomplete

            // Convert start to 24h minutes
            let startH24 = parseInt(sHr, 10) % 12; // 12 AM/PM → 0
            if (sAmPm === 'PM') startH24 += 12;
            const startTotalMins = startH24 * 60 + parseInt(sMin, 10);

            // Add duration
            const endTotalMins = startTotalMins + totalDurMins;
            const endH24 = Math.floor(endTotalMins / 60) % 24;
            const endMin = endTotalMins % 60;

            // Convert back to 12h
            const endAmPm = endH24 >= 12 ? 'PM' : 'AM';
            const endH12 = endH24 % 12 || 12;

            const endHrStr = String(endH12).padStart(2, '0');
            const endMinStr = String(endMin).padStart(2, '0');

            // Set end-time dropdowns
            shiftDiv.querySelector('.shift-end-hr').value = endHrStr;
            shiftDiv.querySelector('.shift-end-min').value = endMinStr;
            shiftDiv.querySelector('.shift-end-ampm').value = endAmPm;
        };

        // Trigger auto-fill whenever any start-time dropdown changes
        shiftDiv.querySelector('.shift-start-hr').addEventListener('change', autoFillEndTime);
        shiftDiv.querySelector('.shift-start-min').addEventListener('change', autoFillEndTime);
        shiftDiv.querySelector('.shift-start-ampm').addEventListener('change', autoFillEndTime);

        shiftsContainer.appendChild(shiftDiv);
        // Run AFTER DOM insertion so new shift's checkboxes are visible to querySelectorAll
        updateSubjectOptions();
    }

    function createDateBlock() {
        dateCount++;
        const dateId = `date-${Date.now()}`;
        const div = document.createElement('div');
        div.className = 'date-block slide-up delay-1';
        div.style.background = 'var(--bg-card)';
        div.style.padding = '1.5rem';
        div.style.borderRadius = '12px';
        div.style.border = '2px solid var(--border-color)';
        div.style.position = 'relative';

        div.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap: wrap;">
                <h3 style="margin: 0; color: var(--primary-color); font-size: 1.1rem;">
                    <i class="fa-regular fa-calendar" style="margin-right: 8px;"></i>Exam Date Configuration
                </h3>
                <button type="button" class="btn text-btn remove-date-btn" style="color: var(--error-color); padding: 4px 8px; flex-shrink: 0;">
                    <i class="fa-solid fa-trash"></i> Remove Date
                </button>
            </div>

            <div class="input-wrapper floating-label" style="max-width: 300px; margin-bottom: 1.5rem;">
                <input type="date" class="date-input" required>
                <label style="top: -10px; background: var(--bg-card); font-size: 0.8rem">Select Date</label>
            </div>
            
            <div class="shifts-container">
                <!-- Shifts go here -->
            </div>
            
            <button type="button" class="btn outline-btn add-shift-btn" style="margin-top: 0.5rem; font-size: 0.9rem; padding: 0.5rem 1rem;">
                <i class="fa-solid fa-plus"></i> Add a Shift to this Date
            </button>
        `;

        const shiftsContainer = div.querySelector('.shifts-container');
        let shiftCount = 0;

        div.querySelector('.add-shift-btn').addEventListener('click', () => {
            shiftCount++;
            createShiftBlock(dateId, shiftCount, shiftsContainer);
        });

        div.querySelector('.remove-date-btn').addEventListener('click', () => {
            div.remove();
            updateSubjectOptions();
        });

        // Add first shift by default
        shiftCount++;
        createShiftBlock(dateId, shiftCount, shiftsContainer);

        datesContainer.appendChild(div);
    }

    if (addDateBtn) {
        addDateBtn.addEventListener('click', createDateBlock);
        // Create first block by default
        createDateBlock();
    }

    // --- Generate Setup Configuration ---
    generateRoomsBtn.addEventListener('click', () => {
        const count = parseInt(roomCountInput.value);

        if (isNaN(count) || count < 1 || count > 50) {
            setupError.classList.remove('hidden');
            return;
        }

        setupError.classList.add('hidden');
        initializeRooms(count);
        mainContent.classList.remove('hidden');

        // Scroll to batch section
        setTimeout(() => {
            document.getElementById('batch-apply-section').scrollIntoView({ behavior: 'smooth' });
        }, 100);
    });

    // --- Room Name Auto-Increment Logic ---
    // Parse a room name string into { prefix (letters at start), number (trailing digits), suffix (any trailing non-digits) }
    function parseRoomName(name) {
        // Match: optional leading letters, then digits at the end
        const match = name.match(/^([A-Za-z]*)([0-9]+)([^0-9]*)$/);
        if (match) {
            return {
                prefix: match[1],
                number: parseInt(match[2], 10),
                numWidth: match[2].length, // preserve original digit width (e.g. "003" → width 3)
                suffix: match[3],
                parsed: true
            };
        }
        return { parsed: false };
    }

    // Called when a room name input is changed — cascades incremented names to all following rooms
    window.cascadeRoomNames = function (changedId) {
        const changedInput = document.getElementById(`room-name-input-${changedId}`);
        if (!changedInput) return;
        const changedName = changedInput.value.trim();
        const parsed = parseRoomName(changedName);
        if (!parsed.parsed) return; // Not a parseable numbered format; skip cascade

        // Find the index of the changed room in roomData
        const startIdx = roomData.findIndex(r => r.id === changedId);
        if (startIdx === -1) return;

        // Update all subsequent rooms, preserving leading-zero width
        const numWidth = parsed.numWidth || 1;
        let nextNum = parsed.number + 1;
        for (let i = startIdx + 1; i < roomData.length; i++) {
            const room = roomData[i];
            const paddedNum = String(nextNum).padStart(numWidth, '0');
            const newName = `${parsed.prefix}${paddedNum}${parsed.suffix}`;

            // Update the input
            const input = document.getElementById(`room-name-input-${room.id}`);
            if (input) input.value = newName;

            // Update the checkbox label
            const checkboxLabel = batchRoomCheckboxes.querySelector(`input[value="${room.id}"]`);
            if (checkboxLabel) {
                const labelText = checkboxLabel.closest('label').querySelector('.label-text');
                if (labelText) labelText.textContent = newName;
            }

            nextNum++;
        }
    };

    function initializeRooms(count) {
        roomData = [];
        roomsContainer.innerHTML = '';
        batchRoomCheckboxes.innerHTML = '';

        for (let i = 1; i <= count; i++) {
            const roomName = `N${100 + i}`;

            // Add to data structure
            roomData.push({
                id: i,
                name: roomName,
                rows: null,
                cols: null
            });

            // 1. Create Checkbox for Batch Section
            createBatchCheckbox(i, roomName);

            // 2. Create Room Card
            createRoomCard(i, roomName);
        }
    }

    // --- Room Cards & Visualizations ---
    function createRoomCard(id, name) {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.dataset.roomId = id;

        card.innerHTML = `
            <div class="room-card-header">
                <div class="room-card-title" style="display:flex; align-items:center;">
                    <i class="fa-solid fa-chalkboard-user"></i> 
                    <input type="text" id="room-name-input-${id}" value="${name}" 
                           style="background:transparent; border:none; border-bottom: 2px dashed rgba(255,255,255,0.2); 
                                  color:var(--text-main); font-family:inherit; font-size:inherit; font-weight:bold; 
                                  width: 140px; outline:none; margin-left:8px; padding-bottom: 2px; transition: border-color 0.2s;"
                           onfocus="this.style.borderBottomColor='var(--primary-color)'"
                           onblur="if(!this.value.trim()) this.value='${name}'; this.style.borderBottomColor='rgba(255,255,255,0.2)'; cascadeRoomNames(${id});">
                </div>
                <div class="room-stats"><span id="stats-${id}">0</span> Seats</div>
            </div>
            
            <div class="room-config-row">
                <div class="input-wrapper floating-label">
                    <input type="number" id="rows-${id}" min="1" placeholder=" " required>
                    <label for="rows-${id}">Rows</label>
                    <i class="fa-solid fa-arrows-up-down input-icon"></i>
                </div>
                <div class="input-wrapper floating-label">
                    <input type="number" id="cols-${id}" min="1" placeholder=" " required>
                    <label for="cols-${id}">Columns</label>
                    <i class="fa-solid fa-arrows-left-right input-icon"></i>
                </div>
            </div>
            
            <div class="room-config-row" style="margin-bottom: 1rem;">
            <div class="input-wrapper floating-label" style="flex: 1;">
                <select id="pattern-${id}" required style="width: 100%; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem 1rem 0.5rem 3rem; color: var(--text-main); font-size: 1.1rem; font-family: 'Outfit', sans-serif; appearance: none;">
                    <option value="IV Yr, III Yr, II Yr, I Yr" selected>IV Yr, III Yr, II Yr, I Yr</option>
                    <option value="I Yr, II Yr, III Yr, IV Yr">I Yr, II Yr, III Yr, IV Yr</option>
                    <option value="IV Yr, II Yr, III Yr, I Yr">IV Yr, II Yr, III Yr, I Yr</option>
                    <option value="III Yr, I Yr, IV Yr, II Yr">III Yr, I Yr, IV Yr, II Yr</option>
                    <option value="II Yr, IV Yr, I Yr, III Yr">II Yr, IV Yr, I Yr, III Yr</option>
                    <option value="IV Yr, I Yr, III Yr, II Yr">IV Yr, I Yr, III Yr, II Yr</option>
                    <option value="III Yr, II Yr, IV Yr, I Yr">III Yr, II Yr, IV Yr, I Yr</option>
                    <option value="II Yr, III Yr, I Yr, IV Yr">II Yr, III Yr, I Yr, IV Yr</option>
                </select>
                <i class="fa-solid fa-chevron-down" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;"></i>
                <label for="pattern-${id}">Seating Pattern</label>
                <i class="fa-solid fa-list-ol input-icon"></i>
            </div>
        </div>
        
        <div class="room-config-row" style="margin-bottom: 1rem;">
            <div class="input-wrapper floating-label">
                <select id="door-${id}">
                    <option value="top-right" selected>Top Right</option>
                        <option value="top-left">Top Left</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                    </select>
                    <label for="door-${id}">Entry Door</label>
                    <i class="fa-solid fa-door-open input-icon"></i>
                </div>
            </div>
            
            <button class="btn outline-btn update-room-btn" onclick="updateRoomPreview(${id})">
                <i class="fa-solid fa-rotate"></i> Update Preview
            </button>
            
            <div class="preview-wrapper">
                <div id="preview-${id}" class="grid-preview empty-state">
                    <i class="fa-solid fa-border-all"></i>
                    <span>Enter dimensions to see preview</span>
                </div>
            </div>
            `;

        roomsContainer.appendChild(card);

        // Add direct input listeners for instant feel (optional, but requested logic uses button)
        document.getElementById(`rows-${id}`).addEventListener('change', () => updateRoomPreview(id));
        document.getElementById(`cols-${id}`).addEventListener('change', () => updateRoomPreview(id));
    }

    // Expose update function to window for the inline onclick handler
    window.updateRoomPreview = function (id) {
        const rowsInput = document.getElementById(`rows-${id}`);
        const colsInput = document.getElementById(`cols-${id}`);
        const previewGrid = document.getElementById(`preview-${id}`);
        const statsEl = document.getElementById(`stats-${id}`);

        const rows = parseInt(rowsInput.value);
        const cols = parseInt(colsInput.value);

        if (isNaN(rows) || isNaN(cols) || rows < 1 || cols < 1) {
            return; // Invalid input
        }

        // Update data array
        const roomIndex = roomData.findIndex(r => r.id === id);
        if (roomIndex > -1) {
            roomData[roomIndex].rows = rows;
            roomData[roomIndex].cols = cols;
        }

        // Update Stats
        statsEl.textContent = rows * cols;

        // Remove empty state
        previewGrid.classList.remove('empty-state');
        previewGrid.innerHTML = '';

        // CSS Grid dynamic configuration
        previewGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

        // Generate seats
        // Cap preview visualization to prevent browser lag (e.g. max 400 seats mapped visually)
        const cellCount = Math.min(rows * cols, 400);

        for (let i = 0; i < cellCount; i++) {
            const seat = document.createElement('div');
            seat.className = 'seat-cell';
            previewGrid.appendChild(seat);
        }

        if (rows * cols > 400) {
            const notice = document.createElement('div');
            notice.style.gridColumn = `1 / -1`;
            notice.style.textAlign = 'center';
            notice.style.fontSize = '0.8rem';
            notice.style.color = 'var(--text-muted)';
            notice.style.marginTop = '10px';
            notice.textContent = `+ ${rows * cols - 400} more seats(preview limited)`;
            previewGrid.appendChild(notice);
        }
    };

    // --- Batch Configuration ---
    function createBatchCheckbox(id, name) {
        const wrapper = document.createElement('label');
        wrapper.className = 'custom-checkbox';
        wrapper.innerHTML = `
                <input type="checkbox" class="room-checkbox" value="${id}">
            <div class="checkmark"></div>
            <span class="label-text">${name}</span>
            `;
        batchRoomCheckboxes.appendChild(wrapper);
    }

    selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.room-checkbox').forEach(cb => cb.checked = true);
    });

    deselectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.room-checkbox').forEach(cb => cb.checked = false);
    });

    applyBatchBtn.addEventListener('click', () => {
        const rows = parseInt(batchRowsInput.value);
        const cols = parseInt(batchColsInput.value);
        const pattern = document.getElementById('batch-pattern').value;
        const selectedCheckboxes = document.querySelectorAll('.room-checkbox:checked');

        if (isNaN(rows) || rows < 1 || isNaN(cols) || cols < 1 || !pattern || selectedCheckboxes.length === 0) {
            batchError.classList.remove('hidden');
            setTimeout(() => batchError.classList.add('hidden'), 3000);
            return;
        }

        batchError.classList.add('hidden');

        // Apply to selected rooms
        selectedCheckboxes.forEach(cb => {
            const id = parseInt(cb.value);

            // Update individual inputs
            document.getElementById(`rows-${id}`).value = rows;
            document.getElementById(`cols-${id}`).value = cols;
            document.getElementById(`pattern-${id}`).value = pattern;

            // Trigger visual update
            updateRoomPreview(id);
        });

        // Flash effect on button to confirm action
        const originalText = applyBatchBtn.innerHTML;
        applyBatchBtn.innerHTML = '<i class="fa-solid fa-check"></i> Applied Successfully';
        applyBatchBtn.style.background = 'linear-gradient(135deg, var(--success-color), #059669)';

        setTimeout(() => {
            applyBatchBtn.innerHTML = originalText;
            applyBatchBtn.style.background = '';
        }, 2000);
    });


    // --- Final Generation & API Call ---
    function getCSRFToken() {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    finalGenerateBtn.addEventListener('click', async () => {
        finalError.classList.add('hidden');
        finalError.textContent = '';

        // 1. Gather all data
        const studentFile = document.getElementById('student-file').files[0];
        const subjectFile = document.getElementById('subject-file').files[0];

        const departmentNameSelect = document.getElementById('department-name').value;
        let departmentName;
        if (departmentNameSelect === 'Custom') {
            departmentName = document.getElementById('custom-department-name').value.trim();
            if (!departmentName) {
                finalError.textContent = 'Please enter a valid Custom Department Name.';
                finalError.classList.remove('hidden');
                return;
            }
        } else {
            departmentName = departmentNameSelect;
        }

        if (!studentFile) {
            finalError.textContent = 'Please upload a Student Excel file First.';
            finalError.classList.remove('hidden');
            document.getElementById('config-section').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (!departmentName) { // This check is now for departmentName
            finalError.textContent = 'Please enter a Department Name.';
            finalError.classList.remove('hidden');
            return;
        }

        if (!subjectFile && Object.values(window.subjectCodes).every(arr => arr.length === 0)) {
            finalError.textContent = 'Please upload a Subject Codes Excel file first to populate subjects.';
            finalError.classList.remove('hidden');
            return;
        }

        // Validate Timetable Dates
        const scheduleConfig = [];
        let validationFailed = false;

        // Clear previous highlights
        document.querySelectorAll('.error-highlight').forEach(el => el.classList.remove('error-highlight'));
        const globalDates = new Set();
        const globalSubjects = new Set();
        let scrollTarget = null;

        const markError = (element) => {
            if (element) {
                element.classList.add('error-highlight');
                if (!scrollTarget) scrollTarget = element;
            }
        };

        document.querySelectorAll('.date-block').forEach(dateBlock => {
            const dateInput = dateBlock.querySelector('.date-input');
            const dateVal = dateInput.value;

            if (!dateVal) {
                validationFailed = true;
                markError(dateInput);
            } else if (globalDates.has(dateVal)) {
                // Must be unique date
                validationFailed = true;
                markError(dateInput);
                finalError.innerHTML = `Duplicate Exam Date found: <b>${dateVal}</b>. Please consolidate shifts under a single Date Block.`;
            } else {
                globalDates.add(dateVal);
            }

            const shifts = [];
            dateBlock.querySelectorAll('.shift-block').forEach(shiftBlock => {
                const sHr = shiftBlock.querySelector('.shift-start-hr').value;
                const sMin = shiftBlock.querySelector('.shift-start-min').value;
                const sAmPm = shiftBlock.querySelector('.shift-start-ampm').value;

                const eHr = shiftBlock.querySelector('.shift-end-hr').value;
                const eMin = shiftBlock.querySelector('.shift-end-min').value;
                const eAmPm = shiftBlock.querySelector('.shift-end-ampm').value;

                let timeStr = "";

                if (!sHr || !sMin || !sAmPm) { validationFailed = true; markError(shiftBlock.querySelector('.shift-start-hr')); }
                if (!eHr || !eMin || !eAmPm) { validationFailed = true; markError(shiftBlock.querySelector('.shift-end-hr')); }

                if (sHr && sMin && sAmPm && eHr && eMin && eAmPm) {
                    timeStr = `${parseInt(sHr, 10)}:${sMin} ${sAmPm} - ${parseInt(eHr, 10)}:${eMin} ${eAmPm}`;
                }

                const participatingYears = [];
                let yearSelected = false;

                shiftBlock.querySelectorAll('.year-checkbox').forEach(cb => {
                    if (cb.checked) {
                        yearSelected = true;
                        const yr = cb.dataset.year;
                        const subjectSelect = shiftBlock.querySelector(`.subject-select[data-year="${yr}"]`);
                        const subject = subjectSelect.value;

                        if (!subject) {
                            validationFailed = true;
                            markError(subjectSelect);
                        } else if (globalSubjects.has(subject)) {
                            validationFailed = true;
                            markError(subjectSelect);
                            finalError.innerHTML = `Duplicate Subject found: <b>${subject}</b>. Subjects can only be scheduled once.`;
                        } else {
                            globalSubjects.add(subject);
                            participatingYears.push({
                                year: yr,
                                subject: subject
                            });
                        }
                    }
                });

                if (!yearSelected) {
                    validationFailed = true;
                    markError(shiftBlock.querySelector('.years-container'));
                }

                shifts.push({
                    time: timeStr,
                    years: participatingYears
                });
            });

            if (shifts.length === 0) {
                validationFailed = true;
                markError(dateBlock);
            }

            scheduleConfig.push({
                date: dateVal,
                shifts: shifts
            });
        });

        if (scheduleConfig.length === 0) {
            finalError.textContent = 'Please add at least one Exam Date with a Shift.';
            finalError.classList.remove('hidden');
            return;
        }

        if (validationFailed) {
            if (!finalError.innerHTML.includes('Duplicate')) {
                finalError.textContent = 'Please fill all highlighted mandatory fields correctly.';
            }
            finalError.classList.remove('hidden');
            if (scrollTarget) {
                scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Validate that all initialized rooms have a configuration
        const payloadRooms = [];
        let missingConfig = false;

        for (const room of roomData) {
            // grab latest values from inputs in case preview wasn't explicitly clicked
            const nameEl = document.getElementById(`room-name-input-${room.id}`);
            const updatedRoomName = nameEl ? nameEl.value.trim() : room.name;

            const rowsInput = document.getElementById(`rows-${room.id}`).value;
            const colsInput = document.getElementById(`cols-${room.id}`).value;
            const doorInput = document.getElementById(`door-${room.id}`) ? document.getElementById(`door-${room.id}`).value : 'top-right';
            const patternInput = document.getElementById(`pattern-${room.id}`).value;

            if (!rowsInput || !colsInput || parseInt(rowsInput) < 1 || parseInt(colsInput) < 1 || !patternInput) {
                missingConfig = true;
                break;
            }

            payloadRooms.push({
                name: updatedRoomName || room.name,
                rows: rowsInput ? parseInt(rowsInput) : 0,
                cols: colsInput ? parseInt(colsInput) : 0,
                door: doorInput,
                seating_pattern: patternInput
            });
        }

        if (missingConfig) {
            finalError.textContent = 'Please make sure all rooms have valid Rows, Columns, and Patterns assigned.';
            finalError.classList.remove('hidden');
            return;
        }

        const isManualObjectsMode = document.querySelector('input[name="subject-source"]:checked').value === 'manual';

        // 2. Prepare FormData
        const formData = new FormData();

        // If a new student file is uploaded, use it. Otherwise, if we restored a preset, send its base64 mapping if possible.
        // Actually, the new backend accepts `student_data` as a JSON string!
        if (studentFile) {
            formData.append('student_file', studentFile);
            window.activePreset = null; // Clear active preset since they provided a new file
            // Let's reset the label
            const studentLabel = document.querySelector('label[for="student-file"]');
            if (studentLabel) studentLabel.innerHTML = 'Student List (Excel)';
        } else if (window.activePreset && window.activePreset.studentDataStr) {
            formData.append('student_data', window.activePreset.studentDataStr);
        } else {
            finalError.textContent = 'Please upload a Student Excel file first or load a valid preset.';
            finalError.classList.remove('hidden');
            document.getElementById('config-section').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        formData.append('branch_name', document.getElementById('department-name').value);
        formData.append('schedule_config', JSON.stringify(scheduleConfig));
        formData.append('room_config', JSON.stringify(payloadRooms));

        const originalBtnHtml = finalGenerateBtn.innerHTML;
        finalGenerateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        finalGenerateBtn.disabled = true;

        // Save preset functionality wrapper
        const saveCurrentConfiguration = async (instituteLogoBase64) => {
            let studentDataStr = null;
            if (studentFile) {
                // If they just uploaded it, we should parse it to JSON so we can save it for future presets without backend reliance!
                try {
                    const data = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(new Uint8Array(e.target.result));
                        reader.onerror = e => reject(e);
                        reader.readAsArrayBuffer(studentFile);
                    });
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    // Simple conversion just to store the basic structure we uploaded.
                    // But wait! The python backend maps I, II, III, IV year columns. 
                    // Instead of duplicating that logic here, and since we already just modified backend to accept JSON,
                    // let's actually just parse all columns blindly and let python sort it out, OR we just save the file as a base64 DataURL?
                    // Wait! I ALREADY MODIFIED THE BACKEND to expect `{ "I Yr": [...], "II Yr": [...] }`.
                    // Since Python maps it from the file during generation, let's use the successful Generation's returned 'attendance_data' which contains the PERFECTLY PARSED "year_master" JSON!
                    // We don't even need to parse the file on the client!!! 
                } catch (e) { console.error("Preset saving error:", e); }
            } else if (window.activePreset) {
                studentDataStr = window.activePreset.studentDataStr;
            }

            return {
                timestamp: Date.now(),
                dateStr: new Date().toLocaleString(),
                instituteName: document.getElementById('institute-name').value,
                departmentSelect: document.getElementById('department-name').value,
                customDepartment: document.getElementById('custom-department-name').value,
                midSem: document.getElementById('mid-sem').value,
                subjectSource: document.querySelector('input[name="subject-source"]:checked').value,
                subjectCodes: window.subjectCodes,
                scheduleConfigStr: JSON.stringify(scheduleConfig),
                roomConfigStr: JSON.stringify(payloadRooms),
                roomsCount: payloadRooms.length,
                shiftsCount: scheduleConfig.reduce((acc, c) => acc + c.shifts.length, 0),
                logoBase64: instituteLogoBase64 || (window.activePreset ? window.activePreset.logoBase64 : null),
                studentDataStr: studentDataStr // to be updated next
            };
        };

        // 3. Send API Request
        try {
            const response = await fetch('/seat_manager/generate/', {
                method: 'POST',
                // CSRF Token header normally needed, but we used @csrf_exempt on the view for simplicity in this script setup. 
                // However, adding it is best practice if omitting decorator:
                // headers: { 'X-CSRFToken': getCSRFToken() },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Something went wrong on the server.');
            }

            // 4. Handle Success
            const instituteName = document.getElementById('institute-name').value || 'Institute Name';
            const instituteSubheader = document.getElementById('institute-subheader')?.value.trim() || '';
            const instituteLogoFile = document.getElementById('institute-logo').files[0];

            const deptSelectVal = document.getElementById('department-name').value;
            const customDeptVal = document.getElementById('custom-department-name').value;
            const finalDepartmentName = (deptSelectVal === 'Custom' && customDeptVal.trim() !== '') ? customDeptVal.trim() : deptSelectVal;

            let instituteLogoBase64 = null;
            if (instituteLogoFile) {
                const reader = new FileReader();
                const promise = new Promise(resolve => {
                    reader.onload = e => resolve(e.target.result);
                });
                reader.readAsDataURL(instituteLogoFile);
                instituteLogoBase64 = await promise;
            }

            // Populate the history presets!
            const presetObj = await saveCurrentConfiguration(instituteLogoBase64);
            // The python backend returns 'attendance_data' which is the parsed 'year_master' dict! This is brilliant!
            presetObj.studentDataStr = JSON.stringify(data.attendance_data);
            presetObj.name = `Config - ${scheduleConfig[0]?.date || 'Unknown Date'}`;

            // Cache for Add Room feature
            window.activePreset = presetObj;
            window.globalSeatingData = data;
            window.lastLogoBase64 = instituteLogoBase64;

            try {
                let existingPresets = JSON.parse(localStorage.getItem('examSeatingPresets')) || [];
                // Add to beginning, keep only last 4
                existingPresets.unshift(presetObj);
                if (existingPresets.length > 4) existingPresets = existingPresets.slice(0, 4);
                localStorage.setItem('examSeatingPresets', JSON.stringify(existingPresets));
            } catch (e) { console.error("Could not save preset to localStorage", e); }

            renderResults(data, instituteName, instituteLogoBase64, finalDepartmentName, instituteSubheader);

        } catch (error) {
            finalError.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error: ${error.message}`;
            finalError.classList.remove('hidden');
        } finally {
            finalGenerateBtn.innerHTML = originalBtnHtml;
            finalGenerateBtn.disabled = false;
        }
    });

    backToConfigBtn.addEventListener('click', () => {
        document.getElementById('output-content').classList.add('hidden');
        document.getElementById('config-section').classList.remove('hidden');
        document.getElementById('timetable-builder-section').classList.remove('hidden');
        document.getElementById('setup-section').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');
    });

    // --- Export Functionality ---

    document.getElementById('export-excel-btn').addEventListener('click', () => {
        const wb = XLSX.utils.book_new();
        // Export just the active tab's tables
        const activeTab = document.querySelector('.tab-content:not(.hidden)');
        if (!activeTab) return;

        activeTab.classList.add('exporting');
        const containers = activeTab.querySelectorAll('.print-container');
        if (containers.length === 0) {
            activeTab.classList.remove('exporting');
            return;
        }

        containers.forEach((container, index) => {
            // Find preceding heading to name the sheet
            let sheetName = `Sheet ${index + 1}`;

            // Try to name the sheet intelligently based on the context
            const h3 = container.querySelector('h3');
            if (h3) sheetName = h3.textContent.replace('SEATING CHART', '').trim().substring(0, 30).replace(/[\\/?*[\]]/g, '');
            else {
                const h1 = container.querySelector('h1');
                if (h1 && h1.textContent !== 'Your Institute Name' && h1.textContent.trim() !== '') sheetName = h1.textContent.substring(0, 30).replace(/[\\/?*[\]]/g, '');
            }

            // Ensure unique names
            let count = 1;
            let finalName = sheetName;
            while (wb.SheetNames.includes(finalName)) {
                finalName = `${sheetName.substring(0, 25)} (${count})`;
                count++;
            }

            // Build array of rows manually
            const sheetData = [];

            // 1. Add Header Information (H1 and P from print-header)
            const headerDiv = container.querySelector('.print-header');
            if (headerDiv) {
                const headerH1 = headerDiv.querySelector('h1')?.textContent || '';
                const headerP = headerDiv.querySelector('p')?.textContent || '';
                if (headerH1) sheetData.push([headerH1]);
                if (headerP) sheetData.push([headerP]);
                sheetData.push([]); // blank row
            }

            // 2. Add sub-headers (H2, H3, H4) excluding the global ones already in print-header
            const headings = container.querySelectorAll('h2, h3, h4');
            headings.forEach(h => {
                if (!h.closest('.print-header')) {
                    sheetData.push([h.textContent.trim()]);
                }
            });

            // 3. Add Room Stats if they exist (from seating charts)
            const statsCards = container.querySelectorAll('.year-badge');
            if (statsCards.length > 0) {
                const statsRow = [];
                container.querySelectorAll('span').forEach(span => {
                    const text = span.textContent.trim();
                    if (text.includes('Yr:') || text.includes('Total')) {
                        statsRow.push(text);
                    }
                });
                if (statsRow.length > 0) {
                    sheetData.push(statsRow);
                    sheetData.push([]); // blank row
                }
            }

            // 4. Add the Table Data
            const table = container.querySelector('table');
            if (table) {
                // Manually parse table avoiding complex parsing
                const rows = table.querySelectorAll('tr');
                rows.forEach(tr => {
                    const rowData = [];
                    tr.querySelectorAll('th, td').forEach(cell => {
                        // Clean up text content and remove extra whitespaces
                        rowData.push(cell.textContent.trim().replace(/\s+/g, ' '));
                    });
                    sheetData.push(rowData);
                });
            }

            const ws = XLSX.utils.aoa_to_sheet(sheetData);

            // Basic styling - auto-width columns
            if (table) {
                const colWidths = [];
                table.querySelectorAll('tr:first-child th, tr:first-child td').forEach(cell => {
                    colWidths.push({ wch: Math.max(20, cell.textContent.length + 5) });
                });
                ws['!cols'] = colWidths;
            }

            XLSX.utils.book_append_sheet(wb, ws, finalName);
        });

        let filenameStr = 'Exam_Result.xlsx';
        if (activeTab.id === 'tab-timetable') filenameStr = 'Master_Timetable.xlsx';
        if (activeTab.id === 'tab-seating') filenameStr = 'Seating_Charts.xlsx';
        if (activeTab.id === 'tab-attendance-room') filenameStr = 'Room_Wise_Attendance.xlsx';
        if (activeTab.id === 'tab-attendance') filenameStr = 'Attendance_Sheets.xlsx';

        XLSX.writeFile(wb, filenameStr);
        activeTab.classList.remove('exporting');
    });

    // --- Print Button: set descriptive document.title so PDF filename is meaningful ---
    document.getElementById('print-btn').addEventListener('click', () => {
        const activeTab = document.querySelector('.tab-content:not(.hidden)');
        const tabTitleMap = {
            'tab-timetable': 'Master_Timetable',
            'tab-seating': 'Seating_Charts',
            'tab-attendance-master': 'Master_Attendance',
            'tab-attendance-room': 'Room_Wise_Attendance',
            'tab-attendance': 'Attendance_Sheets',
        };
        const originalTitle = document.title;
        document.title = activeTab ? (tabTitleMap[activeTab.id] || 'Exam_Report') : 'Exam_Report';
        window.print();
        // Restore after print dialog closes
        setTimeout(() => { document.title = originalTitle; }, 1000);
    });

    // Global UI toggle functions for the nested tabs
    window.switchDateTab = function (btn, dateId, prefix) {
        document.querySelectorAll(`.${prefix}-date-panel`).forEach(el => el.classList.add('hidden'));
        document.querySelectorAll(`.${prefix}-date-btn`).forEach(el => el.classList.remove('active'));
        document.getElementById(`${prefix}-date-${dateId}`).classList.remove('hidden');
        btn.classList.add('active');
    };

    window.switchShiftTab = function (btn, shiftId, prefix) {
        document.querySelectorAll(`.${prefix}-shift-panel`).forEach(el => el.classList.add('hidden'));
        document.querySelectorAll(`.${prefix}-shift-btn`).forEach(el => el.classList.remove('active'));
        document.getElementById(`${prefix}-shift-${shiftId}`).classList.remove('hidden');
        btn.classList.add('active');
    };

    window.switchRoomTab = function (btn, roomId, prefix = 'attendance') {
        document.querySelectorAll(`.${prefix}-room-panel`).forEach(el => el.classList.add('hidden'));
        document.querySelectorAll(`.${prefix}-room-btn`).forEach(el => el.classList.remove('active'));
        document.getElementById(`${prefix}-room-${roomId}`).classList.remove('hidden');
        btn.classList.add('active');
    };

    window.viewAllRooms = function (btn, prefix) {
        document.querySelectorAll(`.${prefix}-room-panel`).forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll(`.${prefix}-room-btn`).forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
    };

    function renderResults(data, instituteName, instituteLogoBase64, departmentName, instituteSubheader) {
        // Read Printable Footer settings
        const enableFooter = document.getElementById('enable-footer-toggle')?.checked;
        const footerScope = document.querySelector('input[name="footer-scope"]:checked')?.value || 'all';
        const enableTargetTimetable = document.getElementById('footer-target-timetable')?.checked;
        const enableTargetSeating = document.getElementById('footer-target-seating')?.checked;
        const enableTargetAttendance = document.getElementById('footer-target-attendance')?.checked;

        const leftSig = document.getElementById('footer-left-text')?.value || 'MST Coordinator';
        const centerSig = document.getElementById('footer-center-text')?.value || 'Branch Coordinator';
        const rightSig = document.getElementById('footer-right-text')?.value || 'HoD CSE';

        const renderFooterHtml = (isLast, targetType) => {
            if (!enableFooter) return '';

            if (targetType === 'timetable' && !enableTargetTimetable) return '';
            if (targetType === 'seating' && !enableTargetSeating) return '';
            if (targetType === 'attendance' && !enableTargetAttendance) return '';

            if (footerScope === 'last' && !isLast) return '';

            return `
                <div class="print-footer" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; padding: 15px 50px 0 50px;">
                    <div style="text-align: left; font-weight: 600; width: 33%; font-size: 1.1rem; color: var(--text-main);">${leftSig}</div>
                    <div style="text-align: center; font-weight: 600; width: 33%; font-size: 1.1rem; color: var(--text-main);">${centerSig}</div>
                    <div style="text-align: right; font-weight: 600; width: 33%; font-size: 1.1rem; color: var(--text-main);">${rightSig}</div>
                </div>
            `;
        };

        // Hide config, show results
        document.getElementById('config-section').classList.add('hidden');
        document.getElementById('timetable-builder-section').classList.add('hidden');
        document.getElementById('setup-section').classList.add('hidden');
        document.getElementById('main-content').classList.add('hidden');
        outputContent.classList.remove('hidden');

        const buildPrintHeader = (subtitle) => {
            const midSemType = document.getElementById('mid-sem')?.value || '1';
            const examPrefix = midSemType === 'R' ? 'REMEDIAL ' : `MST-${midSemType} `;

            return `
            <div class="print-header" style="display: flex; align-items: center; justify-content: center; gap: 2rem; margin-bottom: 2rem; border-bottom: 3px double var(--border-color); padding-bottom: 1rem;">
                ${instituteLogoBase64 ? `<img src="${instituteLogoBase64}" class="print-logo" alt="Logo">` : ''}
                <div style="text-align: center;">
                    <h1 style="font-size: 2rem; margin: 0; color: var(--text-main); text-transform: uppercase; font-family: 'Times New Roman', Times, serif;">${instituteName}</h1>
                    <p style="margin: 0.15rem 0 0 0; font-size: 1rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em;">Department of ${departmentName}</p>
                    ${instituteSubheader ? `<p style="margin: 0.1rem 0 0 0; font-size: 0.9rem; color: var(--text-muted); white-space: pre-line; line-height: 1.5;">${instituteSubheader}</p>` : ''}
                    <p style="margin: 0.2rem 0 0 0; font-size: 1.2rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">${examPrefix}${subtitle}</p>
                </div>
            </div>
            `;
        };

        // Build Timetable Tab
        // Build Master Timetable Tab
        let masterHtml = `
        <div class="glass-card print-container portrait-table" style="margin-bottom: 3rem; overflow-x: auto; position: relative;">
            ${buildPrintHeader('Master Examination Timetable')}
            <table class="timetable-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="min-width: 150px; border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05);">Date & Time</th>`;

        const allExpectedYears = ["IV Yr", "III Yr", "II Yr", "I Yr"].filter(y => {
            return data.master_timetable.some(entry => entry[y] && entry[y] !== '-');
        });

        allExpectedYears.forEach(y => {
            masterHtml += `<th style="border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05);">${y}</th>`;
        });

        masterHtml += `</tr>
                </thead>
                <tbody>`;

        data.master_timetable.forEach(entry => {
            masterHtml += `
            <tr>
                <td style="border: 1px solid var(--border-color); padding: 12px;">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 1.1rem;">${entry.date}</div>
                    <div style="color: var(--accent-color); font-size: 0.9rem; margin-top: 4px;"><i class="fa-regular fa-clock"></i> ${entry.shift}</div>
                </td>`;

            allExpectedYears.forEach(y => {
                const subj = entry[y];
                if (subj && subj !== '-') {
                    masterHtml += `<td style="border: 1px solid var(--border-color); padding: 12px;"><span class="subject-badge">${subj}</span></td>`;
                } else {
                    masterHtml += `<td style="border: 1px solid var(--border-color); padding: 12px;"><span style="color: var(--text-muted); opacity: 0.5;">-</span></td>`;
                }
            });

            masterHtml += `</tr>`;
        });

        masterHtml += `
                </tbody>
            </table>
            ${renderFooterHtml(true, 'timetable')}
        </div>`;
        document.getElementById('tab-timetable').innerHTML = masterHtml;

        // Build Seating Charts Tab
        let seatingHtml = `<h1 style="font-size: 2.5rem; color: var(--primary-color); text-align: center; margin-bottom: 2rem;">Seating Charts</h1>`;

        const consolidatedSeating = {};

        data.seating_plans.forEach(plan => {
            // Hash the matrix to easily identify identical seating arrangements in the same room
            const matrixHash = JSON.stringify(plan.matrix);
            const hashKey = `${plan.room_name}___${matrixHash}`;

            if (!consolidatedSeating[hashKey]) {
                consolidatedSeating[hashKey] = {
                    room_name: plan.room_name,
                    rows: plan.rows,
                    cols: plan.cols,
                    door: plan.door,
                    headers: plan.headers,
                    matrix: plan.matrix,
                    counts: plan.counts,
                    total_in_room: plan.total_in_room,
                    sessions: []
                };
            }
            // Add the date and shift to this seating variation
            consolidatedSeating[hashKey].sessions.push({ date: plan.date, shift: plan.shift });
        });

        // Preserve the exact room order the user entered (UI tile order) — no sorting
        const seatingRoomsList = [...new Set(data.seating_plans.map(p => p.room_name))];

        if (seatingRoomsList.length > 0) {
            // Create pill nav for Rooms (flat tab structure exactly like Attendance)
            seatingHtml += `<div class="pill-nav" style="display:flex; justify-content:center; gap:10px; margin-bottom:2rem; flex-wrap:wrap;">`;

            // Add a "View All" button to enable cross-room drag & drop
            seatingHtml += `<button class="btn outline-btn tab-btn seating-room-btn" onclick="viewAllRooms(this, 'seating')" style="border-style: dashed; color: var(--accent-color); border-color: var(--accent-color);"><i class="fa-solid fa-layer-group"></i> View All</button>`;

            seatingRoomsList.forEach((room, i) => {
                const safeRoom = room.replace(/\s/g, '_');
                seatingHtml += `<button class="btn outline-btn tab-btn seating-room-btn ${i === 0 ? 'active' : ''}" onclick="switchRoomTab(this, '${safeRoom}', 'seating')">${room}</button>`;
            });
            seatingHtml += `</div>`;

            seatingRoomsList.forEach((room, i) => {
                const safeRoom = room.replace(/\s/g, '_');
                seatingHtml += `<div id="seating-room-${safeRoom}" class="seating-room-panel sub-panel ${i === 0 ? '' : 'hidden'}">`;

                const plansForRoom = Object.values(consolidatedSeating).filter(c => c.room_name === room);

                plansForRoom.forEach((plan, idx) => {
                    // Smart Orientation Logic
                    const orientationClass = plan.cols > plan.rows ? 'landscape-table' : 'portrait-table';

                    // Construct a compact single-line string of all dates/shifts sharing this layout
                    const sessionsHtml = plan.sessions.map(s => `<span style="white-space:nowrap;">${s.date} &nbsp;${s.shift}</span>`).join('<span style="margin:0 6px;opacity:0.5;">•</span>');

                    const tableId = `tbl_${Math.random().toString(36).substr(2, 9)}`;
                    window.tableDataMap[tableId] = {
                        room_name: plan.room_name,
                        sessions: plan.sessions,
                        headers: plan.headers,
                        rows: plan.rows,
                        cols: plan.cols,
                        door: plan.door
                    };

                    seatingHtml += `
            <div class="glass-card ${orientationClass} print-container" style="margin-bottom: 4rem; overflow-x: auto; position: relative;">
                                ${buildPrintHeader(`Seating Chart • ${plan.room_name}`)}
                                <div style="color: var(--text-main); margin-bottom: 0.75rem; text-align: center; font-size: 0.85rem; font-weight: 600; line-height: 1.4; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px;">
                                    <i class="fa-regular fa-calendar" style="margin-right:4px; opacity:0.7;"></i>${sessionsHtml}
                                </div>
                                
                                <div style="position: relative; display: inline-block; width: 100%; margin-top: 1.5rem;">
                                    <div class="door-indicator ${plan.door}"><i class="fa-solid fa-door-open"></i> Entry</div>
                                    <table class="seating-table" data-table-id="${tableId}">
                                        <thead>
                                            <tr>
                                                ${(() => {
                        // Compute which columns are fully empty (no students)
                        const numCols = plan.headers.length;
                        const colEmpty = Array(numCols).fill(true);
                        plan.matrix.forEach(row => { // Iterate through all rows of the matrix
                            row.forEach((cell, ci) => {
                                if (cell && cell.student) colEmpty[ci] = false;
                            });
                        });
                        return plan.headers.map((h, ci) => {
                            const label = colEmpty[ci] ? '' : h;
                            const isBenchDiv = ((ci + 1) % 3 === 0) && (ci < numCols - 1);
                            const isBenchStart = (ci % 3 === 0) && ci > 0;
                            const cls = [isBenchDiv ? 'bench-divider' : '', isBenchStart ? 'bench-start' : ''].filter(Boolean).join(' ');
                            return `<th class="${cls}">${label}</th>`;
                        }).join('');
                    })()}
                                            </tr>
                                        </thead>
                                         <tbody>
                                             ${plan.matrix.slice(1).map(row => `
                                                <tr>
                                                    ${row.map((cell, ci) => {
                        const numCols = row.length;
                        const isBenchDiv = ((ci + 1) % 3 === 0) && (ci < numCols - 1);
                        const isBenchStart = (ci % 3 === 0) && ci > 0;
                        const benchClass = [isBenchDiv ? 'bench-divider' : '', isBenchStart ? 'bench-start' : ''].filter(Boolean).join(' ');
                        const benchClassStr = benchClass ? ' ' + benchClass : '';
                        if (!cell || !cell.student) return `<td class="chart-seat empty-seat${benchClassStr}" draggable="true" title="Drag to rearrange or click to fill seat."></td>`;

                        // Handle both old format (string) and new format (object)
                        // Backend sends { student: "enrollment_str", name: "...", year: "..." }
                        // After sync, format is { student: { enrollment, name }, year: "..." }
                        const enrollmentStr = typeof cell.student === 'object' ? (cell.student.enrollment || '') : cell.student;
                        const nameStr = typeof cell.student === 'object' ? (cell.student.name || '') : (cell.name || '');

                        let lenClass = 'len-short';
                        if (enrollmentStr.length > 11) lenClass = 'len-long';
                        else if (enrollmentStr.length > 8) lenClass = 'len-medium';

                        return `<td class="chart-seat occupied-seat${benchClassStr}" draggable="true" data-enrollment="${enrollmentStr}" data-name="${nameStr}" data-year="${cell.year}" title="${nameStr ? enrollmentStr + ' - ' + nameStr : enrollmentStr}\nDrag to rearrange.">
                                    <div class="student-id ${lenClass}">${enrollmentStr}</div>
                                    <div class="year-badge ${cell.year.replace(' ', '-')}">${cell.year}</div>
                                </td>`;
                    }).join('')}
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <div class="stats-container" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
                                    <div style="display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap;">
                                        ${Object.entries(plan.counts).map(([yr, count]) => `
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <div class="year-badge ${yr.replace(' ', '-')}"></div>
                                                <span style="color: var(--text-muted);">${yr}: <strong style="color: var(--text-main);">${count}</strong></span>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <div style="text-align: center; margin-top: 1rem; color: var(--text-main); font-weight: 600;">
                                        Total Students in Room: <span style="color: var(--primary-color);">${plan.total_in_room} / ${plan.rows * plan.cols} Capacity</span>
                                    </div>
                                </div>
                                ${renderFooterHtml(idx === plansForRoom.length - 1, 'seating')}
                            </div>
                    `;
                });

                seatingHtml += `</div>`; // Close room content
            });
        }
        document.getElementById('tab-seating').innerHTML = seatingHtml;

        // Call abstracted function to generate and render attendance tabs
        window.renderAttendanceTabs(data, instituteName, instituteLogoBase64, departmentName, instituteSubheader);

        // Reset to first tab on generation
        document.querySelector('.tab-btn[data-target="tab-timetable"]').click();
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Initialize drag and drop for seating charts
        setTimeout(initializeDragAndDrop, 100);
    }

    // --- Drag and Drop Logic ---
    window.draggedSeat = null;

    function initializeDragAndDrop() {
        const seats = document.querySelectorAll('.chart-seat');

        // Reset the Buffer Dropzone just in case
        const bufferDropzone = document.getElementById('buffer-dropzone');
        const bufferPlaceholder = document.getElementById('buffer-placeholder');
        if (bufferDropzone) {
            bufferDropzone.querySelectorAll('.chart-seat').forEach(s => s.remove());
            if (bufferPlaceholder) bufferPlaceholder.style.display = 'block';
        }

        seats.forEach(seat => {
            seat.draggable = true;

            // Remove old listeners to prevent duplication if called multiple times
            const newSeat = seat.cloneNode(true);
            seat.parentNode.replaceChild(newSeat, seat);

            newSeat.addEventListener('dragstart', function (e) {
                if (!window.isEditMode) {
                    e.preventDefault();
                    return; // Only allow drag in edit mode
                }
                window.draggedSeat = this;
                e.dataTransfer.effectAllowed = 'move';
                this.classList.add('dragging');
            });

            newSeat.addEventListener('dragend', function (e) {
                this.classList.remove('dragging');
                document.querySelectorAll('.chart-seat').forEach(s => s.classList.remove('drag-over'));
                window.draggedSeat = null;
            });

            newSeat.addEventListener('dragover', function (e) {
                if (!window.isEditMode) return;

                if (window.draggedSeat && window.draggedSeat !== this) {
                    // RULES:
                    // 1. If dragging from buffer tray -> allow drop anywhere.
                    // 2. If dragging from a table to another table -> only allow if it's the SAME table.
                    const isFromBuffer = window.draggedSeat.closest('#buffer-dropzone');
                    const isSameTable = window.draggedSeat.closest('table') === this.closest('table');

                    if (isFromBuffer || isSameTable) {
                        e.preventDefault();
                        this.classList.add('drag-over');
                    }
                }
            });

            newSeat.addEventListener('dragleave', function (e) {
                this.classList.remove('drag-over');
            });

            newSeat.addEventListener('drop', function (e) {
                if (!window.isEditMode) return;

                e.preventDefault();
                this.classList.remove('drag-over');

                if (window.draggedSeat && window.draggedSeat !== this) {
                    const isFromBuffer = window.draggedSeat.closest('#buffer-dropzone');
                    const isSameTable = window.draggedSeat.closest('table') === this.closest('table');

                    if (isFromBuffer || isSameTable) {
                        // Swap inner HTML
                        const tempHTML = this.innerHTML;
                        this.innerHTML = window.draggedSeat.innerHTML;
                        window.draggedSeat.innerHTML = tempHTML;

                        // Swap Data Attributes
                        const thisDataset = { ...this.dataset };
                        const draggedDataset = { ...window.draggedSeat.dataset };

                        Object.keys(this.dataset).forEach(k => delete this.dataset[k]);
                        Object.keys(window.draggedSeat.dataset).forEach(k => delete window.draggedSeat.dataset[k]);

                        Object.keys(draggedDataset).forEach(k => this.dataset[k] = draggedDataset[k]);
                        Object.keys(thisDataset).forEach(k => window.draggedSeat.dataset[k] = thisDataset[k]);

                        // Preserve structural classes on the corresponding DOM elements
                        const getStructuralClasses = (el) => [...el.classList].filter(c => ['bench-divider', 'bench-start'].includes(c));
                        const thisStructural = getStructuralClasses(this);
                        const draggedStructural = getStructuralClasses(window.draggedSeat);

                        // Swap content-related CSS Classes
                        const thisContentClasses = [...this.classList].filter(c => !['chart-seat', 'dragging', 'drag-over', 'highlight-drop', 'bench-divider', 'bench-start', 'empty-seat', 'occupied-seat'].includes(c));
                        const draggedContentClasses = [...window.draggedSeat.classList].filter(c => !['chart-seat', 'dragging', 'drag-over', 'highlight-drop', 'bench-divider', 'bench-start', 'empty-seat', 'occupied-seat'].includes(c));

                        // Determine new occupancy state
                        const thisIsOccupied = this.dataset.enrollment ? 'occupied-seat' : 'empty-seat';
                        const draggedIsOccupied = window.draggedSeat.dataset.enrollment ? 'occupied-seat' : 'empty-seat';

                        // Apply new classes combining base + structural + swapped content classes + occupancy
                        this.className = ['chart-seat', thisIsOccupied, ...thisStructural, ...draggedContentClasses].join(' ');
                        window.draggedSeat.className = ['chart-seat', draggedIsOccupied, ...draggedStructural, ...thisContentClasses].join(' ');

                        // Add flash highlight
                        this.classList.add('highlight-drop');
                        window.draggedSeat.classList.add('highlight-drop');
                        setTimeout(() => {
                            this.classList.remove('highlight-drop');
                            if (window.draggedSeat) window.draggedSeat.classList.remove('highlight-drop');
                        }, 500);

                        // If dragged from buffer, check if buffer is now empty to show placeholder
                        const bufferDropzone = document.getElementById('buffer-dropzone');
                        if (isFromBuffer && bufferDropzone) {
                            // The draggedSeat visually became whatever was in 'this' seat.
                            // If 'this' seat was an empty seat, then we effectively removed a student from the buffer.
                            // However, since we swapped, the buffer seat now contains the "empty seat".
                            // This is confusing UI. Let's just destroy the buffer seat if it swapped with an empty seat.

                            if (window.draggedSeat.classList.contains('empty-seat')) {
                                window.draggedSeat.remove();

                                if (bufferDropzone.querySelectorAll('.chart-seat').length === 0) {
                                    const bufferPlaceholder = document.getElementById('buffer-placeholder');
                                    if (bufferPlaceholder) bufferPlaceholder.style.display = 'block';
                                }
                            }
                        }

                        // NOTE: We do NOT sync automatically on drop now!
                        // We ONLY sync when "Confirm Seating" is clicked!
                    }
                }
            });
        });
    }

    // --- Sync DOM and Render Attendance Functions ---
    window.renderAttendanceTabs = function (data, instituteName, instituteLogoBase64, departmentName, instituteSubheader) {
        // Read current subheader from DOM if not passed (e.g. from syncSeatingDOMToGlobalData)
        if (!instituteSubheader) {
            instituteSubheader = document.getElementById('institute-subheader')?.value.trim() || '';
        }

        // Read Printable Footer settings
        const enableFooter = document.getElementById('enable-footer-toggle')?.checked;
        const footerScope = document.querySelector('input[name="footer-scope"]:checked')?.value || 'all';
        const enableTargetTimetable = document.getElementById('footer-target-timetable')?.checked;
        const enableTargetSeating = document.getElementById('footer-target-seating')?.checked;
        const enableTargetAttendance = document.getElementById('footer-target-attendance')?.checked;

        const leftSig = document.getElementById('footer-left-text')?.value || 'MST Coordinator';
        const centerSig = document.getElementById('footer-center-text')?.value || 'Branch Coordinator';
        const rightSig = document.getElementById('footer-right-text')?.value || 'HoD CSE';

        const renderFooterHtml = (isLast, targetType) => {
            if (!enableFooter) return '';

            if (targetType === 'timetable' && !enableTargetTimetable) return '';
            if (targetType === 'seating' && !enableTargetSeating) return '';
            if (targetType === 'attendance' && !enableTargetAttendance) return '';

            if (footerScope === 'last' && !isLast) return '';

            return `
                <div class="print-footer" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; padding: 15px 50px 0 50px;">
                    <div style="text-align: left; font-weight: 600; width: 33%; font-size: 1.1rem; color: var(--text-main);">${leftSig}</div>
                    <div style="text-align: center; font-weight: 600; width: 33%; font-size: 1.1rem; color: var(--text-main);">${centerSig}</div>
                    <div style="text-align: right; font-weight: 600; width: 33%; font-size: 1.1rem; color: var(--text-main);">${rightSig}</div>
                </div>
            `;
        };

        const buildPrintHeader = (subtitle) => {
            const midSemType = document.getElementById('mid-sem')?.value || '1';
            const examPrefix = midSemType === 'R' ? 'REMEDIAL ' : `MST-${midSemType} `;

            return `
            <div class="print-header" style="display: flex; align-items: center; justify-content: center; gap: 2rem; margin-bottom: 2rem; border-bottom: 3px double var(--border-color); padding-bottom: 1rem;">
                ${instituteLogoBase64 ? `<img src="${instituteLogoBase64}" class="print-logo" alt="Logo">` : ''}
                <div style="text-align: center;">
                    <h1 style="font-size: 2rem; margin: 0; color: var(--text-main); text-transform: uppercase; font-family: 'Times New Roman', Times, serif;">${instituteName}</h1>
                    <p style="margin: 0.15rem 0 0 0; font-size: 1rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em;">Department of ${departmentName}</p>
                    ${instituteSubheader ? `<p style="margin: 0.1rem 0 0 0; font-size: 0.9rem; color: var(--text-muted); white-space: pre-line; line-height: 1.5;">${instituteSubheader}</p>` : ''}
                    <p style="margin: 0.2rem 0 0 0; font-size: 1.2rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">${examPrefix}${subtitle}</p>
                </div>
            </div>
            `;
        };

        // Build a quick lookup: "date|||shift" -> { yr -> subjectCode }
        const subjectLookup = {};
        (data.master_timetable || []).forEach(entry => {
            const key = `${entry.date}|||${entry.shift}`;
            subjectLookup[key] = entry; // entry has IV Yr, III Yr, II Yr, I Yr fields
        });

        // Build Master Attendance Tab
        let masterAttendanceHtml = `<h1 style="font-size: 2.5rem; color: var(--primary-color); text-align: center; margin-bottom: 2rem;">Master Attendance</h1>`;
        ['I Yr', 'II Yr', 'III Yr', 'IV Yr'].forEach(yr => {
            const students = data.attendance_data[yr] || [];
            const yearExamDates = data.exam_dates_map[yr] || [];

            if (students.length > 0 && yearExamDates.length > 0) {
                const PAGE_SIZE = 28;
                const numPages = Math.ceil(students.length / PAGE_SIZE) || 1;
                for (let page = 0; page < numPages; page++) {
                    const isLastPage = (page === numPages - 1);
                    const pageStudents = students.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
                    const startIndex = page * PAGE_SIZE;

                    masterAttendanceHtml += `
            <div class="glass-card print-container portrait-table" style="margin-bottom: 3rem; display: flex; flex-direction: column;">
                    ${buildPrintHeader(`GLOBAL ATTENDANCE • YEAR: ${yr}${numPages > 1 ? ` (Page ${page + 1}/${numPages})` : ''}`)}
                    <table class="attendance-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05);">S.No</th>
                                <th style="border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05);">Enrollment No</th>
                                <th style="border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05);">Student Name</th>
                `;

                if (yearExamDates.length > 0) {
                    yearExamDates.forEach(dateLabel => {
                        // dateLabel format: "01/03/2026 • 10:00 AM - 01:00 PM"
                        // Look up subject: need matching master_timetable entry
                        const matchEntry = (data.master_timetable || []).find(e => {
                            const lbl = `${e.date} • ${e.shift}`;
                            return lbl === dateLabel || dateLabel.includes(e.date);
                        });
                        const subjectCode = matchEntry ? (matchEntry[yr] || '') : '';
                        masterAttendanceHtml += `<th style="border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05); min-width:90px;">Sign <br><span style="font-size: 0.8rem; font-weight: normal">${dateLabel}</span>${subjectCode && subjectCode !== '-' ? `<br><span style="font-size: 0.75rem; font-style: italic; color: var(--accent-color); font-weight: 600;">${subjectCode}</span>` : ''}</th>`;
                    });
                } else {
                    masterAttendanceHtml += `<th>Signature</th>`;
                }

                masterAttendanceHtml += `
                            </tr>
                        </thead>
                        <tbody>
                            ${pageStudents.map((stu, i) => {
                        const idx = startIndex + i;
                        const enrollmentStr = typeof stu === 'object' ? (stu.enrollment || '') : stu;
                        const nameStr = typeof stu === 'object' ? (stu.name || '') : '';

                        return `
                                <tr>
                                    <td style="border: 1px solid var(--border-color); padding: 12px;">${idx + 1}</td>
                                    <td style="font-size: 10pt; font-weight: bold; border: 1px solid var(--border-color); padding: 12px;">
                                        ${enrollmentStr}
                                    </td>
                                    <td style="font-size: 10pt; border: 1px solid var(--border-color); padding: 12px;">
                                        ${nameStr}
                                    </td>
                                    ${yearExamDates.length > 0 ?
                                    yearExamDates.map(() => `<td></td>`).join('') :
                                    `<td></td>`
                                    }
                                </tr>
                                `;
                    }).join('')}
                        </tbody>
                    </table>
                    <div style="flex-grow: 1;"></div>
                    ${renderFooterHtml(isLastPage, 'attendance')}
                </div >
            `;
                }
            }
        });
        document.getElementById('tab-attendance-master').innerHTML = masterAttendanceHtml;

        // Build Room-Wise Attendance Tab
        let roomAttendanceHtml = `<h1 style="font-size: 2.5rem; color: var(--primary-color); text-align: center; margin-bottom: 2rem;">Room - Wise Attendance</h1>`;
        const consolidatedAttendance = {};

        if (data.room_attendance_data && data.room_attendance_data.length > 0) {
            data.room_attendance_data.forEach(roomSheet => {
                const studentsByYear = {};
                roomSheet.students.forEach(stu => {
                    if (!studentsByYear[stu.year]) studentsByYear[stu.year] = [];
                    studentsByYear[stu.year].push(stu);
                });

                Object.keys(studentsByYear).forEach(yr => {
                    const studentList = studentsByYear[yr];
                    if (studentList.length === 0) return;

                    const enrollments = studentList.map(s => typeof s === 'object' ? (s.enrollment || '') : s).join(',');
                    const hashKey = `${roomSheet.room_name}___${yr}___${enrollments}`;

                    if (!consolidatedAttendance[hashKey]) {
                        consolidatedAttendance[hashKey] = {
                            room_name: roomSheet.room_name,
                            year: yr,
                            students: studentList,
                            sessions: []
                        };
                    }
                    consolidatedAttendance[hashKey].sessions.push({ date: roomSheet.date, shift: roomSheet.shift });
                });
            });

            const roomsList = [...new Set(data.room_attendance_data.map(r => r.room_name))];

            roomAttendanceHtml += `<div class="pill-nav" style="display:flex; justify-content:center; gap:10px; margin-bottom:2rem; flex-wrap:wrap;">`;
            roomsList.forEach((room, i) => {
                const safeRoom = room.replace(/\s/g, '_');
                roomAttendanceHtml += `<button class="btn outline-btn tab-btn attendance-room-btn ${i === 0 ? 'active' : ''}" onclick="switchRoomTab(this, '${safeRoom}')">${room}</button>`;
            });
            roomAttendanceHtml += `</div>`;

            const yearOrder = ['I Yr', 'II Yr', 'III Yr', 'IV Yr'];

            roomsList.forEach((room, i) => {
                const safeRoom = room.replace(/\s/g, '_');
                roomAttendanceHtml += `<div id="attendance-room-${safeRoom}" class="attendance-room-panel sub-panel ${i === 0 ? '' : 'hidden'}">`;

                const sheetsForRoom = Object.values(consolidatedAttendance).filter(c => c.room_name === room);
                sheetsForRoom.sort((a, b) => yearOrder.indexOf(a.year) - yearOrder.indexOf(b.year));

                sheetsForRoom.forEach((sheet, idx) => {
                    const PAGE_SIZE = 28;
                    const numPages = Math.ceil(sheet.students.length / PAGE_SIZE) || 1;

                    for (let page = 0; page < numPages; page++) {
                        const isLastPage = (page === numPages - 1);
                        const pageStudents = sheet.students.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
                        const startIndex = page * PAGE_SIZE;

                        let subtitle = `ROOM ATTENDANCE • ${sheet.room_name} • ${sheet.year}${numPages > 1 ? ` (Page ${page + 1}/${numPages})` : ''}`;

                        roomAttendanceHtml += `
            <div class="glass-card print-container portrait-table" style="margin-bottom: 3rem; overflow-x: auto; position: relative; display: flex; flex-direction: column;">
                                        ${buildPrintHeader(subtitle)}
                                        <table class="attendance-table" style="width: 100%; border-collapse: collapse;">
                                            <thead>
                                                <tr>
                                                    <th style="width: 80px; border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05);">S.No</th>
                                                    <th style="border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05);">Enrollment No</th>
                                                    <th style="border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05);">Student Name</th>
                                                    ${sheet.sessions.map(s => {
                            const sKey = `${s.date}|||${s.shift}`;
                            const sEntry = subjectLookup[sKey] || {};
                            const sCode = sEntry[sheet.year] || '';
                            return `<th style="border: 1px solid var(--border-color); padding: 12px; background: rgba(0,0,0,0.05); min-width:90px;">Sign<br><span style="font-size: 0.8rem; font-weight: normal;">${s.date}<br>${s.shift}</span>${sCode && sCode !== '-' ? `<br><span style="font-size: 0.75rem; font-style: italic; color: var(--accent-color); font-weight: 600;">${sCode}</span>` : ''}</th>`;
                        }).join('')}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${pageStudents.map((stu, i) => {
                            const idx = startIndex + i;
                            const enrollmentStr = typeof stu === 'object' ? (stu.enrollment || '') : stu;
                            const nameStr = typeof stu === 'object' ? (stu.name || '') : '';

                            return `
                                                    <tr>
                                                        <td style="border: 1px solid var(--border-color); padding: 12px;">${idx + 1}</td>
                                                        <td style="border: 1px solid var(--border-color); padding: 12px; font-size: 10pt; font-weight: bold;">
                                                            ${enrollmentStr}
                                                        </td>
                                                        <td style="border: 1px solid var(--border-color); padding: 12px; font-size: 10pt;">
                                                            ${nameStr}
                                                        </td>
                                                        ${sheet.sessions.map(() => `<td style="border: 1px solid var(--border-color); padding: 12px;"></td>`).join('')}
                                                    </tr>
                                                    `;
                        }).join('')}
                                                ${isLastPage ? `
                                                <tr>
                                                    <td colspan="3" style="text-align: right; font-weight: bold; font-size: 1.1em; border: 1px solid var(--border-color); padding: 12px;">Total:</td>
                                                    ${sheet.sessions.map(() => `<td style="text-align: center; font-weight: bold; font-size: 1.1em; border: 1px solid var(--border-color); padding: 12px;">${sheet.students.length}</td>`).join('')}
                                                </tr>
                                                <tr>
                                                    <td colspan="3" style="text-align: right; font-weight: bold; font-size: 1.1em; border: 1px solid var(--border-color); padding: 12px;">Present:</td>
                                                    ${sheet.sessions.map(() => `<td style="border: 1px solid var(--border-color); padding: 12px;"></td>`).join('')}
                                                </tr>
                                                <tr>
                                                    <td colspan="3" style="text-align: right; font-weight: bold; font-size: 1.1em; border: 1px solid var(--border-color); padding: 12px;">Absent:</td>
                                                    ${sheet.sessions.map(() => `<td style="border: 1px solid var(--border-color); padding: 12px;"></td>`).join('')}
                                                </tr>
                                                ` : ''}
                                            </tbody>
                                        </table>
                                        <div style="flex-grow: 1;"></div>
                                        ${renderFooterHtml(idx === sheetsForRoom.length - 1 && isLastPage, 'attendance')}
                                    </div>
                    `;
                    }
                });

                roomAttendanceHtml += `</div>`;
            });
        } else {
            roomAttendanceHtml += `<p style="text-align:center; color: var(--text-muted);">Generating...</p>`;
        }
        document.getElementById('tab-attendance-room').innerHTML = roomAttendanceHtml;
    };

    window.syncSeatingDOMToGlobalData = function () {
        if (!window.globalSeatingData) return;

        const newSeatingPlans = [];
        const newRoomAttendance = [];

        document.querySelectorAll('#tab-seating .seating-table').forEach(table => {
            const tableId = table.getAttribute('data-table-id');
            const meta = window.tableDataMap[tableId] || {};
            const roomName = meta.room_name;
            const sessions = meta.sessions || [];
            const rows = parseInt(meta.rows || 0);
            const cols = parseInt(meta.cols || 0);
            const door = meta.door || 'right';
            const headers = meta.headers || [];

            // Read column headers from DOM — user may have edited them in edit mode
            const domHeaders = [];
            table.querySelectorAll('thead th').forEach(th => {
                const input = th.querySelector('.col-header-input');
                domHeaders.push(input ? input.value.trim() : th.textContent.trim());
            });
            const effectiveHeaders = domHeaders.length > 0 ? domHeaders : headers;

            // Pre-fetch tbody rows needed by both colEmpty computation and matrix building
            const tbodyRows = table.querySelectorAll('tbody tr');

            // Compute which columns are fully-empty so we can blank their headers
            const numCols = effectiveHeaders.length;
            const colEmpty = Array(numCols).fill(true);
            tbodyRows.forEach(tr => {
                tr.querySelectorAll('td').forEach((td, ci) => {
                    if (!td.classList.contains('empty-seat')) colEmpty[ci] = false;
                });
            });

            // Blank headers for fully-empty columns & update DOM
            const updatedHeaders = effectiveHeaders.map((h, ci) => colEmpty[ci] ? '' : h);
            table.querySelectorAll('thead th').forEach((th, ci) => {
                const input = th.querySelector('.col-header-input');
                if (colEmpty[ci]) {
                    if (input) input.value = '';
                    else th.textContent = '';
                }
            });

            const matrix = [updatedHeaders];
            let totalInRoom = 0;
            const counts = {};


            tbodyRows.forEach(tr => {
                const rowData = [];
                tr.querySelectorAll('td').forEach(td => {
                    if (td.classList.contains('empty-seat')) {
                        rowData.push({ student: "" });
                    } else {
                        const enrollment = td.dataset.enrollment;
                        const name = td.dataset.name;
                        const year = td.dataset.year;
                        rowData.push({ student: { enrollment, name }, year: year });

                        totalInRoom++;
                        counts[year] = (counts[year] || 0) + 1;
                    }
                });
                matrix.push(rowData);
            });

            // Update DOM stats for this seating room visual
            const statsContainer = table.closest('.glass-card').querySelector('.stats-container');
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div style="display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap;">
                        ${Object.entries(counts).map(([yr, count]) => `
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="year-badge ${yr.replace(' ', '-')}"></div>
                                <span style="color: var(--text-muted);">${yr}: <strong style="color: var(--text-main);">${count}</strong></span>
                            </div>
                        `).join('')}
                    </div>
                    <div style="text-align: center; margin-top: 1rem; color: var(--text-main); font-weight: 600;">
                        Total Students in Room: <span style="color: var(--primary-color);">${totalInRoom} / ${rows * cols} Capacity</span>
                    </div>
                `;
            }

            sessions.forEach(session => {
                newSeatingPlans.push({
                    room_name: roomName,
                    date: session.date,
                    shift: session.shift,
                    rows, cols, door,
                    headers: effectiveHeaders, matrix, counts, total_in_room: totalInRoom
                });

                const roomStudents = [];
                matrix.slice(1).forEach(row => {
                    row.forEach(cell => {
                        if (cell.student) {
                            roomStudents.push(cell);
                        }
                    });
                });

                roomStudents.sort((a, b) => {
                    const yearOrder = { "IV Yr": 1, "III Yr": 2, "II Yr": 3, "I Yr": 4 };
                    if (yearOrder[a.year] !== yearOrder[b.year]) return (yearOrder[a.year] || 99) - (yearOrder[b.year] || 99);
                    return String(a.student.enrollment).localeCompare(String(b.student.enrollment), undefined, { numeric: true });
                });

                newRoomAttendance.push({
                    room_name: roomName,
                    date: session.date,
                    shift: session.shift,
                    students: roomStudents.map(s => ({ enrollment: s.student.enrollment, name: s.student.name, year: s.year }))
                });
            });
        });

        window.globalSeatingData.seating_plans = newSeatingPlans;
        window.globalSeatingData.room_attendance_data = newRoomAttendance;

        // Merge into global master attendance to catch manually inserted students
        const uniqueStudentsByYear = { "I Yr": new Map(), "II Yr": new Map(), "III Yr": new Map(), "IV Yr": new Map() };

        Object.entries(window.globalSeatingData.attendance_data).forEach(([year, students]) => {
            if (!uniqueStudentsByYear[year]) return;
            students.forEach(s => {
                const enroll = typeof s === 'object' ? s.enrollment : s;
                const name = typeof s === 'object' ? s.name : '';
                uniqueStudentsByYear[year].set(enroll, { enrollment: enroll, name: name });
            });
        });

        newRoomAttendance.forEach(sheet => {
            sheet.students.forEach(stu => {
                if (uniqueStudentsByYear[stu.year]) {
                    // Preserve existing name from attendance_data if the DOM-scraped name is empty
                    // (DOM seats only store enrollment in data-name when student was not manually added)
                    const existing = uniqueStudentsByYear[stu.year].get(stu.enrollment);
                    const resolvedName = stu.name || (existing ? existing.name : '');
                    uniqueStudentsByYear[stu.year].set(stu.enrollment, { ...stu, name: resolvedName });
                }
            });
        });

        Object.keys(uniqueStudentsByYear).forEach(year => {
            const arr = Array.from(uniqueStudentsByYear[year].values());
            arr.sort((a, b) => String(a.enrollment).localeCompare(String(b.enrollment), undefined, { numeric: true }));
            window.globalSeatingData.attendance_data[year] = arr;
        });

        // Re-render attendance tabs with sync'd data
        const instituteName = document.getElementById('institute-name').value.trim();
        const departmentName = document.getElementById('department-name').value.trim();

        // Make sure the freshly built room attendance is in globalSeatingData before rendering
        window.globalSeatingData.room_attendance_data = newRoomAttendance;

        window.renderAttendanceTabs(window.globalSeatingData, instituteName, window.lastLogoBase64 || '', departmentName);

        // Re-activate the first room pill in attendance tab so user sees updated data
        const firstAttRoomBtn = document.querySelector('#tab-attendance-room .attendance-room-btn');
        if (firstAttRoomBtn && !firstAttRoomBtn.classList.contains('active')) {
            firstAttRoomBtn.click();
        }

        // Brief success toast to confirm update
        let toast = document.getElementById('_sync-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = '_sync-toast';
            toast.style.cssText = [
                'position:fixed', 'bottom:5rem', 'left:50%', 'transform:translateX(-50%) translateY(20px)',
                'background:linear-gradient(135deg,var(--success-color,#10b981),#059669)',
                'color:#fff', 'padding:0.55rem 1.2rem', 'border-radius:999px',
                'font-size:0.85rem', 'font-weight:600', 'z-index:99999',
                'opacity:0', 'transition:opacity 0.3s ease, transform 0.3s ease',
                'pointer-events:none', 'box-shadow:0 4px 16px rgba(16,185,129,0.4)'
            ].join(';');
            document.body.appendChild(toast);
        }
        toast.innerHTML = '<i class="fa-solid fa-circle-check" style="margin-right:6px;"></i>Seating & Attendance updated';
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, 2800);
    };

});
