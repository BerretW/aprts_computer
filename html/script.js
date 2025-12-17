/* ==========================================================================
   OS CORE
   ========================================================================== */
const OS = {
    pcId: null,
    users: [],
    installedApps: [],
    fileSystem: [],
    hwInfo: {},
    settings: {},

    // Inicializace Login obrazovky
    initLogin: (data) => {
        OS.pcId = data.pcId;
        OS.users = data.users;
        
        // Zobrazit prvního uživatele (zjednodušeno pro tento příklad)
        $('#login-username-display').text(data.users[0].username);
        $('#login-screen').fadeIn(200);
        $('#desktop-container').hide();
    },

    // Pokus o přihlášení
    login: () => {
        const pass = $('#login-password').val();
        const user = $('#login-username-display').text();
        
        // Odeslání na server k ověření
        $.post('https://aprts_computer/loginAttempt', JSON.stringify({
            user: user,
            pass: pass
        }));
    },

    // Načtení plochy po úspěšném loginu
    loadDesktop: (data) => {
        OS.installedApps = data.apps;
        OS.fileSystem = data.files;
        OS.settings = data.settings;
        OS.hwInfo = data.hwInfo;

        // Aplikovat vzhled
        OS.applyTheme(OS.settings.themeColor, OS.settings.wallpaper);

        // Vykreslit ikony
        Desktop.render();

        // Skrýt login, zobrazit plochu
        $('#login-screen').hide();
        $('#desktop-container').fadeIn(300);

        // Reset
        $('#windows-area').empty();
        $('#taskbar-apps').empty();
        $('#ram-usage').text('0 / ' + OS.hwInfo.ramMax);
        
        OS.updateClock();
    },

    // Odeslat změnu nastavení na server
    saveSettings: () => {
        const color = $('#setting-color').val();
        const wall = $('#setting-wallpaper').val();
        $.post('https://aprts_computer/saveSettings', JSON.stringify({
            themeColor: color,
            wallpaper: wall
        }));
        Swal.fire({ icon: 'success', title: 'Uloženo', timer: 1500, showConfirmButton: false, toast: true });
    },

    applyTheme: (color, wallpaper) => {
        if (color) document.documentElement.style.setProperty('--main-color', color);
        if (wallpaper) $('#desktop-container').css('background-image', `url(${wallpaper})`);
    },

    updateClock: () => {
        const now = new Date();
        const str = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        $('#clock').text(str);
        setTimeout(OS.updateClock, 10000);
    },

    shutdown: () => {
        $('#desktop-container').fadeOut(200);
        $('#login-screen').fadeOut(200);
        $.post('https://aprts_computer/close', JSON.stringify({}));
    },
    
    toggleStartMenu: () => {
        $('#start-menu').fadeToggle(100);
        OS.renderStartMenu();
    },

    renderStartMenu: () => {
        const list = $('#start-app-list');
        list.empty();
        
        // Interní
        const systemApps = [
            { id: 'files', label: 'Tento Počítač', icon: 'fas fa-hdd' },
            { id: 'settings', label: 'Nastavení', icon: 'fas fa-cog' },
            { id: 'installer', label: 'Instalátor', icon: 'fas fa-compact-disc' },
            { id: 'notepad', label: 'Poznámkový blok', icon: 'fas fa-edit' }
        ];

        [...systemApps, ...OS.installedApps.map(a => ({ id: a, label: a, icon: 'fas fa-cube' }))].forEach(app => {
            list.append(`
                <div class="start-item" onclick="OS.openApp('${app.id}'); $('#start-menu').hide();">
                    <i class="${app.icon}"></i> ${app.label}
                </div>
            `);
        });
    },

    // Hlavní funkce pro otevření aplikace
    openApp: (appId, filePayload = null) => {
        // Krok 1: Kontrola RAM u serveru/klienta Lua
        $.post('https://aprts_computer/checkRamLimit', {}, function(isAllowed) {
            if (isAllowed) {
                WindowManager.create(appId, filePayload);
            } else {
                Swal.fire({
                    title: 'Chyba paměti',
                    text: `Nedostatek RAM! Limit je ${OS.hwInfo.ramMax} oken.`,
                    icon: 'error',
                    background: '#222',
                    color: '#fff'
                });
            }
        });
    },
    
    scanUsb: () => {
        $('#usb-list-container').html('<i>Skenuji...</i>');
        $.post('https://aprts_computer/scanUsb', JSON.stringify({}));
    }
};

/* ==========================================================================
   WINDOW MANAGER (Správa oken)
   ========================================================================== */
