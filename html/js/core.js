/* ==========================================================================
   APRTS OS CORE (v3.0)
   ========================================================================== */
const Core = {
    apps: {},           // Registry registrovaných aplikací
    runningApps: {},    // Běžící instance (okna)
    isSystemRunning: false, // Flag: Běží PC na pozadí?
    
    config: {
        maxRam: 4,
        usedRam: 0
    },

    // 1. Inicializace (Event Listeners)
    init: () => {
        window.addEventListener('message', Core.onMessage);

        // Globální kliknutí: Zavírá Start menu a Context menu
        $(document).click((e) => {
            if (!$(e.target).closest('#start-menu, .start-btn').length) {
                $('#start-menu').hide();
            }
            $('.context-menu').remove();
        });

        // Klávesové zkratky
        document.onkeyup = (e) => {
            // ESC = Odejít od PC (ne vypnout)
            if (e.which === 27) Core.leave();
        };

        // Skrýt vše na začátku pro čistý start
        $('#login-screen').hide();
        $('#os-root').hide();
        $('#modal-overlay').hide();
    },

    // 2. API pro Moduly (Registrace aplikací)
    registerApp: (appId, config) => {
        Core.apps[appId] = config;
    },

    // 3. Spuštění aplikace
    openApp: (appId, data = null) => {
        const appConfig = Core.apps[appId];
        
        if (!appConfig) {
            console.error(`Aplikace ${appId} nebyla nalezena.`);
            return;
        }

        // Kontrola RAM
        if (Core.config.usedRam >= Core.config.maxRam) {
            return Core.Modal.alert('Chyba paměti', 'Nedostatek paměti RAM! Zavřete některá okna.');
        }

        $('#start-menu').hide();
        WindowManager.create(appId, appConfig, data);
    },

    // 4. API pro Context Menu
    registerContextItem: (type, item) => {
        ContextMenu.register(type, item);
    },

    // 5. Systémové Akce
    login: () => {
        $.post('https://aprts_computer/loginAttempt', JSON.stringify({
            user: $('#login-user').text(),
            pass: $('#login-pass').val()
        }));
    },

    // ODEJÍT: Skryje UI, ale zachová stav (okna zůstanou otevřená)
    leave: () => {
        $.post('https://aprts_computer/hide', JSON.stringify({}));
        
        $('#os-root').hide();
        $('#login-screen').hide();
        $('#modal-overlay').hide();
        $('.context-menu').remove();
        
        // NEČISTÍME runningApps ani isSystemRunning!
    },

    // VYPNOUT: Kompletní reset a vyčištění RAM
    shutdown: () => {
        $.post('https://aprts_computer/close', JSON.stringify({}));
        
        $('#os-root').fadeOut(200);
        $('#login-screen').fadeOut(200);
        $('#modal-overlay').hide();

        // Reset stavu OS
        setTimeout(() => {
            $('#windows-area').empty();
            $('#taskbar-apps').empty();
            $('.context-menu').remove();
            
            Core.config.usedRam = 0;
            Core.runningApps = {};
            Core.isSystemRunning = false; // PC je nyní vypnuté
            
            // Vymazat heslo pro příště
            $('#login-pass').val('');
        }, 200);
    },

    toggleStartMenu: () => $('#start-menu').toggle(),

    // 6. Handling zpráv z Lua
    onMessage: (e) => {
        const data = e.data;

        if (data.action === 'showLogin') {
            // Pokud PC už běželo, resetujeme ho (nové přihlášení)
            if(Core.isSystemRunning) Core.shutdown();

            $('#os-root').hide();
            $('#login-screen').css('display', 'flex').hide().fadeIn(300);
            $('#login-user').text(data.users && data.users[0] ? data.users[0].username : 'Admin');
        }
        else if (data.action === 'loadDesktop') {
            // POKUD PC BĚŽÍ: Jen zobrazíme plochu (Restore)
            if (Core.isSystemRunning) {
                $('#login-screen').hide();
                $('#os-root').fadeIn(200);
                
                // Refresh dat na pozadí
                if(Core.apps['files']) Core.apps['files'].systemFiles = data.files;
                return;
            }

            // POKUD NEBĚŽÍ: Boot sequence
            Core.isSystemRunning = true;
            $('#login-screen').fadeOut(200, () => {
                $('#os-root').fadeIn(300);
            });
            
            Desktop.render();
            Core.config.maxRam = data.hwInfo.ramMax;

            // Distribuce dat do modulů
            if(Core.apps['files']) Core.apps['files'].systemFiles = data.files;
            if(Core.apps['settings']) Core.apps['settings'].hwInfo = data.hwInfo;
        }
        else if (data.action === 'refreshFiles') {
            if(Core.apps['files']) {
                Core.apps['files'].systemFiles = data.files;
                // Refresh běžících instancí Files
                Object.values(Core.runningApps).forEach(inst => {
                    if(inst.appId === 'files' && inst.refresh) inst.refresh();
                });
            }
        }
        else if (data.action === 'openExternalWindow') {
            // Externí volání z Lua (exports)
            Core.openApp(data.appId, data); 
            // Poznámka: Externí appka musí být předem zaregistrována přes RegisterApp v Lua -> JS init
        }
    }
};

