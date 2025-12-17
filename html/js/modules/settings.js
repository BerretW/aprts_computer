Core.registerApp('settings', {
    title: 'Nastavení',
    icon: 'fas fa-cog',
    iconColor: '#95a5a6',
    type: 'window',
    width: 500,
    height: 400,
    templateId: 'tpl-settings',

    hwInfo: {}, // Core naplní

    onOpen: (app) => {
        // HW Info
        const info = Core.apps['settings'].hwInfo || {};
        app.content.find('#sys-info-content').html(`
            <b>CPU:</b> ${info.cpu || 'Neznámé'}<br>
            <b>RAM:</b> ${info.ramMax || 0} GB<br>
            <b>HDD:</b> ${info.hddMax || 0} MB
        `);

        // Save Button
        app.content.find('#btn-save-settings').click(() => {
            const color = app.content.find('#set-color').val();
            const wall = app.content.find('#set-wall').val();

            // Aplikovat ihned (preview)
            if(wall) $('#os-root').css('background-image', `url(${wall})`);
            
            // Poslat na server
            $.post('https://aprts_computer/saveSettings', JSON.stringify({
                themeColor: color, wallpaper: wall
            }));
            
            Swal.fire('Uloženo', '', 'success');
        });
    }
});