const WindowManager = {
    zIndex: 10,

    create: (appId, fileData) => {
        WindowManager.zIndex++;
        const winId = `win-${Date.now()}`;
        
        let title = appId;
        let content = '';
        let width = '800px';
        let height = '500px';

        // Definice obsahu podle AppID
        switch (appId) {
            case 'files':
                title = 'Tento Počítač';
                content = $('#tpl-files').html();
                break;
            case 'notepad':
                title = 'Poznámkový blok';
                content = $('#tpl-notepad').html();
                break;
            case 'settings':
                title = 'Nastavení';
                content = $('#tpl-settings').html();
                width = '500px';
                height = '400px';
                break;
            case 'installer':
                title = 'Installer';
                content = $('#tpl-installer').html();
                width = '400px';
                height = '300px';
                break;
            case 'photo_viewer':
                title = fileData ? fileData.name : 'Fotografie';
                content = $('#tpl-photo').html();
                break;
            default:
                // Externí aplikace (předpokládáme že se nainjektují samy nebo zobrazí placeholder)
                title = appId;
                content = `<div style="padding:20px;">Aplikace ${appId} běží...</div>`;
                break;
        }

        const html = `
            <div class="window" id="${winId}" style="width:${width}; height:${height}; z-index:${WindowManager.zIndex}; top:50px; left:50px;" onmousedown="WindowManager.focus('${winId}')">
                <div class="window-header">
                    <div class="window-title"><i class="fas fa-cube"></i> ${title}</div>
                    <div class="window-controls">
                        <span class="close-btn" onclick="WindowManager.close('${winId}')">&times;</span>
                    </div>
                </div>
                <div class="window-content" id="${winId}-content">${content}</div>
            </div>
        `;

        $('#windows-area').append(html);
        $('#taskbar-apps').append(`<div class="taskbar-item active" id="tb-${winId}" onclick="WindowManager.focus('${winId}')"><i class="fas fa-cube"></i></div>`);

        // Inicializace specifické logiky aplikace
        WindowManager.initAppLogic(appId, winId, fileData);
        WindowManager.enableDrag(winId);
        WindowManager.updateRamDisplay(1); // Přičíst 1
    },

    close: (winId) => {
        $(`#${winId}`).remove();
        $(`#tb-${winId}`).remove();
        WindowManager.updateRamDisplay(-1); // Odečíst 1
        $.post('https://aprts_computer/windowClosed', JSON.stringify({}));
    },

    focus: (winId) => {
        WindowManager.zIndex++;
        $(`#${winId}`).css('z-index', WindowManager.zIndex);
        $('.taskbar-item').removeClass('active');
        $(`#tb-${winId}`).addClass('active');
    },

    updateRamDisplay: (change) => {
        // Jednoduchý vizuální counter, přesná logika je v Lua
        let current = parseInt($('#ram-usage').text().split('/')[0]);
        let max = OS.hwInfo.ramMax || 4;
        let newVal = current + change;
        if(newVal < 0) newVal = 0;
        $('#ram-usage').text(`${newVal} / ${max}`);
    },

    // Drag & Drop logika pro okna
    enableDrag: (elemId) => {
        const elmnt = document.getElementById(elemId);
        const header = elmnt.querySelector('.window-header');
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    },

    initAppLogic: (appId, winId, fileData) => {
        const root = $(`#${winId}-content`);

        if (appId === 'files') {
            Files.render(root);
        }
        else if (appId === 'notepad') {
            Notepad.init(root, fileData);
        }
        else if (appId === 'settings') {
            // Předvyplnit hodnoty
            root.find('#setting-color').val(OS.settings.themeColor);
            root.find('#setting-wallpaper').val(OS.settings.wallpaper);
            root.find('#system-specs').html(`
                CPU: ${OS.hwInfo.cpu || 'Standard'}<br>
                RAM: ${OS.hwInfo.ramMax} GB Limit<br>
                HDD: ${OS.hwInfo.hddMax} MB Max
            `);
        }
        else if (appId === 'photo_viewer' && fileData) {
            // Předpokládáme že content je URL obrázku
            root.find('#photo-viewer-img').attr('src', fileData.content);
        }
    }
};

/* ==========================================================================
   APLIKACE: FILES
   ========================================================================== */
const Files = {
    render: (root) => {
        const grid = root.find('#files-view');
        grid.empty();

        // Jednoduchý výpis (v budoucnu zde bude složková struktura)
        OS.fileSystem.forEach(file => {
            let icon = 'fa-file';
            let color = '#ccc';
            
            if (file.extension === 'txt') { icon = 'fa-file-alt'; color = '#3498db'; }
            if (file.extension === 'png' || file.extension === 'jpg') { icon = 'fa-image'; color = '#e74c3c'; }

            grid.append(`
                <div class="file-item" ondblclick="Files.openFile('${file.name}')">
                    <i class="fas ${icon}" style="color:${color}"></i>
                    <span>${file.name}</span>
                </div>
            `);
        });

        // Info o disku
        const used = JSON.stringify(OS.fileSystem).length / 1024 / 1024; // MB odhad
        const max = OS.hwInfo.hddMax || 250;
        root.find('#disk-info').text(`Využito: ${used.toFixed(2)} MB / ${max} MB`);
    },

    openFile: (fileName) => {
        const file = OS.fileSystem.find(f => f.name === fileName);
        if (!file) return;

        // Asociace souborů
        const associations = {
            'txt': 'notepad',
            'md': 'notepad',
            'png': 'photo_viewer',
            'jpg': 'photo_viewer',
            'exe': 'installer' // Příklad
        };

        const appToUse = associations[file.extension];
        if (appToUse) {
            OS.openApp(appToUse, file);
        } else {
            Swal.fire('Info', `Pro soubor .${file.extension} není přiřazena aplikace.`, 'info');
        }
    }
};