/* ============================
   CUSTOM MODAL API (Promises)
   ============================ */
Core.Modal = {
    _show: (config) => {
        return new Promise((resolve) => {
            const overlay = $('#modal-overlay');
            overlay.empty().show().css('display', 'flex');

            let buttonsHtml = '';
            config.buttons.forEach((btn, index) => {
                const isPrimary = btn.type === 'primary' ? 'primary' : '';
                buttonsHtml += `<button class="modal-btn ${isPrimary}" id="modal-btn-${index}">${btn.label}</button>`;
            });

            const html = `
                <div class="os-modal">
                    <div class="modal-header"><span>${config.title}</span></div>
                    <div class="modal-body">
                        <div style="margin-bottom:10px;">${config.message}</div>
                        ${config.input ? `<input type="${config.inputType||'text'}" id="modal-input" value="${config.inputValue||''}">` : ''}
                    </div>
                    <div class="modal-footer">${buttonsHtml}</div>
                </div>`;
            
            overlay.html(html);
            if(config.input) $('#modal-input').focus().select();

            config.buttons.forEach((btn, index) => {
                $(`#modal-btn-${index}`).click(() => {
                    const val = config.input ? $('#modal-input').val() : null;
                    overlay.hide().empty();
                    resolve({ button: btn.key, value: val });
                });
            });

            if(config.input) {
                $('#modal-input').on('keydown', (e) => {
                    if(e.key === 'Enter') {
                        const val = $('#modal-input').val();
                        overlay.hide().empty();
                        resolve({ button: 'ok', value: val });
                    }
                });
            }
        });
    },

    alert: async (title, message) => {
        await Core.Modal._show({ title, message, buttons: [{ label: 'OK', key: 'ok', type: 'primary' }] });
        return true;
    },
    confirm: async (title, message) => {
        const res = await Core.Modal._show({
            title, message,
            buttons: [{ label: 'Ano', key: 'yes', type: 'primary' }, { label: 'Ne', key: 'no' }]
        });
        return res.button === 'yes';
    },
    prompt: async (title, message, def = '') => {
        const res = await Core.Modal._show({
            title, message, input: true, inputValue: def,
            buttons: [{ label: 'OK', key: 'ok', type: 'primary' }, { label: 'Zrušit', key: 'cancel' }]
        });
        return res.button === 'ok' ? res.value : null;
    }
};

/* ============================
   CONTEXT MENU MANAGER
   ============================ */
const ContextMenu = {
    registry: {
        'desktop': [
            { label: 'Obnovit', icon: 'fa-sync', action: () => Desktop.render() },
            { label: 'Nastavení', icon: 'fa-cog', action: () => Core.openApp('settings') }
        ],
        'file': [],
        'folder': []
    },
    register: (type, item) => {
        if(!ContextMenu.registry[type]) ContextMenu.registry[type] = [];
        ContextMenu.registry[type].push(item);
    },
    show: (e, type, data) => {
        e.preventDefault();
        $('.context-menu').remove();
        const items = ContextMenu.registry[type] || [];
        if(items.length === 0) return;

        let html = `<div class="context-menu" style="top:${e.clientY}px; left:${e.clientX}px">`;
        items.forEach(item => {
            if(item.separator) html += `<div class="ctx-separator"></div>`;
            else {
                const clickId = `ctx-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
                html += `<div class="ctx-item" id="${clickId}"><i class="fas ${item.icon||''}"></i> ${item.label}</div>`;
                $(document).one('click', `#${clickId}`, (ev) => {
                    ev.stopPropagation();
                    $('.context-menu').remove();
                    if(item.action) item.action(data);
                });
            }
        });
        html += `</div>`;
        $('body').append(html);
        
        // Pozicování (aby neuteklo z obrazovky)
        const menu = $('.context-menu');
        if(e.clientY + menu.height() > $(window).height()) menu.css('top', e.clientY - menu.height());
        if(e.clientX + menu.width() > $(window).width()) menu.css('left', e.clientX - menu.width());
    }
};

/* ============================
   WINDOW MANAGER
   ============================ */
/* Upravený WindowManager v html/js/core.js */

const WindowManager = {
    zIndex: 100,
    
    create: (appId, config, data) => {
        WindowManager.zIndex++;
        const pid = `proc-${Date.now()}`;
        
        const instance = { pid, appId, root: null, content: null, data };

        // ... (část s generováním Menu Bar nechte stejnou) ...
        let menuHtml = ''; 
        if (config.menu && config.menu.length > 0) {
            // ... zachovat původní kód generování menu ...
            menuHtml = `<div class="menubar">`; // zkráceno pro přehlednost
            config.menu.forEach((mItem, idx) => {
                 // ... zachovat původní loop ...
                 menuHtml += `<div class="menu-item">${mItem.label} ... </div>`; 
            });
            menuHtml += `</div>`;
        }
        // ... konec menu bar ...

        const isFull = config.type === 'fullscreen';
        const style = isFull ? '' : `width:${config.width}px; height:${config.height}px; top:60px; left:60px;`;
        
        const html = `
            <div class="window ${isFull?'fullscreen':''}" id="${pid}" style="z-index:${WindowManager.zIndex}; ${style}" onmousedown="WindowManager.focus('${pid}')">
                <div class="window-header">
                    <div class="window-title"><i class="${config.icon}"></i> ${config.title}</div>
                    <div class="window-controls">
                        <!-- Přidána ID pro snadný výběr -->
                        <div class="win-btn btn-min" id="min-${pid}"></div>
                        <div class="win-btn btn-max" id="max-${pid}"></div>
                        <div class="win-btn btn-close" id="close-${pid}"></div>
                    </div>
                </div>
                ${menuHtml}
                <div class="window-content" id="${pid}-content"></div>
            </div>`;

        $('#windows-area').append(html);
        // Upraven onclick v taskbaru na toggle (minimalizace/obnovení)
        $('#taskbar-apps').append(`<div class="tb-app active" id="tb-${pid}" onclick="WindowManager.toggle('${pid}')"><i class="${config.icon}"></i></div>`);

        instance.root = $(`#${pid}`);
        instance.content = $(`#${pid}-content`);

        // --- OPRAVA TLAČÍTEK ---
        
        // 1. Zavření
        $(`#close-${pid}`).click(() => WindowManager.close(pid));

        // 2. Minimalizace
        $(`#min-${pid}`).click(() => {
            instance.root.hide();
            $(`#tb-${pid}`).removeClass('active');
        });

        // 3. Maximalizace
        $(`#max-${pid}`).click(() => {
            instance.root.toggleClass('fullscreen');
            // Pokud aplikace vyžaduje překreslení (např. editor), lze zde zavolat resize callback
        });

        // --- KONEC OPRAVY ---

        // Menu Bindings (zachovat původní)
        if (config.menu) {
            config.menu.forEach((mItem, idx) => {
                mItem.items.forEach((sub, sIdx) => {
                    $(`#m-${pid}-${idx}-${sIdx}`).click(() => { if(sub.handler) sub.handler(instance); });
                });
            });
        }

        // Load Content
        if (config.templateId) {
            const tpl = document.getElementById(config.templateId);
            if(tpl) instance.content.html(tpl.innerHTML);
        }

        Core.runningApps[pid] = instance;
        Core.config.usedRam++;

        if (config.onOpen) config.onOpen(instance, data);
        if (!isFull) WindowManager.enableDrag(pid);
    },

    close: (pid) => {
        const inst = Core.runningApps[pid];
        if(!inst) return; // Pojistka
        if (Core.apps[inst.appId].onClose) Core.apps[inst.appId].onClose(inst);
        
        delete Core.runningApps[pid];
        $(`#${pid}`).remove();
        $(`#tb-${pid}`).remove();
        Core.config.usedRam--;
        
        $.post('https://aprts_computer/windowClosed');
    },

    // Upravená funkce Focus - zajistí zobrazení okna, pokud bylo minimalizované
    focus: (pid) => {
        WindowManager.zIndex++;
        $(`#${pid}`).show().css('z-index', WindowManager.zIndex); // Přidáno .show()
        $('.tb-app').removeClass('active');
        $(`#tb-${pid}`).addClass('active');
    },

    // Nová funkce Toggle (pro klikání na taskbar)
    toggle: (pid) => {
        const win = $(`#${pid}`);
        if (win.is(':visible') && win.css('z-index') == WindowManager.zIndex) {
            // Pokud je viditelné A je navrchu -> minimalizovat
            win.hide();
            $(`#tb-${pid}`).removeClass('active');
        } else {
            // Jinak zobrazit a dát focus
            WindowManager.focus(pid);
        }
    },

    enableDrag: (id) => {

        const elm = document.getElementById(id);
        const header = elm.querySelector('.window-header');
        let pos1=0,pos2=0,pos3=0,pos4=0;
        header.onmousedown = (e) => {
            if($(e.target).hasClass('win-btn') || $(e.target).hasClass('menu-item')) return;
            e.preventDefault();
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmouseup = () => { document.onmouseup=null; document.onmousemove=null; };
            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
                pos3 = e.clientX; pos4 = e.clientY;
                elm.style.top=(elm.offsetTop-pos2)+"px"; elm.style.left=(elm.offsetLeft-pos1)+"px";
            };
        };
    }
};

const Desktop = {
    render: () => {
        const cont = $('#desktop-icons').empty();
        const start = $('#start-list').empty();
        
        $('#os-root').off('contextmenu').on('contextmenu', (e) => {
            if(e.target.id === 'os-root' || e.target.id === 'desktop-icons') ContextMenu.show(e, 'desktop');
        });

        Object.keys(Core.apps).forEach(appId => {
            const c = Core.apps[appId];
            cont.append(`<div class="desktop-icon" ondblclick="Core.openApp('${appId}')"><i class="${c.icon}" style="color:${c.iconColor||'#fff'}"></i><span>${c.title}</span></div>`);
            start.append(`<div class="start-item" onclick="Core.openApp('${appId}')"><i class="${c.icon}"></i> ${c.title}</div>`);
        });
    }
};

$(document).ready(() => Core.init());