/* ==========================================================================
   APLIKACE: NOTEPAD (Quill Integration)
   ========================================================================== */
const Notepad = {
    instances: {}, // Ukládáme instance Quillu podle ID kontejneru

    init: (root, fileData) => {
        const container = root.find('#editor-container')[0];
        
        // Inicializace Quill editoru
        const quill = new Quill(container, {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }]
                ]
            }
        });

        // Pokud otevíráme soubor, načteme obsah
        if (fileData) {
            // Quill používá Delta formát nebo HTML. Pro jednoduchost použijeme HTML.
            // Pozor: fileData.content musí být bezpečný string.
            quill.root.innerHTML = fileData.content;
            root.find('#notepad-filename').val(fileData.name.split('.')[0]);
            root.find('#notepad-ext').val(fileData.extension);
        }

        // Uložíme referenci na editor do DOM elementu tlačítka Uložit, abychom ji našli
        root.find('button').data('quill', quill);
    },

    save: () => {
        // Získáme aktivní okno (kde bylo kliknuto)
        const btn = $(event.target).closest('button');
        const root = btn.closest('.app-layout');
        const quill = btn.data('quill');
        
        if (!quill) return;

        const content = quill.root.innerHTML;
        const name = root.find('#notepad-filename').val();
        const ext = root.find('#notepad-ext').val();
        const fullName = `${name}.${ext}`;

        $.post('https://aprts_computer/saveFile', JSON.stringify({
            path: fullName,
            content: content,
            extension: ext
        }));

        Swal.fire({ icon: 'success', title: 'Soubor uložen', toast: true, position: 'bottom-end', timer: 2000, showConfirmButton: false });
    }
};

/* ==========================================================================
   DESKTOP & GLOBAL EVENTS
   ========================================================================== */
const Desktop = {
    render: () => {
        const container = $('#desktop-icons');
        container.empty();

        const shortcuts = [
            { id: 'files', label: 'Tento Počítač', icon: 'fas fa-hdd', color: '#fff' },
            { id: 'notepad', label: 'Poznámky', icon: 'fas fa-edit', color: '#fff' },
            { id: 'installer', label: 'Instalátor', icon: 'fas fa-compact-disc', color: '#fff' },
            { id: 'settings', label: 'Nastavení', icon: 'fas fa-cog', color: '#fff' }
        ];

        shortcuts.forEach(app => {
            container.append(`
                <div class="desktop-icon" ondblclick="OS.openApp('${app.id}')">
                    <i class="${app.icon}" style="color:${app.color}"></i>
                    <span>${app.label}</span>
                </div>
            `);
        });

        // Přidat nainstalované appky
        OS.installedApps.forEach(appId => {
            if(!shortcuts.find(s => s.id === appId)) {
                container.append(`
                    <div class="desktop-icon" ondblclick="OS.openApp('${appId}')">
                        <i class="fas fa-cube" style="color:var(--main-color)"></i>
                        <span>${appId}</span>
                    </div>
                `);
            }
        });
    }
};

// Event Listeners
window.addEventListener('message', (event) => {
    const data = event.data;
    switch (data.action) {
        case 'showLogin':
            OS.initLogin(data);
            break;
        case 'loadDesktop':
            OS.loadDesktop(data);
            break;
        case 'refreshFiles':
            OS.fileSystem = data.files;
            // Pokud je otevřené okno Files, aktualizovat ho
            if ($('.window-title:contains("Tento Počítač")').length > 0) {
                // Znovu zavoláme render na aktivní okno (zjednodušené řešení)
                // Ideálně by WindowManager měl evidovat instance
                // Pro teď jen aktualizujeme data, uživatel musí refreshnout (zavřít/otevřít)
                // Nebo najít ID okna a zavolat Files.render($(`#${id}-content`));
            }
            break;
        case 'usbResult':
            const listDiv = $('#usb-list-container');
            listDiv.empty();
            if (data.list.length === 0) listDiv.html('<i>Žádné zařízení nenalezeno.</i>');
            else {
                data.list.forEach(usb => {
                    listDiv.append(`
                        <div class="usb-item">
                            <span>${usb.itemLabel} (${usb.appId})</span>
                            <button class="btn-primary" onclick="OS.installApp('${usb.appId}')">Instalovat</button>
                        </div>
                    `);
                });
            }
            break;
    }
});

OS.installApp = (appName) => {
    $.post('https://aprts_computer/installApp', JSON.stringify({ appName: appName }));
    Swal.fire('Instalace', 'Aplikace byla nainstalována.', 'success');
};

document.onkeyup = function (data) {
    if (data.which == 27) {
        OS.shutdown();
    }
};